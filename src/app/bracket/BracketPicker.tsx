"use client";

import { useState, useTransition } from "react";
import Flag from "@/components/Flag";

type Team = { id: number; name: string; flag: string };

const STAGES: { key: "QF" | "SF" | "FINAL" | "WINNER"; label: string; limit: number; pts: number }[] = [
  { key: "QF", label: "Quarterfinalists", limit: 8, pts: 2 },
  { key: "SF", label: "Semifinalists", limit: 4, pts: 4 },
  { key: "FINAL", label: "Finalists", limit: 2, pts: 8 },
  { key: "WINNER", label: "Champion", limit: 1, pts: 16 },
];

export default function BracketPicker({
  teams,
  initial,
  locked,
}: {
  teams: Team[];
  initial: Record<string, number[]>;
  locked: boolean;
}) {
  const [picks, setPicks] = useState<Record<string, Set<number>>>(
    Object.fromEntries(STAGES.map((s) => [s.key, new Set(initial[s.key] ?? [])]))
  );
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const [activeStage, setActiveStage] = useState<"QF" | "SF" | "FINAL" | "WINNER">("QF");

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
    setStatus("idle");
  }

  async function save() {
    setStatus("idle");
    start(async () => {
      try {
        const payload = Object.fromEntries(
          Object.entries(picks).map(([k, v]) => [k, [...v]])
        );
        const res = await fetch("/api/predictions/bracket", {
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

  const stage = STAGES.find((s) => s.key === activeStage)!;
  const selected = picks[stage.key];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl border border-outline-variant/30 p-2">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {STAGES.map((s) => {
            const active = activeStage === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveStage(s.key)}
                className={`rounded-xl px-3 py-3 text-left transition ${
                  active
                    ? "bg-secondary text-on-secondary shadow-glow"
                    : "bg-surface-low hover:bg-surface-high"
                }`}
              >
                <div
                  className={`mono text-[10px] uppercase tracking-wider ${
                    active ? "text-on-secondary/80" : "text-on-surface-variant"
                  }`}
                >
                  {s.pts} pts each
                </div>
                <div className="display-italic mt-0.5 text-base uppercase">
                  {s.label}
                </div>
                <div
                  className={`mono mt-1 text-xs font-bold ${
                    active ? "text-on-secondary" : "text-on-surface-variant"
                  }`}
                >
                  {picks[s.key].size}/{s.limit}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {teams.map((t) => {
          const on = selected.has(t.id);
          const disabled = locked || (!on && selected.size >= stage.limit);
          return (
            <button
              key={t.id}
              disabled={disabled}
              onClick={() => toggle(stage.key, t.id, stage.limit)}
              className={`glass-card flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                on
                  ? "border-secondary bg-secondary/20 shadow-glow"
                  : "border-outline-variant/30 hover:border-secondary/40"
              } ${disabled && !on ? "opacity-30" : ""}`}
            >
              <Flag code={t.flag} size="md" />
              <span className="truncate font-bold uppercase">{t.name}</span>
            </button>
          );
        })}
      </div>

      {!locked && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {status === "saved" && (
            <span className="mono text-sm uppercase text-primary">Saved</span>
          )}
          {status === "error" && (
            <span className="mono text-sm uppercase text-error">Error</span>
          )}
          <button
            disabled={pending}
            onClick={save}
            className="rounded-full bg-secondary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save bracket"}
          </button>
        </div>
      )}
      {locked && (
        <p className="text-center text-sm text-on-surface-variant">
          Bracket is locked. Your picks are above.
        </p>
      )}
    </div>
  );
}
