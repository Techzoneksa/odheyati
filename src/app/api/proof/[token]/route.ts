import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    console.log('RAW_TOKEN_RECEIVED:', JSON.stringify(token));
    console.log('TOKEN_LENGTH:', token.length);
    console.log('TOKEN_CHARS:', token.split('').map(c => c.charCodeAt(0)));

    let order = await prisma.order.findUnique({
      where: { proofToken: token },
      include: { items: true, files: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
    });

    console.log('EXACT_MATCH_RESULT:', order ? `FOUND: ${order.id}` : 'NOT FOUND');

    if (!order) {
      const trimmed = token.trim();
      order = await prisma.order.findUnique({
        where: { proofToken: trimmed },
        include: { items: true, files: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
      });
      console.log('TRIMMED_MATCH_RESULT:', order ? `FOUND: ${order.id}` : 'NOT FOUND');
    }

    if (!order) {
      const similar = await prisma.order.findMany({
        where: { proofToken: { contains: token.slice(0, 10) } },
        select: { id: true, proofToken: true, orderNumber: true },
        take: 3,
      });
      console.log('SIMILAR_TOKENS:', JSON.stringify(similar));
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('PROOF_API_ERROR', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}