import './integration-env';
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createStore,
  createSource,
  issueCredential,
  deleteStoreData,
  getStoreDashboard,
  authenticateApiKey,
  NOTICE_VERSION,
} from "../lib/integration/repository";
import { closeIntegrationPool } from "../lib/integration/db";

const actor = { id: "sandbox-cli:local" };
const output = resolve(".data/integration-sandbox.json");
const loopback = (host: string) =>
  ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
type Configuration = {
  storeId: string;
  sourceId: string;
  secret: string;
  environment: "sandbox";
  apiBaseUrl: string;
};
async function main() {
  if (process.env.INTEGRATION_ENVIRONMENT !== "sandbox")
    throw new Error("Set INTEGRATION_ENVIRONMENT=sandbox explicitly.");
  const database = new URL(process.env.INTEGRATION_DATABASE_URL ?? "");
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !loopback(database.hostname)
  )
    throw new Error("Sandbox seed only supports a loopback Postgres host.");
  const apiBaseUrl =
    process.env.INTEGRATION_API_BASE_URL ?? "http://127.0.0.1:3000/api/v1";
  if (!loopback(new URL(apiBaseUrl).hostname))
    throw new Error("Sandbox seed only supports a loopback API host.");
  let previous: Configuration | undefined;
  try {
    previous = JSON.parse(await readFile(output, "utf8")) as Configuration;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        "Existing sandbox configuration is unreadable; inspect it locally.",
      );
  }
  if (previous) {
    if (previous.environment !== "sandbox")
      throw new Error("Existing configuration is not sandbox.");
    const dashboard = await getStoreDashboard(actor, previous.storeId);
    if (
      dashboard.store.environment !== "sandbox" ||
      dashboard.store.role !== "owner"
    )
      throw new Error("The local seed does not own this sandbox store.");
    if (process.argv.includes("--reset"))
      await deleteStoreData(actor, previous.storeId);
    else {
      await authenticateApiKey(previous.secret, "sandbox");
      await chmod(output, 0o600);
      console.log(`Sandbox already configured: ${output}`);
      return;
    }
  }
  const store = await createStore(actor, {
    name: "Loja fictícia — sandbox local",
  });
  const source = await createSource(actor, store.id, {
    name: "ERP fictício de testes",
    noticeVersion: NOTICE_VERSION,
    authorized: true,
  });
  const { secret } = await issueCredential(actor, store.id, {
    sourceId: source.id,
    label: "Conectores locais",
    scopes: [
      "products:read",
      "products:write",
      "analyses:read",
      "analyses:write",
    ],
  });
  const config: Configuration = {
    storeId: store.id,
    sourceId: source.id,
    secret,
    environment: "sandbox",
    apiBaseUrl,
  };
  await mkdir(resolve(".data"), { recursive: true, mode: 0o700 });
  await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(output, 0o600);
  console.log(`Sandbox ready: ${output}`);
  console.log(
    "Use only fictitious products. The API key was saved locally and was not printed.",
  );
}
main()
  .catch((error: unknown) => {
    // Only known preflight messages are safe to print. Database errors can include connection details.
    const safe =
      error instanceof Error &&
      /^(Set |Sandbox seed |Existing |The local seed )/.test(error.message);
    console.error(
      safe
        ? (error as Error).message
        : "Sandbox seed failed. Check the local database and migration state.",
    );
    process.exitCode = 1;
  })
  .finally(closeIntegrationPool);
