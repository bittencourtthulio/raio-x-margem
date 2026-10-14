import './integration-env';
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  getIntegrationPool,
  closeIntegrationPool,
} from "../lib/integration/db";
async function main() {
  // Explicit CLI action only; application requests never mutate schema.
  const c = await getIntegrationPool().connect();
  try {
    await c.query("begin");
    await c.query(
      "select pg_advisory_xact_lock(hashtextextended('raio-x-integration-migrations',0))",
    );
    await c.query("create schema if not exists integration");
    await c.query("revoke all on schema integration from public");
    await c.query(
      "create table if not exists integration.schema_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())",
    );
    await c.query(
      "alter table integration.schema_migrations enable row level security",
    );
    for (const name of (await readdir("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`supabase/migrations/${name}`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await c.query(
        "select checksum from integration.schema_migrations where name=$1",
        [name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await c.query(sql);
      await c.query(
        "insert into integration.schema_migrations(name,checksum) values($1,$2)",
        [name, checksum],
      );
      console.log(`Applied ${name}`);
    }
    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
}
main()
  .catch(() => {
    console.error(
      "Migration failed; transaction rolled back. Check database connectivity and migration state.",
    );
    process.exitCode = 1;
  })
  .finally(closeIntegrationPool);
