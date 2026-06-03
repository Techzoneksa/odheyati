import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

const proofStatusLabels: Record<string, string> = {
  PENDING: 'بانتظار التنفيذ',
  IN_PROGRESS: 'قيد التنفيذ',
  SLAUGHTERED: 'تم الذبح',
  MEDIA_UPLOADED: 'تم رفع الملفات',
  READY: 'التوثيق جاهز',
  SENT: 'تم الإرسال',
  VIEWED: 'تمت المشاهدة',
  CANCELLED: 'ملغي',
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let stage = 'START';
  let filteredOrders: any[] = [];
  let errorMessage = '';

  try {
    stage = 'PARSE_FILTERS';
    const { searchParams } = new URL(request.url);
    const proofStatus = searchParams.get('proofStatus') || '';
    const sallaStatus = searchParams.get('sallaStatus') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const includePrices = searchParams.get('includePrices') === 'true';
    const includeProofLinks = searchParams.get('includeProofLinks') !== 'false';
    const mediaFilter = searchParams.get('mediaFilter') || 'all';

    stage = 'BUILD_WHERE_CLAUSE';
    const whereClause: any = {};

    if (proofStatus && proofStatus !== 'all') {
      if (proofStatus === 'with_files') {
        whereClause.files = { some: { OR: [{ type: 'IMAGE' }, { type: 'VIDEO' }] } };
      } else if (proofStatus === 'without_files') {
        whereClause.files = { none: { OR: [{ type: 'IMAGE' }, { type: 'VIDEO' }] } };
      } else {
        whereClause.proofStatus = proofStatus;
      }
    }

    if (sallaStatus && sallaStatus !== 'all') {
      whereClause.sallaStatus = sallaStatus;
    }

    if (dateFrom) {
      const parsedDate = new Date(dateFrom);
      if (!isNaN(parsedDate.getTime())) {
        whereClause.createdAt = { ...whereClause.createdAt, gte: parsedDate };
      }
    }

    if (dateTo) {
      const parsedDate = new Date(dateTo);
      if (!isNaN(parsedDate.getTime())) {
        whereClause.createdAt = { ...whereClause.createdAt, lte: parsedDate };
      }
    }

    stage = 'QUERY_ORDERS';
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        files: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    filteredOrders = orders;

    stage = 'APPLY_MEDIA_FILTER';
    if (mediaFilter === 'with_files') {
      filteredOrders = filteredOrders.filter((o: any) => o.files.length > 0);
    } else if (mediaFilter === 'without_files') {
      filteredOrders = filteredOrders.filter((o: any) => o.files.length === 0);
    } else if (mediaFilter === 'with_videos') {
      filteredOrders = filteredOrders.filter((o: any) => o.files.some((f: any) => f.type === 'VIDEO'));
    } else if (mediaFilter === 'with_images') {
      filteredOrders = filteredOrders.filter((o: any) => o.files.some((f: any) => f.type === 'IMAGE'));
    }

    stage = 'CREATE_WORKBOOK';
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('ملخص التصدير');
    const dataSheet = workbook.addWorksheet('البيانات');

    stage = 'FILL_SUMMARY_SHEET';
    summarySheet.columns = [{ width: 25 }, { width: 40 }];

    summarySheet.addRow(['تقرير توثيقات أضحيتي']);
    summarySheet.addRow([]);

    const exportDate = new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const imagesCount = filteredOrders.filter((o: any) => o.files.some((f: any) => f.type === 'IMAGE')).length;
    const videosCount = filteredOrders.filter((o: any) => o.files.some((f: any) => f.type === 'VIDEO')).length;
    const readyCount = filteredOrders.filter(o => ['READY', 'MEDIA_UPLOADED', 'VIEWED'].includes(o.proofStatus)).length;
    const inProgressCount = filteredOrders.filter(o => ['PENDING', 'IN_PROGRESS'].includes(o.proofStatus)).length;

    summarySheet.addRow(['تاريخ التصدير', exportDate]);
    summarySheet.addRow(['عدد الطلبات في التقرير', filteredOrders.length]);
    summarySheet.addRow(['فلتر حالة التوثيق', proofStatus || 'الكل']);
    summarySheet.addRow(['فلتر حالة سلة', sallaStatus || 'كل']);
    summarySheet.addRow(['نطاق التاريخ', dateFrom && dateTo ? `${dateFrom} إلى ${dateTo}` : 'الكل']);
    summarySheet.addRow(['يشمل الأسعار', includePrices ? 'نعم' : 'لا']);
    summarySheet.addRow(['عدد الطلبات التي فيها ملفات', imagesCount + videosCount]);
    summarySheet.addRow(['عدد الطلبات بدون ملفات', filteredOrders.length - imagesCount - videosCount]);
    summarySheet.addRow(['عدد الطلبات الجاهزة', readyCount]);
    summarySheet.addRow(['عدد الطلبات قيد التنفيذ', inProgressCount]);

    stage = 'FILL_DATA_SHEET_HEADERS';
    const headers = [
      'رقم الطلب',
      'اسم العميل',
      'رقم الجوال',
      'حالة سلة',
      'حالة التوثيق',
      'تاريخ الطلب',
      'عدد الصور',
      'عدد الفيديوهات',
      'إجمالي الملفات',
    ];

    if (includeProofLinks) {
      headers.push('رابط المشاهدة');
    }

    if (includePrices) {
      headers.push('المبلغ');
    }

    dataSheet.addRow(headers);

    stage = 'FILL_DATA_SHEET_ROWS';
    for (const order of filteredOrders) {
      const images = order.files.filter((f: any) => f.type === 'IMAGE').length;
      const videos = order.files.filter((f: any) => f.type === 'VIDEO').length;
      const totalFiles = images + videos;
      const proofStatusText = proofStatusLabels[order.proofStatus] || order.proofStatus;

      const rowData = [
        order.orderNumber,
        order.customerName,
        order.customerMobile,
        order.sallaStatus || '-',
        proofStatusText,
        new Date(order.createdAt).toLocaleDateString('ar-SA'),
        images,
        videos,
        totalFiles,
      ];

      if (includeProofLinks) {
        rowData.push(`https://almotamed.com/proof/${order.proofToken}`);
      }

      if (includePrices) {
        const totalAmount = order.items.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
        rowData.push(totalAmount > 0 ? totalAmount.toFixed(2) : '-');
      }

      dataSheet.addRow(rowData);
    }

    stage = 'WRITE_BUFFER';
    const buffer = await workbook.xlsx.writeBuffer();

    stage = 'BUILD_RESPONSE';
    const fileName = `odheyati-proof-export-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);

    let reason = 'UNKNOWN_EXPORT_ERROR';

    if (error instanceof Error) {
      if (error.message.includes('prisma') || error.message.includes('Prisma') || error.message.includes('database')) {
        reason = 'PRISMA_QUERY_FAILED';
      } else if (error.message.includes('ExcelJS') || error.message.includes('exceljs') || error.message.includes('workbook')) {
        reason = 'EXCELJS_WORKBOOK_FAILED';
      } else if (error.message.includes('writeBuffer')) {
        reason = 'EXCELJS_WRITE_FAILED';
      } else if (error.message.includes('buffer')) {
        reason = 'BUFFER_CONVERSION_FAILED';
      } else if (error.message.includes('Invalid') || error.message.includes('invalid') || error.message.includes('Date')) {
        reason = 'INVALID_DATE';
      } else if (error.message.includes('parse') || error.message.includes('Parse')) {
        reason = 'INVALID_FILTER';
      }
    }

    if (stage !== 'START' && reason === 'UNKNOWN_EXPORT_ERROR') {
      reason = `${stage}_FAILED`;
    }

    console.error('EXPORT_FAILED', {
      reason,
      stage,
      message: errorMessage,
    });

    return NextResponse.json({
      error: 'EXPORT_FAILED',
      reason,
      debugMessage: errorMessage.substring(0, 100),
    }, { status: 500 });
  }
}