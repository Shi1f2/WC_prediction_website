import MatchRow from "./MatchRow";

// Preview of the live/final results section, gated behind the admin toggle on
// /admin (sync_state.show_match_demo).
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
        <MatchRow
          match={{
            id: -1,
            stage: "group",
            group_letter: "A",
            team_a_name: "Brazil",
            team_a_flag: "br",
            team_a_label: null,
            team_b_name: "Argentina",
            team_b_flag: "ar",
            team_b_label: null,
            kickoff_at: new Date(Date.now() - 30 * 60_000).toISOString(),
            actual_score_a: 1,
            actual_score_b: 1,
            status: "IN_PLAY",
            pred_a: 2,
            pred_b: 1,
          }}
        />
        <MatchRow
          match={{
            id: -2,
            stage: "group",
            group_letter: "B",
            team_a_name: "France",
            team_a_flag: "fr",
            team_a_label: null,
            team_b_name: "Germany",
            team_b_flag: "de",
            team_b_label: null,
            kickoff_at: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
            actual_score_a: 2,
            actual_score_b: 1,
            status: "FINISHED",
            pred_a: 2,
            pred_b: 1,
          }}
        />
        <MatchRow
          match={{
            id: -3,
            stage: "r16",
            group_letter: null,
            team_a_name: "Spain",
            team_a_flag: "es",
            team_a_label: null,
            team_b_name: "England",
            team_b_flag: "gb-eng",
            team_b_label: null,
            kickoff_at: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
            actual_score_a: 0,
            actual_score_b: 3,
            status: "FINISHED",
            pred_a: 2,
            pred_b: 1,
          }}
        />
      </div>
    </section>
  );
}
