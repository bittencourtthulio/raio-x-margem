import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PostgresRepository } from '../lib/postgres-repository';
import { closeIntegrationPool, getIntegrationPool } from '../lib/integration/db';
import type { DiagnosticRequest } from '../lib/contracts';

test('Postgres accounts: concurrent consent, atomic quotas, idempotency and private storage', {skip:!process.env.INTEGRATION_TEST_DATABASE_URL}, async () => {
  const url = new URL(process.env.INTEGRATION_TEST_DATABASE_URL!);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'Use an isolated local test database');
  process.env.INTEGRATION_DATABASE_URL = url.toString();
  const repo = new PostgresRepository(), tag = randomUUID();
  const input: DiagnosticRequest = {idempotencyKey:randomUUID(),demo:true,honeypot:'',lead:{name:'Test',businessName:'Test store',contact:'untrusted@example.com',sector:'retail',role:'owner',currentControl:'spreadsheet',systemDifficulty:false,commercialConsent:false,saveSummaryConsent:false,privacyAcknowledged:true},scenario:{discountBps:0,targetBps:2000,feeBps:0,feeEnabled:false},summary:{validCount:2,invalidCount:0,warningCount:0,negativeCount:1,belowTargetCount:1,excludedCount:0,bands:[1,0,0,1]}};
  try {
    const a = await repo.upsertAccount(tag,'uid','Test','verified@example.com');
    assert.equal((await repo.upsertAccount(tag,'uid','Test','verified@example.com')).id,a.id);
    const profiles = await Promise.all([repo.completeAccount(a,input.lead),repo.completeAccount(a,input.lead)]);
    assert.equal(profiles[0].profile?.contact,'verified@example.com');
    assert.equal(profiles[1].profile?.saveSummaryConsent,false);
    assert.equal((await getIntegrationPool().query('select count(*)::int as n from app_private.account_consents where account_id=$1',[a.id])).rows[0].n,2);
    const quota = [{subject:tag,kind:'test',max:1,windowMs:3600000}];
    const reservations = await Promise.allSettled([repo.reserve(quota),repo.reserve(quota)]);
    assert.equal(reservations.filter(r=>r.status==='fulfilled').length,1);
    await assert.rejects(repo.reserve([{subject:tag,kind:'before',max:5,windowMs:3600000},...quota]),{code:'QUOTA'});
    assert.equal((await getIntegrationPool().query("select count(*)::int as n from app_private.request_limits where subject=$1 and kind='before'",[tag])).rows[0].n,0);
    const claims = await Promise.allSettled([repo.claim(tag,input,[]),repo.claim(tag,input,[])]);
    const success = claims.find(r=>r.status==='fulfilled'); assert.ok(success && success.status==='fulfilled');
    assert.equal(claims.filter(r=>r.status==='rejected').length,1);
    await repo.finish(tag,input.idempotencyKey,{id:success.value.id,source:'mock',findings:['Test'],actions:['Test'],limitations:['Test']},false,true);
    await assert.rejects(repo.claim(tag,input,[]),{code:'COMPLETED_NO_REPLAY'});
    const d=(await getIntegrationPool().query('select summary_json,response_json from app_private.diagnostics where id=$1',[success.value.id])).rows[0];
    assert.deepEqual(d,{summary_json:null,response_json:null});
    const consented={...input,idempotencyKey:randomUUID(),lead:{...input.lead,saveSummaryConsent:true}};
    const claim=await repo.claim(tag,consented,[]), result={id:claim.id,source:'mock' as const,findings:['Test'],actions:['Test'],limitations:['Test']};
    await repo.finish(tag,consented.idempotencyKey,result,true,true);
    assert.deepEqual((await repo.claim(tag,consented,[])).replay,result);
    await assert.rejects(repo.claim(tag,{...consented,demo:false},[]),{code:'IDEMPOTENCY_CONFLICT'});
    await getIntegrationPool().query("update app_private.accounts set status='blocked' where id=$1",[a.id]);
    await assert.rejects(repo.completeAccount(a,input.lead),{code:'ACCOUNT_BLOCKED'});
    await assert.rejects(repo.upsertAccount(tag,'uid','Test','verified@example.com'),{code:'ACCOUNT_BLOCKED'});
    assert.equal((await getIntegrationPool().query("select bool_and(rowsecurity) as secured from pg_tables where schemaname='app_private'")).rows[0].secured,true);
    await repo.cleanup(Date.now()+91*86400000);
    assert.equal((await getIntegrationPool().query('select count(*)::int as n from app_private.leads where session_hash=$1',[tag])).rows[0].n,0);
  } finally {await closeIntegrationPool();}
});
