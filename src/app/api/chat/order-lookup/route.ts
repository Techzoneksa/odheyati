import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function normalizeMobile(raw: string): { normalized: string; variations: string[] } {
  const digits = raw.replace(/[\s\-()+\[\]]/g, '');
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let normalized = digits;
  for (let i = 0; i < arabicDigits.length; i++) {
    normalized = normalized.split(arabicDigits[i]).join(String(i));
  }

  const variations = new Set<string>();

  if (normalized.startsWith('00')) {
    const without00 = normalized.substring(2);
    variations.add(without00);
    if (without00.length >= 9) {
      variations.add(without00.slice(-9));
    }
  } else if (normalized.startsWith('+')) {
    const withoutPlus = normalized.substring(1);
    variations.add(withoutPlus);
    if (withoutPlus.length >= 9) {
      variations.add(withoutPlus.slice(-9));
    }
  } else if (normalized.startsWith('0') && normalized.length > 9) {
    const without0 = normalized.substring(1);
    variations.add(without0);
    if (without0.length >= 9) {
      variations.add(without0.slice(-9));
    }
    if (without0.startsWith('966') || without0.startsWith('971') || without0.startsWith('965') || without0.startsWith('974') || without0.startsWith('973') || without0.startsWith('968')) {
    } else {
      variations.add('966' + without0);
    }
  } else {
    variations.add(normalized);
    if (normalized.length >= 9) {
      variations.add(normalized.slice(-9));
    }
    if (normalized.length >= 7) {
      variations.add(normalized.slice(-7));
    }
  }

  return {
    normalized,
    variations: Array.from(variations).filter(v => v.length >= 7),
  };
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

function maskForDebug(str: string): string {
  if (str.length <= 4) return '****';
  return str.slice(0, 2) + '****' + str.slice(-2);
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
    const query = (body.query || '').toString().trim();

    if (!query) {
      return NextResponse.json({ error: 'الرجاء إدخال رقم الطلب أو الجوال أو البريد الإلكتروني' }, { status: 400 });
    }

    console.log('CHAT_LOOKUP:', {
      SEARCH_TYPE: query.includes('@') ? 'email' : (/\d{7,}/.test(query) ? 'numeric' : 'text'),
      HAS_QUERY: !!query,
      QUERY_LENGTH: query.length,
      QUERY_MASKED: maskForDebug(query),
    });

    let orders;

    if (query.includes('@') && query.includes('.')) {
      const email = query.toLowerCase().trim();
      console.log('CHAT_LOOKUP: searching email');
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
          proofStatus: true,
          proofToken: true,
          createdAt: true,
          files: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      console.log('CHAT_LOOKUP: email result count', orders.length);
    } else if (/^\d[\d\s\-+()\[\]]*$/.test(query.replace(/\s/g, ''))) {
      const { normalized, variations } = normalizeMobile(query);
      console.log('CHAT_LOOKUP: mobile search', {
        ORIGINAL_MASKED: maskForDebug(query.replace(/\s/g, '')),
        NORMALIZED_MASKED: maskForDebug(normalized),
        VARIATIONS_COUNT: variations.length,
        FIRST_VAR_MASKED: variations[0] ? maskForDebug(variations[0]) : 'none',
      });

      const mobileConditions = variations.map(v => ({
        OR: [
          { customerMobile: { contains: v } },
          { customerMobileLast4: { contains: v.slice(-4) } },
        ],
      }));

      orders = await prisma.order.findMany({
        where: { OR: mobileConditions },
        select: {
          orderNumber: true,
          customerName: true,
          proofStatus: true,
          proofToken: true,
          createdAt: true,
          files: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      console.log('CHAT_LOOKUP: mobile result count', orders.length);

      if (orders.length === 0) {
        console.log('CHAT_LOOKUP: falling back to orderNumber contains');
        orders = await prisma.order.findMany({
          where: {
            orderNumber: {
              contains: normalized,
              mode: 'insensitive',
            },
          },
          select: {
            orderNumber: true,
            customerName: true,
            proofStatus: true,
            proofToken: true,
            createdAt: true,
            files: { select: { type: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        console.log('CHAT_LOOKUP: orderNumber fallback result count', orders.length);
      }
    } else {
      console.log('CHAT_LOOKUP: fallback to orderNumber text search');
      orders = await prisma.order.findMany({
        where: {
          orderNumber: {
            contains: query,
            mode: 'insensitive',
          },
        },
        select: {
          orderNumber: true,
          customerName: true,
          proofStatus: true,
          proofToken: true,
          createdAt: true,
          files: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      console.log('CHAT_LOOKUP: text search result count', orders.length);
    }

    if (orders.length === 0) {
      console.log('CHAT_LOOKUP: no results found, returning not found');
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

    console.log('CHAT_LOOKUP: found', orders.length, 'order(s)', {
      FIRST_ORDER_NUMBER: orders[0]?.orderNumber,
    });

    return NextResponse.json({ found: true, orders: result });

  } catch (error) {
    console.error('CHAT_LOOKUP_FAILED:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 });
  }
}