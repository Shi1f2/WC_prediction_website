// Shared sync logic — called from both the admin "Sync" buttons and the
// lazy auto-sync that fires on page renders.

import { sql } from "@/lib/db";
import {
  fetchWcMatches,
  fetchWcTeams,
  mapGroupLetter,
  mapStage,
  teamNameMatches,
  type ApiTeam,
} from "@/lib/footballData";

export type TeamSyncReport = {
  api_count: number;
  inserted: number;
  linked: number;
  updated: number;
  orphans: { id: number; name: string; group_letter: string | null }[];
};

export type FixturesSyncReport = {
  teams: TeamSyncReport;
  matches: {
    api_count: number;
    inserted: number;
    updated: number;
    skipped: { api_id: number; reason: string }[];
  };
};

export type ResultsSyncReport = {
  api_count: number;
  updated: number;
  unchanged: number;
  not_linked: number[];
};

type TeamRow = {
  id: number;
  name: string;
  code: string;
  flag: string;
  group_letter: string | null;
  api_team_id: number | null;
};

function flagFromTla(tla: string | null): string {
  const t = (tla ?? "").toUpperCase();
  const overrides: Record<string, string> = {
    ENG: "gb-eng", SCO: "gb-sct", WAL: "gb-wls", NIR: "gb-nir",
    USA: "us", RSA: "za", KSA: "sa", UAE: "ae", KOR: "kr", PRK: "kp",
    GER: "de", NED: "nl", SUI: "ch", DEN: "dk", SWE: "se", NOR: "no",
    POR: "pt", ESP: "es", FRA: "fr", ITA: "it", BEL: "be", AUT: "at",
    CRO: "hr", CZE: "cz", POL: "pl", SVN: "si", SVK: "sk", UKR: "ua",
    BIH: "ba", MNE: "me", MKD: "mk", SRB: "rs", ROU: "ro", BUL: "bg",
    GRE: "gr", ALB: "al", TUR: "tr", URY: "uy", PAR: "py", ARG: "ar",
    BRA: "br", CHI: "cl", COL: "co", VEN: "ve", PER: "pe", BOL: "bo",
    ECU: "ec", MEX: "mx", CAN: "ca", CRC: "cr", HON: "hn", SLV: "sv",
    GUA: "gt", PAN: "pa", JAM: "jm", HAI: "ht", CUW: "cw", TRI: "tt",
    JPN: "jp", AUS: "au", NZL: "nz", IRN: "ir", IRQ: "iq", JOR: "jo",
    QAT: "qa", LBN: "lb", SYR: "sy", PLE: "ps", UZB: "uz", KGZ: "kg",
    TKM: "tm", KAZ: "kz", TJK: "tj", AFG: "af", IND: "in", THA: "th",
    VIE: "vn", PHI: "ph", IDN: "id", MAS: "my", SGP: "sg", CHN: "cn",
    HKG: "hk", TPE: "tw", MAR: "ma", ALG: "dz", TUN: "tn", LBY: "ly",
    EGY: "eg", SDN: "sd", SEN: "sn", CIV: "ci", GHA: "gh", NGA: "ng",
    CMR: "cm", COD: "cd", CGO: "cg", ANG: "ao", ZAM: "zm", ZIM: "zw",
    KEN: "ke", UGA: "ug", TAN: "tz", ETH: "et", MLI: "ml", BFA: "bf",
    GUI: "gn", GAM: "gm", LIB: "lr", SLE: "sl", TOG: "tg", BEN: "bj",
    NIG: "ne", CPV: "cv", MTN: "mr", GAB: "ga", GNB: "gw", GEQ: "gq",
    CTA: "cf", CHA: "td", BDI: "bi", RWA: "rw", DJI: "dj", SOM: "so",
    ERI: "er", MAD: "mg", MWI: "mw", MOZ: "mz", BOT: "bw", LES: "ls",
    SWZ: "sz", NAM: "na", COM: "km", MRI: "mu", SEY: "sc", STP: "st",
    ISL: "is", IRL: "ie", FIN: "fi", EST: "ee", LVA: "lv", LTU: "lt",
    HUN: "hu", LUX: "lu", MLT: "mt", CYP: "cy", AND: "ad", LIE: "li",
    MON: "mc", SMR: "sm", VAT: "va", BLR: "by", MDA: "md", ARM: "am",
    AZE: "az", GEO: "ge", ISR: "il",
  };
  if (overrides[t]) return overrides[t];
  return t.slice(0, 2).toLowerCase();
}

async function upsertTeams(apiTeams: ApiTeam[]): Promise<TeamSyncReport> {
  const existing = await sql<TeamRow[]>`
    SELECT id, name, code, flag, group_letter, api_team_id FROM teams
  `;

  const byApiId = new Map<number, TeamRow>();
  for (const t of existing) if (t.api_team_id != null) byApiId.set(t.api_team_id, t);

  let inserted = 0;
  let linked = 0;
  let updated = 0;

  for (const at of apiTeams) {
    const code = at.tla ?? at.name.slice(0, 3).toUpperCase();
    const flag = flagFromTla(at.tla);

    const linkedRow = byApiId.get(at.id);
    if (linkedRow) {
      await sql`
        UPDATE teams
        SET name = ${at.name}, code = ${code}, flag = ${flag}
        WHERE id = ${linkedRow.id}
      `;
      updated++;
      continue;
    }

    const candidate = existing.find(
      (e) => e.api_team_id == null && teamNameMatches(at.name, e.name),
    );
    if (candidate) {
      await sql`
        UPDATE teams
        SET api_team_id = ${at.id}, code = ${code}, flag = ${flag}
        WHERE id = ${candidate.id}
      `;
      candidate.api_team_id = at.id;
      byApiId.set(at.id, candidate);
      linked++;
      continue;
    }

    await sql`
      INSERT INTO teams (name, code, flag, api_team_id)
      VALUES (${at.name}, ${code}, ${flag}, ${at.id})
    `;
    inserted++;
  }

  const apiIds = new Set(apiTeams.map((t) => t.id));
  const orphans = existing
    .filter((e) => e.api_team_id == null)
    .filter((e) => !apiTeams.some((at) => teamNameMatches(at.name, e.name)))
    .map((e) => ({ id: e.id, name: e.name, group_letter: e.group_letter }));

  for (const e of existing) {
    if (e.api_team_id != null && !apiIds.has(e.api_team_id)) {
      orphans.push({ id: e.id, name: e.name, group_letter: e.group_letter });
    }
  }

  return { api_count: apiTeams.length, inserted, linked, updated, orphans };
}

// 2 API calls (teams + matches).
export async function runFixturesSync(): Promise<FixturesSyncReport> {
  const apiTeams = await fetchWcTeams();
  const teamReport = await upsertTeams(apiTeams);

  const localTeams = await sql<{ id: number; api_team_id: number | null }[]>`
    SELECT id, api_team_id FROM teams WHERE api_team_id IS NOT NULL
  `;
  const localByApi = new Map(
    localTeams.map((t) => [t.api_team_id as number, t.id]),
  );

  const apiMatches = await fetchWcMatches();

  let matchesInserted = 0;
  let matchesUpdated = 0;
  const matchesSkipped: { api_id: number; reason: string }[] = [];

  for (const am of apiMatches) {
    const homeId = am.homeTeam?.id ? localByApi.get(am.homeTeam.id) : null;
    const awayId = am.awayTeam?.id ? localByApi.get(am.awayTeam.id) : null;

    const stage = mapStage(am.stage);
    const groupLetter = mapGroupLetter(am.group);
    const liveOrDone =
      am.status === "FINISHED" ||
      am.status === "AWARDED" ||
      am.status === "IN_PLAY" ||
      am.status === "PAUSED" ||
      am.status === "EXTRA_TIME" ||
      am.status === "PENALTY_SHOOTOUT";
    const scoreA = liveOrDone ? am.score.fullTime.home : null;
    const scoreB = liveOrDone ? am.score.fullTime.away : null;

    if (groupLetter) {
      if (homeId) {
        await sql`
          UPDATE teams SET group_letter = ${groupLetter}
          WHERE id = ${homeId} AND (group_letter IS DISTINCT FROM ${groupLetter})
        `;
      }
      if (awayId) {
        await sql`
          UPDATE teams SET group_letter = ${groupLetter}
          WHERE id = ${awayId} AND (group_letter IS DISTINCT FROM ${groupLetter})
        `;
      }
    }

    const existing = await sql<{ id: number }[]>`
      SELECT id FROM matches WHERE api_fixture_id = ${am.id} LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE matches SET
          stage = ${stage},
          group_letter = ${groupLetter},
          team_a_id = ${homeId ?? null},
          team_b_id = ${awayId ?? null},
          kickoff_at = ${am.utcDate},
          actual_score_a = ${scoreA},
          actual_score_b = ${scoreB},
          status = ${am.status}
        WHERE id = ${existing[0].id}
      `;
      matchesUpdated++;
    } else {
      if (!homeId && !awayId && stage === "group") {
        matchesSkipped.push({
          api_id: am.id,
          reason: "no teams resolved (group stage requires both teams)",
        });
        continue;
      }
      await sql`
        INSERT INTO matches
          (stage, group_letter, team_a_id, team_b_id, kickoff_at,
           actual_score_a, actual_score_b, api_fixture_id, status)
        VALUES
          (${stage}, ${groupLetter}, ${homeId ?? null}, ${awayId ?? null},
           ${am.utcDate}, ${scoreA}, ${scoreB}, ${am.id}, ${am.status})
      `;
      matchesInserted++;
    }
  }

  return {
    teams: teamReport,
    matches: {
      api_count: apiMatches.length,
      inserted: matchesInserted,
      updated: matchesUpdated,
      skipped: matchesSkipped,
    },
  };
}

// 1 API call. Writes live in-play scores too — UI uses `status` to render the
// LIVE badge and skip awarding points until FINISHED/AWARDED.
export async function runResultsSync(): Promise<ResultsSyncReport> {
  const apiMatches = await fetchWcMatches();
  let updated = 0;
  let unchanged = 0;
  const notLinked: number[] = [];

  const SCORE_STATUSES = new Set([
    "IN_PLAY",
    "PAUSED",
    "EXTRA_TIME",
    "PENALTY_SHOOTOUT",
    "FINISHED",
    "AWARDED",
  ]);

  for (const am of apiMatches) {
    const rows = await sql<
      {
        id: number;
        actual_score_a: number | null;
        actual_score_b: number | null;
        status: string | null;
      }[]
    >`
      SELECT id, actual_score_a, actual_score_b, status
      FROM matches WHERE api_fixture_id = ${am.id} LIMIT 1
    `;

    if (rows.length === 0) {
      notLinked.push(am.id);
      continue;
    }
    const row = rows[0];

    const hasScore = SCORE_STATUSES.has(am.status);
    const scoreA = hasScore ? am.score.fullTime.home : null;
    const scoreB = hasScore ? am.score.fullTime.away : null;

    if (
      row.actual_score_a === scoreA &&
      row.actual_score_b === scoreB &&
      row.status === am.status
    ) {
      unchanged++;
      continue;
    }
    await sql`
      UPDATE matches
      SET actual_score_a = ${scoreA},
          actual_score_b = ${scoreB},
          status = ${am.status}
      WHERE id = ${row.id}
    `;
    updated++;
  }

  return {
    api_count: apiMatches.length,
    updated,
    unchanged,
    not_linked: notLinked,
  };
}
