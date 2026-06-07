import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSignedDownloadUrl } from '@/lib/r2';
import { getSession } from '@/lib/auth';
import { UPLOAD_CONFIG } from '@/lib/upload-config';

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
      const signedUrl = await getSignedDownloadUrl(file.storageKey, UPLOAD_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

      const isVideo = file.mimeType?.startsWith('video/');
      const disposition = isVideo ? 'inline' : 'inline';

      const response = NextResponse.redirect(signedUrl);
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Content-Disposition', `${disposition}; filename="${file.fileName}"`);
      response.headers.set('Cache-Control', 'private, max-age=300');

      return response;
    } catch {
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'انتهت الجلسة، سجل الدخول مرة أخرى' },
      { status: 401 },
    );
  }

  if (!UPLOAD_CONFIG.ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json(
      { success: false, error: 'ليس لديك صلاحية لحذف الملفات' },
      { status: 403 },
    );
  }

  const { id } = await params;

  const file = await prisma.proofFile.findUnique({
    where: { id },
  });

  if (!file) {
    return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
  }

  const isAuthorized = session.role === 'ADMIN' || file.uploadedById === session.id;
  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: 'ليس لديك صلاحية لحذف هذا الملف' },
      { status: 403 },
    );
  }

  try {
    const { deleteFile } = await import('@/lib/r2');
    await deleteFile(file.storageKey);
  } catch (error) {
    console.error('R2_DELETE_FAILURE', {
      fileId: id,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json(
      { success: false, error: 'تعذر حذف الملف من التخزين' },
      { status: 500 },
    );
  }

  await prisma.proofFile.delete({
    where: { id },
  });

  console.log('FILE_DELETED', { fileId: id, userId: session.id });

  return NextResponse.json({ success: true });
}
