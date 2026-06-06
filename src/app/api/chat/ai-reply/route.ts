import { NextResponse } from 'next/server';

const FALLBACK_REPLY = 'يسعدنا مساعدتك. تواصل معنا عبر واتساب للمزيد من الدعم.';

export async function POST(request: Request) {
  console.log('AI_REPLY_ENV_CHECK', {
    enabled: process.env.AI_FALLBACK_ENABLED,
    hasKey: !!process.env.GEMINI_API_KEY,
  });

  const enabled = process.env.AI_FALLBACK_ENABLED === 'true';
  const apiKey = process.env.GEMINI_API_KEY;

  if (!enabled || !apiKey) {
    return NextResponse.json({ reply: FALLBACK_REPLY });
  }

  try {
    const { message } = await request.json();
    console.log('AI_REPLY_START', { messageLength: message?.length });

    const systemPrompt = `أنت مساعد أضحيتي لخدمة العملاء.
أجب بالعربية وبأسلوب سعودي لطيف ومختصر. لا تتجاوز 3 أسطر.
أجب فقط بناءً على معلومات أضحيتي. لا تخترع معلومات.
لا تقدم فتاوى أو أحكام شرعية.
أضحيتي شركة سعودية تجارية مرخصة بسجل تجاري رقم 7052388860، وليست جهة خيرية.
الخدمات: الأضحية، العقيقة، النذر، الكفارة.
رابط الطلب: https://odheyati.com/ar/المنتجات/c1947708130
مدة التنفيذ تصل إلى 10 أيام. التنفيذ والتوزيع خارج المملكة.
لا توجد خدمة توصيل لحوم داخل المملكة.
إذا لم تعرف الإجابة، وجّه للواتساب: https://api.whatsapp.com/send?phone=966562365161`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'حسنًا، سأساعدك.' }] },
            { role: 'user', parts: [{ text: message }] },
          ],
        }),
      }
    );

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) throw new Error('No reply from Gemini');

    console.log('AI_REPLY_SUCCESS');
    return NextResponse.json({ reply });

  } catch (error) {
    console.error('AI_REPLY_ERROR', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ reply: FALLBACK_REPLY });
  }
}