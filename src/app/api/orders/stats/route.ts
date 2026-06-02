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
    ordersWithFiles,
    ordersWithoutFiles,
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
    prisma.order.findMany({
      where: {
        files: { some: { OR: [{ type: 'IMAGE' }, { type: 'VIDEO' }] } },
      },
      select: { customerMobile: true },
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { proofStatus: 'CANCELLED' },
          { sallaStatus: { contains: 'إلغاء' } },
          { sallaStatus: { contains: 'ملغي' } },
          { sallaStatus: { contains: 'cancelled' } },
        ],
      },
      select: { id: true },
    }),
  ]);

  const cancelledOrderIds = new Set(ordersWithoutFiles.map(o => o.id));
  const allOrders = await prisma.order.findMany({
    where: { proofStatus: { not: 'CANCELLED' } },
    select: {
      id: true,
      customerMobile: true,
      files: { select: { type: true } },
    },
  });

  const documentedOrders = allOrders.filter(o => {
    const hasImages = o.files.some(f => f.type === 'IMAGE');
    const hasVideos = o.files.some(f => f.type === 'VIDEO');
    return hasImages || hasVideos;
  });

  const undocumentedOrders = allOrders.filter(o => {
    const hasImages = o.files.some(f => f.type === 'IMAGE');
    const hasVideos = o.files.some(f => f.type === 'VIDEO');
    return !hasImages && !hasVideos;
  });

  const documentedMobiles = new Set(documentedOrders.map(o => o.customerMobile));
  const undocumentedMobiles = new Set(undocumentedOrders.map(o => o.customerMobile));

  const documentationRate = totalOrders > 0 
    ? Math.round((withFilesOrders / totalOrders) * 100) 
    : 0;

  return NextResponse.json({
    totalOrders,
    uniqueCustomers: uniqueCustomers.length,
    withFilesOrders,
    withoutFilesOrders: undocumentedOrders.length,
    inProgressOrders,
    slaughteredOrders,
    readyOrders,
    cancelledOrders,
    documentationRate,
    undocumentedCustomersCount: undocumentedMobiles.size,
  });
}