import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const TEST_KEY = 'health-check/test-file.txt';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const testContent = Buffer.from(`R2 Health Check ${new Date().toISOString()}`);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: TEST_KEY,
        Body: testContent,
        ContentType: 'text/plain',
      })
    );

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: TEST_KEY,
      })
    );

    return NextResponse.json({
      ok: true,
      bucketReachable: true,
      canPutTestObject: true,
      canDeleteTestObject: true,
    });
  } catch (error) {
    const err = error as Error;
    let errorCode = 'R2_UNKNOWN';
    if (err.name?.includes('AccessDenied')) errorCode = 'R2_ACCESS_DENIED';
    else if (err.name?.includes('NoSuchBucket')) errorCode = 'R2_NO_SUCH_BUCKET';
    else if (err.name?.includes('InvalidAccessKey')) errorCode = 'R2_INVALID_CREDENTIALS';

    return NextResponse.json({
      ok: false,
      bucketReachable: false,
      canPutTestObject: false,
      canDeleteTestObject: false,
      errorCode,
      message: err.message,
    });
  }
}