import { cookies } from 'next/headers';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const SESSION_COOKIE = 'adahi_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function getSessionSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }
  return secret;
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

// The cookie is "<base64url(json)>.<hmac>". Without the signature anyone could
// write their own cookie (e.g. role: ADMIN) and get into the dashboard.
export async function createSession(user: SessionUser): Promise<string> {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    })
  ).toString('base64url');
  const sessionData = `${payload}.${signPayload(payload)}`;
  const cookieStore = await cookies();
  
  cookieStore.set(SESSION_COOKIE, sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return sessionData;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  
  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const [payload, signature] = sessionCookie.value.split('.');
    if (!payload || !signature) {
      return null;
    }

    const expected = Buffer.from(signPayload(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      return null;
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}