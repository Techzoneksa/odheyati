import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseWebhookPayload } from '@/lib/schemas';
import crypto from 'crypto';

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return digest === signature;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-salla-signature');
  const webhookSecret = process.env.SALLA_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    if (!verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await prisma.webhookLog.create({
      data: {
        event: 'unknown',
        payload: { raw: rawBody },
        processed: false,
        error: 'Invalid JSON',
      },
    });
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseWebhookPayload(payload);

  if (!parsed.success) {
    await prisma.webhookLog.create({
      data: {
        event: String((payload as { event?: string }).event || 'unknown'),
        payload: parsed.data as unknown as object,
        processed: false,
        error: parsed.error.message,
      },
    });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { event, data } = parsed.data;

  await prisma.webhookLog.create({
    data: {
      event,
      payload: parsed.data as object,
      processed: true,
    },
  });

  if (!data?.order_number && !data?.order_number_string) {
    return NextResponse.json({ received: true });
  }

  const orderNumber = data.order_number_string || data.order_number?.toString() || '';
  const customerData = data.customer || {};

  const customerName = customerData.name ||
    [customerData.first_name, customerData.last_name].filter(Boolean).join(' ') ||
    'عميل';

  const mobile = customerData.mobile || customerData.phone || '';
  const mobileLast4 = mobile.slice(-4);

  try {
    await prisma.order.upsert({
      where: { orderNumber },
      update: {
        customerName,
        customerMobile: mobile,
        customerMobileLast4: mobileLast4,
        customerEmail: customerData.email || null,
        sallaStatus: data.status || null,
      },
      create: {
        sallaOrderId: data.id?.toString(),
        orderNumber,
        customerName,
        customerMobile: mobile,
        customerMobileLast4: mobileLast4,
        customerEmail: customerData.email || null,
        sallaStatus: data.status || 'pending',
      },
    });

    if (data.items && Array.isArray(data.items)) {
      const existingOrder = await prisma.order.findUnique({
        where: { orderNumber },
        include: { items: true },
      });

      if (existingOrder && existingOrder.items.length === 0) {
        await Promise.all(
          data.items.map((item, index) =>
            prisma.orderItem.create({
              data: {
                orderId: existingOrder.id,
                productName: item.product?.name || 'منتج',
                quantity: item.quantity || 1,
                sku: item.product?.sku || null,
                price: item.price || null,
              },
            })
          )
        );
      }
    }
  } catch (error) {
    console.error('Order processing error:', error);
    await prisma.webhookLog.create({
      data: {
        event,
        payload: parsed.data as object,
        processed: false,
        error: String(error),
      },
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}