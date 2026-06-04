'use client';

import { useState, useRef, useEffect } from 'react';

interface OrderResult {
  orderNumber: string;
  customerName: string;
  proofStatus: string;
  statusText: string;
  hasMedia: boolean;
  proofUrl: string;
}

interface Message {
  role: 'bot' | 'user';
  text: string;
  buttons?: { label: string; action: string }[];
  links?: { label: string; url: string }[];
  inputs?: { placeholder: string; action: string }[];
}

const WELCOME_MESSAGE: Message = {
  role: 'bot',
  text: 'السلام عليكم، حيّاك الله في أضحيتي 🌿\nكيف أقدر أخدمك؟',
  buttons: [
    { label: 'تتبع الطلب', action: 'track' },
    { label: 'مشاهدة التوثيق', action: 'view_proof' },
    { label: 'الاستفسار عن الأضحية', action: 'aqeela' },
    { label: 'الاستفسار عن العقيقة', action: 'aqiqa' },
    { label: 'الاستفسار عن النذر', action: 'nazar' },
    { label: 'الاستفسار عن الكفارة', action: 'kafar' },
    { label: 'التواصل مع الدعم', action: 'support' },
  ],
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('adahi_chat_open');
    if (stored === 'true') setIsOpen(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('adahi_chat_open', isOpen.toString());
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    if ((text.includes('@') && text.includes('.')) || /^\d[\d\-+()\[\]\s]{6,}$/.test(text.replace(/\s/g, ''))) {
      try {
        const res = await fetch('/api/chat/order-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text }),
        });
        const data = await res.json();

        if (data.found && data.orders.length > 0) {
          if (data.orders.length === 1) {
            const order = data.orders[0];
            let responseText = `تم العثور على طلبك ✅\n\nرقم الطلب: ${order.orderNumber}\nحالة التوثيق: ${order.statusText}`;
            const links: { label: string; url: string }[] = [];
            if (order.hasMedia || order.proofStatus === 'READY' || order.proofStatus === 'VIEWED' || order.proofStatus === 'MEDIA_UPLOADED') {
              responseText += '\n\nتوثيق طلبكم جاهز للمشاهدة.';
              links.push({ label: 'مشاهدة التوثيق', url: order.proofUrl });
            } else {
              responseText += '\n\nتم العثور على طلبكم، وجاري تجهيز التوثيق. سيتم إتاحة الصور والفيديوهات فور اكتمال الرفع.';
            }
            setMessages(prev => [...prev, { role: 'bot', text: responseText, links }]);
          } else {
            const responseText = `وجدت أكثر من طلب مرتبط بهذه البيانات. اختر الطلب الذي ترغب بمتابعته.`;
            const buttons = data.orders.map((o: OrderResult) => ({
              label: `رقم ${o.orderNumber} - ${o.proofStatus === 'CANCELLED' ? 'ملغي' : o.proofStatus === 'PENDING' ? 'قيد التحضير' : o.proofStatus === 'IN_PROGRESS' ? 'قيد التنفيذ' : 'جاهز'}`,
              action: `select_order:${o.orderNumber}:${o.proofUrl}:${o.hasMedia}:${o.proofStatus}`,
            }));
            setMessages(prev => [...prev, { role: 'bot', text: responseText, buttons }]);
          }
        } else {
          setMessages(prev => [
            ...prev,
            {
              role: 'bot',
              text: data.message || 'لم أجد طلبًا مرتبطًا بهذه البيانات. تأكد من رقم الطلب أو الجوال أو البريد الإلكتروني وحاول مرة أخرى.',
              buttons: [
                { label: 'المحاولة مرة أخرى', action: 'retry' },
                { label: 'التواصل مع الدعم', action: 'support' },
              ],
            },
          ]);
        }
      } catch {
        setMessages(prev => [...prev, { role: 'bot', text: 'حدث خطأ، حاول مرة أخرى', buttons: [{ label: 'حاول مرة أخرى', action: 'retry' }] }]);
      }
    } else {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: 'فضلاً أدخل رقم الطلب أو رقم الجوال أو البريد الإلكتروني المرتبط بالطلب.\n\nمثال:\n- 1027\n- 05XXXXXXXX (داخل السعودية)\n- 9715XXXXXXXX (خارج السعودية بدون + أو 00)',
          inputs: [{ placeholder: 'أدخل رقم الطلب أو الجوال أو الإيميل', action: 'lookup' }],
        },
      ]);
    }
    setIsLoading(false);
  };

  const handleButton = (action: string) => {
    if (action === 'track') {
      sendMessage('تتبع الطلب');
    } else if (action === 'view_proof') {
      sendMessage('مشاهدة التوثيق');
    } else if (action === 'aqeela') {
      setMessages(prev => [
        ...prev,
        { role: 'user', text: 'الاستفسار عن الأضحية' },
        {
          role: 'bot',
          text: 'الأضحية تُذبح في أيام النحر تقرّبًا إلى الله، ويمكنك طلبها من متجر أضحيتي ومتابعة التوثيق بعد التنفيذ.',
          buttons: [
            { label: 'طلب الخدمة من المتجر', action: 'shop' },
            { label: 'التواصل مع الدعم', action: 'support' },
          ],
        },
      ]);
    } else if (action === 'aqiqa') {
      setMessages(prev => [
        ...prev,
        { role: 'user', text: 'الاستفسار عن العقيقة' },
        {
          role: 'bot',
          text: 'العقيقة ذبيحة تُذبح شكرًا لله عن المولود، ويمكنك طلبها من متجر أضحيتي ومتابعة التوثيق بعد اكتمال التنفيذ.',
          buttons: [
            { label: 'طلب الخدمة من المتجر', action: 'shop' },
            { label: 'التواصل مع الدعم', action: 'support' },
          ],
        },
      ]);
    } else if (action === 'nazar') {
      setMessages(prev => [
        ...prev,
        { role: 'user', text: 'الاستفسار عن النذر' },
        {
          role: 'bot',
          text: 'النذر يكون بحسب ما أوجبه الشخص على نفسه، ويمكنك طلب تنفيذ الذبيحة من متجر أضحيتي ومتابعة التوثيق بعد اكتمال التنفيذ.',
          buttons: [
            { label: 'طلب الخدمة من المتجر', action: 'shop' },
            { label: 'التواصل مع الدعم', action: 'support' },
          ],
        },
      ]);
    } else if (action === 'kafar') {
      setMessages(prev => [
        ...prev,
        { role: 'user', text: 'الاستفسار عن الكفارة' },
        {
          role: 'bot',
          text: 'الكفارة تختلف حسب سببها وحكمها، وللتأكد من الحكم الشرعي التفصيلي يُفضّل الرجوع لأهل العلم. ويمكنك طلب الخدمة المتاحة من متجر أضحيتي.',
          buttons: [
            { label: 'طلب الخدمة من المتجر', action: 'shop' },
            { label: 'التواصل مع الدعم', action: 'support' },
          ],
        },
      ]);
    } else if (action === 'support') {
      window.open('https://api.whatsapp.com/send?phone=966562365161&text=', '_blank');
      setMessages(prev => [...prev, { role: 'bot', text: 'تم فتح محادثة واتساب معنا!' }]);
    } else if (action === 'shop') {
      window.open('https://odheyati.com', '_blank');
      setMessages(prev => [...prev, { role: 'bot', text: 'تم توجيهك إلى متجر أضحيتي 🌿' }]);
    } else if (action === 'retry') {
      setMessages(prev => [WELCOME_MESSAGE]);
    } else if (action.startsWith('select_order:')) {
      const parts = action.split(':');
      const proofUrl = parts[2];
      const hasMedia = parts[3] === 'true';
      const proofStatus = parts[4];
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: hasMedia || proofStatus === 'READY' || proofStatus === 'VIEWED' || proofStatus === 'MEDIA_UPLOADED'
            ? 'توثيق هذا الطلب جاهز للمشاهدة.'
            : 'تم العثور على طلبكم، وجاري تجهيز التوثيق.',
          links: [{ label: 'مشاهدة التوثيق', url: proofUrl }],
        },
      ]);
    } else if (action === 'lookup') {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: 'فضلاً أدخل رقم الطلب أو رقم الجوال أو البريد الإلكتروني المرتبط بالطلب.',
          inputs: [{ placeholder: 'أدخل رقم الطلب أو الجوال أو الإيميل', action: 'lookup' }],
        },
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue.trim());
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 group"
        aria-label="مساعد أضحيتي"
      >
        <span className="absolute bottom-full left-0 mb-2 px-3 py-1 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          مساعد أضحيتي
        </span>
        <span className="flex items-center justify-center w-14 h-14 rounded-full shadow-lg pulse-animation" style={{ backgroundColor: '#973131' }}>
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </span>
        <style>{`
          @keyframes pulse-ring {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1.5); opacity: 0; }
          }
          .pulse-animation::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background-color: #973131;
            animation: pulse-ring 1.5s ease-out infinite;
            z-index: -1;
          }
        `}</style>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-80 sm:w-96" style={{ direction: 'rtl' }}>
      <div className="rounded-xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#fefcf8', border: '2px solid #dca47c' }}>
        <div className="p-3 flex items-center justify-between" style={{ backgroundColor: '#973131' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🌿</span>
            <span className="font-semibold text-white">مساعد أضحيتي</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMinimized(!isMinimized)} className="text-white hover:text-gray-200 p-1" aria-label="تصغير">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 p-1" aria-label="إغلاق">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="h-72 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-gray-100 text-gray-800' : 'text-white'}`} style={msg.role === 'bot' ? { backgroundColor: '#973131' } : {}}>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                    {msg.buttons && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.buttons.map((btn, j) => (
                          <button key={j} onClick={() => handleButton(btn.action)} className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors" style={{ backgroundColor: '#dca47c', color: '#973131' }}>
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.links && (
                      <div className="mt-3">
                        {msg.links.map((lnk, j) => (
                          <a key={j} href={lnk.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs px-3 py-1.5 rounded-full font-medium text-white transition-colors" style={{ backgroundColor: '#917e69' }}>
                            {lnk.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-end">
                  <div className="rounded-lg p-3" style={{ backgroundColor: '#973131' }}>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-3 border-t" style={{ borderColor: '#dca47c' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="اكتب رسالة..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-right"
                  style={{ backgroundColor: '#fff', border: '1px solid #dca47c', color: '#333' }}
                  dir="rtl"
                />
                <button type="submit" className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors" style={{ backgroundColor: '#973131' }} disabled={isLoading}>
                  إرسال
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}