import './integration-env';
import { runWorkerOnce, runRetentionCleanup } from "../lib/integration/worker";
import { closeIntegrationPool } from "../lib/integration/db";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function main() {
  const once = process.argv.includes("--once");
  let cleanedAt = 0;
  do {
    try {
      if (Date.now() - cleanedAt > 60 * 60_000) {
        await runRetentionCleanup();
        cleanedAt = Date.now();
      }
      const worked = await runWorkerOnce();
      if (!worked && !once)
        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      console.error("Integration worker: database unavailable; retrying.");
      if (once) throw new Error("Worker unavailable.");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } while (!stopping && !once);
}
main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(closeIntegrationPool);
