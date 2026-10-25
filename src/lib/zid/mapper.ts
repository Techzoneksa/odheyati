// Subset of the Zid order object we rely on. Zid sends the same shape in
// webhook payloads and in GET /managers/store/orders (payload_type=default).
export interface ZidOrderPayload {
  id: number | string;
  store_id?: number | string | null;
  order_status?: { code?: string | null; name?: string | null } | string | null;
  customer?: {
    name?: string | null;
    email?: string | null;
    mobile?: string | null;
  } | null;
  products?: Array<{
    name?: string | { ar?: string | null; en?: string | null } | null;
    sku?: string | null;
    quantity?: number | string | null;
    price?: number | string | null;
  }> | null;
}

export interface ZidMappedOrder {
  zidOrderId: string;
  orderNumber: string;
  customerName: string | null;
  customerMobile: string | null;
  customerMobileLast4: string | null;
  customerEmail: string | null;
  zidStatus: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    sku: string | null;
    price: number | null;
  }>;
}

const COUNTRY_CODES = ['966', '971', '965', '974', '973', '968'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOrderId(value: unknown): value is ZidOrderPayload {
  return isRecord(value) && (typeof value.id === 'number' || typeof value.id === 'string') && String(value.id).trim() !== '';
}

// Webhook bodies are the order object itself, but tolerate it being wrapped
// in { order } or { data } since Zid's documented schema is not explicit.
export function extractZidOrder(body: unknown): ZidOrderPayload | null {
  if (!isRecord(body)) return null;
  if (hasOrderId(body.order)) return body.order;
  if (hasOrderId(body.data)) return body.data;
  if (hasOrderId(body)) return body;
  return null;
}

function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  // Marketplace orders arrive masked ("J*** D***", "***00"); storing those
  // would only produce lookups that can never match.
  if (!text || text.includes('*')) return null;
  return text;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(toWesternDigits(String(value)).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
}

// Same format the Excel import and /track lookup use: country code + local
// number without the leading 0, e.g. 966501234567.
export function normalizeZidMobile(mobile: string | null): string | null {
  if (!mobile) return null;
  let digits = toWesternDigits(mobile).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.substring(2);
  if (!digits) return null;

  let countryCode = '966';
  let local = digits;
  const code = COUNTRY_CODES.find((c) => digits.startsWith(c) && digits.length > c.length + 7);
  if (code) {
    countryCode = code;
    local = digits.substring(code.length);
  }
  if (local.startsWith('0')) local = local.substring(1);

  return countryCode + local;
}

function productName(name: NonNullable<ZidOrderPayload['products']>[number]['name']): string | null {
  if (isRecord(name)) return cleanText(name.ar) || cleanText(name.en);
  return cleanText(name);
}

export function mapZidOrder(order: ZidOrderPayload): ZidMappedOrder {
  const zidOrderId = String(order.id).trim();
  const customer = order.customer || {};
  const mobile = normalizeZidMobile(cleanText(customer.mobile));
  const email = cleanText(customer.email)?.toLowerCase() || null;

  const status = isRecord(order.order_status)
    ? cleanText(order.order_status.code)
    : cleanText(order.order_status);

  const items = (order.products || []).flatMap((product) => {
    const name = productName(product.name);
    if (!name) return [];
    const quantity = parseNumber(product.quantity);
    return [{
      productName: name,
      quantity: quantity && quantity > 0 ? Math.round(quantity) : 1,
      sku: cleanText(product.sku),
      price: parseNumber(product.price),
    }];
  });

  return {
    zidOrderId,
    // Bulk upload takes the first run of digits in a file name as the order
    // number, so the numeric Zid order id is used as-is.
    orderNumber: zidOrderId,
    customerName: cleanText(customer.name),
    customerMobile: mobile,
    customerMobileLast4: mobile ? mobile.slice(-4) : null,
    customerEmail: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    zidStatus: status,
    items,
  };
}
