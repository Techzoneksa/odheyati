import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  let tokenValue = '';

  try {
    const resolved = await context.params;
    tokenValue = (resolved?.token || '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!tokenValue) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  try {
    // Try exact match
    let order = await prisma.order.findUnique({
      where: { proofToken: tokenValue },
      include: { items: true, files: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
    }).catch(() => null);

    // Try reversed format
    if (!order && tokenValue.includes('-')) {
      const parts = tokenValue.split('-');
      if (parts.length === 2) {
        const reversed = `${parts[1]}-${parts[0]}`;
        order = await prisma.order.findUnique({
          where: { proofToken: reversed },
          include: { items: true, files: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
        }).catch(() => null);
      }
    }

    // Last resort: match by number in token
    if (!order) {
      const numberMatch = tokenValue.match(/\d{9,}/);
      if (numberMatch) {
        order = await prisma.order.findFirst({
          where: { orderNumber: numberMatch[0] },
          include: { items: true, files: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
        }).catch(() => null);
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PROOF_API_ERROR:', msg);
    return NextResponse.json({ error: 'Server error', details: msg }, { status: 500 });
  }
}
