import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSignedDownloadUrl } from '@/lib/r2';
import Link from 'next/link';
import Image from 'next/image';

const statusLabels: Record<string, string> = {
  PENDING: 'بانتظار التنفيذ',
  IN_PROGRESS: 'قيد التنفيذ',
  SLAUGHTERED: 'تم الذبح',
  MEDIA_UPLOADED: 'تم رفع الملفات',
  READY: 'جاهز للعميل',
  VIEWED: 'تمت المشاهدة',
  CANCELLED: 'ملغي',
};

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const order = await prisma.order.findUnique({
    where: { proofToken: token },
  });
  
  return {
    title: order ? `توثيق طلب ${order.orderNumber}` : 'التوثيق',
    robots: { index: false, follow: false },
  };
}

export default async function ProofPage({ params }: Props) {
  const { token } = await params;
  
  const order = await prisma.order.findUnique({
    where: { proofToken: token },
    include: {
      items: true,
      files: {
        orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  });

  if (!order) {
    notFound();
  }

  const images = order.files.filter(f => f.type === 'IMAGE');
  const videos = order.files.filter(f => f.type === 'VIDEO');

  const imagesWithUrls = await Promise.all(
    images.map(async (f) => ({
      ...f,
      url: await getSignedDownloadUrl(f.storageKey),
    }))
  );

  const videosWithUrls = await Promise.all(
    videos.map(async (f) => ({
      ...f,
      url: await getSignedDownloadUrl(f.storageKey),
    }))
  );

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary mb-2">أضحيتي</h1>
          <p className="text-text-secondary">توثيقات أضحيتي</p>
        </div>

        <div className="card p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-text-primary">{order.customerName}</h2>
              <p className="text-text-secondary">طلب #{order.orderNumber}</p>
            </div>
            <span className={`status-badge ${order.proofStatus.toLowerCase().replace('_', '-')}`}>
              {statusLabels[order.proofStatus] || order.proofStatus}
            </span>
          </div>

          {order.createdAt && (
            <p className="text-sm text-text-secondary mb-4">
              تاريخ الطلب: {new Date(order.createdAt).toLocaleDateString('ar-SA')}
            </p>
          )}

          {order.items.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-text-primary mb-2">المنتجات</h3>
              <ul className="space-y-2">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span>{item.productName}</span>
                    {item.quantity > 1 && <span>x{item.quantity}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {(order.proofStatus === 'PENDING' || order.proofStatus === 'IN_PROGRESS') && images.length === 0 && videos.length === 0 ? (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-text-primary font-medium">طلبكم قيد التنفيذ</p>
            <p className="text-text-secondary text-sm mt-2">
              سيظهر التوثيق هنا بعد اكتمال التجهيز
            </p>
          </div>
        ) : (
          <>
            {imagesWithUrls.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="font-semibold text-text-primary mb-4">الصور</h3>
                <div className="grid grid-cols-2 gap-4">
                  {imagesWithUrls.map((image) => (
                    <div key={image.id} className="relative">
                      <Image
                        src={image.url}
                        alt={image.fileName}
                        width={300}
                        height={200}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <a
                        href={image.url}
                        download={image.fileName}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg"
                      >
                        <span className="text-white font-medium">تحميل</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {videosWithUrls.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="font-semibold text-text-primary mb-4">الفيديوهات</h3>
                <div className="space-y-4">
                  {videosWithUrls.map((video) => (
                    <div key={video.id} className="relative">
                      <video
                        src={video.url}
                        controls
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <a
                        href={video.url}
                        download={video.fileName}
                        className="mt-2 inline-flex items-center text-primary hover:underline text-sm"
                      >
                        تحميل الفيديو
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="text-center mt-8">
          <Link href="/" className="text-primary hover:underline">
            العودة للبحث
          </Link>
        </div>
      </div>
    </main>
  );
}