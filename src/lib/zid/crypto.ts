import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

function getKey(): Buffer {
  const key = Buffer.from(process.env.ZID_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) {
    throw new Error('ZID_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  }
  return key;
}

// Output format: v1:<iv>:<authTag>:<ciphertext>, each part base64.
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);

  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string {
  const [version, iv, authTag, encrypted] = payload.split(':');
  if (version !== VERSION || !iv || !authTag || !encrypted) {
    throw new Error('Unsupported encrypted secret format');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}
