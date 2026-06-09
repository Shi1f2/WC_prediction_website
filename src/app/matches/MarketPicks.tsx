"use client";

import {
  MARKETS,
  type MarketDef,
  type MarketOption,
  correctPick,
} from "@/lib/markets";

type Props = {
  isFinal: boolean;
  actualA: number | null;
  actualB: number | null;
  teamA: string;
  teamB: string;
  picks: Record<string, string>;
  onChange?: (market: string, pick: string | null) => void;
  readOnly: boolean;
  hideIfEmpty?: boolean;
  // Combined-bet total to show in the header (exact-score + every market
  // pick). Computed in MatchRow because exact-score lives there. Null = hide.
  accumulated?: {
    total: number;
    exactPart: number | null;
    marketPart: number;
    isLive: boolean;
  } | null;
};

// Some option labels in the market catalog use the placeholder "A" / "B" for
// the two teams. Swap them in for the actual team names so picks read naturally
// (e.g. "Brazil by 2" instead of "A by 2").
function teamizeLabel(label: string, teamA: string, teamB: string): string {
  return label.replace(/\bA\b/g, teamA).replace(/\bB\b/g, teamB);
}

export default function MarketPicks({
  isFinal,
  actualA,
  actualB,
  teamA,
  teamB,
  picks,
  onChange,
  readOnly,
  hideIfEmpty = false,
  accumulated = null,
}: Props) {
  function togglePick(market: MarketDef, opt: MarketOption) {
    if (readOnly || !onChange) return;
    const current = picks[market.id];
    onChange(market.id, current === opt.value ? null : opt.value);
  }

  if (hideIfEmpty && Object.keys(picks).length === 0) return null;

  const totalSign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "0");

  return (
    <div className="mt-3 border-t border-outline-variant/20 pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        <span>
          Market bets · {readOnly ? "locked in" : "win or lose points"}
        </span>
        {accumulated && (
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`mono rounded-full px-2 py-0.5 ${
                accumulated.total > 0
                  ? accumulated.isLive
                    ? "bg-secondary/20 text-secondary"
                    : "bg-primary/20 text-primary"
                  : accumulated.total < 0
                    ? "bg-error/20 text-error"
                    : "bg-surface-high text-on-surface-variant"
              }`}
            >
              {totalSign(accumulated.total)} pts
              {accumulated.isLive ? " so far" : " total"}
            </span>
            <span className="mono normal-case text-on-surface-variant">
              score{" "}
              {accumulated.exactPart == null
                ? "—"
                : totalSign(accumulated.exactPart)}
              {" · "}
              markets {totalSign(accumulated.marketPart)}
            </span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        {MARKETS.map((market) => {
          const chosen = picks[market.id];
          const winner =
            isFinal && actualA != null && actualB != null
              ? correctPick(market.id, actualA, actualB)
              : null;
          return (
            <div
              key={market.id}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3"
            >
              <span
                title={market.label}
                className="mono shrink-0 text-[11px] uppercase tracking-wider text-on-surface-variant sm:w-24 sm:pt-1.5"
              >
                {market.short}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {market.options.map((opt) => {
                  const isPicked = chosen === opt.value;
                  const isWinner = winner === opt.value;
                  const isLoser =
                    isFinal && isPicked && winner != null && winner !== opt.value;
                  const dimmed = readOnly && !isPicked;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => togglePick(market, opt)}
                      disabled={readOnly}
                      title={`${opt.label} — win +${opt.points} / lose −${opt.points}`}
                      className={`mono inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                        isPicked
                          ? isLoser
                            ? "border-error/60 bg-error/15 text-error"
                            : isWinner
                              ? "border-primary/60 bg-primary/20 text-primary"
                              : "border-secondary bg-secondary/20 text-secondary"
                          : "border-outline-variant/40 text-on-surface-variant hover:border-secondary/50 hover:text-on-surface"
                      } ${dimmed ? "opacity-40" : ""} disabled:cursor-default`}
                    >
                      <span>{teamizeLabel(opt.label, teamA, teamB)}</span>
                      {isFinal && isPicked ? (
                        // On finalized matches, the picked pill shows the
                        // actual gain/loss — colors already carry win/lose.
                        <>
                          <span className="opacity-50">·</span>
                          <span className="font-extrabold">
                            {isWinner ? `+${opt.points}` : `−${opt.points}`}
                          </span>
                        </>
                      ) : readOnly ? (
                        // Locked-in but match not finished yet: no numbers on
                        // unpicked pills — they're reference only.
                        isPicked ? (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="text-primary/90">+{opt.points}</span>
                            <span className="opacity-40">/</span>
                            <span className="text-error/90">−{opt.points}</span>
                          </>
                        ) : null
                      ) : (
                        // Editing mode: show stake on every pill so the user
                        // can compare options before clicking.
                        <>
                          <span className="opacity-50">·</span>
                          <span className="text-primary/90">+{opt.points}</span>
                          <span className="opacity-40">/</span>
                          <span className="text-error/90">−{opt.points}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
