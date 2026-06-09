"use client";

import { useEffect, useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0m";
  const d = Math.floor(ms / DAY_MS);
  const h = Math.floor((ms % DAY_MS) / HOUR_MS);
  const m = Math.floor((ms % HOUR_MS) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function LockCountdown({
  lockAt,
  locked,
  prefix = "Locks in",
  className,
}: {
  lockAt: string | null;
  locked: boolean;
  prefix?: string;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!lockAt || now === null) return null;
  const deadline = new Date(lockAt).getTime();
  const past = locked || now >= deadline;
  if (past) {
    return (
      <span
        className={
          className ??
          "mono rounded-full bg-surface-high px-2 py-0.5 text-[10px] uppercase tracking-wider text-on-surface-variant"
        }
      >
        Locked
      </span>
    );
  }
  const remaining = deadline - now;
  const urgent = remaining < HOUR_MS;
  return (
    <span
      title={`Kickoff ${new Date(deadline).toLocaleString()}`}
      className={
        className ??
        `mono rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
          urgent ? "bg-error/15 text-error" : "bg-secondary/15 text-secondary"
        }`
      }
    >
      {prefix} {formatRemaining(remaining)}
    </span>
  );
}
