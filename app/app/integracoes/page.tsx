import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import IntegrationDashboard from '@/components/integration-dashboard';
import { currentIntegrationActor } from '@/lib/integration/human-auth';

export const metadata: Metadata = {
  title: 'Integrações | Raio X de Margem',
  robots: { index: false, follow: false },
};

export default async function IntegrationsPage() {
  const account = await currentIntegrationActor();
  if (!account) redirect('/entrar');
  return <IntegrationDashboard accountName="Sua conta" />;
}
