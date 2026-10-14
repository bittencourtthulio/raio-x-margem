import { z } from 'zod';

export const API_VERSION = '1.0.0';
export const LIMITS = { batchProducts: 500, batchBytes: 1_048_576, activeProducts: 5000, pageDefault: 100, pageMax: 500, readsPerMinute: 120, batchesPerMinute: 20, analysesPerHour: 5, analysesPerDay: 20, snapshotMinutes: 30, changesDays: 90, idempotencyDays: 7 } as const;
export const scopeSchema = z.enum(['products:read', 'products:write', 'analyses:read', 'analyses:write']);
export type IntegrationScope = z.infer<typeof scopeSchema>;
const safeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso.datetime();
export const productInputSchema = z.object({
  externalId: z.string().min(1).max(100).regex(/^\S(?:[\s\S]*\S)?$/, 'Sem espaços externos.'),
  sourceVersion: safeInteger.min(1),
  name: z.string().trim().min(1).max(200),
  barcode: z.string().max(100).nullable().default(null),
  purchaseCostCents: z.number().int().min(0).max(100_000_000),
  salePriceCents: z.number().int().min(1).max(100_000_000),
  active: z.boolean(),
  sourceUpdatedAt: timestamp.nullable().optional(),
}).strict();
export const productBatchSchema = z.object({ products: z.array(productInputSchema).min(1).max(LIMITS.batchProducts) }).strict().superRefine(({ products }, ctx) => {
  const ids = new Set<string>();
  products.forEach((p, index) => { if (ids.has(p.externalId)) ctx.addIssue({ code: 'custom', path: ['products', index, 'externalId'], message: 'externalId repetido no lote.' }); ids.add(p.externalId); });
});
export const scenarioSchema = z.object({ discountBps: z.number().int().min(0).max(9900), targetBps: z.number().int().min(0).max(9900), feeBps: z.number().int().min(0).max(9900), feeEnabled: z.boolean() }).strict().refine(v => v.feeEnabled || v.feeBps === 0, { path: ['feeBps'], message: 'Taxa desativada exige feeBps=0.' });
export const analysisRequestSchema = z.object({ scenario: scenarioSchema }).strict();
export const paginationQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(LIMITS.pageMax).default(LIMITS.pageDefault), cursor: z.string().min(1).max(4096).optional() }).strict();
export const productSchema = productInputSchema.extend({ id: z.string(), storeId: z.string(), sourceId: z.string(), revision: safeInteger, createdAt: timestamp, updatedAt: timestamp, alerts: z.array(z.string()) });
export const batchResultSchema = z.object({ data: z.array(z.object({ externalId: z.string(), id: z.string(), status: z.enum(['created', 'updated', 'unchanged']), sourceVersion: safeInteger, revision: safeInteger })) });
export const productPageSchema = z.object({ data: z.array(productSchema), snapshotId: z.string(), asOfRevision: safeInteger, nextCursor: z.string().nullable(), changesCursor: z.string() });
export const changeSchema = z.object({ productId: z.string(), externalId: z.string(), sourceVersion: safeInteger, revision: safeInteger, operation: z.enum(['upsert', 'deactivate']), changedAt: timestamp, product: productSchema });
export const changePageSchema = z.object({ data: z.array(changeSchema), nextCursor: z.string().nullable(), changesCursor: z.string() });
const count = safeInteger;
export const summarySchema = z.object({ validCount: count, invalidCount: z.literal(0), warningCount: count, negativeCount: count, belowTargetCount: count, excludedCount: count, bands: z.tuple([count, count, count, count]) });
export const analysisSchema = z.object({ id: z.string(), storeId: z.string(), status: z.enum(['queued', 'running', 'completed', 'failed']), scenario: scenarioSchema, catalogRevision: safeInteger, calculationVersion: z.string(), createdAt: timestamp, completedAt: timestamp.nullable(), summary: summarySchema.nullable(), error: z.string().nullable().optional() });
export const analysisAcceptedSchema = z.object({ analysisId: z.string(), status: z.literal('queued'), url: z.string() });
export const analysisPageSchema = z.object({ data: z.array(analysisSchema), nextCursor: z.string().nullable() });
const money = z.number().int(); const percent = z.number().nullable();
export const analysisItemSchema = z.object({ product: productSchema, simulatedPriceCents: money, grossCents: money, grossPercent: percent, feeCents: money, contributionCents: money, contributionPercent: percent, activePercent: percent, activeCents: money });
export const analysisItemsPageSchema = z.object({ data: z.array(analysisItemSchema), nextCursor: z.string().nullable() });
export const meSchema = z.object({ storeId: z.string(), sourceId: z.string(), environment: z.enum(['sandbox', 'production']), scopes: z.array(scopeSchema), limits: z.object({ batchProducts: count, batchBytes: count, activeProducts: count, pageDefault: count, pageMax: count, readsPerMinute: count, batchesPerMinute: count, analysesPerHour: count, analysesPerDay: count, snapshotMinutes: count, changesDays: count, idempotencyDays: count }) });
export const problemSchema = z.object({ type: z.string(), title: z.string(), status: z.number().int(), detail: z.string(), instance: z.string(), code: z.string(), requestId: z.string(), errors: z.array(z.object({ index: z.number().int().optional(), field: z.string(), reason: z.string() })).optional() });
export type ProductInput = z.infer<typeof productInputSchema>;
export type IntegrationProduct = z.infer<typeof productSchema>;
export type IntegrationAnalysis = z.infer<typeof analysisSchema>;
