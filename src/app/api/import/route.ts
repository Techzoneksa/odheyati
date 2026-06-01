import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

interface OrderRow {
  orderNumber: string;
  sallaStatus: string;
  customerName: string;
  customerMobile: string;
  amount: string;
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

function mapSallaStatusToProofStatus(sallaStatus: string): string {
  const status = sallaStatus.toLowerCase();
  if (status.includes('تم التنفيذ') || status.includes('slaughtered')) {
    return 'SLAUGHTERED';
  }
  if (status.includes('بانتظار') || status.includes('مراجعة') || status.includes('pending')) {
    return 'IN_PROGRESS';
  }
  return 'PENDING';
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    const headers = jsonData[0].map(h => h.toString().trim());
    
    const orderCol = headers.findIndex(h => h.includes('رقم الطلب') || h.includes('order'));
    const statusCol = headers.findIndex(h => h.includes('حالة') || h.includes('status'));
    const nameCol = headers.findIndex(h => h.includes('اسم') || h.includes('name'));
    const mobileCol = headers.findIndex(h => h.includes('جوال') || h.includes('mobile') || h.includes('phone'));
    const amountCol = headers.findIndex(h => h.includes('مبلغ') || h.includes('amount'));

    if (orderCol === -1 || nameCol === -1 || mobileCol === -1) {
      return NextResponse.json({ error: 'Missing required columns' }, { status: 400 });
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const orderNumber = String(row[orderCol] || '').trim();
      const customerName = String(row[nameCol] || '').trim();
      const customerMobile = String(row[mobileCol] || '').trim();
      const sallaStatus = statusCol !== -1 ? String(row[statusCol] || '').trim() : '';
      const amount = amountCol !== -1 ? String(row[amountCol] || '').trim() : '';

      if (!orderNumber) {
        errors.push(`صف ${i + 1}: رقم الطلب ناقص`);
        skipped++;
        continue;
      }

      if (!customerName) {
        errors.push(`صف ${i + 1}: اسم العميل ناقص`);
        skipped++;
        continue;
      }

      if (!customerMobile || customerMobile.length < 7) {
        errors.push(`صف ${i + 1}: رقم الجوال غير صالح`);
        skipped++;
        continue;
      }

      const { fullNumber, countryCode } = normalizeMobile(customerMobile);
      const mobileLast4 = fullNumber.slice(-4);
      const proofStatus = mapSallaStatusToProofStatus(sallaStatus);
      const parsedAmount = parseFloat(amount.replace(/[^\d.]/g, '')) || null;

      try {
        const existingOrder = await prisma.order.findUnique({
          where: { orderNumber },
          include: { items: true },
        });

        if (existingOrder) {
          await prisma.order.update({
            where: { orderNumber },
            data: {
              customerName,
              customerMobile: fullNumber,
              customerMobileLast4: mobileLast4,
              sallaStatus: sallaStatus || existingOrder.sallaStatus,
              proofStatus: proofStatus as any,
            },
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

          updated++;
        } else {
          const newOrder = await prisma.order.create({
            data: {
              orderNumber,
              customerName,
              customerMobile: fullNumber,
              customerMobileLast4: mobileLast4,
              customerEmail: null,
              sallaStatus,
              proofStatus: proofStatus as any,
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

          added++;
        }
      } catch (err) {
        errors.push(`صف ${i + 1}: خطأ في المعالجة`);
        skipped++;
      }
    }

    return NextResponse.json({ added, updated, skipped, errors });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}