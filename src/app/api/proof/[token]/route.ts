import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

    const cleanToken = token.trim();

    // Try exact match first
    let order = await prisma.order.findUnique({
      where: { proofToken: cleanToken },
      include: { items: true, files: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
    });

    // Try reversed format (old tokens: random-timestamp → timestamp-random)
    if (!order && cleanToken.includes('-')) {
      const parts = cleanToken.split('-');
      if (parts.length === 2) {
        const reversed = `${parts[1]}-${parts[0]}`;
        order = await prisma.order.findUnique({
          where: { proofToken: reversed },
          include: { items: true, files: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
        });
      }
    }

    // Last resort: search by orderNumber extracted from token
    if (!order) {
      const numberMatch = cleanToken.match(/\d{9,}/);
      if (numberMatch) {
        order = await prisma.order.findFirst({
          where: { orderNumber: { contains: numberMatch[0] } },
          include: { items: true, files: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
        });
      }
    }

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    return NextResponse.json(order);
  } catch (error) {
    console.error('PROOF_API_ERROR', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}
