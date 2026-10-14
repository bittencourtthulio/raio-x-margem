import Papa from 'papaparse';
import type { Product } from './contracts';

export type Delimiter = ';' | ',';
export type NumberFormat = 'BR' | 'US';
export type ColumnMapping = { barcode: number | null; name: number | null; cost: number | null; price: number | null };
export type ParsedCsv = { headers: string[]; rows: { sourceRow: number; cells: string[] }[]; delimiter: Delimiter };
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_RECORDS = 5000;

// Papa handles CSV structure; this additional check rejects stray quotes which
// its permissive parser otherwise treats as ordinary unquoted characters.
function hasMalformedQuotes(record: string, delimiter: Delimiter): boolean {
  let state: 'start' | 'plain' | 'quoted' | 'closed' = 'start';
  for (let index = 0; index < record.length; index++) {
    const char = record[index];
    if (state === 'quoted') {
      if (char === '"') {
        if (record[index + 1] === '"') index++;
        else state = 'closed';
      }
      continue;
    }
    if (char === delimiter || char === '\r' || char === '\n') { state = 'start'; continue; }
    if (char === '"') {
      if (state !== 'start') return true;
      state = 'quoted';
    } else {
      if (state === 'closed') return true;
      state = 'plain';
    }
  }
  return state === 'quoted';
}

export async function decodeCsvFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error('O arquivo ultrapassa 25 MB. Exporte um catálogo menor.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error('Encoding inválido. Exporte o arquivo em CSV UTF-8.');
  }
}

export function parseCsv(rawText: string, delimiter?: Delimiter): ParsedCsv {
  if (new TextEncoder().encode(rawText).length > MAX_FILE_BYTES) throw new Error('O arquivo ultrapassa 25 MB.');
  const text = rawText.replace(/^\uFEFF/, '');
  const records: ParsedCsv['rows'] = [];
  let cursor = 0;
  let physicalLine = 1;
  let chosen: Delimiter = delimiter ?? ';';
  let failure: string | null = null;
  Papa.parse<string[]>(text, {
    delimiter: delimiter ?? '',
    delimitersToGuess: [';', ','],
    skipEmptyLines: false,
    step(result, parser) {
      const startLine = physicalLine;
      const consumed = text.slice(cursor, result.meta.cursor);
      physicalLine += (consumed.match(/\r\n|\r|\n/g) ?? []).length;
      cursor = result.meta.cursor;
      if (result.meta.delimiter === ';' || result.meta.delimiter === ',') chosen = result.meta.delimiter;
      const malformed = result.errors.find((error) => error.type === 'Quotes');
      if (malformed || hasMalformedQuotes(consumed, chosen)) {
        failure = `Aspas malformadas na linha ${startLine}. Confira os campos entre aspas.`;
        parser.abort();
        return;
      }
      const cells = result.data;
      if (cells.every((cell) => !cell.trim())) return;
      records.push({ sourceRow: startLine, cells });
      if (records.length > MAX_RECORDS + 1) {
        failure = 'O arquivo ultrapassa 5.000 registros. Divida o catálogo em arquivos menores.';
        parser.abort();
      }
    },
  });
  if (failure) throw new Error(failure);
  const header = records.shift();
  if (!header) throw new Error('O arquivo está vazio. Inclua um cabeçalho e produtos.');
  if (!records.length) throw new Error('O arquivo tem apenas cabeçalho. Inclua ao menos um produto.');
  return { headers: header.cells.map((cell) => cell.trim()), rows: records, delimiter: chosen };
}

const aliases = {
  barcode: ['codigo_barras', 'codigo_de_barras', 'cod_barras', 'barcode', 'ean', 'gtin'],
  name: ['produto', 'nome', 'descricao', 'description', 'name', 'nome_produto', 'descricao_produto'],
  cost: ['preco_compra', 'preco_de_compra', 'custo', 'preco_custo', 'valor_compra', 'purchase_cost', 'cost'],
  price: ['preco_venda', 'preco_de_venda', 'valor_venda', 'venda', 'sale_price', 'price', 'preco'],
};
function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}
export function suggestMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const find = (field: keyof typeof aliases) => {
    const index = normalized.findIndex((header) => aliases[field].includes(header));
    return index < 0 ? null : index;
  };
  return { barcode: find('barcode'), name: find('name'), cost: find('cost'), price: find('price') };
}

export function parseMoney(value: string, format: NumberFormat): number {
  const input = value.trim().replace(/^R\$\s*/, '');
  if (!input) throw new Error('valor ausente');
  const pattern = format === 'BR'
    ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/
    : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
  if (!pattern.test(input)) throw new Error(`valor inválido para formato ${format}; use até duas casas decimais e valores não negativos`);
  const decimal = format === 'BR' ? ',' : '.';
  const grouping = format === 'BR' ? /\./g : /,/g;
  const [whole, fraction = ''] = input.replace(grouping, '').split(decimal);
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000) throw new Error('valor acima do limite de R$ 1.000.000,00');
  return cents;
}

export function validateRows(parsed: ParsedCsv, mapping: ColumnMapping, format: NumberFormat) {
  const selected = [mapping.name, mapping.cost, mapping.price];
  if (selected.some((column) => column === null || !Number.isInteger(column) || column < 0 || column >= parsed.headers.length)) {
    throw new Error('Selecione as colunas de produto, custo e preço de venda.');
  }
  const allColumns = mapping.barcode === null ? selected : [...selected, mapping.barcode];
  if (new Set(allColumns).size !== allColumns.length) throw new Error('Cada campo deve usar uma coluna distinta.');
  if (mapping.barcode !== null && (!Number.isInteger(mapping.barcode) || mapping.barcode < 0 || mapping.barcode >= parsed.headers.length)) throw new Error('A coluna de código de barras é inválida.');
  const products: Product[] = [];
  const errors: { sourceRow: number; message: string }[] = [];
  for (const row of parsed.rows) {
    try {
      if (row.cells.length !== parsed.headers.length) throw new Error('Quantidade de colunas diferente do cabeçalho. Confira o delimitador.');
      const name = row.cells[mapping.name!].trim();
      if (!name || name.length > 200) throw new Error('Produto deve ter nome entre 1 e 200 caracteres.');
      let purchaseCostCents: number;
      let salePriceCents: number;
      try { purchaseCostCents = parseMoney(row.cells[mapping.cost!], format); }
      catch (error) { throw new Error(`Custo: ${(error as Error).message}.`); }
      try { salePriceCents = parseMoney(row.cells[mapping.price!], format); }
      catch (error) { throw new Error(`Preço de venda: ${(error as Error).message}.`); }
      if (salePriceCents === 0) throw new Error('Preço de venda deve ser maior que zero.');
      const barcode = mapping.barcode === null ? '' : row.cells[mapping.barcode].trim();
      const alerts: string[] = [];
      if (purchaseCostCents === 0) alerts.push('Custo zero: confira se o custo foi informado.');
      if (/^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(barcode)) alerts.push('Código em notação científica: reexporte a coluna como texto; zeros não podem ser reconstruídos.');
      products.push({ barcode, name, purchaseCostCents, salePriceCents, sourceRow: row.sourceRow, alerts });
    } catch (error) {
      errors.push({ sourceRow: row.sourceRow, message: (error as Error).message });
    }
  }
  const counts = new Map<string, number>();
  for (const product of products) if (product.barcode) counts.set(product.barcode, (counts.get(product.barcode) ?? 0) + 1);
  let duplicateCount = 0;
  for (const count of counts.values()) duplicateCount += Math.max(0, count - 1);
  for (const product of products) if (product.barcode && counts.get(product.barcode)! > 1) product.alerts.push('Código de barras duplicado: cadastro mantido separadamente.');
  return { products, errors, duplicateCount };
}
