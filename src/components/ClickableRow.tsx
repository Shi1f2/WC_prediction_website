"use client";

import { useRouter } from "next/navigation";

export default function ClickableRow({
  href,
  className = "",
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className={`cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-secondary ${className}`}
    >
      {children}
    </tr>
  );
}
