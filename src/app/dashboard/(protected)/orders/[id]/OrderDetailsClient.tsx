'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { proofStatusSchema } from '@/lib/schemas';

interface FileData {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  storageKey: string;
}

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  sku: string | null;
  price: number | null;
}

interface ProofEvent {
  id: string;
  eventType: string;
  note: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string | null;
  sallaStatus: string | null;
  proofStatus: string;
  proofToken: string;
  createdAt: string;
  items: OrderItem[];
  files: FileData[];
  events: ProofEvent[];
}

interface Props {
  order: Order;
  proofUrl: string;
}

const statusLabels: Record<string, string> = {
  PENDING: 'بانتظار التنفيذ',
  IN_PROGRESS: 'قيد التنفيذ',
  SLAUGHTERED: 'تم الذبح',
  MEDIA_UPLOADED: 'تم رفع الملفات',
  READY: 'جاهز للعميل',
  VIEWED: 'تمت المشاهدة',
  CANCELLED: 'ملغي',
};

export default function OrderDetailsClient({ order, proofUrl }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('orderId', order.id);

        const res = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text();
          let data;
          try { data = JSON.parse(text); } catch {}
          throw new Error(data?.error || text || `فشل الرفع برمز ${res.status}`);
        }
      }
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'حدث خطأ في الرفع';
      setStatusMessage({ type: 'error', text: msg });
    }
    setUploading(false);
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    setDeleting(fileId);

    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch {}
        throw new Error(data?.error || text || `فشل الحذف برمز ${res.status}`);
      }
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'حدث خطأ في الحذف';
      setStatusMessage({ type: 'error', text: msg });
    }
    setDeleting(null);
  }

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);
    setStatusMessage(null);
    try {
      const parsed = proofStatusSchema.parse({ proofStatus: newStatus });
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update');
      }
      
      setStatusMessage({ type: 'success', text: 'تم تحديث حالة التوثيق بنجاح' });
      router.refresh();
    } catch (error) {
      console.error('Status update error:', error);
      setStatusMessage({ type: 'error', text: 'تعذر تحديث الحالة، حاول مرة أخرى' });
    }
    setUpdatingStatus(false);
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(proofUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const images = order.files.filter((f) => f.type === 'IMAGE');
  const videos = order.files.filter((f) => f.type === 'VIDEO');

  return (
    <div className="min-h-screen bg-background-cream">
      <header className="bg-background-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-text-secondary hover:text-primary">
              ← العودة
            </Link>
            <h1 className="text-xl font-bold text-text-primary">
              طلب #{order.orderNumber}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">بيانات العميل</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-text-secondary">الاسم</p>
                  <p className="font-medium">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">الجوال</p>
                  <p className="font-medium" dir="ltr">{order.customerMobile}</p>
                </div>
                {order.customerEmail && (
                  <div className="col-span-2">
                    <p className="text-sm text-text-secondary">الإيميل</p>
                    <p className="font-medium">{order.customerEmail}</p>
                  </div>
                )}
              </div>
            </div>

            {order.items.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-4">المنتجات</h2>
                <div className="divide-y divide-border">
                  {order.items.map((item) => (
                    <div key={item.id} className="py-3 flex justify-between">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        {item.sku && <p className="text-sm text-text-secondary">SKU: {item.sku}</p>}
                      </div>
                      <div className="text-left">
                        {item.quantity > 1 && <p className="text-sm">الكمية: {item.quantity}</p>}
                        {item.price && <p className="font-medium">{item.price.toFixed(2)} ر.س</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">الصور ({images.length})</h2>
              {images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((image) => (
                    <div key={image.id} className="relative group">
                      <Image src={image.url} alt={image.fileName} width={300} height={200} className="w-full h-40 object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                        <a href={image.url} target="_blank" rel="noopener noreferrer" className="text-white text-sm mx-1">
                          عرض
                        </a>
                        <button
                          onClick={() => handleDeleteFile(image.id)}
                          disabled={deleting === image.id}
                          className="text-red-300 text-sm mx-1 hover:text-red-500"
                        >
                          {deleting === image.id ? '...' : 'حذف'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary text-sm">لا توجد صور</p>
              )}
              <div className="mt-4">
                <label className="btn-secondary cursor-pointer inline-flex items-center">
                  <span>{uploading ? 'جاري الرفع...' : 'رفع صور'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">الفيديوهات ({videos.length})</h2>
              {videos.length > 0 ? (
                <div className="space-y-4">
                  {videos.map((video) => (
                    <div key={video.id} className="flex items-center justify-between bg-background-beige rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🎬</span>
                        <div>
                          <p className="font-medium text-sm">{video.fileName}</p>
                          <p className="text-xs text-text-secondary">
                            {(video.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">
                          عرض
                        </a>
                        <button
                          onClick={() => handleDeleteFile(video.id)}
                          disabled={deleting === video.id}
                          className="text-red-600 text-sm hover:underline"
                        >
                          {deleting === video.id ? '...' : 'حذف'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary text-sm">لا توجد فيديوهات</p>
              )}
              <div className="mt-4">
                <label className="btn-secondary cursor-pointer inline-flex items-center">
                  <span>{uploading ? 'جاري الرفع...' : 'رفع فيديو'}</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">الحالة</h2>
              <select
                value={order.proofStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="input-field mb-4"
              >
                <option value="PENDING">بانتظار التنفيذ</option>
                <option value="IN_PROGRESS">قيد التنفيذ</option>
                <option value="SLAUGHTERED">تم الذبح</option>
                <option value="MEDIA_UPLOADED">تم رفع الملفات</option>
                <option value="READY">جاهز للعميل</option>
                <option value="VIEWED">تمت المشاهدة</option>
                <option value="CANCELLED">ملغي</option>
              </select>
              <p className="text-sm text-text-secondary">
                حالة سلة: {order.sallaStatus || '-'}
              </p>
              {statusMessage && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${
                  statusMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {statusMessage.text}
                </div>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">رابط التوثيق</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={proofUrl}
                  readOnly
                  className="input-field text-sm font-mono"
                  dir="ltr"
                />
                <button
                  onClick={handleCopyLink}
                  className="btn-secondary px-3 py-2 text-sm"
                >
                  {copied ? 'تم!' : 'نسخ'}
                </button>
              </div>
              <p className="text-xs text-text-secondary mt-2">
                شارك هذا الرابط مع العميل
              </p>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">ملخص</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">تاريخ الطلب</span>
                  <span>{new Date(order.createdAt).toLocaleDateString('ar-SA')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">عدد الصور</span>
                  <span>{images.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">عدد الفيديوهات</span>
                  <span>{videos.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}