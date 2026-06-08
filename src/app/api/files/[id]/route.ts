import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fileExists, getSignedDownloadUrl } from '@/lib/r2';
import { getSession } from '@/lib/auth';
import { UPLOAD_CONFIG } from '@/lib/upload-config';

interface Props {
params: Promise<{ id: string }>;
}

interface ProofFileForStorage {
id: string;
orderId: string;
type: string;
storageKey: string;
fileName: string;
uploadedById: string | null;
}

function normalizeStorageKey(value: string): string {
let key = String(value || '').trim();

if (!key) {
return '';
}

const lowerKey = key.toLowerCase();

if (
lowerKey.startsWith('https://') ||
lowerKey.startsWith('http://')
) {
try {
const parsedUrl = new URL(key);
key = parsedUrl.pathname;
} catch {
// نحتفظ بالقيمة الأصلية إذا لم تكن رابطًا صالحًا.
}
}

const queryIndex = key.indexOf('?');

if (queryIndex >= 0) {
key = key.slice(0, queryIndex);
}

const backslash = String.fromCharCode(92);
key = key.split(backslash).join('/');

while (key.startsWith('/')) {
key = key.slice(1);
}

try {
key = decodeURIComponent(key);
} catch {
// نحتفظ بالمفتاح كما هو إذا فشل فك الترميز.
}

return key;
}

function getFileNameFromKey(value: string): string {
const normalizedValue = normalizeStorageKey(value);

if (!normalizedValue) {
return '';
}

const parts = normalizedValue
.split('/')
.filter(function (part) {
return Boolean(part);
});

if (parts.length === 0) {
return '';
}

return parts[parts.length - 1];
}

async function resolveStorageKey(
file: ProofFileForStorage,
orderNumber: string
): Promise<string | null> {
const currentKey = normalizeStorageKey(file.storageKey);

if (currentKey) {
const currentKeyExists = await fileExists(currentKey);

```
if (currentKeyExists) {
  return currentKey;
}
```

}

const keyFileName = getFileNameFromKey(currentKey);
const originalFileName = getFileNameFromKey(file.fileName);
const fileName = keyFileName || originalFileName;

if (!fileName) {
return null;
}

const folder =
file.type === 'IMAGE'
? 'images'
: 'videos';

const legacyKey =
'proofs/' +
orderNumber +
'/' +
folder +
'/' +
fileName;

const legacyKeyExists = await fileExists(legacyKey);

if (!legacyKeyExists) {
return null;
}

console.warn('LEGACY_STORAGE_KEY_RESOLVED', {
fileId: file.id,
orderId: file.orderId,
type: file.type,
});

return legacyKey;
}

function getSafeFileName(fileName: string): string {
let safeName = String(fileName || 'file');

safeName = safeName.split('\r').join('');
safeName = safeName.split('\n').join('');
safeName = safeName.split('"').join('');
safeName = safeName.trim();

return safeName || 'file';
}

export async function GET(
_request: Request,
{ params }: Props
) {
try {
const { id } = await params;

```
const file = await prisma.proofFile.findUnique({
  where: {
    id,
  },
  select: {
    id: true,
    orderId: true,
    type: true,
    storageKey: true,
    fileName: true,
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
    {
      status: 404,
    }
  );
}

const order = await prisma.order.findUnique({
  where: {
    id: file.orderId,
  },
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
    {
      status: 404,
    }
  );
}

const resolvedStorageKey =
  await resolveStorageKey(
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
    {
      status: 404,
    }
  );
}

const signedUrl =
  await getSignedDownloadUrl(
    resolvedStorageKey,
    UPLOAD_CONFIG.SIGNED_URL_EXPIRY_SECONDS
  );

const response =
  NextResponse.redirect(signedUrl);

response.headers.set(
  'X-Content-Type-Options',
  'nosniff'
);

response.headers.set(
  'Content-Disposition',
  'inline; filename="' +
    getSafeFileName(file.fileName) +
    '"'
);

response.headers.set(
  'Cache-Control',
  'private, max-age=300'
);

return response;
```

} catch (error) {
console.error('FILE_GET_FAILURE', {
message:
error instanceof Error
? error.message
: 'Unknown',
});

```
return NextResponse.json(
  {
    success: false,
    code: 'FILE_FETCH_FAILED',
    error: 'تعذر تحميل الملف، حاول مرة أخرى',
  },
  {
    status: 500,
  }
);
```

}
}

export async function DELETE(
_request: Request,
{ params }: Props
) {
const session = await getSession();

if (!session) {
return NextResponse.json(
{
success: false,
error: 'انتهت الجلسة، سجل الدخول مرة أخرى',
},
{
status: 401,
}
);
}

if (
!UPLOAD_CONFIG.ALLOWED_ROLES.includes(
session.role
)
) {
return NextResponse.json(
{
success: false,
error: 'ليس لديك صلاحية لحذف الملفات',
},
{
status: 403,
}
);
}

const { id } = await params;

const file = await prisma.proofFile.findUnique({
where: {
id,
},
select: {
id: true,
orderId: true,
type: true,
storageKey: true,
fileName: true,
uploadedById: true,
},
});

if (!file) {
return NextResponse.json(
{
success: false,
error: 'الملف غير موجود',
},
{
status: 404,
}
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
{
status: 403,
}
);
}

const order = await prisma.order.findUnique({
where: {
id: file.orderId,
},
select: {
orderNumber: true,
},
});

if (!order) {
return NextResponse.json(
{
success: false,
error: 'الطلب المرتبط بالملف غير موجود',
},
{
status: 404,
}
);
}

const resolvedStorageKey =
await resolveStorageKey(
file,
String(order.orderNumber)
);

if (!resolvedStorageKey) {
return NextResponse.json(
{
success: false,
error: 'ملف التخزين غير موجود، لم يتم حذف السجل',
},
{
status: 404,
}
);
}

try {
const { deleteFile } =
await import('@/lib/r2');

```
await deleteFile(resolvedStorageKey);
```

} catch (error) {
console.error('R2_DELETE_FAILURE', {
fileId: id,
error:
error instanceof Error
? error.message
: 'Unknown',
});

```
return NextResponse.json(
  {
    success: false,
    error: 'تعذر حذف الملف من التخزين',
  },
  {
    status: 500,
  }
);
```

}

await prisma.proofFile.delete({
where: {
id,
},
});

console.log('FILE_DELETED', {
fileId: id,
userId: session.id,
});

return NextResponse.json({
success: true,
});
}
