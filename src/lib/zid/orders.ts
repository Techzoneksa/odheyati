import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fetchZidOrder, tokensFromConnection } from './api';
import { extractZidOrder, mapZidOrder, type ZidMappedOrder } from './mapper';

export type ZidUpsertResult =
  | { status: 'created' | 'updated'; orderId: string }
  | { status: 'conflict'; orderNumber: string };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Creates or updates a Zid order keyed by zidOrderId. It never touches an
// existing Salla order that happens to share the same order number, never
// changes proofStatus/proofToken, and only writes items when there are none.
export async function upsertZidOrder(mapped: ZidMappedOrder): Promise<ZidUpsertResult> {
  // Two deliveries for the same new order can race; the unique indexes reject
  // the second insert and the retry then takes the update path.
  for (let attempt = 0; ; attempt++) {
    try {
      const existing = await prisma.order.findUnique({
        where: { zidOrderId: mapped.zidOrderId },
        select: { id: true, _count: { select: { items: true } } },
      });

      if (existing) {
        await prisma.order.update({
          where: { id: existing.id },
          data: {
            zidStatus: mapped.zidStatus,
            ...(mapped.customerName ? { customerName: mapped.customerName } : {}),
            ...(mapped.customerMobile
              ? { customerMobile: mapped.customerMobile, customerMobileLast4: mapped.customerMobileLast4! }
              : {}),
            ...(mapped.customerEmail ? { customerEmail: mapped.customerEmail } : {}),
            ...(existing._count.items === 0 && mapped.items.length > 0
              ? { items: { create: mapped.items } }
              : {}),
          },
        });
        return { status: 'updated', orderId: existing.id };
      }

      const sameNumber = await prisma.order.findUnique({
        where: { orderNumber: mapped.orderNumber },
        select: { id: true },
      });
      if (sameNumber) {
        return { status: 'conflict', orderNumber: mapped.orderNumber };
      }

      const order = await prisma.order.create({
        data: {
          zidOrderId: mapped.zidOrderId,
          orderNumber: mapped.orderNumber,
          // Same fallbacks the Salla webhook uses when data is missing.
          customerName: mapped.customerName || 'عميل',
          customerMobile: mapped.customerMobile || '',
          customerMobileLast4: mapped.customerMobileLast4 || '0000',
          customerEmail: mapped.customerEmail,
          zidStatus: mapped.zidStatus,
          items: mapped.items.length > 0 ? { create: mapped.items } : undefined,
        },
        select: { id: true },
      });
      return { status: 'created', orderId: order.id };
    } catch (error) {
      if (attempt === 0 && isUniqueViolation(error)) continue;
      throw error;
    }
  }
}

export type ZidWebhookOutcome =
  | { ok: true; detail: string }
  // retry: true means a transient failure; the caller should answer with a
  // 5xx so Zid redelivers.
  | { ok: false; retry: boolean; detail: string };

export async function processZidWebhookLog(logId: string): Promise<ZidWebhookOutcome> {
  const log = await prisma.webhookLog.findUnique({ where: { id: logId } });
  if (!log) return { ok: false, retry: false, detail: 'Log not found' };
  if (log.processed) return { ok: true, detail: 'Already processed' };

  const finish = async (processed: boolean, error: string | null) => {
    await prisma.webhookLog.update({
      where: { id: logId },
      data: { processed, error: error?.slice(0, 1000) ?? null },
    });
  };

  const payloadOrder = extractZidOrder(log.payload);
  if (!payloadOrder) {
    await finish(false, 'Payload has no order id');
    return { ok: false, retry: false, detail: 'Payload has no order id' };
  }

  const zidOrderId = String(payloadOrder.id);
  const storeId = payloadOrder.store_id != null ? String(payloadOrder.store_id) : null;

  try {
    const connection = storeId
      ? await prisma.zidConnection.findUnique({ where: { storeId } })
      : await prisma.zidConnection.findFirst({ orderBy: { updatedAt: 'desc' } });

    if (!connection) {
      const detail = `No Zid connection for store ${storeId ?? 'unknown'}`;
      await finish(false, detail);
      return { ok: false, retry: false, detail };
    }

    const order = await fetchZidOrder(tokensFromConnection(connection), zidOrderId);
    if (!order) {
      const detail = `Order ${zidOrderId} not found in Zid API`;
      await finish(false, detail);
      return { ok: false, retry: false, detail };
    }

    const result = await upsertZidOrder(mapZidOrder(order));
    if (result.status === 'conflict') {
      const detail = `Order number ${result.orderNumber} already belongs to another (Salla) order; not imported`;
      await finish(false, detail);
      return { ok: false, retry: false, detail };
    }

    await finish(true, null);
    return { ok: true, detail: `${result.status} ${result.orderId}` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('ZID_WEBHOOK_PROCESS_FAILED', { logId, zidOrderId, error: detail });
    await finish(false, detail);
    return { ok: false, retry: true, detail };
  }
}
