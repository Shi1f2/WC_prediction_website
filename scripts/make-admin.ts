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

const username = process.argv[2];
if (!username) {
  console.error("Usage: npm run make-admin <username>");
  process.exit(1);
}
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { prepare: false });

const r = await sql`UPDATE users SET is_admin = true WHERE username = ${username.toLowerCase()} RETURNING id`;
if (r.length === 0) console.error("No such user.");
else console.log(`Promoted ${username} to admin.`);
await sql.end();
