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
  const [searchType, setSearchType] = useState<'order' | 'mobile' | 'email'>('order');
  const [countryCode, setCountryCode] = useState('966');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<{id: string; orderNumber: string; proofStatus: string; createdAt: string; proofToken: string}[]>([]);
  const [autoSearchExecuted, setAutoSearchExecuted] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError('');
    setOrders([]);
    setLoading(true);

    if (searchType === 'order') {
      const cleanOrderNumber = orderNumber.replace(/[\s#]/g, '');
      if (cleanOrderNumber.length < 3) {
        setError('رقم الطلب غير صالح');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNumber: cleanOrderNumber }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          setError('لم نجد طلبًا بهذا الرقم. تأكد من رقم الطلب وحاول مرة أخرى.');
          setLoading(false);
          return;
        }

        const readyStatuses = ['READY', 'VIEWED', 'MEDIA_UPLOADED'];

        if (data.orders && data.orders.length > 1) {
          setOrders(data.orders);
          setLoading(false);
          return;
        }

        const order = data.orders?.[0];
        if (order && order.proofToken && readyStatuses.includes(order.proofStatus)) {
          window.location.href = `/proof/${order.proofToken}`;
        } else if (order) {
          setError('طلبك موجود لدينا وجاري تجهيز التوثيق حاليًا. سيظهر رابط مشاهدة التوثيق فور اكتمال رفع الصور أو الفيديوهات.');
        } else {
          setError('لم نجد طلبًا بهذا الرقم. تأكد من رقم الطلب وحاول مرة أخرى.');
        }
      } catch {
        setError('حدث خطأ، حاول مرة أخرى');
      }
      setLoading(false);
      return;
    }

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
          setError('لم نجد طلبًا مرتبطًا بهذا البريد الإلكتروني. تأكد من الإيميل وحاول مرة أخرى.');
          setLoading(false);
          return;
        }

        const readyStatuses = ['READY', 'VIEWED', 'MEDIA_UPLOADED'];

        if (data.orders && data.orders.length > 1) {
          setOrders(data.orders);
          setLoading(false);
          return;
        }

        if (data.orders && data.orders.length === 1) {
          const order = data.orders[0];
          if (order.proofToken && readyStatuses.includes(order.proofStatus)) {
            window.location.href = `/proof/${order.proofToken}`;
          } else {
            setError('طلبك موجود لدينا وجاري تجهيز التوثيق حاليًا. سيظهر رابط مشاهدة التوثيق فور اكتمال رفع الصور أو الفيديوهات.');
          }
        } else {
          setError('لم نجد طلبًا مرتبطًا بهذا البريد الإلكتروني. تأكد من الإيميل وحاول مرة أخرى.');
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
        setError('لم نجد طلبًا مرتبطًا بهذا الرقم. تأكد من الرقم وحاول مرة أخرى.');
        setLoading(false);
        return;
      }

      const readyStatuses = ['READY', 'VIEWED', 'MEDIA_UPLOADED'];

      if (data.orders && data.orders.length > 1) {
        setOrders(data.orders);
        setLoading(false);
        return;
      }

      if (data.orders && data.orders.length === 1) {
        const order = data.orders[0];
        if (order.proofToken && readyStatuses.includes(order.proofStatus)) {
          window.location.href = `/proof/${order.proofToken}`;
        } else {
          setError('طلبك موجود لدينا وجاري تجهيز التوثيق حاليًا. سيظهر رابط مشاهدة التوثيق فور اكتمال رفع الصور أو الفيديوهات.');
        }
      } else {
        setError('لم نجد طلبًا مرتبطًا بهذا الرقم. تأكد من الرقم وحاول مرة أخرى.');
      }
    } catch {
      setError('حدث خطأ، حاول مرة أخرى');
    }
    setLoading(false);
  }, [mobile, countryCode, email, orderNumber, searchType]);

  useEffect(() => {
    const urlCountryCode = searchParams.get('countryCode');
    const urlMobile = searchParams.get('mobile');
    const urlEmail = searchParams.get('email');
    const urlOrder = searchParams.get('order');

    if (urlOrder) {
      setSearchType('order');
      setOrderNumber(urlOrder);
      setAutoSearchExecuted(true);
    } else if (urlEmail) {
      setSearchType('email');
      setEmail(urlEmail);
      setAutoSearchExecuted(true);
    } else if (urlMobile) {
      const cleanMobile = urlMobile.replace(/\D/g, '');
      if (urlCountryCode) {
        setCountryCode(urlCountryCode);
        setMobile(cleanMobile.startsWith(urlCountryCode) ? cleanMobile.substring(urlCountryCode.length) : cleanMobile);
      } else {
        if (cleanMobile.startsWith('966')) {
          setCountryCode('966');
          setMobile(cleanMobile.substring(3));
        } else if (cleanMobile.startsWith('971')) {
          setCountryCode('971');
          setMobile(cleanMobile.substring(3));
        } else if (cleanMobile.startsWith('965')) {
          setCountryCode('965');
          setMobile(cleanMobile.substring(3));
        } else if (cleanMobile.startsWith('974')) {
          setCountryCode('974');
          setMobile(cleanMobile.substring(3));
        } else if (cleanMobile.startsWith('973')) {
          setCountryCode('973');
          setMobile(cleanMobile.substring(3));
        } else if (cleanMobile.startsWith('968')) {
          setCountryCode('968');
          setMobile(cleanMobile.substring(3));
        } else {
          setCountryCode('966');
          setMobile(cleanMobile);
        }
      }
      setAutoSearchExecuted(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (autoSearchExecuted) {
      if (searchType === 'order' && orderNumber) {
        handleSubmit();
        setAutoSearchExecuted(false);
      } else if (searchType === 'email' && email) {
        handleSubmit();
        setAutoSearchExecuted(false);
      } else if (searchType === 'mobile' && mobile.length >= 7) {
        handleSubmit();
        setAutoSearchExecuted(false);
      }
    }
  }, [autoSearchExecuted, handleSubmit, searchType, email, mobile, orderNumber]);

  return (
    <div className="card p-6">
      <p className="text-center text-text-secondary mb-6">
        {searchType === 'order'
          ? 'أدخل رقم طلبك لمشاهدة توثيقه'
          : searchType === 'email'
          ? 'أدخل إيميلك لمشاهدة توثيقات طلباتك'
          : 'أدخل رقم جوالك لمشاهدة توثيقات طلباتك'}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSearchType('order')}
          className={`flex-1 py-2 px-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
            searchType === 'order'
              ? 'bg-primary text-white'
              : 'bg-background-beige text-text-secondary hover:bg-border'
          }`}
        >
          🔢 رقم الطلب
        </button>
        <button
          type="button"
          onClick={() => setSearchType('mobile')}
          className={`flex-1 py-2 px-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
            searchType === 'mobile'
              ? 'bg-primary text-white'
              : 'bg-background-beige text-text-secondary hover:bg-border'
          }`}
        >
          📱 الجوال
        </button>
        <button
          type="button"
          onClick={() => setSearchType('email')}
          className={`flex-1 py-2 px-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
            searchType === 'email'
              ? 'bg-primary text-white'
              : 'bg-background-beige text-text-secondary hover:bg-border'
          }`}
        >
          📧 الإيميل
        </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
        {searchType === 'order' ? (
          <div>
            <label className="label">رقم الطلب</label>
            <input
              type="text"
              inputMode="numeric"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.slice(0, 30))}
              className="input-field"
              placeholder="مثال: 262190392"
              dir="ltr"
              required
            />
            <p className="text-xs text-text-secondary mt-1">
              تجده في رسالة تأكيد الطلب أو في صفحة طلباتك في المتجر
            </p>
          </div>
        ) : searchType === 'email' ? (
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
            <img src="/logo.png" alt="أضحيتي" width={205} height={60} className="mx-auto" />
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