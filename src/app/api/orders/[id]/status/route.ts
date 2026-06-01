import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { proofStatusSchema } from '@/lib/schemas';

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = proofStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      proofStatus: parsed.data.proofStatus,
    },
  });

  await prisma.proofEvent.create({
    data: {
      orderId: id,
      eventType: 'STATUS_CHANGED',
      note: `تم تغيير الحالة إلى ${parsed.data.proofStatus}`,
      createdById: session.id,
    },
  });

  return NextResponse.json(order);
}