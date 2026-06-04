import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const orders = await prisma.order.findMany({
    select: { proofToken: true, orderNumber: true },
    take: 3,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(orders);
}
