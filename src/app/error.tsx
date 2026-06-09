"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="display-italic text-3xl uppercase tracking-tighter text-white">
        Something went wrong
      </h1>
      <p className="mt-4 text-sm text-on-surface-variant">
        We hit an unexpected error. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-secondary px-6 py-2 text-xs font-bold uppercase tracking-wider text-on-secondary hover:brightness-110"
      >
        Try again
      </button>
    </div>
  );
}
