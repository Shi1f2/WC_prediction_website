// 2026 FIFA World Cup Round of 32 pairings (FIFA fixture list, matches 73–88).
// Source: Wikipedia "2026 FIFA World Cup knockout stage", which mirrors the
// official FIFA fixture list. Group winners (1X) and runners-up (2X) are
// fixed by letter. Third-place slots are a pool ("3-CDFGH" = the 3rd-place
// team from one of those groups, determined by FIFA's 495-scenario table —
// we let the user pick from their group 3rd-place picks).

export type SlotRef = string; // "1A" | "2A" | "3<group-letters>"

export type R32Match = {
  idx: number;
  fifa: number; // FIFA fixture number (73–88)
  left: SlotRef;
  right: SlotRef;
};

// Indices are bracket positions top-to-bottom (LEFT then RIGHT side).
// Left side, top to bottom: 0..7. Right side, top to bottom: 8..15.
// Adjacent pairs (0+1, 2+3, ...) feed one R16 match.
export const R32_PAIRINGS: R32Match[] = [
  // ---- LEFT side ----
  { idx: 0,  fifa: 74, left: "1E", right: "3ABCDF" },
  { idx: 1,  fifa: 77, left: "1I", right: "3CDFGH" },
  { idx: 2,  fifa: 73, left: "2A", right: "2B" },
  { idx: 3,  fifa: 75, left: "1F", right: "2C" },
  { idx: 4,  fifa: 83, left: "2K", right: "2L" },
  { idx: 5,  fifa: 84, left: "1H", right: "2J" },
  { idx: 6,  fifa: 81, left: "1D", right: "3BEFIJ" },
  { idx: 7,  fifa: 82, left: "1G", right: "3AEHIJ" },
  // ---- RIGHT side ----
  { idx: 8,  fifa: 76, left: "1C", right: "2F" },
  { idx: 9,  fifa: 78, left: "2E", right: "2I" },
  { idx: 10, fifa: 79, left: "1A", right: "3CEFHI" },
  { idx: 11, fifa: 80, left: "1L", right: "3EHIJK" },
  { idx: 12, fifa: 86, left: "1J", right: "2H" },
  { idx: 13, fifa: 88, left: "2D", right: "2G" },
  { idx: 14, fifa: 85, left: "1B", right: "3EFGIJ" },
  { idx: 15, fifa: 87, left: "1K", right: "3DEIJL" },
];

// Standard knockout tree: pairs of adjacent matches feed the next round.
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
