'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  sallaStatus: string | null;
  proofStatus: string;
  createdAt: string;
}

interface Stats {
  totalOrders: number;
  uniqueCustomers: number;
  inProgressOrders: number;
  slaughteredOrders: number;
  readyOrders: number;
  withFilesOrders: number;
  withoutFilesOrders: number;
  cancelledOrders: number;
}

interface StatCardProps {
  label: string;
  value: number;
  color: 'primary' | 'secondary' | 'neutral' | 'green' | 'blue' | 'purple' | 'red' | 'yellow';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    primary: 'border-r-primary text-primary',
    secondary: 'border-r-secondary text-secondary-dark',
    neutral: 'border-r-neutral text-neutral',
    green: 'border-r-green-600 text-green-700',
    blue: 'border-r-blue-600 text-blue-700',
    purple: 'border-r-purple-600 text-purple-700',
    red: 'border-r-red-600 text-red-700',
    yellow: 'border-r-yellow-600 text-yellow-700',
  };

  return (
    <div className={`bg-background-white rounded-lg border border-border p-4 border-r-4 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value.toLocaleString('ar-SA')}</p>
      <p className="text-xs text-text-secondary mt-1">{label}</p>
    </div>
  );
}

const statusLabels: Record<string, string> = {
  PENDING: 'بانتظار',
  IN_PROGRESS: 'قيد التنفيذ',
  SLAUGHTERED: 'تم الذبح',
  MEDIA_UPLOADED: 'تم الرفع',
  READY: 'جاهز',
  VIEWED: 'تمت المشاهدة',
  CANCELLED: 'ملغي',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  SLAUGHTERED: 'bg-purple-100 text-purple-800',
  MEDIA_UPLOADED: 'bg-indigo-100 text-indigo-800',
  READY: 'bg-green-100 text-green-800',
  VIEWED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function DashboardClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderNumberSearch, setOrderNumberSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [customerNameSearch, setCustomerNameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchStats();
    fetchOrders(1);
  }, []);

  async function fetchStats() {
    const res = await fetch('/api/orders/stats');
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }

  async function fetchOrders(page: number = 1) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());

    if (statusFilter && statusFilter !== 'all' && statusFilter !== '') {
      params.set('status', statusFilter);
    }
    if (orderNumberSearch) params.set('orderNumber', orderNumberSearch.trim());
    if (mobileSearch) params.set('mobile', mobileSearch.trim());
    if (emailSearch) params.set('email', emailSearch.trim().toLowerCase());
    if (customerNameSearch) params.set('customerName', customerNameSearch.trim());

    const res = await fetch(`/api/orders?${params}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : (data.orders ?? []));
      setCurrentPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } else {
      setOrders([]);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetchOrders(1);
  }

  function handleClear() {
    setOrderNumberSearch('');
    setMobileSearch('');
    setEmailSearch('');
    setCustomerNameSearch('');
    setStatusFilter('');
    setCurrentPage(1);
    fetchOrders(1);
  }

  async function handleLogout() {
    setLogoutLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/dashboard/login');
  }

  return (
    <div className="min-h-screen bg-background-cream">
      <header className="bg-background-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-primary">لوحة التحكم</h1>
                <p className="text-xs text-text-secondary hidden sm:block">إدارة طلبات التوثيق</p>
              </div>
              <a
                href="/dashboard/import"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                استيراد Excel
              </a>
              <a
                href="/dashboard/bulk-upload"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-xs font-medium rounded-lg hover:bg-secondary-dark transition-colors whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                رفع جماعي
              </a>
              <a
                href="/dashboard/export"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral text-white text-xs font-medium rounded-lg hover:bg-neutral-dark transition-colors whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                تصدير Excel
              </a>
            </div>
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className="text-text-secondary hover:text-primary transition-colors text-sm py-2 sm:py-0"
            >
              {logoutLoading ? 'جاري الخروج...' : 'تسجيل الخروج'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="إجمالي الطلبات" value={stats.totalOrders} color="primary" />
            <StatCard label="إجمالي العملاء" value={stats.uniqueCustomers} color="secondary" />
            <StatCard label="قيد التنفيذ" value={stats.inProgressOrders} color="yellow" />
            <StatCard label="تم الذبح" value={stats.slaughteredOrders} color="purple" />
            <StatCard label="التوثيق جاهز" value={stats.readyOrders} color="green" />
            <StatCard label="بدون ملفات" value={stats.withoutFilesOrders} color="neutral" />
            <StatCard label="فيها ملفات" value={stats.withFilesOrders} color="blue" />
            <StatCard label="ملغية" value={stats.cancelledOrders} color="red" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div>
              <label className="label">بحث برقم الطلب</label>
              <input
                type="text"
                value={orderNumberSearch}
                onChange={(e) => setOrderNumberSearch(e.target.value)}
                className="input-field"
                placeholder="مثال: 262190392"
                dir="ltr"
              />
            </div>

            <div>
              <label className="label">بحث بالجوال</label>
              <input
                type="text"
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                className="input-field"
                placeholder="مثال: 532666623 أو 9665XXXXXXXX"
                dir="ltr"
              />
            </div>

            <div>
              <label className="label">بحث بالإيميل</label>
              <input
                type="email"
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                className="input-field"
                placeholder="example@email.com"
                dir="ltr"
              />
            </div>

            <div>
              <label className="label">بحث باسم العميل</label>
              <input
                type="text"
                value={customerNameSearch}
                onChange={(e) => setCustomerNameSearch(e.target.value)}
                className="input-field"
                placeholder="مثال: أحمد محمد"
                dir="rtl"
              />
            </div>

            <div>
              <label className="label">فلترة حسب الحالة</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
              >
                <option value="">الكل</option>
                <option value="PENDING">بانتظار</option>
                <option value="IN_PROGRESS">قيد التنفيذ</option>
                <option value="SLAUGHTERED">تم الذبح</option>
                <option value="MEDIA_UPLOADED">تم رفع الملفات</option>
                <option value="READY">جاهز</option>
                <option value="VIEWED">تمت المشاهدة</option>
                <option value="CANCELLED">ملغي</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              بحث
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-text-secondary font-medium rounded-lg hover:bg-background-cream transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              مسح
            </button>
          </div>
        </form>

        {loading ? (
          <div className="text-center py-12 text-text-secondary">جاري التحميل...</div>
        ) : orders.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-text-secondary mb-4">لا توجد طلبات مطابقة لبحثك</div>
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary font-medium rounded-lg hover:bg-background-cream transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              مسح الفلاتر
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-background-beige">
                  <tr>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap">رقم الطلب</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap">العميل</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap hidden sm:table-cell">الجوال</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap hidden md:table-cell">حالة سلة</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap">التوثيق</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap hidden lg:table-cell">التاريخ</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-background-cream/50">
                      <td className="px-3 sm:px-4 py-3 font-mono text-xs sm:text-sm whitespace-nowrap" dir="ltr">{order.orderNumber}</td>
                      <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap">{order.customerName}</td>
                      <td className="px-3 sm:px-4 py-3 font-mono text-xs sm:text-sm whitespace-nowrap hidden sm:table-cell" dir="ltr">{order.customerMobile}</td>
                      <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                          {order.sallaStatus || '-'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span className={`status-badge status-${order.proofStatus.toLowerCase().replace('_', '-')}`}>
                          {statusLabels[order.proofStatus] || order.proofStatus}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-text-secondary whitespace-nowrap hidden lg:table-cell">
                        {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="text-primary hover:underline text-xs sm:text-sm"
                        >
                          فتح
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
                <button
                  onClick={() => fetchOrders(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border border-border text-sm hover:bg-background-cream disabled:opacity-50"
                >
                  السابق
                </button>
                <span className="text-sm text-text-secondary">
                  صفحة {currentPage} من {totalPages}
                </span>
                <button
                  onClick={() => fetchOrders(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border border-border text-sm hover:bg-background-cream disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}