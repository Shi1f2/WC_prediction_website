"use client";

import { useMemo, useState, useTransition } from "react";

type Team = { id: number; name: string; group_letter: string | null };
type Result = { group_letter: string; position: number; team_id: number };

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

  const initial = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    for (const r of existing) {
      m[r.group_letter] ??= {};
      m[r.group_letter][r.position] = r.team_id;
    }
    return m;
  }, [existing]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...groups.entries()].map(([letter, ts]) => (
        <GroupCard
          key={letter}
          letter={letter}
          teams={ts}
          initial={initial[letter] ?? {}}
        />
      ))}
    </div>
  );
}

function GroupCard({
  letter,
  teams,
  initial,
}: {
  letter: string;
  teams: Team[];
  initial: Record<number, number>;
}) {
  const [vals, setVals] = useState<Record<number, number | "">>({
    1: initial[1] ?? "",
    2: initial[2] ?? "",
    3: initial[3] ?? "",
    4: initial[4] ?? "",
  });
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
    <div className="glass-card rounded-xl border border-outline-variant/30 p-4">
      <div className="display-italic mb-3 text-xl text-secondary">Group {letter}</div>
      {[1, 2, 3, 4].map((pos) => (
        <label key={pos} className="mt-1.5 flex items-center gap-2 text-sm">
          <span className="mono w-6 text-on-surface-variant">{pos}.</span>
          <select
            value={vals[pos] ?? ""}
            onChange={(e) =>
              setVals((p) => ({
                ...p,
                [pos]: e.target.value ? Number(e.target.value) : "",
              }))
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
