import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { processZidWebhookLog } from '@/lib/zid/orders';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Zid does not sign webhook payloads; the only sender check it offers is the
// Basic Auth credentials we register with each webhook (see registerOrderWebhooks).
function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;

  return safeEqual(decoded.slice(0, separator), 'zid') && safeEqual(decoded.slice(separator + 1), secret);
}

export async function POST(request: Request) {
  const secret = process.env.ZID_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = new URL(request.url).searchParams.get('event') || 'unknown';
  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const dedupKey = crypto.createHash('sha256').update(`zid\n${event}\n${rawBody}`).digest('hex');

  let logId: string;
  try {
    const log = await prisma.webhookLog.create({
      data: { event: `zid:${event}`, payload: payload as Prisma.InputJsonValue, dedupKey },
      select: { id: true },
    });
    logId = log.id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw error;
    }
    // Zid redelivered a payload we already have. Reprocess it only if the
    // earlier attempt did not finish.
    const existing = await prisma.webhookLog.findUnique({ where: { dedupKey }, select: { id: true, processed: true } });
    if (!existing || existing.processed) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    logId = existing.id;
  }

  const outcome = await processZidWebhookLog(logId);
  if (!outcome.ok && outcome.retry) {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
