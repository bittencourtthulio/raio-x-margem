import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProducts } from '../lib/analysis';
import { DEFAULT_SCENARIO, type Product } from '../lib/contracts';

const product = (cost: number, price: number, sourceRow = 2): Product => ({ barcode: '', name: 'Produto', purchaseCostCents: cost, salePriceCents: price, sourceRow, alerts: [] });

test('reference calculation: price 100, cost 60, discount 10%, fee 10%', () => {
  const baseline = analyzeProducts([product(6000, 10000)], DEFAULT_SCENARIO);
  assert.equal(baseline.rows[0].grossCents, 4000);
  assert.equal(baseline.rows[0].grossPercent, 40);
  const { rows, summary } = analyzeProducts([product(6000, 10000)], { ...DEFAULT_SCENARIO, discountBps: 1000, feeBps: 1000, feeEnabled: true });
  assert.equal(rows[0].simulatedPriceCents, 9000);
  assert.equal(rows[0].feeCents, 900);
  assert.equal(rows[0].contributionCents, 2100);
  assert.ok(Math.abs(rows[0].activePercent! - 23.33333333) < 0.000001);
  assert.deepEqual(summary.bands, [0, 0, 0, 1]);
});

test('negative margins are retained; fixed bands and target use the same active basis', () => {
  const products = [product(6000, 5000), product(9600, 10000, 3), product(8500, 10000, 4), product(8000, 10000, 5)];
  const result = analyzeProducts(products, DEFAULT_SCENARIO, 2);
  assert.equal(result.rows[0].grossPercent, -20);
  assert.equal(result.summary.negativeCount, 1);
  assert.equal(result.summary.belowTargetCount, 3);
  assert.equal(result.summary.invalidCount, 2);
  assert.deepEqual(result.summary.bands, [1, 1, 1, 1]);
  const withFees = analyzeProducts(products, { ...DEFAULT_SCENARIO, feeEnabled: true, feeBps: 1000 });
  assert.equal(withFees.summary.negativeCount, 2);
  assert.deepEqual(withFees.summary.bands, [2, 1, 1, 0]);
});

test('monetary ties round up and zero simulated price excludes only percentage statistics', () => {
  const rounded = analyzeProducts([product(0, 1)], { ...DEFAULT_SCENARIO, discountBps: 5000, feeEnabled: true, feeBps: 5000 });
  assert.equal(rounded.rows[0].simulatedPriceCents, 1);
  assert.equal(rounded.rows[0].feeCents, 1);
  const zero = analyzeProducts([product(1, 1)], { ...DEFAULT_SCENARIO, discountBps: 9900 });
  assert.equal(zero.rows[0].simulatedPriceCents, 0);
  assert.equal(zero.rows[0].activeCents, -1);
  assert.equal(zero.rows[0].activePercent, null);
  assert.equal(zero.summary.negativeCount, 1);
  assert.equal(zero.summary.excludedCount, 1);
  assert.equal(zero.summary.belowTargetCount, 0);
  assert.deepEqual(zero.summary.bands, [0, 0, 0, 0]);
});

test('fees disabled ignore the stored fee; analysis is pure and reports warning records', () => {
  const input = product(6000, 10000);
  input.alerts = ['Conferir código', 'Conferir custo'];
  const snapshot = structuredClone(input);
  const result = analyzeProducts([input], { ...DEFAULT_SCENARIO, feeBps: 9900 });
  assert.equal(result.rows[0].feeCents, 0);
  assert.equal(result.rows[0].activePercent, 40);
  assert.equal(result.summary.warningCount, 1);
  assert.deepEqual(input, snapshot);
  assert.throws(() => analyzeProducts([input], { ...DEFAULT_SCENARIO, discountBps: 9901 }), /intervalo/);
  assert.throws(() => analyzeProducts([input], { ...DEFAULT_SCENARIO, discountBps: 10.5 }), /intervalo/);
});
