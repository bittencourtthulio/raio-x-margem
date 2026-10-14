import { Pool, type PoolClient } from "pg";
import { IntegrationError } from "./errors";
let pool: Pool | undefined;
export function getIntegrationPool() {
  if (!pool) {
    const connectionString = process.env.INTEGRATION_DATABASE_URL;
    if (!connectionString)
      throw new IntegrationError(
        503,
        "integration_unavailable",
        "A integração ainda não foi configurada.",
      );
    const url = new URL(connectionString);
    const remote = !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    // pg URL SSL parameters override the ssl object, including its trusted CA.
    if (remote) for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    pool = new Pool({
      connectionString: url.toString(),
      ...(remote ? { ssl: { rejectUnauthorized: true, ...(process.env.INTEGRATION_DATABASE_CA ? { ca: process.env.INTEGRATION_DATABASE_CA } : {}) } } : {}),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "raio-x-integration",
    });
    pool.on("error", () => {
      /* Connection errors are surfaced by requests without logging secrets. */
    });
  }
  return pool;
}
export async function closeIntegrationPool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getIntegrationPool().connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout = '15s'");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
