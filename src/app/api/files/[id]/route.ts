import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fileExists, getSignedDownloadUrl } from '@/lib/r2';
import { getSession } from '@/lib/auth';
import { UPLOAD_CONFIG } from '@/lib/upload-config';

interface Props {
params: Promise<{ id: string }>;
}

interface StoredFile {
id: string;
orderId: string;
type: string;
storageKey: string;
fileName: string;
mimeType: string | null;
uploadedById: string | null;
}

function normalizeStoredKey(value: string): string {
let key = String(value || '').trim();

if (!key) {
return '';
}

try {
if (/^https?:///i.test(key)) {
const url = new URL(key);
key = url.pathname;
}
} catch {
// نكمل بالقيمة الأصلية إذا كانت ليست URL صالحًا.
}

key = key.split('?')[0];
key = key.replace(/\/g, '/');
key = key.replace(/^/+/, '');

try {
key = decodeURIComponent(key);
} catch {
// نتجاهل فشل فك الترميز ونستخدم المفتاح كما هو.
}

return key;
}

function getBaseName(value: string): string {
const normalized = normalizeStoredKey(value);
const parts = normalized.split('/').filter(Boolean);

return parts[parts.length - 1] || '';
}

async function resolveStorageKey(
file: StoredFile,
orderNumber: string
): Promise<string | null> {
const originalKey = normalizeStoredKey(file.storageKey);
const folder = file.type === 'IMAGE' ? 'images' : 'videos';

const storageFileName = getBaseName(originalKey);
const originalFileName = getBaseName(file.fileName);

const candidates = [
originalKey,
storageFileName
? `proofs/${orderNumber}/${folder}/${storageFileName}`
: '',
originalFileName
? `proofs/${orderNumber}/${folder}/${originalFileName}`
: '',
].filter(Boolean);

const uniqueCandidates = Array.from(new Set(candidates));

for (const candidate of uniqueCandidates) {
if (await fileExists(candidate)) {
if (candidate !== originalKey) {
console.warn('LEGACY_STORAGE_KEY_RESOLVED', {
fileId: file.id,
orderId: file.orderId,
type: file.type,
});
}

```
  return candidate;
}
```

}

return null;
}

function safeDownloadName(value: string): string {
return String(value || 'file')
.replace(/[\r\n"]/g, '')
.trim() || 'file';
}

export async function GET(request: Request, { params }: Props) {
try {
const { id } = await params;

```
const file = await prisma.proofFile.findUnique({
  where: { id },
  select: {
    id: true,
    orderId: true,
    type: true,
    storageKey: true,
    fileName: true,
    mimeType: true,
    uploadedById: true,
  },
});

if (!file) {
  return NextResponse.json(
    {
      success: false,
      code: 'FILE_RECORD_NOT_FOUND',
      error: 'الملف غير موجود',
    },
    { status: 404 }
  );
}

const order = await prisma.order.findUnique({
  where: { id: file.orderId },
  select: {
    orderNumber: true,
  },
});

if (!order) {
  return NextResponse.json(
    {
      success: false,
      code: 'ORDER_NOT_FOUND',
      error: 'الطلب المرتبط بالملف غير موجود',
    },
    { status: 404 }
  );
}

const resolvedStorageKey = await resolveStorageKey(
  file,
  String(order.orderNumber)
);

if (!resolvedStorageKey) {
  console.warn('FILE_MISSING_IN_R2', {
    fileId: file.id,
    orderId: file.orderId,
    type: file.type,
  });

  return NextResponse.json(
    {
      success: false,
      code: 'FILE_NOT_FOUND_IN_STORAGE',
      error: 'ملف التوثيق غير متوفر حاليًا',
    },
    { status: 404 }
  );
}

const signedUrl = await getSignedDownloadUrl(
  resolvedStorageKey,
  UPLOAD_CONFIG.SIGNED_URL_EXPIRY_SECONDS
);

const response = NextResponse.redirect(signedUrl);

response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set(
  'Content-Disposition',
  `inline; filename="${safeDownloadName(file.fileName)}"`
);
response.headers.set('Cache-Control', 'private, max-age=300');

return response;
```

} catch (error) {
console.error('FILE_GET_FAILURE', {
message: error instanceof Error ? error.message : 'Unknown',
});

```
return NextResponse.json(
  {
    success: false,
    code: 'FILE_FETCH_FAILED',
    error: 'تعذر تحميل الملف، حاول مرة أخرى',
  },
  { status: 500 }
);
```

}
}

export async function DELETE(request: Request, { params }: Props) {
const session = await getSession();

if (!session) {
return NextResponse.json(
{
success: false,
error: 'انتهت الجلسة، سجل الدخول مرة أخرى',
},
{ status: 401 }
);
}

if (!UPLOAD_CONFIG.ALLOWED_ROLES.includes(session.role)) {
return NextResponse.json(
{
success: false,
error: 'ليس لديك صلاحية لحذف الملفات',
},
{ status: 403 }
);
}

const { id } = await params;

const file = await prisma.proofFile.findUnique({
where: { id },
});

if (!file) {
return NextResponse.json(
{
success: false,
error: 'الملف غير موجود',
},
{ status: 404 }
);
}

const isAuthorized =
session.role === 'ADMIN' ||
file.uploadedById === session.id;

if (!isAuthorized) {
return NextResponse.json(
{
success: false,
error: 'ليس لديك صلاحية لحذف هذا الملف',
},
{ status: 403 }
);
}

try {
const { deleteFile } = await import('@/lib/r2');
await deleteFile(file.storageKey);
} catch (error) {
console.error('R2_DELETE_FAILURE', {
fileId: id,
error: error instanceof Error ? error.message : 'Unknown',
});

```
return NextResponse.json(
  {
    success: false,
    error: 'تعذر حذف الملف من التخزين',
  },
  { status: 500 }
);
```

}

await prisma.proofFile.delete({
where: { id },
});

console.log('FILE_DELETED', {
fileId: id,
userId: session.id,
});

return NextResponse.json({
success: true,
});
}
