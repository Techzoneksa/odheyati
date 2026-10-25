import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: 'تم ربط متجر زد وتسجيل استقبال الطلبات بنجاح.', ok: true },
  denied: { text: 'تم إلغاء الربط من صفحة زد.', ok: false },
  state: { text: 'انتهت صلاحية محاولة الربط. اضغط «ربط زد» مرة أخرى.', ok: false },
  connect: { text: 'تعذّر إكمال الربط مع زد. حاول مرة أخرى، وإن تكرر الخطأ راجع الدعم الفني.', ok: false },
  webhooks: { text: 'تم الربط، لكن تعذّر تسجيل استقبال بعض أحداث الطلبات. التفاصيل بالأسفل.', ok: false },
  not_configured: { text: 'مفاتيح تطبيق زد غير مضافة في إعدادات الخادم.', ok: false },
};

function formatDate(date: Date) {
  return date.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' });
}

export default async function ZidPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const session = await getSession();
  if (!session) {
    redirect('/dashboard/login');
  }

  const [connection, logs, zidOrders] = await Promise.all([
    prisma.zidConnection.findFirst({ orderBy: { updatedAt: 'desc' } }),
    prisma.webhookLog.findMany({
      where: { event: { startsWith: 'zid:' } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, event: true, processed: true, error: true, createdAt: true },
    }),
    prisma.order.count({ where: { zidOrderId: { not: null } } }),
  ]);

  const message = searchParams.connected ? MESSAGES.connected : searchParams.error ? MESSAGES[searchParams.error] : null;

  return (
    <div className="min-h-screen bg-background-cream">
      <header className="bg-background-white border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-text-secondary hover:text-primary">
              ← العودة
            </a>
            <h1 className="text-xl font-bold text-primary">ربط متجر زد</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {message && (
          <div className={`card p-4 ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</div>
        )}

        <div className="card p-6">
          {connection ? (
            <div className="space-y-2">
              <p className="font-bold text-primary">✅ المتجر مربوط</p>
              <p className="text-text-secondary text-sm">
                {connection.storeName || 'متجر زد'} — رقم المتجر {connection.storeId}
              </p>
              <p className="text-text-secondary text-sm">آخر ربط: {formatDate(connection.updatedAt)}</p>
              <p className="text-text-secondary text-sm">طلبات زد في النظام: {zidOrders}</p>
              {connection.webhooksError && (
                <pre className="text-xs text-red-700 whitespace-pre-wrap" dir="ltr">
                  {connection.webhooksError}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-text-secondary">
              المتجر غير مربوط بعد. اضغط الزر وسجّل الدخول في زد بحساب صاحب المتجر ووافق على الصلاحيات.
            </p>
          )}

          {session.role === 'ADMIN' && (
            <a href="/api/zid/connect" className="btn-primary inline-block mt-4">
              {connection ? 'إعادة الربط' : 'ربط زد'}
            </a>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-primary mb-4">آخر الطلبات الواردة من زد</h2>
          {logs.length === 0 ? (
            <p className="text-text-secondary text-sm">لم يصل أي طلب بعد.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap gap-2 border-b border-border pb-2">
                  <span>{log.processed ? '✅' : '⚠️'}</span>
                  <span dir="ltr">{log.event.replace('zid:', '')}</span>
                  <span className="text-text-secondary">{formatDate(log.createdAt)}</span>
                  {log.error && <span className="text-red-700 w-full" dir="ltr">{log.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
