"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COOKIE = "leaderboard_preview";

// Cookie-driven admin toggle that puts /board into a "tournament-ended"
// projection: every filled pick scores its max value, with per-group +X badges
// and a top-of-page summary of group + bracket points the user would bank.
export default function AdminLeaderboardPreviewToggle({
  initial,
}: {
  initial: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);

  function flip() {
    const next = !on;
    setOn(next);
    document.cookie = next
      ? `${COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
      : `${COOKIE}=; path=/; max-age=0; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={flip}
        className="h-4 w-4 rounded border-outline-variant/60 bg-surface-low text-secondary focus:ring-secondary"
      />
      <span>
        Preview <code className="mono text-xs">/board</code> as if the
        tournament <b>ended and every pick was correct</b> — shows projected
        group + bracket points{" "}
        <span className="text-on-surface-variant">(this browser only)</span>
      </span>
    </label>
  );
}
