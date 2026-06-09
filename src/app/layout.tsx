import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getCurrentUser, formatHandle } from "@/lib/auth";
import { NavLink, MobileNavLink } from "@/components/NavLink";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · 2026 FIFA World Cup Predictions`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "World Cup 2026",
    "FIFA World Cup",
    "world cup prediction",
    "world cup predictions",
    "prediction league",
    "football predictions",
    "soccer predictions",
    "bracket challenge",
    "fantasy football",
    "private league",
  ],
  authors: [{ name: SITE_NAME }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · 2026 FIFA World Cup Predictions`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · 2026 FIFA World Cup Predictions`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "sports",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en" className="dark">
      <body className="font-body bg-background text-on-background min-h-screen">
        <header className="fixed top-4 left-1/2 z-50 flex h-16 w-[calc(100%-2rem)] max-w-[1200px] -translate-x-1/2 items-center justify-between rounded-full border border-outline-variant/40 bg-surface-lowest px-6 shadow-floating">
          <Link href="/" className="display-italic text-xl uppercase tracking-tighter text-white">
            <span className="text-secondary">WC</span> Prediction League
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <NavLink href="/predict">Predict</NavLink>
            <NavLink href="/">Leagues</NavLink>
            {user && <NavLink href="/profile">Profile</NavLink>}
            {user?.is_admin && <NavLink href="/admin" accent>Admin</NavLink>}
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <form action="/api/auth/logout" method="post" className="flex items-center gap-3">
                <span className="hidden text-sm text-on-surface-variant sm:flex sm:flex-col sm:items-end sm:leading-tight">
                  <span>{user.display_name}</span>
                  <span className="mono text-[10px] text-on-surface-variant/70">
                    {formatHandle(user)}
                  </span>
                </span>
                <button className="rounded-full border border-outline-variant/40 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-high hover:text-on-surface">
                  Logout
                </button>
              </form>
            ) : (
              <>
                <Link
                  href="/login"
                  className="nav-link text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-on-surface"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-secondary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-on-secondary hover:bg-secondary hover:text-white hover:brightness-110"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-outline-variant/40 bg-surface-lowest px-4 md:hidden">
          <MobileNavLink href="/" label="Leagues" />
          <MobileNavLink href="/predict" label="Predict" />
          {user && <MobileNavLink href="/profile" label="Profile" />}
          {user?.is_admin && <MobileNavLink href="/admin" label="Admin" />}
        </nav>

        <main className="pitch-pattern relative min-h-screen px-6 pb-24 pt-28 sm:px-10">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
        <footer className="mx-auto max-w-[1440px] px-6 py-8 text-center text-xs text-on-background-variant/80 sm:px-10">
          Friends-only league · Predictions lock at kickoff
        </footer>
      </body>
    </html>
  );
}

