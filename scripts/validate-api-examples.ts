/** Runs the published TS/Python examples against an explicitly configured local sandbox. */
import './integration-env';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { typescriptExample, pythonExample } from '../lib/integration/examples';
import { API_VERSION } from '../lib/integration/contracts';

async function main() {
  if (process.env.INTEGRATION_ENVIRONMENT !== 'sandbox') throw new Error('Explicit sandbox environment required.');
  const config = JSON.parse(readFileSync('.data/integration-sandbox.json', 'utf8'));
  const base = process.env.INTEGRATION_API_BASE_URL ?? config.apiBaseUrl;
  const local = (value: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname);
  assert.equal(config.environment, 'sandbox');
  assert.ok(local(base) && local(process.env.INTEGRATION_DATABASE_URL ?? ''), 'Only loopback API/Postgres allowed.');
  const env = { ...process.env, API_BASE_URL: base, API_KEY: config.secret, STORE_ID: config.storeId };
  const temp = mkdtempSync(join(tmpdir(), 'raiox-connectors-'));
  const worker = spawn(process.execPath, ['--import', 'tsx', 'scripts/integration-worker.ts'], { cwd: process.cwd(), env, stdio: 'ignore' });
  const exited = new Promise<void>(resolveExit => worker.once('exit', () => resolveExit()));
  const results: { language: string; runtime: string; itemCount: number; contributionCents: number[] }[] = [];
  try {
    for (const connector of [{ language: 'TypeScript', source: typescriptExample, name: 'connector.mts', command: process.execPath, args: ['--import', 'tsx'], runtime: process.version }, { language: 'Python', source: pythonExample, name: 'connector.py', command: 'python3', args: [], runtime: execFileSync('python3', ['--version'], {encoding:'utf8'}).trim() }]) {
      const file = join(temp, connector.name);
      // Distinct persisted operation identities for each connector; the same fixture can be replayed.
      writeFileSync(file, connector.source.replaceAll('sandbox-catalog-0001', `sandbox-${connector.language.toLowerCase()}-catalog-0001`).replaceAll('sandbox-analysis-0001', `sandbox-${connector.language.toLowerCase()}-analysis-0001`));
      let stdout: string;
      try { stdout = execFileSync(connector.command, [...connector.args, file], { cwd: process.cwd(), env, encoding: 'utf8', timeout: 90000, stdio: ['ignore','pipe','pipe'] }); }
      catch { throw new Error(`${connector.language}: example execution failed; inspect sandbox status without exposing credentials.`); }
      const values = JSON.parse(stdout.trim()) as number[];
      assert.ok(values.length > 0 && values.every(v => v === 2100), `${connector.language}: expected sample contribution 2100`);
      results.push({language:connector.language,runtime:connector.runtime,itemCount:values.length,contributionCents:values});
      console.log(`${connector.language}: authenticated → batch → queued analysis → completed → items (${values.length}, contribution 2100).`);
    }
    const report = { contractVersion: API_VERSION, validatedAt: new Date().toISOString(), environment: 'sandbox', apiBaseUrl: base, status: 'passed', connectors: results };
    writeFileSync(resolve('.data/integration-connectors-validation.json'), JSON.stringify(report, null, 2) + '\n', {mode:0o600});
  } finally { worker.kill('SIGTERM'); await exited; rmSync(temp, {recursive:true,force:true}); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Connector validation failed.'); process.exitCode=1; });
