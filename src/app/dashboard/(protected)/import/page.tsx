'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface OrderRow {
  orderNumber: string;
  sallaStatus: string;
  customerName: string;
  customerMobile: string;
  amount: string;
}

interface RowResult {
  row: number;
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  status: 'added' | 'updated' | 'skipped' | 'failed' | 'warning';
  message: string;
}

interface ImportReport {
  summary: {
    added: number;
    updated: number;
    skipped: number;
    failed: number;
    warnings: number;
  };
  rows: RowResult[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  added: { label: 'مضاف', color: 'bg-green-100 text-green-800' },
  updated: { label: 'محدث', color: 'bg-blue-100 text-blue-800' },
  skipped: { label: 'متجاهل', color: 'bg-yellow-100 text-yellow-800' },
  failed: { label: 'فشل', color: 'bg-red-100 text-red-800' },
  warning: { label: 'تحذير', color: 'bg-orange-100 text-orange-800' },
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OrderRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportReport | null>(null);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState<'SALLA' | 'SHOPIFY'>('SALLA');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    processFile(selectedFile);
  }

  function processFile(selectedFile: File | undefined) {
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls') && !selectedFile.name.endsWith('.csv')) {
      setError('يرجى اختيار ملف Excel أو CSV');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('حجم الملف كبير جدًا. الحد الأقصى 10MB');
      return;
    }

    setFile(selectedFile);
    setError('');
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

        const headers = jsonData[0].map(h => h.toString().trim());

        const orderCol = headers.findIndex(h => h.includes('رقم الطلب') || h.includes('order'));
        const statusCol = headers.findIndex(h => h.includes('حالة') || h.includes('status'));
        const nameCol = headers.findIndex(h => h.includes('اسم') || h.includes('name'));
        const mobileCol = headers.findIndex(h => h.includes('جوال') || h.includes('mobile') || h.includes('phone'));
        const amountCol = headers.findIndex(h => h.includes('مبلغ') || h.includes('amount'));

        if (orderCol === -1 || nameCol === -1 || mobileCol === -1) {
          setError('الملف لا يحتوي على الأعمدة المطلوبة (رقم الطلب، اسم العميل، رقم الجوال)');
          return;
        }

        const rows: OrderRow[] = [];
        for (let i = 1; i < jsonData.length && rows.length < 20; i++) {
          const row = jsonData[i];
          if (row[orderCol]) {
            rows.push({
              orderNumber: String(row[orderCol] || '').trim(),
              sallaStatus: statusCol !== -1 ? String(row[statusCol] || '').trim() : '',
              customerName: String(row[nameCol] || '').trim(),
              customerMobile: String(row[mobileCol] || '').trim(),
              amount: amountCol !== -1 ? String(row[amountCol] || '').trim() : '',
            });
          }
        }

        setPreview(rows);
      } catch {
        setError('حدث خطأ في قراءة الملف');
      }
    };
    reader.readAsBinaryString(selectedFile);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    processFile(droppedFile);
  }

  function handlePlatformChange(newPlatform: 'SALLA' | 'SHOPIFY') {
    setPlatform(newPlatform);
    setPreview([]);
    setFile(null);
    setResult(null);
    setError('');
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('platform', 'SALLA');

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'حدث خطأ في الاستيراد');
        setImporting(false);
        return;
      }

      setResult(data);
      setPreview([]);
      setFile(null);
    } catch {
      setError('حدث خطأ، حاول مرة أخرى');
    }
    setImporting(false);
  }

  return (
    <div className="min-h-screen bg-background-cream">
      <header className="bg-background-white border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-text-secondary hover:text-primary">
              ← العودة
            </a>
            <h1 className="text-xl font-bold text-text-primary">استيراد طلبات</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">مصدر الملف</h2>

          <div className="flex gap-4 mb-4">
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border ${platform === 'SALLA' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary'}`}>
              <input
                type="radio"
                name="platform"
                value="SALLA"
                checked={platform === 'SALLA'}
                onChange={() => handlePlatformChange('SALLA')}
                className="hidden"
              />
              سلة
            </label>
            
</div>
        </div>

        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">رفع الملف</h2>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-text-primary font-medium mb-2">
                اسحب ملف الطلبات هنا أو اضغط لاختيار الملف
              </p>
              <p className="text-sm text-text-secondary mb-4">
                الملفات المسموحة: .xlsx, .xls, .csv
              </p>
              <p className="text-xs text-text-secondary">
                يفضل ألا يتجاوز حجم الملف 10MB
              </p>
            </label>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-background-beige rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-text-primary font-medium">{file.name}</p>
                  <p className="text-sm text-text-secondary">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                onClick={() => { setFile(null); setPreview([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="mt-4 p-4 bg-background-beige rounded-lg">
            <h3 className="text-sm font-semibold text-text-primary mb-2">تعليمات الاستيراد</h3>
            <div className="text-sm text-text-secondary">
              <p className="mb-2">يرجى رفع ملف الطلبات المصدر من سلة.</p>
              <p><strong>الأعمدة المطلوبة:</strong> رقم الطلب، اسم العميل، رقم الجوال</p>
              <p><strong>الأعمدة الاختيارية:</strong> حالة الطلب، المبلغ</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mt-4">
              {error}
            </div>
          )}
        </div>

        {preview.length > 0 && (
          <div className="card p-6 mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">معاينة البيانات (أول 20 صف)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background-beige">
                  <tr>
                    <th className="text-right px-3 py-2">رقم الطلب</th>
                    <th className="text-right px-3 py-2">العميل</th>
                    <th className="text-right px-3 py-2">الجوال</th>
                    <th className="text-right px-3 py-2">الحالة</th>
                    <th className="text-right px-3 py-2">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-mono" dir="ltr">{row.orderNumber}</td>
                      <td className="px-3 py-2">{row.customerName}</td>
                      <td className="px-3 py-2 font-mono" dir="ltr">{row.customerMobile}</td>
                      <td className="px-3 py-2">{row.sallaStatus}</td>
                      <td className="px-3 py-2">{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-4">
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {importing ? 'جاري الاستيراد...' : 'اعتماد الاستيراد'}
              </button>
              <button
                onClick={() => { setPreview([]); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-text-secondary font-medium rounded-lg hover:bg-background-cream transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">تقرير الاستيراد</h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{result.summary.added}</p>
                <p className="text-sm text-green-600">مضاف</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.summary.updated}</p>
                <p className="text-sm text-blue-600">محدث</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-700">{result.summary.skipped}</p>
                <p className="text-sm text-yellow-600">متجاهل</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{result.summary.failed}</p>
                <p className="text-sm text-red-600">فشل</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-orange-700">{result.summary.warnings}</p>
                <p className="text-sm text-orange-600">تحذير</p>
              </div>
            </div>

            {result.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background-beige">
                    <tr>
                      <th className="text-right px-3 py-2">#</th>
                      <th className="text-right px-3 py-2">رقم الطلب</th>
                      <th className="text-right px-3 py-2">العميل</th>
                      <th className="text-right px-3 py-2">الجوال</th>
                      <th className="text-right px-3 py-2">النتيجة</th>
                      <th className="text-right px-3 py-2">السبب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.rows.map((row, idx) => (
                      <tr key={idx} className={row.status === 'failed' ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-text-secondary">{row.row}</td>
                        <td className="px-3 py-2 font-mono" dir="ltr">{row.orderNumber}</td>
                        <td className="px-3 py-2">{row.customerName}</td>
                        <td className="px-3 py-2 font-mono" dir="ltr">{row.customerMobile}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${statusLabels[row.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                            {statusLabels[row.status]?.label || row.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-secondary text-xs">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}