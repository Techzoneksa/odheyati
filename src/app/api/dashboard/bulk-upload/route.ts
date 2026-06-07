import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, FileType } from '@/lib/r2';


interface ParsedFile {
  originalName: string;
  orderNumber: string | null;
  status: 'ready' | 'no_order_number' | 'order_not_found' | 'unsupported_type' | 'file_too_large';
  customerName: string | null;
  fileType: FileType | null;
  message: string;
  fileBuffer?: Buffer;
  mimeType?: string;
  size?: number;
}

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function extractOrderNumber(filename: string): string | null {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  const patterns = [
    /(\d{5,})/,
  ];
  
  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

function getFileType(ext: string): FileType | null {
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const videoExts = ['.mp4', '.mov', '.webm'];
  
  if (imageExts.includes(ext.toLowerCase())) return 'IMAGE';
  if (videoExts.includes(ext.toLowerCase())) return 'VIDEO';
  return null;
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 files allowed per batch' }, { status: 400 });
    }

    const parsedFiles: ParsedFile[] = [];
    const orderNumbers = new Set<string>();

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const fileType = getFileType(ext);
      
      if (!fileType) {
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

      if (file.size > MAX_FILE_SIZE) {
        parsedFiles.push({
          originalName: file.name,
          orderNumber: null,
          status: 'file_too_large',
          customerName: null,
          fileType: null,
          message: 'حجم الملف كبير جداً (الحد الأقصى 100MB)',
        });
        continue;
      }

      const orderNumber = extractOrderNumber(file.name);
      
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

      parsedFiles.push({
        originalName: file.name,
        orderNumber,
        status: 'ready',
        customerName: null,
        fileType,
        message: 'جاهز للرفع',
        fileBuffer: buffer,
        mimeType: getMimeType(ext),
        size: file.size,
      });
    }

    const existingOrders = await prisma.order.findMany({
      where: {
        orderNumber: { in: Array.from(orderNumbers) },
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        proofStatus: true,
      },
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

    for (const pf of parsedFiles) {
      if (pf.status !== 'ready' || !pf.fileBuffer || !pf.fileType || !pf.orderNumber) {
        results.failed++;
        results.files.push({
          name: pf.originalName,
          status: pf.status,
          message: pf.message,
          orderNumber: pf.orderNumber,
        });
        continue;
      }

      try {
        const fileName = `${Date.now()}-${pf.originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { storageKey } = await uploadFile(
          pf.orderNumber,
          pf.fileType,
          pf.fileBuffer,
          fileName,
          pf.mimeType!
        );

const fileRecord = await prisma.proofFile.create({
          data: {
            orderId: orderMap.get(pf.orderNumber)!.id,
            fileName: pf.originalName,
            storageKey,
            type: pf.fileType!,
            mimeType: pf.mimeType!,
            size: pf.size!,
          },
        });

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

    return NextResponse.json(results);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'خطأ غير معروف في الخادم';
    console.error('BULK_UPLOAD_API_ERROR', { msg });
    return NextResponse.json({ error: `فشل الرفع: ${msg}` }, { status: 500 });
  }
}