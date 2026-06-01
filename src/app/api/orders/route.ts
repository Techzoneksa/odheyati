import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const orders = await prisma.order.findMany({
    where: status ? { proofStatus: status as any } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      files: true,
    },
  });

  return NextResponse.json(orders);
}