import { prisma } from '@/lib/prisma';
import { mapZidOrder, type ZidOrderPayload } from './mapper';
import { upsertZidOrder } from './orders';

type RowStatus = 'added' | 'updated' | 'skipped' | 'failed' | 'warning';

export interface ZidImportReport {
  summary: { added: number; updated: number; skipped: number; failed: number; warnings: number };
  rows: Array<{
    row: number;
    orderNumber: string;
    customerName: string;
    customerMobile: string;
    status: RowStatus;
    message: string;
  }>;
}

interface ZidExcelOrder {
  rowNumber: number;
  zidOrderId: string;
  // Orders that were moved from Salla into Zid carry the original Salla
  // order number in customer_note ("رقم الطلب: 262190392,...").
  sallaOrderNumber: string | null;
  payload: ZidOrderPayload;
}

// Zid exports Arabic status labels; store the same codes the API returns.
const STATUS_CODES: Record<string, string> = {
  'جديد': 'new',
  'تجهيز': 'preparing',
  'جاري التجهيز': 'preparing',
  'جاهز': 'ready',
  'جاري التوصيل': 'inDelivery',
  'تم التوصيل': 'delivered',
  'ملغي': 'cancelled',
  'تم الإلغاء': 'cancelled',
};

const REQUIRED_HEADERS = ['id', 'customer_name', 'customer_mobile'];

export function isZidExport(headers: string[]): boolean {
  return REQUIRED_HEADERS.every((h) => headers.includes(h));
}

function cell(row: unknown[], index: number): string {
  if (index === -1) return '';
  const value = row[index];
  return value === null || value === undefined ? '' : String(value).trim();
}

// One Zid order can span several rows (one per product); order-level columns
// are only filled on its first row.
export function parseZidExport(sheetRows: unknown[][]): ZidExcelOrder[] {
  const headers = (sheetRows[0] || []).map((h) => String(h ?? '').trim());
  const col = (name: string) => headers.indexOf(name);
  const c = {
    id: col('id'),
    status: col('order_status'),
    note: col('customer_note'),
    name: col('customer_name'),
    email: col('customer_email'),
    mobile: col('customer_mobile'),
    product: col('product name'),
    sku: col('sku'),
    quantity: col('quantity'),
    unitPrice: col('unit_price'),
  };

  const orders = new Map<string, ZidExcelOrder>();

  for (let i = 1; i < sheetRows.length; i++) {
    const row = sheetRows[i] || [];
    const id = cell(row, c.id);
    if (!id) continue;

    let order = orders.get(id);
    if (!order) {
      const status = cell(row, c.status);
      const sallaMatch = cell(row, c.note).match(/رقم الطلب:\s*(\d+)/);
      order = {
        rowNumber: i + 1,
        zidOrderId: id,
        sallaOrderNumber: sallaMatch ? sallaMatch[1] : null,
        payload: {
          id,
          order_status: STATUS_CODES[status] || status || null,
          customer: {
            name: cell(row, c.name) || null,
            email: cell(row, c.email) || null,
            mobile: cell(row, c.mobile) || null,
          },
          products: [],
        },
      };
      orders.set(id, order);
    }

    const productName = cell(row, c.product);
    if (productName) {
      order.payload.products!.push({
        name: productName,
        sku: cell(row, c.sku) || null,
        quantity: cell(row, c.quantity) || null,
        price: cell(row, c.unitPrice) || null,
      });
    }
  }

  return Array.from(orders.values());
}

export async function importZidExport(sheetRows: unknown[][]): Promise<ZidImportReport> {
  const report: ZidImportReport = {
    summary: { added: 0, updated: 0, skipped: 0, failed: 0, warnings: 0 },
    rows: [],
  };
  const orders = parseZidExport(sheetRows);

  // 1. Orders moved from Salla: never import them again, only record their
  //    Zid number on the existing Salla order so webhooks can match them later.
  const moved = orders.filter((o) => o.sallaOrderNumber);
  const existing = await prisma.order.findMany({
    where: { orderNumber: { in: moved.map((o) => o.sallaOrderNumber!) } },
    select: { id: true, orderNumber: true, zidOrderId: true },
  });
  const byNumber = new Map(existing.map((o) => [o.orderNumber, o]));
  const taken = await prisma.order.findMany({
    where: { zidOrderId: { in: orders.map((o) => o.zidOrderId) } },
    select: { id: true, zidOrderId: true },
  });
  const zidOwner = new Map(taken.map((o) => [o.zidOrderId!, o.id]));

  const link = { ids: [] as string[], zidIds: [] as string[], statuses: [] as string[] };
  for (const order of moved) {
    const salla = byNumber.get(order.sallaOrderNumber!);
    const name = order.payload.customer?.name || '-';
    const mobile = order.payload.customer?.mobile || '-';

    if (!salla) {
      report.summary.skipped++;
      report.rows.push({
        row: order.rowNumber, orderNumber: order.sallaOrderNumber!, customerName: name, customerMobile: mobile,
        status: 'skipped', message: `طلب منقول من سلة غير موجود في النظام (رقمه في زد ${order.zidOrderId}) — لم يُستورد`,
      });
    } else if (salla.zidOrderId === order.zidOrderId) {
      report.summary.skipped++;
    } else if (salla.zidOrderId || zidOwner.has(order.zidOrderId)) {
      report.summary.warnings++;
      report.rows.push({
        row: order.rowNumber, orderNumber: order.sallaOrderNumber!, customerName: name, customerMobile: mobile,
        status: 'warning', message: `رقم زد ${order.zidOrderId} لا يطابق الربط الموجود — لم يُغيَّر شيء`,
      });
    } else {
      link.ids.push(salla.id);
      link.zidIds.push(order.zidOrderId);
      link.statuses.push(String(order.payload.order_status ?? ''));
    }
  }

  if (link.ids.length > 0) {
    // Single statement instead of thousands of updates; only fills the two
    // Zid columns and only where they are still empty.
    const linked = await prisma.$executeRaw`
      UPDATE "orders" AS o
      SET "zidOrderId" = v.zid, "zidStatus" = NULLIF(v.status, ''), "updatedAt" = NOW()
      FROM unnest(${link.ids}::text[], ${link.zidIds}::text[], ${link.statuses}::text[]) AS v(id, zid, status)
      WHERE o."id" = v.id AND o."zidOrderId" IS NULL`;
    report.summary.updated += linked;
    report.rows.unshift({
      row: 0, orderNumber: '-', customerName: '-', customerMobile: '-',
      status: 'updated', message: `تم ربط ${linked} طلباً منقولاً من سلة برقمها في زد، بدون تغيير بياناتها أو توثيقاتها`,
    });
  }

  // 2. Orders placed on the Zid store: create or update them like the webhook does.
  for (const order of orders.filter((o) => !o.sallaOrderNumber)) {
    const mapped = mapZidOrder(order.payload);
    const base = {
      row: order.rowNumber,
      orderNumber: mapped.orderNumber,
      customerName: mapped.customerName || '-',
      customerMobile: mapped.customerMobile || '-',
    };

    try {
      const result = await upsertZidOrder(mapped);
      if (result.status === 'conflict') {
        report.summary.failed++;
        report.rows.push({ ...base, status: 'failed', message: 'رقم الطلب مستخدم لطلب سلة قديم — لم يُستورد حتى لا يُكتب فوقه' });
        continue;
      }

      report.summary[result.status === 'created' ? 'added' : 'updated']++;
      report.rows.push({ ...base, status: result.status === 'created' ? 'added' : 'updated', message: result.status === 'created' ? 'طلب زد جديد' : 'تم التحديث' });

      if (!mapped.customerMobile && !mapped.customerEmail) {
        report.summary.warnings++;
        report.rows.push({ ...base, status: 'warning', message: 'بدون جوال أو إيميل — لن يجده العميل بالبحث، أرسل له رابط التوثيق مباشرة' });
      }
    } catch (error) {
      report.summary.failed++;
      report.rows.push({ ...base, status: 'failed', message: error instanceof Error ? error.message : 'خطأ غير معروف' });
    }
  }

  return report;
}
