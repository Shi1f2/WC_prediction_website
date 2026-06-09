"use client";

import { useState } from "react";
import type { DailyPlayer, UserBet } from "@/lib/scoring";

function BetList({ bets, kind }: { bets: UserBet[]; kind: "winner" | "loser" }) {
  const sorted = [...bets].sort((a, b) =>
    kind === "winner" ? b.total_pts - a.total_pts : a.total_pts - b.total_pts
  );
  if (sorted.length === 0) {
    return (
      <p className="text-xs text-on-surface-variant">
        No graded predictions for this matchday.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {sorted.map((b) => (
        <li
          key={b.match_id}
          className="rounded-lg bg-surface-low/60 px-3 py-2 text-xs"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-bold text-on-surface">{b.label}</span>
            <span
              className={`mono shrink-0 font-bold ${
                b.total_pts > 0
                  ? "text-secondary"
                  : b.total_pts < 0
                  ? "text-error"
                  : "text-on-surface-variant"
              }`}
            >
              {b.total_pts >= 0 ? "+" : ""}
              {b.total_pts}
            </span>
          </div>
          <div className="mono mt-1 text-[10px] text-on-surface-variant">
            Picked{" "}
            <span className="text-on-surface">{b.prediction_score ?? "—"}</span>{" "}
            · actual <span className="text-on-surface">{b.actual_score}</span>
            {b.score_pts !== 0 && (
              <span
                className={`ml-1 ${
                  b.score_pts > 0 ? "text-secondary" : "text-error"
                }`}
              >
                ({b.score_pts >= 0 ? "+" : ""}
                {b.score_pts})
              </span>
            )}
          </div>
          {b.markets.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {b.markets.map((m, i) => (
                <li
                  key={i}
                  className="mono flex items-baseline justify-between text-[10px] text-on-surface-variant"
                >
                  <span>
                    {m.market_label}:{" "}
                    <span className="text-on-surface">{m.pick_label}</span>
                  </span>
                  <span
                    className={
                      m.pts > 0
                        ? "text-secondary"
                        : m.pts < 0
                        ? "text-error"
                        : ""
                    }
                  >
                    {m.pts >= 0 ? "+" : ""}
                    {m.pts}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function Card({
  kind,
  player,
  bets,
  open,
  onToggle,
}: {
  kind: "winner" | "loser";
  player: DailyPlayer;
  bets: UserBet[];
  open: boolean;
  onToggle: () => void;
}) {
  const isWinner = kind === "winner";
  const sorted = [...bets].sort((a, b) =>
    isWinner ? b.total_pts - a.total_pts : a.total_pts - b.total_pts
  );
  const headline = sorted[0];

  const accent = isWinner ? "text-secondary" : "text-error";
  const ring = isWinner
    ? "border-secondary/40 hover:border-secondary"
    : "border-error/40 hover:border-error";
  const banner = isWinner
    ? "bg-secondary/15 text-secondary"
    : "bg-error/15 text-error";

  return (
    <div
      className={`glass-card flex flex-col overflow-hidden rounded-2xl border transition-colors ${ring}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col text-left"
      >
        <div
          className={`flex items-center justify-between px-5 py-3 ${banner}`}
        >
          <span className="font-display text-2xl font-black italic uppercase tracking-tighter sm:text-3xl">
            {isWinner ? "Most won today" : "Most lost today"}
          </span>
          <span className="mono text-[10px] uppercase tracking-wider opacity-80">
            {open ? "Collapse ▴" : "Expand ▾"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-xl font-bold text-on-surface">
              {player.display_name}
            </div>
            <div className="mono truncate text-[10px] text-on-surface-variant">
              {player.username}#{player.discriminator}
            </div>
            {headline && (
              <div className="mt-2 truncate text-xs text-on-surface-variant">
                <span className="font-bold text-on-surface">
                  {headline.label}
                </span>
                {" · "}
                {headline.prediction_score
                  ? `${headline.prediction_score} vs ${headline.actual_score}`
                  : `result ${headline.actual_score}`}
                {" · "}
                <span className={`mono font-bold ${accent}`}>
                  {headline.total_pts >= 0 ? "+" : ""}
                  {headline.total_pts}
                </span>
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className={`mono text-3xl font-black ${accent}`}>
              {player.pts >= 0 ? `+${player.pts}` : player.pts}
            </div>
            <div className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              today&apos;s pts
            </div>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-outline-variant/30 px-5 py-4">
          <BetList bets={bets} kind={kind} />
        </div>
      )}
    </div>
  );
}

export default function PlayerBetsPair({
  date,
  winner,
  winnerBets,
  loser,
  loserBets,
}: {
  date: string | null;
  winner: DailyPlayer | null;
  winnerBets: UserBet[];
  loser: DailyPlayer | null;
  loserBets: UserBet[];
}) {
  const [open, setOpen] = useState(false);
  if (!winner) {
    return (
      <div className="mb-4 rounded-2xl border border-outline-variant/30 bg-surface-low/40 px-4 py-3 text-xs text-on-surface-variant">
        No graded matches yet — daily highlights appear here once a matchday
        wraps up.
      </div>
    );
  }
  const toggle = () => setOpen((o) => !o);
  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
        </span>
        <span className="mono text-[10px] font-bold uppercase tracking-wider text-error">
          Live · matchday {date}
        </span>
        <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          updates as results come in
        </span>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Card
          kind="winner"
          player={winner}
          bets={winnerBets}
          open={open}
          onToggle={toggle}
        />
        {loser && (
          <Card
            kind="loser"
            player={loser}
            bets={loserBets}
            open={open}
            onToggle={toggle}
          />
        )}
      </div>
    </div>
  );
}
