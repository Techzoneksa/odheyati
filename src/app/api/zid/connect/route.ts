import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/auth';
import { OAUTH_BASE, ZID_STATE_COOKIE, getRedirectUri } from '@/lib/zid/api';

export const dynamic = 'force-dynamic';

// Starts the Zid OAuth flow. Also used as the app's "App URL" in the Zid
// partner dashboard, so installs started from Zid land here first.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard/login', process.env.APP_URL));
  }

  if (!process.env.ZID_CLIENT_ID || !process.env.ZID_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/dashboard/zid?error=not_configured', process.env.APP_URL));
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const authorizeUrl = new URL(`${OAUTH_BASE}/oauth/authorize`);
  authorizeUrl.searchParams.set('client_id', process.env.ZID_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', getRedirectUri());
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(ZID_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/api/zid',
  });
  return response;
}
