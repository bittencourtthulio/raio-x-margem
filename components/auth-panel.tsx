'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ScanLine, ShieldCheck } from 'lucide-react';
import type { DiagnosticRequest } from '@/lib/contracts';
import styles from './auth-panel.module.css';

export type AuthConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };
export async function authenticatedPost(path: string, body: unknown = {}) {
  const csrf = await fetch('/api/auth/csrf', { cache: 'no-store' });
  if (!csrf.ok) throw new Error('Não foi possível iniciar a solicitação. Tente novamente.');
  const { token } = await csrf.json();
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível continuar. Tente novamente.');
  return result;
}
export function AuthPanel({ mode, config, destination, initialName = '', email = '' }: { mode: 'login' | 'signup' | 'profile'; config?: AuthConfig; destination: string; initialName?: string; email?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [profile, setProfile] = useState<DiagnosticRequest['lead']>({ name: initialName, contact: email, businessName: '', sector: 'retail', role: 'owner', currentControl: 'spreadsheet', systemDifficulty: false, commercialConsent: false, saveSummaryConsent: false, privacyAcknowledged: false });
  function update<K extends keyof DiagnosticRequest['lead']>(key: K, value: DiagnosticRequest['lead'][K]) { setProfile(old => ({ ...old, [key]: value })); }
  async function googleLogin() {
    setBusy(true); setError('');
    try {
      if (!config?.apiKey) throw new Error('O login está em configuração. Tente novamente em instantes.');
      const [{ initializeApp, getApps }, { initializeAuth, getAuth, inMemoryPersistence, GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver, signOut }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
      const existing = getApps().find(app => app.name === 'raiox-client');
      const app = existing ?? initializeApp(config, 'raiox-client');
      const auth = existing ? getAuth(app) : initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
      const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      try {
        const result = await authenticatedPost('/api/auth/session', { idToken: await credential.user.getIdToken() });
        window.location.assign(result.profileComplete ? destination : `/completar-cadastro${destination.includes('demo') ? '?modo=demo' : ''}`);
      } finally { await signOut(auth); }
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? 'Entrada cancelada. Quando quiser, tente novamente.' : code === 'auth/popup-blocked' ? 'Permita a janela de login neste navegador e clique em Continuar com Google novamente.' : code === 'auth/network-request-failed' ? 'Confira sua conexão e tente novamente.' : code?.startsWith('auth/') ? 'Não foi possível entrar com Google. Tente novamente em instantes.' : e instanceof Error ? e.message : 'Não foi possível entrar. Tente novamente.');
    } finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await authenticatedPost('/api/auth/profile', profile); window.location.assign(destination); } catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o cadastro.'); setBusy(false); } }
  return <div className={styles.page}><header><Link href="/" className={styles.brand}><ScanLine size={27} /><span>raio<span>×</span><small>de margem</small></span></Link><Link href="/" className={styles.back}><ArrowLeft size={15} /> Voltar ao site</Link></header><main className={styles.main}><aside><span className={styles.eyebrow}>CLAREZA COMEÇA AQUI</span><h1>Seus preços.<br />Sua conta.<br /><span>Novas perspectivas.</span></h1><p>Uma conta gratuita para encontrar os pontos de atenção nos seus produtos e simular descontos com mais clareza.</p><ul><li><Check size={18} /> Análise e simulação gratuitas</li><li><Check size={18} /> Seu catálogo fica no navegador</li><li><Check size={18} /> Contato comercial só com sua autorização</li></ul><div className={styles.privacy}><ShieldCheck size={23} /><span>Você mantém o controle dos seus dados.<br />Entrar não envia o seu catálogo.</span></div></aside><section className={styles.card} aria-labelledby="auth-title"><span className={styles.eyebrow}>{mode === 'profile' ? 'SÓ MAIS UM PASSO' : mode === 'signup' ? 'CRIE SUA CONTA GRÁTIS' : 'BEM-VINDO DE VOLTA'}</span><h2 id="auth-title">{mode === 'profile' ? 'Conte sobre o seu negócio.' : mode === 'signup' ? 'Comece pela sua conta.' : 'Entre na sua conta.'}</h2><p>{mode === 'profile' ? 'Confirme seus dados para liberar o acesso à ferramenta.' : 'Use sua conta Google para entrar com segurança. No primeiro acesso, criamos sua conta no Raio-X.'}</p>
    {mode !== 'profile' ? <><button className={styles.googleButton} onClick={googleLogin} disabled={busy || !config?.apiKey}><span aria-hidden="true" className={styles.googleIcon}>G</span>{busy ? 'Conectando com Google…' : 'Continuar com Google'}<ArrowRight size={17} /></button>{!config?.apiKey && <p role="status">A configuração do login está sendo finalizada. O acesso será liberado assim que estiver pronto.</p>}<p className={styles.note}>Você não precisa criar outra senha. Após entrar, confirme os dados do seu negócio.</p><div className={styles.switch}>{mode === 'signup' ? 'Já tem uma conta?' : 'Primeira vez por aqui?'} <Link href={`${mode === 'signup' ? '/entrar' : '/cadastro'}${destination.includes('demo') ? '?modo=demo' : ''}`}>{mode === 'signup' ? 'Entrar' : 'Criar conta grátis'}</Link></div></> : <form onSubmit={submit}><div className={styles.fields}><label>Seu nome<input required maxLength={100} autoComplete="name" value={profile.name} onChange={e=>update('name',e.target.value)} /></label><label>Email da conta<input type="email" value={email} disabled /><small>Confirmado pela sua conta Google.</small></label><label>Nome do negócio<input required maxLength={100} autoComplete="organization" value={profile.businessName} onChange={e=>update('businessName',e.target.value)} /></label><label>Segmento<select value={profile.sector} onChange={e=>update('sector',e.target.value as DiagnosticRequest['lead']['sector'])}><option value="retail">Varejo</option><option value="food">Alimentação</option><option value="services">Serviços</option><option value="other">Outro</option></select></label><label>Seu papel no negócio<select value={profile.role} onChange={e=>update('role',e.target.value as DiagnosticRequest['lead']['role'])}><option value="owner">Proprietário(a)</option><option value="manager">Gestor(a)</option><option value="employee">Colaborador(a)</option></select></label><label>Como controla seu negócio?<select value={profile.currentControl} onChange={e=>update('currentControl',e.target.value as DiagnosticRequest['lead']['currentControl'])}><option value="spreadsheet">Planilha</option><option value="notebook">Caderno</option><option value="system">Sistema</option><option value="other">Outro</option></select></label></div><label className={styles.checkbox}><input type="checkbox" required checked={profile.privacyAcknowledged} onChange={e=>update('privacyAcknowledged',e.target.checked)} /><span>Li o <Link href="/privacidade" target="_blank">aviso de privacidade</Link> sobre o uso dos meus dados para criar a conta e acessar a ferramenta.</span></label><label className={styles.checkbox}><input type="checkbox" checked={profile.commercialConsent} onChange={e=>update('commercialConsent',e.target.checked)} /><span>Aceito contato sobre o software de gestão <small>(opcional)</small></span></label><button className={styles.primary} disabled={busy}>{busy ? 'Salvando cadastro…' : 'Concluir cadastro e acessar'}<ArrowRight size={17} /></button></form>}
    {error && <p className={styles.error} role="alert">{error}</p>}<p className={styles.footnote}><Link href="/privacidade">Dados e privacidade</Link> · Margem estimada não é lucro líquido.</p></section></main></div>;
}
