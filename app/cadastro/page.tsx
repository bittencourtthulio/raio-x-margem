import { redirect } from 'next/navigation';
import { AuthPanel } from '@/components/auth-panel';
import { currentAccount, safeDestination } from '@/lib/auth/server';
import { webAuthConfig } from '@/lib/auth/config';
export default async function Signup({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams, destination = safeDestination(modo), account = await currentAccount();
  if (account) redirect(account.profile ? destination : `/completar-cadastro${modo === 'demo' ? '?modo=demo' : ''}`);
  return <AuthPanel mode="signup" config={webAuthConfig()} destination={destination} />;
}
