"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Flag from "@/components/Flag";
import { POINTS, scoreMatch } from "@/lib/matchScore";
import { MARKET_BY_ID } from "@/lib/markets";
import MarketPicks from "./MarketPicks";

type Match = {
  id: number;
  stage: string;
  group_letter: string | null;
  team_a_name: string | null;
  team_a_flag: string | null;
  team_a_label: string | null;
  team_b_name: string | null;
  team_b_flag: string | null;
  team_b_label: string | null;
  kickoff_at: string;
  actual_score_a: number | null;
  actual_score_b: number | null;
  status: string | null;
  pred_a: number | null;
  pred_b: number | null;
};

const LIVE_STATUSES = new Set([
  "IN_PLAY",
  "PAUSED",
  "EXTRA_TIME",
  "PENALTY_SHOOTOUT",
]);
const FINAL_STATUSES = new Set(["FINISHED", "AWARDED"]);

const STAGE_LABELS: Record<string, string> = {
  group: "Group",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarterfinal",
  sf: "Semifinal",
  third: "3rd-place",
  final: "Final",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_WINDOW_MS = 36 * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  const d = Math.floor(ms / DAY_MS);
  const h = Math.floor((ms % DAY_MS) / (60 * 60 * 1000));
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  return `${h}h ${m}m`;
}

// Approximate match clock from kickoff. Football matches have a ~15-min break
// between halves; we offset for that. Returns null if not in a live status.
function liveMinute(
  status: string | null,
  kickoffMs: number,
  nowMs: number,
): string | null {
  if (status === "PAUSED") return "HT";
  if (status === "PENALTY_SHOOTOUT") return "PENS";
  if (status === "EXTRA_TIME") return "ET";
  if (status !== "IN_PLAY") return null;
  const elapsed = Math.floor((nowMs - kickoffMs) / 60_000);
  if (elapsed < 1) return "1'";
  if (elapsed <= 45) return `${elapsed}'`;
  if (elapsed <= 60) return "45'+";
  if (elapsed <= 105) return `${elapsed - 15}'`;
  return "90'+";
}

export default function MatchRow({
  match,
  marketPicks = {},
  forceOpen = false,
}: {
  match: Match;
  marketPicks?: Record<string, string>;
  forceOpen?: boolean;
}) {
  const router = useRouter();

  // Bet is "submitted" if the user has any saved pick (score or market) from
  // the server. Once submitted, everything is locked — re-rendering happens
  // server-side after a successful save via router.refresh().
  const submittedFromServer =
    match.pred_a != null || Object.keys(marketPicks).length > 0;

  const [a, setA] = useState<string>(
    match.pred_a == null ? "" : String(match.pred_a),
  );
  const [b, setB] = useState<string>(
    match.pred_b == null ? "" : String(match.pred_b),
  );
  const [marketsDraft, setMarketsDraft] =
    useState<Record<string, string>>(marketPicks);
  const [submitStatus, setSubmitStatus] = useState<{
    state: "idle" | "saved" | "error";
    message?: string;
  }>({ state: submittedFromServer ? "saved" : "idle" });
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Faster tick while live so the minute counter stays accurate.
    const tick =
      match.status != null && LIVE_STATUSES.has(match.status) ? 30_000 : 60_000;
    const id = setInterval(() => setNow(Date.now()), tick);
    return () => clearInterval(id);
  }, [match.status]);

  const kickoff = new Date(match.kickoff_at).getTime();
  const msUntil = kickoff - now;
  const locked = msUntil <= 0;
  const notOpenYet = !forceOpen && msUntil > OPEN_WINDOW_MS;
  const isLive = match.status != null && LIVE_STATUSES.has(match.status);
  const isFinal =
    (match.status != null && FINAL_STATUSES.has(match.status)) ||
    // Fallback for matches that have a score but no synced status yet.
    (match.actual_score_a != null && match.actual_score_b != null);
  const hasScore =
    match.actual_score_a != null && match.actual_score_b != null;
  const hasPrediction = match.pred_a != null && match.pred_b != null;

  const earnedPoints =
    isFinal && hasPrediction
      ? scoreMatch(
          match.pred_a!,
          match.pred_b!,
          match.actual_score_a!,
          match.actual_score_b!,
        )
      : null;
  const provisionalPoints =
    isLive && hasScore && hasPrediction
      ? scoreMatch(
          match.pred_a!,
          match.pred_b!,
          match.actual_score_a!,
          match.actual_score_b!,
        )
      : null;

  // Read-only when bet is already submitted, kickoff has passed, or window
  // hasn't opened yet. Locks everything (score inputs + market pills).
  const isReadOnly = submittedFromServer || locked || notOpenYet;
  const inputsDisabled = isReadOnly || pending;

  const teamA = match.team_a_name ?? match.team_a_label ?? "TBD";
  const teamB = match.team_b_name ?? match.team_b_label ?? "TBD";

  const scoreFilled = a !== "" && b !== "";
  const hasDraftBet = scoreFilled || Object.keys(marketsDraft).length > 0;

  // Symmetric +/- stakes for the currently drafted bet — exact score is worth
  // 10, each market pick is worth its catalog value. Win and loss magnitudes
  // match, so one number drives both labels.
  const stakeMagnitude =
    (scoreFilled ? POINTS.exactScore : 0) +
    Object.entries(marketsDraft).reduce((sum, [m, p]) => {
      const opt = MARKET_BY_ID[m]?.options.find((o) => o.value === p);
      return sum + (opt?.points ?? 0);
    }, 0);

  function setMarketDraft(market: string, pick: string | null) {
    setMarketsDraft((p) => {
      if (pick == null) {
        const copy = { ...p };
        delete copy[market];
        return copy;
      }
      const next = { ...p, [market]: pick };
      // At most one "over" and one "under" across the 3 O/U thresholds —
      // picking "over 2.5" when "over 1.5" is already selected silently
      // replaces it (same-direction bets on different thresholds would be
      // redundant). "Over 1.5 + Under 3.5" remains allowed.
      const OU = ["ou_15", "ou_25", "ou_35"];
      if (OU.includes(market) && (pick === "over" || pick === "under")) {
        for (const other of OU) {
          if (other !== market && next[other] === pick) delete next[other];
        }
      }
      return next;
    });
    if (submitStatus.state === "error")
      setSubmitStatus({ state: "idle" });
  }

  async function submitBet() {
    setSubmitStatus({ state: "idle" });
    start(async () => {
      try {
        const res = await fetch("/api/predictions/bet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            match_id: match.id,
            score: scoreFilled ? { a: Number(a), b: Number(b) } : null,
            markets: Object.entries(marketsDraft).map(([market, pick]) => ({
              market,
              pick,
            })),
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = "Save failed";
          try {
            const j = JSON.parse(text);
            if (j?.error) msg = j.error;
          } catch {}
          throw new Error(msg);
        }
        setSubmitStatus({ state: "saved" });
        // Pull the now-locked state from the server (renders read-only UI).
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed";
        setSubmitStatus({ state: "error", message: msg });
      }
    });
  }

  let badge: {
    text: string;
    tone: "final" | "live" | "locked" | "soon" | "later" | "submitted";
  } | null = null;
  if (isFinal) {
    badge = {
      text: `Final ${match.actual_score_a}-${match.actual_score_b}`,
      tone: "final",
    };
  } else if (isLive) {
    const minute = liveMinute(match.status, kickoff, now);
    badge = { text: minute ? `Live · ${minute}` : "Live", tone: "live" };
  } else if (locked) {
    badge = { text: "Locked", tone: "locked" };
  } else if (notOpenYet) {
    badge = {
      text: `Opens in ${formatCountdown(msUntil - OPEN_WINDOW_MS)}`,
      tone: "later",
    };
  } else if (submittedFromServer) {
    badge = { text: "Bet locked in", tone: "submitted" };
  } else {
    badge = { text: `${formatCountdown(msUntil)} left`, tone: "soon" };
  }

  return (
    <div
      className={`glass-card rounded-xl border p-4 transition-colors ${
        notOpenYet
          ? "border-outline-variant/20 opacity-70"
          : submittedFromServer
            ? "border-primary/30"
            : locked
              ? "border-outline-variant/30"
              : "border-secondary/30 hover:border-secondary/60"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-on-surface-variant">
        <span className="mono">
          {match.group_letter
            ? `Group ${match.group_letter}`
            : STAGE_LABELS[match.stage] ?? match.stage}
          {" · "}
          {new Date(match.kickoff_at).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span
          className={`mono inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            badge.tone === "final"
              ? "bg-primary/20 text-primary"
              : badge.tone === "live"
                ? "bg-error/20 text-error"
                : badge.tone === "locked"
                  ? "bg-surface-high text-on-surface-variant"
                  : badge.tone === "soon"
                    ? "bg-secondary/20 text-secondary"
                    : badge.tone === "submitted"
                      ? "bg-primary/15 text-primary"
                      : "bg-white/5 text-on-surface-variant"
          }`}
        >
          {badge.tone === "live" && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
          )}
          {badge.text}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center justify-end gap-2 truncate text-right">
          <span className="truncate text-sm font-bold uppercase">{teamA}</span>
          {match.team_a_flag ? <Flag code={match.team_a_flag} size="md" /> : null}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={20}
            value={a}
            disabled={inputsDisabled}
            onChange={(e) => setA(e.target.value)}
            placeholder="–"
            className="mono h-11 w-12 rounded-lg border border-outline-variant/40 bg-surface-low text-center text-lg font-bold focus:border-secondary focus:outline-none disabled:opacity-60"
          />
          <span className="mono text-secondary">–</span>
          <input
            type="number"
            min={0}
            max={20}
            value={b}
            disabled={inputsDisabled}
            onChange={(e) => setB(e.target.value)}
            placeholder="–"
            className="mono h-11 w-12 rounded-lg border border-outline-variant/40 bg-surface-low text-center text-lg font-bold focus:border-secondary focus:outline-none disabled:opacity-60"
          />
        </div>
        <div className="flex items-center gap-2 truncate">
          {match.team_b_flag ? <Flag code={match.team_b_flag} size="md" /> : null}
          <span className="truncate text-sm font-bold uppercase">{teamB}</span>
        </div>
      </div>
      {!locked && !notOpenYet && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
            Exact score · optional ·{" "}
            <span className="text-primary/90">+10</span>
            <span className="opacity-40"> / </span>
            <span className="text-error/90">−10</span>
          </span>
        </div>
      )}
      <MarketPicks
        isFinal={isFinal}
        actualA={match.actual_score_a}
        actualB={match.actual_score_b}
        teamA={teamA}
        teamB={teamB}
        picks={isReadOnly ? marketPicks : marketsDraft}
        onChange={setMarketDraft}
        readOnly={isReadOnly}
        hideIfEmpty={notOpenYet}
      />
      {!isReadOnly && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
            <span className="text-on-surface-variant">At stake</span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                stakeMagnitude > 0
                  ? "bg-primary/15 text-primary"
                  : "bg-surface-high text-on-surface-variant"
              }`}
            >
              +{stakeMagnitude}
            </span>
            <span className="text-on-surface-variant opacity-50">/</span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                stakeMagnitude > 0
                  ? "bg-error/15 text-error"
                  : "bg-surface-high text-on-surface-variant"
              }`}
            >
              −{stakeMagnitude}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {submitStatus.state === "error" && (
              <span className="mono uppercase text-error">
                {submitStatus.message ?? "Error"}
              </span>
            )}
            <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              Saving locks all picks
            </span>
            <button
              onClick={submitBet}
              disabled={pending || !hasDraftBet}
              className="rounded-full bg-secondary px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110 disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save bet"}
            </button>
          </div>
        </div>
      )}
      {hasScore && (
        <div
          className={`mt-3 rounded-lg border p-3 ${
            isLive
              ? "border-error/30 bg-error/5"
              : "border-primary/30 bg-primary/5"
          }`}
        >
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
            <span className={isLive ? "text-error" : "text-primary"}>
              {isLive ? "Live result" : "Final result"}
            </span>
            {earnedPoints != null && (
              <span
                className={`mono rounded-full px-2 py-0.5 ${
                  earnedPoints > 0
                    ? "bg-primary/20 text-primary"
                    : earnedPoints < 0
                      ? "bg-error/20 text-error"
                      : "bg-surface-high text-on-surface-variant"
                }`}
              >
                {earnedPoints > 0
                  ? `+${earnedPoints} pts`
                  : earnedPoints < 0
                    ? `${earnedPoints} pts`
                    : "0 pts"}
              </span>
            )}
            {provisionalPoints != null && (
              <span
                className={`mono rounded-full px-2 py-0.5 ${
                  provisionalPoints > 0
                    ? "bg-secondary/20 text-secondary"
                    : provisionalPoints < 0
                      ? "bg-error/20 text-error"
                      : "bg-surface-high text-on-surface-variant"
                }`}
              >
                {provisionalPoints > 0
                  ? `+${provisionalPoints} so far`
                  : provisionalPoints < 0
                    ? `${provisionalPoints} so far`
                    : "0 so far"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
            <div className="text-right text-on-surface-variant">Actual</div>
            <div className="mono text-center text-lg font-bold text-on-surface">
              {match.actual_score_a} – {match.actual_score_b}
            </div>
            <div className="mono text-left text-xs uppercase tracking-wider text-on-surface-variant">
              {isLive
                ? liveMinute(match.status, kickoff, now) ?? "in play"
                : "full time"}
            </div>
            {hasPrediction ? (
              <>
                <div className="text-right text-on-surface-variant">
                  Your pick
                </div>
                <div className="mono text-center text-base font-bold text-on-surface-variant">
                  {match.pred_a} – {match.pred_b}
                </div>
                <div />
              </>
            ) : (
              <div className="col-span-3 text-center text-xs italic text-on-surface-variant">
                You didn&apos;t place an exact-score bet for this match.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
