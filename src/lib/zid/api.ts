import type { ZidConnection } from '@prisma/client';
import { decryptSecret } from './crypto';
import type { ZidOrderPayload } from './mapper';

// Overridable only so the flow can be exercised against a local mock server.
const API_BASE = process.env.ZID_API_BASE_URL || 'https://api.zid.sa/v1';
export const OAUTH_BASE = process.env.ZID_OAUTH_BASE_URL || 'https://oauth.zid.sa';
const REQUEST_TIMEOUT_MS = 15000;

export const ZID_STATE_COOKIE = 'zid_oauth_state';

// Order events we subscribe to; each gets its own target_url so the receiver
// knows which event it is handling.
export const ZID_ORDER_EVENTS = ['order.create', 'order.status.update', 'order.payment_status.update'];

export interface ZidTokens {
  authorization: string;
  managerToken: string;
}

export interface ZidTokenResponse extends ZidTokens {
  refreshToken: string;
  expiresIn: number;
}

export class ZidApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ZidApiError';
  }
}

export function getRedirectUri(): string {
  return `${process.env.APP_URL}/api/zid/callback`;
}

export function getWebhookUrl(event: string): string {
  return `${process.env.APP_URL}/api/webhooks/zid?event=${encodeURIComponent(event)}`;
}

export function tokensFromConnection(connection: ZidConnection): ZidTokens {
  return {
    authorization: decryptSecret(connection.authorizationToken),
    managerToken: decryptSecret(connection.managerToken),
  };
}

async function zidRequest<T>(
  tokens: ZidTokens,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { query?: Record<string, string>; body?: unknown } = {}
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(options.query || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${tokens.authorization}`,
      'X-Manager-Token': tokens.managerToken,
      'Accept-Language': 'en',
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    // Never include headers or tokens in the error.
    throw new ZidApiError(`Zid API ${method} ${path} responded with ${response.status}`, response.status);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export async function exchangeCode(code: string): Promise<ZidTokenResponse> {
  const response = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ZID_CLIENT_ID || '',
      client_secret: process.env.ZID_CLIENT_SECRET || '',
      redirect_uri: getRedirectUri(),
      code,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ZidApiError(`Zid token exchange responded with ${response.status}`, response.status);
  }

  const data = await response.json();
  if (!data.authorization || !data.access_token || !data.refresh_token) {
    throw new Error('Zid token response is missing tokens');
  }

  return {
    authorization: data.authorization,
    managerToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in) || 0,
  };
}

export async function getStoreProfile(tokens: ZidTokens): Promise<{ storeId: string; storeName: string | null }> {
  const data = await zidRequest<{ user?: { store?: { id?: number | string; title?: string } } }>(
    tokens,
    'GET',
    '/managers/account/profile'
  );

  const storeId = data.user?.store?.id;
  if (storeId === undefined || storeId === null || String(storeId) === '') {
    throw new Error('Zid profile response has no store id');
  }

  return { storeId: String(storeId), storeName: data.user?.store?.title || null };
}

// Fetches a single order straight from Zid, so unsigned webhook payloads are
// never trusted as the source of truth.
export async function fetchZidOrder(tokens: ZidTokens, orderId: string): Promise<ZidOrderPayload | null> {
  const data = await zidRequest<{ orders?: ZidOrderPayload[] }>(tokens, 'GET', '/managers/store/orders', {
    query: { order_id: orderId, payload_type: 'default', page: '1', per_page: '1' },
  });

  return data.orders?.find((o) => String(o.id) === orderId) ?? null;
}

// Re-registers our order webhooks: removes the ones this app created before
// (so reconnecting never duplicates deliveries), then creates one per event.
export async function registerOrderWebhooks(tokens: ZidTokens): Promise<string[]> {
  const appId = process.env.ZID_APP_ID || process.env.ZID_CLIENT_ID || '';
  const errors: string[] = [];

  try {
    await zidRequest(tokens, 'DELETE', '/managers/webhooks', { query: { original_id: appId } });
  } catch {
    // Nothing to delete on first connect.
  }

  for (const event of ZID_ORDER_EVENTS) {
    try {
      await zidRequest(tokens, 'POST', '/managers/webhooks', {
        body: {
          event,
          target_url: getWebhookUrl(event),
          original_id: appId,
          username: 'zid',
          password: process.env.ZID_WEBHOOK_SECRET,
        },
      });
    } catch (error) {
      errors.push(`${event}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return errors;
}
