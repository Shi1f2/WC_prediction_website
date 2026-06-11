// Global floor for when the board (group picks + bracket) is allowed to lock.
// While `Date.now() < BOARD_OPEN_UNTIL_MS`, group/bracket locks driven by
// kickoff_at are overridden so users can still edit. Past this point, the
// natural per-match kickoff locks apply.
//
// 2026-06-14 00:00:00 +03:00 (Turkey time) === 2026-06-13 21:00:00 UTC.
export const BOARD_OPEN_UNTIL_MS = Date.UTC(2026, 5, 13, 21, 0, 0);

// Returns the effective lock time given a natural (kickoff-based) lock time.
// `null` natural lock stays `null`. Otherwise the lock is delayed to at least
// the global floor.
export function effectiveLockAtMs(naturalMs: number | null): number | null {
  if (naturalMs == null) return null;
  return Math.max(naturalMs, BOARD_OPEN_UNTIL_MS);
}

export function isBoardCurrentlyLockable(): boolean {
  return Date.now() >= BOARD_OPEN_UNTIL_MS;
}
