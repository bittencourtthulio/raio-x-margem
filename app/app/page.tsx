import { redirect } from 'next/navigation';
import MarginApp from '@/components/margin-app';
import { currentAccount } from '@/lib/auth/server';
export default async function Workspace({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams, account = await currentAccount();
  if (!account) redirect(`/entrar${modo === 'demo' ? '?modo=demo' : ''}`);
  if (!account.profile) redirect(`/completar-cadastro${modo === 'demo' ? '?modo=demo' : ''}`);
  return <MarginApp companyLabel={process.env.COMPANY_LABEL || 'seu próximo sistema de gestão'} erpUrl={process.env.ERP_CTA_URL || ''} privacyEmail={process.env.PRIVACY_CONTACT_EMAIL || ''} accountProfile={account.profile} accountId={account.id} initialDemo={modo === 'demo'} />;
}
