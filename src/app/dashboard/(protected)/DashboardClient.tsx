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

export default function DashboardClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

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
      return (
        order.orderNumber.toLowerCase().includes(searchLower) ||
        order.customerMobile.includes(search)
      );
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-primary">لوحة التحكم</h1>
          <a
            href="/dashboard/import"
            className="btn-secondary text-sm"
          >
            استيراد طلبات من Excel
          </a>
        </div>
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="text-text-secondary hover:text-primary transition-colors text-sm"
          >
            {logoutLoading ? 'جاري الخروج...' : 'تسجيل الخروج'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="card p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">بحث برقم الطلب</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field"
                placeholder="مثال: ORD-001"
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
                placeholder="05xxxxxxxx"
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
              <table className="w-full">
                <thead className="bg-background-beige">
                  <tr>
                    <th className="text-right px-4 py-3 text-sm font-medium text-text-primary">رقم الطلب</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-text-primary">العميل</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-text-primary">الجوال</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-text-primary">حالة سلة</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-text-primary">التوثيق</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-text-primary">الملفات</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-text-primary">التاريخ</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-text-primary"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((order) => {
                    const imagesCount = order.files.filter((f) => f.type === 'IMAGE').length;
                    const videosCount = order.files.filter((f) => f.type === 'VIDEO').length;

                    return (
                      <tr key={order.id} className="hover:bg-background-cream/50">
                        <td className="px-4 py-3 font-mono text-sm" dir="ltr">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm">{order.customerName}</td>
                        <td className="px-4 py-3 font-mono text-sm" dir="ltr">{order.customerMobile}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {order.sallaStatus || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`status-badge status-${order.proofStatus.toLowerCase().replace('_', '-')}`}>
                            {statusLabels[order.proofStatus] || order.proofStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {imagesCount > 0 && <span className="text-blue-600">📷 {imagesCount}</span>}
                          {videosCount > 0 && <span className="text-purple-600 mr-2">🎬 {videosCount}</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="text-primary hover:underline text-sm"
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