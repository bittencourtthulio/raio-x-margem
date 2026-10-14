import { guides } from '@/lib/integration/docs-content';
import { DocsShell } from '../docs-controls';
import '../docs.css';

export default function Errors() {
  const guide = guides.find(g => g.slug === 'errors-and-retries')!;
  return <DocsShell entries={[{ id: guide.slug, title: guide.title, detail: 'GUIA', search: guide.text }]}>
    <div className="api-breadcrumb"><a href="/docs/api">Documentação</a> <span>/</span> Erros e retries</div>
    <section className="api-section" id={guide.slug}>
      <div className="api-eyebrow">GUIA DE INTEGRAÇÃO</div>
      <h1>{guide.title}</h1>
      {guide.text.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      <div className="api-actions"><a className="api-primary" href="/docs/api#errors-and-retries">Voltar à documentação ↗</a><a href="/docs/api/errors-and-retries.md">Versão Markdown ↗</a></div>
    </section>
  </DocsShell>;
}
