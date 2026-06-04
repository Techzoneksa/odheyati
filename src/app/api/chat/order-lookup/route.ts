import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function normalizeMobileForChat(mobile: string): string[] {
  const variations: string[] = [];
  let cleaned = mobile.replace(/[\s\-()+\[\]]/g, '');

  const countryCodes = ['966', '971', '965', '974', '973', '968'];

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
    variations.push(cleaned);
  }

  if (cleaned.startsWith('0') && cleaned.length > 9) {
    cleaned = cleaned.substring(1);
  }

  let detectedCode = '966';
  for (const code of countryCodes) {
    if (cleaned.startsWith(code)) {
      detectedCode = code;
      break;
    }
  }

  variations.push(cleaned);

  if (cleaned.startsWith(detectedCode)) {
    const localNum = cleaned.substring(detectedCode.length);
    variations.push(localNum);
    if (localNum.startsWith('0')) {
      variations.push(localNum.substring(1));
    }
  }

  for (const code of countryCodes) {
    if (!cleaned.startsWith(code) && cleaned.length >= 9) {
      variations.push(code + cleaned);
    }
  }

  if (cleaned.length >= 9) {
    variations.push(cleaned.slice(-9));
  }

  if (cleaned.length >= 7) {
    variations.push(cleaned.slice(-7));
  }

  return Array.from(new Set(variations)).filter(v => v.length >= 7);
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
    const query = (body.query || '').toString().trim();

    if (!query) {
      return NextResponse.json({ error: 'الرجاء إدخال رقم الطلب أو الجوال أو البريد الإلكتروني' }, { status: 400 });
    }

    let orders;

    if (query.includes('@')) {
      const email = query.toLowerCase().trim();
      orders = await prisma.order.findMany({
        where: {
          customerEmail: {
            contains: email,
            mode: 'insensitive',
          },
        },
        select: {
          orderNumber: true,
          customerName: true,
          proofStatus: true,
          proofToken: true,
          createdAt: true,
          files: {
            select: { type: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } else if (/^\d+$/.test(query.replace(/\s/g, ''))) {
      const mobileVariations = normalizeMobileForChat(query);
      const conditions = mobileVariations.map(m => ({
        customerMobile: { contains: m },
      }));

      orders = await prisma.order.findMany({
        where: { OR: conditions },
        select: {
          orderNumber: true,
          customerName: true,
          proofStatus: true,
          proofToken: true,
          createdAt: true,
          files: {
            select: { type: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (orders.length === 0) {
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
            files: {
              select: { type: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
      }
    } else {
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
          files: {
            select: { type: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    if (orders.length === 0) {
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

    return NextResponse.json({ found: true, orders: result });

  } catch (error) {
    console.error('CHAT_LOOKUP_FAILED:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 });
  }
}