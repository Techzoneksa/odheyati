import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const FALLBACK_REPLY = 'أقدر أساعدك في متابعة الطلب، مشاهدة التوثيق، أو طلب خدمات أضحيتي من المتجر. اختر ما يناسبك من الخيارات التالية.';
const FALLBACK_BUTTONS = [
  { label: 'تتبع الطلب', action: 'track' },
  { label: 'اطلب من المتجر', action: 'shop' },
  { label: 'واتساب', action: 'support', isWhatsApp: true },
];

const SYSTEM_PROMPT = `أنت مساعد أضحيتي لخدمة العملاء.
أجب بالعربية وبأسلوب سعودي لطيف ومختصر.
أجب فقط بناءً على معلومات أضحيتي التالية.
لا تخترع معلومات.
لا تقدم فتاوى أو أحكام شرعية.
لا تقل إن أضحيتي جهة خيرية.
أضحيتي شركة سعودية تجارية مرخصة وليست جهة خيرية ولا تجمع تبرعات.
إذا سأل العميل عن التبرعات أو الجمعيات، وضّح أننا شركة تجارية مرخصة ولسنا جهة خيرية.
إذا سأل عن السعر، وجّهه لصفحة المنتجات.
إذا سأل عن الطلب أو التوثيق، اطلب منه استخدام رقم الطلب أو الجوال أو الإيميل في الدردشة.
إذا سأل عن التوصيل داخل المملكة، وضّح أن الخدمة لا تشمل توصيل اللحوم داخل المملكة، والتنفيذ والتوزيع خارج المملكة.
إذا لم تعرف الإجابة، وجّه العميل إلى واتساب.

معلومات أضحيتي الثابتة:
- أضحيتي شركة سعودية مرخصة ومسجلة بسجل تجاري رقم 7052388860.
- المتجر موثق ومعتمد لدى المركز السعودي للأعمال، شهادة رقم 0000129587.
- أضحيتي ليست جهة خيرية ولا تجمع تبرعات.
- نقدم خدمات الأضحية، العقيقة، النذر، والكفارة.
- الطلب يتم من صفحة المنتجات: https://odheyati.com/ar/المنتجات/c1947708130
- مدة التنفيذ تصل إلى 10 أيام.
- يتم إرسال التوثيق بعد اكتمال التنفيذ عبر واتساب في ملف PDF مرتب وواضح.
- يمكن طلب التعديل أو الإلغاء قبل بدء التنفيذ فقط.
- بعد بدء التنفيذ لا يمكن الإلغاء.
- التنفيذ والتوزيع خارج المملكة، والتوزيع في أفريقيا حسب آلية التشغيل المعتمدة.
- لا توجد خدمة توصيل لحوم أو استلام الذبيحة داخل المملكة.
- رابط واتساب: https://api.whatsapp.com/send?phone=966562365161&text=

قواعد الرد:
- لا تتجاوز 3 أسطر غالبًا.
- لا تدخل في تفاصيل فقهية.
- لا تذكر أهل العلم.
- لا تذكر أحكام شرعية.
- لا تخترع أسعار.
- لا تخترع دول توزيع محددة داخل أفريقيا.
- لا تطلب رقم الطلب إلا إذا السؤال عن حالة الطلب أو التوثيق.
- استخدم لهجة لطيفة وواضحة.`;

// Simple rate limit: 10 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

function getRateLimitKey(ip: string): string {
  return ip || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = getRateLimitKey(ip);
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

function isPII(text: string): boolean {
  const lower = text.toLowerCase();
  // Check for email
  if (lower.includes('@') && lower.includes('.')) return true;
  // Check for Saudi mobile pattern
  if (/05\d{8}/.test(text)) return true;
  // Check for international mobile
  if (/\+?\d{10,}/.test(text)) return true;
  // Check for order number pattern (7+ digits)
  if (/\b\d{7,}\b/.test(text)) return true;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'الطلبات كثيرة حاليًا، حاول بعد قليل أو تواصل معنا عبر واتساب.', buttons: [{ label: '🟢 واتساب', action: 'support' }] },
        { status: 429 }
      );
    }

    const aiEnabled = process.env.AI_FALLBACK_ENABLED === 'true';
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('AI_REPLY_ENV_CHECK', {
      enabled: aiEnabled,
      hasKey: !!apiKey,
      envValue: process.env.AI_FALLBACK_ENABLED,
    });

    if (!aiEnabled || !apiKey) {
      console.log('AI_REPLY_SKIP', { reason: !aiEnabled ? 'AI_FALLBACK_ENABLED != true' : 'GEMINI_API_KEY missing' });
      return NextResponse.json(
        { reply: FALLBACK_REPLY, buttons: FALLBACK_BUTTONS },
        { status: 200 }
      );
    }

    const body = await req.json();
    const message: string = body?.message?.trim();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (isPII(message)) {
      console.log('AI_REPLY_SKIP', { reason: 'PII detected in message' });
      return NextResponse.json(
        { reply: FALLBACK_REPLY, buttons: FALLBACK_BUTTONS },
        { status: 200 }
      );
    }

    console.log('AI_REPLY_START', { messageLength: message.length });

    const prompt = `${SYSTEM_PROMPT}\n\nالعميل يسأل: ${message}`;

    let geminiRes: Response;
    try {
      geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256,
          },
        }),
      });
    } catch (fetchErr) {
      console.error('AI_REPLY_ERROR', { message: fetchErr instanceof Error ? fetchErr.message : 'fetch failed' });
      return NextResponse.json(
        { reply: FALLBACK_REPLY, buttons: FALLBACK_BUTTONS },
        { status: 200 }
      );
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('AI_REPLY_ERROR', { status: geminiRes.status, error: errText.substring(0, 200) });
      return NextResponse.json(
        { reply: FALLBACK_REPLY, buttons: FALLBACK_BUTTONS },
        { status: 200 }
      );
    }

    let geminiData: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    try {
      geminiData = await geminiRes.json();
    } catch {
      console.error('AI_REPLY_ERROR', { message: 'failed to parse JSON' });
      return NextResponse.json(
        { reply: FALLBACK_REPLY, buttons: FALLBACK_BUTTONS },
        { status: 200 }
      );
    }

    console.log('AI_REPLY_GEMINI_RESPONSE', { hasData: !!geminiData, keys: Object.keys(geminiData || {}) });

    const replyText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!replyText) {
      console.error('AI_REPLY_ERROR', { message: 'empty reply from Gemini' });
      return NextResponse.json(
        { reply: FALLBACK_REPLY, buttons: FALLBACK_BUTTONS },
        { status: 200 }
      );
    }

    console.log('AI_REPLY_SUCCESS', { replyLength: replyText.length });
    return NextResponse.json({ reply: replyText, buttons: FALLBACK_BUTTONS }, { status: 200 });
  } catch (error) {
    console.error('AI_REPLY_ERROR', { message: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json(
      { reply: FALLBACK_REPLY, buttons: FALLBACK_BUTTONS },
      { status: 200 }
    );
  }
}