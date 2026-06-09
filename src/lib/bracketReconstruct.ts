import { emptyBracket2026, type Bracket2026State } from "@/components/Bracket2026";
import {
  R32_PAIRINGS,
  R16_TREE,
  QF_TREE,
  SF_TREE,
  parseSlot,
} from "@/lib/bracketStructure";

export type GroupPicks = Record<string, (number | null)[]>;

// Rebuild the positional bracket state from the set-based DB rows so a
// committed bracket always renders, even with empty local storage. We figure
// out each round's winners by checking which of a match's two possible inputs
// appears in the NEXT round's set.
export function reconstructBracketFromSets(
  groupPicks: GroupPicks,
  sets: Record<string, number[]>
): Bracket2026State {
  const state = emptyBracket2026();
  const r16Set = new Set(sets.R16 ?? []);
  const qfSet = new Set(sets.QF ?? []);
  const sfSet = new Set(sets.SF ?? []);
  const finalSet = new Set(sets.FINAL ?? []);

  function teamsForSlot(slot: string): number[] {
    const p = parseSlot(slot);
    if (p.type === "winner") {
      const id = groupPicks[p.group]?.[0];
      return id ? [id] : [];
    }
    if (p.type === "runnerup") {
      const id = groupPicks[p.group]?.[1];
      return id ? [id] : [];
    }
    return p.groups
      .map((g) => groupPicks[g]?.[2])
      .filter((x): x is number => x != null);
  }

  for (const m of R32_PAIRINGS) {
    const leftIds = teamsForSlot(m.left);
    const rightIds = teamsForSlot(m.right);
    const leftWinner = leftIds.find((id) => r16Set.has(id));
    const rightWinner = rightIds.find((id) => r16Set.has(id));
    if (leftWinner != null) {
      state.R32[m.idx] = leftWinner;
      if (parseSlot(m.left).type === "thirdplace")
        state.thirdPlace[m.idx] = leftWinner;
    } else if (rightWinner != null) {
      state.R32[m.idx] = rightWinner;
      if (parseSlot(m.right).type === "thirdplace")
        state.thirdPlace[m.idx] = rightWinner;
    }
  }

  for (let i = 0; i < R16_TREE.length; i++) {
    const [a, b] = R16_TREE[i];
    const ta = state.R32[a];
    const tb = state.R32[b];
    if (ta != null && qfSet.has(ta)) state.R16[i] = ta;
    else if (tb != null && qfSet.has(tb)) state.R16[i] = tb;
  }
  for (let i = 0; i < QF_TREE.length; i++) {
    const [a, b] = QF_TREE[i];
    const ta = state.R16[a];
    const tb = state.R16[b];
    if (ta != null && sfSet.has(ta)) state.QF[i] = ta;
    else if (tb != null && sfSet.has(tb)) state.QF[i] = tb;
  }
  for (let i = 0; i < SF_TREE.length; i++) {
    const [a, b] = SF_TREE[i];
    const ta = state.QF[a];
    const tb = state.QF[b];
    if (ta != null && finalSet.has(ta)) state.SF[i] = ta;
    else if (tb != null && finalSet.has(tb)) state.SF[i] = tb;
  }
  state.F[0] = sets.WINNER?.[0] ?? null;
  return state;
}
