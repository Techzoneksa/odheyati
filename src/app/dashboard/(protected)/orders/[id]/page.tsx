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

  const rawFiles = order.files;
  type FileWithUrl = {
    id: string;
    createdAt: Date;
    type: "IMAGE" | "VIDEO";
    orderId: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    size: number;
    sortOrder: number;
    uploadedById: string | null;
    url: string;
  };
  let filesWithUrls: FileWithUrl[] = [];
  filesWithUrls = await Promise.all(
    rawFiles.map(async (file): Promise<FileWithUrl> => {
      let url = '';
      try {
        url = await getSignedDownloadUrl(file.storageKey);
      } catch {
        url = '';
      }
      return { ...file, url };
    })
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
      proofUrl={`${process.env.APP_URL || 'https://almotamed.com'}/proof/${order.proofToken}`}
    />
  );
}