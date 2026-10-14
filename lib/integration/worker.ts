import { randomUUID } from "node:crypto";
import { analyzeProducts } from "../analysis";
import { transaction, getIntegrationPool } from "./db";
import type { IntegrationProduct } from "./contracts";
import type { Scenario } from "../contracts";
export const WORKER_MAX_ATTEMPTS = 3;
export const WORKER_LEASE_SECONDS = 60;
export type ClaimedJob = {
  id: string;
  storeId: string;
  analysisId: string;
  leaseToken: string;
  attempts: number;
  snapshot: IntegrationProduct[];
  scenario: Scenario;
};
/** Lock store before job, matching every API/admin mutation, to avoid lock inversion. */
export async function claimJob(): Promise<ClaimedJob | null> {
  const candidates = await getIntegrationPool().query(
    `select id,store_id from integration.jobs where (status='queued' and available_at<=now()) or (status='running' and lease_until<now()) order by created_at,id limit 50`,
  );
  for (const candidate of candidates.rows) {
    const job = await transaction(async (c) => {
      const store = await c.query(
        "select id,disconnected_at from integration.stores where id=$1 for update skip locked",
        [candidate.store_id],
      );
      if (!store.rows[0]) return null;
      const selected = await c.query(
        `select * from integration.jobs where id=$1 and ((status='queued' and available_at<=now()) or (status='running' and lease_until<now())) for update skip locked`,
        [candidate.id],
      );
      const row = selected.rows[0];
      if (!row) return null;
      if (
        row.attempts >= WORKER_MAX_ATTEMPTS ||
        store.rows[0].disconnected_at
      ) {
        await c.query(
          "update integration.jobs set status='failed',completed_at=now(),lease_token=null,lease_until=null where id=$1",
          [row.id],
        );
        await c.query(
          "update integration.analyses set status='failed',error=$3,completed_at=now() where store_id=$1 and id=$2",
          [
            row.store_id,
            row.analysis_id,
            store.rows[0].disconnected_at
              ? "integration_disconnected"
              : "retry_exhausted",
          ],
        );
        return null;
      }
      const leaseToken = randomUUID();
      await c.query(
        "update integration.jobs set status='running',attempts=attempts+1,lease_token=$2,lease_until=now()+$3*interval '1 second' where id=$1",
        [row.id, leaseToken, WORKER_LEASE_SECONDS],
      );
      const result = await c.query(
        "update integration.analyses set status='running',error=null where store_id=$1 and id=$2 returning snapshot,scenario",
        [row.store_id, row.analysis_id],
      );
      return {
        id: row.id,
        storeId: row.store_id,
        analysisId: row.analysis_id,
        leaseToken,
        attempts: row.attempts + 1,
        snapshot: result.rows[0].snapshot,
        scenario: result.rows[0].scenario,
      } satisfies ClaimedJob;
    });
    if (job) return job;
  }
  return null;
}
export async function heartbeatJob(job: ClaimedJob) {
  const result = await getIntegrationPool().query(
    "update integration.jobs set lease_until=now()+$4*interval '1 second' where id=$1 and store_id=$2 and lease_token=$3 and status='running' and lease_until>now()",
    [job.id, job.storeId, job.leaseToken, WORKER_LEASE_SECONDS],
  );
  return result.rowCount === 1;
}
export async function completeJob(job: ClaimedJob) {
  // Stable input ordering gives deterministic ties without the CSV-only sourceRow contract.
  const ordered = [...job.snapshot].sort(
    (a, b) =>
      Buffer.compare(Buffer.from(a.externalId), Buffer.from(b.externalId)) ||
      Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)),
  );
  const calculated = analyzeProducts(
    ordered.map((p, index) => ({
      ...p,
      barcode: p.barcode ?? "",
      sourceRow: index,
    })),
    job.scenario,
    0,
  );
  const items = calculated.rows.map((row, index) => ({
    product: ordered[index],
    simulatedPriceCents: row.simulatedPriceCents,
    grossCents: row.grossCents,
    grossPercent: row.grossPercent,
    feeCents: row.feeCents,
    contributionCents: row.contributionCents,
    contributionPercent: row.contributionPercent,
    activeCents: row.activeCents,
    activePercent: row.activePercent,
  }));
  items.sort(
    (a, b) =>
      (a.activePercent === null
        ? b.activePercent === null
          ? 0
          : 1
        : b.activePercent === null
          ? -1
          : a.activePercent - b.activePercent) ||
      Buffer.compare(
        Buffer.from(a.product.externalId),
        Buffer.from(b.product.externalId),
      ) ||
      Buffer.compare(Buffer.from(a.product.id), Buffer.from(b.product.id)),
  );
  return transaction(async (c) => {
    const store = await c.query(
      "select id from integration.stores where id=$1 for update",
      [job.storeId],
    );
    if (!store.rows[0]) return false;
    const result = await c.query(
      "update integration.jobs set status='completed',completed_at=now(),lease_token=null,lease_until=null where id=$1 and store_id=$2 and lease_token=$3 and status='running' and lease_until>now() returning analysis_id",
      [job.id, job.storeId, job.leaseToken],
    );
    if (!result.rows[0]) return false;
    await c.query(
      "update integration.analyses set status='completed',summary=$3,items=$4,completed_at=now(),error=null where store_id=$1 and id=$2",
      [
        job.storeId,
        job.analysisId,
        JSON.stringify(calculated.summary),
        JSON.stringify(items),
      ],
    );
    return true;
  });
}
async function failJob(job: ClaimedJob) {
  return transaction(async (c) => {
    const store = await c.query(
      "select id from integration.stores where id=$1 for update",
      [job.storeId],
    );
    if (!store.rows[0]) return;
    const terminal = job.attempts >= WORKER_MAX_ATTEMPTS;
    const result = await c.query(
      "update integration.jobs set status=$4,lease_token=null,lease_until=null,available_at=now()+interval '10 seconds',completed_at=case when $4='failed' then now() else null end where id=$1 and store_id=$2 and lease_token=$3 and status='running' returning id",
      [job.id, job.storeId, job.leaseToken, terminal ? "failed" : "queued"],
    );
    if (result.rows[0])
      await c.query(
        "update integration.analyses set status=$3,error=$4,completed_at=case when $3='failed' then now() else null end where store_id=$1 and id=$2",
        [
          job.storeId,
          job.analysisId,
          terminal ? "failed" : "queued",
          terminal ? "calculation_failed" : null,
        ],
      );
  });
}
export async function runWorkerOnce(): Promise<boolean> {
  const job = await claimJob();
  if (!job) return false;
  const heartbeat = setInterval(() => {
    void heartbeatJob(job).catch(() => false);
  }, 20_000);
  try {
    await completeJob(job);
  } catch {
    await failJob(job);
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
/** Invoke periodically in the worker. Per-store lock keeps retention and reads consistent. */
export async function runRetentionCleanup() {
  const stores = await getIntegrationPool().query(
    "select id from integration.stores",
  );
  let deleted = 0;
  for (const store of stores.rows) {
    deleted += await transaction(async (c) => {
      const locked = await c.query(
        "select id from integration.stores where id=$1 for update skip locked",
        [store.id],
      );
      if (!locked.rows[0]) return 0;
      let count = 0;
      // Record the last removed revision so renewed cursors never conceal a retention gap.
      await c.query(
        "update integration.stores set feed_floor=greatest(feed_floor,coalesce((select max(revision) from integration.changes where store_id=$1 and created_at<now()-interval '90 days'),0)) where id=$1",
        [store.id],
      );
      const statements = [
        "delete from integration.changes where store_id=$1 and created_at<now()-interval '90 days'",
        "delete from integration.snapshots where store_id=$1 and expires_at<now()",
        "update integration.cursors set data='{}'::jsonb where store_id=$1 and expires_at<now() and data<>'{}'::jsonb",
        "delete from integration.cursors where store_id=$1 and expires_at<now()-interval '90 days'",
        "delete from integration.idempotency where store_id=$1 and expires_at<now()",
        "delete from integration.limits where store_id=$1 and window_start<now()-interval '2 days'",
        "delete from integration.audit where store_id=$1 and created_at<now()-interval '90 days'",
        "delete from integration.jobs where store_id=$1 and completed_at<now()-interval '7 days'",
        "delete from integration.analyses where store_id=$1 and created_at<now()-interval '90 days' and status in ('completed','failed')",
      ];
      for (const sql of statements)
        count += (await c.query(sql, [store.id])).rowCount ?? 0;
      return count;
    });
  }
  return { deleted };
}
