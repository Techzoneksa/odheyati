'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface ParsedFile {
  name: string;
  orderNumber: string | null;
  status: 'ready' | 'no_order_number' | 'order_not_found' | 'unsupported_type' | 'file_too_large' | 'pending';
  customerName: string | null;
  fileType: string | null;
  message: string;
}

interface UploadResult {
  success: number;
  failed: number;
  images: number;
  videos: number;
  ordersUpdated: number;
  files: { name: string; status: string; message: string; orderNumber: string | null }[];
}

export default function BulkUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileDataRef = useRef<Map<string, File>>(new Map());

  function extractOrderNumber(filename: string): string | null {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const match = nameWithoutExt.match(/(\d{5,})/);
    return match ? match[1] : null;
  }

  function getFileType(name: string): string | null {
    const ext = name.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'webp'];
    const videoExts = ['mp4', 'mov', 'webm'];
    if (imageExts.includes(ext || '')) return 'صورة';
    if (videoExts.includes(ext || '')) return 'فيديو';
    return null;
  }

  function handleFileSelect(selectedFiles: FileList | null) {
    if (!selectedFiles) return;
    setUploadError(null);

    const newFiles: ParsedFile[] = [];
    
    for (const file of Array.from(selectedFiles)) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      const allowedExts = ['.mp4', '.mov', '.webm', '.jpg', '.jpeg', '.png', '.webp'];
      const fileType = getFileType(file.name);
      const orderNumber = extractOrderNumber(file.name);
      
      let status: ParsedFile['status'] = 'pending';
      let message = '';
      
      if (!allowedExts.includes(ext)) {
        status = 'unsupported_type';
        message = 'نوع ملف غير مدعوم';
      } else if (file.size > 100 * 1024 * 1024) {
        status = 'file_too_large';
        message = 'حجم الملف كبير جداً';
      } else if (!orderNumber) {
        status = 'no_order_number';
        message = 'لا يوجد رقم طلب في الاسم';
      } else {
        status = 'ready';
        message = 'جاهز للرفع';
      }
      
      newFiles.push({
        name: file.name,
        orderNumber,
        status,
        customerName: null,
        fileType,
        message,
      });

      fileDataRef.current.set(file.name, file);
    }
    
    setFiles(prev => [...prev, ...newFiles]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }

  function handleRemove(index: number) {
    const removed = files[index];
    if (removed) fileDataRef.current.delete(removed.name);
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function handleClearAll() {
    setFiles([]);
    setResult(null);
    setUploadError(null);
    setUploadProgress(null);
    fileDataRef.current.clear();
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploadError(null);
    
    const readyFiles = files.filter(f => f.status === 'ready');
    if (readyFiles.length === 0) {
      setUploadError('لا توجد ملفات جاهزة للرفع');
      return;
    }

    setUploading(true);
    setResult(null);
    setUploadProgress(`جاري الرفع (${readyFiles.length} ملف)...`);

    try {
      const formData = new FormData();
      let appended = 0;
      
      for (const pf of readyFiles) {
        const actualFile = fileDataRef.current.get(pf.name);
        if (actualFile) {
          formData.append('files', actualFile);
          appended++;
        }
      }

      if (appended === 0) {
        setUploadError('لم يتم العثور على الملفات في الذاكرة. حاول إعادة اختيارها.');
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      const res = await fetch('/api/dashboard/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const responseText = await res.text();
      let data: any = null;
      try { data = JSON.parse(responseText); } catch {}

      if (res.status === 401) {
        setUploadError('انتهت الجلسة، سجل الدخول مرة أخرى');
        router.push('/dashboard/login');
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      if (!res.ok) {
        const msg = data?.error || data?.message || responseText || `رمز الخطأ: ${res.status}`;
        console.error('BULK_UPLOAD_ERROR', { status: res.status, message: msg });
        setUploadError(`تعذر رفع الملفات: ${msg}`);
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      setResult(data);
      setFiles([]);
      fileDataRef.current.clear();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
      console.error('BULK_UPLOAD_EXCEPTION', { message: msg });
      setUploadError(`حدث خطأ في الاتصال: ${msg}`);
    }
    
    setUploading(false);
    setUploadProgress(null);
  }

  const readyCount = files.filter(f => f.status === 'ready').length;
  const failedCount = files.filter(f => f.status !== 'ready' && f.status !== 'pending').length;

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
              <h1 className="text-xl font-bold text-primary">رفع جماعي للتوثيقات</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">تعليمات الرفع</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 mb-2">
              <strong> важно:</strong> سمِّ كل ملف برقم الطلب حتى يتم ربطه تلقائيًا.
            </p>
            <p className="text-sm text-yellow-800 mb-2">أمثلة صحيحة:</p>
            <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
              <li>262190392.mp4</li>
              <li>262190392-1.mp4</li>
              <li>262190392-ذبح.mp4</li>
              <li>262190392-توزيع.jpg</li>
              <li>video-262190392.mp4</li>
            </ul>
          </div>
          <p className="text-sm text-text-secondary">
            الأنواع المدعومة: MP4, MOV, WebM, JPG, JPEG, PNG, WebP
            <br />
            الحد الأقصى: 100 ملف في الدفعة الواحدة، 100MB للملف الواحد
          </p>
        </div>

        <div
          className={`card p-8 mb-6 border-2 border-dashed ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📤</div>
            <p className="text-text-primary mb-2">اسحب الملفات هنا أو اضغط لاختيارها</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp4,.mov,.webm,.jpg,.jpeg,.png,.webp"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
            >
              اختيار ملفات
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="card p-4 mb-6" style={{ background: '#fce4ec', border: '1px solid #ef9a9a' }}>
            <p style={{ color: '#c62828', fontSize: 14, direction: 'rtl' }}>
              ⚠️ {uploadError}
            </p>
          </div>
        )}

        {uploadProgress && (
          <div className="card p-4 mb-6" style={{ background: '#e3f2fd', border: '1px solid #90caf9' }}>
            <p style={{ color: '#1565c0', fontSize: 14, direction: 'rtl' }}>
              {uploadProgress}
            </p>
          </div>
        )}

        {files.length > 0 && (
          <div className="card p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-text-primary">
                الملفات المحددة ({files.length})
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={handleClearAll}
                  className="text-sm text-text-secondary hover:text-primary"
                >
                  مسح الكل
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background-beige">
                  <tr>
                    <th className="text-right px-3 py-2">الملف</th>
                    <th className="text-right px-3 py-2">رقم الطلب</th>
                    <th className="text-right px-3 py-2">النوع</th>
                    <th className="text-right px-3 py-2">الحالة</th>
                    <th className="text-right px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {files.map((file, idx) => (
                    <tr key={idx} className={file.status !== 'ready' ? 'bg-red-50' : ''}>
                      <td className="px-3 py-2 font-mono text-xs" dir="ltr">{file.name}</td>
                      <td className="px-3 py-2 font-mono" dir="ltr">{file.orderNumber || '-'}</td>
                      <td className="px-3 py-2">{file.fileType || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs ${
                          file.status === 'ready' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {file.message}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleRemove(idx)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 mt-4">
              <button
                onClick={handleUpload}
                disabled={uploading || readyCount === 0}
                className="btn-primary disabled:opacity-50"
              >
                {uploading ? 'جاري الرفع...' : `اعتماد الرفع (${readyCount} ملف)`}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">تقرير الرفع</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{result.success}</p>
                <p className="text-sm text-green-600">نجاح</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{result.failed}</p>
                <p className="text-sm text-red-600">فشل</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.images}</p>
                <p className="text-sm text-blue-600">صور</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-700">{result.videos}</p>
                <p className="text-sm text-purple-600">فيديوهات</p>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-2">
              تم تحديث {result.ordersUpdated} طلب بنجاح
            </p>

            {result.files.filter(f => f.status !== 'uploaded').length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-text-primary mb-2">الملفات الفاشلة:</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {result.files
                    .filter(f => f.status !== 'uploaded')
                    .map((f, idx) => (
                      <li key={idx}>
                        {f.name} — {f.message}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="btn-primary"
              >
                العودة للوحة التحكم
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
