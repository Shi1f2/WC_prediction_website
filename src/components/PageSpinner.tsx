export default function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-on-background-variant">
      <span
        aria-hidden
        className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-current border-t-transparent text-secondary"
      />
      <span className="mono text-xs uppercase tracking-widest">{label}</span>
    </div>
  );
}
