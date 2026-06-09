import type { PicksBundle, TeamRow, MatchInfo } from "@/lib/picks";

// `flag` here is the ISO country code consumed by <Flag code=... /> (matches
// what the real DB stores), NOT an emoji.
const T: TeamRow[] = [
  // Group A
  { id: 200, name: "Argentina", code: "ARG", flag: "ar", group_letter: "A" },
  { id: 205, name: "Mexico", code: "MEX", flag: "mx", group_letter: "A" },
  { id: 206, name: "USA", code: "USA", flag: "us", group_letter: "A" },
  { id: 207, name: "Canada", code: "CAN", flag: "ca", group_letter: "A" },
  // Group B
  { id: 201, name: "Brazil", code: "BRA", flag: "br", group_letter: "B" },
  { id: 203, name: "Germany", code: "GER", flag: "de", group_letter: "B" },
  { id: 209, name: "Italy", code: "ITA", flag: "it", group_letter: "B" },
  { id: 210, name: "Portugal", code: "POR", flag: "pt", group_letter: "B" },
  // Group C
  { id: 202, name: "France", code: "FRA", flag: "fr", group_letter: "C" },
  { id: 204, name: "Spain", code: "ESP", flag: "es", group_letter: "C" },
  { id: 208, name: "Belgium", code: "BEL", flag: "be", group_letter: "C" },
  { id: 211, name: "Netherlands", code: "NED", flag: "nl", group_letter: "C" },
  // Group D
  { id: 213, name: "England", code: "ENG", flag: "gb-eng", group_letter: "D" },
  { id: 212, name: "Croatia", code: "CRO", flag: "hr", group_letter: "D" },
  { id: 236, name: "Switzerland", code: "SUI", flag: "ch", group_letter: "D" },
  { id: 241, name: "Wales", code: "WAL", flag: "gb-wls", group_letter: "D" },
  // Group E
  { id: 215, name: "Morocco", code: "MAR", flag: "ma", group_letter: "E" },
  { id: 214, name: "Japan", code: "JPN", flag: "jp", group_letter: "E" },
  { id: 231, name: "Korea Republic", code: "KOR", flag: "kr", group_letter: "E" },
  { id: 230, name: "Australia", code: "AUS", flag: "au", group_letter: "E" },
  // Group F
  { id: 216, name: "Uruguay", code: "URU", flag: "uy", group_letter: "F" },
  { id: 218, name: "Chile", code: "CHI", flag: "cl", group_letter: "F" },
  { id: 235, name: "Denmark", code: "DEN", flag: "dk", group_letter: "F" },
  { id: 237, name: "Sweden", code: "SWE", flag: "se", group_letter: "F" },
  // Group G
  { id: 222, name: "Senegal", code: "SEN", flag: "sn", group_letter: "G" },
  { id: 240, name: "Poland", code: "POL", flag: "pl", group_letter: "G" },
  { id: 238, name: "Norway", code: "NOR", flag: "no", group_letter: "G" },
  { id: 239, name: "Austria", code: "AUT", flag: "at", group_letter: "G" },
  // Group H
  { id: 228, name: "Nigeria", code: "NGA", flag: "ng", group_letter: "H" },
  { id: 225, name: "Algeria", code: "ALG", flag: "dz", group_letter: "H" },
  { id: 224, name: "Egypt", code: "EGY", flag: "eg", group_letter: "H" },
  { id: 223, name: "Tunisia", code: "TUN", flag: "tn", group_letter: "H" },
  // Group I
  { id: 226, name: "Cameroon", code: "CMR", flag: "cm", group_letter: "I" },
  { id: 227, name: "Ghana", code: "GHA", flag: "gh", group_letter: "I" },
  { id: 245, name: "Türkiye", code: "TUR", flag: "tr", group_letter: "I" },
  { id: 246, name: "Greece", code: "GRE", flag: "gr", group_letter: "I" },
  // Group J
  { id: 219, name: "Ecuador", code: "ECU", flag: "ec", group_letter: "J" },
  { id: 220, name: "Peru", code: "PER", flag: "pe", group_letter: "J" },
  { id: 221, name: "Paraguay", code: "PAR", flag: "py", group_letter: "J" },
  { id: 217, name: "Colombia", code: "COL", flag: "co", group_letter: "J" },
  // Group K
  { id: 229, name: "Côte d'Ivoire", code: "CIV", flag: "ci", group_letter: "K" },
  { id: 232, name: "Iran", code: "IRN", flag: "ir", group_letter: "K" },
  { id: 233, name: "Saudi Arabia", code: "KSA", flag: "sa", group_letter: "K" },
  { id: 234, name: "Qatar", code: "QAT", flag: "qa", group_letter: "K" },
  // Group L
  { id: 243, name: "Serbia", code: "SRB", flag: "rs", group_letter: "L" },
  { id: 244, name: "Czechia", code: "CZE", flag: "cz", group_letter: "L" },
  { id: 242, name: "Scotland", code: "SCO", flag: "gb-sct", group_letter: "L" },
  { id: 247, name: "Ukraine", code: "UKR", flag: "ua", group_letter: "L" },
];
const TEAMS = new Map<number, TeamRow>(T.map((t) => [t.id, t]));

// Demo matches are back-dated to "yesterday" relative to today's mocked clock
// so the picks page's kickoff filter doesn't hide them.
const past = new Date(Date.now() - 24 * 3600 * 1000);

const MATCHES: MatchInfo[] = [
  {
    id: 9001,
    stage: "group",
    group_letter: "A",
    kickoff_at: past,
    team_a_label: "Mexico",
    team_b_label: "Argentina",
    team_a_name: "Mexico",
    team_a_flag: "mx",
    team_b_name: "Argentina",
    team_b_flag: "ar",
    status: "FINISHED",
    actual_score_a: 2,
    actual_score_b: 1,
  },
  {
    id: 9002,
    stage: "group",
    group_letter: "A",
    kickoff_at: past,
    team_a_label: "USA",
    team_b_label: "Canada",
    team_a_name: "USA",
    team_a_flag: "us",
    team_b_name: "Canada",
    team_b_flag: "ca",
    status: "FINISHED",
    actual_score_a: 1,
    actual_score_b: 1,
  },
  {
    id: 9003,
    stage: "group",
    group_letter: "B",
    kickoff_at: past,
    team_a_label: "Brazil",
    team_b_label: "Germany",
    team_a_name: "Brazil",
    team_a_flag: "br",
    team_b_name: "Germany",
    team_b_flag: "de",
    status: "FINISHED",
    actual_score_a: 3,
    actual_score_b: 0,
  },
  {
    id: 9004,
    stage: "group",
    group_letter: "C",
    kickoff_at: past,
    team_a_label: "France",
    team_b_label: "Spain",
    team_a_name: "France",
    team_a_flag: "fr",
    team_b_name: "Spain",
    team_b_flag: "es",
    status: "FINISHED",
    actual_score_a: 1,
    actual_score_b: 2,
  },
];

const BRACKET_LOCKED_AT = past;

// ─── Actual results used to grade every pick ─────────────────────────────────
// Groups A-F have already been played out in this demo; G-L are still ungraded
// so all their predictions read as +0.
const GROUP_RESULTS = new Map<string, Map<number, number>>([
  ["A", new Map([[1, 205], [2, 200], [3, 206], [4, 207]])],
  ["B", new Map([[1, 201], [2, 203], [3, 209], [4, 210]])],
  ["C", new Map([[1, 204], [2, 202], [3, 208], [4, 211]])],
  ["D", new Map([[1, 213], [2, 212], [3, 236], [4, 241]])],
  ["E", new Map([[1, 214], [2, 215], [3, 231], [4, 230]])],
  ["F", new Map([[1, 216], [2, 218], [3, 235], [4, 237]])],
]);

const BRACKET_RESULTS = new Set<string>([
  // R16 (8 picks): 6 of Eren's 8 picks land here, Arda gets the same 4 of 4.
  "R16|200", "R16|201", "R16|202", "R16|203",
  "R16|204", "R16|205",
  // QF (4 picks): Eren has 4, only Argentina + France correct.
  "QF|200", "QF|202",
  // SF: only Argentina correct.
  "SF|200",
  // FINAL: only Argentina correct.
  "FINAL|200",
  // Champion: Argentina.
  "WINNER|200",
]);

// ─── Arda (viewer-self) ──────────────────────────────────────────────────────
// Arda has committed their bracket and predicted Groups A-F + 3 matches.
// G-L are intentionally NOT completed so the picks viewer demonstrates the
// "predict positions 1 & 2 first" lock state on half the groups.
const ARDA_VIEWER_STATE = {
  bracketCommittedAt: past,
  groupsCompleted: new Set(["A", "B", "C", "D", "E", "F"]),
  matchesPredicted: new Set([9001, 9003, 9004]),
};

const ARDA_MEMBER = {
  id: 1,
  display_name: "Arda",
  username: "arda",
  discriminator: "7421",
  bracketCommittedAt: past,
  bracket: [
    // Full 16-team R16 — the teams Arda predicts will survive R32.
    { stage: "R16", team_id: 200 }, // Argentina
    { stage: "R16", team_id: 201 }, // Brazil
    { stage: "R16", team_id: 202 }, // France
    { stage: "R16", team_id: 203 }, // Germany
    { stage: "R16", team_id: 204 }, // Spain
    { stage: "R16", team_id: 205 }, // Mexico
    { stage: "R16", team_id: 213 }, // England
    { stage: "R16", team_id: 210 }, // Portugal
    { stage: "R16", team_id: 208 }, // Belgium
    { stage: "R16", team_id: 211 }, // Netherlands
    { stage: "R16", team_id: 212 }, // Croatia
    { stage: "R16", team_id: 216 }, // Uruguay
    { stage: "R16", team_id: 214 }, // Japan
    { stage: "R16", team_id: 222 }, // Senegal
    { stage: "R16", team_id: 236 }, // Switzerland
    { stage: "R16", team_id: 209 }, // Italy
    // 8 QF picks
    { stage: "QF", team_id: 200 },
    { stage: "QF", team_id: 201 },
    { stage: "QF", team_id: 202 },
    { stage: "QF", team_id: 204 },
    { stage: "QF", team_id: 213 },
    { stage: "QF", team_id: 210 },
    { stage: "QF", team_id: 208 },
    { stage: "QF", team_id: 212 },
    // 4 SF picks
    { stage: "SF", team_id: 200 },
    { stage: "SF", team_id: 202 },
    { stage: "SF", team_id: 213 },
    { stage: "SF", team_id: 201 },
    // 2 finalists
    { stage: "FINAL", team_id: 200 },
    { stage: "FINAL", team_id: 202 },
    // Champion
    { stage: "WINNER", team_id: 200 },
  ],
  groups: [
    // Positions 1 + 2 across the six groups Arda completed.
    { group_letter: "A", position: 1, team_id: 205 },
    { group_letter: "A", position: 2, team_id: 200 },
    { group_letter: "B", position: 1, team_id: 201 },
    { group_letter: "B", position: 2, team_id: 203 },
    { group_letter: "C", position: 1, team_id: 202 },
    { group_letter: "C", position: 2, team_id: 204 },
    { group_letter: "D", position: 1, team_id: 213 },
    { group_letter: "D", position: 2, team_id: 212 },
    { group_letter: "E", position: 1, team_id: 214 },
    { group_letter: "E", position: 2, team_id: 215 },
    { group_letter: "F", position: 1, team_id: 216 },
    { group_letter: "F", position: 2, team_id: 218 },
  ],
  matches: [
    { match_id: 9001, score_a: 2, score_b: 1 },
    { match_id: 9003, score_a: 3, score_b: 0 },
    { match_id: 9004, score_a: 2, score_b: 0 },
  ],
  markets: new Map<number, Record<string, string>>([
    [9001, { ou_25: "over", btts: "yes", margin: "a_by_1" }],
    [9003, { ou_25: "over", btts: "no", margin: "a_by_3plus" }],
    [9004, { ou_25: "under", btts: "yes", margin: "b_by_1" }],
  ]),
};

// ─── Eren (winner — mostly unlocked vs. Arda) ────────────────────────────────
const EREN_MEMBER = {
  id: 2,
  display_name: "Eren",
  username: "eren",
  discriminator: "0042",
  bracketCommittedAt: past,
  bracket: [
    // Full 16-team R16 — Eren goes a bit chalkier than Arda, picks Morocco
    // and USA where Arda went with Switzerland and Italy.
    { stage: "R16", team_id: 200 }, // Argentina
    { stage: "R16", team_id: 201 }, // Brazil
    { stage: "R16", team_id: 202 }, // France
    { stage: "R16", team_id: 203 }, // Germany
    { stage: "R16", team_id: 204 }, // Spain
    { stage: "R16", team_id: 205 }, // Mexico
    { stage: "R16", team_id: 206 }, // USA
    { stage: "R16", team_id: 208 }, // Belgium
    { stage: "R16", team_id: 213 }, // England
    { stage: "R16", team_id: 210 }, // Portugal
    { stage: "R16", team_id: 211 }, // Netherlands
    { stage: "R16", team_id: 212 }, // Croatia
    { stage: "R16", team_id: 216 }, // Uruguay
    { stage: "R16", team_id: 214 }, // Japan
    { stage: "R16", team_id: 222 }, // Senegal
    { stage: "R16", team_id: 215 }, // Morocco
    // 8 QF picks
    { stage: "QF", team_id: 200 },
    { stage: "QF", team_id: 201 },
    { stage: "QF", team_id: 202 },
    { stage: "QF", team_id: 204 },
    { stage: "QF", team_id: 213 },
    { stage: "QF", team_id: 208 },
    { stage: "QF", team_id: 210 },
    { stage: "QF", team_id: 211 },
    // 4 SF picks
    { stage: "SF", team_id: 200 },
    { stage: "SF", team_id: 202 },
    { stage: "SF", team_id: 204 },
    { stage: "SF", team_id: 201 },
    // 2 finalists
    { stage: "FINAL", team_id: 200 },
    { stage: "FINAL", team_id: 202 },
    // Champion
    { stage: "WINNER", team_id: 200 },
  ],
  groups: [
    // Eren predicted ALL 12 groups, full 4 positions each.
    { group_letter: "A", position: 1, team_id: 205 }, // Mexico
    { group_letter: "A", position: 2, team_id: 200 }, // Argentina
    { group_letter: "A", position: 3, team_id: 206 },
    { group_letter: "A", position: 4, team_id: 207 },
    { group_letter: "B", position: 1, team_id: 201 }, // Brazil
    { group_letter: "B", position: 2, team_id: 203 }, // Germany
    { group_letter: "B", position: 3, team_id: 209 },
    { group_letter: "B", position: 4, team_id: 210 },
    { group_letter: "C", position: 1, team_id: 202 }, // France (wrong order)
    { group_letter: "C", position: 2, team_id: 204 }, // Spain
    { group_letter: "C", position: 3, team_id: 208 },
    { group_letter: "C", position: 4, team_id: 211 },
    { group_letter: "D", position: 1, team_id: 212 }, // Croatia (wrong order)
    { group_letter: "D", position: 2, team_id: 213 }, // England
    { group_letter: "D", position: 3, team_id: 236 },
    { group_letter: "D", position: 4, team_id: 241 },
    { group_letter: "E", position: 1, team_id: 214 }, // Japan
    { group_letter: "E", position: 2, team_id: 215 }, // Morocco
    { group_letter: "E", position: 3, team_id: 230 },
    { group_letter: "E", position: 4, team_id: 231 },
    { group_letter: "F", position: 1, team_id: 216 }, // Uruguay
    { group_letter: "F", position: 2, team_id: 218 }, // Chile
    { group_letter: "F", position: 3, team_id: 237 },
    { group_letter: "F", position: 4, team_id: 235 },
    { group_letter: "G", position: 1, team_id: 222 },
    { group_letter: "G", position: 2, team_id: 240 },
    { group_letter: "G", position: 3, team_id: 238 },
    { group_letter: "G", position: 4, team_id: 239 },
    { group_letter: "H", position: 1, team_id: 228 },
    { group_letter: "H", position: 2, team_id: 225 },
    { group_letter: "H", position: 3, team_id: 224 },
    { group_letter: "H", position: 4, team_id: 223 },
    { group_letter: "I", position: 1, team_id: 245 },
    { group_letter: "I", position: 2, team_id: 226 },
    { group_letter: "I", position: 3, team_id: 227 },
    { group_letter: "I", position: 4, team_id: 246 },
    { group_letter: "J", position: 1, team_id: 217 },
    { group_letter: "J", position: 2, team_id: 219 },
    { group_letter: "J", position: 3, team_id: 220 },
    { group_letter: "J", position: 4, team_id: 221 },
    { group_letter: "K", position: 1, team_id: 232 },
    { group_letter: "K", position: 2, team_id: 229 },
    { group_letter: "K", position: 3, team_id: 233 },
    { group_letter: "K", position: 4, team_id: 234 },
    { group_letter: "L", position: 1, team_id: 244 },
    { group_letter: "L", position: 2, team_id: 247 },
    { group_letter: "L", position: 3, team_id: 243 },
    { group_letter: "L", position: 4, team_id: 242 },
  ],
  matches: [
    { match_id: 9001, score_a: 2, score_b: 1 },
    { match_id: 9002, score_a: 0, score_b: 1 },
    { match_id: 9003, score_a: 3, score_b: 0 },
    { match_id: 9004, score_a: 2, score_b: 0 },
  ],
  markets: new Map<number, Record<string, string>>([
    [9001, { ou_15: "over", ou_25: "over", btts: "yes", margin: "a_by_1" }],
    [9002, { ou_15: "over", btts: "no", margin: "draw" }],
    [9003, { ou_25: "over", ou_35: "under", btts: "no", margin: "a_by_3plus" }],
    [9004, { ou_25: "under", btts: "yes", margin: "b_by_1" }],
  ]),
};

// ─── Kaan (loser — bracket not committed, only Groups A/B predicted) ─────────
const KAAN_MEMBER = {
  id: 5,
  display_name: "Kaan",
  username: "kaan",
  discriminator: "1212",
  bracketCommittedAt: null,
  bracket: [],
  groups: [
    // Kaan only ever finished Groups A and B (badly).
    { group_letter: "A", position: 1, team_id: 207 }, // Canada — not in top 2
    { group_letter: "A", position: 2, team_id: 205 }, // Mexico — top 2 wrong order
    { group_letter: "B", position: 1, team_id: 210 }, // Portugal — not in top 2
    { group_letter: "B", position: 2, team_id: 201 }, // Brazil — top 2 wrong order
  ],
  matches: [
    { match_id: 9001, score_a: 0, score_b: 3 },
    { match_id: 9002, score_a: 3, score_b: 0 },
    { match_id: 9003, score_a: 1, score_b: 2 },
  ],
  markets: new Map<number, Record<string, string>>([
    [9001, { ou_25: "over", btts: "yes", margin: "b_by_3plus" }],
    [9002, { btts: "no" }],
  ]),
};

function bundleFor(memberId: number): PicksBundle | null {
  const member =
    memberId === 1
      ? ARDA_MEMBER
      : memberId === 2
      ? EREN_MEMBER
      : memberId === 5
      ? KAAN_MEMBER
      : null;
  if (!member) return null;
  return {
    viewer: ARDA_VIEWER_STATE,
    member,
    teams: TEAMS,
    matches: MATCHES,
    bracketLockedAt: BRACKET_LOCKED_AT,
    groupResults: GROUP_RESULTS,
    bracketResults: BRACKET_RESULTS,
  };
}

export type DemoPicksContext = {
  bundle: PicksBundle;
  isSelf: boolean;
  leagueName: string;
};

export function getDemoPicks(
  leagueId: number,
  memberId: number
): DemoPicksContext | null {
  if (leagueId !== 101) return null;
  const bundle = bundleFor(memberId);
  if (!bundle) return null;
  return {
    bundle,
    isSelf: memberId === 1,
    leagueName: "Uni squad",
  };
}
