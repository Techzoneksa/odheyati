'use client';

import { useState } from 'react';
import { lookupSchema } from '@/lib/schemas';
import Image from 'next/image';

export default function HomePage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [mobileLast4, setMobileLast4] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const parsed = lookupSchema.safeParse({ orderNumber, mobileLast4 });
    
    if (!parsed.success) {
      setError('بيانات غير صالحة');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const data = await res.json();

      if (!res.ok || !data.found) {
        setError('لم نتمكن من العثور على توثيق مطابق. تأكد من رقم الطلب وآخر 4 أرقام من الجوال.');
        setLoading(false);
        return;
      }

      window.location.href = `/proof/${data.token}`;
    } catch {
      setError('حدث خطأ، حاول مرة أخرى');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4">
            <Image src="/logo.svg" alt="أضحيتي" width={120} height={50} className="mx-auto" />
          </div>
          <p className="text-lg text-text-secondary">توثيقات أضحيتي</p>
        </div>

        <div className="card p-6">
          <p className="text-center text-text-secondary mb-6">
            أدخل رقم الطلب وآخر 4 أرقام من الجوال لمشاهدة توثيق أضحيتك
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="orderNumber" className="label">رقم الطلب</label>
              <input
                type="text"
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="input-field"
                placeholder="أدخل رقم الطلب"
                dir="ltr"
                required
              />
            </div>

            <div>
              <label htmlFor="mobileLast4" className="label">آخر 4 أرقام من الجوال</label>
              <input
                type="text"
                id="mobileLast4"
                value={mobileLast4}
                onChange={(e) => setMobileLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="input-field"
                placeholder="----"
                maxLength={4}
                dir="ltr"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'جاري البحث...' : 'عرض التوثيق'}
            </button>
          </form>
        </div>

        <p className="text-center text-text-secondary text-sm mt-6">
          جميع الحقوق محفوظة لأضحيتي
        </p>
      </div>
    </main>
  );
}