import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isValidMarketPick } from "@/lib/markets";
import { FORCE_OPEN_FIRST_MATCH } from "@/lib/featureFlags";

const OPEN_WINDOW_MS = 36 * 60 * 60 * 1000;

type BetBody = {
  match_id?: unknown;
  score?: { a?: unknown; b?: unknown } | null;
  markets?: Array<{ market?: unknown; pick?: unknown }>;
};

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as BetBody | null;
  if (!body)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const matchId = Number(body.match_id);
  if (!Number.isInteger(matchId))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  let scoreA: number | null = null;
  let scoreB: number | null = null;
  if (body.score && body.score.a != null && body.score.b != null) {
    scoreA = Number(body.score.a);
    scoreB = Number(body.score.b);
    if (
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      scoreA < 0 ||
      scoreA > 20 ||
      scoreB < 0 ||
      scoreB > 20
    ) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }
  }

  const marketsRaw = Array.isArray(body.markets) ? body.markets : [];
  const markets: Array<{ market: string; pick: string }> = [];
  for (const m of marketsRaw) {
    const market = String(m?.market ?? "");
    const pick = String(m?.pick ?? "");
    if (!isValidMarketPick(market, pick)) {
      return NextResponse.json(
        { error: `Invalid market pick: ${market}/${pick}` },
        { status: 400 },
      );
    }
    markets.push({ market, pick });
  }
  const marketIds = markets.map((m) => m.market);
  if (new Set(marketIds).size !== marketIds.length) {
    return NextResponse.json(
      { error: "Duplicate market in submission" },
      { status: 400 },
    );
  }

  // At most one "over" and one "under" across the 3 O/U markets — same-side
  // bets at different thresholds are redundant.
  const OU = new Set(["ou_15", "ou_25", "ou_35"]);
  const overs = markets.filter((m) => OU.has(m.market) && m.pick === "over").length;
  const unders = markets.filter((m) => OU.has(m.market) && m.pick === "under").length;
  if (overs > 1 || unders > 1) {
    return NextResponse.json(
      { error: "Only one over and one under allowed across O/U thresholds" },
      { status: 400 },
    );
  }

  if (scoreA == null && markets.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one bet before saving" },
      { status: 400 },
    );
  }

  const m = await sql<{ kickoff_at: Date }[]>`
    SELECT kickoff_at FROM matches WHERE id = ${matchId} LIMIT 1
  `;
  if (m.length === 0)
    return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const msUntil = new Date(m[0].kickoff_at).getTime() - Date.now();
  if (msUntil <= 0)
    return NextResponse.json({ error: "Locked — kickoff passed" }, { status: 403 });

  if (msUntil > OPEN_WINDOW_MS) {
    let isFirst = false;
    if (FORCE_OPEN_FIRST_MATCH) {
      const first = await sql<{ id: number }[]>`
        SELECT id FROM matches ORDER BY kickoff_at, id LIMIT 1
      `;
      isFirst = first[0]?.id === matchId;
    }
    if (!isFirst) {
      return NextResponse.json(
        { error: "Not open yet — opens 36h before kickoff" },
        { status: 403 },
      );
    }
  }

  // One-shot submission: reject if the user has any existing pick (score or
  // market) for this match. Bets lock as soon as they're saved.
  const existing = await sql<{ has_score: boolean; market_count: number }[]>`
    SELECT
      EXISTS(
        SELECT 1 FROM match_predictions
        WHERE user_id = ${user.id} AND match_id = ${matchId}
      ) AS has_score,
      (
        SELECT COUNT(*)::int FROM match_market_predictions
        WHERE user_id = ${user.id} AND match_id = ${matchId}
      ) AS market_count
  `;
  if (existing[0].has_score || existing[0].market_count > 0) {
    return NextResponse.json(
      { error: "Bet already submitted for this match" },
      { status: 409 },
    );
  }

  await sql.begin(async (tx) => {
    if (scoreA != null && scoreB != null) {
      await tx`
        INSERT INTO match_predictions (user_id, match_id, score_a, score_b, updated_at)
        VALUES (${user.id}, ${matchId}, ${scoreA}, ${scoreB}, NOW())
      `;
    }
    for (const mp of markets) {
      await tx`
        INSERT INTO match_market_predictions (user_id, match_id, market, pick, updated_at)
        VALUES (${user.id}, ${matchId}, ${mp.market}, ${mp.pick}, NOW())
      `;
    }
  });

  return NextResponse.json({ ok: true });
}
