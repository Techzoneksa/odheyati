import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }>
}) {
  try {
    const { token } = await params;

    console.error('PROOF_API_DEBUG', {
      stage: 'TOKEN_RECEIVED',
      token,
      tokenLength: token?.length
    });

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { proofToken: token },
      include: {
        items: true,
        files: {
          orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });

    console.error('PROOF_API_DEBUG', {
      stage: 'QUERY_COMPLETE',
      orderFound: !!order,
      orderId: order?.id
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('PROOF_API_ERROR', {
      stage: 'CATCH_ERROR',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Failed to fetch order', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}