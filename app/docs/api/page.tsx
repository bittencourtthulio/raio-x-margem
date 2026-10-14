import type { Metadata } from 'next';
import { Braces, Download, FileText, Package } from 'lucide-react';
import { API_VERSION } from '@/lib/integration/contracts';
import { createOpenApi, operations, sampleProduct, sampleScenario } from '@/lib/integration/openapi';
import { guides } from '@/lib/integration/docs-content';
import { curlExample, typescriptExample, pythonExample } from '@/lib/integration/examples';
import { CopyBlock, CopyLlms, DocsShell } from './docs-controls';
import './docs.css';

export const metadata: Metadata = { title: 'API para ERPs | Raio-X de Margem', description: 'Contrato, guias e exemplos para integrar catálogos e análises de margem.', alternates: { types: { 'text/markdown': '/docs/api/overview.md', 'text/plain': '/llms.txt' } } };
export default function ApiDocs() {
  const spec = createOpenApi();
  const entries = [ ...guides.map(g => ({ id: g.slug, title: g.title, detail: 'GUIA', search: g.text })), ...operations.map(op => ({ id: op.operationId, title: op.title, detail: op.method.toUpperCase() + ' ' + op.path, search: op.description + JSON.stringify(spec.components.schemas[op.response]) })), { id: 'examples', title: 'Exemplos completos', detail: 'CURL · TYPESCRIPT · PYTHON', search: 'linguagem código SDK' } ];
  return <DocsShell entries={entries}>
    <link rel="describedby" href="/llms.txt" type="text/plain" />
    <link rel="alternate" href="/docs/api/overview.md" type="text/markdown" />
    <div className="api-breadcrumb">Documentação <span>/</span> API de integração</div>
    <section className="api-downloads" aria-labelledby="api-downloads-title">
      <div className="api-downloads-heading"><div><span className="api-eyebrow">RECURSOS PARA INTEGRAR</span><h2 id="api-downloads-title">Tudo para começar, em um download.</h2></div><span className="api-downloads-version">API {API_VERSION}</span></div>
      <div className="api-download-grid">
        <a className="api-download-card" href="/openapi.json" download="openapi.json"><Braces size={23} aria-hidden="true" /><strong>OpenAPI <span>JSON</span></strong><p>Contrato completo com endpoints, schemas e respostas.</p><span className="api-download-label">Baixar openapi.json <Download size={15} aria-hidden="true" /></span></a>
        <a className="api-download-card" href="/llms.txt" download="llms.txt"><FileText size={23} aria-hidden="true" /><strong>LLM.txt <span>TXT</span></strong><p>Índice da documentação para usar com seus agentes de IA.</p><span className="api-download-label">Baixar llms.txt <Download size={15} aria-hidden="true" /></span></a>
        <a className="api-download-card" href="/downloads/raio-x-margem-api-skill.zip" download="raio-x-margem-api-skill.zip"><Package size={23} aria-hidden="true" /><strong>Skill do projeto <span>ZIP</span></strong><p>Instruções e referências para integrar com Codex, Claude Code e OpenCode.</p><span className="api-download-label">Baixar Skill <Download size={15} aria-hidden="true" /></span></a>
      </div>
      <div className="api-downloads-foot"><a href="/llms-full.txt" download="llms-full.txt">Baixar documentação completa em texto ↗</a><CopyLlms /></div>
    </section>
    <section className="api-hero"><div className="api-eyebrow">UM CONTRATO. QUALQUER ERP.</div><h1>Seu catálogo.<br /><em>Uma nova perspectiva.</em></h1><p>Envie produtos, acompanhe mudanças e transforme preços em análises de margem. Uma API comum para o seu sistema e os seus agentes.</p><div className="api-actions"><a className="api-primary" href="#quickstart">Começar a integrar <span>↗</span></a><a href="#reference">Explorar referência HTTP ↗</a></div><div className="api-facts"><div><strong>09</strong><span>operações REST</span></div><div><strong>BRL</strong><span>valores em centavos</span></div><div><strong>v1</strong><span>contrato {API_VERSION}</span></div></div></section>
    <div className="api-notice"><strong>API de integração</strong><p>A produção está disponível em raio-x-margem-five.vercel.app. Para testes, use uma instalação local separada e confirme o ambiente em <code>GET /me</code>.</p></div>
    <div className="api-index"><span>NESTA PÁGINA</span><a href="#quickstart">Primeira integração</a><a href="#reference">Referência HTTP</a><a href="#examples">Exemplos</a><a href="#ai-integration">Skill e agentes</a></div>
    {guides.map((guide, i) => <section className="api-section" key={guide.slug} id={guide.slug}><div className="api-section-heading"><span>{String(i + 1).padStart(2, '0')}</span><h2>{guide.title}</h2><a href={`/docs/api/${guide.slug}.md`} rel="alternate" type="text/markdown">Markdown ↗</a></div>{guide.text.split('\n\n').map((paragraph, j) => <p key={j}>{paragraph}</p>)}{guide.slug === 'ai-integration' && <><p>Instalação conferida nas documentações oficiais: <a href="https://learn.chatgpt.com/docs/build-skills">Codex</a>, <a href="https://code.claude.com/docs/en/skills">Claude Code</a> e <a href="https://opencode.ai/docs/skills/">OpenCode</a>.</p><div className="api-actions"><a className="api-primary" href="/downloads/raio-x-margem-api-skill.zip" download>Baixar skill de prévia ↓</a><a href="/downloads/raio-x-margem-api-skill.json">Versão, tamanho e SHA-256</a><a href="/docs/api/skill/SKILL.md">Ler SKILL.md</a></div></>}</section>)}
    <section id="reference" className="api-section"><div className="api-eyebrow">REFERÊNCIA HTTP</div><h2>Nove operações. Um fluxo completo.</h2><p>Base relativa: <code>/api/v1</code>. Headers privados: <code>Authorization: Bearer</code>. Respostas de erro usam <code>application/problem+json</code>. Expanda o contrato para ver parâmetros, schemas e respostas de cada operação.</p></section>
    {operations.map(op => {
      const contract = spec.paths[op.path][op.method];
      const body = 'request' in op ? JSON.stringify(op.request === 'ProductBatch' ? { products: [sampleProduct] } : { scenario: sampleScenario }, null, 2) : undefined;
      const path = op.path.replaceAll('{storeId}', '$STORE_ID').replaceAll('{productId}', '$PRODUCT_ID').replaceAll('{analysisId}', '$ANALYSIS_ID') + (op.operationId === 'listProductChanges' ? '?cursor=$CHANGES_CURSOR' : '');
      const curl = `curl --fail-with-body "$API_BASE_URL${path}" \\\n  -H "Authorization: Bearer $API_KEY"${body ? ` \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: $OPERATION_KEY" \\\n  --data-binary '${body}'` : ''}`;
      return <section className="api-operation" key={op.operationId} id={op.operationId}><div className="api-method-path"><b className={op.method === 'post' ? 'api-post' : ''}>{op.method.toUpperCase()}</b><code>/api/v1{op.path}</code></div><h3>{op.title}</h3><p>{op.description}</p><div className="api-operation-meta"><span>operationId <code>{op.operationId}</code></span><span>Escopo <code>{op.scope || 'chave válida'}</code></span><span>Sucesso <strong>{op.operationId === 'createAnalysis' ? '202 + Location' : '200'}</strong></span></div><CopyBlock text={curl} label="cURL" /><details className="api-contract"><summary>Parâmetros, respostas e erros · OpenAPI</summary><pre>{JSON.stringify(contract, null, 2)}</pre></details>{'request' in op && <details className="api-contract"><summary>Schema de entrada · {op.request}</summary><pre>{JSON.stringify(spec.components.schemas[op.request], null, 2)}</pre></details>}<details className="api-contract"><summary>Schema de resposta · {op.response}</summary><pre>{JSON.stringify(spec.components.schemas[op.response], null, 2)}</pre></details></section>;
    })}
    <section className="api-section" id="examples"><h2>Do primeiro produto ao resultado.</h2><p>Exemplos sem dependências de SDK. Configure as variáveis no servidor e execute apenas com autorização de escrita no sandbox. Fluxo sandbox validado com Node.js 22.23.3 e Python 3.11.7, retornando contribuição de 2100 centavos. Pré-requisitos: Node.js ≥22.13, Python ≥3.11 e cURL com <code>--fail-with-body</code>. <a href="/docs/api/examples.md">Ler exemplos em Markdown ↗</a></p><CopyBlock label="cURL · primeiro produto" text={curlExample} /><CopyBlock label="TypeScript · fluxo completo" text={typescriptExample} /><CopyBlock label="Python · fluxo completo" text={pythonExample} /></section>
    <footer className="api-footer"><span>Raio-X de Margem / Developers</span><a href="/llms-full.txt">Documentação completa em texto ↗</a><span>Contrato {API_VERSION}</span></footer>
  </DocsShell>;
}
