import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createOpenApi } from '../lib/integration/openapi';
import { API_VERSION } from '../lib/integration/contracts';
import { guides, endpointMarkdown } from '../lib/integration/docs-content';
import { examplesMarkdown } from '../lib/integration/examples';
const write = (path: string, content: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
const contract = JSON.stringify(createOpenApi(), null, 2) + '\n';
write('public/docs/api/v1/openapi.json', contract);
for (const guide of guides) write(`public/docs/api/${guide.slug}.md`, `# ${guide.title}\n\nVersão ${API_VERSION}\n\n${guide.text}\n${guide.slug === 'ai-integration' ? '\nFontes de instalação: [Codex](https://learn.chatgpt.com/docs/build-skills), [Claude Code](https://code.claude.com/docs/en/skills), [OpenCode](https://opencode.ai/docs/skills/).\n' : ''}`);
write('public/docs/api/reference.md', endpointMarkdown);
write('public/docs/api/examples.md', examplesMarkdown);
const skill = `---\nname: raio-x-margem-api\ndescription: Construir, revisar e depurar conectores de ERP para a API Raio-X de Margem, com catálogo, sincronização e análises, na linguagem e projeto escolhidos pelo usuário.\n---\n\n# Integrar Raio-X de Margem\n\nContrato ${API_VERSION}, versão publicada. Leia [contrato e configuração](references/api-contract.md) e confira info.version em [OpenAPI incluído](assets/openapi.json) contra a instalação de destino. Use operationId e schemas reais. Produção: https://raio-x-margem-five.vercel.app. Publicação pelo titular, sem licença adicional de reutilização.\n\nConfigure API_BASE_URL, API_KEY e STORE_ID no servidor por variáveis de ambiente ou cofre. Não peça segredos em texto público. GET /me deve confirmar loja, origem, ambiente e escopos. Construir um conector não autoriza escrever em produção. O pacote não executa nada ao instalar ou ler.\n\nPreserve externalId estável e zeros de barcode; dinheiro inteiro em centavos BRL, percentuais de entrada em pontos-base. Valide conversões sem ponto flutuante impreciso. Campos desconhecidos são rejeitados e cada envio substitui os campos completos. Não invente endpoints, campos nem suporte a webhooks.\n\nPara carga e retomada, leia [sincronização](references/synchronization.md): lotes atômicos, sourceVersion durável, bootstrap consistente e cursor salvo somente após aplicar a página. Persista Idempotency-Key por operação antes da chamada e reutilize em retry.\n\nPara falhas e polling, leia [erros e retries](references/errors-and-retries.md). Não repita conflitos indiscriminadamente. No máximo cinco tentativas com jitter, respeitando Retry-After. Registre requestId, código e contagens sem token ou payload do catálogo.\n\nPara validar, leia [exemplos](references/examples.md). Use sandbox autorizado e dados fictícios. A análise usa snapshot imutável, não altera preços e não significa lucro líquido. Entregue integração na stack do usuário, configuração documentada e evidência observada do fluxo sandbox. Se não houver ambiente executável, relate o impedimento sem alegar validação real.\n`;
write('public/docs/api/skill/SKILL.md', skill);
const temp = mkdtempSync(join(tmpdir(), 'raio-x-skill-'));
try {
  const root = join(temp, 'raio-x-margem-api');
  write(join(root, 'SKILL.md'), skill);
  write(join(root, 'assets/openapi.json'), contract);
  write(join(root, 'LICENSE'), 'Copyright 2026 Thulio Bittencourt — Todos os direitos reservados\n\nEste pacote é publicado pelo titular junto ao projeto Raio-X de Margem. Nenhuma licença adicional de reutilização ou cessão de direitos é concedida por este arquivo.\n');
  write(join(root, 'references/api-contract.md'), `# Contrato ${API_VERSION}\n\nO contrato completo está em ../assets/openapi.json; compare info.version com /openapi.json da instalação. A URL base inclui /api/v1.\n\n${guides.find(g => g.slug === 'authentication')!.text}\n\n${guides.find(g => g.slug === 'models')!.text}\n`);
  for (const slug of ['synchronization', 'errors-and-retries']) { const guide = guides.find(g => g.slug === slug)!; write(join(root, `references/${slug}.md`), `# ${guide.title}\n\n${guide.text}\n`); }
  write(join(root, 'references/examples.md'), examplesMarkdown);
  mkdirSync('public/downloads', {recursive:true});
  const zip = join(process.cwd(), `public/downloads/raio-x-margem-api-skill-${API_VERSION}.zip`);
  // ZIP stored entries with fixed timestamps: reproducible across releases and no extra npm dependency.
  execFileSync('python3', ['-c', `import pathlib,zipfile,sys\nroot=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED) as z:\n for p in sorted(root.rglob('*')):\n  if p.is_file():\n   info=zipfile.ZipInfo(str(p.relative_to(root.parent)),date_time=(2026,10,14,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,p.read_bytes())`, root, zip]);
  const bytes = readFileSync(zip);
  writeFileSync('public/downloads/raio-x-margem-api-skill.zip', bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  write('public/downloads/raio-x-margem-api-skill.json', JSON.stringify({ version: API_VERSION, contractVersion: API_VERSION, status: 'published', license: 'UNLICENSED', file: `/downloads/raio-x-margem-api-skill-${API_VERSION}.zip`, bytes: bytes.length, sha256 }, null, 2) + '\n');
  write('public/downloads/raio-x-margem-api-skill.sha256', `${sha256}  raio-x-margem-api-skill-${API_VERSION}.zip\n`);
  console.log(`API ${API_VERSION}: ${guides.length} guias, OpenAPI, skill (${bytes.length} bytes).`);
} finally { rmSync(temp, {recursive:true, force:true}); }
