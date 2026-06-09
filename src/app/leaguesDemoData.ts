import type {
  LeaderboardRow,
  Highlights,
  UserBet,
  DailyTopBottom,
} from "@/lib/scoring";

export type DemoLeague = {
  id: number;
  name: string;
  member_count: number;
  rows: LeaderboardRow[];
  highlights: Highlights;
  bets: Record<number, UserBet[]>;
  daily: DailyTopBottom;
};

export type DemoInvite = {
  invite_id: number;
  league_name: string;
  inviter_display_name: string;
  inviter_username: string;
  inviter_discriminator: string;
};

export const DEMO_VIEWER = {
  user_id: 1,
  display_name: "Arda",
  username: "arda",
  discriminator: "7421",
};

const ARDA = {
  user_id: 1,
  display_name: "Arda",
  username: "arda",
  discriminator: "7421",
};
const EREN = {
  user_id: 2,
  display_name: "Eren",
  username: "eren",
  discriminator: "0042",
};
const MERT = {
  user_id: 3,
  display_name: "Mert",
  username: "mert",
  discriminator: "9988",
};
const ZEHRA = {
  user_id: 4,
  display_name: "Zehra",
  username: "zehra",
  discriminator: "0314",
};
const KAAN = {
  user_id: 5,
  display_name: "Kaan",
  username: "kaan",
  discriminator: "1212",
};

const ldate = (s: string) => new Date(`${s}T18:00:00Z`);

const ERENS_BETS: UserBet[] = [
  {
    match_id: 9001,
    kickoff_at: ldate("2026-06-13"),
    label: "Mexico vs Argentina",
    actual_score: "2-1",
    prediction_score: "2-1",
    score_pts: 10,
    markets: [
      { market_id: "ou_25", market_label: "O/U 2.5", pick_label: "Over 2.5", pts: 4 },
    ],
    total_pts: 14,
  },
  {
    match_id: 9003,
    kickoff_at: ldate("2026-06-12"),
    label: "Brazil vs Germany",
    actual_score: "3-0",
    prediction_score: "3-0",
    score_pts: 10,
    markets: [],
    total_pts: 10,
  },
  {
    match_id: 9004,
    kickoff_at: ldate("2026-06-11"),
    label: "France vs Spain",
    actual_score: "1-2",
    prediction_score: "2-0",
    score_pts: -10,
    markets: [],
    total_pts: -10,
  },
];

const KAANS_BETS: UserBet[] = [
  {
    match_id: 9001,
    kickoff_at: ldate("2026-06-13"),
    label: "Mexico vs Argentina",
    actual_score: "2-1",
    prediction_score: "0-3",
    score_pts: -10,
    markets: [],
    total_pts: -10,
  },
  {
    match_id: 9002,
    kickoff_at: ldate("2026-06-13"),
    label: "USA vs Canada",
    actual_score: "1-1",
    prediction_score: "3-0",
    score_pts: -10,
    markets: [
      { market_id: "btts", market_label: "BTTS", pick_label: "No", pts: -4 },
    ],
    total_pts: -14,
  },
  {
    match_id: 9003,
    kickoff_at: ldate("2026-06-12"),
    label: "Brazil vs Germany",
    actual_score: "3-0",
    prediction_score: "1-2",
    score_pts: -10,
    markets: [],
    total_pts: -10,
  },
];

const ARDAS_BETS: UserBet[] = [
  {
    match_id: 9003,
    kickoff_at: ldate("2026-06-12"),
    label: "Brazil vs Germany",
    actual_score: "3-0",
    prediction_score: "3-0",
    score_pts: 10,
    markets: [
      { market_id: "btts", market_label: "BTTS", pick_label: "No", pts: 4 },
    ],
    total_pts: 14,
  },
  {
    match_id: 9001,
    kickoff_at: ldate("2026-06-13"),
    label: "Mexico vs Argentina",
    actual_score: "2-1",
    prediction_score: "2-1",
    score_pts: 10,
    markets: [],
    total_pts: 10,
  },
  {
    match_id: 9002,
    kickoff_at: ldate("2026-06-13"),
    label: "USA vs Canada",
    actual_score: "1-1",
    prediction_score: "0-2",
    score_pts: -10,
    markets: [],
    total_pts: -10,
  },
];

export const DEMO_LEAGUES: DemoLeague[] = [
  {
    id: 101,
    name: "Uni squad",
    member_count: 5,
    rows: [
      { ...EREN, match_points: 28, group_points: 12, bracket_points: 14, total: 54 },
      { ...ARDA, match_points: 22, group_points: 10, bracket_points: 16, total: 48 },
      { ...ZEHRA, match_points: 18, group_points: 14, bracket_points: 8, total: 40 },
      { ...MERT, match_points: 14, group_points: 8, bracket_points: 12, total: 34 },
      { ...KAAN, match_points: -8, group_points: 6, bracket_points: 4, total: 2 },
    ],
    bets: { [EREN.user_id]: ERENS_BETS, [KAAN.user_id]: KAANS_BETS },
    daily: {
      date: "2026-06-13",
      winner: { ...EREN, pts: 14 },
      loser: { ...KAAN, pts: -24 },
      winnerBets: ERENS_BETS.filter((b) => b.kickoff_at >= ldate("2026-06-13")),
      loserBets: KAANS_BETS.filter((b) => b.kickoff_at >= ldate("2026-06-13")),
    },
    highlights: {
      byDay: [
        { date: "2026-06-13", top: { ...EREN, pts: 18 }, bottom: { ...KAAN, pts: -16 } },
        { date: "2026-06-12", top: { ...ARDA, pts: 14 }, bottom: { ...MERT, pts: -6 } },
        { date: "2026-06-11", top: { ...ZEHRA, pts: 10 }, bottom: { ...KAAN, pts: -10 } },
      ],
      byMatch: [
        {
          match_id: 9001,
          kickoff_at: ldate("2026-06-13"),
          label: "Mexico vs Argentina (2-1)",
          top: { ...EREN, pts: 14 },
          bottom: { ...KAAN, pts: -10 },
        },
        {
          match_id: 9002,
          kickoff_at: ldate("2026-06-13"),
          label: "USA vs Canada (1-1)",
          top: { ...ZEHRA, pts: 7 },
          bottom: { ...MERT, pts: -10 },
        },
        {
          match_id: 9003,
          kickoff_at: ldate("2026-06-12"),
          label: "Brazil vs Germany (3-0)",
          top: { ...ARDA, pts: 14 },
          bottom: { ...KAAN, pts: -10 },
        },
        {
          match_id: 9004,
          kickoff_at: ldate("2026-06-11"),
          label: "France vs Spain (1-2)",
          top: { ...ZEHRA, pts: 10 },
          bottom: { ...EREN, pts: -10 },
        },
      ],
    },
  },
  {
    id: 102,
    name: "Office leaderboard",
    member_count: 3,
    rows: [
      { ...ARDA, match_points: 22, group_points: 10, bracket_points: 16, total: 48 },
      { ...MERT, match_points: 14, group_points: 8, bracket_points: 12, total: 34 },
      { ...KAAN, match_points: -8, group_points: 6, bracket_points: 4, total: 2 },
    ],
    bets: { [ARDA.user_id]: ARDAS_BETS, [KAAN.user_id]: KAANS_BETS },
    daily: {
      date: "2026-06-13",
      winner: { ...ARDA, pts: 0 },
      loser: { ...KAAN, pts: -24 },
      winnerBets: ARDAS_BETS.filter((b) => b.kickoff_at >= ldate("2026-06-13")),
      loserBets: KAANS_BETS.filter((b) => b.kickoff_at >= ldate("2026-06-13")),
    },
    highlights: {
      byDay: [
        { date: "2026-06-13", top: { ...ARDA, pts: 14 }, bottom: { ...KAAN, pts: -16 } },
        { date: "2026-06-12", top: { ...MERT, pts: 6 }, bottom: { ...ARDA, pts: -4 } },
      ],
      byMatch: [
        {
          match_id: 9001,
          kickoff_at: ldate("2026-06-13"),
          label: "Mexico vs Argentina (2-1)",
          top: { ...ARDA, pts: 14 },
          bottom: { ...KAAN, pts: -10 },
        },
        {
          match_id: 9003,
          kickoff_at: ldate("2026-06-12"),
          label: "Brazil vs Germany (3-0)",
          top: { ...MERT, pts: 6 },
          bottom: { ...ARDA, pts: -4 },
        },
      ],
    },
  },
];

export const DEMO_INVITES: DemoInvite[] = [
  {
    invite_id: 555,
    league_name: "Sunday five-a-side",
    inviter_display_name: "Eren",
    inviter_username: "eren",
    inviter_discriminator: "0042",
  },
];

export const LEAGUES_DEMO = {
  viewer: DEMO_VIEWER,
  leagues: DEMO_LEAGUES,
  invites: DEMO_INVITES,
};
