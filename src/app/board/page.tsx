import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import BoardClient from "@/components/BoardClient";
import { autoSyncForPage } from "@/lib/autoSync";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await autoSyncForPage();

  const teams = await sql<
    { id: number; name: string; code: string; flag: string; group_letter: string | null }[]
  >`
    SELECT id, name, code, flag, group_letter
    FROM teams
    ORDER BY group_letter NULLS LAST, name
  `;
  const groupPreds = await sql<
    { group_letter: string; position: number; team_id: number }[]
  >`SELECT group_letter, position, team_id FROM group_predictions WHERE user_id = ${user.id}`;
  const bracketPreds = await sql<{ stage: string; team_id: number }[]>`
    SELECT stage, team_id FROM bracket_predictions WHERE user_id = ${user.id}
  `;
  const firstKickoff = await sql<
    { kickoff_at: Date; group_letter: string }[]
  >`
    SELECT DISTINCT ON (group_letter) group_letter, kickoff_at
    FROM matches WHERE stage = 'group' ORDER BY group_letter, kickoff_at
  `;
  const firstKnockout = await sql<{ kickoff_at: Date }[]>`
    SELECT kickoff_at FROM matches
    WHERE stage IN ('r32','r16') ORDER BY kickoff_at ASC LIMIT 1
  `;

  const lockMap = new Map(
    firstKickoff.map((r) => [r.group_letter, new Date(r.kickoff_at).getTime()])
  );
  const bracketLocked =
    firstKnockout.length > 0 &&
    new Date(firstKnockout[0].kickoff_at).getTime() <= Date.now();

  type T = (typeof teams)[number];
  const groupMap = new Map<string, T[]>();
  for (const t of teams) {
    if (!t.group_letter) continue;
    const arr: T[] = groupMap.get(t.group_letter) ?? [];
    arr.push(t);
    groupMap.set(t.group_letter, arr);
  }

  const predMap = new Map<string, Record<number, number>>();
  for (const p of groupPreds) {
    const cur = predMap.get(p.group_letter) ?? {};
    cur[p.position] = p.team_id;
    predMap.set(p.group_letter, cur);
  }

  const sortedLetters = [...groupMap.keys()].sort();
  const groupArray = sortedLetters.map((letter) => {
    const lock = lockMap.get(letter);
    return {
      letter,
      teams: groupMap.get(letter)!,
      locked: lock != null && Date.now() > lock,
    };
  });

  const initialGroupPicks: Record<string, (number | null)[]> = {};
  for (const letter of sortedLetters) {
    const m: Record<number, number> = predMap.get(letter) ?? {};
    initialGroupPicks[letter] = [
      m[1] ?? null,
      m[2] ?? null,
      m[3] ?? null,
      m[4] ?? null,
    ];
  }

  const bracketInitial: Record<string, number[]> = {
    R16: [],
    QF: [],
    SF: [],
    FINAL: [],
    WINNER: [],
  };
  for (const p of bracketPreds) {
    if (bracketInitial[p.stage]) bracketInitial[p.stage].push(p.team_id);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display-italic mb-1 text-4xl uppercase text-on-background sm:text-5xl">
          The <span className="text-secondary">Board</span>
        </h1>
        <p className="text-on-background-variant">
          Pick the top 2 from each group up top. The bracket below auto-fills
          its team pool with your advancers — drag and zoom around it freely.
        </p>
      </header>
      <BoardClient
        allTeams={teams}
        groups={groupArray}
        initialGroupPicks={initialGroupPicks}
        initialBracket={bracketInitial}
        bracketLocked={bracketLocked}
      />
    </div>
  );
}
