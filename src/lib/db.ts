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

// Proxy target must be callable for sql`...` template-tag invocation to work
// (the `apply` trap only fires when the target itself is callable).
const sqlTarget = function () {} as unknown as Sql;

export const sql = new Proxy(sqlTarget, {
  apply(_t, _this, args: unknown[]) {
    const c = getClient() as unknown as (...a: unknown[]) => unknown;
    return c(...args);
  },
  get(_t, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
