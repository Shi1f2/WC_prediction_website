import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import GroupPicker from "./GroupPicker";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const teams = await sql<
    { id: number; name: string; code: string; flag: string; group_letter: string }[]
  >`
    SELECT id, name, code, flag, group_letter
    FROM teams
    WHERE group_letter IS NOT NULL
    ORDER BY group_letter, name
  `;
  const preds = await sql<{ group_letter: string; position: number; team_id: number }[]>`
    SELECT group_letter, position, team_id
    FROM group_predictions WHERE user_id = ${user.id}
  `;
  const firstKickoff = await sql<{ kickoff_at: Date; group_letter: string }[]>`
    SELECT DISTINCT ON (group_letter) group_letter, kickoff_at
    FROM matches
    WHERE stage = 'group'
    ORDER BY group_letter, kickoff_at
  `;
  const lockMap = new Map(
    firstKickoff.map((r) => [r.group_letter, new Date(r.kickoff_at).getTime()])
  );
  const predMap = new Map<string, { 1?: number; 2?: number }>();
  for (const p of preds) {
    const cur = predMap.get(p.group_letter) ?? {};
    (cur as Record<number, number>)[p.position] = p.team_id;
    predMap.set(p.group_letter, cur);
  }

  type T = (typeof teams)[number];
  const groups = new Map<string, T[]>();
  for (const t of teams) {
    const arr: T[] = groups.get(t.group_letter) ?? [];
    arr.push(t);
    groups.set(t.group_letter, arr);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display-italic mb-2 text-4xl uppercase text-on-background sm:text-5xl">
          Group <span className="text-primary">Stage</span>
        </h1>
        <p className="text-on-background-variant">
          Pick who finishes <b className="text-secondary">1st</b> and{" "}
          <b className="text-secondary">2nd</b> in each group. Each group locks at its first kickoff.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...groups.entries()].map(([letter, ts]) => {
          const lock = lockMap.get(letter);
          const locked = lock != null && Date.now() > lock;
          return (
            <GroupPicker
              key={letter}
              letter={letter}
              teams={ts}
              pick1={predMap.get(letter)?.[1]}
              pick2={predMap.get(letter)?.[2]}
              locked={locked}
            />
          );
        })}
      </div>
    </div>
  );
}
