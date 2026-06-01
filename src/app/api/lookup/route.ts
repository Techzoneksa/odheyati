import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lookupSchema } from '@/lib/schemas';

const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 1000;

function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
         request.headers.get('x-real-ip') ||
         'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const now = Date.now();

  const clientData = rateLimit.get(ip);
  
  if (clientData) {
    if (now < clientData.resetTime) {
      if (clientData.count >= RATE_LIMIT) {
        return NextResponse.json(
          { error: 'تم تجاوز الحد المسموح، حاول لاحقاً' },
          { status: 429 }
        );
      }
      clientData.count++;
    } else {
      rateLimit.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    }
  } else {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
  }

  try {
    const body = await request.json();
    const parsed = lookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { found: false },
        { status: 400 }
      );
    }

    const { orderNumber, mobileLast4 } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      return NextResponse.json({ found: false });
    }

    if (order.customerMobileLast4 !== mobileLast4) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, token: order.proofToken });
  } catch (error) {
    console.error('Lookup error:', error);
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    );
  }
}