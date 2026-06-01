import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getSignedDownloadUrl } from '@/lib/r2';
import OrderDetailsClient from './OrderDetailsClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  return {
    title: order ? `طلب ${order.orderNumber}` : 'تفاصيل الطلب',
  };
}

export default async function OrderDetailsPage({ params }: Props) {
  const session = await getSession();
  if (!session) {
    redirect('/dashboard/login');
  }

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      files: {
        orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!order) {
    notFound();
  }

  const filesWithUrls = await Promise.all(
    order.files.map(async (file) => ({
      ...file,
      url: await getSignedDownloadUrl(file.storageKey),
    }))
  );

  return (
    <OrderDetailsClient
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerMobile: order.customerMobile,
        customerEmail: order.customerEmail,
        sallaStatus: order.sallaStatus,
        proofStatus: order.proofStatus,
        proofToken: order.proofToken,
        createdAt: order.createdAt.toISOString(),
        items: order.items,
        files: filesWithUrls,
        events: order.events.map(e => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      }}
      proofUrl={`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/proof/${order.proofToken}`}
    />
  );
}