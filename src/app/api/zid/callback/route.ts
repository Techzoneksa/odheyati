import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/zid/crypto';
import { ZID_STATE_COOKIE, exchangeCode, getStoreProfile, registerOrderWebhooks } from '@/lib/zid/api';

export const dynamic = 'force-dynamic';

function redirectTo(path: string) {
  const response = NextResponse.redirect(new URL(path, process.env.APP_URL));
  response.cookies.set(ZID_STATE_COOKIE, '', { maxAge: 0, path: '/api/zid' });
  return response;
}

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return redirectTo('/dashboard/login');
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get(ZID_STATE_COOKIE)?.value;

  if (request.nextUrl.searchParams.get('error')) {
    return redirectTo('/dashboard/zid?error=denied');
  }

  // Installs started from Zid's side arrive without our state; restart the
  // flow from /api/zid/connect so the code is always bound to this session.
  if (!state && !expectedState) {
    return redirectTo('/api/zid/connect');
  }

  if (!code || !state || !expectedState || !sameState(state, expectedState)) {
    return redirectTo('/dashboard/zid?error=state');
  }

  try {
    const tokens = await exchangeCode(code);
    const { storeId, storeName } = await getStoreProfile(tokens);
    const webhookErrors = await registerOrderWebhooks(tokens);

    const data = {
      storeName,
      authorizationToken: encryptSecret(tokens.authorization),
      managerToken: encryptSecret(tokens.managerToken),
      refreshToken: encryptSecret(tokens.refreshToken),
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      webhooksError: webhookErrors.length > 0 ? webhookErrors.join('\n') : null,
    };

    await prisma.zidConnection.upsert({
      where: { storeId },
      update: data,
      create: { storeId, ...data },
    });

    return redirectTo(webhookErrors.length > 0 ? '/dashboard/zid?error=webhooks' : '/dashboard/zid?connected=1');
  } catch (error) {
    console.error('ZID_CONNECT_FAILED', { error: error instanceof Error ? error.message : String(error) });
    return redirectTo('/dashboard/zid?error=connect');
  }
}
