import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, FileType } from '@/lib/r2';
import crypto from 'crypto';
import { UPLOAD_CONFIG, uploadSecurity } from '@/lib/upload-config';

interface ParsedFile {
  originalName: string;
  orderNumber: string | null;
  status: 'ready' | 'no_order_number' | 'order_not_found' | 'unsupported_type' | 'file_too_large' | 'invalid_content';
  customerName: string | null;
  fileType: FileType | null;
  message: string;
  fileBuffer?: Buffer;
  mimeType?: string;
  size?: number;
}

function extractOrderNumber(fileName: string): string | null {
  const baseName = fileName.trim().replace(/\.[^/.]+$/, '');
  const match = baseName.match(/\d+/);
  return match ? match[0] : null;
}

function getFileType(mime: string): FileType | null {
  if (UPLOAD_CONFIG.ALLOWED_MIME_STRINGS.includes(mime)) {
    if (UPLOAD_CONFIG.MIME_TYPES.IMAGE.includes(mime as any)) return 'IMAGE';
    if (UPLOAD_CONFIG.MIME_TYPES.VIDEO.includes(mime as any)) return 'VIDEO';
  }
  return null;
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

async function uploadSingleFile(
  pf: ParsedFile,
  orderMap: Map<string, { id: string; orderNumber: string; customerName: string; proofStatus: string }>,
  results: {
    success: number;
    failed: number;
    images: number;
    videos: number;
    ordersUpdated: number;
    files: { name: string; status: string; message: string; orderNumber: string | null }[];
  },
  uploadedOrders: Set<string>,
  updatedProofStatuses: Set<string>,
  sessionId: string,
) {
  if (pf.status !== 'ready' || !pf.fileBuffer || !pf.fileType || !pf.orderNumber) {
    results.failed++;
    results.files.push({
      name: pf.originalName,
      status: pf.status,
      message: pf.message,
      orderNumber: pf.orderNumber,
    });
    return;
  }

  try {
    const detectedMime = mimeFromBuffer(pf.fileBuffer);
    if (!detectedMime || !uploadSecurity.checkMagicBytes(pf.fileBuffer, detectedMime)) {
      results.failed++;
      results.files.push({
        name: pf.originalName,
        status: 'invalid_content',
        message: 'نوع الملف غير مدعوم',
        orderNumber: pf.orderNumber,
      });
      return;
    }

    const safeName = uploadSecurity.sanitizeFilename(pf.originalName);
    const ext = uploadSecurity.extname(safeName) || '.bin';
    const storageKey = `orders/${pf.orderNumber}/${crypto.randomUUID()}${ext}`;

    await uploadFile(pf.orderNumber, pf.fileType, pf.fileBuffer, storageKey.split('/').pop()!, detectedMime);

    try {
      await prisma.proofFile.create({
        data: {
          orderId: orderMap.get(pf.orderNumber)!.id,
          fileName: safeName,
          storageKey,
          type: pf.fileType,
          mimeType: detectedMime,
          size: pf.size!,
          uploadedById: sessionId,
        },
      });
    } catch (dbError) {
      try {
        const { deleteFile } = await import('@/lib/r2');
        await deleteFile(storageKey);
      } catch { }
      results.failed++;
      results.files.push({
        name: pf.originalName,
        status: 'error',
        message: 'تعذر رفع الملف، حاول مرة أخرى',
        orderNumber: pf.orderNumber,
      });
      return;
    }

    const orderId = orderMap.get(pf.orderNumber)!.id;

    if (!uploadedOrders.has(pf.orderNumber)) {
      uploadedOrders.add(pf.orderNumber);
      results.ordersUpdated++;
    }

    if (pf.fileType === 'IMAGE') {
      results.images++;
    } else {
      results.videos++;
    }
    results.success++;

    results.files.push({
      name: pf.originalName,
      status: 'uploaded',
      message: `تم رفع الملف بنجاح${pf.customerName ? ` - ${pf.customerName}` : ''}`,
      orderNumber: pf.orderNumber,
    });

    if (!updatedProofStatuses.has(pf.orderNumber)) {
      try {
        const currentOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: { files: true },
        });

        if (currentOrder && currentOrder.proofStatus !== 'CANCELLED') {
          const hasImages = currentOrder.files.some(f => f.type === 'IMAGE');
          const hasVideos = currentOrder.files.some(f => f.type === 'VIDEO');

          if (hasImages || hasVideos) {
            const newStatus = hasVideos ? 'MEDIA_UPLOADED' : 'READY';
            await prisma.order.update({
              where: { id: orderId },
              data: { proofStatus: newStatus },
            });
            updatedProofStatuses.add(pf.orderNumber);
          }
        }
      } catch { }
    }
  } catch (err) {
    results.failed++;
    results.files.push({
      name: pf.originalName,
      status: 'error',
      message: 'فشل في رفع الملف إلى التخزين',
      orderNumber: pf.orderNumber,
    });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'انتهت الجلسة، سجل الدخول مرة أخرى' },
      { status: 401 },
    );
  }

  if (!UPLOAD_CONFIG.ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json(
      { success: false, error: 'ليس لديك صلاحية لرفع الملفات' },
      { status: 403 },
    );
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'عدد محاولات الرفع كبير، حاول بعد قليل' },
      { status: 429 },
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: 'لم يتم إرسال ملفات' }, { status: 400 });
    }

    if (files.length > UPLOAD_CONFIG.LIMITS.BULK_MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `الحد الأقصى ${UPLOAD_CONFIG.LIMITS.BULK_MAX_FILES} ملف في المرة الواحدة` },
        { status: 400 },
      );
    }

    console.log('BULK_UPLOAD_REQUEST', { filesCount: files.length, userId: session.id });

    const parsedFiles: ParsedFile[] = [];
    const orderNumbers = new Set<string>();

    for (const file of files) {
      const safeName = uploadSecurity.sanitizeFilename(file.name);
      const ext = uploadSecurity.extname(safeName);

      if (!ext || !uploadSecurity.allowedExtensions().includes(ext)) {
        parsedFiles.push({
          originalName: file.name,
          orderNumber: null,
          status: 'unsupported_type',
          customerName: null,
          fileType: null,
          message: 'نوع ملف غير مدعوم',
        });
        continue;
      }

      const suspicious = ['.php', '.html', '.htm', '.exe', '.zip', '.js', '.svg']
        .filter(bad => file.name.toLowerCase().includes(bad));
      if (suspicious.length > 0 || !uploadSecurity.isMimeAllowed(file.type)) {
        parsedFiles.push({
          originalName: file.name,
          orderNumber: null,
          status: 'unsupported_type',
          customerName: null,
          fileType: null,
          message: 'نوع ملف غير مدعوم',
        });
        continue;
      }

      if (file.size > UPLOAD_CONFIG.LIMITS.VIDEO_MAX_BYTES) {
        parsedFiles.push({
          originalName: file.name,
          orderNumber: null,
          status: 'file_too_large',
          customerName: null,
          fileType: null,
          message: `حجم الملف كبير جداً (الحد الأقصى ${Math.round(UPLOAD_CONFIG.LIMITS.VIDEO_MAX_BYTES / 1024 / 1024)}MB)`,
        });
        continue;
      }

      const orderNumber = extractOrderNumber(file.name);
      console.log('BULK_PARSE', { fileName: file.name, orderNumber });
      if (!orderNumber) {
        parsedFiles.push({
          originalName: file.name,
          orderNumber: null,
          status: 'no_order_number',
          customerName: null,
          fileType: null,
          message: 'اسم الملف لا يحتوي على رقم طلب',
        });
        continue;
      }

      orderNumbers.add(orderNumber);
      const buffer = Buffer.from(await file.arrayBuffer());

      const detectedMime = mimeFromBuffer(buffer);
      if (!detectedMime || !getFileType(detectedMime)) {
        parsedFiles.push({
          originalName: file.name,
          orderNumber,
          status: 'unsupported_type',
          customerName: null,
          fileType: null,
          message: 'نوع الملف غير مدعوم',
        });
        continue;
      }

      parsedFiles.push({
        originalName: file.name,
        orderNumber,
        status: 'ready',
        customerName: null,
        fileType: getFileType(detectedMime),
        message: 'جاهز للرفع',
        fileBuffer: buffer,
        mimeType: detectedMime,
        size: file.size,
      });
    }

    const existingOrders = await prisma.order.findMany({
      where: { orderNumber: { in: Array.from(orderNumbers) } },
      select: { id: true, orderNumber: true, customerName: true, proofStatus: true },
    });

    const orderMap = new Map(existingOrders.map(o => [o.orderNumber, o]));

    for (const pf of parsedFiles) {
      if (pf.status !== 'ready') continue;
      const order = orderMap.get(pf.orderNumber!);
      if (!order) {
        pf.status = 'order_not_found';
        pf.message = 'لا يوجد طلب بهذا الرقم';
        pf.customerName = null;
        continue;
      }
      if (order.proofStatus === 'CANCELLED') {
        pf.status = 'order_not_found';
        pf.message = 'الطلب ملغي ولا يمكن رفع ملفات له';
        pf.customerName = order.customerName;
        continue;
      }
      pf.customerName = order.customerName;
    }

    const results = {
      success: 0,
      failed: 0,
      images: 0,
      videos: 0,
      ordersUpdated: 0,
      files: [] as { name: string; status: string; message: string; orderNumber: string | null }[],
    };

    const uploadedOrders = new Set<string>();
    const updatedProofStatuses = new Set<string>();

    const ready = parsedFiles.filter(pf => pf.status === 'ready' && pf.fileBuffer && pf.fileType && pf.orderNumber);
    const failedImmediate = parsedFiles.filter(pf => pf.status !== 'ready');

    for (const pf of failedImmediate) {
      results.failed++;
      results.files.push({ name: pf.originalName, status: pf.status, message: pf.message, orderNumber: pf.orderNumber });
    }

    for (let i = 0; i < ready.length; i += UPLOAD_CONFIG.LIMITS.CONCURRENT_UPLOADS) {
      const batch = ready.slice(i, i + UPLOAD_CONFIG.LIMITS.CONCURRENT_UPLOADS);
      await Promise.all(batch.map(pf =>
        uploadSingleFile(pf, orderMap, results, uploadedOrders, updatedProofStatuses, session.id)
      ));
    }

    console.log('BULK_UPLOAD_RESULT', {
      successCount: results.success,
      failedCount: results.failed,
      totalFiles: files.length,
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('BULK_UPLOAD_ERROR', {
      message: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ success: false, error: 'فشل الرفع الجماعي' }, { status: 500 });
  }
}
