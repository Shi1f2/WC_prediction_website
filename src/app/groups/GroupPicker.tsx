"use client";

import { useState, useTransition } from "react";
import Flag from "@/components/Flag";

type Team = { id: number; name: string; flag: string; code: string };

export default function GroupPicker({
  letter,
  teams,
  pick1,
  pick2,
  locked,
}: {
  letter: string;
  teams: Team[];
  pick1?: number;
  pick2?: number;
  locked: boolean;
}) {
  const [p1, setP1] = useState<number | undefined>(pick1);
  const [p2, setP2] = useState<number | undefined>(pick2);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  async function save() {
    setStatus("idle");
    start(async () => {
      try {
        const res = await fetch("/api/predictions/group", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            group_letter: letter,
            first_team_id: p1,
            second_team_id: p2,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="display-italic text-2xl text-secondary">Group {letter}</h3>
        {locked && (
          <span className="mono rounded-full bg-surface-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Locked
          </span>
        )}
      </div>
      <ul className="mb-4 space-y-1.5 text-sm">
        {teams.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-on-surface-variant">
            <Flag code={t.flag} size="sm" />
            <span>{t.name}</span>
          </li>
        ))}
      </ul>
      <label className="block">
        <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          1st place
        </span>
        <select
          value={p1 ?? ""}
          disabled={locked || pending}
          onChange={(e) => setP1(e.target.value ? Number(e.target.value) : undefined)}
          className="mt-1 block w-full rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2 text-sm focus:border-secondary focus:outline-none disabled:opacity-40"
        >
          <option value="">— pick —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === p2}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          2nd place
        </span>
        <select
          value={p2 ?? ""}
          disabled={locked || pending}
          onChange={(e) => setP2(e.target.value ? Number(e.target.value) : undefined)}
          className="mt-1 block w-full rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2 text-sm focus:border-secondary focus:outline-none disabled:opacity-40"
        >
          <option value="">— pick —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === p1}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {!locked && (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs">
          {status === "saved" && (
            <span className="mono uppercase text-primary">Saved</span>
          )}
          {status === "error" && (
            <span className="mono uppercase text-error">Error</span>
          )}
          <button
            disabled={pending || !p1 || !p2}
            onClick={save}
            className="rounded-full bg-secondary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-on-secondary hover:brightness-110 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
