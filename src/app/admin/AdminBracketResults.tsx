"use client";

import { useState, useTransition } from "react";

type Team = { id: number; name: string };
type R = { stage: string; team_id: number };

const STAGES: { key: "QF" | "SF" | "FINAL" | "WINNER"; label: string; limit: number }[] = [
  { key: "QF", label: "Quarterfinalists", limit: 8 },
  { key: "SF", label: "Semifinalists", limit: 4 },
  { key: "FINAL", label: "Finalists", limit: 2 },
  { key: "WINNER", label: "Champion", limit: 1 },
];

export default function AdminBracketResults({
  teams,
  existing,
}: {
  teams: Team[];
  existing: R[];
}) {
  const [picks, setPicks] = useState<Record<string, Set<number>>>(
    Object.fromEntries(
      STAGES.map((s) => [
        s.key,
        new Set(existing.filter((e) => e.stage === s.key).map((e) => e.team_id)),
      ])
    )
  );
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  function toggle(stage: string, id: number, limit: number) {
    setPicks((prev) => {
      const next = { ...prev, [stage]: new Set(prev[stage]) };
      if (next[stage].has(id)) next[stage].delete(id);
      else {
        if (next[stage].size >= limit) return prev;
        next[stage].add(id);
      }
      return next;
    });
  }

  async function save() {
    setStatus("idle");
    start(async () => {
      try {
        const payload = Object.fromEntries(
          Object.entries(picks).map(([k, v]) => [k, [...v]])
        );
        const res = await fetch("/api/admin/bracket-result", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="glass-card space-y-5 rounded-2xl border border-outline-variant/30 p-5">
      {STAGES.map((s) => (
        <div key={s.key}>
          <div className="mb-2 flex items-center gap-3">
            <span className="display-italic text-base uppercase text-secondary">
              {s.label}
            </span>
            <span className="mono text-xs uppercase text-on-surface-variant">
              {picks[s.key].size}/{s.limit}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {teams.map((t) => {
              const on = picks[s.key].has(t.id);
              const disabled = !on && picks[s.key].size >= s.limit;
              return (
                <button
                  key={t.id}
                  disabled={disabled}
                  onClick={() => toggle(s.key, t.id, s.limit)}
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
                    on
                      ? "bg-secondary text-on-secondary"
                      : "bg-surface-low text-on-surface-variant hover:bg-surface-high"
                  } ${disabled && !on ? "opacity-30" : ""}`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-end gap-3 pt-2 text-sm">
        {status === "saved" && (
          <span className="mono uppercase text-primary">Saved</span>
        )}
        {status === "error" && (
          <span className="mono uppercase text-error">Error</span>
        )}
        <button
          disabled={pending}
          onClick={save}
          className="rounded-full bg-secondary px-5 py-2 text-xs font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110"
        >
          Save bracket actuals
        </button>
      </div>
    </div>
  );
}
