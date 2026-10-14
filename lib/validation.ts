import { z } from 'zod';
import { MAX_RECORDS } from './csv-limits';
const count = z.number().int().min(0).max(MAX_RECORDS);
const text = z.string().trim().min(1).max(200);
export const diagnosticSchema = z.object({
  idempotencyKey: z.string().uuid(), demo: z.boolean(), honeypot: z.string().max(0),
  lead: z.object({ name: text, businessName: text, contact: z.string().trim().max(254).refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+?[\d\s()-]{10,20}$/.test(v) && v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 15, 'Informe email ou WhatsApp válido.'), sector: z.enum(['retail','food','services','other']), role: z.enum(['owner','manager','employee']), currentControl: z.enum(['system','spreadsheet','notebook','other']), currentSystem: z.string().trim().max(200).optional(), systemDifficulty: z.boolean(), commercialConsent: z.boolean(), saveSummaryConsent: z.boolean(), privacyAcknowledged: z.literal(true) }).strict(),
  scenario: z.object({ discountBps: z.number().int().min(0).max(9900), targetBps: z.number().int().min(0).max(9900), feeBps: z.number().int().min(0).max(9900), feeEnabled: z.boolean() }).strict(),
  summary: z.object({ validCount: count.min(1), invalidCount: count, warningCount: count, negativeCount: count, belowTargetCount: count, excludedCount: count, bands: z.tuple([count,count,count,count]) }).strict()
}).strict().superRefine((v, ctx) => {
  const s = v.summary;
  if (s.warningCount > s.validCount || s.validCount + s.invalidCount > MAX_RECORDS || s.bands.reduce((a,b)=>a+b,0) + s.excludedCount !== s.validCount || s.belowTargetCount > s.validCount - s.excludedCount || s.negativeCount < s.bands[0] || s.negativeCount > s.bands[0] + s.excludedCount || s.belowTargetCount < s.bands[0]) ctx.addIssue({code:'custom', message:'Contagens agregadas inconsistentes.', path:['summary']});
});
export const eventSchema = z.object({ event: z.enum(['landing_view','demo_started','file_selected','import_validated','analysis_viewed','lead_submitted','insights_generated','erp_cta_clicked']), demo: z.boolean() }).strict();
export const outputSchema = z.object({ findings: z.array(z.string().min(1).max(500)).min(1).max(3), actions: z.array(z.string().min(1).max(500)).min(1).max(3), limitations: z.array(z.string().min(1).max(500)).min(1).max(2) }).strict();
