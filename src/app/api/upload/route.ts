import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, FileType } from '@/lib/r2';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const type = formData.get('type') as FileType;

    if (!file || !orderId || !type) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(
      order.orderNumber,
      type,
      buffer,
      file.name,
      file.type
    );

    const maxSortOrder = await prisma.proofFile.aggregate({
      where: { orderId, type },
      _max: { sortOrder: true },
    });

    const proofFile = await prisma.proofFile.create({
      data: {
        orderId,
        type,
        storageKey: result.storageKey,
        fileName: file.name,
        mimeType: file.type,
        size: result.size,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
        uploadedById: session.id,
      },
    });

    return NextResponse.json(proofFile);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}