"use client";

import {
  MARKETS,
  type MarketDef,
  type MarketOption,
  correctPick,
  gradeMarket,
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
}: Props) {
  function togglePick(market: MarketDef, opt: MarketOption) {
    if (readOnly || !onChange) return;
    const current = picks[market.id];
    onChange(market.id, current === opt.value ? null : opt.value);
  }

  // Total points earned from market picks for this match (final results only).
  const earnedTotal =
    isFinal && actualA != null && actualB != null
      ? Object.entries(picks).reduce(
          (sum, [m, p]) => sum + gradeMarket(m, p, actualA, actualB),
          0,
        )
      : null;

  if (hideIfEmpty && Object.keys(picks).length === 0) return null;

  return (
    <div className="mt-3 border-t border-outline-variant/20 pt-3">
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        <span>
          Extra picks · {readOnly ? "locked in" : "win or lose points"}
        </span>
        {earnedTotal != null && (
          <span
            className={`mono rounded-full px-2 py-0.5 ${
              earnedTotal > 0
                ? "bg-secondary/20 text-secondary"
                : earnedTotal < 0
                  ? "bg-error/20 text-error"
                  : "bg-surface-high text-on-surface-variant"
            }`}
          >
            {earnedTotal > 0
              ? `+${earnedTotal} bonus`
              : earnedTotal < 0
                ? `${earnedTotal} bonus`
                : "0 bonus"}
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
                  const dimmed = readOnly && !isPicked && !(isFinal && isWinner);
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
                          : isFinal && isWinner
                            ? "border-primary/40 bg-primary/5 text-primary/80"
                            : "border-outline-variant/40 text-on-surface-variant hover:border-secondary/50 hover:text-on-surface"
                      } ${dimmed ? "opacity-40" : ""} disabled:cursor-default`}
                    >
                      <span>{teamizeLabel(opt.label, teamA, teamB)}</span>
                      <span className="opacity-50">·</span>
                      <span className="text-primary/90">+{opt.points}</span>
                      <span className="opacity-40">/</span>
                      <span className="text-error/90">−{opt.points}</span>
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
