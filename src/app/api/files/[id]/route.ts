import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSignedDownloadUrl } from '@/lib/r2';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { id } = await params;

    const file = await prisma.proofFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    try {
      const signedUrl = await getSignedDownloadUrl(file.storageKey);
      console.error('PROOF_FILE_DEBUG', {
        stage: 'SIGNED_URL_SUCCESS',
        fileId: id,
        fileOrderId: file.orderId,
        fileType: file.type,
        storageKeyStart: file.storageKey.slice(0, 20),
        storageKeyEnd: file.storageKey.slice(-20),
      });
      return NextResponse.redirect(signedUrl);
    } catch (urlError) {
      console.error('PROOF_FILE_DEBUG', {
        stage: 'SIGNED_URL_ERROR',
        fileId: id,
        fileOrderId: file.orderId,
        fileType: file.type,
        storageKeyStart: file.storageKey.slice(0, 20),
        storageKeyEnd: file.storageKey.slice(-20),
        errorMessage: urlError instanceof Error ? urlError.message : String(urlError),
      });
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
    }
  } catch (error) {
    console.error('FILE_API_ERROR', {
      stage: 'GET_FILE',
      fileIdPresent: Boolean(params)
    });
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Props) {
  const { id } = await params;

  const file = await prisma.proofFile.findUnique({
    where: { id },
  });

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    const { deleteFile } = await import('@/lib/r2');
    await deleteFile(file.storageKey);
  } catch (error) {
    console.error('R2 delete error:', error);
  }

  await prisma.proofFile.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}