"use client";

import { useMemo } from "react";
import Canvas from "@/components/Canvas";
import Bracket2026 from "@/components/Bracket2026";
import { reconstructBracketFromSets } from "@/lib/bracketReconstruct";

type TeamLite = {
  id: number;
  name: string;
  flag: string;
  group_letter: string | null;
};

export default function MemberBracketView({
  teams,
  groupPicksRows,
  bracketPicksRows,
}: {
  teams: TeamLite[];
  groupPicksRows: { group_letter: string; position: number; team_id: number }[];
  bracketPicksRows: { stage: string; team_id: number }[];
}) {
  const teamsByGroup = useMemo(() => {
    const m: Record<string, TeamLite[]> = {};
    for (const t of teams) {
      if (!t.group_letter) continue;
      (m[t.group_letter] ??= []).push(t);
    }
    return m;
  }, [teams]);

  const groupPicks = useMemo(() => {
    const m: Record<string, (number | null)[]> = {};
    for (const r of groupPicksRows) {
      const arr = (m[r.group_letter] ??= [null, null, null, null]);
      arr[r.position - 1] = r.team_id;
    }
    return m;
  }, [groupPicksRows]);

  const bracketSets = useMemo(() => {
    const sets: Record<string, number[]> = {
      R16: [],
      QF: [],
      SF: [],
      FINAL: [],
      WINNER: [],
    };
    for (const p of bracketPicksRows) {
      if (sets[p.stage]) sets[p.stage].push(p.team_id);
    }
    return sets;
  }, [bracketPicksRows]);

  const state = useMemo(
    () => reconstructBracketFromSets(groupPicks, bracketSets),
    [groupPicks, bracketSets]
  );

  return (
    <Canvas>
      <div className="p-10" style={{ width: 3200 }}>
        <Bracket2026
          teamsByGroup={teamsByGroup}
          groupPicks={groupPicks}
          state={state}
          onPickWinner={() => {}}
          onPickThirdPlace={() => {}}
          onSave={() => {}}
          onReset={() => {}}
          saveStatus="idle"
          pending={false}
          locked
        />
      </div>
    </Canvas>
  );
}
