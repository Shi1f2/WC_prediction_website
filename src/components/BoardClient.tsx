"use client";

import { useState, useMemo, useEffect, useRef, useTransition } from "react";
import Flag from "./Flag";
import Canvas from "./Canvas";
import Bracket2026, {
  emptyBracket2026,
  type Bracket2026State,
} from "./Bracket2026";
import { reconstructBracketFromSets } from "@/lib/bracketReconstruct";
import LockCountdown from "./LockCountdown";

type Team = {
  id: number;
  name: string;
  code: string;
  flag: string;
  group_letter: string | null;
};
type GroupPicks = Record<string, (number | null)[]>;
type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function BoardClient({
  userId,
  allTeams,
  groups,
  initialGroupPicks,
  initialBracket,
  bracketLocked,
  bracketLockAt,
  bracketCommittedAt,
}: {
  userId: number;
  allTeams: Team[];
  groups: {
    letter: string;
    teams: Team[];
    locked: boolean;
    lockAt: string | null;
  }[];
  initialGroupPicks: GroupPicks;
  initialBracket: Record<string, number[]>;
  bracketLocked: boolean;
  bracketLockAt: string | null;
  bracketCommittedAt?: string | null;
}) {
  const storageKey = `wc_board_state_v1_user_${userId}`;
  const [picks, setPicks] = useState<GroupPicks>(initialGroupPicks);
  const [bracket, setBracket] = useState<Bracket2026State>(() =>
    emptyBracket2026()
  );
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount so drafts survive reloads. We also
  // hydrate AFTER lock-in so the user keeps seeing their committed picks.
  // If localStorage is empty but the user has already committed (e.g. their
  // browser was cleared, or they're on a different device), we reconstruct
  // the positional bracket from the set-based DB record.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let localHasPicks = false;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          picks: GroupPicks;
          bracket: Bracket2026State;
        }>;
        if (parsed.picks) setPicks(parsed.picks);
        if (parsed.bracket) {
          const b = parsed.bracket;
          const anyPick =
            b.R32?.some((x) => x != null) ||
            b.R16?.some((x) => x != null) ||
            b.QF?.some((x) => x != null) ||
            b.SF?.some((x) => x != null) ||
            (b.F?.[0] ?? null) != null;
          if (anyPick) {
            setBracket(b);
            localHasPicks = true;
          }
        }
      }
    } catch {
      // ignore corrupt local state
    }
    // If local storage didn't carry any actual bracket picks and the user has
    // committed, rebuild the positional state from the DB sets.
    if (!localHasPicks && bracketCommittedAt) {
      const rebuilt = reconstructBracketFromSets(
        initialGroupPicks,
        initialBracket
      );
      setBracket(rebuilt);
    }
    setHydrated(true);
  }, [storageKey, bracketCommittedAt, initialGroupPicks, initialBracket]);

  // Persist every change locally. After lock-in the DB owns state and we
  // can drop the local copy.
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ picks, bracket })
      );
    } catch {
      // quota / disabled storage — silently fail
    }
  }, [picks, bracket, hydrated, storageKey]);
  const [bracketStatus, setBracketStatus] = useState<SaveStatus>("idle");
  const [bracketPending, startBracket] = useTransition();
  const [committed, setCommitted] = useState<boolean>(
    !!bracketCommittedAt
  );
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockPending, setLockPending] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const effectiveBracketLocked = bracketLocked || committed;

  // Build teams-by-group map for the bracket to resolve slot references.
  const teamsByGroup = useMemo(() => {
    const m: Record<string, typeof allTeams> = {};
    for (const { letter, teams } of groups) m[letter] = teams;
    return m;
  }, [groups, allTeams]);
  void allTeams;
  void initialBracket;

  const advancing = useMemo(() => {
    const s = new Set<number>();
    for (const arr of Object.values(picks)) {
      if (arr[0]) s.add(arr[0]);
      if (arr[1]) s.add(arr[1]);
    }
    return s;
  }, [picks]);

  const bracketTeams = useMemo(
    () => allTeams.filter((t) => advancing.has(t.id)),
    [allTeams, advancing]
  );

  function changeGroupPick(letter: string, slotIdx: number, val: number | null) {
    if (committed) return;
    setPicks((prev) => {
      const arr = [...(prev[letter] ?? [null, null, null, null])];
      arr[slotIdx] = val;
      return { ...prev, [letter]: arr };
    });
  }

  function clearGroup(letter: string) {
    if (committed) return;
    setPicks((prev) => ({ ...prev, [letter]: [null, null, null, null] }));
  }

  function pickWinner(
    round: "R32" | "R16" | "QF" | "SF" | "F",
    matchIdx: number,
    teamId: number | null
  ) {
    if (effectiveBracketLocked) return;
    setBracket((prev) => {
      const next: Bracket2026State = {
        ...prev,
        R32: [...prev.R32],
        R16: [...prev.R16],
        QF: [...prev.QF],
        SF: [...prev.SF],
        F: [...prev.F],
      };
      next[round][matchIdx] = teamId;

      // Cascade-clear: anything downstream that depended on this slot.
      let idx = matchIdx;
      const downstream: Array<"R16" | "QF" | "SF" | "F"> =
        round === "R32"
          ? ["R16", "QF", "SF", "F"]
          : round === "R16"
            ? ["QF", "SF", "F"]
            : round === "QF"
              ? ["SF", "F"]
              : round === "SF"
                ? ["F"]
                : [];
      for (const stage of downstream) {
        idx = Math.floor(idx / 2);
        next[stage][idx] = null;
      }
      return next;
    });
    setBracketStatus("idle");
  }

  function pickThirdPlace(r32MatchIdx: number, teamId: number | null) {
    if (effectiveBracketLocked) return;
    setBracket((prev) => ({
      ...prev,
      thirdPlace: { ...prev.thirdPlace, [r32MatchIdx]: teamId },
    }));
    setBracketStatus("idle");
  }

  const allFilled = bracket.F[0] != null;

  async function lockIn() {
    setLockPending(true);
    setLockError(null);
    try {
      // 1. Persist every group's picks (1st/2nd/3rd/4th).
      await Promise.all(
        Object.entries(picks).map(async ([letter, arr]) => {
          const positions: Record<number, number | null> = {};
          for (let i = 0; i < 4; i++) positions[i + 1] = arr[i] ?? null;
          const res = await fetch("/api/predictions/group", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ group_letter: letter, positions }),
          });
          if (!res.ok) throw new Error(`group ${letter} save failed`);
        })
      );
      // 2. Persist bracket winners (and the derived stage sets).
      await saveBracketSync(bracket);
      // 3. Stamp the lock timestamp so further edits are rejected.
      const res = await fetch("/api/predictions/bracket/lock", {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      setCommitted(true);
      setLockModalOpen(false);
      // Intentionally KEEP localStorage so the user can still see their
      // picks rendered in the bracket after reload (UI is locked from edits
      // either way via `committed`).
    } catch {
      setLockError("Couldn't save and lock. Try again.");
    } finally {
      setLockPending(false);
    }
  }

  async function saveBracketSync(state: Bracket2026State) {
    const payload = {
      R16: state.R32.filter((x): x is number => x != null),
      QF: state.R16.filter((x): x is number => x != null),
      SF: state.QF.filter((x): x is number => x != null),
      FINAL: state.SF.filter((x): x is number => x != null),
      WINNER: state.F[0] != null ? [state.F[0]] : [],
    };
    const res = await fetch("/api/predictions/bracket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("save failed");
  }

  function saveBracket(stateOverride?: Bracket2026State) {
    const state = stateOverride ?? bracket;
    setBracketStatus("saving");
    startBracket(async () => {
      try {
        // Map positional bracket → set-based API stages.
        // R32 winners advance to R16 (the set used for scoring), etc.
        const payload = {
          R16: state.R32.filter((x): x is number => x != null),
          QF: state.R16.filter((x): x is number => x != null),
          SF: state.QF.filter((x): x is number => x != null),
          FINAL: state.SF.filter((x): x is number => x != null),
          WINNER: state.F[0] != null ? [state.F[0]] : [],
        };
        const res = await fetch("/api/predictions/bracket", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        setBracketStatus("saved");
      } catch {
        setBracketStatus("error");
      }
    });
  }

  function resetBracket() {
    if (effectiveBracketLocked) return;
    const empty = emptyBracket2026();
    setBracket(empty);
    saveBracket(empty);
  }

  function resetAll() {
    if (
      !confirm(
        "Reset every group pick AND your bracket? This can't be undone."
      )
    )
      return;
    const clearedGroups: GroupPicks = {};
    for (const { letter } of groups) {
      clearedGroups[letter] = [null, null, null, null];
    }
    setPicks(clearedGroups);
    const empty = emptyBracket2026();
    setBracket(empty);
    saveBracket(empty);
    // Groups will autosave one-by-one via per-card effects.
  }

  useEffect(() => {
    if (bracketStatus !== "saved") return;
    const t = setTimeout(() => setBracketStatus("idle"), 1500);
    return () => clearTimeout(t);
  }, [bracketStatus]);

  return (
    <div className="space-y-8">
      <section className="glass-card rounded-2xl border border-outline-variant/30 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="display-italic text-2xl uppercase text-secondary">
            Group Stage
          </h2>
          <div className="flex items-center gap-3">
            <span className="mono text-xs uppercase tracking-wider text-on-surface-variant">
              {advancing.size}/24 advancers · saved when you lock the bracket
            </span>
            <button
              onClick={resetAll}
              className="rounded-full border border-outline-variant/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:border-error hover:text-error"
            >
              Reset everything
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map(({ letter, teams, locked, lockAt }) => (
            <GroupCard
              key={letter}
              letter={letter}
              teams={teams}
              picks={picks[letter] ?? [null, null, null, null]}
              onChange={(idx, val) => changeGroupPick(letter, idx, val)}
              onClear={() => clearGroup(letter)}
              locked={locked || committed}
              lockAt={lockAt}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="display-italic text-2xl uppercase text-on-background">
            Knockout Bracket
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <LockCountdown
              lockAt={bracketLockAt}
              locked={effectiveBracketLocked}
              prefix="Picks lock"
            />
            <span className="mono text-xs text-on-background-variant">
              Pool: {bracketTeams.length} teams (your top-2 advancers)
            </span>
          </div>
        </div>
        <Canvas>
          <div className="p-10" style={{ width: 3200 }}>
            <Bracket2026
              teamsByGroup={teamsByGroup}
              groupPicks={picks}
              state={bracket}
              onPickWinner={pickWinner}
              onPickThirdPlace={pickThirdPlace}
              onSave={() => saveBracket()}
              onReset={resetBracket}
              saveStatus={bracketStatus}
              pending={bracketPending}
              locked={effectiveBracketLocked}
            />
          </div>
        </Canvas>
      </section>

      {!effectiveBracketLocked && (
        <div
          data-no-pan
          className="fixed bottom-4 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-3 rounded-full border border-outline-variant/40 bg-surface-lowest px-3 shadow-floating"
        >
          <span className="mono px-3 text-[10px] uppercase tracking-wider text-on-surface-variant">
            {allFilled
              ? "All picks in — ready to commit"
              : "Pick the Champion to enable"}
          </span>
          <button
            onClick={() => setLockModalOpen(true)}
            disabled={!allFilled}
            className={`rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed ${
              allFilled
                ? "bg-secondary text-on-secondary shadow-glow hover:brightness-110"
                : "bg-surface-high text-on-surface-variant opacity-60"
            }`}
          >
            🔒 Lock in
          </button>
        </div>
      )}

      {lockModalOpen && (
        <LockModal
          pending={lockPending}
          error={lockError}
          onCancel={() => setLockModalOpen(false)}
          onConfirm={lockIn}
        />
      )}
    </div>
  );
}

function LockModal({
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur"
      onClick={pending ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-outline-variant/40 bg-surface-container p-6 text-on-surface shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="display-italic mb-2 text-3xl uppercase text-secondary">
          Lock it in?
        </div>
        <p className="text-sm text-on-surface-variant">
          Once you lock your bracket you <b className="text-on-surface">can&apos;t</b>
          {" "}change any of your knockout picks. Make sure every matchup, third-place
          slot, and champion is the one you want.
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-error/15 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={pending}
            className="rounded-full border border-outline-variant/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface hover:bg-surface-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="rounded-full bg-secondary px-6 py-2 text-xs font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Locking…" : "Lock in"}
          </button>
        </div>
      </div>
    </div>
  );
}

type DragPayload = { teamId: number; from: number | "pool" };

function GroupCard({
  letter,
  teams,
  picks,
  onChange,
  onClear,
  locked,
  lockAt,
}: {
  letter: string;
  teams: Team[];
  picks: (number | null)[];
  onChange: (slotIdx: number, val: number | null) => void;
  onClear: () => void;
  locked: boolean;
  lockAt: string | null;
}) {
  const [dragOver, setDragOver] = useState<number | "pool" | null>(null);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const used = new Set(picks.filter((x): x is number => x != null));
  const pool = teams.filter((t) => !used.has(t.id));
  const anyPicked = picks.some((x) => x != null);

  function place(teamId: number, from: number | "pool", to: number | "pool") {
    if (locked) return;
    if (to === "pool") {
      if (typeof from === "number") onChange(from, null);
      return;
    }
    const target = picks[to];
    if (from === "pool") {
      onChange(to, teamId);
    } else if (from === to) {
      // no-op
    } else {
      onChange(to, teamId);
      onChange(from, target ?? null);
    }
  }

  function tap(teamId: number, from: number | "pool") {
    if (locked) return;
    if (from === "pool") {
      const empty = picks.findIndex((x) => x == null);
      if (empty >= 0) onChange(empty, teamId);
    } else {
      onChange(from, null);
    }
  }

  function onDragStart(
    e: React.DragEvent,
    teamId: number,
    from: number | "pool"
  ) {
    if (locked) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(
      "application/x-team",
      JSON.stringify({ teamId, from } satisfies DragPayload)
    );
    e.dataTransfer.effectAllowed = "move";
  }

  function onZoneDragOver(e: React.DragEvent, zone: number | "pool") {
    if (locked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(zone);
  }

  function onZoneDrop(e: React.DragEvent, to: number | "pool") {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData("application/x-team");
    if (!raw) return;
    try {
      const { teamId, from } = JSON.parse(raw) as DragPayload;
      place(teamId, from, to);
    } catch {}
  }

  const labels = ["1st", "2nd", "3rd", "4th"];

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-low p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="display-italic text-2xl text-secondary">
          Group {letter}
        </h3>
        <div className="flex items-center gap-2">
          <LockCountdown lockAt={lockAt} locked={locked} />
          {!locked && anyPicked && (
            <button
              onClick={onClear}
              title="Clear all picks in this group"
              className="rounded-full border border-outline-variant/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant hover:border-error hover:text-error"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        onDragOver={(e) => onZoneDragOver(e, "pool")}
        onDragLeave={() => setDragOver((p) => (p === "pool" ? null : p))}
        onDrop={(e) => onZoneDrop(e, "pool")}
        className={`mb-3 grid min-h-[96px] grid-cols-2 grid-rows-2 content-start gap-1.5 rounded-lg border border-dashed p-2 transition ${
          dragOver === "pool"
            ? "border-secondary bg-secondary/15"
            : "border-outline-variant/30"
        }`}
      >
        {pool.length === 0 && (
          <span className="col-span-2 row-span-2 flex items-center justify-center text-[11px] italic text-on-surface-variant">
            All teams placed
          </span>
        )}
        {pool.map((t) => (
          <TeamChip
            key={t.id}
            team={t}
            from="pool"
            locked={locked}
            onDragStart={onDragStart}
            onClick={() => tap(t.id, "pool")}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        {labels.map((label, idx) => {
          const teamId = picks[idx];
          const team = teamId != null ? teamById.get(teamId) : null;
          const over = dragOver === idx;
          const isAdvancer = idx < 2;
          const filledClasses = isAdvancer
            ? locked
              ? "cursor-not-allowed bg-secondary/15 text-secondary opacity-70"
              : "cursor-grab bg-secondary/25 text-secondary hover:bg-secondary/35 active:cursor-grabbing"
            : locked
              ? "cursor-not-allowed bg-surface-high text-on-surface-variant opacity-70"
              : "cursor-grab bg-surface-high text-on-surface hover:bg-surface-highest active:cursor-grabbing";
          return (
            <div
              key={idx}
              onDragOver={(e) => onZoneDragOver(e, idx)}
              onDragLeave={() =>
                setDragOver((p) => (p === idx ? null : p))
              }
              onDrop={(e) => onZoneDrop(e, idx)}
              className={`flex h-11 items-center gap-2 rounded-lg border-2 border-dashed px-2 transition ${
                over
                  ? "border-secondary bg-secondary/15"
                  : team
                    ? "border-outline-variant/40 bg-surface-container"
                    : "border-outline-variant/25"
              }`}
            >
              <span
                className={`mono shrink-0 text-[10px] uppercase tracking-wider ${
                  isAdvancer ? "text-secondary" : "text-on-surface-variant"
                }`}
              >
                {label}
              </span>
              {team ? (
                <div
                  draggable={!locked}
                  onDragStart={(e) => onDragStart(e, team.id, idx)}
                  onClick={() => tap(team.id, idx)}
                  title={`${team.name} — drag or click to remove`}
                  className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-xs font-bold uppercase ${filledClasses}`}
                >
                  <Flag code={team.flag} size="sm" />
                  <span className="truncate">{team.name}</span>
                </div>
              ) : (
                <span className="truncate text-[11px] italic text-on-surface-variant">
                  drop here
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status, locked }: { status: SaveStatus; locked: boolean }) {
  if (locked) {
    return (
      <span className="mono rounded-full bg-surface-high px-2 py-0.5 text-[9px] uppercase tracking-wider text-on-surface-variant">
        Locked
      </span>
    );
  }
  if (status === "saving")
    return (
      <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
        Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="mono text-[10px] uppercase tracking-wider text-primary">
        ✓
      </span>
    );
  if (status === "error")
    return (
      <span className="mono text-[10px] uppercase tracking-wider text-error">
        !
      </span>
    );
  return null;
}

function TeamChip({
  team,
  from,
  locked,
  onDragStart,
  onClick,
}: {
  team: Team;
  from: number | "pool";
  locked: boolean;
  onDragStart: (
    e: React.DragEvent,
    teamId: number,
    from: number | "pool"
  ) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable={!locked}
      onDragStart={(e) => onDragStart(e, team.id, from)}
      onClick={onClick}
      title={team.name}
      className={`flex max-w-full select-none items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold uppercase ${
        locked
          ? "cursor-not-allowed bg-surface-container text-on-surface-variant opacity-60"
          : "cursor-grab bg-surface-container text-on-surface hover:bg-surface-high active:cursor-grabbing"
      }`}
    >
      <Flag code={team.flag} size="sm" />
      <span className="truncate">{team.name}</span>
    </div>
  );
}
