import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileLookupSchema, emailLookupSchema } from '@/lib/schemas';

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

    if (body.orderNumber !== undefined) {
      // Exact match only (no partial search), and no customer name in the
      // response, so guessing numbers reveals as little as possible.
      const orderNumber = String(body.orderNumber)
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[\s#]/g, '');

      if (!/^[A-Za-z0-9-]{3,30}$/.test(orderNumber)) {
        return NextResponse.json({ error: 'رقم الطلب غير صالح' }, { status: 400 });
      }

      // Orders moved from Salla to Zid can also be found by their Zid number.
      const orders = await prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { equals: orderNumber, mode: 'insensitive' } },
            { zidOrderId: orderNumber },
          ],
        },
        select: { id: true, orderNumber: true, proofStatus: true, proofToken: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (orders.length === 0) {
        return NextResponse.json({ error: 'لم نجد توثيقًا' }, { status: 404 });
      }

      return NextResponse.json({
        found: true,
        orders: orders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          proofStatus: o.proofStatus,
          createdAt: o.createdAt.toISOString(),
          proofToken: o.proofToken,
        })),
      });
    }

    if (body.email) {
      const parsed = emailLookupSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'إيميل غير صالح' },
          { status: 400 }
        );
      }

      const { email } = parsed.data;

      const orders = await prisma.order.findMany({
        where: {
          customerEmail: {
            equals: email.trim().toLowerCase(),
            mode: 'insensitive',
          },
        },
        select: {
          orderNumber: true,
          customerName: true,
          proofStatus: true,
          proofToken: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (orders.length === 0) {
        return NextResponse.json({ error: 'لم نجد توثيقًا' }, { status: 404 });
      }

      return NextResponse.json({
        found: true,
        orders: orders.map(o => ({
          proofToken: o.proofToken,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          proofStatus: o.proofStatus,
        }))
      });
    }

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
    console.error('Lookup error');
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    );
  }
}