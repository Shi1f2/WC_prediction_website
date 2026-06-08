import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import BracketPicker from "./BracketPicker";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const teams = await sql<
    { id: number; name: string; flag: string; group_letter: string | null }[]
  >`
    SELECT id, name, flag, group_letter FROM teams ORDER BY name
  `;
  const preds = await sql<{ stage: string; team_id: number }[]>`
    SELECT stage, team_id FROM bracket_predictions WHERE user_id = ${user.id}
  `;
  const initial: Record<string, number[]> = { QF: [], SF: [], FINAL: [], WINNER: [] };
  for (const p of preds) {
    if (initial[p.stage]) initial[p.stage].push(p.team_id);
  }
  const firstKnockout = await sql<{ kickoff_at: Date }[]>`
    SELECT kickoff_at FROM matches
    WHERE stage IN ('r32', 'r16') ORDER BY kickoff_at ASC LIMIT 1
  `;
  const locked =
    firstKnockout.length > 0 &&
    new Date(firstKnockout[0].kickoff_at).getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display-italic mb-2 text-4xl uppercase text-on-background sm:text-5xl">
          Knockout <span className="text-secondary">Bracket</span>
        </h1>
        <p className="text-on-background-variant">
          Pick which teams reach each round. Locks at the first knockout kickoff.
        </p>
      </header>
      <BracketPicker teams={teams} initial={initial} locked={locked} />
    </div>
  );
}
