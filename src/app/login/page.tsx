import { redirect } from "next/navigation";
import { login, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const u = await getCurrentUser();
  if (u) redirect("/");
  const sp = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await login(username, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      redirect(`/login?error=${encodeURIComponent(msg)}`);
    }
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display-italic mb-2 text-center text-4xl uppercase">
        Welcome <span className="text-secondary">back</span>
      </h1>
      <p className="mb-6 text-center text-on-background-variant">
        Log in to continue your run for glory.
      </p>
      <div className="glass-card rounded-2xl border border-outline-variant/30 p-6">
        {sp.error && (
          <p className="mb-4 rounded-lg bg-error/15 px-3 py-2 text-sm text-error">
            {sp.error}
          </p>
        )}
        <form action={action} className="space-y-4">
          <label className="block">
            <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              Username
            </span>
            <input
              name="username"
              required
              autoComplete="username"
              className="mt-1 block w-full rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              Password
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            />
          </label>
          <button className="w-full rounded-full bg-secondary py-3 text-sm font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110">
            Log in
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-on-surface-variant">
          No account?{" "}
          <a className="font-bold text-secondary" href="/signup">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
