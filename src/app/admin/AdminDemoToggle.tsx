"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COOKIE = "match_demo";

export default function AdminDemoToggle({ initial }: { initial: boolean }) {
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
        Show &ldquo;Demo Day&rdquo; preview on{" "}
        <code className="mono text-xs">/matches</code>{" "}
        <span className="text-on-surface-variant">(this browser only)</span>
      </span>
    </label>
  );
}
