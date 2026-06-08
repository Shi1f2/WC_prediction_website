"use client";

import { useState, useTransition, useEffect } from "react";
import Flag from "@/components/Flag";
import { scoreMatch } from "@/lib/matchScore";

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

export default function MatchRow({ match }: { match: Match }) {
  const [a, setA] = useState<string>(
    match.pred_a == null ? "" : String(match.pred_a)
  );
  const [b, setB] = useState<string>(
    match.pred_b == null ? "" : String(match.pred_b)
  );
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
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
  const notOpenYet = msUntil > DAY_MS;
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
  const inputsDisabled = locked || notOpenYet || pending;

  const teamA = match.team_a_name ?? match.team_a_label ?? "TBD";
  const teamB = match.team_b_name ?? match.team_b_label ?? "TBD";

  async function save() {
    setStatus("idle");
    start(async () => {
      try {
        const res = await fetch("/api/predictions/match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            match_id: match.id,
            score_a: Number(a),
            score_b: Number(b),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  let badge: {
    text: string;
    tone: "final" | "live" | "locked" | "soon" | "later";
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
    badge = { text: `Opens in ${formatCountdown(msUntil - DAY_MS)}`, tone: "later" };
  } else {
    badge = { text: `${formatCountdown(msUntil)} left`, tone: "soon" };
  }

  return (
    <div
      className={`glass-card rounded-xl border p-4 transition-colors ${
        notOpenYet
          ? "border-outline-variant/20 opacity-70"
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
            className="mono h-11 w-12 rounded-lg border border-outline-variant/40 bg-surface-low text-center text-lg font-bold focus:border-secondary focus:outline-none disabled:opacity-40"
          />
          <span className="mono text-secondary">–</span>
          <input
            type="number"
            min={0}
            max={20}
            value={b}
            disabled={inputsDisabled}
            onChange={(e) => setB(e.target.value)}
            className="mono h-11 w-12 rounded-lg border border-outline-variant/40 bg-surface-low text-center text-lg font-bold focus:border-secondary focus:outline-none disabled:opacity-40"
          />
        </div>
        <div className="flex items-center gap-2 truncate">
          {match.team_b_flag ? <Flag code={match.team_b_flag} size="md" /> : null}
          <span className="truncate text-sm font-bold uppercase">{teamB}</span>
        </div>
      </div>
      {!locked && !notOpenYet && (
        <div className="mt-3 flex items-center justify-end gap-3 text-xs">
          {status === "saved" && (
            <span className="mono uppercase text-primary">Saved</span>
          )}
          {status === "error" && (
            <span className="mono uppercase text-error">Error</span>
          )}
          <button
            onClick={save}
            disabled={pending || a === "" || b === ""}
            className="rounded-full bg-secondary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
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
                    : "bg-surface-high text-on-surface-variant"
                }`}
              >
                {earnedPoints > 0
                  ? `+${earnedPoints} pt${earnedPoints === 1 ? "" : "s"}`
                  : "0 pts"}
              </span>
            )}
            {provisionalPoints != null && (
              <span className="mono rounded-full bg-error/20 px-2 py-0.5 text-error">
                {provisionalPoints > 0
                  ? `+${provisionalPoints} so far`
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
                You didn&apos;t make a prediction for this match.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
