'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  sallaStatus: string | null;
  proofStatus: string;
  files: { type: string }[];
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

function normalizeMobileForSearch(mobile: string): string[] {
  const variations: string[] = [];
  let cleaned = mobile.replace(/[\s\-()+\[\]]/g, '');
  
  const countryCodes = ['966', '971', '965', '974', '973', '968'];
  
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
    variations.push(cleaned);
  }
  
  if (cleaned.startsWith('0') && cleaned.length > 9) {
    cleaned = cleaned.substring(1);
  }
  
  let detectedCode = '966';
  for (const code of countryCodes) {
    if (cleaned.startsWith(code)) {
      detectedCode = code;
      break;
    }
  }
  
  variations.push(cleaned);
  
  if (cleaned.startsWith(detectedCode)) {
    const localNum = cleaned.substring(detectedCode.length);
    variations.push(localNum);
    if (localNum.startsWith('0')) {
      variations.push(localNum.substring(1));
    }
  }
  
  for (const code of countryCodes) {
    if (!cleaned.startsWith(code) && cleaned.length >= 9) {
      variations.push(code + cleaned);
    }
  }
  
  if (cleaned.length >= 9) {
    variations.push(cleaned.slice(-9));
  }
  
  if (cleaned.length >= 7) {
    variations.push(cleaned.slice(-7));
  }
  
  return Array.from(new Set(variations)).filter(v => v.length >= 7);
}

export default function DashboardClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchOrders();
  }, [statusFilter]);

  async function fetchStats() {
    const res = await fetch('/api/orders/stats');
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }

  async function fetchOrders() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);

    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data);
    }
    setLoading(false);
  }

  async function handleLogout() {
    setLogoutLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/dashboard/login');
  }

  const filteredOrders = orders.filter((order) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (order.orderNumber.toLowerCase().includes(searchLower)) {
        return true;
      }
    }
    if (mobileSearch) {
      const variations = normalizeMobileForSearch(mobileSearch);
      return variations.some(v => order.customerMobile.includes(v));
    }
    return true;
  });

  const statusLabels: Record<string, string> = {
    PENDING: 'بانتظار',
    IN_PROGRESS: 'قيد التنفيذ',
    SLAUGHTERED: 'تم الذبح',
    MEDIA_UPLOADED: 'تم الرفع',
    READY: 'جاهز',
    VIEWED: 'تمت المشاهدة',
    CANCELLED: 'ملغي',
  };

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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                استيراد Excel
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

        <div className="card p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="label">بحث برقم الطلب</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field"
                placeholder="مثال: 262392337"
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
                placeholder="5XXXXXXXX أو +9665XXXXXXXX"
                dir="ltr"
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
        </div>

        {loading ? (
          <div className="text-center py-12 text-text-secondary">جاري التحميل...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">لا توجد طلبات</div>
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
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap hidden sm:table-cell">الملفات</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap hidden lg:table-cell">التاريخ</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-text-primary"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((order) => {
                    const imagesCount = order.files.filter((f) => f.type === 'IMAGE').length;
                    const videosCount = order.files.filter((f) => f.type === 'VIDEO').length;

                    return (
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
                        <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap hidden sm:table-cell">
                          {imagesCount > 0 && <span className="text-blue-600">📷 {imagesCount}</span>}
                          {videosCount > 0 && <span className="text-purple-600 mr-1">🎬 {videosCount}</span>}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}