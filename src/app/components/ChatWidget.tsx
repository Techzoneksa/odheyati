'use client';

import { useState, useRef, useEffect } from 'react';
import '../components/chat-widget.css';

const WHATSAPP_URL = 'https://api.whatsapp.com/send?phone=966562365161&text=';
const PRODUCTS_URL = 'https://odheyati.com/ar/%D8%A7%D9%84%D9%85%D9%86%D8%AA%D8%AC%D8%A7%D8%AA/c1947708130';

interface Message {
  role: 'bot' | 'user';
  text: string;
  buttons?: { label: string; action: string }[];
  cards?: { title: string; description: string; buttonLabel: string; url: string }[];
  linkUrl?: string;
  linkLabel?: string;
  isLoading?: boolean;
}

function detectIntent(msg: string): string {
  const m = msg.trim();

  if (/\d{7,}/.test(m) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(m)) return 'lookup_input';

  if (/^(السلام|سلام|هلا|مرحبا|مرحباً|صباح|مساء|أهلا|اهلا|هله|هلو|هاي|hi|hello)/i.test(m)) return 'greeting';

  if (/(كيف الحال|كيفك|كيف حالك|وش أخبارك|عامل ايه|تمام|الحمد لله|بخير|ماشي)/i.test(m)) return 'small_talk';

  if (/(وين طلبي|طلبي|حالة الطلب|تتبع|التوثيق|الفيديو|الصور|وصل التوثيق|رقم الطلب|أين طلبي|اين طلبي)/i.test(m)) return 'order_tracking';

  if (/(توصيل|توصلون|توصل|وين أستلم|اين استلم|استلام اللحم|اللحم|الذبيحة توصل)/i.test(m)) return 'delivery';

  if (/(كيف أطلب|كيف اطلب|كيف الشراء|أبغى أطلب|ابغى اطلب|طلب خدمة|وش خدماتكم|خدماتكم|عندكم|أطلب|اطلب)/i.test(m)) return 'store_order';

  if (/(أضحية|اضحية|عقيقة|عقيقه|نذر|كفارة|كفاره|ذبيحة|ذبيحه|خروف|خرفان|تيس|تيوس)/i.test(m)) return 'service_specific';

  if (/(جمعية|جمعيه|خيرية|خيريه|موثق|سجل تجاري|مرخص|سعر|كم السعر|كم يستغرق|مدة التنفيذ|كيف استلم التوثيق|تعديل|إلغاء|الغاء|فتوى)/i.test(m)) return 'faq';

  if (/(مشكلة|مشكله|شكوى|شكوه|تواصل|خدمة العملاء|دعم)/i.test(m)) return 'support';

  return 'unknown';
}

function hasSensitiveData(msg: string): boolean {
  return /\d{7,}/.test(msg) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(msg);
}

const OPENING_MESSAGE: Message = {
  role: 'bot',
  text: 'السلام عليكم، حيّاك الله في أضحيتي 🌿\nكيف نقدر نساعدك؟',
  buttons: [
    { label: 'تتبع الطلب', action: 'track' },
    { label: 'طلب خدمة من المتجر', action: 'store' },
    { label: 'مشاهدة التوثيق', action: 'view_proof' },
    { label: 'واتساب', action: 'wa' },
  ],
};

const FALLBACK_REPLY = 'يسعدنا مساعدتك. تواصل معنا عبر واتساب للمزيد من الدعم.';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChat = () => {
    setMessages([OPENING_MESSAGE]);
    setIsOpen(true);
  };

  const closeChat = () => {
    setIsOpen(false);
    setMessages([]);
  };

  const handleButton = (action: string) => {
    if (action === 'track' || action === 'view_proof') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'فضلاً أدخل رقم الطلب أو رقم الجوال أو البريد الإلكتروني المرتبط بالطلب.\nإذا كان رقمك خارج السعودية، اكتب مفتاح الدولة بدون + وبدون أصفار، مثل: 9715XXXXXXXX',
      }]);
    } else if (action === 'store') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'اختر الخدمة التي ترغب بطلبها من متجر أضحيتي:',
        cards: [
          { title: 'الأضحية', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'العقيقة', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'النذر', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'الكفارة', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
        ],
      }]);
    } else if (action === 'wa') {
      window.open(WHATSAPP_URL, '_blank');
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'يسعدنا مساعدتك! تواصل معنا مباشرة عبر واتساب وسنرد في أقرب وقت.',
        buttons: [
          { label: 'تتبع الطلب', action: 'track' },
          { label: 'طلب خدمة من المتجر', action: 'store' },
        ],
      }]);
    } else if (action === 'retry') {
      showUnknown();
    }
  };

  const handleLookup = async (text: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat/order-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();

      if (data.found && data.orders && data.orders.length > 0) {
        const order = data.orders[0];
        const customerName = order.customerName || 'أهلاً';
        const orderNumber = order.orderNumber;
        const proofReady = order.hasMedia || ['READY', 'VIEWED', 'MEDIA_UPLOADED'].includes(order.proofStatus);
        const proofToken = order.proofToken;
        const proofUrl = order.proofUrl;

        if (proofReady && proofToken) {
          setMessages(prev => [...prev, {
            role: 'bot',
            text: `أهلاً ${customerName} 🌿\nرقم طلبك: ${orderNumber}\nحالة التوثيق: جاهز ✅`,
            linkUrl: proofUrl || `/proof/${proofToken}`,
            linkLabel: 'مشاهدة التوثيق',
          }]);
        } else {
          setMessages(prev => [...prev, {
            role: 'bot',
            text: `أهلاً ${customerName} 🌿\nرقم طلبك: ${orderNumber}\nطلبك موجود لدينا، وجاري تجهيز التوثيق حاليًا. سيظهر رابط المشاهدة فور اكتمال رفع الصور أو الفيديوهات.`,
            buttons: [{ label: 'واتساب', action: 'wa' }],
          }]);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: 'لم نتمكن من إيجاد طلب بهذا الرقم أو الجوال.\nتأكد من الرقم أو تواصل معنا عبر واتساب.',
          buttons: [{ label: 'واتساب', action: 'wa' }],
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'حدث خطأ، حاول مرة أخرى.',
        buttons: [{ label: 'واتساب', action: 'wa' }],
      }]);
    }
    setIsLoading(false);
  };

  const callAIReply = async (msgText: string) => {
    setMessages(prev => [...prev, { role: 'bot', text: '', isLoading: true }]);
    try {
      const res = await fetch('/api/chat/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText }),
      });
      const data = await res.json();
      const reply = data?.reply || FALLBACK_REPLY;

      setMessages(prev => {
        const filtered = prev.filter(m => !(m.role === 'bot' && m.isLoading));
        return [...filtered, {
          role: 'bot',
          text: reply,
          buttons: [
            { label: 'تتبع الطلب', action: 'track' },
            { label: 'طلب خدمة من المتجر', action: 'store' },
            { label: 'واتساب', action: 'wa' },
          ],
        }];
      });
    } catch {
      setMessages(prev => {
        const filtered = prev.filter(m => !(m.role === 'bot' && m.isLoading));
        return [...filtered, {
          role: 'bot',
          text: FALLBACK_REPLY,
          buttons: [
            { label: 'تتبع الطلب', action: 'track' },
            { label: 'طلب خدمة من المتجر', action: 'store' },
          ],
        }];
      });
    }
  };

  const showUnknown = () => {
    setMessages(prev => [...prev, {
      role: 'bot',
      text: FALLBACK_REPLY,
      buttons: [
        { label: 'تتبع الطلب', action: 'track' },
        { label: 'طلب خدمة من المتجر', action: 'store' },
        { label: 'واتساب', action: 'wa' },
      ],
    }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text }]);

    const intent = detectIntent(text);
    console.log('CHAT_INTENT', intent);

    if (intent === 'lookup_input') {
      handleLookup(text);
      return;
    }

    if (intent === 'greeting') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'وعليكم السلام ورحمة الله، حيّاك الله في أضحيتي 🌿\nكيف نقدر نساعدك؟',
        buttons: [
          { label: 'تتبع الطلب', action: 'track' },
          { label: 'طلب خدمة من المتجر', action: 'store' },
          { label: 'واتساب', action: 'wa' },
        ],
      }]);
      return;
    }

    if (intent === 'small_talk') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'بخير ونعمة، حيّاك الله في أضحيتي 🌿\nكيف نقدر نساعدك اليوم؟',
        buttons: [
          { label: 'تتبع الطلب', action: 'track' },
          { label: 'طلب خدمة من المتجر', action: 'store' },
          { label: 'واتساب', action: 'wa' },
        ],
      }]);
      return;
    }

    if (intent === 'order_tracking') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'فضلاً أدخل رقم الطلب أو رقم الجوال أو البريد الإلكتروني المرتبط بالطلب.\nإذا كان رقمك خارج السعودية، اكتب مفتاح الدولة بدون + وبدون أصفار، مثل: 9715XXXXXXXX',
      }]);
      return;
    }

    if (intent === 'delivery') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'خدمة أضحيتي لا تشمل توصيل اللحوم أو استلام الذبيحة داخل المملكة.\nيتم تنفيذ وتوزيع الطلبات خارج المملكة، ويصلكم التوثيق بالصوت والصورة بعد اكتمال التنفيذ.',
        buttons: [
          { label: 'طلب خدمة من المتجر', action: 'store' },
          { label: 'واتساب', action: 'wa' },
        ],
      }]);
      return;
    }

    if (intent === 'store_order') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'اختر الخدمة التي ترغب بطلبها من متجر أضحيتي:',
        cards: [
          { title: 'الأضحية', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'العقيقة', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'النذر', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'الكفارة', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
        ],
      }]);
      return;
    }

    if (intent === 'service_specific') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'اختر الخدمة التي ترغب بطلبها من متجر أضحيتي:',
        cards: [
          { title: 'الأضحية', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'العقيقة', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'النذر', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
          { title: 'الكفارة', description: 'الخدمة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.', buttonLabel: 'اطلب الخدمة', url: PRODUCTS_URL },
        ],
      }]);
      return;
    }

    if (intent === 'faq') {
      let reply = '';
      const lower = text.toLowerCase();

      if (/(جمعية|جمعيه|خيرية|خيريه)/i.test(text)) {
        reply = 'نحن شركة سعودية مرخصة بسجل تجاري رقم 7052388860، ولسنا جهة خيرية ولا نجمع تبرعات.';
      } else if (/(موثق|سجل تجاري|مرخص)/i.test(text)) {
        reply = 'متجر أضحيتي موثق ومعتمد لدى المركز السعودي للأعمال، شهادة رقم 0000129587.\nسجل تجاري رقم 7052388860.';
      } else if (/(كم يستغرق|مدة التنفيذ)/i.test(text)) {
        reply = 'مدة تنفيذ الطلب تصل إلى 10 أيام.\nيمكنك متابعة الطلب من خلال رقم الطلب أو الجوال أو البريد الإلكتروني.';
      } else if (/(تعديل|إلغاء|الغاء)/i.test(text)) {
        reply = 'يمكن طلب التعديل أو الإلغاء قبل بدء تنفيذ الطلب فقط.\nبعد بدء التنفيذ لا يمكن الإلغاء.';
      } else if (/(كيف استلم التوثيق|استلم|الفيديو|الصور)/i.test(text)) {
        reply = 'يتم إرسال التقرير إلى رقم الواتساب الخاص بكم في ملف PDF بعد اكتمال التوثيق.';
      } else if (/(فتوى)/i.test(text)) {
        reply = 'نعتذر، لا نقدم فتاوى شرعية.\nيمكننا مساعدتك في الخدمات المتاحة فقط.';
      } else if (/(سعر|كم)/i.test(text)) {
        reply = 'يمكنك الاطلاع على الأسعار والخدمات المتاحة مباشرة من متجر أضحيتي، حيث تظهر لك تفاصيل كل خدمة قبل إتمام الطلب.';
      } else {
        reply = 'أقدر أساعدك في متابعة الطلب، مشاهدة التوثيق، أو طلب خدمات أضحيتي من المتجر.';
      }

      setMessages(prev => [...prev, {
        role: 'bot',
        text: reply,
        buttons: [
          { label: 'طلب خدمة من المتجر', action: 'store' },
          { label: 'واتساب', action: 'wa' },
        ],
      }]);
      return;
    }

    if (intent === 'support') {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'يسعدنا مساعدتك! تواصل معنا مباشرة عبر واتساب وسنرد في أقرب وقت.',
        buttons: [{ label: 'واتساب', action: 'wa' }],
      }]);
      return;
    }

    if (intent === 'unknown') {
      if (hasSensitiveData(text)) {
        handleLookup(text);
        return;
      }
      callAIReply(text);
      return;
    }

    callAIReply(text);
  };

  if (!isOpen) {
    return (
      <button className="chat-fab" onClick={openChat} aria-label="مساعد أضحيتي">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header" dir="rtl">
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>مساعد أضحيتي</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>نحن هنا لمساعدتك</div>
        </div>
        <button
          onClick={closeChat}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            {msg.isLoading ? (
              <div className="chat-loading">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              <>
                {msg.text && <span>{msg.text}</span>}

                {msg.buttons && msg.buttons.map((btn, j) => {
                  if (btn.action === 'wa') {
                    return (
                      <a
                        key={j}
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chat-wa-btn"
                        style={{ marginTop: 6 }}
                      >
                        <img src="/icons/whatsapp-svgrepo-com.svg" width={20} height={20} alt="واتساب" />
                        واتساب
                      </a>
                    );
                  }
                  return (
                    <button key={j} className="chat-btn" onClick={() => handleButton(btn.action)}>
                      {btn.label}
                    </button>
                  );
                })}

                {msg.cards && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {msg.cards.map((card, j) => (
                      <a key={j} href={card.url} target="_blank" rel="noopener noreferrer" className="chat-card">
                        <div className="chat-card-title">{card.title}</div>
                        <div className="chat-card-desc">{card.description}</div>
                        <div className="chat-card-btn">{card.buttonLabel}</div>
                      </a>
                    ))}
                  </div>
                )}

                {msg.linkUrl && msg.linkLabel && (
                  <a
                    href={msg.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chat-btn"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dca47c', color: '#fff', border: 'none', marginTop: 6 }}
                  >
                    {msg.linkLabel}
                  </a>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="اكتب رسالة..."
          dir="rtl"
          disabled={isLoading}
        />
        <button type="submit" className="chat-send-btn" disabled={isLoading}>
          إرسال
        </button>
      </form>
    </div>
  );
}