import { after } from 'next/server';
import { runWorkerOnce } from '@/lib/integration/worker';
import { productBatchSchema, analysisRequestSchema } from '@/lib/integration/contracts';
import { IntegrationError } from '@/lib/integration/errors';
import { bearerToken, idempotencyKey, integrationBody, integrationJson, pagination, withIntegrationErrors } from '@/lib/integration/http';
import * as repository from '@/lib/integration/repository';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: Context) {
  return withIntegrationErrors(request, async () => {
    const token = bearerToken(request);
    const principal = await repository.authenticateApiKey(token);
    const { path } = await context.params;
    const read = request.method === 'GET';
    if (read && path.length === 1 && path[0] === 'me') return integrationJson(await repository.getMe(principal));
    if (path[0] !== 'stores' || path.length < 3 || path[1] !== principal.storeId) throw new IntegrationError(404, 'not_found', 'Recurso não encontrado.');
    const storeId = path[1], resource = path[2];
    if (read && resource === 'products') {
      if (path.length === 3) return integrationJson(await repository.listProducts(principal, storeId, pagination(request)));
      if (path.length === 4) return integrationJson(await repository.getProduct(principal, storeId, path[3]));
    }
    if (read && resource === 'product-changes' && path.length === 3) return integrationJson(await repository.listProductChanges(principal, storeId, pagination(request)));
    if (resource === 'analyses') {
      if (read && path.length === 3) return integrationJson(await repository.listAnalyses(principal, storeId, pagination(request)));
      if (read && path.length === 4) return integrationJson(await repository.getAnalysis(principal, storeId, path[3]));
      if (read && path.length === 5 && path[4] === 'items') return integrationJson(await repository.listAnalysisItems(principal, storeId, path[3], pagination(request)));
      if (!read && path.length === 3) {
        const key = idempotencyKey(request);
        const body = analysisRequestSchema.parse(await integrationBody(request, 16_384));
        const result = await repository.createAnalysis(principal, storeId, body, key);
        if (process.env.VERCEL) after(async () => { await runWorkerOnce(); });
        return integrationJson(result, 202, { Location: `/api/v1/stores/${storeId}/analyses/${result.analysisId}` });
      }
    }
    if (!read && resource === 'product-batches' && path.length === 3) {
      const key = idempotencyKey(request);
      const raw = await integrationBody(request);
      if (raw && typeof raw === 'object' && 'products' in raw && Array.isArray(raw.products) && raw.products.length > 500) throw new IntegrationError(413, 'batch_too_large', 'Envie até 500 produtos por lote.');
      const body = productBatchSchema.parse(raw);
      return integrationJson(await repository.applyProductBatch(principal, storeId, body, key));
    }
    throw new IntegrationError(404, 'not_found', 'Recurso não encontrado.');
  });
}

export const GET = handle;
export const POST = handle;
