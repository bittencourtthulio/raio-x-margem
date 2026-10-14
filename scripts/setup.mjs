import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const target = '.env.local';
let contents = readFileSync(existsSync(target) ? target : '.env.example', 'utf8');
for (const name of ['SESSION_SECRET', 'RATE_LIMIT_SECRET']) {
  const expression = new RegExp(`^${name}=.*$`, 'm');
  const existing = contents.match(expression)?.[0].slice(name.length + 1).trim();
  if (!existing) {
    const line = `${name}=${randomBytes(32).toString('hex')}`;
    contents = expression.test(contents) ? contents.replace(expression, line) : `${contents}\n${line}\n`;
  }
}
writeFileSync(target, contents, { mode: 0o600 });
console.log('Configuração local pronta em .env.local. Segredos existentes foram preservados.');
