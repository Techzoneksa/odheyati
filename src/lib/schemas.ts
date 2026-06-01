import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('إيميل غير صالح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

export const lookupSchema = z.object({
  orderNumber: z.string().min(1, 'رقم الطلب مطلوب'),
  mobileLast4: z.string().length(4, 'آخر 4 أرقام من الجوال يجب أن تكون 4 أرقام'),
});

export const proofStatusSchema = z.object({
  proofStatus: z.enum(['PENDING', 'IN_PROGRESS', 'SLAUGHTERED', 'MEDIA_UPLOADED', 'READY', 'VIEWED', 'CANCELLED']),
});

export const webhookPayloadSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.number().optional(),
    order_number: z.string().optional(),
    order_number_string: z.string().optional(),
    customer: z.object({
      name: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      mobile: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }).optional(),
    status: z.string().optional(),
    total: z.number().optional(),
    items: z.array(z.object({
      product: z.object({
        name: z.string().optional(),
        sku: z.string().optional(),
      }).optional(),
      quantity: z.number().optional(),
      price: z.number().optional(),
    })).optional(),
  }).optional(),
});

export function parseWebhookPayload(payload: unknown) {
  return webhookPayloadSchema.safeParse(payload);
}