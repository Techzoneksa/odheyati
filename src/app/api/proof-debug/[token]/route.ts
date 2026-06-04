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
      select: {
        id: true,
        orderNumber: true,
        proofStatus: true,
        customerName: true,
        files: { select: { id: true, type: true } },
      },
    });

    if (!order && cleanToken.includes('-')) {
      const parts = cleanToken.split('-');
      if (parts.length === 2) {
        const reversedToken = `${parts[1]}-${parts[0]}`;
        order = await prisma.order.findUnique({
          where: { proofToken: reversedToken },
          select: {
            id: true,
            orderNumber: true,
            proofStatus: true,
            customerName: true,
            files: { select: { id: true, type: true } },
          },
        });
      }
    }

    return NextResponse.json({
      found: !!order,
      orderNumber: order?.orderNumber,
      proofStatus: order?.proofStatus,
      filesCount: order?.files?.length || 0,
      tokenReceived: cleanToken.slice(0, 8) + '...',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}