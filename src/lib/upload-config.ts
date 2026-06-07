const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export const UPLOAD_CONFIG = {
  MIME_TYPES: {
    IMAGE: ALLOWED_IMAGE_MIMES,
    VIDEO: ALLOWED_VIDEO_MIMES,
  } as const,

  ALLOWED_MIME_STRINGS: [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES] as string[],

  EXTENSIONS: {
    IMAGE: ['.jpg', '.jpeg', '.png', '.webp'],
    VIDEO: ['.mp4', '.mov', '.webm'],
  } as const,

  MAGIC_BYTES: new Map<string, number[][]>([
    ['image/jpeg', [[0xFF, 0xD8, 0xFF]]],
    ['image/png', [[0x89, 0x50, 0x4E, 0x47]]],
    ['image/webp', [[0x52, 0x49, 0x46, 0x46]]],
    ['video/mp4', [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]]],
    ['video/quicktime', [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]]],
    ['video/webm', [[0x1A, 0x45, 0xDF, 0xA3]]],
  ]),

  LIMITS: {
    IMAGE_MAX_BYTES: 10 * 1024 * 1024,
    VIDEO_MAX_BYTES: 100 * 1024 * 1024,
    BULK_MAX_FILES: 100,
    BULK_TOTAL_BYTES: 500 * 1024 * 1024,
    CONCURRENT_UPLOADS: 2,
  } as const,

  RATE_LIMIT: {
    WINDOW_MS: 60_000,
    MAX_REQUESTS: 20,
  } as const,

  SIGNED_URL_EXPIRY_SECONDS: 300,

  ALLOWED_ROLES: ['ADMIN', 'EMPLOYEE'] as readonly string[],

  get MAX_BYTES() {
    return Math.max(this.LIMITS.IMAGE_MAX_BYTES, this.LIMITS.VIDEO_MAX_BYTES);
  },
};

function extname(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return '';
  return filename.substring(idx).toLowerCase();
}

function isMimeAllowed(mime: string): boolean {
  return UPLOAD_CONFIG.ALLOWED_MIME_STRINGS.includes(mime);
}

function allowedExtensions(): string[] {
  return [...UPLOAD_CONFIG.EXTENSIONS.IMAGE, ...UPLOAD_CONFIG.EXTENSIONS.VIDEO];
}

function maxBytesForMime(mime: string): number {
  if (UPLOAD_CONFIG.ALLOWED_MIME_STRINGS.includes(mime) &&
      UPLOAD_CONFIG.MIME_TYPES.IMAGE.includes(mime as any)) {
    return UPLOAD_CONFIG.LIMITS.IMAGE_MAX_BYTES;
  }
  return UPLOAD_CONFIG.LIMITS.VIDEO_MAX_BYTES;
}

function validateFileType(filename: string, mimeType: string): { valid: boolean; error?: string } {
  const ext = extname(filename);

  if (!ext || !allowedExtensions().includes(ext)) {
    return { valid: false, error: 'نوع الملف غير مدعوم' };
  }

  if (filename !== filename.replace(/[^a-zA-Z0-9.\u0600-\u06FF_-]/g, '')) {
    return { valid: false, error: 'اسم الملف غير صالح' };
  }

  const suspicious = ['.php', '.html', '.htm', '.exe', '.zip', '.js', '.svg']
    .filter(bad => filename.toLowerCase().includes(bad));
  if (suspicious.length > 0) {
    return { valid: false, error: 'نوع الملف غير مدعوم' };
  }

  if (!UPLOAD_CONFIG.ALLOWED_MIME_STRINGS.includes(mimeType)) {
    return { valid: false, error: 'نوع الملف غير مدعوم' };
  }

  return { valid: true };
}

function checkMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = UPLOAD_CONFIG.MAGIC_BYTES.get(mimeType);
  if (!signatures) return false;

  return signatures.some(sig => {
    if (buffer.length < sig.length) return false;
    return sig.every((byte, i) => buffer[i] === byte);
  });
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\.\//g, '')
    .replace(/\\/g, '')
    .replace(/\0/g, '')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/[/]/g, '_');
}

export const uploadSecurity = {
  extname,
  isMimeAllowed,
  allowedExtensions,
  maxBytesForMime,
  validateFileType,
  checkMagicBytes,
  sanitizeFilename,
};
