import type { RowResult, Scenario } from './contracts';

export function buildAnalysisInsights(rows: RowResult[], scenario: Scenario, invalidCount: number) {
  const counts = [0, 0, 0, 0]; // At target, below target, negative, undefined percentage.
  let marginSum = 0, price = 0, cost = 0, fee = 0, balance = 0;
  const lowest: RowResult[] = [];
  for (const row of rows) {
    price += row.simulatedPriceCents;
    cost += row.purchaseCostCents;
    fee += row.feeCents;
    balance += row.activeCents;
    if (row.activePercent === null) counts[3]++;
    else {
      marginSum += row.activePercent;
      if (row.activeCents < 0) counts[2]++;
      else if (row.activeCents * 10000 < scenario.targetBps * row.simulatedPriceCents) counts[1]++;
      else counts[0]++;
    }
    // Keep only five rows, even for the largest supported catalogs.
    lowest.push(row);
    lowest.sort((a, b) => a.activeCents - b.activeCents || a.sourceRow - b.sourceRow);
    if (lowest.length > 5) lowest.pop();
  }
  const applicable = rows.length - counts[3];
  const discounts = [...new Set([0, 500, 1000, 1500, 2000, scenario.discountBps])].sort((a, b) => a - b);
  const trend = discounts.map(discountBps => {
    let sum = 0, count = 0;
    for (const row of rows) {
      const simulated = Math.floor((row.salePriceCents * (10000 - discountBps) + 5000) / 10000);
      if (!simulated) continue;
      const fees = scenario.feeEnabled ? Math.floor((simulated * scenario.feeBps + 5000) / 10000) : 0;
      sum += (simulated - row.purchaseCostCents - fees) / simulated * 100;
      count++;
    }
    return { discountBps, margin: count ? sum / count : null, applicable: count };
  });
  const average = (value: number) => rows.length ? value / rows.length : 0;
  return {
    counts, applicable, lowest, trend,
    averageMargin: applicable ? marginSum / applicable : null,
    atTargetPercent: applicable ? counts[0] / applicable * 100 : null,
    importPercent: rows.length + invalidCount ? rows.length / (rows.length + invalidCount) * 100 : null,
    averagePrice: average(price), averageCost: average(cost), averageFee: average(fee),
    averageBalance: rows.length ? average(balance) : null,
  };
}
