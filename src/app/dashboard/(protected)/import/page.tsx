'use client';

import { useState } from 'react';
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError('يرجى اختيار ملف Excel بصيغة .xlsx');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('حجم الملف كبير جدًا. الحد الأقصى 5MB');
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

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

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
            <h1 className="text-xl font-bold text-text-primary">استيراد طلبات من سلة</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">رفع ملف Excel</h2>
          
          <div className="mb-4">
            <label className="btn-secondary cursor-pointer inline-flex items-center">
              <span>{file ? file.name : 'اختر ملف Excel'}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          <p className="text-sm text-text-secondary mb-4">
            الأعمدة المطلوبة: رقم الطلب، اسم العميل، رقم الجوال
            <br />
            الأعمدة الاختيارية: حالة الطلب، المبلغ
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
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
                className="btn-primary"
              >
                {importing ? 'جاري الاستيراد...' : 'اعتماد الاستيراد'}
              </button>
              <button
                onClick={() => { setPreview([]); setFile(null); }}
                className="btn-secondary"
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