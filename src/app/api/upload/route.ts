import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/r2';
import crypto from 'crypto';
import { UPLOAD_CONFIG, uploadSecurity } from '@/lib/upload-config';

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + UPLOAD_CONFIG.RATE_LIMIT.WINDOW_MS });
    return true;
  }
  if (entry.count >= UPLOAD_CONFIG.RATE_LIMIT.MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function mimeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp';
  if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return 'video/mp4';
  }
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return 'video/webm';
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'انتهت الجلسة، سجل الدخول مرة أخرى' },
      { status: 401 }
    );
  }

  if (!UPLOAD_CONFIG.ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json(
      { success: false, error: 'ليس لديك صلاحية لرفع الملفات' },
      { status: 403 }
    );
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'عدد محاولات الرفع كبير، حاول بعد قليل' },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const orderId = formData.get('orderId') as string | null;

    if (!file || !orderId) {
      return NextResponse.json(
        { success: false, error: 'بيانات غير مكتملة' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'الطلب غير موجود' },
        { status: 404 }
      );
    }

    const safeName = uploadSecurity.sanitizeFilename(file.name);
    const typeCheck = uploadSecurity.validateFileType(safeName, file.type);
    if (!typeCheck.valid) {
      return NextResponse.json(
        { success: false, error: typeCheck.error || 'نوع الملف غير مدعوم' },
        { status: 415 }
      );
    }

    const maxBytes = uploadSecurity.maxBytesForMime(file.type);
    if (file.size > maxBytes) {
      return NextResponse.json(
        { success: false, error: 'حجم الملف أكبر من الحد المسموح', maxBytes },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const detectedMime = mimeFromBuffer(buffer);
    if (!detectedMime) {
      return NextResponse.json(
        { success: false, error: 'نوع الملف غير مدعوم' },
        { status: 415 }
      );
    }

    if (!UPLOAD_CONFIG.ALLOWED_MIME_STRINGS.includes(detectedMime)) {
      return NextResponse.json(
        { success: false, error: 'نوع الملف غير مدعوم' },
        { status: 415 }
      );
    }

    if (!uploadSecurity.checkMagicBytes(buffer, detectedMime)) {
      return NextResponse.json(
        { success: false, error: 'نوع الملف غير مدعوم' },
        { status: 415 }
      );
    }

    const ext = uploadSecurity.extname(safeName) || '.bin';
    const storageKey = `orders/${order.orderNumber}/${crypto.randomUUID()}${ext}`;
    const fileType = (UPLOAD_CONFIG.MIME_TYPES.IMAGE as readonly string[]).includes(detectedMime) ? 'IMAGE' : 'VIDEO';

    const { storageKey: actualStorageKey } = await uploadFile(order.orderNumber, fileType, buffer, storageKey.split('/').pop()!, detectedMime);

    try {
      const maxSortOrder = await prisma.proofFile.aggregate({
        where: { orderId, type: fileType },
        _max: { sortOrder: true },
      });

      const proofFile = await prisma.proofFile.create({
        data: {
          orderId,
          type: fileType,
          storageKey: actualStorageKey,
          fileName: safeName,
          mimeType: detectedMime,
          size: buffer.length,
          sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
          uploadedById: session.id,
        },
      });

      console.log('UPLOAD_SUCCESS', {
        fileId: proofFile.id,
        orderId,
        type: fileType,
        size: buffer.length,
        userId: session.id,
      });

      return NextResponse.json(proofFile);
    } catch (dbError) {
      console.error('UPLOAD_DB_FAILURE', {
        orderId,
        storageKeyPrefix: storageKey.slice(0, 30),
        error: dbError instanceof Error ? dbError.message : 'Unknown',
      });

      try {
        const { deleteFile } = await import('@/lib/r2');
        await deleteFile(storageKey);
      } catch (cleanupError) {
        console.error('UPLOAD_CLEANUP_FAILURE', {
          storageKeyPrefix: storageKey.slice(0, 30),
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown',
        });
      }

      return NextResponse.json(
        { success: false, error: 'تعذر رفع الملف، حاول مرة أخرى' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('UPLOAD_ERROR', {
      status: 500,
      message: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json(
      { success: false, error: 'تعذر رفع الملف، حاول مرة أخرى' },
      { status: 500 }
    );
  }
}
