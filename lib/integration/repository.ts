import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { transaction, getIntegrationPool } from "./db";
import { IntegrationError } from "./errors";
import {
  analysisRequestSchema,
  productBatchSchema,
  paginationQuerySchema,
  scopeSchema,
  LIMITS,
  type IntegrationProduct,
  type IntegrationScope,
} from "./contracts";
export { IntegrationError } from "./errors";
export const NOTICE_VERSION = "2026-10-14-integration-v1";
export const CALCULATION_VERSION = "margin-v1";
export type Actor = { id: string };
export type Environment = "sandbox" | "production";
export type ApiPrincipal = {
  credentialId: string;
  storeId: string;
  sourceId: string;
  environment: Environment;
  scopes: IntegrationScope[];
  tokenHash: string;
};
type Page = { limit?: number; cursor?: string };
type Row = Record<string, any>; // PostgreSQL rows are mapped at this backend boundary.
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): string =>
  JSON.stringify(value, function (_key, v) {
    return v && typeof v === "object" && !Array.isArray(v)
      ? Object.keys(v)
          .sort()
          .reduce((acc, k) => ({ ...acc, [k]: v[k] }), {})
      : v;
  });
const iso = (value: Date | string) => new Date(value).toISOString();
const notFound = () =>
  new IntegrationError(404, "not_found", "Recurso não encontrado.");
const uuid = (id: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw notFound();
  return id;
};
export function integrationEnvironment(): Environment {
  const env = process.env.INTEGRATION_ENVIRONMENT;
  if (env === "production" || env === "sandbox") return env;
  if (process.env.NODE_ENV === "production")
    throw new IntegrationError(
      503,
      "integration_unavailable",
      "Ambiente da integração não configurado.",
    );
  return "sandbox";
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new IntegrationError(
      422,
      "validation_error",
      "Verifique os campos informados.",
      parsed.error.issues.map((i) => ({
        index: typeof i.path[1] === "number" ? i.path[1] : undefined,
        field: i.path.join("."),
        reason: i.message,
      })),
    );
  return parsed.data;
}
function keyCheck(key: string) {
  if (!key || key.length > 200 || !/^[\x21-\x7E]{1,200}$/.test(key))
    throw new IntegrationError(
      400,
      "invalid_idempotency_key",
      "Informe Idempotency-Key com 1 a 200 caracteres ASCII visíveis.",
    );
}
async function audit(
  c: PoolClient,
  store: string,
  actor: string,
  action: string,
  resource?: string,
) {
  await c.query(
    "insert into integration.audit(id,store_id,actor_id,action,resource_id) values($1,$2,$3,$4,$5)",
    [randomUUID(), store, actor, action, resource ?? null],
  );
}
async function credential(
  c: PoolClient,
  p: ApiPrincipal,
  store: string,
  scope?: IntegrationScope,
) {
  if (store !== p.storeId) throw notFound();
  const { rows } = await c.query(
    `select c.*,s.environment from integration.credentials c join integration.sources src on (src.store_id=c.store_id and src.id=c.source_id) join integration.stores s on s.id=c.store_id where c.id=$1 and c.store_id=$2 and c.token_hash=$3 and c.revoked_at is null and c.expires_at>clock_timestamp() and src.active and s.disconnected_at is null and s.environment=$4`,
    [p.credentialId, store, p.tokenHash, p.environment],
  );
  if (!rows[0])
    throw new IntegrationError(
      401,
      "invalid_api_key",
      "Credencial inválida, expirada ou revogada.",
    );
  if (scope && !rows[0].scopes.includes(scope))
    throw new IntegrationError(
      403,
      "insufficient_scope",
      "Credencial sem o escopo necessário.",
    );
  return rows[0];
}
async function lockStore(c: PoolClient, id: string) {
  const { rows } = await c.query(
    "select * from integration.stores where id=$1 for update",
    [uuid(id)],
  );
  if (!rows[0]) throw notFound();
  return rows[0];
}
async function apiTx<T>(
  p: ApiPrincipal,
  store: string,
  scope: IntegrationScope | undefined,
  fn: (c: PoolClient, s: Row) => Promise<T>,
) {
  if (store !== p.storeId) throw notFound();
  return transaction(async (c) => {
    const s = await lockStore(c, store);
    await credential(c, p, store, scope);
    return fn(c, s);
  });
}
async function quota(
  c: PoolClient,
  store: string,
  bucket: string,
  max: number,
  seconds: number,
) {
  const { rows } = await c.query(
    `insert into integration.limits(store_id,bucket,window_start,count) values($1,$2,to_timestamp(floor(extract(epoch from clock_timestamp())/$3)*$3),1) on conflict(store_id,bucket,window_start) do update set count=integration.limits.count+1 returning count, extract(epoch from (window_start + $3 * interval '1 second' - clock_timestamp())) as retry`,
    [store, bucket, seconds],
  );
  if (rows[0].count > max)
    throw new IntegrationError(
      429,
      "rate_limit_exceeded",
      "Limite compartilhado da loja atingido.",
      undefined,
      Math.max(1, Math.ceil(Number(rows[0].retry))),
    );
}
async function reading<T>(
  p: ApiPrincipal,
  store: string,
  scope: IntegrationScope | undefined,
  fn: (c: PoolClient, s: Row) => Promise<T>,
) {
  return apiTx(p, store, scope, async (c, s) => {
    await quota(c, store, "reads", LIMITS.readsPerMinute, 60);
    return fn(c, s);
  });
}
export async function authenticateApiKey(
  token: string,
  environment: Environment = integrationEnvironment(),
): Promise<ApiPrincipal> {
  if (!/^rx_(sandbox|production)_[A-Za-z0-9_-]{43}$/.test(token))
    throw new IntegrationError(
      401,
      "invalid_api_key",
      "Credencial inválida, expirada ou revogada.",
    );
  const tokenHash = hash(token);
  const { rows } = await getIntegrationPool().query(
    `select c.id,c.store_id,c.source_id,c.scopes,s.environment from integration.credentials c join integration.sources src on(src.store_id=c.store_id and src.id=c.source_id) join integration.stores s on s.id=c.store_id where c.token_hash=$1 and c.revoked_at is null and c.expires_at>clock_timestamp() and src.active and s.disconnected_at is null and s.environment=$2`,
    [tokenHash, environment],
  );
  if (!rows[0])
    throw new IntegrationError(
      401,
      "invalid_api_key",
      "Credencial inválida, expirada ou revogada.",
    );
  const r = rows[0];
  return {
    credentialId: r.id,
    storeId: r.store_id,
    sourceId: r.source_id,
    environment: r.environment,
    scopes: r.scopes,
    tokenHash,
  };
}
export function getMe(p: ApiPrincipal) {
  return reading(p, p.storeId, undefined, async (c) => {
    const row = await credential(c, p, p.storeId);
    return {
      storeId: p.storeId,
      sourceId: p.sourceId,
      environment: p.environment,
      scopes: row.scopes,
      limits: LIMITS,
    };
  });
}
async function idempotent<T>(
  p: ApiPrincipal,
  store: string,
  scope: IntegrationScope,
  operation: string,
  body: unknown,
  key: string,
  fn: (c: PoolClient, s: Row) => Promise<T>,
): Promise<T> {
  keyCheck(key);
  if (store !== p.storeId) throw notFound();
  return transaction(async (c) => {
    const lock = await c.query(
      "select pg_try_advisory_xact_lock(hashtextextended($1,0)) as acquired",
      [`${store}:${p.sourceId}:${operation}:${key}`],
    );
    if (!lock.rows[0].acquired)
      throw new IntegrationError(
        409,
        "idempotency_in_progress",
        "Operação em andamento; repita após aguardar.",
        undefined,
        1,
      );
    const s = await lockStore(c, store);
    await credential(c, p, store, scope);
    const args = [store, p.sourceId, operation, key];
    await c.query(
      "delete from integration.idempotency where store_id=$1 and source_id=$2 and operation=$3 and key=$4 and expires_at<=clock_timestamp()",
      args,
    );
    const existing = await c.query(
      "select body_hash,response from integration.idempotency where store_id=$1 and source_id=$2 and operation=$3 and key=$4",
      args,
    );
    const bodyHash = hash(canonical(body));
    if (existing.rows[0]) {
      if (existing.rows[0].body_hash !== bodyHash)
        throw new IntegrationError(
          409,
          "idempotency_conflict",
          "Chave de idempotência já utilizada com outro conteúdo.",
        );
      return existing.rows[0].response as T;
    }
    const response = await fn(c, s);
    await c.query(
      "insert into integration.idempotency(store_id,source_id,operation,key,body_hash,response) values($1,$2,$3,$4,$5,$6)",
      [...args, bodyHash, JSON.stringify(response)],
    );
    return response;
  });
}
export function applyProductBatch(
  p: ApiPrincipal,
  store: string,
  body: unknown,
  key: string,
) {
  const input = parse(productBatchSchema, body);
  input.products.forEach((v) => {
    v.sourceUpdatedAt = v.sourceUpdatedAt ?? null;
  });
  return idempotent(
    p,
    store,
    "products:write",
    "POST/product-batches",
    input,
    key,
    async (c, s) => {
      await quota(c, store, "batches", LIMITS.batchesPerMinute, 60);
      const current = await c.query(
        "select * from integration.products where store_id=$1",
        [store],
      );
      const byExternal = new Map<string, Row>(
        current.rows
          .filter((r) => r.source_id === p.sourceId)
          .map((r) => [r.external_id, r]),
      );
      const all = new Map<string, IntegrationProduct>(
        current.rows.map((r) => [r.id, r.data]),
      );
      const changed = new Set<string>();
      const statuses = new Map<string, string>();
      const now = new Date().toISOString();
      for (const [index, v] of input.products.entries()) {
        const prev = byExternal.get(v.externalId);
        if (
          prev &&
          (v.sourceVersion < Number(prev.source_version) ||
            (v.sourceVersion === Number(prev.source_version) &&
              canonical(prev.input) !== canonical(v)))
        )
          throw new IntegrationError(
            409,
            "source_version_conflict",
            "Versão da origem antiga ou conflitante.",
            [
              {
                index,
                field: "sourceVersion",
                reason: "Envie versão maior para conteúdo alterado.",
              },
            ],
          );
        if (prev && v.sourceVersion === Number(prev.source_version)) {
          statuses.set(v.externalId, "unchanged");
          continue;
        }
        const id = prev?.id ?? randomUUID();
        all.set(id, {
          ...v,
          id,
          storeId: store,
          sourceId: p.sourceId,
          revision: 0,
          createdAt: prev?.data.createdAt ?? now,
          updatedAt: now,
          alerts: [],
        });
        changed.add(id);
        statuses.set(v.externalId, prev ? "updated" : "created");
      }
      if (
        [...all.values()].filter((v) => v.active).length > LIMITS.activeProducts
      )
        throw new IntegrationError(
          422,
          "active_product_limit",
          "A loja excederia o limite de produtos ativos.",
        );
      const barcodes = new Map<string, number>();
      for (const v of all.values())
        if (v.barcode)
          barcodes.set(v.barcode, (barcodes.get(v.barcode) ?? 0) + 1);
      let revision = Number(s.revision);
      const writes: Row[] = [];
      const changes: Row[] = [];
      for (const v of all.values()) {
        const alerts = [];
        if (v.purchaseCostCents === 0)
          alerts.push("Custo zero: confira se o custo foi informado.");
        if (v.purchaseCostCents > v.salePriceCents)
          alerts.push("Custo maior que o preço de venda.");
        if (v.barcode && (barcodes.get(v.barcode) ?? 0) > 1)
          alerts.push("Código de barras duplicado no catálogo.");
        if (canonical(alerts) !== canonical(v.alerts)) {
          v.alerts = alerts;
          changed.add(v.id);
        }
        if (!changed.has(v.id)) continue;
        if (revision >= Number.MAX_SAFE_INTEGER)
          throw new IntegrationError(
            503,
            "revision_exhausted",
            "Revisão do catálogo indisponível.",
          );
        v.revision = ++revision;
        v.updatedAt = now;
        const normalized = {
          externalId: v.externalId,
          sourceVersion: v.sourceVersion,
          name: v.name,
          barcode: v.barcode,
          purchaseCostCents: v.purchaseCostCents,
          salePriceCents: v.salePriceCents,
          active: v.active,
          sourceUpdatedAt: v.sourceUpdatedAt ?? null,
        };
        writes.push({
          id: v.id,
          source_id: v.sourceId,
          external_id: v.externalId,
          source_version: v.sourceVersion,
          revision: v.revision,
          active: v.active,
          barcode: v.barcode,
          input: normalized,
          data: v,
        });
        changes.push({
          revision: v.revision,
          data: {
            productId: v.id,
            externalId: v.externalId,
            sourceVersion: v.sourceVersion,
            revision: v.revision,
            operation: v.active ? "upsert" : "deactivate",
            changedAt: now,
            product: v,
          },
        });
      }
      if (writes.length) {
        await c.query(
          `insert into integration.products(id,store_id,source_id,external_id,source_version,revision,active,barcode,input,data)
        select w.id,$1::uuid,w.source_id,w.external_id,w.source_version,w.revision,w.active,w.barcode,w.input,w.data
        from jsonb_to_recordset($2::jsonb) as w(id uuid,source_id uuid,external_id text,source_version bigint,revision bigint,active boolean,barcode text,input jsonb,data jsonb)
        on conflict(store_id,source_id,external_id) do update set source_version=excluded.source_version,revision=excluded.revision,active=excluded.active,barcode=excluded.barcode,input=excluded.input,data=excluded.data`,
          [store, JSON.stringify(writes)],
        );
        await c.query(
          `insert into integration.changes(store_id,revision,data)
        select $1::uuid,w.revision,w.data from jsonb_to_recordset($2::jsonb) as w(revision bigint,data jsonb)`,
          [store, JSON.stringify(changes)],
        );
      }
      await c.query("update integration.stores set revision=$2 where id=$1", [
        store,
        revision,
      ]);
      await audit(c, store, p.credentialId, "product_batch");
      const output = [...all.values()].filter((v) => v.sourceId === p.sourceId);
      return {
        data: input.products.map((v) => {
          const result = output.find((r) => r.externalId === v.externalId)!;
          return {
            externalId: v.externalId,
            id: result.id,
            status: statuses.get(v.externalId),
            sourceVersion: result.sourceVersion,
            revision: result.revision,
          };
        }),
      };
    },
  );
}
async function makeCursor(
  c: PoolClient,
  p: ApiPrincipal,
  kind: string,
  data: unknown,
  expires: Date,
) {
  const token = `${new Date(expires).getTime()}.${randomBytes(32).toString("base64url")}`;
  await c.query(
    "insert into integration.cursors(token_hash,store_id,environment,kind,data,expires_at) values($1,$2,$3,$4,$5,$6)",
    [
      hash(token),
      p.storeId,
      p.environment,
      kind,
      JSON.stringify(data),
      expires,
    ],
  );
  return token;
}
async function readCursor(
  c: PoolClient,
  p: ApiPrincipal,
  kind: string,
  token: string,
) {
  const { rows } = await c.query(
    "select * from integration.cursors where token_hash=$1",
    [hash(token)],
  );
  const r = rows[0];
  const expired = () =>
    new IntegrationError(
      410,
      kind === "changes" ? "sync_cursor_expired" : "snapshot_expired",
      "Cursor expirado; reinicie o bootstrap.",
    );
  if (!r) {
    // The public expiry hint only classifies a missing cursor; it never authorizes a read.
    const match = /^(\d{13})\.[A-Za-z0-9_-]{43}$/.exec(token);
    if (match && Number(match[1]) <= Date.now()) throw expired();
    throw new IntegrationError(
      400,
      "invalid_cursor",
      "Cursor inválido para esta consulta.",
    );
  }
  if (
    r.store_id !== p.storeId ||
    r.environment !== p.environment ||
    r.kind !== kind
  )
    throw new IntegrationError(
      400,
      "invalid_cursor",
      "Cursor inválido para esta consulta.",
    );
  if (new Date(r.expires_at).getTime() <= Date.now()) throw expired();
  return r;
}
export function listProducts(p: ApiPrincipal, store: string, page: Page = {}) {
  const { limit, cursor } = parse(paginationQuerySchema, page);
  return reading(p, store, "products:read", async (c, s) => {
    let snapshot: Row;
    let offset = 0;
    if (cursor) {
      const r = await readCursor(c, p, "products", cursor);
      offset = r.data.offset;
      const result = await c.query(
        "select * from integration.snapshots where id=$1 and store_id=$2 and expires_at>clock_timestamp()",
        [r.data.snapshotId, store],
      );
      if (!result.rows[0])
        throw new IntegrationError(
          410,
          "snapshot_expired",
          "Snapshot expirado; reinicie o bootstrap.",
        );
      snapshot = result.rows[0];
    } else {
      const { rows } = await c.query(
        'select data from integration.products where store_id=$1 order by external_id collate "C",id',
        [store],
      );
      const id = randomUUID();
      const expires = new Date(Date.now() + 30 * 60_000);
      const result = await c.query(
        "insert into integration.snapshots(id,store_id,revision,data,expires_at) values($1,$2,$3,$4,$5) returning *",
        [
          id,
          store,
          s.revision,
          JSON.stringify(rows.map((r) => r.data)),
          expires,
        ],
      );
      snapshot = result.rows[0];
    }
    const data = snapshot.data.slice(offset, offset + limit);
    const nextCursor =
      offset + limit < snapshot.data.length
        ? await makeCursor(
            c,
            p,
            "products",
            { snapshotId: snapshot.id, offset: offset + limit },
            snapshot.expires_at,
          )
        : null;
    const changesCursor = await makeCursor(
      c,
      p,
      "changes",
      { revision: Number(snapshot.revision) },
      new Date(Date.now() + 90 * 86400_000),
    );
    return {
      data,
      snapshotId: snapshot.id,
      asOfRevision: Number(snapshot.revision),
      nextCursor,
      changesCursor,
    };
  });
}
export function getProduct(p: ApiPrincipal, store: string, id: string) {
  uuid(id);
  return reading(p, store, "products:read", async (c) => {
    const { rows } = await c.query(
      "select data from integration.products where store_id=$1 and id=$2",
      [store, id],
    );
    if (!rows[0]) throw notFound();
    return rows[0].data;
  });
}
export function listProductChanges(
  p: ApiPrincipal,
  store: string,
  page: Page = {},
) {
  const { limit, cursor } = parse(paginationQuerySchema, page);
  if (!cursor)
    throw new IntegrationError(
      400,
      "cursor_required",
      "Use changesCursor retornado pelo bootstrap.",
    );
  return reading(p, store, "products:read", async (c, s) => {
    const r = await readCursor(c, p, "changes", cursor);
    if (r.data.revision < Number(s.feed_floor))
      throw new IntegrationError(
        410,
        "sync_cursor_expired",
        "Cursor expirado; reinicie o bootstrap.",
      );
    const { rows } = await c.query(
      "select data from integration.changes where store_id=$1 and revision>$2 order by revision limit $3",
      [store, r.data.revision, limit + 1],
    );
    const data = rows.slice(0, limit).map((v) => v.data);
    const revision = data.at(-1)?.revision ?? r.data.revision;
    const changesCursor = await makeCursor(
      c,
      p,
      "changes",
      { revision },
      new Date(Date.now() + 90 * 86400_000),
    );
    return {
      data,
      nextCursor: rows.length > limit ? changesCursor : null,
      changesCursor,
    };
  });
}
function analysisRecord(r: Row) {
  return {
    id: r.id,
    storeId: r.store_id,
    status: r.status,
    scenario: r.scenario,
    catalogRevision: Number(r.catalog_revision),
    calculationVersion: r.calculation_version,
    createdAt: iso(r.created_at),
    completedAt: r.completed_at ? iso(r.completed_at) : null,
    summary: r.summary,
    error: r.error ?? null,
  };
}
export function createAnalysis(
  p: ApiPrincipal,
  store: string,
  body: unknown,
  key: string,
) {
  const input = parse(analysisRequestSchema, body);
  return idempotent(
    p,
    store,
    "analyses:write",
    "POST/analyses",
    input,
    key,
    async (c, s) => {
      await quota(c, store, "analysis-hour", LIMITS.analysesPerHour, 3600);
      await quota(c, store, "analysis-day", LIMITS.analysesPerDay, 86400);
      const { rows } = await c.query(
        'select data from integration.products where store_id=$1 and active order by external_id collate "C",id',
        [store],
      );
      if (!rows.length)
        throw new IntegrationError(
          422,
          "empty_catalog",
          "O catálogo não tem produtos ativos.",
        );
      const id = randomUUID();
      await c.query(
        `insert into integration.analyses(id,store_id,source_id,status,scenario,catalog_revision,calculation_version,snapshot) values($1,$2,$3,'queued',$4,$5,$6,$7)`,
        [
          id,
          store,
          p.sourceId,
          JSON.stringify(input.scenario),
          s.revision,
          CALCULATION_VERSION,
          JSON.stringify(rows.map((r) => r.data)),
        ],
      );
      await c.query(
        "insert into integration.jobs(id,store_id,analysis_id,status) values($1,$2,$3,'queued')",
        [randomUUID(), store, id],
      );
      await audit(c, store, p.credentialId, "analysis_requested", id);
      return {
        analysisId: id,
        status: "queued" as const,
        url: `/api/v1/stores/${store}/analyses/${id}`,
      };
    },
  );
}
export function listAnalyses(p: ApiPrincipal, store: string, page: Page = {}) {
  const { limit, cursor } = parse(paginationQuerySchema, page);
  return reading(p, store, "analyses:read", async (c) => {
    const after = cursor
      ? (await readCursor(c, p, "analyses", cursor)).data
      : null;
    const { rows } = await c.query(
      "select *,created_at::text as cursor_created_at from integration.analyses where store_id=$1 and ($2::timestamptz is null or (created_at,id)<($2::timestamptz,$3::uuid)) order by created_at desc,id desc limit $4",
      [store, after?.createdAt ?? null, after?.id ?? null, limit + 1],
    );
    const data = rows.slice(0, limit).map(analysisRecord);
    const last = data.at(-1);
    return {
      data,
      nextCursor:
        rows.length > limit && last
          ? await makeCursor(
              c,
              p,
              "analyses",
              {
                createdAt:
                  rows[Math.min(limit, rows.length) - 1].cursor_created_at,
                id: last.id,
              },
              new Date(Date.now() + 30 * 60_000),
            )
          : null,
    };
  });
}
export function getAnalysis(p: ApiPrincipal, store: string, id: string) {
  uuid(id);
  return reading(p, store, "analyses:read", async (c) => {
    const { rows } = await c.query(
      "select * from integration.analyses where store_id=$1 and id=$2",
      [store, id],
    );
    if (!rows[0]) throw notFound();
    return analysisRecord(rows[0]);
  });
}
export function listAnalysisItems(
  p: ApiPrincipal,
  store: string,
  id: string,
  page: Page = {},
) {
  uuid(id);
  const { limit, cursor } = parse(paginationQuerySchema, page);
  return reading(p, store, "analyses:read", async (c) => {
    const after = cursor
      ? (await readCursor(c, p, `items:${id}`, cursor)).data.offset
      : 0;
    const { rows } = await c.query(
      "select status,items from integration.analyses where store_id=$1 and id=$2",
      [store, id],
    );
    if (!rows[0]) throw notFound();
    if (rows[0].status !== "completed")
      throw new IntegrationError(
        409,
        "analysis_not_completed",
        "A análise ainda não foi concluída.",
      );
    const items = rows[0].items;
    return {
      data: items.slice(after, after + limit),
      nextCursor:
        after + limit < items.length
          ? await makeCursor(
              c,
              p,
              `items:${id}`,
              { offset: after + limit },
              new Date(Date.now() + 30 * 60_000),
            )
          : null,
    };
  });
}
function storeRecord(r: Row) {
  return {
    id: r.id,
    name: r.name,
    environment: r.environment,
    role: r.role,
    createdAt: iso(r.created_at),
    disconnectedAt: r.disconnected_at ? iso(r.disconnected_at) : null,
    revision: Number(r.revision),
  };
}
function credentialRecord(r: Row) {
  return {
    id: r.id,
    sourceId: r.source_id,
    label: r.label,
    prefix: r.prefix,
    scopes: r.scopes,
    expiresAt: iso(r.expires_at),
    revokedAt: r.revoked_at ? iso(r.revoked_at) : null,
    createdAt: iso(r.created_at),
  };
}
async function membership(
  c: PoolClient,
  actor: Actor,
  store: string,
  owner = false,
) {
  const { rows } = await c.query(
    "select s.*,m.role from integration.stores s join integration.memberships m on m.organization_id=s.organization_id where s.id=$1 and m.user_id=$2 and s.environment=$3",
    [uuid(store), actor.id, integrationEnvironment()],
  );
  if (!rows[0]) throw notFound();
  if (owner && rows[0].role !== "owner")
    throw new IntegrationError(
      403,
      "owner_required",
      "Apenas o responsável administra a integração.",
    );
  return rows[0];
}
async function adminTx<T>(
  actor: Actor,
  store: string,
  owner: boolean,
  fn: (c: PoolClient, s: Row) => Promise<T>,
) {
  return transaction(async (c) => {
    await lockStore(c, store);
    const s = await membership(c, actor, store, owner);
    return fn(c, s);
  });
}
export async function listStores(actor: Actor) {
  const { rows } = await getIntegrationPool().query(
    "select s.*,m.role from integration.stores s join integration.memberships m on m.organization_id=s.organization_id where m.user_id=$1 and s.environment=$2 order by s.created_at,s.id",
    [actor.id, integrationEnvironment()],
  );
  return rows.map(storeRecord);
}
export function createStore(
  actor: Actor,
  input: { name: string; environment?: Environment },
) {
  const name = parse(z.string().trim().min(1).max(100), input.name);
  return transaction(async (c) => {
    const id = randomUUID(),
      organizationId = randomUUID();
    await c.query(
      "insert into integration.organizations(id,name) values($1,$2)",
      [organizationId, name],
    );
    await c.query(
      "insert into integration.memberships(organization_id,user_id,role) values($1,$2,'owner')",
      [organizationId, actor.id],
    );
    const { rows } = await c.query(
      "insert into integration.stores(id,organization_id,name,environment) values($1,$2,$3,$4) returning *",
      [id, organizationId, name, integrationEnvironment()],
    );
    await audit(c, id, actor.id, "store_created", id);
    return storeRecord({ ...rows[0], role: "owner" });
  });
}
export function getStoreDashboard(actor: Actor, store: string) {
  return adminTx(actor, store, false, async (c, s) => {
    const sources = await c.query(
      "select * from integration.sources where store_id=$1 order by authorized_at desc",
      [store],
    );
    const credentials = await c.query(
      "select * from integration.credentials where store_id=$1 order by created_at desc",
      [store],
    );
    const products = await c.query(
      'select data from integration.products where store_id=$1 order by external_id collate "C",id limit 100',
      [store],
    );
    const analyses = await c.query(
      "select * from integration.analyses where store_id=$1 order by created_at desc,id desc limit 20",
      [store],
    );
    const counts = await c.query(
      "select count(*)::int as total,count(*) filter(where active)::int as active from integration.products where store_id=$1",
      [store],
    );
    return {
      store: storeRecord(s),
      sources: sources.rows.map((r) => ({
        id: r.id,
        name: r.name,
        active: r.active,
        noticeVersion: r.notice_version,
        authorizedAt: iso(r.authorized_at),
      })),
      credentials: credentials.rows.map(credentialRecord),
      products: products.rows.map((r) => r.data),
      analyses: analyses.rows.map(analysisRecord),
      productCount: counts.rows[0].total,
      activeProductCount: counts.rows[0].active,
      lastSyncedAt:
        (
          await c.query(
            "select max(data->>'updatedAt') as last from integration.products where store_id=$1",
            [store],
          )
        ).rows[0].last ?? null,
    };
  });
}
export function createSource(
  actor: Actor,
  store: string,
  input: { name: string; noticeVersion: string; authorized?: boolean },
) {
  const name = parse(z.string().trim().min(1).max(100), input.name);
  if (input.noticeVersion !== NOTICE_VERSION || input.authorized !== true)
    throw new IntegrationError(
      422,
      "consent_required",
      "Confirme a autorização e a versão atual do aviso de integração.",
    );
  return adminTx(actor, store, true, async (c, s) => {
    const existing = await c.query(
      "select id,active from integration.sources where store_id=$1",
      [store],
    );
    if (existing.rows.length)
      throw new IntegrationError(
        409,
        "source_already_exists",
        "A troca de origem exige exclusão dos dados e novo bootstrap; crie outra loja para uma origem independente.",
      );
    const id = randomUUID();
    await c.query(
      "insert into integration.sources(id,store_id,name,notice_version,authorized_by) values($1,$2,$3,$4,$5)",
      [id, store, name, NOTICE_VERSION, actor.id],
    );
    await audit(c, store, actor.id, "integration_authorized", id);
    return {
      id,
      name,
      active: true,
      noticeVersion: NOTICE_VERSION,
      authorizedAt: new Date().toISOString(),
      environment: s.environment,
    };
  });
}
async function newCredential(
  c: PoolClient,
  actor: Actor,
  store: string,
  source: string,
  scopes: IntegrationScope[],
  label: string,
  environment: Environment,
) {
  const src = await c.query(
    "select id from integration.sources where store_id=$1 and id=$2 and active",
    [store, uuid(source)],
  );
  if (!src.rows[0]) throw notFound();
  const secret = `rx_${environment}_${randomBytes(32).toString("base64url")}`;
  const id = randomUUID();
  const { rows } = await c.query(
    "insert into integration.credentials(id,store_id,source_id,token_hash,prefix,label,scopes,expires_at) values($1,$2,$3,$4,$5,$6,$7,now()+interval '90 days') returning *",
    [id, store, source, hash(secret), secret.slice(0, 22), label, scopes],
  );
  await audit(c, store, actor.id, "credential_issued", id);
  return { secret, credential: credentialRecord(rows[0]) };
}
export function issueCredential(
  actor: Actor,
  store: string,
  input: { sourceId: string; scopes: IntegrationScope[]; label?: string },
) {
  const scopes = parse(z.array(scopeSchema).min(1).max(4), input.scopes);
  if (scopes.includes("analyses:write") && !scopes.includes("analyses:read"))
    throw new IntegrationError(
      422,
      "validation_error",
      "analyses:write exige também analyses:read.",
    );
  const label = parse(
    z.string().trim().min(1).max(100),
    input.label ?? "Conector ERP",
  );
  return adminTx(actor, store, true, async (c, s) => {
    if (s.disconnected_at)
      throw new IntegrationError(
        409,
        "integration_disconnected",
        "Integração desconectada.",
      );
    return newCredential(
      c,
      actor,
      store,
      input.sourceId,
      [...new Set(scopes)],
      label,
      s.environment,
    );
  });
}
export function rotateCredential(actor: Actor, store: string, id: string) {
  uuid(id);
  return adminTx(actor, store, true, async (c, s) => {
    const { rows } = await c.query(
      "select * from integration.credentials where store_id=$1 and id=$2 and revoked_at is null and expires_at>clock_timestamp()",
      [store, id],
    );
    if (!rows[0]) throw notFound();
    const previous = rows[0];
    await c.query(
      "update integration.credentials set expires_at=least(expires_at,now()+interval '24 hours') where store_id=$1 and id=$2",
      [store, id],
    );
    const result = await newCredential(
      c,
      actor,
      store,
      previous.source_id,
      previous.scopes,
      previous.label,
      s.environment,
    );
    await audit(c, store, actor.id, "credential_rotated", id);
    return result;
  });
}
export function revokeCredential(actor: Actor, store: string, id: string) {
  uuid(id);
  return adminTx(actor, store, true, async (c) => {
    const { rowCount } = await c.query(
      "update integration.credentials set revoked_at=coalesce(revoked_at,now()) where store_id=$1 and id=$2",
      [store, id],
    );
    if (!rowCount) throw notFound();
    await audit(c, store, actor.id, "credential_revoked", id);
    return { revoked: true };
  });
}
export function disconnectSource(actor: Actor, store: string, id: string) {
  uuid(id);
  return adminTx(actor, store, true, async (c) => {
    const { rowCount } = await c.query(
      "update integration.sources set active=false where store_id=$1 and id=$2",
      [store, id],
    );
    if (!rowCount) throw notFound();
    await c.query(
      "update integration.stores set disconnected_at=coalesce(disconnected_at,now()) where id=$1",
      [store],
    );
    await c.query(
      "update integration.credentials set revoked_at=coalesce(revoked_at,now()) where store_id=$1",
      [store],
    );
    await c.query(
      "update integration.analyses set status='failed',error='integration_disconnected',completed_at=now() where store_id=$1 and status='queued'",
      [store],
    );
    await c.query(
      "update integration.jobs set status='failed',completed_at=now() where store_id=$1 and status='queued'",
      [store],
    );
    await audit(c, store, actor.id, "source_disconnected", id);
    return { disconnected: true };
  });
}
export function deleteStoreData(actor: Actor, store: string) {
  return adminTx(actor, store, true, async (c, s) => {
    await c.query("delete from integration.stores where id=$1", [store]);
    await c.query(
      "delete from integration.organizations where id=$1 and not exists(select 1 from integration.stores where organization_id=$1)",
      [s.organization_id],
    );
    return { deleted: true };
  });
}
// Membership changes are available to trusted account-management workflows, never API keys.
export function setMembership(
  actor: Actor,
  store: string,
  userId: string,
  role: "owner" | "viewer",
) {
  parse(z.enum(["owner", "viewer"]), role);
  return adminTx(actor, store, true, async (c, s) => {
    if (userId === actor.id && role !== "owner")
      throw new IntegrationError(
        409,
        "owner_required",
        "O responsável atual não pode remover seu próprio acesso.",
      );
    await c.query(
      "insert into integration.memberships(organization_id,user_id,role) values($1,$2,$3) on conflict(organization_id,user_id) do update set role=excluded.role",
      [s.organization_id, userId, role],
    );
    await audit(c, store, actor.id, "membership_updated");
    return { role };
  });
}
