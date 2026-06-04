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

  const r2Ready = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET
  );

  if (!r2Ready) {
    filesWithUrls = rawFiles.map(file => ({ ...file, url: '' }));
  } else {
    if (!r2Ready) {
    console.error("R2_CONFIG_MISSING: skipping signed URLs in order details");
    filesWithUrls = rawFiles.map((file) => ({
      ...file,
      url: "",
    }));
  } else {
    filesWithUrls = await Promise.all(
      rawFiles.map(async (file): Promise<FileWithUrl> => {
        let url = "";

        try {
          url = await getSignedDownloadUrl(file.storageKey);
        } catch (error) {
          console.error("ORDER_DETAILS_SIGNED_URL_FAILED", {
            fileId: file.id,
            fileType: file.type,
            message: error instanceof Error ? error.message : String(error),
          });
        }

        return {
          ...file,
          url,
        };
      })
    );
  }
  }

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