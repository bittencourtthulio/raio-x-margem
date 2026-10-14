'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Copy, Database, FileText, KeyRound, Link2, LoaderCircle, Plus, RefreshCw, ShieldCheck, Store, Unplug, X } from 'lucide-react';
import styles from './integration-dashboard.module.css';

type Scope = 'products:read' | 'products:write' | 'analyses:read' | 'analyses:write';
type StoreRecord = { id: string; name: string; role: 'owner' | 'viewer'; environment?: string };
type Source = { id: string; name: string; active?: boolean; status?: string };
type Credential = { id: string; prefix: string; scopes: Scope[]; expiresAt: string; revokedAt: string | null; createdAt: string };
type Product = { id: string; externalId: string; name: string; purchaseCostCents: number; salePriceCents: number; active: boolean };
type Analysis = { id: string; status: string; createdAt: string; catalogRevision: number; calculationVersion: string; summary: { validCount: number; negativeCount: number; belowTargetCount: number; warningCount: number } | null; scenario?: { discountBps: number; targetBps: number; feeBps: number; feeEnabled: boolean } };
type Dashboard = { store: StoreRecord; sources: Source[]; credentials: Credential[]; products: Product[]; analyses: Analysis[]; productCount: number; lastSyncedAt: string | null; noticeVersion: string };
type Overview = { stores: StoreRecord[]; noticeVersion: string; environment: string };
type Confirmation = { action: 'revokeCredential' | 'disconnectSource' | 'deleteStoreData'; id?: string };
const scopeLabels: Record<Scope, string> = { 'products:read': 'Consultar catálogo', 'products:write': 'Enviar e atualizar produtos', 'analyses:read': 'Consultar análises', 'analyses:write': 'Solicitar análises' };
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Aguardando primeiro envio';
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
const statusLabel: Record<string, string> = { queued: 'Na fila', running: 'Calculando', completed: 'Concluída', failed: 'Falhou' };

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 503) throw new Error('A integração está temporariamente indisponível. Se esta é uma nova instalação, o administrador precisa configurar o Postgres e aplicar as migrações da API. Tente atualizar em instantes.');
    if (response.status === 401) throw new Error('Sua sessão expirou. Entre novamente para continuar.');
    throw new Error(body.detail || body.error?.message || body.message || 'Não foi possível concluir a solicitação. Tente novamente.');
  }
  return body as T;
}

export default function IntegrationDashboard({ accountName }: { accountName: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [storeId, setStoreId] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newStore, setNewStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [scopes, setScopes] = useState<Scope[]>(['products:read', 'products:write', 'analyses:read', 'analyses:write']);
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [deletionName, setDeletionName] = useState('');
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const refreshVersion = useRef(0);
  const confirmationRef = useRef<HTMLElement>(null);
  useEffect(() => { if (confirmation) confirmationRef.current?.focus(); }, [confirmation]);
  const owner = dashboard?.store.role === 'owner';
  const source = dashboard?.sources.find(item => item.active);
  const sourceActive = !!source && source.active !== false && source.status !== 'disconnected';
  const noticeVersion = dashboard?.noticeVersion || overview?.noticeVersion || '';

  async function refresh(selected = storeId) {
    const version = ++refreshVersion.current;
    setLoading(true);
    setError('');
    try {
      const data = await readResponse<Overview>(await fetch('/api/integration', { cache: 'no-store' }));
      if (version !== refreshVersion.current) return;
      setOverview(data);
      const nextId = data.stores.some(store => store.id === selected) ? selected : data.stores[0]?.id || '';
      setStoreId(nextId);
      if (nextId) {
        const detail = await readResponse<Dashboard>(await fetch(`/api/integration?storeId=${encodeURIComponent(nextId)}`, { cache: 'no-store' }));
        if (version === refreshVersion.current) setDashboard(detail);
      } else setDashboard(null);
    } catch (err) { if (version === refreshVersion.current) setError(err instanceof Error ? err.message : 'Não foi possível carregar as integrações.'); }
    finally { if (version === refreshVersion.current) setLoading(false); }
  }

  useEffect(() => { void refresh(''); return () => { refreshVersion.current++; }; }, []); // Initial authenticated load only.

  async function mutate(action: string, fields: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const csrf = await readResponse<{ token: string }>(await fetch('/api/auth/csrf', { cache: 'no-store' }));
      const result = await readResponse<{ secret?: string; store?: StoreRecord; id?: string }>(await fetch('/api/integration', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        body: JSON.stringify({ action, ...fields }),
      }));
      if (result.secret) { setSecret(result.secret); setCopied(false); }
      if (action === 'createStore') { setNewStore(false); setStoreName(''); }
      if (action === 'createSource') { setAuthorized(false); setSourceName(''); }
      if (['deleteStoreData', 'disconnectSource', 'revokeCredential'].includes(action)) setSecret('');
      setConfirmation(null);
      setDeletionName('');
      setNotice(action === 'deleteStoreData' ? 'Dados da integração desta loja excluídos.' : action === 'disconnectSource' ? 'Integração desconectada. As credenciais foram revogadas.' : action === 'rotateCredential' ? 'Nova chave emitida. Atualize o conector: a chave anterior deixa de funcionar em até 24 horas.' : 'Alteração salva.');
      await refresh(action === 'createStore' ? result.store?.id || result.id || '' : storeId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }

  function switchStore(id: string) {
    setStoreId(id); setDashboard(null); setSecret(''); setConfirmation(null); setNotice(''); setAuthorized(false); setSourceName(''); setExpandedAnalysis(null);
    void refresh(id);
  }
  function toggleScope(scope: Scope, checked: boolean) {
    setScopes(current => {
      let next = checked ? [...current, scope] : current.filter(item => item !== scope);
      if (scope === 'analyses:write' && checked && !next.includes('analyses:read')) next.push('analyses:read');
      if (scope === 'analyses:read' && !checked) next = next.filter(item => item !== 'analyses:write');
      return next;
    });
  }
  function submit(event: FormEvent, action: string, fields: Record<string, unknown>) { event.preventDefault(); void mutate(action, fields); }

  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/app" className={styles.brand} aria-label="Raio X de Margem, voltar ao painel"><span className={styles.brandMark}>x</span><span>raio x<span className={styles.brandSub}>DE MARGEM</span></span></Link>
      <nav aria-label="Navegação da integração"><Link href="/app"><ArrowLeft size={15} /> Meu painel</Link><Link href="/docs/api">Documentação <ArrowUpRight size={15} /></Link></nav>
    </header>
    <main className={styles.main}>
      <div className={styles.heading}><div><span className={styles.eyebrow}>SEU CATÁLOGO, CONECTADO</span><h1>Integrações<span>.</span></h1><p>Do seu sistema de gestão para uma visão clara das margens.</p></div><div className={styles.account}><ShieldCheck size={17} /><span>{accountName}<small>Área autenticada</small></span></div></div>
      <div className={styles.toolbar}><div className={styles.storeSelect}><Store size={18} /><label htmlFor="integration-store">Loja<select id="integration-store" value={storeId} onChange={event => switchStore(event.target.value)} disabled={busy || loading || !overview?.stores.length}>{!overview?.stores.length && <option value="">Nenhuma loja cadastrada</option>}{overview?.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label></div><div className={styles.toolbarActions}><span className={styles.environment}>{(dashboard?.store.environment || overview?.environment) === 'production' ? 'Produção' : (dashboard?.store.environment || overview?.environment) === 'sandbox' ? 'Sandbox · dados de teste' : 'Ambiente da integração'}</span><button className={styles.secondary} onClick={() => void refresh()} disabled={busy || loading} aria-label="Atualizar integrações"><RefreshCw size={15} /></button><button className={styles.secondary} onClick={() => setNewStore(value => !value)} disabled={busy || !overview}><Plus size={15} /> Nova loja</button></div></div>
      {error && <div className={styles.error} role="alert"><strong>Não foi possível concluir.</strong><p>{error}</p><div className={styles.actions}><button className={styles.secondary} onClick={() => void refresh()} disabled={loading || busy}>Tentar novamente</button><Link href="/entrar">Entrar novamente</Link><Link href="/docs/api">Ajuda de configuração</Link></div></div>}
      {notice && <div className={styles.notice} role="status"><Check size={17} />{notice}</div>}
      {(newStore || (!loading && overview?.stores.length === 0)) && <section className={styles.panel}><div className={styles.panelTitle}><Store size={19} /><h2>Sua primeira conexão começa pela loja</h2></div><p>Cadastre o nome que identifica este catálogo. Cada loja tem sua própria origem, dados e credenciais.</p><form className={styles.inlineForm} onSubmit={event => submit(event, 'createStore', { name: storeName.trim() })}><label>Nome da loja<input autoComplete="organization" maxLength={100} required value={storeName} onChange={event => setStoreName(event.target.value)} placeholder="Ex.: Loja Centro" /></label><button className={styles.primary} disabled={busy || !storeName.trim()}><Plus size={16} /> Criar loja</button></form></section>}
      {loading && <div className={styles.loading} role="status"><LoaderCircle className={styles.spinner} size={20} /> Carregando suas integrações…</div>}
      {secret && <section className={styles.secretPanel} aria-labelledby="secret-title"><div className={styles.panelHead}><div className={styles.panelTitle}><KeyRound size={20} /><h2 id="secret-title">Copie sua chave agora</h2></div><button className={styles.iconButton} onClick={() => setSecret('')} aria-label="Ocultar chave definitivamente"><X size={20} /></button></div><p>Esta é a única exibição. Guarde em um gerenciador de segredos e configure apenas no servidor do conector. A chave desaparece ao sair ou atualizar esta página.</p><div className={styles.secretValue}><code>{secret}</code><button className={styles.secondary} onClick={async () => { try { await navigator.clipboard.writeText(secret); setCopied(true); } catch { setError('Não foi possível copiar. Selecione e copie a chave manualmente.'); } }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copiada' : 'Copiar'}</button></div><button className={styles.textButton} onClick={() => setSecret('')}>Já guardei. Ocultar chave.</button></section>}
      {dashboard && !loading && <>
        <section className={styles.stats} aria-label="Resumo da integração"><div><span>CATÁLOGO INTEGRADO</span><strong>{dashboard.productCount.toLocaleString('pt-BR')}<small>produtos</small></strong></div><div><span>ÚLTIMO ENVIO</span><strong className={styles.dateValue}>{date(dashboard.lastSyncedAt)}</strong></div><div><span>ORIGEM</span><strong className={styles.sourceValue}><i className={sourceActive ? styles.onlineDot : styles.offlineDot} />{sourceActive ? source?.name : 'Desconectada'}</strong><small>Uma origem de escrita por loja</small></div></section>
        <div className={styles.columns}><section className={styles.panel}><div className={styles.panelHead}><div className={styles.panelTitle}><Link2 size={19} /><h2>Conexão com o ERP</h2></div><span className={styles.step}>01</span></div>{sourceActive ? <><div className={styles.connected}><span className={styles.connectedIcon}><Check size={24} /></span><div><h3>{source?.name}</h3><p>Origem autorizada para esta loja</p></div></div><dl className={styles.details}><dt>Identificador da loja</dt><dd><code>{dashboard.store.id}</code></dd><dt>Identificador da origem</dt><dd><code>{source?.id}</code></dd></dl><p className={styles.finePrint}>Produtos enviados pelo ERP ficam disponíveis no catálogo abaixo. Nenhuma simulação altera os preços no seu sistema.</p>{owner && <button className={styles.textButton} disabled={busy} onClick={() => setConfirmation({ action: 'disconnectSource', id: source?.id })}><Unplug size={15} /> Desconectar origem</button>}</> : dashboard.sources.length > 0 ? <div className={styles.emptySmall}>Esta origem foi desconectada. Para iniciar outra integração, exclua os dados desta loja e crie uma nova loja com uma nova autorização. O catálogo anterior continua disponível abaixo até a exclusão.</div> : owner ? <form onSubmit={event => submit(event, 'createSource', { storeId, name: sourceName.trim(), noticeVersion, authorized: true })}><p>Identifique o sistema responsável por enviar os produtos e autorize o armazenamento.</p><label>Nome do ERP ou conector<input maxLength={100} required value={sourceName} onChange={event => setSourceName(event.target.value)} placeholder="Ex.: Meu sistema de gestão" /></label><div className={styles.privacy}><ShieldCheck size={20} /><div><strong>Você controla os dados da integração.</strong><p>Serão armazenados nomes, códigos, custos, preços e análises dos produtos enviados. O acesso fica restrito à sua loja e às credenciais autorizadas.</p><p>O catálogo é mantido até você excluir os dados da loja. Desconectar interrompe o acesso do conector e mantém os dados disponíveis para você decidir sobre a exclusão. Análises, alterações e auditoria técnica são mantidas por 90 dias. Produtos individuais não são enviados à IA.</p><Link href="/privacidade">Ler aviso de privacidade</Link></div></div><label className={styles.checkbox}><input type="checkbox" required checked={authorized} onChange={event => setAuthorized(event.target.checked)} /><span>Autorizo armazenar e processar o catálogo e as análises desta loja para a integração, conforme o aviso acima.<small>Aviso {noticeVersion || 'aguardando configuração'}. Esta autorização não inclui contato comercial.</small></span></label><button className={styles.primary} disabled={busy || !authorized || !sourceName.trim() || !noticeVersion}><Link2 size={16} /> Autorizar e conectar</button></form> : <p>O responsável pela loja pode autorizar uma conexão de origem.</p>}</section>
        <section className={styles.panel}><div className={styles.panelHead}><div className={styles.panelTitle}><KeyRound size={19} /><h2>Credenciais de acesso</h2></div><span className={styles.step}>02</span></div><p>Conceda ao conector apenas as permissões necessárias. Cada chave tem validade inicial de 90 dias.</p>{owner && sourceActive && <form onSubmit={event => submit(event, 'issueCredential', { storeId, sourceId: source!.id, scopes })}><fieldset className={styles.scopes}><legend>Permissões da nova chave</legend>{(Object.keys(scopeLabels) as Scope[]).map(scope => <label className={styles.checkbox} key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={event => toggleScope(scope, event.target.checked)} /><span>{scopeLabels[scope]}<small>{scope}</small></span></label>)}</fieldset><button className={styles.primary} disabled={busy || scopes.length === 0 || !!secret}><Plus size={16} /> Emitir chave</button>{secret && <p className={styles.finePrint}>Guarde e oculte a chave exibida antes de emitir outra.</p>}</form>}{!sourceActive && <div className={styles.emptySmall}>Conecte uma origem para emitir uma chave.</div>}<div className={styles.credentialList}>{dashboard.credentials.map(credential => { const expired = new Date(credential.expiresAt).getTime() <= Date.now(); return <article className={styles.credential} key={credential.id}><div className={styles.panelHead}><code>{credential.prefix}…</code><span className={styles.tag}>{credential.revokedAt ? 'Revogada' : expired ? 'Expirada' : 'Ativa'}</span></div><p>{credential.scopes.map(scope => scopeLabels[scope]).join(' · ')}</p><small>Validade: {date(credential.expiresAt)}</small>{owner && !credential.revokedAt && !expired && <div className={styles.actions}><button className={styles.textButton} disabled={busy || !!secret} onClick={() => void mutate('rotateCredential', { storeId, credentialId: credential.id })}><RefreshCw size={13} /> Rotacionar</button><button className={styles.dangerLink} disabled={busy} onClick={() => setConfirmation({ action: 'revokeCredential', id: credential.id })}>Revogar</button></div>}</article>; })}</div></section></div>
        <section className={styles.panel}><div className={styles.panelHead}><div className={styles.panelTitle}><Database size={19} /><h2>Catálogo integrado</h2></div><span className={styles.tag}>{dashboard.productCount} produtos</span></div><p>Valores cadastrados na origem. A integração não recebe arquivos usados anteriormente na ferramenta de CSV.</p>{dashboard.products.length ? <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Tabela do catálogo integrado"><table><caption>Exibindo {dashboard.products.length} de {dashboard.productCount} produtos. Para consultar todo o catálogo, use a API paginada.</caption><thead><tr><th>Produto / ID no ERP</th><th>Custo de compra</th><th>Preço de venda</th><th>Situação</th></tr></thead><tbody>{dashboard.products.map(product => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.externalId}</small></td><td>{money(product.purchaseCostCents)}</td><td>{money(product.salePriceCents)}</td><td><span className={styles.tag}>{product.active ? 'Ativo' : 'Inativo'}</span></td></tr>)}</tbody></table></div> : <div className={styles.empty}><Database size={28} /><h3>Seu catálogo aparece aqui</h3><p>Após configurar a chave no conector, envie o primeiro lote de produtos.</p><Link href="/docs/api">Ver como enviar produtos <ArrowUpRight size={14} /></Link></div>}</section>
        <section className={styles.panel}><div className={styles.panelHead}><div className={styles.panelTitle}><FileText size={19} /><h2>Últimas análises</h2></div><span className={styles.tag}>Snapshots do catálogo</span></div><p>Cada análise preserva os preços e custos da revisão capturada. Os resultados estimam margens, não lucro líquido.</p>{dashboard.analyses.length ? <div className={styles.analysisList}>{dashboard.analyses.map(analysis => <article key={analysis.id} className={styles.analysis}><button className={styles.analysisToggle} aria-expanded={expandedAnalysis === analysis.id} aria-controls={`analysis-${analysis.id}`} onClick={() => setExpandedAnalysis(value => value === analysis.id ? null : analysis.id)}><span><strong>{date(analysis.createdAt)}</strong><small>Revisão {analysis.catalogRevision} · cálculo {analysis.calculationVersion}</small></span><span className={styles.tag}>{statusLabel[analysis.status] || analysis.status}</span><ChevronDown size={17} /></button>{expandedAnalysis === analysis.id && <div id={`analysis-${analysis.id}`} className={styles.analysisDetail}>{analysis.summary ? <dl className={styles.summary}><div><dt>Produtos analisados</dt><dd>{analysis.summary.validCount}</dd></div><div><dt>Margem negativa</dt><dd>{analysis.summary.negativeCount}</dd></div><div><dt>Abaixo da meta</dt><dd>{analysis.summary.belowTargetCount}</dd></div><div><dt>Com alertas</dt><dd>{analysis.summary.warningCount}</dd></div></dl> : <p>{analysis.status === 'failed' ? 'O processamento falhou. Consulte o status pela API para orientar uma nova solicitação.' : 'Aguardando conclusão do processamento. Atualize a página para consultar o resultado.'}</p>}{analysis.scenario && <p>Desconto: {analysis.scenario.discountBps / 100}% · Meta: {analysis.scenario.targetBps / 100}% · Taxa: {analysis.scenario.feeEnabled ? `${analysis.scenario.feeBps / 100}%` : 'desativada'}</p>}<code className={styles.analysisId}>{analysis.id}</code></div>}</article>)}</div> : <div className={styles.emptySmall}>Nenhuma análise solicitada. O conector pode solicitar o cálculo após concluir o envio do catálogo.</div>}</section>
        {owner && <section className={styles.dataControl}><div><h2>Seus dados, sob seu controle.</h2><p>Desconectar interrompe o acesso do conector. Excluir remove os dados de integração desta loja.</p></div><button className={styles.dangerButton} disabled={busy} onClick={() => { setConfirmation({ action: 'deleteStoreData' }); setDeletionName(''); }}>Excluir dados da loja</button></section>}
      </>}
      {confirmation && dashboard && <section ref={confirmationRef} tabIndex={-1} className={styles.confirmation} role="alertdialog" aria-modal="false" aria-labelledby="confirmation-title" aria-describedby="confirmation-description"><h2 id="confirmation-title">{confirmation.action === 'deleteStoreData' ? 'Excluir os dados desta loja?' : confirmation.action === 'disconnectSource' ? 'Desconectar esta origem?' : 'Revogar esta chave?'}</h2><p id="confirmation-description">{confirmation.action === 'deleteStoreData' ? 'O acesso será bloqueado e o catálogo, as análises e os snapshots da integração serão excluídos imediatamente. Esta ação não pode ser desfeita.' : confirmation.action === 'disconnectSource' ? 'Todas as chaves desta origem serão revogadas e novos envios serão interrompidos. Para remover também o catálogo e as análises, use a exclusão dos dados.' : 'O conector deixa de autenticar novas chamadas com esta chave imediatamente. Se precisa substituí-la sem interrupção, cancele e use a rotação.'}</p>{confirmation.action === 'deleteStoreData' && <label>Digite “{dashboard.store.name}” para confirmar<input autoComplete="off" value={deletionName} onChange={event => setDeletionName(event.target.value)} /></label>}<div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button><button className={styles.dangerButton} disabled={busy || (confirmation.action === 'deleteStoreData' && deletionName !== dashboard.store.name)} onClick={() => void mutate(confirmation.action, { storeId, ...(confirmation.action === 'disconnectSource' ? { sourceId: confirmation.id } : confirmation.action === 'revokeCredential' ? { credentialId: confirmation.id } : {}) })}>{busy ? 'Processando…' : 'Confirmar'}</button></div></section>}
      <footer className={styles.footer}><span><ShieldCheck size={14} /> Catálogo isolado por loja</span><Link href="/docs/api">Contrato público da API <ArrowUpRight size={13} /></Link><Link href="/privacidade">Privacidade</Link></footer>
    </main>
  </div>;
}
