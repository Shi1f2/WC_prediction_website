"use client";

import { useState, useTransition } from "react";

type M = {
  id: number;
  stage: string;
  group_letter: string | null;
  team_a_name: string | null;
  team_a_label: string | null;
  team_b_name: string | null;
  team_b_label: string | null;
  kickoff_at: string;
  actual_score_a: number | null;
  actual_score_b: number | null;
};

export default function AdminMatches({ matches }: { matches: M[] }) {
  const [search, setSearch] = useState("");
  const filtered = matches.filter((m) => {
    const a = m.team_a_name ?? m.team_a_label ?? "";
    const b = m.team_b_name ?? m.team_b_label ?? "";
    return (a + " " + b + " " + m.stage)
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  return (
    <div className="space-y-2">
      <input
        placeholder="Filter teams or stage…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2 text-sm focus:border-secondary focus:outline-none"
        suppressHydrationWarning
      />
      <div className="space-y-1.5">
        {filtered.map((m) => (
          <Row key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}

function Row({ m }: { m: M }) {
  const [a, setA] = useState(m.actual_score_a == null ? "" : String(m.actual_score_a));
  const [b, setB] = useState(m.actual_score_b == null ? "" : String(m.actual_score_b));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const ta = m.team_a_name ?? m.team_a_label ?? "TBD";
  const tb = m.team_b_name ?? m.team_b_label ?? "TBD";
  function save() {
    setStatus("idle");
    start(async () => {
      try {
        const res = await fetch("/api/admin/match-result", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            match_id: m.id,
            score_a: a === "" ? null : Number(a),
            score_b: b === "" ? null : Number(b),
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
    <div className="glass-card grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-outline-variant/30 px-4 py-2.5 text-sm">
      <div className="truncate">
        <span className="mono mr-2 rounded bg-surface-high px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
          {m.stage}
          {m.group_letter ? ` ${m.group_letter}` : ""}
        </span>
        <span className="font-bold uppercase">{ta}</span>{" "}
        <span className="text-on-surface-variant">vs</span>{" "}
        <span className="font-bold uppercase">{tb}</span>
        <span className="ml-2 text-xs text-on-surface-variant">
          {new Date(m.kickoff_at).toLocaleString("en-GB")}
        </span>
      </div>
      <div className="mono flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={20}
          value={a}
          onChange={(e) => setA(e.target.value)}
          className="h-9 w-12 rounded border border-outline-variant/40 bg-surface-low text-center font-bold focus:border-secondary focus:outline-none"
          suppressHydrationWarning
        />
        <span className="text-secondary">–</span>
        <input
          type="number"
          min={0}
          max={20}
          value={b}
          onChange={(e) => setB(e.target.value)}
          className="h-9 w-12 rounded border border-outline-variant/40 bg-surface-low text-center font-bold focus:border-secondary focus:outline-none"
          suppressHydrationWarning
        />
      </div>
      <div className="flex items-center gap-2">
        {status === "saved" && <span className="text-xs text-primary">✓</span>}
        {status === "error" && <span className="text-xs text-error">!</span>}
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-secondary hover:brightness-110 disabled:opacity-40"
          suppressHydrationWarning
        >
          Save
        </button>
      </div>
    </div>
  );
}
