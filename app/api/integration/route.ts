import { z } from 'zod';
import { integrationActor } from '@/lib/integration/human-auth';
import { integrationBody, integrationJson, withIntegrationErrors } from '@/lib/integration/http';
import { IntegrationError } from '@/lib/integration/errors';
import * as repository from '@/lib/integration/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NOTICE_VERSION = '2026-10-14-integration-v1';
const id = z.string().uuid();
const name = z.string().trim().min(1).max(100);
const scope = z.enum(['products:read', 'products:write', 'analyses:read', 'analyses:write']);
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('createStore'), name }).strict(),
  z.object({ action: z.literal('createSource'), storeId: id, name, noticeVersion: z.literal(NOTICE_VERSION), authorized: z.literal(true) }).strict(),
  z.object({ action: z.literal('issueCredential'), storeId: id, sourceId: id, scopes: z.array(scope).min(1).max(4), label: name.optional() }).strict(),
  z.object({ action: z.literal('rotateCredential'), storeId: id, credentialId: id }).strict(),
  z.object({ action: z.literal('revokeCredential'), storeId: id, credentialId: id }).strict(),
  z.object({ action: z.literal('disconnectSource'), storeId: id, sourceId: id }).strict(),
  z.object({ action: z.literal('deleteStoreData'), storeId: id }).strict(),
]);

export async function GET(request: Request) {
  return withIntegrationErrors(request, async () => {
    const actor = await integrationActor(request);
    const storeId = new URL(request.url).searchParams.get('storeId');
    if (storeId) {
      if (!id.safeParse(storeId).success) throw new IntegrationError(404, 'not_found', 'Loja não encontrada.');
      return integrationJson({ ...(await repository.getStoreDashboard(actor, storeId)), noticeVersion: NOTICE_VERSION });
    }
    return integrationJson({ environment: process.env.INTEGRATION_ENVIRONMENT || 'sandbox', noticeVersion: NOTICE_VERSION, stores: await repository.listStores(actor) });
  });
}

export async function POST(request: Request) {
  return withIntegrationErrors(request, async () => {
    const actor = await integrationActor(request, true);
    const body = actionSchema.parse(await integrationBody(request, 16_384));
    switch (body.action) {
      case 'createStore': return integrationJson(await repository.createStore(actor, { name: body.name }), 201);
      case 'createSource': return integrationJson(await repository.createSource(actor, body.storeId, { name: body.name, noticeVersion: body.noticeVersion, authorized: body.authorized }), 201);
      case 'issueCredential': return integrationJson(await repository.issueCredential(actor, body.storeId, body), 201);
      case 'rotateCredential': return integrationJson(await repository.rotateCredential(actor, body.storeId, body.credentialId), 201);
      case 'revokeCredential': return integrationJson(await repository.revokeCredential(actor, body.storeId, body.credentialId));
      case 'disconnectSource': return integrationJson(await repository.disconnectSource(actor, body.storeId, body.sourceId));
      case 'deleteStoreData': return integrationJson(await repository.deleteStoreData(actor, body.storeId));
    }
  });
}
