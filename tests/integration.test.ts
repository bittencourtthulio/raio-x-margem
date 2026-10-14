import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import * as repo from '../lib/integration/repository';
import { closeIntegrationPool, getIntegrationPool } from '../lib/integration/db';
import { claimJob, completeJob, runWorkerOnce, runRetentionCleanup } from '../lib/integration/worker';
import { GET, POST } from '../app/api/v1/[...path]/route';
import { analysisItemsPageSchema, analysisSchema, batchResultSchema, changePageSchema, meSchema, productPageSchema, problemSchema } from '../lib/integration/contracts';

const database = process.env.INTEGRATION_TEST_DATABASE_URL;
const product = (externalId: string, sourceVersion = 1, changes = {}) => ({ externalId, sourceVersion, name: `Produto ${externalId}`, barcode: '0012345678905', purchaseCostCents: 6000, salePriceCents: 10000, active: true, ...changes });
const scenario = { discountBps: 1000, targetBps: 2000, feeBps: 1000, feeEnabled: true };

test('API v1 with real Postgres: isolation, transactions, snapshots, jobs and contract', { skip: !database, timeout: 120_000 }, async t => {
  process.env.INTEGRATION_DATABASE_URL = database;
  process.env.INTEGRATION_ENVIRONMENT = 'sandbox';
  const actor = { id: `test:${randomUUID()}` };
  const other = { id: `test:${randomUUID()}` };
  const stores: string[] = [];
  async function setup(owner = actor) {
    const store = await repo.createStore(owner, { name: 'Loja sintética' }); stores.push(store.id);
    const source = await repo.createSource(owner, store.id, { name: 'ERP sintético', noticeVersion: repo.NOTICE_VERSION, authorized: true });
    const key = await repo.issueCredential(owner, store.id, { sourceId: source.id, scopes: ['products:read', 'products:write', 'analyses:read', 'analyses:write'] });
    return { store, source, key, principal: await repo.authenticateApiKey(key.secret) };
  }
  const a = await setup(), b = await setup(other);
  const call = async (method: 'GET' | 'POST', path: string, body?: unknown, token = a.key.secret, key: string = randomUUID(), headers: Record<string, string> = {}) => {
    const request = new Request(`http://localhost:3000/api/v1/${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key, ...headers }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
    const response = await (method === 'GET' ? GET : POST)(request, { params: Promise.resolve({ path: path.split('?')[0].split('/') }) });
    const json = await response.json();
    if (response.status >= 400) problemSchema.parse(json);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(response.headers.get('x-request-id'));
    return { response, json };
  };
  const path = `stores/${a.store.id}`;
  try {
    await t.test('credentials, environments, memberships and public response schemas', async () => {
      const me = await call('GET', 'me'); assert.equal(me.response.status, 200); meSchema.parse(me.json);
      assert.equal((await call('GET', 'me', undefined, 'invalid')).response.status, 401);
      await assert.rejects(repo.authenticateApiKey(a.key.secret, 'production'), { status: 401 });
      await assert.rejects(repo.getStoreDashboard(other, a.store.id), { status: 404 });
      await repo.setMembership(actor, a.store.id, other.id, 'viewer');
      await assert.rejects(repo.issueCredential(other, a.store.id, { sourceId: a.source.id, scopes: ['products:read'] }), { status: 403 });
      await assert.rejects(repo.createSource(actor, a.store.id, { name: 'Outra', noticeVersion: repo.NOTICE_VERSION, authorized: true }), { status: 409 });
      const hashed = await getIntegrationPool().query('select token_hash from integration.credentials where id=$1', [a.key.credential.id]);
      assert.equal(hashed.rows[0].token_hash, createHash('sha256').update(a.key.secret).digest('hex'));
      assert.ok(!JSON.stringify(await repo.getStoreDashboard(actor, a.store.id)).includes(a.key.secret));
    });
    let initial: any, first: any;
    const initialKey = randomUUID();
    await t.test('atomic schema validation, barcode strings, version conflicts and replay', async () => {
      const bad = await call('POST', `${path}/product-batches`, { products: [product('valid'), { ...product('bad'), purchaseCostCents: undefined }] });
      assert.equal(bad.response.status, 422); assert.equal(bad.json.errors[0].index, 1);
      assert.equal((await repo.listProducts(a.principal, a.store.id)).data.length, 0);
      assert.equal((await call('POST', `${path}/product-batches`, { products: [product('same'), product('same')] })).response.status, 422);
      initial = { products: [product('A'), product('B'), product('ZERO', 1, { barcode: null, purchaseCostCents: 0, salePriceCents: 1 })] };
      first = await call('POST', `${path}/product-batches`, initial, a.key.secret, initialKey);
      assert.equal(first.response.status, 200); batchResultSchema.parse(first.json);
      const again = await call('POST', `${path}/product-batches`, initial, a.key.secret, initialKey);
      assert.deepEqual(again.json, first.json);
      assert.equal((await call('POST', `${path}/product-batches`, { products: [product('A', 2)] }, a.key.secret, initialKey)).response.status, 409);
      const unchanged = await call('POST', `${path}/product-batches`, { products: [product('A')] });
      assert.equal(unchanged.json.data[0].status, 'unchanged'); assert.equal(unchanged.json.data[0].revision, first.json.data[0].revision);
      assert.equal((await call('POST', `${path}/product-batches`, { products: [product('new'), product('A', 1, { name: 'Conflito' })] })).response.status, 409);
      const page = await repo.listProducts(a.principal, a.store.id); assert.equal(page.data.length, 3);
      assert.equal(page.data[0].barcode, '0012345678905'); assert.ok(page.data[0].alerts.some((v: string) => v.includes('duplicado')));
    });
    await t.test('authorization before cross-store access, scopes and request limits', async () => {
      const foreign = await repo.applyProductBatch(b.principal, b.store.id, { products: [product('B')] }, randomUUID());
      assert.equal((await call('GET', `stores/${b.store.id}/products`)).response.status, 404);
      assert.equal((await call('GET', `${path}/products/${foreign.data[0].id}`)).response.status, 404);
      const readonly = await repo.issueCredential(actor, a.store.id, { sourceId: a.source.id, scopes: ['products:read'] });
      assert.equal((await call('POST', `${path}/product-batches`, { products: [product('no')] }, readonly.secret)).response.status, 403);
      assert.equal((await call('GET', `${path}/products?limit=501`)).response.status, 400);
      assert.equal((await call('POST', `${path}/product-batches`, { products: [product('big', 1, { name: 'x'.repeat(1_048_577) })] })).response.status, 413);
      assert.equal((await call('POST', `${path}/product-batches`, { products: Array.from({ length: 501 }, (_, i) => product(String(i))) })).response.status, 413);
      assert.equal((await call('POST', `${path}/product-batches`, initial, a.key.secret, '')).response.status, 400);
    });
    await t.test('snapshot pagination and changes survive concurrent out-of-order updates', async () => {
      const boot = await call('GET', `${path}/products?limit=1`); productPageSchema.parse(boot.json);
      const results = await Promise.allSettled([repo.applyProductBatch(a.principal, a.store.id, { products: [product('B', 3, { salePriceCents: 30000 })] }, randomUUID()), repo.applyProductBatch(a.principal, a.store.id, { products: [product('B', 2, { salePriceCents: 20000 })] }, randomUUID())]);
      assert.ok(results.some(r => r.status === 'fulfilled'));
      const second = await call('GET', `${path}/products?limit=1&cursor=${boot.json.nextCursor}`);
      assert.equal(second.json.data[0].salePriceCents, 10000); assert.equal(second.json.snapshotId, boot.json.snapshotId);
      const change = await call('GET', `${path}/product-changes?cursor=${boot.json.changesCursor}`); changePageSchema.parse(change.json);
      assert.ok(change.json.data.length >= 1);
      assert.equal(change.json.data.at(-1).sourceVersion, 3);
      assert.equal(change.json.data.at(-1).product.salePriceCents, 30000);
      const revisions = change.json.data.map((v: any) => v.revision); assert.deepEqual(revisions, [...revisions].sort((x, y) => x - y));
      await repo.applyProductBatch(a.principal, a.store.id, { products: [product('B', 4, { active: false })] }, randomUUID());
      const deactivated = await repo.listProductChanges(a.principal, a.store.id, { cursor: change.json.changesCursor }); assert.equal(deactivated.data.at(-1).operation, 'deactivate');
      await repo.applyProductBatch(a.principal, a.store.id, { products: [product('B', 5)] }, randomUUID());
      const reactivated = await repo.listProductChanges(a.principal, a.store.id, { cursor: deactivated.changesCursor }); assert.equal(reactivated.data.at(-1).operation, 'upsert');
      await assert.rejects(repo.listProducts(b.principal, b.store.id, { cursor: boot.json.nextCursor }), { status: 400 });
      await getIntegrationPool().query("update integration.cursors set expires_at=now()-interval '1 second' where token_hash=$1", [createHash('sha256').update(boot.json.nextCursor).digest('hex')]);
      assert.equal((await call('GET', `${path}/products?cursor=${boot.json.nextCursor}`)).response.status, 410);
    });
    await t.test('immutable analyses, durable recovery and shared deterministic calculations', async () => {
      const created = await call('POST', `${path}/analyses`, { scenario }); assert.equal(created.response.status, 202);
      assert.equal(created.response.headers.get('location'), created.json.url);
      const id = created.json.analysisId;
      const before = await repo.getAnalysis(a.principal, a.store.id, id); analysisSchema.parse(before);
      await repo.applyProductBatch(a.principal, a.store.id, { products: [product('A', 2, { purchaseCostCents: 9000 })] }, randomUUID());
      // Simulate a process dying after claiming its durable job, before writing results.
      await getIntegrationPool().query("update integration.jobs set status='running',lease_until=now()-interval '1 second',attempts=1 where analysis_id=$1", [id]);
      await getIntegrationPool().query("update integration.analyses set status='running' where id=$1", [id]);
      assert.equal(await runWorkerOnce(), true);
      const completed = await call('GET', `${path}/analyses/${id}`); analysisSchema.parse(completed.json); assert.equal(completed.json.status, 'completed');
      assert.equal(completed.json.catalogRevision, before.catalogRevision);
      const items = await call('GET', `${path}/analyses/${id}/items`); analysisItemsPageSchema.parse(items.json);
      const item = items.json.data.find((v: any) => v.product.externalId === 'A');
      assert.equal(item.product.purchaseCostCents, 6000); assert.equal(item.simulatedPriceCents, 9000); assert.equal(item.feeCents, 900); assert.equal(item.contributionCents, 2100); assert.ok(Math.abs(item.contributionPercent - 23.3333333333) < 0.000001);
      assert.equal((await call('GET', `stores/${b.store.id}/analyses/${id}`, undefined, b.key.secret)).response.status, 404);
      const zero = await repo.createAnalysis(a.principal, a.store.id, { scenario: { ...scenario, discountBps: 9900 } }, randomUUID());
      await runWorkerOnce();
      const zeroItems = await repo.listAnalysisItems(a.principal, a.store.id, zero.analysisId);
      assert.equal(zeroItems.data.find((v: any) => v.product.externalId === 'ZERO').activePercent, null);
    });
    await t.test('rotation preserves replay scope; revocation takes effect for already-resolved principal', async () => {
      const rotated = await repo.rotateCredential(actor, a.store.id, a.key.credential.id);
      const rotatedPrincipal = await repo.authenticateApiKey(rotated.secret);
      assert.deepEqual(await repo.applyProductBatch(rotatedPrincipal, a.store.id, initial, initialKey), first.json);
      await repo.revokeCredential(actor, a.store.id, rotated.credential.id);
      await assert.rejects(repo.getMe(rotatedPrincipal), { status: 401 });
      await assert.rejects(repo.authenticateApiKey(rotated.secret), { status: 401 });
    });
    await t.test('overlapping idempotent requests return retryable conflict', async () => {
      const client = await getIntegrationPool().connect();
      const key = randomUUID();
      try {
        await client.query('begin');
        await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${a.store.id}:${a.source.id}:POST/product-batches:${key}`]);
        const pending = await call('POST', `${path}/product-batches`, initial, a.key.secret, key);
        assert.equal(pending.response.status, 409); assert.equal(pending.json.code, 'idempotency_in_progress');
        assert.ok(pending.response.headers.get('retry-after'));
      } finally { await client.query('rollback'); client.release(); }
    });
    await t.test('stale workers cannot commit after another worker acquired the lease', async () => {
      const analysis = await repo.createAnalysis(a.principal, a.store.id, { scenario }, randomUUID());
      const oldJob = await claimJob(); assert.equal(oldJob?.analysisId, analysis.analysisId);
      await getIntegrationPool().query("update integration.jobs set lease_until=now()-interval '1 second' where id=$1", [oldJob!.id]);
      const recovered = await claimJob(); assert.equal(recovered?.analysisId, analysis.analysisId);
      assert.notEqual(oldJob!.leaseToken, recovered!.leaseToken);
      assert.equal(await completeJob(oldJob!), false); assert.equal(await completeJob(recovered!), true);
      assert.equal((await repo.getAnalysis(a.principal, a.store.id, analysis.analysisId)).status, 'completed');
    });
    await t.test('retention gaps and expired cursors force a new bootstrap', async () => {
      const retained = await setup();
      const bootstrap = await repo.listProducts(retained.principal, retained.store.id);
      await repo.applyProductBatch(retained.principal, retained.store.id, { products: [product('old')] }, randomUUID());
      await getIntegrationPool().query("update integration.changes set created_at=now()-interval '91 days' where store_id=$1", [retained.store.id]);
      await runRetentionCleanup();
      await assert.rejects(repo.listProductChanges(retained.principal, retained.store.id, { cursor: bootstrap.changesCursor }), { status: 410, code: 'sync_cursor_expired' });
      const expired = `${Date.now() - 1}.${'a'.repeat(43)}`;
      await assert.rejects(repo.listProducts(retained.principal, retained.store.id, { cursor: expired }), { status: 410 });
    });
    await t.test('shared quotas reject excess and replays do not consume quota', async () => {
      await getIntegrationPool().query("insert into integration.limits(store_id,bucket,window_start,count) values($1,'batches',to_timestamp(floor(extract(epoch from now())/60)*60),20) on conflict(store_id,bucket,window_start) do update set count=20", [a.store.id]);
      assert.deepEqual((await call('POST', `${path}/product-batches`, initial, a.key.secret, initialKey)).json, first.json);
      const limit = await call('POST', `${path}/product-batches`, { products: [product('quota')] }); assert.equal(limit.response.status, 429); assert.ok(Number(limit.response.headers.get('retry-after')) > 0);
    });
    await t.test('5000-product pilot capacity, active limit and analysis latency', async () => {
      const large = await setup();
      for (let batch = 0; batch < 10; batch++) {
        await repo.applyProductBatch(large.principal, large.store.id, { products: Array.from({ length: 500 }, (_, i) => product(`LOAD-${String(batch * 500 + i).padStart(5, '0')}`, 1, { barcode: null })) }, `load-${batch}`);
      }
      await assert.rejects(repo.applyProductBatch(large.principal, large.store.id, { products: [product('OVER-LIMIT')] }, randomUUID()), { status: 422 });
      const start = performance.now();
      const analysis = await repo.createAnalysis(large.principal, large.store.id, { scenario }, randomUUID());
      await runWorkerOnce();
      const result = await repo.getAnalysis(large.principal, large.store.id, analysis.analysisId);
      assert.equal(result.status, 'completed'); assert.equal(result.summary.validCount, 5000);
      const elapsed = performance.now() - start; assert.ok(elapsed < 30_000);
      t.diagnostic(`5000-product analysis: ${Math.round(elapsed)}ms on local Postgres; not a production SLA.`);
    });
    await t.test('RLS blocks an untrusted SQL role even with explicit SELECT grant', async () => {
      const client = await getIntegrationPool().connect();
      const role = `rxm_test_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query('begin');
        await client.query(`create role ${role} nologin`);
        await client.query(`grant usage on schema integration to ${role}`);
        await client.query(`grant select on integration.products to ${role}`);
        await client.query(`set local role ${role}`);
        const hidden = await client.query('select * from integration.products'); assert.equal(hidden.rowCount, 0);
      } finally { await client.query('rollback'); client.release(); }
    });
    await t.test('disconnect cancels queued jobs and closes all credential access; deletion removes payloads', async () => {
      const pending = await repo.createAnalysis(b.principal, b.store.id, { scenario }, randomUUID());
      await repo.disconnectSource(other, b.store.id, b.source.id);
      await assert.rejects(repo.authenticateApiKey(b.key.secret), { status: 401 });
      const state = await getIntegrationPool().query('select status from integration.jobs where analysis_id=$1', [pending.analysisId]); assert.equal(state.rows[0].status, 'failed');
      await repo.deleteStoreData(other, b.store.id);
      const rows = await getIntegrationPool().query('select id from integration.products where store_id=$1', [b.store.id]); assert.equal(rows.rowCount, 0);
      await runRetentionCleanup();
    });
  } finally {
    for (const store of stores) {
      const organization = await getIntegrationPool().query('select organization_id from integration.stores where id=$1', [store]);
      if (organization.rows[0]) await getIntegrationPool().query('delete from integration.organizations where id=$1', [organization.rows[0].organization_id]);
    }
    await closeIntegrationPool();
  }
});
