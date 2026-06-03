'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ExportPage() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const [proofStatus, setProofStatus] = useState('all');
  const [sallaStatus, setSallaStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [includePrices, setIncludePrices] = useState(false);
  const [includeProofLinks, setIncludeProofLinks] = useState(true);
  const [mediaFilter, setMediaFilter] = useState('all');

  async function handleExport() {
    setExporting(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (proofStatus !== 'all') params.set('proofStatus', proofStatus);
      if (sallaStatus !== 'all') params.set('sallaStatus', sallaStatus);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (includePrices) params.set('includePrices', 'true');
      if (!includeProofLinks) params.set('includeProofLinks', 'false');
      if (mediaFilter !== 'all') params.set('mediaFilter', mediaFilter);

      const response = await fetch(`/api/dashboard/export?${params}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const reason = data.reason || 'UNKNOWN';
        const debugMessage = data.debugMessage || '';
        throw new Error(`Export failed: ${reason} | debugMessage: ${debugMessage}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `odheyati-proof-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      const reasonMatch = err.message.match(/Export failed: (.+)/);
      const reason = reasonMatch ? reasonMatch[1] : '';
      const debugMatch = err.message.match(/debugMessage: (.+)/);
      const debugMessage = debugMatch ? debugMatch[1] : '';
      setError(reason ? `تعذر تصدير الملف، حاول مرة أخرى.\nسبب الخطأ: ${reason}${debugMessage ? `\nتفاصيل: ${debugMessage}` : ''}` : 'تعذر تصدير الملف، حاول مرة أخرى.');
    }

    setExporting(false);
  }

  return (
    <div className="min-h-screen bg-background-cream">
      <header className="bg-background-white border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/dashboard')}
                className="text-text-secondary hover:text-primary"
              >
                ← العودة
              </button>
              <h1 className="text-xl font-bold text-primary">تصدير تقرير التوثيقات</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="card p-6 mb-6">
          <p className="text-text-secondary mb-6">
            اختر الفلاتر المناسبة ثم صدّر ملف Excel منظم للطلبات والتوثيقات.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">حالة التوثيق</label>
              <select
                value={proofStatus}
                onChange={(e) => setProofStatus(e.target.value)}
                className="input-field"
              >
                <option value="all">الكل</option>
                <option value="PENDING">بانتظار التنفيذ</option>
                <option value="IN_PROGRESS">قيد التنفيذ</option>
                <option value="SLAUGHTERED">تم الذبح</option>
                <option value="MEDIA_UPLOADED">تم رفع الملفات</option>
                <option value="READY">التوثيق جاهز</option>
                <option value="SENT">تم الإرسال</option>
                <option value="VIEWED">تمت المشاهدة</option>
                <option value="CANCELLED">ملغي</option>
                <option value="with_files">فيها ملفات</option>
                <option value="without_files">بدون ملفات</option>
              </select>
            </div>

            <div>
              <label className="label">حالة سلة</label>
              <select
                value={sallaStatus}
                onChange={(e) => setSallaStatus(e.target.value)}
                className="input-field"
              >
                <option value="all">الكل</option>
                <option value="تم التنفيذ">تم التنفيذ</option>
                <option value="بانتظار المراجعة">بانتظار المراجعة</option>
                <option value="تم التوصيل">تم التوصيل</option>
                <option value="ملغي">ملغي</option>
              </select>
            </div>

            <div>
              <label className="label">من تاريخ</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field"
                dir="ltr"
              />
            </div>

            <div>
              <label className="label">إلى تاريخ</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field"
                dir="ltr"
              />
            </div>

            <div>
              <label className="label">خيارات الملفات</label>
              <select
                value={mediaFilter}
                onChange={(e) => setMediaFilter(e.target.value)}
                className="input-field"
              >
                <option value="all">الكل</option>
                <option value="with_files">فيها ملفات فقط</option>
                <option value="without_files">بدون ملفات فقط</option>
                <option value="with_videos">فيها فيديوهات فقط</option>
                <option value="with_images">فيها صور فقط</option>
              </select>
            </div>

            <div className="flex flex-col gap-4 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePrices}
                  onChange={(e) => setIncludePrices(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-text-primary">تصدير بالأسعار</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeProofLinks}
                  onChange={(e) => setIncludeProofLinks(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-text-primary">تضمين رابط مشاهدة التوثيق</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mt-4">
              {error}
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary w-full mt-6"
          >
            {exporting ? 'جاري تجهيز الملف...' : 'تصدير الملف'}
          </button>
        </div>
      </main>
    </div>
  );
}