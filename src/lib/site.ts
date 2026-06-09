const FALLBACK = "http://localhost:3000";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || FALLBACK;

export const SITE_NAME = "WC Prediction League";

export const SITE_DESCRIPTION =
  "Predict every match of the 2026 FIFA World Cup with friends. Group stage scores, knockout brackets, and a live leaderboard for your private league.";
