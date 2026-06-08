import { redirect } from "next/navigation";
import { signup, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignupPage({
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
    const displayName = String(formData.get("display_name") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signup(username, displayName, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Signup failed";
      redirect(`/signup?error=${encodeURIComponent(msg)}`);
    }
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display-italic mb-2 text-center text-4xl uppercase">
        Create <span className="text-secondary">account</span>
      </h1>
      <p className="mb-6 text-center text-on-background-variant">
        Join your friends&apos; league.
      </p>
      <div className="glass-card rounded-2xl border border-outline-variant/30 p-6">
        {sp.error && (
          <p className="mb-4 rounded-lg bg-error/15 px-3 py-2 text-sm text-error">
            {sp.error}
          </p>
        )}
        <form action={action} className="space-y-4">
          <Field label="Username" name="username" autoComplete="username" required />
          <Field label="Display name" name="display_name" />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <button className="w-full rounded-full bg-secondary py-3 text-sm font-bold uppercase tracking-wider text-on-secondary shadow-glow hover:brightness-110">
            Sign up
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-on-surface-variant">
          Already have an account?{" "}
          <a className="font-bold text-secondary" href="/login">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-wider text-on-surface-variant">
        {props.label}
      </span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        autoComplete={props.autoComplete}
        className="mt-1 block w-full rounded-lg border border-outline-variant/40 bg-surface-low px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
      />
    </label>
  );
}
