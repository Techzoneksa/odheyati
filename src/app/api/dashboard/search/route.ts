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

function maskMobile(mobile: string): string {
  if (mobile.length > 7) {
    return `****${mobile.slice(-4)}`;
  }
  return mobile;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'all';

  if (query.length < 3) {
    return NextResponse.json([]);
  }

  const whereClause: any = {
    OR: [
      { orderNumber: { contains: query, mode: 'insensitive' } },
      { customerName: { contains: query, mode: 'insensitive' } },
    ],
  };

  if (type === 'mobile' || type === 'all') {
    const mobileVariations = normalizeMobileForSearch(query);
    if (mobileVariations.length > 0) {
      const mobileConditions = mobileVariations.map(m => ({
        customerMobile: { contains: m },
      }));
      whereClause.OR = [...whereClause.OR, ...mobileConditions];
    }
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerMobile: true,
      proofStatus: true,
      sallaStatus: true,
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  const results = orders.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerMobileMasked: maskMobile(order.customerMobile),
    proofStatus: order.proofStatus,
    sallaStatus: order.sallaStatus,
  }));

  return NextResponse.json(results);
}