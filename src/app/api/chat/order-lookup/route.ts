import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function toDigits(str: string): string {
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  let result = str;
  for (let i = 0; i < arabic.length; i++) {
    result = result.split(arabic[i]).join(String(i));
  }
  return result.replace(/[\s\-()+[\]]/g, '');
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'تم استلام طلبكم، وجاري التحضير للتنفيذ.',
    IN_PROGRESS: 'طلبكم قيد التنفيذ حاليًا، وسيتم تحديث التوثيق عند اكتماله.',
    SLAUGHTERED: 'تم تنفيذ الذبح، وجاري تجهيز ملفات التوثيق.',
    MEDIA_UPLOADED: 'توثيق طلبكم جاهز للمشاهدة.',
    READY: 'توثيق طلبكم جاهز للمشاهدة.',
    VIEWED: 'تم اكتمال التوثيق وتسليم ملفات الطلب.',
    CANCELLED: 'هذا الطلب ملغي. للتفاصيل يرجى التواصل معنا.',
  };
  return map[status] || status;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') ||
             'unknown';
  const now = Date.now();

  const clientData = rateLimit.get(ip);
  if (clientData) {
    if (now < clientData.resetTime) {
      if (clientData.count >= RATE_LIMIT) {
        return NextResponse.json({ error: 'تم تجاوز الحد المسموح، حاول لاحقًا' }, { status: 429 });
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
    const rawQuery = (body.query || '').toString().trim();

    if (!rawQuery) {
      return NextResponse.json({ error: 'الرجاء إدخال رقم الطلب أو الجوال أو البريد الإلكتروني' }, { status: 400 });
    }

    const totalOrders = await prisma.order.count();
    console.log('CHAT_LOOKUP_DB_COUNT:', totalOrders);

    const isEmailQuery = rawQuery.includes('@') && rawQuery.includes('.');
    const digitsOnly = toDigits(rawQuery);
    const isNumericQuery = /^\d{7,}$/.test(digitsOnly);

    console.log('CHAT_LOOKUP_REQUEST:', {
      RAW_QUERY_LEN: rawQuery.length,
      IS_EMAIL: isEmailQuery,
      IS_NUMERIC: isNumericQuery,
      DIGITS_ONLY_LEN: digitsOnly.length,
    });

    let orders;

    if (isEmailQuery) {
      const email = rawQuery.toLowerCase().trim();
      console.log('CHAT_LOOKUP_MODE: email search');

      orders = await prisma.order.findMany({
        where: {
          customerEmail: {
            equals: email,
            mode: 'insensitive',
          },
        },
        select: {
          orderNumber: true,
          customerName: true,
          customerMobile: true,
          customerEmail: true,
          proofStatus: true,
          proofToken: true,
          createdAt: true,
          files: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      console.log('CHAT_LOOKUP_EMAIL_RESULT:', orders.length);
    } else if (isNumericQuery) {
      console.log('CHAT_LOOKUP_MODE: numeric search — checking orderNumber + mobile in single query');

      const exactByOrder = await prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { equals: digitsOnly } },
            { orderNumber: { equals: rawQuery } },
            { orderNumber: { equals: rawQuery.toUpperCase() } },
          ],
        },
        select: {
          orderNumber: true,
          customerName: true,
          customerMobile: true,
          customerEmail: true,
          proofStatus: true,
          proofToken: true,
          createdAt: true,
          files: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (exactByOrder.length > 0) {
        console.log('CHAT_LOOKUP_EXACT_ORDER_FOUND:', exactByOrder[0].orderNumber);
        orders = exactByOrder;
      } else {
        console.log('CHAT_LOOKUP_MODE: numeric fallback to contains search across orderNumber + mobile');

        const mobileVariations: string[] = [];
        let clean = digitsOnly;

        if (clean.startsWith('00')) {
          clean = clean.substring(2);
        } else if (clean.startsWith('+')) {
          clean = clean.substring(1);
        }

        mobileVariations.push(clean);
        if (clean.startsWith('0') && clean.length > 9) {
          mobileVariations.push(clean.substring(1));
        }
        if (clean.length >= 9) {
          mobileVariations.push(clean.slice(-9));
        }
        if (clean.length >= 7) {
          mobileVariations.push(clean.slice(-7));
        }
        if (clean.startsWith('966') && clean.length > 9) {
          mobileVariations.push(clean.substring(3));
        }

        const variationsDeduped = Array.from(new Set(mobileVariations));
        console.log('CHAT_LOOKUP_MOBILE_VARIATIONS:', variationsDeduped);

        const mobileOrConditions = variationsDeduped.flatMap(v => [
          { customerMobile: { contains: v } },
          { customerMobileLast4: { contains: v.slice(-4) } },
        ]);

        const orderOrConditions = [
          { orderNumber: { contains: digitsOnly } },
          { orderNumber: { contains: rawQuery } },
        ];

        orders = await prisma.order.findMany({
          where: {
            OR: [
              ...orderOrConditions,
              ...mobileOrConditions,
            ],
          },
          select: {
            orderNumber: true,
            customerName: true,
            customerMobile: true,
            customerEmail: true,
            proofStatus: true,
            proofToken: true,
            createdAt: true,
            files: { select: { type: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        console.log('CHAT_LOOKUP_NUMERIC_RESULT:', orders.length, orders.map(o => o.orderNumber));
      }
    } else {
      console.log('CHAT_LOOKUP_MODE: text search on orderNumber + customerName');

      orders = await prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: rawQuery, mode: 'insensitive' } },
            { customerName: { contains: rawQuery, mode: 'insensitive' } },
          ],
        },
        select: {
          orderNumber: true,
          customerName: true,
          customerMobile: true,
          customerEmail: true,
          proofStatus: true,
          proofToken: true,
          createdAt: true,
          files: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      console.log('CHAT_LOOKUP_TEXT_RESULT:', orders.length);
    }

    if (orders.length === 0) {
      console.log('CHAT_LOOKUP_NOT_FOUND');
      return NextResponse.json({
        found: false,
        message: 'لم أجد طلبًا مرتبطًا بهذه البيانات. تأكد من رقم الطلب أو الجوال أو البريد الإلكتروني وحاول مرة أخرى.',
      });
    }

    const result = orders.map(o => ({
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      proofStatus: o.proofStatus,
      statusText: getStatusText(o.proofStatus),
      hasMedia: o.files.length > 0,
      proofUrl: `/proof/${o.proofToken}`,
    }));

    console.log('CHAT_LOOKUP_FOUND:', orders.length, result.map(r => r.orderNumber));

    return NextResponse.json({ found: true, orders: result });

  } catch (error) {
    console.error('CHAT_LOOKUP_FAILED:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 });
  }
}