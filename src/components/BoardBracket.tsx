"use client";

import { useMemo } from "react";

type Team = { id: number; name: string; flag: string };
const COUNTS = { R16: 16, QF: 8, SF: 4, FINAL: 2, WINNER: 1 } as const;
export type BracketStage = keyof typeof COUNTS;
export type BracketPicks = Record<BracketStage, (number | null)[]>;

const COL_H = 880;
const JOINER_W = 48;
const SLOT_H = 56;

export function emptyBracketPicks(): BracketPicks {
  return {
    R16: Array(16).fill(null),
    QF: Array(8).fill(null),
    SF: Array(4).fill(null),
    FINAL: Array(2).fill(null),
    WINNER: Array(1).fill(null),
  };
}

export function padBracketPicks(initial: Record<string, number[]>): BracketPicks {
  const out = emptyBracketPicks();
  for (const stage of Object.keys(COUNTS) as BracketStage[]) {
    const arr = initial[stage] ?? [];
    for (let i = 0; i < Math.min(arr.length, COUNTS[stage]); i++) {
      out[stage][i] = arr[i];
    }
  }
  return out;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function BoardBracket({
  teams,
  picks,
  onChangeSlot,
  onSave,
  onReset,
  status,
  pending,
  locked,
}: {
  teams: Team[];
  picks: BracketPicks;
  onChangeSlot: (stage: BracketStage, idx: number, value: number | null) => void;
  onSave: () => void;
  onReset: () => void;
  status: SaveStatus;
  pending: boolean;
  locked: boolean;
}) {
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  function Slot({
    stage,
    idx,
    big,
  }: {
    stage: BracketStage;
    idx: number;
    big?: boolean;
  }) {
    const teamId = picks[stage][idx];
    const team = teamId != null ? teamById.get(teamId) : null;
    const used = new Set(
      picks[stage]
        .map((x, i) => (i === idx ? null : x))
        .filter((x): x is number => x != null)
    );
    return (
      <div
        data-no-pan
        className={`rounded-xl border bg-surface-container shadow-md shadow-black/30 ${
          big
            ? "w-56 border-secondary px-4 py-3 shadow-glow"
            : "w-48 border-outline-variant/40 px-3 py-2"
        }`}
        style={{ minHeight: SLOT_H }}
      >
        <div className="mono mb-1 flex items-center justify-between text-[9px] uppercase tracking-widest text-on-surface-variant">
          <span className={big ? "text-secondary" : ""}>
            {big ? "Champion" : `${stage} ${idx + 1}`}
          </span>
          {team && <span className="text-primary">●</span>}
        </div>
        <select
          disabled={locked}
          value={teamId ?? ""}
          onChange={(e) =>
            onChangeSlot(
              stage,
              idx,
              e.target.value ? Number(e.target.value) : null
            )
          }
          className={`w-full rounded border border-outline-variant/40 bg-surface-low px-2 py-1.5 text-sm text-on-surface focus:border-secondary focus:outline-none disabled:opacity-50 ${
            big ? "text-base font-bold" : ""
          }`}
        >
          <option value="">— pick —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={used.has(t.id)}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function Column({
    label,
    stage,
    indices,
  }: {
    label?: string;
    stage: BracketStage;
    indices: number[];
  }) {
    return (
      <div className="flex flex-col items-center">
        <div className="mono mb-3 h-4 text-[10px] uppercase tracking-widest text-on-background-variant">
          {label ?? ""}
        </div>
        <div
          className="flex flex-col items-center justify-around"
          style={{ height: COL_H }}
        >
          {indices.map((idx) => (
            <Slot key={`${stage}-${idx}`} stage={stage} idx={idx} />
          ))}
        </div>
      </div>
    );
  }

  function ChampionColumn() {
    return (
      <div className="flex flex-col items-center">
        <div className="mono mb-3 h-4 text-[10px] uppercase tracking-widest text-secondary">
          The Champion
        </div>
        <div
          className="flex flex-col items-center justify-center"
          style={{ height: COL_H }}
        >
          <div className="display-italic mb-3 text-2xl uppercase text-secondary winner-glow">
            🏆
          </div>
          <Slot stage="WINNER" idx={0} big />
        </div>
      </div>
    );
  }

  function Joiner({ pairs, flip = false }: { pairs: number; flip?: boolean }) {
    const inSlots = pairs * 2;
    const xLeft = flip ? JOINER_W : 0;
    const xMid = JOINER_W / 2;
    const xRight = flip ? 0 : JOINER_W;
    const stroke = "#a8a092";
    return (
      <div className="flex flex-col items-center">
        <div className="mb-3 h-4" />
        <svg
          width={JOINER_W}
          height={COL_H}
          style={{ overflow: "visible" }}
          className="pointer-events-none"
        >
          {Array.from({ length: pairs }, (_, p) => {
            const inA = p * 2;
            const inB = p * 2 + 1;
            const ya = (COL_H / inSlots) * (inA + 0.5);
            const yb = (COL_H / inSlots) * (inB + 0.5);
            const yOut = (COL_H / pairs) * (p + 0.5);
            return (
              <g key={p} stroke={stroke} strokeWidth={2} strokeLinecap="round">
                <line x1={xLeft} y1={ya} x2={xMid} y2={ya} />
                <line x1={xLeft} y1={yb} x2={xMid} y2={yb} />
                <line x1={xMid} y1={ya} x2={xMid} y2={yb} />
                <line x1={xMid} y1={yOut} x2={xRight} y2={yOut} />
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  function SingleLine({ flip = false }: { flip?: boolean }) {
    const xLeft = flip ? JOINER_W : 0;
    const xRight = flip ? 0 : JOINER_W;
    return (
      <div className="flex flex-col items-center">
        <div className="mb-3 h-4" />
        <svg
          width={JOINER_W}
          height={COL_H}
          style={{ overflow: "visible" }}
          className="pointer-events-none"
        >
          <line
            x1={xLeft}
            y1={COL_H / 2}
            x2={xRight}
            y2={COL_H / 2}
            stroke="#a8a092"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  const anyPicked = (Object.values(picks) as (number | null)[][]).some((arr) =>
    arr.some((x) => x != null)
  );

  return (
    <div>
      <div className="flex items-start">
        <Column label="Round of 16" stage="R16" indices={[0, 1, 2, 3, 4, 5, 6, 7]} />
        <Joiner pairs={4} />
        <Column label="Quarterfinals" stage="QF" indices={[0, 1, 2, 3]} />
        <Joiner pairs={2} />
        <Column label="Semifinals" stage="SF" indices={[0, 1]} />
        <Joiner pairs={1} />
        <Column label="Final" stage="FINAL" indices={[0]} />
        <SingleLine />
        <ChampionColumn />
        <SingleLine flip />
        <Column stage="FINAL" indices={[1]} label="Final" />
        <Joiner pairs={1} flip />
        <Column stage="SF" indices={[2, 3]} label="Semifinals" />
        <Joiner pairs={2} flip />
        <Column stage="QF" indices={[4, 5, 6, 7]} label="Quarterfinals" />
        <Joiner pairs={4} flip />
        <Column stage="R16" indices={[8, 9, 10, 11, 12, 13, 14, 15]} label="Round of 16" />
      </div>

      <div
        data-no-pan
        className="mt-8 flex flex-wrap items-center justify-end gap-3"
      >
        {status === "saving" && (
          <span className="mono text-sm uppercase text-on-surface-variant">
            Saving…
          </span>
        )}
        {status === "saved" && (
          <span className="mono text-sm uppercase text-primary">✓ Saved</span>
        )}
        {status === "error" && (
          <span className="mono text-sm uppercase text-error">! Error</span>
        )}
        {!locked && anyPicked && (
          <button
            onClick={onReset}
            disabled={pending}
            className="rounded-full border border-outline-variant/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface hover:border-error hover:text-error disabled:opacity-40"
          >
            Reset bracket
          </button>
        )}
        {!locked && (
          <button
            onClick={onSave}
            disabled={pending}
            className="rounded-full bg-secondary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save bracket"}
          </button>
        )}
        {locked && (
          <span className="text-sm text-on-background-variant">
            Bracket locked
          </span>
        )}
      </div>
    </div>
  );
}
