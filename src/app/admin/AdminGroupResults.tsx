"use client";

import { useMemo, useState, useTransition } from "react";

type Team = { id: number; name: string; group_letter: string | null };
type Result = { group_letter: string; position: number; team_id: number };

type GroupVals = Record<string, Record<number, number | "">>;

// Server response from /api/admin/group-standings.
type ComputedStanding = {
  team_id: number;
  name: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  position: number;
  tied_with: number[];
};
type ComputedGroup = {
  group_letter: string;
  standings: ComputedStanding[];
  has_unresolved_tie: boolean;
};

export default function AdminGroupResults({
  teams,
  existing,
}: {
  teams: Team[];
  existing: Result[];
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Team[]>();
    for (const t of teams) {
      if (!t.group_letter) continue;
      const arr = m.get(t.group_letter) ?? [];
      arr.push(t);
      m.set(t.group_letter, arr);
    }
    return m;
  }, [teams]);

  const initial = useMemo<GroupVals>(() => {
    const m: GroupVals = {};
    for (const [letter] of groups) {
      m[letter] = { 1: "", 2: "", 3: "", 4: "" };
    }
    for (const r of existing) {
      m[r.group_letter] ??= { 1: "", 2: "", 3: "", 4: "" };
      m[r.group_letter][r.position] = r.team_id;
    }
    return m;
  }, [existing, groups]);

  const [vals, setVals] = useState<GroupVals>(initial);
  // Tied-pair warnings, keyed by group letter, surfaced under the card title.
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [autoFilling, startAutoFill] = useTransition();
  const [autoFillError, setAutoFillError] = useState<string | null>(null);

  function setGroupVals(letter: string, next: Record<number, number | "">) {
    setVals((p) => ({ ...p, [letter]: next }));
  }

  function autoFill() {
    setAutoFillError(null);
    startAutoFill(async () => {
      try {
        const res = await fetch("/api/admin/group-standings");
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { groups: ComputedGroup[] };
        const nextVals: GroupVals = { ...vals };
        const nextWarnings: Record<string, string> = {};
        for (const g of json.groups) {
          const positions: Record<number, number | ""> = { 1: "", 2: "", 3: "", 4: "" };
          for (const s of g.standings) {
            if (s.position >= 1 && s.position <= 4) {
              positions[s.position] = s.team_id;
            }
          }
          nextVals[g.group_letter] = positions;
          // Build a human-readable warning string when teams share pts+gd+gf.
          const tied = g.standings.filter((s) => s.tied_with.length > 0);
          if (tied.length > 0) {
            const groupedNames = new Set<string>();
            for (const s of tied) {
              const others = g.standings.filter((o) =>
                s.tied_with.includes(o.team_id),
              );
              groupedNames.add(
                [s, ...others]
                  .map((x) => x.name)
                  .sort()
                  .join(" / "),
              );
            }
            nextWarnings[g.group_letter] = `Tie on pts/GD/GF: ${[...groupedNames].join("; ")}`;
          }
        }
        setVals(nextVals);
        setWarnings(nextWarnings);
      } catch (e) {
        setAutoFillError(e instanceof Error ? e.message : "Auto-fill failed");
      }
    });
  }

  const tiedCount = Object.keys(warnings).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-low p-3">
        <button
          onClick={autoFill}
          disabled={autoFilling}
          className="rounded-full bg-secondary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-on-secondary hover:brightness-110 disabled:opacity-50"
        >
          {autoFilling ? "Computing…" : "Auto-fill from match scores"}
        </button>
        <span className="text-xs text-on-surface-variant">
          Sorts each group by points → goal difference → goals scored. You still
          need to click <b>Save</b> on each group to commit.
        </span>
        {tiedCount > 0 && (
          <span className="mono rounded-full bg-error/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-error">
            {tiedCount} group{tiedCount === 1 ? "" : "s"} need manual tie-break
          </span>
        )}
        {autoFillError && (
          <span className="mono text-[10px] uppercase tracking-wider text-error">
            {autoFillError}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...groups.entries()].map(([letter, ts]) => (
          <GroupCard
            key={letter}
            letter={letter}
            teams={ts}
            vals={vals[letter] ?? { 1: "", 2: "", 3: "", 4: "" }}
            onChange={(next) => setGroupVals(letter, next)}
            warning={warnings[letter] ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function GroupCard({
  letter,
  teams,
  vals,
  onChange,
  warning,
}: {
  letter: string;
  teams: Team[];
  vals: Record<number, number | "">;
  onChange: (next: Record<number, number | "">) => void;
  warning: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  function save() {
    setStatus("idle");
    start(async () => {
      try {
        const res = await fetch("/api/admin/group-result", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ group_letter: letter, positions: vals }),
        });
        if (!res.ok) throw new Error(await res.text());
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div
      className={`glass-card rounded-xl border p-4 ${
        warning ? "border-error/50" : "border-outline-variant/30"
      }`}
    >
      <div className="display-italic mb-3 text-xl text-secondary">Group {letter}</div>
      {warning && (
        <div className="mb-2 rounded-lg bg-error/10 px-2 py-1 text-[11px] text-error">
          {warning}
        </div>
      )}
      {[1, 2, 3, 4].map((pos) => (
        <label key={pos} className="mt-1.5 flex items-center gap-2 text-sm">
          <span className="mono w-6 text-on-surface-variant">{pos}.</span>
          <select
            value={vals[pos] ?? ""}
            onChange={(e) =>
              onChange({
                ...vals,
                [pos]: e.target.value ? Number(e.target.value) : "",
              })
            }
            className="flex-1 rounded-lg border border-outline-variant/40 bg-surface-low px-2 py-1.5 focus:border-secondary focus:outline-none"
          >
            <option value="">—</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="mt-3 flex items-center justify-end gap-2 text-xs">
        {status === "saved" && (
          <span className="mono uppercase text-primary">Saved</span>
        )}
        {status === "error" && (
          <span className="mono uppercase text-error">Error</span>
        )}
        <button
          disabled={pending}
          onClick={save}
          className="rounded-full bg-secondary px-3 py-1 font-bold uppercase tracking-wider text-on-secondary hover:brightness-110"
        >
          Save
        </button>
      </div>
    </div>
  );
}
