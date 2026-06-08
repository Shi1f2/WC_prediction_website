"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLink({
  href,
  children,
  accent,
}: {
  href: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive(pathname ?? "", href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`nav-link text-xs font-bold uppercase tracking-wider ${
        active ? "active" : ""
      } ${
        accent
          ? "text-secondary hover:brightness-110"
          : active
            ? "text-on-surface"
            : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      {children}
    </Link>
  );
}

export function MobileNavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = isActive(pathname ?? "", href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`mobile-nav-link relative flex flex-col items-center text-[10px] font-bold uppercase tracking-wider ${
        active
          ? "active text-secondary"
          : "text-on-surface-variant hover:text-secondary"
      }`}
    >
      {label}
    </Link>
  );
}
