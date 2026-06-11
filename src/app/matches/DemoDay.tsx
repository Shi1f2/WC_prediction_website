import MatchRow from "./MatchRow";

// Preview of the prediction UI in its various states, gated behind the admin
// toggle on /admin (sync_state.show_match_demo). Uses negative match IDs so
// any accidental save POST hits a 404 instead of touching real data.
export default function DemoDay() {
  return (
    <section className="glass-card rounded-2xl border border-dashed border-secondary/60 p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between border-b border-outline-variant/20 pb-3">
        <h2 className="font-display text-2xl font-bold italic uppercase tracking-tighter text-secondary sm:text-3xl">
          Demo Day
        </h2>
        <span className="mono text-xs uppercase tracking-wider text-on-surface-variant">
          preview · admin toggle
        </span>
      </div>
      <div className="space-y-3">
        <p className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          1. Editable — open window, no picks yet (try clicking pills)
        </p>
        <MatchRow
          match={{
            id: -1,
            stage: "group",
            group_letter: "C",
            team_a_name: "Portugal",
            team_a_flag: "pt",
            team_a_label: null,
            team_b_name: "Spain",
            team_b_flag: "es",
            team_b_label: null,
            kickoff_at: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
            actual_score_a: null,
            actual_score_b: null,
            status: null,
            current_minute: null,
            injury_time: null,
            pred_a: null,
            pred_b: null,
          }}
        />

        <p className="mono mt-6 text-[10px] uppercase tracking-wider text-on-surface-variant">
          2. Submitted — bet locked in, match hasn&apos;t started
        </p>
        <MatchRow
          match={{
            id: -2,
            stage: "group",
            group_letter: "A",
            team_a_name: "Brazil",
            team_a_flag: "br",
            team_a_label: null,
            team_b_name: "Argentina",
            team_b_flag: "ar",
            team_b_label: null,
            kickoff_at: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
            actual_score_a: null,
            actual_score_b: null,
            status: null,
            current_minute: null,
            injury_time: null,
            pred_a: 2,
            pred_b: 1,
          }}
          marketPicks={{
            ou_25: "over",
            btts: "yes",
            margin: "a_by_1",
          }}
        />

        <p className="mono mt-6 text-[10px] uppercase tracking-wider text-on-surface-variant">
          3. Live — running provisional points while the match plays
        </p>
        <MatchRow
          match={{
            id: -3,
            stage: "group",
            group_letter: "B",
            team_a_name: "France",
            team_a_flag: "fr",
            team_a_label: null,
            team_b_name: "Germany",
            team_b_flag: "de",
            team_b_label: null,
            kickoff_at: new Date(Date.now() - 30 * 60_000).toISOString(),
            actual_score_a: 1,
            actual_score_b: 1,
            status: "IN_PLAY",
            current_minute: 60,
            injury_time: null,
            pred_a: 2,
            pred_b: 1,
          }}
          marketPicks={{
            ou_15: "over",
            ou_25: "under",
            btts: "yes",
            margin: "draw",
          }}
        />

        <p className="mono mt-6 text-[10px] uppercase tracking-wider text-on-surface-variant">
          4. Final · positive total — exact score nailed, markets mixed
        </p>
        <MatchRow
          match={{
            id: -4,
            stage: "r16",
            group_letter: null,
            team_a_name: "Spain",
            team_a_flag: "es",
            team_a_label: null,
            team_b_name: "England",
            team_b_flag: "gb-eng",
            team_b_label: null,
            kickoff_at: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
            actual_score_a: 2,
            actual_score_b: 1,
            status: "FINISHED",
            current_minute: null,
            injury_time: null,
            pred_a: 2,
            pred_b: 1,
          }}
          marketPicks={{
            ou_25: "over",
            ou_35: "over",
            btts: "yes",
            margin: "a_by_1",
          }}
        />

        <p className="mono mt-6 text-[10px] uppercase tracking-wider text-on-surface-variant">
          5. Final · negative total — exact score missed, markets all wrong
        </p>
        <MatchRow
          match={{
            id: -5,
            stage: "qf",
            group_letter: null,
            team_a_name: "Netherlands",
            team_a_flag: "nl",
            team_a_label: null,
            team_b_name: "Croatia",
            team_b_flag: "hr",
            team_b_label: null,
            kickoff_at: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
            actual_score_a: 3,
            actual_score_b: 3,
            status: "FINISHED",
            current_minute: null,
            injury_time: null,
            pred_a: 1,
            pred_b: 0,
          }}
          marketPicks={{
            ou_15: "under",
            btts: "no",
            margin: "a_by_1",
          }}
        />
      </div>
    </section>
  );
}
