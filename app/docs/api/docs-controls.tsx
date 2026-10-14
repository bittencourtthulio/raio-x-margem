'use client';
import { useState, type ReactNode } from 'react';

type Entry = { id: string; title: string; detail: string; search: string };
export function DocsShell({ children, entries }: { children: ReactNode; entries: Entry[] }) {
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);
  const visible = entries.filter(entry => (entry.title + entry.detail + entry.search).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  return <div className={`api-docs${dark ? ' api-dark' : ''}`}>
    <a className="api-skip" href="#api-content">Pular para o conteúdo</a>
    <header className="api-top"><a href="/" className="api-brand"><span>✳</span> raio-x <small>DEVELOPERS</small></a><div className="api-top-right"><span className="api-version">v1.0.0 · Prévia local</span><button type="button" onClick={() => setDark(!dark)} aria-pressed={dark}>{dark ? 'Tema claro' : 'Tema escuro'}</button><a href="/app/integracoes">Área da loja ↗</a></div></header>
    <div className="api-layout"><aside className="api-sidebar"><details open><summary>Explorar documentação</summary><label className="api-search">Buscar guias, campos e operações<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="sourceVersion, cursor, erros…" /></label><nav aria-label="Documentação da API">{visible.map(entry => <a key={entry.id} href={`#${entry.id}`}><span>{entry.title}</span><small>{entry.detail}</small></a>)}{visible.length === 0 && <p role="status">Nenhum resultado. Tente um campo ou caminho.</p>}</nav><div className="api-sidebar-foot">HTTP + JSON<br />Para ERPs, pessoas e agentes.</div></details></aside><main id="api-content" className="api-main">{children}</main></div>
  </div>;
}
export function CopyBlock({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState('Copiar');
  async function copy() { try { await navigator.clipboard.writeText(text); setStatus('Copiado'); } catch { setStatus('Selecione e copie o código'); } }
  return <div className="api-code"><div><span>{label}</span><button type="button" onClick={copy} aria-label={`Copiar ${label}`}>{status}</button></div><pre><code>{text}</code></pre></div>;
}
export function CopyLlms() {
  const [status, setStatus] = useState('Copiar URL do llms.txt');
  return <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(location.origin + '/llms.txt'); setStatus('URL copiada'); } catch { setStatus('Abra /llms.txt para copiar'); } }}>{status}</button>;
}
