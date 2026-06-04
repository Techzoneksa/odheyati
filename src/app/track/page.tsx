'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const countries = [
  { code: '966', name: 'السعودية', flag: '🇸🇦' },
  { code: '971', name: 'الإمارات', flag: '🇦🇪' },
  { code: '965', name: 'الكويت', flag: '🇰🇼' },
  { code: '974', name: 'قطر', flag: '🇶🇦' },
  { code: '973', name: 'البحرين', flag: '🇧🇭' },
  { code: '968', name: 'عمان', flag: '🇴🇲' },
];

function TrackContent() {
  const searchParams = useSearchParams();
  const [searchType, setSearchType] = useState<'mobile' | 'email'>('mobile');
  const [countryCode, setCountryCode] = useState('966');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<{id: string; orderNumber: string; proofStatus: string; createdAt: string; proofToken: string}[]>([]);
  const [autoSearchExecuted, setAutoSearchExecuted] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError('');
    setOrders([]);
    setLoading(true);

    if (searchType === 'email') {
      if (!email || !email.includes('@')) {
        setError('الإيميل غير صالح');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          setError('لم نجد توثيقًا مرتبطًا بهذا الإيميل. تأكد من الإيميل وحاول مرة أخرى.');
          setLoading(false);
          return;
        }

        if (data.orders && data.orders.length > 1) {
          setOrders(data.orders);
          setLoading(false);
          return;
        }

        if (data.token) {
          window.location.href = `/proof/${data.token}`;
        } else if (data.orders && data.orders.length === 1) {
          window.location.href = `/proof/${data.orders[0].proofToken}`;
        } else {
          setError('لم نجد توثيقًا مرتبطًا بهذا الإيميل. تأكد من الإيميل وحاول مرة أخرى.');
        }
      } catch {
        setError('حدث خطأ، حاول مرة أخرى');
      }
      setLoading(false);
      return;
    }

    if (mobile.length < 7) {
      setError('رقم الجوال غير صالح');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode, mobile }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError('لم نجد توثيقًا مرتبطًا بهذا الرقم. تأكد من الرقم وحاول مرة أخرى.');
        setLoading(false);
        return;
      }

      if (data.orders && data.orders.length > 1) {
        setOrders(data.orders);
        setLoading(false);
        return;
      }

      if (data.token) {
        window.location.href = `/proof/${data.token}`;
      } else if (data.orders && data.orders.length === 1) {
        window.location.href = `/proof/${data.orders[0].proofToken}`;
      } else {
        setError('لم نجد توثيقًا مرتبطًا بهذا الرقم. تأكد من الرقم وحاول مرة أخرى.');
      }
    } catch {
      setError('حدث خطأ، حاول مرة أخرى');
    }
    setLoading(false);
  }, [mobile, countryCode, email, searchType]);

  useEffect(() => {
    const urlCountryCode = searchParams.get('countryCode');
    const urlMobile = searchParams.get('mobile');

    if (urlCountryCode && urlMobile) {
      setCountryCode(urlCountryCode);
      setMobile(urlMobile.replace(/\D/g, ''));
      setAutoSearchExecuted(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (autoSearchExecuted && mobile.length >= 7) {
      handleSubmit();
      setAutoSearchExecuted(false);
    }
  }, [autoSearchExecuted, handleSubmit]);

  return (
    <div className="card p-6">
      <p className="text-center text-text-secondary mb-6">
        {searchType === 'email'
          ? 'أدخل إيميلك لمشاهدة توثيقات طلباتك'
          : 'أدخل رقم جوالك لمشاهدة توثيقات طلباتك'}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSearchType('mobile')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
            searchType === 'mobile'
              ? 'bg-primary text-white'
              : 'bg-background-beige text-text-secondary hover:bg-border'
          }`}
        >
          📱 بحث بالجوال
        </button>
        <button
          type="button"
          onClick={() => setSearchType('email')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
            searchType === 'email'
              ? 'bg-primary text-white'
              : 'bg-background-beige text-text-secondary hover:bg-border'
          }`}
        >
          📧 بحث بالإيميل
        </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
        {searchType === 'email' ? (
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="example@email.com"
              dir="ltr"
              required
            />
          </div>
        ) : (
          <>
            <div>
              <label className="label">الدولة</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input-field"
                dir="rtl"
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} +{c.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">رقم الجوال</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 9))}
                className="input-field"
                placeholder={countryCode === '966' ? '5XXXXXXXX' : '5XXXXXXXXXX'}
                dir="ltr"
                required
              />
              <p className="text-xs text-text-secondary mt-1">
                اكتب رقم الجوال بدون الصفر الأول، مثال للسعودية: 5XXXXXXXX
              </p>
            </div>
          </>
        )}

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

      {orders.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="font-medium text-text-primary mb-3">الطلبات المرتبطة</h3>
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-background-beige rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-mono text-sm" dir="ltr">{order.orderNumber}</p>
                  <p className="text-xs text-text-secondary">
                    {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                <a
                  href={`/proof/${order.proofToken}`}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  عرض التوثيق
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4">
            <img src="/logo.png" alt="أضحيتي" width={180} height={60} className="mx-auto" />
          </div>
          <p className="text-lg text-text-secondary">توثيقات أضحيتي</p>
        </div>

        <Suspense fallback={<div className="card p-6 text-center">جاري التحميل...</div>}>
          <TrackContent />
        </Suspense>

        <p className="text-center text-text-secondary text-sm mt-6">
          جميع الحقوق محفوظة لأضحيتي
        </p>
      </div>
    </main>
  );
}