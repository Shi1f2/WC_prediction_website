"use client";

import { useState, useTransition } from "react";

type Team = { id: number; name: string };
const STAGES = ["r32", "r16", "qf", "sf", "third", "final"] as const;

export default function AdminAddMatch({ teams }: { teams: Team[] }) {
  const [stage, setStage] = useState<(typeof STAGES)[number]>("r32");
  const [teamA, setTeamA] = useState<number | "">("");
  const [teamB, setTeamB] = useState<number | "">("");
  const [labelA, setLabelA] = useState("");
  const [labelB, setLabelB] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [venue, setVenue] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  function save() {
    setStatus("idle");
    start(async () => {
      try {
        const res = await fetch("/api/admin/add-match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            stage,
            team_a_id: teamA || null,
            team_b_id: teamB || null,
            team_a_label: labelA || null,
            team_b_label: labelB || null,
            kickoff_at: kickoff ? new Date(kickoff).toISOString() : null,
            venue: venue || null,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        setStatus("saved");
        setKickoff("");
        setLabelA("");
        setLabelB("");
        setTeamA("");
        setTeamB("");
      } catch {
        setStatus("error");
      }
    });
  }

  const inputCls =
    "rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2 text-sm focus:border-secondary focus:outline-none";

  return (
    <div className="glass-card grid gap-3 rounded-2xl border border-outline-variant/30 p-5 text-sm sm:grid-cols-2">
      <FieldLabel label="Stage">
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as (typeof STAGES)[number])}
          className={inputCls}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s.toUpperCase()}
            </option>
          ))}
        </select>
      </FieldLabel>
      <FieldLabel label="Kickoff">
        <input
          type="datetime-local"
          value={kickoff}
          onChange={(e) => setKickoff(e.target.value)}
          className={inputCls}
        />
      </FieldLabel>
      <FieldLabel label="Team A">
        <div className="flex flex-col gap-1.5">
          <select
            value={teamA}
            onChange={(e) =>
              setTeamA(e.target.value ? Number(e.target.value) : "")
            }
            className={inputCls}
          >
            <option value="">— TBD —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Or label (e.g. Winner R16-1)"
            value={labelA}
            onChange={(e) => setLabelA(e.target.value)}
            className={inputCls}
          />
        </div>
      </FieldLabel>
      <FieldLabel label="Team B">
        <div className="flex flex-col gap-1.5">
          <select
            value={teamB}
            onChange={(e) =>
              setTeamB(e.target.value ? Number(e.target.value) : "")
            }
            className={inputCls}
          >
            <option value="">— TBD —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Or label"
            value={labelB}
            onChange={(e) => setLabelB(e.target.value)}
            className={inputCls}
          />
        </div>
      </FieldLabel>
      <FieldLabel label="Venue" className="sm:col-span-2">
        <input
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className={inputCls}
        />
      </FieldLabel>
      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        {status === "saved" && (
          <span className="mono text-xs uppercase text-primary">Added</span>
        )}
        {status === "error" && (
          <span className="mono text-xs uppercase text-error">Error</span>
        )}
        <button
          onClick={save}
          disabled={pending || !kickoff}
          className="rounded-full bg-secondary px-5 py-2 text-xs font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110 disabled:opacity-40"
        >
          Add match
        </button>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}
