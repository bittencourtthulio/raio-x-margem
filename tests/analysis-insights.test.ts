import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProducts, DEMO_PRODUCTS } from '../lib/analysis';
import { buildAnalysisInsights } from '../lib/analysis-insights';
import { DEFAULT_SCENARIO, type Product } from '../lib/contracts';

const product = (cost: number, price: number, sourceRow = 2): Product => ({ barcode: '', name: 'Produto', purchaseCostCents: cost, salePriceCents: price, sourceRow, alerts: [] });

test('insights reconcile target categories and unit averages including fees', () => {
  const scenario = { ...DEFAULT_SCENARIO, feeEnabled: true, feeBps: 1000, discountBps: 1000 };
  const products = [product(6000, 10000), product(8000, 10000, 3), product(12000, 10000, 4), product(100, 0, 5)];
  const { rows } = analyzeProducts(products, scenario);
  const insights = buildAnalysisInsights(rows, scenario, 1);
  assert.deepEqual(insights.counts, [1, 1, 1, 1]);
  assert.equal(insights.importPercent, 80);
  assert.ok(Math.abs(insights.atTargetPercent! - 100 / 3) < 1e-10);
  assert.ok(Math.abs(insights.averageMargin! - (-1700 / 9000 * 100 / 3)) < 1e-10);
  assert.equal(insights.averagePrice, 6750);
  assert.equal(insights.averageCost, 6525);
  assert.equal(insights.averageFee, 675);
  assert.equal(insights.averageBalance, -450);
  assert.equal(insights.averagePrice - insights.averageCost - insights.averageFee, insights.averageBalance);
  assert.deepEqual(insights.lowest.map(row => row.sourceRow), [4, 5, 3, 2]);
});

test('discount curve matches actual analysis including rounding and zero prices', () => {
  const products = [...DEMO_PRODUCTS, product(1, 1, 100), product(500, 0, 101)];
  for (const feeEnabled of [true, false]) {
    const scenario = { ...DEFAULT_SCENARIO, discountBps: 9900, feeEnabled, feeBps: 1357 };
    const { rows } = analyzeProducts(products, scenario);
    const insights = buildAnalysisInsights(rows, scenario, 0);
    assert.equal(insights.trend.at(-1)!.discountBps, 9900);
    for (const point of insights.trend) {
      const expected = analyzeProducts(products, { ...scenario, discountBps: point.discountBps }).rows.filter(row => row.activePercent !== null);
      assert.equal(point.applicable, expected.length);
      assert.equal(point.margin, expected.reduce((sum, row) => sum + row.activePercent!, 0) / expected.length);
    }
    assert.equal(insights.averageMargin, insights.trend.at(-1)!.margin);
  }
});

test('empty catalogs and inapplicable percentages never produce misleading averages', () => {
  const empty = buildAnalysisInsights([], DEFAULT_SCENARIO, 0);
  assert.equal(empty.averageMargin, null);
  assert.equal(empty.averageBalance, null);
  assert.equal(empty.atTargetPercent, null);
  assert.equal(empty.importPercent, null);
  assert.ok(empty.trend.every(point => point.margin === null));
  const scenario = { ...DEFAULT_SCENARIO, discountBps: 9900 };
  const zero = buildAnalysisInsights(analyzeProducts([product(1, 1)], scenario).rows, scenario, 1);
  assert.deepEqual(zero.counts, [0, 0, 0, 1]);
  assert.equal(zero.averageBalance, -1);
  assert.equal(zero.atTargetPercent, null);
  assert.equal(zero.importPercent, 50);
});

test('target boundary and lowest-five ranking preserve exact values and stable ties', () => {
  const products = Array.from({ length: 8 }, (_, i) => product(8000, 10000, i + 2));
  const insights = buildAnalysisInsights(analyzeProducts(products, DEFAULT_SCENARIO).rows, DEFAULT_SCENARIO, 0);
  assert.deepEqual(insights.counts, [8, 0, 0, 0]);
  assert.equal(insights.atTargetPercent, 100);
  assert.deepEqual(insights.lowest.map(row => row.sourceRow), [2, 3, 4, 5, 6]);
});
