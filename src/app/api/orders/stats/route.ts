import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [
    totalOrders,
    uniqueCustomers,
    inProgressOrders,
    slaughteredOrders,
    readyOrders,
    withFilesOrders,
    cancelledOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.findMany({
      select: { customerMobile: true },
      distinct: ['customerMobile'],
    }),
    prisma.order.count({
      where: { proofStatus: { in: ['PENDING', 'IN_PROGRESS'] } },
    }),
    prisma.order.count({
      where: { proofStatus: 'SLAUGHTERED' },
    }),
    prisma.order.count({
      where: { proofStatus: { in: ['READY', 'MEDIA_UPLOADED', 'VIEWED'] } },
    }),
    prisma.order.count({
      where: {
        files: { some: { OR: [{ type: 'IMAGE' }, { type: 'VIDEO' }] } },
      },
    }),
    prisma.order.count({
      where: {
        OR: [
          { proofStatus: 'CANCELLED' },
          { sallaStatus: { contains: 'إلغاء' } },
          { sallaStatus: { contains: 'ملغي' } },
          { sallaStatus: { contains: 'cancelled' } },
        ],
      },
    }),
  ]);

  const withoutFilesOrders = totalOrders - withFilesOrders - cancelledOrders;

  return NextResponse.json({
    totalOrders,
    uniqueCustomers: uniqueCustomers.length,
    inProgressOrders,
    slaughteredOrders,
    readyOrders,
    withFilesOrders,
    withoutFilesOrders,
    cancelledOrders,
  });
}