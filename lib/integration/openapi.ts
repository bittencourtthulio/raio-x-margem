import { z } from 'zod';
import * as c from './contracts';

const schemas = {
  ProductInput: c.productInputSchema, ProductBatch: c.productBatchSchema, Scenario: c.scenarioSchema, AnalysisRequest: c.analysisRequestSchema,
  Product: c.productSchema, BatchResult: c.batchResultSchema, ProductPage: c.productPageSchema, Change: c.changeSchema, ChangePage: c.changePageSchema,
  Summary: c.summarySchema, Analysis: c.analysisSchema, AnalysisAccepted: c.analysisAcceptedSchema, AnalysisPage: c.analysisPageSchema,
  AnalysisItem: c.analysisItemSchema, AnalysisItemsPage: c.analysisItemsPageSchema, Me: c.meSchema, Problem: c.problemSchema,
};
export const sampleProduct = { externalId: 'SKU-001', sourceVersion: 1, name: 'Camiseta', barcode: '0012345678905', purchaseCostCents: 6000, salePriceCents: 10000, active: true };
export const sampleScenario = { discountBps: 1000, targetBps: 2000, feeBps: 1000, feeEnabled: true };
const sampleStoredProduct = { ...sampleProduct, id: '00000000-0000-4000-8000-000000000001', storeId: '00000000-0000-4000-8000-000000000002', sourceId: '00000000-0000-4000-8000-000000000003', revision: 1, sourceUpdatedAt: null, createdAt: '2026-10-14T12:00:00.000Z', updatedAt: '2026-10-14T12:00:00.000Z', alerts: [] };
const sampleAnalysis = { id: '00000000-0000-4000-8000-000000000004', storeId: sampleStoredProduct.storeId, status: 'completed', scenario: sampleScenario, catalogRevision: 1, calculationVersion: 'margin-v1', createdAt: sampleStoredProduct.createdAt, completedAt: sampleStoredProduct.createdAt, summary: { validCount: 1, invalidCount: 0, warningCount: 0, negativeCount: 0, belowTargetCount: 0, excludedCount: 0, bands: [0, 0, 0, 1] }, error: null };
export const responseExamples: Record<string, unknown> = {
  Me: { storeId: sampleStoredProduct.storeId, sourceId: sampleStoredProduct.sourceId, environment: 'sandbox', scopes: ['products:read','products:write','analyses:read','analyses:write'], limits: c.LIMITS },
  BatchResult: { data: [{ externalId: sampleProduct.externalId, id: sampleStoredProduct.id, status: 'created', sourceVersion: 1, revision: 1 }] },
  Product: sampleStoredProduct,
  ProductPage: { data: [sampleStoredProduct], snapshotId: '00000000-0000-4000-8000-000000000005', asOfRevision: 1, nextCursor: null, changesCursor: 'opaque-example-cursor' },
  ChangePage: { data: [{ productId: sampleStoredProduct.id, externalId: sampleProduct.externalId, sourceVersion: 1, revision: 1, operation: 'upsert', changedAt: sampleStoredProduct.createdAt, product: sampleStoredProduct }], nextCursor: null, changesCursor: 'opaque-example-cursor' },
  AnalysisAccepted: { analysisId: sampleAnalysis.id, status: 'queued', url: `/api/v1/stores/${sampleStoredProduct.storeId}/analyses/${sampleAnalysis.id}` },
  Analysis: sampleAnalysis,
  AnalysisPage: { data: [sampleAnalysis], nextCursor: null },
  AnalysisItemsPage: { data: [{ product: sampleStoredProduct, simulatedPriceCents: 9000, grossCents: 3000, grossPercent: 100 / 3, feeCents: 900, contributionCents: 2100, contributionPercent: 2100 / 9000 * 100, activeCents: 2100, activePercent: 2100 / 9000 * 100 }], nextCursor: null },
};
export const operations = [
  { method: 'get', path: '/me', operationId: 'getIntegrationIdentity', title: 'Identificar credencial', scope: '', response: 'Me', description: 'Retorna loja, origem, ambiente, escopos e limites efetivos.' },
  { method: 'post', path: '/stores/{storeId}/product-batches', operationId: 'upsertProductBatch', title: 'Enviar lote de produtos', scope: 'products:write', response: 'BatchResult', request: 'ProductBatch', description: 'Lote atômico: 1–500 itens, até 1 MiB. Repetir externalId invalida o lote. sourceVersion crescente; versão igual só aceita conteúdo normalizado idêntico. Barcode omitido vira null. Não substitui catálogo completo.' },
  { method: 'get', path: '/stores/{storeId}/products', operationId: 'listProducts', title: 'Consultar snapshot do catálogo', scope: 'products:read', response: 'ProductPage', paginated: true, description: 'Abre snapshot consistente de 30 minutos. Ordenação por externalId (bytes UTF-8) e id. Salve changesCursor para recuperar alterações ocorridas durante a paginação. Inclui inativos.' },
  { method: 'get', path: '/stores/{storeId}/products/{productId}', operationId: 'getProduct', title: 'Consultar produto', scope: 'products:read', response: 'Product', description: 'Produto atual, inclusive inativo. Recurso de outra loja retorna 404.' },
  { method: 'get', path: '/stores/{storeId}/product-changes', operationId: 'listProductChanges', title: 'Ler alterações incrementais', scope: 'products:read', response: 'ChangePage', paginated: true, description: 'Revisão crescente por loja. Use cursor obtido no bootstrap; persista changesCursor após aplicar a página. nextCursor=null indica fim da página disponível, não fim da sincronização. Retenção de 90 dias; 410 exige novo bootstrap.' },
  { method: 'post', path: '/stores/{storeId}/analyses', operationId: 'createAnalysis', title: 'Solicitar análise', scope: 'analyses:write', response: 'AnalysisAccepted', request: 'AnalysisRequest', description: 'Captura produtos ativos e cenário num snapshot imutável; retorna 202 e Location. Catálogo vazio retorna 422. feeEnabled=false exige feeBps=0. Análises não alteram preços nem geram diagnóstico com IA.' },
  { method: 'get', path: '/stores/{storeId}/analyses', operationId: 'listAnalyses', title: 'Listar análises', scope: 'analyses:read', response: 'AnalysisPage', paginated: true, description: 'Metadados ordenados de forma estável por criação e ID, do mais recente ao mais antigo.' },
  { method: 'get', path: '/stores/{storeId}/analyses/{analysisId}', operationId: 'getAnalysis', title: 'Consultar análise', scope: 'analyses:read', response: 'Analysis', description: 'Estados queued, running, completed ou failed. summary fica null até conclusão. catalogRevision informa o catálogo capturado, não o atual.' },
  { method: 'get', path: '/stores/{storeId}/analyses/{analysisId}/items', operationId: 'listAnalysisItems', title: 'Consultar resultados por produto', scope: 'analyses:read', response: 'AnalysisItemsPage', paginated: true, description: 'Resultados do snapshot imutável. Valores monetários inteiros em centavos; percentuais sem arredondamento de apresentação ou null. Ordenação crescente por activePercent (null no fim), externalId (bytes UTF-8) e id.' },
] as const;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const problemResponse = (description: string) => ({ description, content: { 'application/problem+json': { schema: ref('Problem') } } });
export function createOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of operations) {
    const parameters: unknown[] = [...op.path.matchAll(/\{([^}]+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: { type: 'string', minLength: 1 }, description: 'Identificador técnico verificado contra a credencial.' }));
    if ('paginated' in op) parameters.push({ name: 'limit', in: 'query', schema: { type: 'integer', default: 100, minimum: 1, maximum: 500 } }, { name: 'cursor', in: 'query', required: op.operationId === 'listProductChanges', schema: { type: 'string', maxLength: 4096 }, description: 'Token opaco; não editar nem reutilizar entre lojas, recursos ou ambientes.' });
    if (op.method === 'post') parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 1, maxLength: 200, pattern: '^[!-~]+$' }, description: 'ASCII sem espaços. Persistir por operação. Retida sete dias; mesmo corpo retorna resposta original. Corpo diferente: 409. Replay não consome nova quota.' });
    const status = op.operationId === 'createAnalysis' ? '202' : '200';
    const responses: Record<string, unknown> = { [status]: { description: 'Sucesso', headers: status === '202' ? { Location: { schema: { type: 'string' }, description: 'Caminho da consulta de status.' } } : {}, content: { 'application/json': { schema: ref(op.response), example: responseExamples[op.response] } } } };
    for (const [code, desc] of Object.entries({ 400: 'JSON ou cursor inválido.', 401: 'Credencial inválida, expirada ou revogada.', 403: 'Escopo ausente.', 404: 'Recurso inexistente ou inacessível.', 409: 'Conflito de versão, idempotency_conflict, idempotency_in_progress ou análise não concluída.', 410: 'sync_cursor_expired ou snapshot expirado.', 413: 'Lote ou corpo excede limite.', 415: 'Content-Type deve ser application/json com charset UTF-8.', 422: 'Schema inválido ou catálogo vazio.', 429: 'Quota compartilhada da loja; respeite Retry-After.', 503: 'Indisponibilidade temporária; retry limitado.' })) responses[code] = problemResponse(desc);
    responses['429'] = { ...problemResponse('Limite da loja atingido.'), headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 }, description: 'Segundos até nova tentativa.' } } };
    const operation = { operationId: op.operationId, summary: op.title, description: `${op.description} ${op.scope ? `Escopo obrigatório: ${op.scope}.` : 'Qualquer credencial válida.'}`, tags: [op.path.includes('analyses') ? 'Análises' : op.path === '/me' ? 'Identidade' : 'Produtos'], security: [{ bearerAuth: [] }], 'x-required-scopes': op.scope ? [op.scope] : [], parameters, responses,
      ...('request' in op ? { requestBody: { required: true, content: { 'application/json': { schema: ref(op.request), example: op.request === 'ProductBatch' ? { products: [sampleProduct] } : { scenario: sampleScenario } } } } } : {}) };
    paths[op.path] = { ...paths[op.path], [op.method]: operation };
  }
  const generated = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => { const { $schema: dialect, ...json } = z.toJSONSchema(schema, { io: name === 'ProductInput' || name === 'ProductBatch' ? 'input' : 'output', unrepresentable: 'any' }); void dialect; return [name, json]; }));
  // JSON Schema cannot infer a Zod refinement: encode the cross-field invariant explicitly.
  const feeRule = { if: { properties: { feeEnabled: { const: false } }, required: ['feeEnabled'] }, then: { properties: { feeBps: { const: 0 } } } };
  function enrich(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    const properties = object.properties as Record<string, unknown> | undefined;
    if (properties?.feeEnabled && properties?.feeBps) object.allOf = [feeRule];
    for (const [key, child] of Object.entries(object)) if (key !== 'allOf') enrich(child);
  }
  enrich(generated);
  return { openapi: '3.1.1', jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema', info: { title: 'Raio-X de Margem — API de integração', version: c.API_VERSION, description: 'Contrato v1. Produção: https://raio-x-margem.vercel.app. Sandbox disponível somente em instalação local separada. BRL em centavos, percentuais de entrada em pontos-base. Sem garantias de SLA.' }, servers: [{ url: '/api/v1', description: 'Ambiente da instalação atual; confirme sandbox ou production em GET /me. Desenvolvimento local não é sandbox público.' }], security: [{ bearerAuth: [] }], paths, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Opaque API key', description: 'Chave específica de loja, origem, ambiente e escopos. Usar somente no servidor; HTTPS em ambientes remotos.' } }, schemas: generated } };
}
