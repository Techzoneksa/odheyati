'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ProofFile {
  id: string;
  type: string;
  fileName: string | null;
  storageKey: string;
}

interface Order {
  id: string;
  orderNumber: string | null;
  proofToken: string;
  customerName: string | null;
  customerMobile: string | null;
  proofStatus: string | null;
  createdAt: string | null;
  files: ProofFile[] | null;
  items: any[] | null;
}

const statusLabels: Record<string, string> = {
  PENDING: 'بانتظار',
  IN_PROGRESS: 'قيد التنفيذ',
  SLAUGHTERED: 'تم الذبح',
  MEDIA_UPLOADED: 'تم رفع الملفات',
  READY: 'جاهز',
  VIEWED: 'تمت المشاهدة',
  CANCELLED: 'ملغي',
};

function getSafeStatusMessage(proofStatus: string | null | undefined, hasFiles: boolean, customerName: string): { title: string; message: string } {
  const safeName = customerName || 'عميلنا الكريم';
  const status = proofStatus || 'PENDING';

  switch (status) {
    case 'CANCELLED':
      return {
        title: 'الطلب غير متاح',
        message: 'لا يتوفر توثيق لهذا الطلب حاليًا. يمكنكم التواصل مع المتجر لمزيد من التفاصيل.',
      };
    case 'PENDING':
    case 'IN_PROGRESS':
      return {
        title: `مرحبًا ${safeName}`,
        message: 'طلبكم في مرحلة المتابعة والتجهيز، وسيتم تحديث هذه الصفحة عند جاهزية التوثيق.\nيمكنكم العودة لهذه الصفحة لاحقًا لمتابعة حالة الطلب.',
      };
    case 'SLAUGHTERED':
      if (!hasFiles) {
        return {
          title: `مرحبًا ${safeName}`,
          message: 'تم تنفيذ طلبكم بنجاح، وجاري تجهيز ورفع ملفات التوثيق الخاصة بكم.',
        };
      }
      return {
        title: `مرحبًا ${safeName}`,
        message: 'توثيق طلبكم جاهز، يمكنكم مشاهدة الصور والفيديوهات أدناه.',
      };
    case 'MEDIA_UPLOADED':
    case 'READY':
    case 'VIEWED':
      return {
        title: `مرحبًا ${safeName}`,
        message: 'توثيق طلبكم جاهز، يمكنكم مشاهدة الصور والفيديوهات أدناه.',
      };
    default:
      return {
        title: `مرحبًا ${safeName}`,
        message: 'طلبكم قيد التنفيذ، وسيظهر التوثيق هنا بعد اكتمال التجهيز.',
      };
  }
}

function formatDateSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ar-SA');
  } catch {
    return '-';
  }
}

function getSafeCustomerName(name: string | null | undefined): string {
  if (!name) return 'عميلنا الكريم';
  try {
    const firstPart = name.split(' ')[0];
    return firstPart || 'عميلنا الكريم';
  } catch {
    return 'عميلنا الكريم';
  }
}

function getSafeOrderNumber(orderNumber: string | null | undefined): string {
  return orderNumber || '-';
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="أضحيتي" width={180} height={60} className="mx-auto mb-4" />
          <p className="text-lg text-text-secondary">توثيقات أضحيتي</p>
        </div>
        <div className="card p-6 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-text-primary font-medium">{message}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/track"
              className="py-3 px-6 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors font-medium"
            >
              العودة للبحث
            </Link>
            <a
              href="https://odheyati.com"
              className="py-3 px-6 rounded-lg border border-border text-text-secondary hover:bg-background-cream transition-colors font-medium"
            >
              العودة إلى المتجر
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function LoadingDisplay() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
        </div>
        <p className="text-text-secondary mt-4">جاري تحميل التوثيق...</p>
      </div>
    </main>
  );
}

interface Props {
  params: Promise<{ token: string }>;
}

export default function ProofPage({ params }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [token, setToken] = useState<string>('');

  const fetchOrder = useCallback(async (t: string) => {
    let stage = 'INIT';
    try {
      stage = 'FETCH_ORDER';
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/proof/${encodeURIComponent(t)}`);

      stage = 'CHECK_RESPONSE';
      if (!res.ok) {
        if (res.status === 404) {
          setError('لم يتم العثور على التوثيق');
        } else {
          setError('حدث خطأ في تحميل التوثيق');
        }
        setLoading(false);
        return;
      }

      stage = 'PARSE_JSON';
      const data = await res.json();

      stage = 'SET_STATE';
      setOrder(data);
      setLoading(false);
    } catch (err) {
      console.error('PROOF_PAGE_FAILED', {
        digestHint: '2823370080',
        stage,
        tokenPresent: Boolean(t),
        tokenPrefix: t?.slice(0, 8)
      });
      setError('حدث خطأ في تحميل التوثيق');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const resolvedParams = await params;
      const t = resolvedParams.token;
      setToken(t);
      await fetchOrder(t);
    };
    init();
  }, [params, fetchOrder]);

  if (loading) return <LoadingDisplay />;
  if (error) return <ErrorDisplay message={error} />;
  if (!order) return <ErrorDisplay message="لم يتم العثور على التوثيق" />;

  const files = order.files || [];
  const images = files.filter((f: ProofFile) => f.type === 'IMAGE');
  const videos = files.filter((f: ProofFile) => f.type === 'VIDEO');
  const hasFiles = images.length > 0 || videos.length > 0;

  const customerName = getSafeCustomerName(order.customerName);
  const orderNumber = getSafeOrderNumber(order.orderNumber);
  const proofStatus = order.proofStatus || 'PENDING';
  const statusMessage = getSafeStatusMessage(proofStatus, hasFiles, customerName);

  const showFiles = hasFiles && ['SLAUGHTERED', 'MEDIA_UPLOADED', 'READY', 'VIEWED'].includes(proofStatus);
  const showInProgressMessage = ['PENDING', 'IN_PROGRESS'].includes(proofStatus) && !hasFiles;
  const showSlaughteredMessage = proofStatus === 'SLAUGHTERED' && !hasFiles;
  const showCancelledMessage = proofStatus === 'CANCELLED';

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
              <p className="text-text-secondary">طلب #{orderNumber}</p>
            </div>
            <span className={`status-badge status-${proofStatus.toLowerCase().replace('_', '-')}`}>
              {statusLabels[proofStatus] || proofStatus}
            </span>
          </div>

          <p className="text-sm text-text-secondary">
            تاريخ الطلب: {formatDateSafe(order.createdAt)}
          </p>
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

            {mediaError && (
              <div className="card p-6 text-center mb-4">
                <div className="text-2xl mb-2">⚠️</div>
                <p className="text-text-secondary text-sm">تعذر تحميل بعض ملفات التوثيق مؤقتًا، حاول لاحقًا.</p>
              </div>
            )}

            {images.length > 0 && (
              <div className="card p-6 mb-4">
                <h3 className="font-semibold text-text-primary mb-4">الصور</h3>
                <div className="grid grid-cols-2 gap-4">
                  {images.map((image) => (
                    <div key={image.id} className="relative">
                      <img
                        src={`/api/files/${image.id}`}
                        alt={image.fileName || 'صورة التوثيق'}
                        width={300}
                        height={200}
                        className="w-full h-48 object-cover rounded-lg"
                        onError={() => setMediaError(true)}
                      />
                      <a
                        href={`/api/files/${image.id}`}
                        download={image.fileName || 'download'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg"
                      >
                        <span className="text-white font-medium">تحميل</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {videos.length > 0 && (
              <div className="card p-6 mb-4">
                <h3 className="font-semibold text-text-primary mb-4">الفيديوهات</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 justify-items-center">
                  {videos.map((video) => (
                    <div key={video.id} className="video-proof-card">
                      <video
                        src={`/api/files/${video.id}`}
                        controls
                        playsInline
                        className="video-element"
                        onError={() => setMediaError(true)}
                      />
                    </div>
                  ))}
                </div>
                {videos.length > 1 && (
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