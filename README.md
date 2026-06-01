# توثيقات أضحيتي - MVP

مشروع MVP لنظام توثيق طلبات متجر أضحيتي.

**Production Domain:** https://almotamed.com

## المتطلبات

- Node.js 18+
- PostgreSQL 14+
- npm أو yarn

## طريقة التشغيل

### 1. تثبيت الحزم

```bash
npm install
```

### 2. إعداد قاعدة البيانات

```bash
cp .env.example .env
# عدّل الملف وأضف بياناتك

npm run db:migrate
npm run db:generate
npm run db:seed
```

### 3. تشغيل المشروع

```bash
npm run dev
```

المشروع يعمل على `http://localhost:3000`

Production يعمل على `https://almotamed.com`

## متغيرات البيئة

| المتغير | الوصف |
|---------|-------|
| `DATABASE_URL` | رابط قاعدة البيانات PostgreSQL |
| `APP_URL` | رابط الموقع للإنتاج (https://almotamed.com) |
| `NEXT_PUBLIC_APP_URL` | نفس APP_URL للعميل |
| `NEXTAUTH_SECRET` | مفتاح سري للجلسة (32 حرف على الأقل) |
| `ADMIN_EMAIL` | إيميل الأدمن |
| `ADMIN_PASSWORD` | كلمة مرور الأدمن |
| `SALLA_WEBHOOK_SECRET` | مفتاح webhook سلة |
| `CLOUDFLARE_ACCOUNT_ID` | معرف حساب Cloudflare |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | مفتاح R2 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | مفتاح R2 السري |
| `CLOUDFLARE_R2_BUCKET` | اسم bucket R2 |
| `CLOUDFLARE_R2_PUBLIC_BASE_URL` | رابط قاعدة الملفات |

## إعداد Cloudflare R2

1. أنشئ R2 bucket في Cloudflare Dashboard
2. أنشئ API token مع صلاحيات Read/Write
3. أضف bucket name و cloudflare.com إلى R2 bucket كـ custom domain

## إعداد Salla Webhook

1. من لوحة تحكم سلة، اذهب إلى الإعدادات > التطبيقات > Webhooks
2. أضف webhook جديد لـ URL:
   ```
   https://almotamed.com/api/webhooks/salla
   ```
3. اختر الأحداث:
   - `order.created`
   - `order.updated`
   - `order.paid`
4. انسخ secret وأضفه إلى `SALLA_WEBHOOK_SECRET`

## الاختبار

### اختبار Webhook

```bash
curl -X POST https://almotamed.com/api/webhooks/salla \
  -H "Content-Type: application/json" \
  -H "x-salla-signature: test-signature" \
  -d '{
    "event": "order.created",
    "data": {
      "id": 12345,
      "order_number": "ORD-001",
      "customer": {
        "name": "أحمد محمد",
        "mobile": "0501234567",
        "email": "ahmed@example.com"
      },
      "status": "paid"
    }
  }'
```

### إنشاء طلب تجريبي

```bash
npm run db:seed
```

### تسجيل دخول لوحة التحكم

- الرابط: `https://almotamed.com/dashboard`
- الإيميل: `ADMIN_EMAIL` من `.env`
- كلمة المرور: `ADMIN_PASSWORD` من `.env`

## المسارات

| المسار | الوصف |
|--------|-------|
| `/` | صفحة العميل للبحث عن التوثيق |
| `/proof/[token]` | صفحة مشاهدة التوثيق |
| `/dashboard` | لوحة تحكم الموظف |
| `/dashboard/orders/[id]` | تفاصيل الطلب |
| `/api/webhooks/salla` | webhook سلة |

## الحالات

| الحالة | الوصف |
|--------|-------|
| `PENDING` | بانتظار التنفيذ |
| `IN_PROGRESS` | قيد التنفيذ |
| `SLAUGHTERED` | تم الذبح |
| `MEDIA_UPLOADED` | تم رفع الملفات |
| `READY` | جاهز للعميل |
| `VIEWED` | تمت المشاهدة |
| `CANCELLED` | ملغي |

## الأوامر

```bash
npm run dev        # تشغيل في وضع التطوير
npm run build      # بناء للإنتاج
npm run start      # تشغيل الإنتاج
npm run lint       # فحص الكود
npm run typecheck  # فحص الأنواع
npm run db:generate # توليد Prisma Client
npm run db:migrate  # تطبيق Migrations
npm run db:deploy   # تطبيق Migrations في الإنتاج
npm run db:seed     # تشغيل Seeder
```