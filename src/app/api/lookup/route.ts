import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileLookupSchema } from '@/lib/schemas';

const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
         request.headers.get('x-real-ip') ||
         'unknown';
}

function normalizeMobile(countryCode: string, mobile: string): string {
  let cleaned = mobile.replace(/[\s\-()+\[\]]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith(countryCode)) {
    return countryCode + cleaned.substring(countryCode.length);
  }
  return countryCode + cleaned;
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
    const parsed = mobileLookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة' },
        { status: 400 }
      );
    }

    const { countryCode, mobile } = parsed.data;
    const normalizedMobile = normalizeMobile(countryCode, mobile);

    const orders = await prisma.order.findMany({
      where: {
        customerMobile: normalizedMobile,
        proofStatus: {
          not: 'CANCELLED',
        },
      },
      select: {
        id: true,
        orderNumber: true,
        proofStatus: true,
        proofToken: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (orders.length === 0) {
      return NextResponse.json({ error: 'لم نجد توثيقًا' });
    }

    if (orders.length === 1) {
      return NextResponse.json({ 
        found: true, 
        token: orders[0].proofToken,
        orders: orders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          proofStatus: o.proofStatus,
          createdAt: o.createdAt.toISOString(),
          proofToken: o.proofToken,
        }))
      });
    }

    return NextResponse.json({ 
      found: true,
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        proofStatus: o.proofStatus,
        createdAt: o.createdAt.toISOString(),
        proofToken: o.proofToken,
      }))
    });
  } catch (error) {
    console.error('Lookup error:', error);
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    );
  }
}