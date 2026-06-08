// 2026 FIFA World Cup Round of 32 pairings (Annex C of competition regulations).
// Group winners (1X) and runners-up (2X) are fixed by letter.
// Third-place slots are a pool ("3CDFGH" = one of those groups' 3rd-place team,
// determined by FIFA's 495-scenario lookup table — we let the user pick).

export type SlotRef = string; // "1A" | "2A" | "3<group-letters>"

export type R32Match = { idx: number; left: SlotRef; right: SlotRef };

export const R32_PAIRINGS: R32Match[] = [
  { idx: 0, left: "2A", right: "2B" },
  { idx: 1, left: "1C", right: "2F" },
  { idx: 2, left: "1E", right: "3CDFGH" },
  { idx: 3, left: "1F", right: "2C" },
  { idx: 4, left: "2E", right: "2I" },
  { idx: 5, left: "1I", right: "3CDFGH" },
  { idx: 6, left: "1A", right: "3CEFHI" },
  { idx: 7, left: "1L", right: "3EHIJK" },
  { idx: 8, left: "1G", right: "3AEHIJ" },
  { idx: 9, left: "1D", right: "3BEFIJ" },
  { idx: 10, left: "1H", right: "2J" },
  { idx: 11, left: "2K", right: "2L" },
  { idx: 12, left: "1B", right: "3EFGIJ" },
  { idx: 13, left: "2D", right: "2G" },
  { idx: 14, left: "1J", right: "2H" },
  { idx: 15, left: "1K", right: "3DEIJL" },
];

// Standard knockout tree: match N and N+1 pair into next round.
export const R16_TREE: [number, number][] = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [8, 9], [10, 11], [12, 13], [14, 15],
];
export const QF_TREE: [number, number][] = [
  [0, 1], [2, 3], [4, 5], [6, 7],
];
export const SF_TREE: [number, number][] = [
  [0, 1], [2, 3],
];
export const FINAL_TREE: [number, number][] = [[0, 1]];

export type ParsedSlot =
  | { type: "winner"; group: string }
  | { type: "runnerup"; group: string }
  | { type: "thirdplace"; groups: string[] };

export function parseSlot(slot: SlotRef): ParsedSlot {
  const head = slot[0];
  const rest = slot.slice(1);
  if (head === "1") return { type: "winner", group: rest };
  if (head === "2") return { type: "runnerup", group: rest };
  return { type: "thirdplace", groups: rest.split("") };
}

export function slotLabel(slot: SlotRef): string {
  const p = parseSlot(slot);
  if (p.type === "winner") return `1${p.group}`;
  if (p.type === "runnerup") return `2${p.group}`;
  return `Best 3rd · ${p.groups.join("/")}`;
}
