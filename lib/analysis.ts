import type { Product, RowResult, Scenario, Summary } from './contracts';

const roundRatio = (amount: number, bps: number) => Math.floor((amount * bps + 5000) / 10000);

export function analyzeProducts(products: Product[], scenario: Scenario, invalidCount = 0): { rows: RowResult[]; summary: Summary } {
  for (const [name, value] of Object.entries({ discountBps: scenario.discountBps, targetBps: scenario.targetBps, feeBps: scenario.feeBps })) {
    if (!Number.isInteger(value) || value < 0 || value > 9900) throw new Error(`${name}: percentual fora do intervalo de 0% a 99%.`);
  }
  const summary: Summary = { validCount: products.length, invalidCount, warningCount: 0, negativeCount: 0, belowTargetCount: 0, excludedCount: 0, bands: [0, 0, 0, 0] };
  const rows = products.map((product): RowResult => {
    const simulatedPriceCents = roundRatio(product.salePriceCents, 10000 - scenario.discountBps);
    const grossCents = simulatedPriceCents - product.purchaseCostCents;
    const feeCents = scenario.feeEnabled ? roundRatio(simulatedPriceCents, scenario.feeBps) : 0;
    const contributionCents = grossCents - feeCents;
    const grossPercent = simulatedPriceCents === 0 ? null : grossCents / simulatedPriceCents * 100;
    const contributionPercent = simulatedPriceCents === 0 ? null : contributionCents / simulatedPriceCents * 100;
    const activeCents = scenario.feeEnabled ? contributionCents : grossCents;
    const activePercent = scenario.feeEnabled ? contributionPercent : grossPercent;
    if (product.alerts.length) summary.warningCount++;
    if (activeCents < 0) summary.negativeCount++;
    if (activePercent === null) summary.excludedCount++;
    else {
      if (activeCents * 10000 < scenario.targetBps * simulatedPriceCents) summary.belowTargetCount++;
      const band = activeCents < 0 ? 0 : activeCents * 10 < simulatedPriceCents ? 1 : activeCents * 5 < simulatedPriceCents ? 2 : 3;
      summary.bands[band]++;
    }
    return { ...product, simulatedPriceCents, grossCents, grossPercent, feeCents, contributionCents, contributionPercent, activeCents, activePercent };
  });
  return { rows, summary };
}

export const formatCurrency = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const formatPercent = (percent: number | null) => percent === null ? 'Não aplicável' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(percent)}%`;

export const DEMO_PRODUCTS: Product[] = [
  ['0012345678905', 'Camiseta básica', 6000, 10000],
  ['0012345678906', 'Boné de algodão', 3000, 5000],
  ['0012345678907', 'Caneca esmaltada', 6000, 5000],
  ['0012345678908', 'Ecobag estampada', 3800, 4200],
  ['0012345678909', 'Caderno pontilhado', 3500, 4000],
  ['0012345678910', 'Garrafa térmica', 5500, 8000],
  ['0012345678911', 'Meias coloridas', 0, 2500],
  ['0012345678912', 'Kit de adesivos', 900, 1500],
  ['0012345678913', 'Chaveiro de metal', 1800, 2000],
  ['0012345678914', 'Necessaire', 4200, 5500],
  ['0012345678915', 'Porta-cartões', 2700, 3000],
  ['0012345678916', 'Pochete urbana', 7000, 6500],
].map(([barcode, name, purchaseCostCents, salePriceCents], index) => ({ barcode: String(barcode), name: String(name), purchaseCostCents: Number(purchaseCostCents), salePriceCents: Number(salePriceCents), sourceRow: index + 2, alerts: purchaseCostCents === 0 ? ['Custo zero: confira se o custo foi informado.'] : [] }));
