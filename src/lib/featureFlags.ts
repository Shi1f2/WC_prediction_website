// Temporary feature flags. Keep this file small and revert-friendly — anything
// that lives here should be a short-lived testing toggle, not a long-lived
// configuration knob.

// When true, the chronologically first match (by kickoff_at) is open for
// predictions immediately, ignoring the normal 36h pre-kickoff window. The
// at-kickoff lock still applies. Flip back to `false` to restore normal
// behavior; nothing else needs to change.
export const FORCE_OPEN_FIRST_MATCH = true;
