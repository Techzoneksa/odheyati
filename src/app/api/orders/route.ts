import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

function normalizeMobileForSearch(mobile: string): string[] {
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

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  const mobile = searchParams.get('mobile');
  const status = searchParams.get('status');
  const platform = searchParams.get('platform');

  const whereClause: any = {};

  console.error('DEBUG_ORDERS_API', {
    status,
    platform,
    orderNumber,
    mobile,
    whereClauseKeys: Object.keys(whereClause)
  });

  if (status && status !== 'all') {
    whereClause.proofStatus = status;
  }

  if (platform && platform !== 'all' && platform.trim() !== '') {
    whereClause.platform = platform;
  }

  if (orderNumber) {
    whereClause.orderNumber = {
      contains: orderNumber.toString(),
      mode: 'insensitive',
    };
  }

  if (mobile) {
    const mobileVariations = normalizeMobileForSearch(mobile);
    whereClause.OR = mobileVariations.map(m => ({
      customerMobile: { contains: m },
    }));
  }

  const orders = await prisma.order.findMany({
    where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      files: true,
    },
  });

  console.error('DEBUG_ORDERS_RESULT', { orderCount: orders.length, whereClauseKeys: Object.keys(whereClause) });

  return NextResponse.json(orders);
}