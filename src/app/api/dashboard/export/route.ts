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

  try {
    const { searchParams } = new URL(request.url);
    const proofStatus = searchParams.get('proofStatus') || '';
    const sallaStatus = searchParams.get('sallaStatus') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const includePrices = searchParams.get('includePrices') === 'true';
    const includeProofLinks = searchParams.get('includeProofLinks') !== 'false';
    const mediaFilter = searchParams.get('mediaFilter') || 'all';

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

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        files: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let filteredOrders = orders;

    if (mediaFilter === 'with_files') {
      filteredOrders = filteredOrders.filter(o => o.files.length > 0);
    } else if (mediaFilter === 'without_files') {
      filteredOrders = filteredOrders.filter(o => o.files.length === 0);
    } else if (mediaFilter === 'with_videos') {
      filteredOrders = filteredOrders.filter(o => o.files.some(f => f.type === 'VIDEO'));
    } else if (mediaFilter === 'with_images') {
      filteredOrders = filteredOrders.filter(o => o.files.some(f => f.type === 'IMAGE'));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'أضحيتي';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('ملخص التصدير');
    const dataSheet = workbook.addWorksheet('البيانات');

    summarySheet.columns = [{ width: 25 }, { width: 40 }];

    summarySheet.addRow(['تقرير توثيقات أضحيتي']).font = { bold: true, size: 16, color: { argb: 'FF973131' } };
    summarySheet.addRow([]);

    const exportDate = new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const imagesCount = filteredOrders.filter(o => o.files.some(f => f.type === 'IMAGE')).length;
    const videosCount = filteredOrders.filter(o => o.files.some(f => f.type === 'VIDEO')).length;
    const readyCount = filteredOrders.filter(o => ['READY', 'MEDIA_UPLOADED', 'VIEWED'].includes(o.proofStatus)).length;
    const inProgressCount = filteredOrders.filter(o => ['PENDING', 'IN_PROGRESS'].includes(o.proofStatus)).length;

    summarySheet.addRow(['تاريخ التصدير', exportDate]);
    summarySheet.addRow(['عدد الطلبات في التقرير', filteredOrders.length]);
    summarySheet.addRow(['فلتر حالة التوثيق', proofStatus || 'الكل']);
    summarySheet.addRow(['فلتر حالة سلة', sallaStatus || 'الكل']);
    summarySheet.addRow(['نطاق التاريخ', dateFrom && dateTo ? `${dateFrom} إلى ${dateTo}` : 'الكل']);
    summarySheet.addRow(['يشمل الأسعار', includePrices ? 'نعم' : 'لا']);
    summarySheet.addRow(['عدد الطلبات التي فيها ملفات', imagesCount + videosCount]);
    summarySheet.addRow(['عدد الطلبات بدون ملفات', filteredOrders.length - imagesCount - videosCount]);
    summarySheet.addRow(['عدد الطلبات الجاهزة', readyCount]);
    summarySheet.addRow(['عدد الطلبات قيد التنفيذ', inProgressCount]);

    summarySheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF973131' } };

    for (let i = 1; i <= 10; i++) {
      summarySheet.getRow(i).border = { bottom: { style: 'thin', color: { argb: 'FFE8D3C4' } } };
    }

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
      headers.push('مشاهدة التوثيق');
    }

    if (includePrices) {
      headers.push('المبلغ');
    }

    dataSheet.addRow(headers);

    dataSheet.getRow(1).font = { bold: true, size: 12 };
    dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8F1' } };
    dataSheet.getRow(1).border = { bottom: { style: 'medium', color: { argb: 'FF973131' } } };
    dataSheet.getRow(1).alignment = { horizontal: 'right', vertical: 'middle' };

    dataSheet.columns = [
      { width: 15 },
      { width: 20 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ];

    if (includeProofLinks) {
      dataSheet.columns.push({ width: 15 });
    }
    if (includePrices) {
      dataSheet.columns.push({ width: 12 });
    }

    dataSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    for (const order of filteredOrders) {
      const images = order.files.filter(f => f.type === 'IMAGE').length;
      const videos = order.files.filter(f => f.type === 'VIDEO').length;
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
        rowData.push('مشاهدة');
      }

      if (includePrices) {
        const totalAmount = order.items.reduce((sum, item) => sum + (item.price || 0), 0);
        rowData.push(totalAmount > 0 ? totalAmount.toFixed(2) : '-');
      }

      const row = dataSheet.addRow(rowData);

      if (includeProofLinks) {
        const linkCell = row.getCell(rowData.length);
        linkCell.value = {
          text: 'مشاهدة',
          hyperlink: `https://almotamed.com/proof/${order.proofToken}`,
        };
        linkCell.font = { color: { argb: 'FF973131' }, underline: 'single' };
      }
    }

    dataSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.border = { top: { style: 'thin', color: { argb: 'FFE8D3C4' } }, bottom: { style: 'thin', color: { argb: 'FFE8D3C4' } } };
        row.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });

    const bufferResult = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(bufferResult) ? bufferResult : Buffer.from(bufferResult as any);

    const fileName = `odheyati-proof-export-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('EXPORT_FAILED:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'EXPORT_FAILED' }, { status: 500 });
  }
}