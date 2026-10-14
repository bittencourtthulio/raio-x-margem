'use client';
import { useEffect } from 'react';
import { LandingPage } from './landing-page';
export function LandingEntry() {
  useEffect(() => { void fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(response => { if (response.ok) return fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'landing_view', demo: false }) }); }).catch(() => {}); }, []);
  return <LandingPage onStart={() => window.location.assign('/cadastro')} onDemo={() => window.location.assign('/cadastro?modo=demo')} onLogin={() => window.location.assign('/entrar')} />;
}
