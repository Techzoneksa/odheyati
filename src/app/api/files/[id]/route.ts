import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/r2';

interface Props {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const file = await prisma.proofFile.findUnique({
    where: { id },
  });

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    await deleteFile(file.storageKey);
  } catch (error) {
    console.error('R2 delete error:', error);
  }

  await prisma.proofFile.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}