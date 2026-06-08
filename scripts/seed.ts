import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Add it to .env.local.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

// Official 2026 FIFA World Cup groups (draw held Dec 5, 2025).
// `flag` is the ISO 3166-1 alpha-2 country code used by flagcdn.com (lowercase).
const GROUPS: Record<string, { name: string; code: string; flag: string }[]> = {
  A: [
    { name: "Mexico", code: "MEX", flag: "mx" },
    { name: "Czechia", code: "CZE", flag: "cz" },
    { name: "South Africa", code: "RSA", flag: "za" },
    { name: "South Korea", code: "KOR", flag: "kr" },
  ],
  B: [
    { name: "Canada", code: "CAN", flag: "ca" },
    { name: "Switzerland", code: "SUI", flag: "ch" },
    { name: "Bosnia & Herzegovina", code: "BIH", flag: "ba" },
    { name: "Qatar", code: "QAT", flag: "qa" },
  ],
  C: [
    { name: "Brazil", code: "BRA", flag: "br" },
    { name: "Morocco", code: "MAR", flag: "ma" },
    { name: "Scotland", code: "SCO", flag: "gb-sct" },
    { name: "Haiti", code: "HAI", flag: "ht" },
  ],
  D: [
    { name: "United States", code: "USA", flag: "us" },
    { name: "Türkiye", code: "TUR", flag: "tr" },
    { name: "Australia", code: "AUS", flag: "au" },
    { name: "Paraguay", code: "PAR", flag: "py" },
  ],
  E: [
    { name: "Germany", code: "GER", flag: "de" },
    { name: "Ecuador", code: "ECU", flag: "ec" },
    { name: "Ivory Coast", code: "CIV", flag: "ci" },
    { name: "Curaçao", code: "CUW", flag: "cw" },
  ],
  F: [
    { name: "Netherlands", code: "NED", flag: "nl" },
    { name: "Japan", code: "JPN", flag: "jp" },
    { name: "Sweden", code: "SWE", flag: "se" },
    { name: "Tunisia", code: "TUN", flag: "tn" },
  ],
  G: [
    { name: "Belgium", code: "BEL", flag: "be" },
    { name: "Egypt", code: "EGY", flag: "eg" },
    { name: "Iran", code: "IRN", flag: "ir" },
    { name: "New Zealand", code: "NZL", flag: "nz" },
  ],
  H: [
    { name: "Spain", code: "ESP", flag: "es" },
    { name: "Uruguay", code: "URU", flag: "uy" },
    { name: "Saudi Arabia", code: "KSA", flag: "sa" },
    { name: "Cape Verde", code: "CPV", flag: "cv" },
  ],
  I: [
    { name: "France", code: "FRA", flag: "fr" },
    { name: "Norway", code: "NOR", flag: "no" },
    { name: "Senegal", code: "SEN", flag: "sn" },
    { name: "Iraq", code: "IRQ", flag: "iq" },
  ],
  J: [
    { name: "Argentina", code: "ARG", flag: "ar" },
    { name: "Austria", code: "AUT", flag: "at" },
    { name: "Algeria", code: "ALG", flag: "dz" },
    { name: "Jordan", code: "JOR", flag: "jo" },
  ],
  K: [
    { name: "Portugal", code: "POR", flag: "pt" },
    { name: "Colombia", code: "COL", flag: "co" },
    { name: "DR Congo", code: "COD", flag: "cd" },
    { name: "Uzbekistan", code: "UZB", flag: "uz" },
  ],
  L: [
    { name: "England", code: "ENG", flag: "gb-eng" },
    { name: "Croatia", code: "CRO", flag: "hr" },
    { name: "Ghana", code: "GHA", flag: "gh" },
    { name: "Panama", code: "PAN", flag: "pa" },
  ],
};

async function main() {
  const force = process.argv.includes("--force");
  const existingTeams = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM teams`;
  if (Number(existingTeams[0].count) > 0) {
    if (!force) {
      console.log(
        "Teams already exist. Re-run with --force to wipe and re-seed:\n" +
          "  npm run seed -- --force"
      );
      await sql.end();
      return;
    }
    console.log("--force: wiping existing teams, matches, and predictions…");
    await sql`DELETE FROM bracket_predictions`;
    await sql`DELETE FROM bracket_results`;
    await sql`DELETE FROM group_predictions`;
    await sql`DELETE FROM group_results`;
    await sql`DELETE FROM match_predictions`;
    await sql`DELETE FROM matches`;
    await sql`DELETE FROM teams`;
    console.log("Wipe complete.");
  }

  for (const [letter, teams] of Object.entries(GROUPS)) {
    for (const t of teams) {
      await sql`
        INSERT INTO teams (name, code, flag, group_letter)
        VALUES (${t.name}, ${t.code}, ${t.flag}, ${letter})
      `;
    }
  }
  console.log("Inserted 48 teams.");

  // Group stage matches: round-robin per group, 6 matches each = 72 total.
  // Pairings within a 4-team group [t1,t2,t3,t4]:
  //   MD1: t1-t2, t3-t4
  //   MD2: t1-t3, t2-t4
  //   MD3: t1-t4, t2-t3
  // Kickoffs are placeholders starting June 11, 2026 — edit dates in admin.
  const PAIRINGS: [number, number][][] = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ];

  const startDay = new Date("2026-06-11T16:00:00Z");
  let orderIndex = 0;
  let matchCount = 0;

  for (let md = 0; md < 3; md++) {
    for (const letter of Object.keys(GROUPS)) {
      const teamRows = await sql<{ id: number }[]>`
        SELECT id FROM teams WHERE group_letter = ${letter} ORDER BY id
      `;
      const ids = teamRows.map((r) => r.id);
      for (const [a, b] of PAIRINGS[md]) {
        const kickoff = new Date(startDay);
        kickoff.setDate(kickoff.getDate() + md * 7 + Math.floor(matchCount / 4));
        kickoff.setUTCHours(16 + (matchCount % 4) * 2);
        await sql`
          INSERT INTO matches
            (stage, group_letter, team_a_id, team_b_id, kickoff_at, order_index)
          VALUES
            ('group', ${letter}, ${ids[a]}, ${ids[b]}, ${kickoff.toISOString()}, ${orderIndex++})
        `;
        matchCount++;
      }
    }
  }
  console.log(`Inserted ${matchCount} group-stage matches.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
