"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>We hit an unexpected error. Please try again.</p>
        <button onClick={reset} style={{ marginTop: "1.5rem", padding: "0.5rem 1.5rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
