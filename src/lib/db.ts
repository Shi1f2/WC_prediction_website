import postgres, { Sql } from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: Sql | undefined;
}

function makeClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
  });
}

function getClient(): Sql {
  if (globalThis.__sql) return globalThis.__sql;
  const client = makeClient();
  if (process.env.NODE_ENV !== "production") globalThis.__sql = client;
  return client;
}

function scrubSecrets(input: string): string {
  const url = process.env.DATABASE_URL;
  if (!url) return input;
  let host = "";
  let password = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    password = u.password;
  } catch {}
  let out = input.split(url).join("<db-url>");
  if (password) out = out.split(password).join("<db-password>");
  if (host) out = out.split(host).join("<db-host>");
  return out;
}

function rethrowScrubbed(err: unknown): never {
  if (err instanceof Error) {
    err.message = scrubSecrets(err.message);
    if (err.stack) err.stack = scrubSecrets(err.stack);
  }
  throw err;
}

function wrapPromise<T>(value: T): T {
  if (value && typeof (value as { then?: unknown }).then === "function") {
    return (value as unknown as Promise<unknown>).then(
      (v) => v,
      rethrowScrubbed,
    ) as unknown as T;
  }
  return value;
}

// Proxy target must be callable for sql`...` template-tag invocation to work
// (the `apply` trap only fires when the target itself is callable).
const sqlTarget = function () {} as unknown as Sql;

export const sql = new Proxy(sqlTarget, {
  apply(_t, _this, args: unknown[]) {
    const c = getClient() as unknown as (...a: unknown[]) => unknown;
    try {
      return wrapPromise(c(...args));
    } catch (e) {
      rethrowScrubbed(e);
    }
  },
  get(_t, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    if (typeof v !== "function") return v;
    const fn = (v as (...a: unknown[]) => unknown).bind(c);
    return (...args: unknown[]) => {
      try {
        return wrapPromise(fn(...args));
      } catch (e) {
        rethrowScrubbed(e);
      }
    };
  },
});
