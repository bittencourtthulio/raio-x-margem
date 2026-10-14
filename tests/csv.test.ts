import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCsvFile, parseCsv, parseMoney, suggestMapping, validateRows, MAX_RECORDS, MAX_FILE_BYTES } from '../lib/csv';

test('CSV BR preserves barcodes, quoted separators, multiline fields and physical source rows', () => {
  const parsed = parseCsv('\uFEFFcodigo_barras;produto;preco_compra;preco_venda\r\n00123;"Produto; azul\r\nsegunda linha";1.234,56;2.000,00\r\n\r\n00456;Outro;0;10\r\n');
  assert.equal(parsed.delimiter, ';');
  assert.deepEqual(parsed.rows.map((row) => row.sourceRow), [2, 5]);
  const result = validateRows(parsed, suggestMapping(parsed.headers), 'BR');
  assert.equal(result.errors.length, 0);
  assert.equal(result.products[0].barcode, '00123');
  assert.equal(result.products[0].purchaseCostCents, 123456);
  assert.match(result.products[0].name, /segunda linha/);
  assert.equal(result.products[1].alerts.length, 1);
});

test('US CSV supports escaped quotes and comma delimiter', () => {
  const parsed = parseCsv('name,cost,price,ean\n"Item ""azul"", especial",1234.56,"2,000.00",00123');
  const result = validateRows(parsed, suggestMapping(parsed.headers), 'US');
  assert.equal(parsed.delimiter, ',');
  assert.equal(result.products[0].name, 'Item "azul", especial');
  assert.equal(result.products[0].salePriceCents, 200000);
});

test('money rejects mixed formats, excessive decimals, negative values, missing cost and values above ceiling', () => {
  assert.equal(parseMoney(' R$ 1.234,56 ', 'BR'), 123456);
  assert.equal(parseMoney('1,234.56', 'US'), 123456);
  assert.equal(parseMoney('1000000', 'BR'), 100000000);
  for (const value of ['1,234.56', '1234.56', '1,234', '-1', '', '1000000,01', '12.34,56']) assert.throws(() => parseMoney(value, 'BR'));
  for (const value of ['1.234,56', '1.234', '12,34.56']) assert.throws(() => parseMoney(value, 'US'));
});

test('partial validation retains losses and duplicate records while reporting missing cost and zero sale', () => {
  const parsed = parseCsv('ean;nome;custo;venda\n001;Um;60;50\n001;Dois;30;50\n002;Três;;10\n003;Quatro;0;0\n1.23E+12;Cinco;0;20');
  const result = validateRows(parsed, suggestMapping(parsed.headers), 'BR');
  assert.equal(result.products.length, 3);
  assert.deepEqual(result.errors.map((error) => error.sourceRow), [4, 5]);
  assert.equal(result.duplicateCount, 1);
  assert.match(result.products[0].alerts[0], /duplicado/);
  assert.match(result.products[1].alerts[0], /duplicado/);
  assert.equal(result.products[2].alerts.length, 2);
});

test('malformed quotes, oversized inputs and excessive records block import', () => {
  assert.throws(() => parseCsv('nome;custo;venda\n"Nome;1;2'), /Aspas/);
  assert.throws(() => parseCsv('nome;custo;venda\nNome"solta;1;2'), /Aspas/);
  assert.throws(() => parseCsv('nome;custo;venda\n"Nome"solta;1;2'), /Aspas/);
  assert.throws(() => parseCsv('x'.repeat(MAX_FILE_BYTES + 1)), /2 MB/);
  assert.throws(() => parseCsv('nome;custo;venda\n' + 'Item;1;2\n'.repeat(MAX_RECORDS + 1)), /5.000/);
  assert.equal(parseCsv('nome;custo;venda\n' + 'Item;1;2\n'.repeat(MAX_RECORDS)).rows.length, MAX_RECORDS);
});

test('file decoder accepts UTF-8 BOM and rejects invalid UTF-8 and oversized files', async () => {
  const valid = new File(['\uFEFFnome;custo;venda\nCafé;1;2'], 'catalogo.csv');
  assert.equal((await decodeCsvFile(valid)).startsWith('nome'), true);
  await assert.rejects(() => decodeCsvFile(new File([new Uint8Array([0xc3, 0x28])], 'invalido.csv')), /UTF-8/);
  await assert.rejects(() => decodeCsvFile(new File(['x'.repeat(MAX_FILE_BYTES + 1)], 'grande.csv')), /2 MB/);
});

test('invalid column mappings fail and incorrect row width produces a traceable row error', () => {
  const parsed = parseCsv('nome;custo;venda\nItem;1;2;extra');
  assert.throws(() => validateRows(parsed, { barcode: null, name: 0, cost: 0, price: 2 }, 'BR'), /distinta/);
  assert.throws(() => validateRows(parsed, { barcode: null, name: 0, cost: null, price: 2 }, 'BR'), /Selecione/);
  const result = validateRows(parsed, { barcode: null, name: 0, cost: 1, price: 2 }, 'BR');
  assert.equal(result.errors[0].sourceRow, 2);
  assert.match(result.errors[0].message, /colunas/);
});
