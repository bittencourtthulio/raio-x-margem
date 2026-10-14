import { redirect } from 'next/navigation';
import { AuthPanel } from '@/components/auth-panel';
import { currentAccount, safeDestination } from '@/lib/auth/server';
export default async function Profile({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams, destination = safeDestination(modo), account = await currentAccount();
  if (!account) redirect(`/cadastro${modo === 'demo' ? '?modo=demo' : ''}`);
  if (account.profile) redirect(destination);
  return <AuthPanel mode="profile" initialName={account.name} email={account.email} destination={destination} />;
}
