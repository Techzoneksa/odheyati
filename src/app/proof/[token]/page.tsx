import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSignedDownloadUrl } from '@/lib/r2';
import Link from 'next/link';
import Image from 'next/image';

const statusLabels: Record<string, string> = {
  PENDING: 'بانتظار',
  IN_PROGRESS: 'قيد التنفيذ',
  SLAUGHTERED: 'تم الذبح',
  MEDIA_UPLOADED: 'تم رفع الملفات',
  READY: 'جاهز',
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

function getStatusMessage(proofStatus: string, hasFiles: boolean, customerName: string): { title: string; message: string } {
  switch (proofStatus) {
    case 'CANCELLED':
      return {
        title: 'الطلب غير متاح',
        message: 'لا يتوفر توثيق لهذا الطلب حاليًا. يمكنكم التواصل مع المتجر لمزيد من التفاصيل.',
      };
    case 'PENDING':
    case 'IN_PROGRESS':
      return {
        title: `مرحبًا ${customerName}`,
        message: 'طلبكم في مرحلة المتابعة والتجهيز، وسيتم تحديث هذه الصفحة عند جاهزية التوثيق.\nيمكنكم العودة لهذه الصفحة لاحقًا لمتابعة حالة الطلب.',
      };
    case 'SLAUGHTERED':
      if (!hasFiles) {
        return {
          title: `مرحبًا ${customerName}`,
          message: 'تم تنفيذ طلبكم بنجاح، وجاري تجهيز ورفع ملفات التوثيق الخاصة بكم.',
        };
      }
      return {
        title: `مرحبًا ${customerName}`,
        message: 'توثيق طلبكم جاهز، يمكنكم مشاهدة الصور والفيديوهات أدناه.',
      };
    case 'MEDIA_UPLOADED':
    case 'READY':
    case 'VIEWED':
      return {
        title: `مرحبًا ${customerName}`,
        message: 'توثيق طلبكم جاهز، يمكنكم مشاهدة الصور والفيديوهات أدناه.',
      };
    default:
      return {
        title: `مرحبًا ${customerName}`,
        message: 'طلبكم قيد التنفيذ، وسيظهر التوثيق هنا بعد اكتمال التجهيز.',
      };
  }
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
  const hasFiles = images.length > 0 || videos.length > 0;

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

  const customerName = order.customerName.split(' ')[0];
  const statusMessage = getStatusMessage(order.proofStatus, hasFiles, customerName);

  const showFiles = hasFiles && ['SLAUGHTERED', 'MEDIA_UPLOADED', 'READY', 'VIEWED'].includes(order.proofStatus);
  const showInProgressMessage = ['PENDING', 'IN_PROGRESS'].includes(order.proofStatus) && !hasFiles;
  const showSlaughteredMessage = order.proofStatus === 'SLAUGHTERED' && !hasFiles;
  const showCancelledMessage = order.proofStatus === 'CANCELLED';

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="أضحيتي" width={180} height={60} className="mx-auto mb-4" />
          <p className="text-lg text-text-secondary">توثيقات أضحيتي</p>
        </div>

        <div className="card p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-text-primary">{statusMessage.title}</h2>
              <p className="text-text-secondary">طلب #{order.orderNumber}</p>
            </div>
            <span className={`status-badge status-${order.proofStatus.toLowerCase().replace('_', '-')}`}>
              {statusLabels[order.proofStatus] || order.proofStatus}
            </span>
          </div>

          {order.createdAt && (
            <p className="text-sm text-text-secondary">
              تاريخ الطلب: {new Date(order.createdAt).toLocaleDateString('ar-SA')}
            </p>
          )}
        </div>

        {showCancelledMessage ? (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-text-primary font-medium">{statusMessage.title}</p>
            <p className="text-text-secondary text-sm mt-2 whitespace-pre-line">{statusMessage.message}</p>
          </div>
        ) : showInProgressMessage ? (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-text-primary font-medium">{statusMessage.title}</p>
            <p className="text-text-secondary text-sm mt-2 whitespace-pre-line">{statusMessage.message}</p>
          </div>
        ) : showSlaughteredMessage ? (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-text-primary font-medium">{statusMessage.title}</p>
            <p className="text-text-secondary text-sm mt-2 whitespace-pre-line">{statusMessage.message}</p>
          </div>
        ) : showFiles ? (
          <>
            <div className="card p-6 mb-4">
              <p className="text-text-primary whitespace-pre-line">{statusMessage.message}</p>
            </div>

            {imagesWithUrls.length > 0 && (
              <div className="card p-6 mb-4">
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
              <div className="card p-6 mb-4">
                <h3 className="font-semibold text-text-primary mb-4">الفيديوهات</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 justify-items-center">
                  {videosWithUrls.map((video) => (
                    <div key={video.id} className="video-proof-card">
                      <video
                        src={video.url}
                        controls
                        playsInline
                        className="video-element"
                      />
                    </div>
                  ))}
                </div>
                {videosWithUrls.length > 1 && (
                  <p className="text-center text-text-secondary text-sm mt-4">
                    يمكنكم التمرير لمشاهدة باقي الفيديوهات
                  </p>
                )}
              </div>
            )}
          </>
        ) : null}

        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3">
            <Link
              href="/track"
              className="text-center py-3 px-6 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors font-medium"
            >
              العودة للبحث
            </Link>
            <a
              href="https://odheyati.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-center py-3 px-6 rounded-lg border border-border text-text-secondary hover:bg-background-cream transition-colors font-medium"
            >
              العودة إلى المتجر
            </a>
            <a
              href="https://api.whatsapp.com/send?phone=966562365161&text=السلام%20عليكم،%20أحتاج%20مساعدة%20بخصوص%20توثيق%20طلبي"
              target="_blank"
              rel="noopener noreferrer"
              className="text-center py-3 px-6 rounded-lg bg-secondary text-text-primary hover:bg-secondary-dark transition-colors font-medium"
            >
              الدردشة عبر واتساب
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}