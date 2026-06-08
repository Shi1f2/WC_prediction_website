"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

type SyncState = {
  last_fixtures_sync_at: string | null;
  last_results_sync_at: string | null;
  calls_in_window: number;
  window_started_at: string | null;
  rate_max_per_minute: number;
  rate_window_ms: number;
  fixtures_interval_ms: number;
  results_live_interval_ms: number;
  results_idle_interval_ms: number;
};

function formatRelative(iso: string | null, now: number): string {
  if (!iso) return "never";
  const ms = now - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatInterval(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)} min`;
  return `${Math.round(ms / (60 * 60_000))} h`;
}

type FixturesReport = {
  ok: boolean;
  teams: {
    api_count: number;
    inserted: number;
    linked: number;
    updated: number;
    orphans: { id: number; name: string; group_letter: string | null }[];
  };
  matches: {
    api_count: number;
    inserted: number;
    updated: number;
    skipped: { api_id: number; reason: string }[];
  };
};

type ResultsReport = {
  ok: boolean;
  api_count: number;
  updated: number;
  unchanged: number;
  not_linked: number[];
};

type Report =
  | { kind: "fixtures"; data: FixturesReport }
  | { kind: "results"; data: ResultsReport }
  | { kind: "error"; message: string };

export default function AdminSync({ syncState }: { syncState: SyncState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [report, setReport] = useState<Report | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  function run(path: string, kind: "fixtures" | "results") {
    setReport(null);
    start(async () => {
      try {
        const res = await fetch(path, { method: "POST" });
        const json = await res.json();
        if (!res.ok) {
          setReport({
            kind: "error",
            message:
              json?.error ?? `Request failed with status ${res.status}`,
          });
          return;
        }
        setReport({ kind, data: json } as Report);
        router.refresh();
      } catch (e) {
        setReport({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-bold uppercase tracking-wider text-primary">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Auto-sync is ON
        </div>
        <div className="grid gap-1 text-xs text-on-surface-variant sm:grid-cols-2">
          <div>
            Results — last:{" "}
            <span className="mono text-on-surface">
              {formatRelative(syncState.last_results_sync_at, now)}
            </span>
          </div>
          <div>
            Fixtures — last:{" "}
            <span className="mono text-on-surface">
              {formatRelative(syncState.last_fixtures_sync_at, now)}
            </span>
          </div>
          <div>
            Cadence — live:{" "}
            <span className="mono text-on-surface">
              {formatInterval(syncState.results_live_interval_ms)}
            </span>
            , idle:{" "}
            <span className="mono text-on-surface">
              {formatInterval(syncState.results_idle_interval_ms)}
            </span>
            , fixtures:{" "}
            <span className="mono text-on-surface">
              {formatInterval(syncState.fixtures_interval_ms)}
            </span>
          </div>
          <div>
            Rate cap —{" "}
            <span className="mono text-on-surface">
              {syncState.calls_in_window}/{syncState.rate_max_per_minute}
            </span>{" "}
            in last minute (85% of 10/min)
          </div>
        </div>
      </div>
      <p className="text-sm text-on-surface-variant">
        Auto-sync fires on page loads — you don&apos;t need to click anything.
        Manual buttons below force an immediate refresh.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run("/api/admin/sync-fixtures", "fixtures")}
          disabled={pending}
          className="rounded-full bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-secondary hover:brightness-110 disabled:opacity-40"
        >
          {pending ? "Syncing…" : "Sync fixtures + teams"}
        </button>
        <button
          onClick={() => run("/api/admin/sync-results", "results")}
          disabled={pending}
          className="rounded-full border border-outline-variant/60 bg-surface-low px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface hover:bg-surface-high disabled:opacity-40"
        >
          {pending ? "Syncing…" : "Sync results only"}
        </button>
      </div>

      {report?.kind === "error" && (
        <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {report.message}
        </div>
      )}

      {report?.kind === "fixtures" && (
        <div className="space-y-3 rounded-lg border border-outline-variant/40 bg-surface-low p-4 text-sm">
          <div>
            <span className="font-bold uppercase text-primary">Teams</span> ·{" "}
            {report.data.teams.api_count} from API · inserted{" "}
            {report.data.teams.inserted} · linked {report.data.teams.linked} ·
            updated {report.data.teams.updated}
          </div>
          <div>
            <span className="font-bold uppercase text-primary">Matches</span> ·{" "}
            {report.data.matches.api_count} from API · inserted{" "}
            {report.data.matches.inserted} · updated{" "}
            {report.data.matches.updated}
            {report.data.matches.skipped.length > 0 && (
              <> · skipped {report.data.matches.skipped.length}</>
            )}
          </div>
          {report.data.teams.orphans.length > 0 && (
            <div>
              <div className="mb-1 font-bold uppercase text-error">
                Orphan teams ({report.data.teams.orphans.length})
              </div>
              <div className="text-xs text-on-surface-variant">
                Seeded teams the API doesn&apos;t list as WC 2026 qualifiers.
                Review and delete by hand if confirmed not playing.
              </div>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {report.data.teams.orphans.map((o) => (
                  <li key={o.id}>
                    {o.name}
                    {o.group_letter ? ` (was group ${o.group_letter})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {report?.kind === "results" && (
        <div className="rounded-lg border border-outline-variant/40 bg-surface-low p-4 text-sm">
          <div>
            <span className="font-bold uppercase text-primary">Results</span> ·{" "}
            {report.data.api_count} from API · updated {report.data.updated} ·
            unchanged {report.data.unchanged}
            {report.data.not_linked.length > 0 && (
              <> · {report.data.not_linked.length} not linked locally</>
            )}
          </div>
          {report.data.not_linked.length > 0 && (
            <div className="mt-2 text-xs text-on-surface-variant">
              Finished API fixtures with no matching <code>api_fixture_id</code>{" "}
              in our DB. Run &ldquo;Sync fixtures + teams&rdquo; first to link
              them.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
