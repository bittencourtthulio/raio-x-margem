import { requireAccount, verifyCsrf } from '@/lib/auth/server';
import { completeAccount } from '@/lib/auth/account-store';
import { diagnosticSchema } from '@/lib/validation';
import { errorResponse, json, readJson } from '@/lib/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    verifyCsrf(request);
    const account = await requireAccount(request, false);
    const parsed = diagnosticSchema.shape.lead.safeParse(await readJson(request, 8192));
    if (!parsed.success) return json({ error: 'Confira os dados do negócio e aceite o aviso para criar sua conta.' }, 400);
    await completeAccount(account, { ...parsed.data, contact: account.email, saveSummaryConsent: false });
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
