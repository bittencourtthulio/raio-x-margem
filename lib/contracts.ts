export type Product = { barcode: string; name: string; purchaseCostCents: number; salePriceCents: number; sourceRow: number; alerts: string[] };
export type Scenario = { discountBps: number; targetBps: number; feeBps: number; feeEnabled: boolean };
export type RowResult = Product & { simulatedPriceCents: number; grossCents: number; grossPercent: number | null; feeCents: number; contributionCents: number; contributionPercent: number | null; activePercent: number | null; activeCents: number };
export type Summary = { validCount: number; invalidCount: number; warningCount: number; negativeCount: number; belowTargetCount: number; excludedCount: number; bands: [number, number, number, number] };
export type Sector = 'retail' | 'food' | 'services' | 'other';
export type DiagnosticRequest = { idempotencyKey: string; demo: boolean; honeypot: string; lead: { name: string; businessName: string; contact: string; sector: Sector; role: 'owner' | 'manager' | 'employee'; currentControl: 'system' | 'spreadsheet' | 'notebook' | 'other'; currentSystem?: string; systemDifficulty: boolean; commercialConsent: boolean; saveSummaryConsent: boolean; privacyAcknowledged: boolean }; scenario: Scenario; summary: Summary };
export type DiagnosticResult = { id: string; source: 'ai' | 'fallback' | 'mock'; findings: string[]; actions: string[]; limitations: string[] };
export const DEFAULT_SCENARIO: Scenario = { discountBps: 0, targetBps: 2000, feeBps: 0, feeEnabled: false };
