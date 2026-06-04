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

    const cleanToken = token.trim();

    let order = await prisma.order.findUnique({
      where: { proofToken: cleanToken },
      include: {
        items: true,
        files: {
          orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });

    if (!order && cleanToken.includes('-')) {
      const parts = cleanToken.split('-');
      if (parts.length === 2) {
        const reversedToken = `${parts[1]}-${parts[0]}`;
        console.log('PROOF_TOKEN_REVERSED_LOOKUP', {
          originalStart: cleanToken.slice(0, 6),
          reversedStart: reversedToken.slice(0, 6),
        });
        order = await prisma.order.findUnique({
          where: { proofToken: reversedToken },
          include: {
            items: true,
            files: {
              orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
            },
          },
        });
      }
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