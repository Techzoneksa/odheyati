import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const PUBLIC_BASE = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL!;

export type FileType = 'IMAGE' | 'VIDEO';

export async function uploadFile(
  orderNumber: string,
  type: FileType,
  file: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ storageKey: string; size: number }> {
  const folder = type === 'IMAGE' ? 'images' : 'videos';
  const storageKey = `proofs/${orderNumber}/${folder}/${fileName}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: file,
      ContentType: mimeType,
    })
  );

  return { storageKey, size: file.length };
}

export async function deleteFile(storageKey: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
    })
  );
}

export async function getSignedDownloadUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

export function getPublicUrl(storageKey: string): string {
  return `${PUBLIC_BASE}/${storageKey}`;
}