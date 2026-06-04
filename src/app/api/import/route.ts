import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

interface RowResult {
  row: number;
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  status: 'added' | 'updated' | 'skipped' | 'failed' | 'warning';
  message: string;
}

interface ImportReport {
  summary: {
    added: number;
    updated: number;
    skipped: number;
    failed: number;
    warnings: number;
  };
  rows: RowResult[];
}

function normalizeMobile(mobile: string): { countryCode: string; localNumber: string; fullNumber: string } {
  let cleaned = mobile.replace(/[\s\-()+\[\]]/g, '');

  const countryCodes: Record<string, string> = {
    '966': '966',
    '971': '971',
    '965': '965',
    '974': '974',
    '973': '973',
    '968': '968',
  };

  let countryCode = '966';
  let localNumber = cleaned;

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  for (const [code] of Object.entries(countryCodes)) {
    if (cleaned.startsWith(code)) {
      countryCode = code;
      localNumber = cleaned.substring(code.length);
      break;
    }
  }

  if (localNumber.startsWith('0')) {
    localNumber = localNumber.substring(1);
  }

  return {
    countryCode,
    localNumber,
    fullNumber: countryCode + localNumber,
  };
}

function mapSallaStatusToProofStatus(sallaStatus: string, hasExistingFiles: boolean): string {
  const status = sallaStatus.toLowerCase();

  if (status.includes('تم التنفيذ') || status.includes('slaughtered')) {
    return 'SLAUGHTERED';
  }
  if (status.includes('بانتظار') || status.includes('مراجعة') || status.includes('pending')) {
    return 'IN_PROGRESS';
  }

  if (hasExistingFiles) {
    return '';
  }

  return 'PENDING';
}

function mapShopifyFinancialStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('paid')) return 'paid';
  if (s.includes('pending')) return 'pending';
  if (s.includes('refunded')) return 'refunded';
  if (s.includes('cancelled')) return 'cancelled';
  return s;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const platform = formData.get('platform') as string || 'SALLA';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    const headers = jsonData[0].map(h => h.toString().trim());

    const report: ImportReport = {
      summary: { added: 0, updated: 0, skipped: 0, failed: 0, warnings: 0 },
      rows: [],
    };

    if (platform === 'SALLA') {
      const orderCol = headers.findIndex(h => h.includes('رقم الطلب') || h.includes('order'));
      const statusCol = headers.findIndex(h => h.includes('حالة') || h.includes('status'));
      const nameCol = headers.findIndex(h => h.includes('اسم') || h.includes('name'));
      const mobileCol = headers.findIndex(h => h.includes('جوال') || h.includes('mobile') || h.includes('phone'));
      const amountCol = headers.findIndex(h => h.includes('مبلغ') || h.includes('amount'));

      if (orderCol === -1 || nameCol === -1 || mobileCol === -1) {
        return NextResponse.json({ error: 'Missing required columns' }, { status: 400 });
      }

      const existingMobiles = new Set<string>();

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 1;
        const orderNumber = String(row[orderCol] || '').trim();
        const customerName = String(row[nameCol] || '').trim();
        const customerMobile = String(row[mobileCol] || '').trim();
        const sallaStatus = statusCol !== -1 ? String(row[statusCol] || '').trim() : '';
        const amount = amountCol !== -1 ? String(row[amountCol] || '').trim() : '';

        if (!orderNumber) {
          report.rows.push({
            row: rowNum,
            orderNumber: '-',
            customerName: customerName || '-',
            customerMobile: customerMobile || '-',
            status: 'skipped',
            message: 'رقم الطلب فارغ',
          });
          report.summary.skipped++;
          continue;
        }

        if (!customerName) {
          report.rows.push({
            row: rowNum,
            orderNumber,
            customerName: '-',
            customerMobile: customerMobile || '-',
            status: 'failed',
            message: 'اسم العميل فارغ',
          });
          report.summary.failed++;
          continue;
        }

        if (!customerMobile || customerMobile.length < 7) {
          report.rows.push({
            row: rowNum,
            orderNumber,
            customerName,
            customerMobile: customerMobile || '-',
            status: 'failed',
            message: 'رقم الجوال غير صالح',
          });
          report.summary.failed++;
          continue;
        }

        const { fullNumber, countryCode } = normalizeMobile(customerMobile);
        const mobileLast4 = fullNumber.slice(-4);
        const parsedAmount = parseFloat(amount.replace(/[^\d.]/g, '')) || null;

        const existingOrder = await prisma.order.findUnique({
          where: { orderNumber },
          include: { items: true, files: true },
        });

        if (existingOrder) {
          const hasExistingFiles = existingOrder.files.length > 0;
          const newProofStatus = mapSallaStatusToProofStatus(sallaStatus, hasExistingFiles);

          const updateData: any = {
            customerName,
            customerMobile: fullNumber,
            customerMobileLast4: mobileLast4,
            sallaStatus: sallaStatus || existingOrder.sallaStatus,
          };

          if (newProofStatus && newProofStatus !== existingOrder.proofStatus) {
            updateData.proofStatus = newProofStatus;
          }

          await prisma.order.update({
            where: { orderNumber },
            data: updateData,
          });

          if (parsedAmount && existingOrder.items.length === 0) {
            await prisma.orderItem.create({
              data: {
                orderId: existingOrder.id,
                productName: 'طلب مستورد من سلة',
                quantity: 1,
                price: parsedAmount,
              },
            });
          }

          report.rows.push({
            row: rowNum,
            orderNumber,
            customerName,
            customerMobile: fullNumber,
            status: 'updated',
            message: hasExistingFiles ? 'تم التحديث (ملفات التوثيق محفوظة)' : 'تم التحديث',
          });
          report.summary.updated++;

          if (existingMobiles.has(fullNumber)) {
            report.rows.push({
              row: rowNum,
              orderNumber,
              customerName,
              customerMobile: fullNumber,
              status: 'warning',
              message: 'يوجد طلب سابق بنفس رقم الجوال',
            });
            report.summary.warnings++;
          }
          existingMobiles.add(fullNumber);
        } else {
          const hasOtherOrdersWithMobile = await prisma.order.findFirst({
            where: { customerMobile: fullNumber },
          });

          const newOrder = await prisma.order.create({
            data: {
              orderNumber,
              customerName,
              customerMobile: fullNumber,
              customerMobileLast4: mobileLast4,
              customerEmail: null,
              sallaStatus,
              proofStatus: mapSallaStatusToProofStatus(sallaStatus, false) as any || 'PENDING',
              proofToken: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
            },
          });

          if (parsedAmount) {
            await prisma.orderItem.create({
              data: {
                orderId: newOrder.id,
                productName: 'طلب مستورد من سلة',
                quantity: 1,
                price: parsedAmount,
              },
            });
          }

          report.rows.push({
            row: rowNum,
            orderNumber,
            customerName,
            customerMobile: fullNumber,
            status: 'added',
            message: 'تم إضافته كطلب جديد',
          });
          report.summary.added++;

          if (hasOtherOrdersWithMobile) {
            report.rows.push({
              row: rowNum,
              orderNumber,
              customerName,
              customerMobile: fullNumber,
              status: 'warning',
              message: 'يوجد طلب سابق لنفس رقم الجوال',
            });
            report.summary.warnings++;
          }
          existingMobiles.add(fullNumber);
        }
      }
    } else if (platform === 'SHOPIFY') {
      const nameCol = headers.findIndex(h => h.includes('Name') || h.includes('#'));
      const emailCol = headers.findIndex(h => h.includes('Email') || h.includes('email'));
      const billingNameCol = headers.findIndex(h => h.includes('Billing Name') || h.includes('billing'));
      const billingPhoneCol = headers.findIndex(h => h.includes('Billing Phone') || h.includes('phone'));
      const financialStatusCol = headers.findIndex(h => h.includes('Financial Status') || h.includes('financial'));
      const paidAtCol = headers.findIndex(h => h.includes('Paid at') || h.includes('paid'));
      const subtotalCol = headers.findIndex(h => h.includes('Subtotal') || h.includes('subtotal'));

      if (nameCol === -1) {
        return NextResponse.json({ error: 'Missing order number column (Name)' }, { status: 400 });
      }

      const existingOrderNumbers = new Set<string>();

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 1;

        const orderNumber = String(row[nameCol] || '').trim();
        const customerEmail = emailCol !== -1 ? String(row[emailCol] || '').trim() : '';
        const billingName = billingNameCol !== -1 ? String(row[billingNameCol] || '').trim() : '';
        const billingPhone = billingPhoneCol !== -1 ? String(row[billingPhoneCol] || '').trim() : '';
        const financialStatus = financialStatusCol !== -1 ? String(row[financialStatusCol] || '').trim() : '';
        const subtotal = subtotalCol !== -1 ? String(row[subtotalCol] || '').trim() : '';

        if (!orderNumber) {
          report.rows.push({
            row: rowNum,
            orderNumber: '-',
            customerName: billingName || '-',
            customerMobile: billingPhone || '-',
            status: 'skipped',
            message: 'رقم الطلب فارغ',
          });
          report.summary.skipped++;
          continue;
        }

        if (!billingName && !customerEmail) {
          report.rows.push({
            row: rowNum,
            orderNumber,
            customerName: '-',
            customerMobile: billingPhone || '-',
            status: 'failed',
            message: 'اسم العميل والإيميل فارغان',
          });
          report.summary.failed++;
          continue;
        }

        let fullNumber = billingPhone;
        let mobileLast4 = '';

        if (billingPhone && billingPhone.length >= 7) {
          const { fullNumber: normalized } = normalizeMobile(billingPhone);
          fullNumber = normalized;
          mobileLast4 = fullNumber.slice(-4);
        }

        const parsedAmount = parseFloat(subtotal.replace(/[^\d.]/g, '')) || null;
        const shopifyStatus = mapShopifyFinancialStatus(financialStatus);

        const existingOrder = await prisma.order.findUnique({
          where: { orderNumber },
          include: { items: true, files: true },
        });

        if (existingOrder) {
          const hasExistingFiles = existingOrder.files.length > 0;

          const updateData: any = {
            customerName: billingName || existingOrder.customerName,
            customerEmail: customerEmail || existingOrder.customerEmail,
            sallaStatus: shopifyStatus,
          };

          if (fullNumber && fullNumber !== existingOrder.customerMobile) {
            updateData.customerMobile = fullNumber;
            updateData.customerMobileLast4 = mobileLast4;
          }

          await prisma.order.update({
            where: { orderNumber },
            data: updateData,
          });

          if (parsedAmount && existingOrder.items.length === 0) {
            await prisma.orderItem.create({
              data: {
                orderId: existingOrder.id,
                productName: 'طلب Shopify',
                quantity: 1,
                price: parsedAmount,
              },
            });
          }

          report.rows.push({
            row: rowNum,
            orderNumber,
            customerName: billingName || existingOrder.customerName,
            customerMobile: fullNumber || existingOrder.customerMobile,
            status: 'updated',
            message: hasExistingFiles ? 'تم التحديث (ملفات التوثيق محفوظة)' : 'تم التحديث',
          });
          report.summary.updated++;

          if (existingOrderNumbers.has(orderNumber)) {
            report.rows.push({
              row: rowNum,
              orderNumber,
              customerName: billingName,
              customerMobile: fullNumber,
              status: 'warning',
              message: 'يوجد طلب مكرر بنفس الرقم في الملف',
            });
            report.summary.warnings++;
          }
          existingOrderNumbers.add(orderNumber);
        } else {
          const newOrder = await prisma.order.create({
            data: {
              orderNumber,
              customerName: billingName || 'عميل Shopify',
              customerMobile: fullNumber || '0000000000',
              customerMobileLast4: mobileLast4 || '0000',
              customerEmail: customerEmail || null,
              sallaStatus: shopifyStatus,
              proofStatus: shopifyStatus === 'paid' ? 'PENDING' : 'PENDING',
              proofToken: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
            },
          });

          if (parsedAmount) {
            await prisma.orderItem.create({
              data: {
                orderId: newOrder.id,
                productName: 'طلب Shopify',
                quantity: 1,
                price: parsedAmount,
              },
            });
          }

          report.rows.push({
            row: rowNum,
            orderNumber,
            customerName: billingName || 'عميل Shopify',
            customerMobile: fullNumber || '0000000000',
            status: 'added',
            message: 'تم إضافته كطلب جديد',
          });
          report.summary.added++;

          if (existingOrderNumbers.has(orderNumber)) {
            report.rows.push({
              row: rowNum,
              orderNumber,
              customerName: billingName,
              customerMobile: fullNumber,
              status: 'warning',
              message: 'يوجد طلب مكرر بنفس الرقم في الملف',
            });
            report.summary.warnings++;
          }
          existingOrderNumbers.add(orderNumber);
        }
      }
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}