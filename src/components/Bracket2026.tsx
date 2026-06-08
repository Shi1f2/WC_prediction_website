"use client";

import { useMemo } from "react";
import Flag from "./Flag";
import {
  R32_PAIRINGS,
  R16_TREE,
  QF_TREE,
  SF_TREE,
  FINAL_TREE,
  parseSlot,
  slotLabel,
  type SlotRef,
} from "@/lib/bracketStructure";

export type Team = {
  id: number;
  name: string;
  flag: string;
  group_letter: string | null;
};
type GroupPicks = Record<string, (number | null)[]>;

export type Bracket2026State = {
  R32: (number | null)[]; // 16 winners (= R16 entrants)
  R16: (number | null)[]; // 8 winners (= QF entrants)
  QF: (number | null)[]; // 4 winners (= SF entrants)
  SF: (number | null)[]; // 2 winners (= F entrants)
  F: (number | null)[]; // 1 winner (= Champion)
  thirdPlace: Record<number, number | null>; // r32MatchIdx → team_id
};

export function emptyBracket2026(): Bracket2026State {
  return {
    R32: Array(16).fill(null),
    R16: Array(8).fill(null),
    QF: Array(4).fill(null),
    SF: Array(2).fill(null),
    F: Array(1).fill(null),
    thirdPlace: {},
  };
}

type Round = "R32" | "R16" | "QF" | "SF" | "F";

const R32_CARD_H = 78;
const R32_GAP = 14;

// Pair each R32 match to its bracket side. Left half = R32 matches whose path
// reaches the "left finalist"; right half mirrors.
// Standard convention: matches 0..7 → left, 8..15 → right.
const LEFT_R32 = [0, 1, 2, 3, 4, 5, 6, 7];
const RIGHT_R32 = [8, 9, 10, 11, 12, 13, 14, 15];

function pickIndex(roundTree: [number, number][], childMatchIdx: number): number {
  for (let i = 0; i < roundTree.length; i++) {
    if (roundTree[i].includes(childMatchIdx)) return i;
  }
  return -1;
}

export default function Bracket2026({
  teamsByGroup,
  groupPicks,
  state,
  onPickWinner,
  onPickThirdPlace,
  locked,
  onSave,
  onReset,
  saveStatus,
  pending,
}: {
  teamsByGroup: Record<string, Team[]>;
  groupPicks: GroupPicks;
  state: Bracket2026State;
  onPickWinner: (round: Round, matchIdx: number, teamId: number | null) => void;
  onPickThirdPlace: (r32MatchIdx: number, teamId: number | null) => void;
  locked: boolean;
  onSave: () => void;
  onReset: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  pending: boolean;
}) {
  const teamById = useMemo(() => {
    const m = new Map<number, Team>();
    for (const list of Object.values(teamsByGroup)) {
      for (const t of list) m.set(t.id, t);
    }
    return m;
  }, [teamsByGroup]);

  function teamForSlot(slot: SlotRef, r32MatchIdx: number): Team | null {
    const p = parseSlot(slot);
    if (p.type === "winner") {
      const id = groupPicks[p.group]?.[0];
      return id ? teamById.get(id) ?? null : null;
    }
    if (p.type === "runnerup") {
      const id = groupPicks[p.group]?.[1];
      return id ? teamById.get(id) ?? null : null;
    }
    const tpId = state.thirdPlace[r32MatchIdx];
    return tpId ? teamById.get(tpId) ?? null : null;
  }

  function r16Inputs(matchIdx: number): [Team | null, Team | null] {
    const [a, b] = R16_TREE[matchIdx];
    return [
      state.R32[a] ? teamById.get(state.R32[a]!) ?? null : null,
      state.R32[b] ? teamById.get(state.R32[b]!) ?? null : null,
    ];
  }
  function qfInputs(matchIdx: number): [Team | null, Team | null] {
    const [a, b] = QF_TREE[matchIdx];
    return [
      state.R16[a] ? teamById.get(state.R16[a]!) ?? null : null,
      state.R16[b] ? teamById.get(state.R16[b]!) ?? null : null,
    ];
  }
  function sfInputs(matchIdx: number): [Team | null, Team | null] {
    const [a, b] = SF_TREE[matchIdx];
    return [
      state.QF[a] ? teamById.get(state.QF[a]!) ?? null : null,
      state.QF[b] ? teamById.get(state.QF[b]!) ?? null : null,
    ];
  }
  function fInputs(): [Team | null, Team | null] {
    const [a, b] = FINAL_TREE[0];
    return [
      state.SF[a] ? teamById.get(state.SF[a]!) ?? null : null,
      state.SF[b] ? teamById.get(state.SF[b]!) ?? null : null,
    ];
  }

  // ----- Match card components -----
  function TeamButton({
    team,
    placeholder,
    selected,
    onClick,
    side,
  }: {
    team: Team | null;
    placeholder?: string;
    selected: boolean;
    onClick: () => void;
    side: "top" | "bottom";
  }) {
    return (
      <button
        data-no-pan
        disabled={locked || !team}
        onClick={onClick}
        className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-bold uppercase transition disabled:opacity-50 ${
          selected
            ? "bg-secondary text-on-secondary"
            : "bg-surface-container text-on-surface hover:bg-surface-high"
        } ${side === "top" ? "rounded-t-md" : "rounded-b-md"}`}
      >
        {team ? (
          <>
            <Flag code={team.flag} size="sm" />
            <span className="truncate">{team.name}</span>
          </>
        ) : (
          <span className="mono italic text-on-surface-variant">
            {placeholder ?? "TBD"}
          </span>
        )}
      </button>
    );
  }

  function ThirdPlacePicker({
    r32MatchIdx,
    groups,
  }: {
    r32MatchIdx: number;
    groups: string[];
  }) {
    const picked = state.thirdPlace[r32MatchIdx] ?? null;
    const candidates: Team[] = groups
      .flatMap((g) => {
        const id = groupPicks[g]?.[2];
        return id ? [teamById.get(id)].filter(Boolean) : [];
      })
      .filter((x): x is Team => !!x);

    if (candidates.length === 0) return null;
    return (
      <div
        data-no-pan
        className="flex flex-wrap gap-1 border-t border-outline-variant/30 bg-surface-low px-2 py-1.5"
      >
        {candidates.map((t) => {
          const on = picked === t.id;
          return (
            <button
              key={t.id}
              disabled={locked}
              onClick={() =>
                onPickThirdPlace(r32MatchIdx, on ? null : t.id)
              }
              className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition disabled:opacity-50 ${
                on
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-container text-on-surface hover:bg-surface-high"
              }`}
              title={`${t.name} — 3rd in Group ${t.group_letter ?? "?"}`}
            >
              <Flag code={t.flag} size="sm" />
              <span>3{t.group_letter ?? ""}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function R32Card({ matchIdx }: { matchIdx: number }) {
    const m = R32_PAIRINGS[matchIdx];
    const leftTeam = teamForSlot(m.left, matchIdx);
    const rightTeam = teamForSlot(m.right, matchIdx);
    const leftParsed = parseSlot(m.left);
    const rightParsed = parseSlot(m.right);
    const winnerId = state.R32[matchIdx];

    return (
      <div
        className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-low shadow-sm shadow-black/20"
        style={{ width: 200 }}
      >
        <div className="mono flex items-center justify-between bg-surface-container px-2 py-1 text-[9px] uppercase tracking-widest text-on-surface-variant">
          <span>R32 · {matchIdx + 1}</span>
          {winnerId && <span className="text-primary">●</span>}
        </div>
        <TeamButton
          team={leftTeam}
          placeholder={slotLabel(m.left)}
          selected={winnerId != null && winnerId === leftTeam?.id}
          onClick={() => leftTeam && onPickWinner("R32", matchIdx, leftTeam.id)}
          side="top"
        />
        <TeamButton
          team={rightTeam}
          placeholder={slotLabel(m.right)}
          selected={winnerId != null && winnerId === rightTeam?.id}
          onClick={() => rightTeam && onPickWinner("R32", matchIdx, rightTeam.id)}
          side="bottom"
        />
        {leftParsed.type === "thirdplace" && (
          <ThirdPlacePicker
            r32MatchIdx={matchIdx}
            groups={leftParsed.groups}
          />
        )}
        {rightParsed.type === "thirdplace" && (
          <ThirdPlacePicker
            r32MatchIdx={matchIdx}
            groups={rightParsed.groups}
          />
        )}
      </div>
    );
  }

  function GenericCard({
    label,
    round,
    matchIdx,
    inputs,
  }: {
    label: string;
    round: Round;
    matchIdx: number;
    inputs: [Team | null, Team | null];
  }) {
    const arr =
      round === "R16"
        ? state.R16
        : round === "QF"
          ? state.QF
          : round === "SF"
            ? state.SF
            : state.F;
    const winnerId = arr[matchIdx];
    const [a, b] = inputs;
    return (
      <div
        className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-low shadow-sm shadow-black/20"
        style={{ width: 200 }}
      >
        <div className="mono flex items-center justify-between bg-surface-container px-2 py-1 text-[9px] uppercase tracking-widest text-on-surface-variant">
          <span>{label}</span>
          {winnerId && <span className="text-primary">●</span>}
        </div>
        <TeamButton
          team={a}
          placeholder="TBD"
          selected={winnerId != null && winnerId === a?.id}
          onClick={() => a && onPickWinner(round, matchIdx, a.id)}
          side="top"
        />
        <TeamButton
          team={b}
          placeholder="TBD"
          selected={winnerId != null && winnerId === b?.id}
          onClick={() => b && onPickWinner(round, matchIdx, b.id)}
          side="bottom"
        />
      </div>
    );
  }

  // Compute column height so children evenly distribute. R32 has 8 cards per side.
  const COL_H = LEFT_R32.length * (R32_CARD_H + R32_GAP) + 40;

  function Column({
    children,
    label,
    pt = 0,
  }: {
    children: React.ReactNode;
    label: string;
    pt?: number;
  }) {
    return (
      <div className="flex flex-col items-center">
        <div className="mono mb-3 h-4 text-[10px] uppercase tracking-widest text-on-background-variant">
          {label}
        </div>
        <div
          className="flex flex-col items-center justify-around"
          style={{ height: COL_H, paddingTop: pt }}
        >
          {children}
        </div>
      </div>
    );
  }

  const anyPicked =
    state.R32.some(Boolean) ||
    state.R16.some(Boolean) ||
    state.QF.some(Boolean) ||
    state.SF.some(Boolean) ||
    state.F.some(Boolean);

  return (
    <div>
      <div className="flex items-start gap-3">
        <Column label="Round of 32">
          {LEFT_R32.map((i) => (
            <R32Card key={i} matchIdx={i} />
          ))}
        </Column>
        <Column label="Round of 16">
          {[0, 1, 2, 3].map((i) => (
            <GenericCard
              key={i}
              label={`R16 · ${i + 1}`}
              round="R16"
              matchIdx={i}
              inputs={r16Inputs(i)}
            />
          ))}
        </Column>
        <Column label="Quarterfinals">
          {[0, 1].map((i) => (
            <GenericCard
              key={i}
              label={`QF · ${i + 1}`}
              round="QF"
              matchIdx={i}
              inputs={qfInputs(i)}
            />
          ))}
        </Column>
        <Column label="Semifinals">
          <GenericCard
            label="SF · 1"
            round="SF"
            matchIdx={0}
            inputs={sfInputs(0)}
          />
        </Column>

        {/* Center: Final + Champion */}
        <div className="flex flex-col items-center">
          <div className="mono mb-3 h-4 text-[10px] uppercase tracking-widest text-secondary">
            The Final
          </div>
          <div
            className="flex flex-col items-center justify-center gap-6"
            style={{ height: COL_H }}
          >
            <GenericCard
              label="Final"
              round="F"
              matchIdx={0}
              inputs={fInputs()}
            />
            <div className="display-italic text-4xl text-secondary winner-glow">
              🏆
            </div>
            <div className="rounded-xl border border-secondary bg-surface-container px-4 py-3 shadow-glow">
              <div className="mono mb-1 text-[9px] uppercase tracking-widest text-secondary">
                Champion
              </div>
              {state.F[0] ? (
                <div className="flex items-center gap-2 text-sm font-bold uppercase text-on-surface">
                  {(() => {
                    const champ = teamById.get(state.F[0]!);
                    return champ ? (
                      <>
                        <Flag code={champ.flag} size="md" />
                        <span>{champ.name}</span>
                      </>
                    ) : null;
                  })()}
                </div>
              ) : (
                <span className="mono text-[11px] italic text-on-surface-variant">
                  Pick a final winner
                </span>
              )}
            </div>
          </div>
        </div>

        <Column label="Semifinals">
          <GenericCard
            label="SF · 2"
            round="SF"
            matchIdx={1}
            inputs={sfInputs(1)}
          />
        </Column>
        <Column label="Quarterfinals">
          {[2, 3].map((i) => (
            <GenericCard
              key={i}
              label={`QF · ${i + 1}`}
              round="QF"
              matchIdx={i}
              inputs={qfInputs(i)}
            />
          ))}
        </Column>
        <Column label="Round of 16">
          {[4, 5, 6, 7].map((i) => (
            <GenericCard
              key={i}
              label={`R16 · ${i + 1}`}
              round="R16"
              matchIdx={i}
              inputs={r16Inputs(i)}
            />
          ))}
        </Column>
        <Column label="Round of 32">
          {RIGHT_R32.map((i) => (
            <R32Card key={i} matchIdx={i} />
          ))}
        </Column>
      </div>

      <div
        data-no-pan
        className="mt-8 flex flex-wrap items-center justify-end gap-3"
      >
        {saveStatus === "saving" && (
          <span className="mono text-sm uppercase text-on-surface-variant">
            Saving…
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="mono text-sm uppercase text-primary">✓ Saved</span>
        )}
        {saveStatus === "error" && (
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
