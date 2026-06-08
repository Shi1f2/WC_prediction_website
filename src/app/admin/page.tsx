import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminMatches from "./AdminMatches";
import AdminGroupResults from "./AdminGroupResults";
import AdminBracketResults from "./AdminBracketResults";
import AdminAddMatch from "./AdminAddMatch";
import AdminSync from "./AdminSync";
import AdminDemoToggle from "./AdminDemoToggle";
import { readSyncState } from "@/lib/autoSync";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/login");
  }

  const matches = await sql<
    {
      id: number;
      stage: string;
      group_letter: string | null;
      team_a_name: string | null;
      team_a_label: string | null;
      team_b_name: string | null;
      team_b_label: string | null;
      kickoff_at: Date;
      actual_score_a: number | null;
      actual_score_b: number | null;
    }[]
  >`
    SELECT m.id, m.stage, m.group_letter,
      ta.name AS team_a_name, m.team_a_label,
      tb.name AS team_b_name, m.team_b_label,
      m.kickoff_at, m.actual_score_a, m.actual_score_b
    FROM matches m
    LEFT JOIN teams ta ON ta.id = m.team_a_id
    LEFT JOIN teams tb ON tb.id = m.team_b_id
    ORDER BY m.kickoff_at, m.id
  `;
  const teams = await sql<{ id: number; name: string; group_letter: string | null }[]>`
    SELECT id, name, group_letter FROM teams ORDER BY group_letter NULLS LAST, name
  `;
  const groupResults = await sql<{ group_letter: string; position: number; team_id: number }[]>`
    SELECT group_letter, position, team_id FROM group_results
  `;
  const bracketResults = await sql<{ stage: string; team_id: number }[]>`
    SELECT stage, team_id FROM bracket_results
  `;
  const syncState = await readSyncState();
  const showDemo = (await cookies()).get("match_demo")?.value === "1";

  return (
    <div className="space-y-12">
      <header>
        <h1 className="display-italic mb-2 text-4xl uppercase text-on-background sm:text-5xl">
          Admin <span className="text-secondary">Control</span>
        </h1>
        <p className="text-on-background-variant">
          Enter results, add knockout matches, lock in final standings.
        </p>
      </header>

      <Section title="Sync from football-data.org">
        <AdminSync syncState={syncState} />
      </Section>

      <Section title="Preview">
        <AdminDemoToggle initial={showDemo} />
      </Section>

      <Section title="Match results">
        <AdminMatches
          matches={matches.map((m) => ({
            ...m,
            kickoff_at: new Date(m.kickoff_at).toISOString(),
          }))}
        />
      </Section>

      <Section title="Add a knockout match">
        <AdminAddMatch teams={teams} />
      </Section>

      <Section title="Group final standings">
        <AdminGroupResults teams={teams} existing={groupResults} />
      </Section>

      <Section title="Bracket actuals">
        <AdminBracketResults teams={teams} existing={bracketResults} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-display text-xl font-bold italic uppercase tracking-tighter text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}
