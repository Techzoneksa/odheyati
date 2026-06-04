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
}

type Intent =
  | 'greeting'
  | 'order_tracking'
  | 'service_udhiya'
  | 'service_aqiqah'
  | 'service_nadhr'
  | 'service_kaffarah'
  | 'store_order'
  | 'support'
  | 'lookup_input'
  | 'charity_or_commercial'
  | 'official_store_trust'
  | 'prices'
  | 'how_to_order'
  | 'execution_process'
  | 'execution_duration'
  | 'proof_delivery'
  | 'edit_cancel'
  | 'complaints'
  | 'payment'
  | 'services_available'
  | 'location_execution'
  | 'unknown';

function toDigits(str: string): string {
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  let result = str;
  for (let i = 0; i < arabic.length; i++) {
    result = result.split(arabic[i]).join(String(i));
  }
  return result.replace(/[\s\-()+[\]]/g, '');
}

function isEmailQuery(text: string): boolean {
  return text.includes('@') && text.includes('.');
}

function isNumericQuery(text: string): boolean {
  const digits = toDigits(text);
  return /^\d{7,}$/.test(digits);
}

function detectIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();

  if (isEmailQuery(text) || isNumericQuery(text)) {
    return 'lookup_input';
  }

  const cleanText = lower.replace(/[.!؟?،,]/g, '').trim();
  const exactGreetings = [
    'السلام عليكم', 'عليكم السلام', 'سلام عليكم', 'وعليكم السلام',
    'هلا', 'هلا والله', 'هلاا', 'هلا هلو',
    'مرحبا', 'مرحباً', 'مرحب',
    'أهلًا', 'اهلا', 'اهلاا',
    'صباح الخير', 'مساء الخير',
    'حياك', 'حياك الله', 'حيكم',
    'الو', 'هاي', 'hoy', 'hi', 'hello',
    'كيفك', 'كيف حالك', 'عاملين ايه', 'الوو',
  ];
  if (exactGreetings.some(p => cleanText === p || cleanText.startsWith(p + ' '))) {
    return 'greeting';
  }

  if (lower.includes('جهة خيرية') || lower.includes('خيرية') || lower.includes('جمعية') ||
    lower.includes('تبرع') || lower.includes('تبرعات') || lower.includes('متبرع') ||
    lower.includes('صدقة') || lower.includes('صدقات') || lower.includes('زكاة') || lower.includes('زكاه') ||
    lower.includes('وقف') || lower.includes('اوقاف') || lower.includes('أوقاف') ||
    lower.includes('احسان') || lower.includes('إحسان') ||
    lower.includes('منصة خيرية') || lower.includes('جمعية خيرية') ||
    lower.includes('هل انتم جمعية') || lower.includes('هل أنتم جمعية') ||
    lower.includes('هل انتم جهة خيرية') || lower.includes('هل أنتم جهة خيرية') ||
    lower.includes('هل تجمعون تبرعات') || lower.includes('هل تستقبلون تبرعات') ||
    lower.includes('هل هذا تبرع') || lower.includes('هل المبلغ تبرع') ||
    lower.includes('تبرعون') || lower.includes('تبرعوها') ||
    lower.includes('محتاجين') || lower.includes('مساكين') || lower.includes('فقراء') ||
    lower.includes('خيري') ||
    lower.includes('خيرية ولا تجارية') || lower.includes('شركة ولا جمعية') ||
    lower.includes('شركة تجارية') || lower.includes('متجر تجاري') ||
    lower.includes('هل انتم شركة') || lower.includes('هل أنتم شركة') ||
    lower.includes('هل عندكم تصريح تبرعات') || lower.includes('تصريح تبرع') || lower.includes('ترخيص تبرعات')) {
    return 'charity_or_commercial';
  }

  if (lower.includes('موثق') || lower.includes('توثيق المتجر') || lower.includes('المتجر موثق') ||
    lower.includes('رسمي') || lower.includes('معتمد') || lower.includes('ثقة') || lower.includes('موثوق') ||
    lower.includes('مضمون') || lower.includes('آمن') || lower.includes('امن') ||
    lower.includes('هل المتجر رسمي') || lower.includes('هل المتجر موثق') ||
    lower.includes('هل انتم موثقين') || lower.includes('هل أنتم موثقين') ||
    lower.includes('هل انتم رسميين') || lower.includes('هل أنتم رسميين') ||
    lower.includes('سجل تجاري') || lower.includes('السجل التجاري') || lower.includes('رقم السجل') ||
    lower.includes('اعطني السجل') || lower.includes('أعطني السجل') || lower.includes('وين السجل') ||
    lower.includes('رقم السجل التجاري') ||
    lower.includes('شهادة توثيق') || lower.includes('رقم التوثيق') || lower.includes('شهادة المركز السعودي') ||
    lower.includes('المركز السعودي للأعمال') || lower.includes('شهادة المركز السعودي') ||
    lower.includes('تصريح') || lower.includes('ترخيص') || lower.includes('رخصة') ||
    lower.includes('هل عندكم رخصة') || lower.includes('هل عندكم ترخيص') || lower.includes('هل عندكم سجل') ||
    lower.includes('اثبات') || lower.includes('إثبات') || lower.includes('كيف اثق') || lower.includes('كيف أثق') ||
    lower.includes('هل الموقع آمن') || lower.includes('هل الدفع آمن') || lower.includes('هل الطلب مضمون') ||
    lower.includes('هل في ضمان') || lower.includes('هل انتم نصابين') || lower.includes('هل الموقع حقيقي') ||
    lower.includes('هل المتجر حقيقي') || lower.includes('ارفع شكوى')) {
    return 'official_store_trust';
  }

  if (lower.includes('السعر') || lower.includes('اسعار') || lower.includes('أسعار') ||
    lower.includes('كم السعر') || lower.includes('كم سعر') || lower.includes('بكم') ||
    lower.includes('كم التكلفة') || lower.includes('التكلفة') || lower.includes('تكلفة') ||
    lower.includes('كم قيمة') || lower.includes('قيمة الطلب') ||
    lower.includes('كم قيمة الاضحية') || lower.includes('كم قيمة الأضحية') ||
    lower.includes('كم العقيقة') || lower.includes('سعر العقيقة') ||
    lower.includes('سعر النذر') || lower.includes('سعر الكفارة') || lower.includes('سعر الذبيحة') ||
    lower.includes('بكم الذبيحة') || lower.includes('بكم الاضحية') || lower.includes('بكم الأضحية') ||
    lower.includes('العروض') || lower.includes('عرض') || lower.includes('خصم') ||
    lower.includes('كود خصم') || lower.includes('هل فيه خصم') || lower.includes('هل عندكم عروض') ||
    lower.includes('ارخص') || lower.includes('أرخص') || lower.includes('غالي') || lower.includes('غالية') ||
    lower.includes('كم ادفع') || lower.includes('كم الدفع') || lower.includes('الدفع') ||
    lower.includes('هل السعر شامل') || lower.includes('ضريبة') || lower.includes('الضريبة')) {
    return 'prices';
  }

  if (lower.includes('كيف اطلب') || lower.includes('كيف أطلب') ||
    lower.includes('ابي اطلب') || lower.includes('أبي أطلب') ||
    lower.includes('ابغى اطلب') || lower.includes('أبغى أطلب') ||
    lower.includes('اريد اطلب') || lower.includes('أريد أطلب') ||
    lower.includes('طريقة الطلب') || lower.includes('كيف اسوي طلب') || lower.includes('كيف أسوي طلب') ||
    lower.includes('كيف اشتري') || lower.includes('كيف أشتري') ||
    lower.includes('الطلب من وين') || lower.includes('من وين اطلب') ||
    lower.includes('رابط الطلب') || lower.includes('رابط المتجر') ||
    lower.includes('ادخل المتجر') || lower.includes('وين المتجر') ||
    lower.includes('اطلب الآن') || lower.includes('اطلب الان') ||
    lower.includes('طلب خدمة') ||
    (lower.includes('ابي') && (lower.includes('اضحية') || lower.includes('أضحية') || lower.includes('عقيقة') || lower.includes('نذر') || lower.includes('كفارة') || lower.includes('ذبيحة'))) ||
    (lower.includes('أبي') && (lower.includes('أضحية') || lower.includes('عقيقة') || lower.includes('نذر') || lower.includes('كفارة'))) ||
    lower.includes('اضحية') || lower.includes('أضحية') ||
    lower.includes('عقيقة') || lower.includes('نذر') || lower.includes('كفارة') || lower.includes('ذبيحة')) {
    return 'how_to_order';
  }

  if (lower.includes('آلية التنفيذ') || lower.includes('الية التنفيذ') ||
    lower.includes('كيف التنفيذ') || lower.includes('كيف يتم التنفيذ') ||
    lower.includes('كيف تنفذون') || lower.includes('طريقة التنفيذ') ||
    lower.includes('مراحل التنفيذ') || lower.includes('بعد الطلب ايش يصير') ||
    lower.includes('بعد الطلب وش') || lower.includes('وش يصير بعد الطلب') ||
    lower.includes('ايش يصير بعد الطلب') || lower.includes('كيف تذبحون') ||
    lower.includes('كيف يتم الذبح') || lower.includes('التنفيذ كيف') || lower.includes('تنفيذ الطلب') ||
    lower.includes('الذبح') || lower.includes('التوزيع') || lower.includes('توزيع اللحوم') ||
    lower.includes('مين ينفذ') || lower.includes('من ينفذ') ||
    lower.includes('اشراف') || lower.includes('إشراف') || lower.includes('مختص') ||
    lower.includes('موثق بالصوت والصورة') || lower.includes('التوثيق كامل') ||
    lower.includes('خطوات الطلب') || lower.includes('خطوات التنفيذ')) {
    return 'execution_process';
  }

  if (lower.includes('كم يستغرق') || lower.includes('مدة التنفيذ') ||
    lower.includes('متى التنفيذ') || lower.includes('متى يتم التنفيذ') ||
    lower.includes('كم يوم') || lower.includes('كم مدة') || lower.includes('كم مدة الطلب') ||
    lower.includes('متى يجهز') || lower.includes('متى يوصل') || lower.includes('متى يخلص') ||
    lower.includes('متى ينفذ') || lower.includes('متى يتم الذبح') ||
    lower.includes('متى التوثيق') || lower.includes('مدة التوثيق') || lower.includes('كم يوم التوثيق') ||
    lower.includes('تأخير') || lower.includes('تاخير') || lower.includes('تأخر الطلب') || lower.includes('تاخر الطلب') ||
    lower.includes('ليش تأخر') || lower.includes('ليش تاخر') || lower.includes('لماذا تأخر') ||
    lower.includes('كم باقي') || lower.includes('متى يخلص') || lower.includes('متى ترسلون') ||
    lower.includes('متى التقرير') || lower.includes('كم ياخذ وقت') || lower.includes('كم تستغرق الخدمة')) {
    return 'execution_duration';
  }

  if (lower.includes('استلام التوثيق') || lower.includes('كيف استلم') || lower.includes('كيف استلم التوثيق') ||
    lower.includes('كيف يوصلي') || lower.includes('كيف يوصلني') || lower.includes('وين التوثيق') ||
    lower.includes('تقرير PDF') || lower.includes('pdf') || lower.includes('ملف PDF') ||
    lower.includes('هل ترسلون التوثيق') || lower.includes('توثيق صوت وصورة') ||
    lower.includes('الصوت والصورة') || lower.includes('الواتساب') || lower.includes('واتساب') ||
    lower.includes('يرسل واتساب') || lower.includes('ترسلون واتساب') ||
    lower.includes('الفيديو') || lower.includes('فيديو') || lower.includes('الصورة') || lower.includes('الصور') ||
    lower.includes('رابط التوثيق') || lower.includes('توثيق الطلب') ||
    lower.includes('كيف اشوف الفيديو') || lower.includes('كيف أشوف الفيديو') ||
    lower.includes('فين الفيديو') || lower.includes('وين الفيديو') ||
    lower.includes('متى الفيديو') || lower.includes('متى الصور') ||
    lower.includes('التوثيق ما وصل') || lower.includes('ما وصلني التوثيق') ||
    lower.includes('ما وصل التقرير') || lower.includes('ما وصلني التقرير') ||
    lower.includes('وصلوني التوثيق') || lower.includes('ارسلوا التوثيق') || lower.includes('أرسلوا التوثيق')) {
    return 'proof_delivery';
  }

  if (lower.includes('تعديل الطلب') || lower.includes('الغاء الطلب') || lower.includes('إلغاء الطلب') ||
    lower.includes('الغاء') || lower.includes('إلغاء') ||
    lower.includes('اقدر الغي') || lower.includes('أقدر ألغي') ||
    lower.includes('اقدر اعدل') || lower.includes('أقدر أعدل') ||
    lower.includes('تغيير الطلب') || lower.includes('استرجاع') || lower.includes('استرداد') ||
    lower.includes('استرجع المبلغ') || lower.includes('ارجاع المبلغ') || lower.includes('إرجاع المبلغ') ||
    lower.includes('استبدال') || lower.includes('تغيير الاسم') || lower.includes('تغيير الرقم') ||
    lower.includes('تغيير النية') || lower.includes('تعديل البيانات') ||
    lower.includes('غلطت في الطلب') || lower.includes('اخطأت') || lower.includes('أخطأت') ||
    lower.includes('كتبت غلط') || lower.includes('الطلب غلط') ||
    lower.includes('ابي اغير') || lower.includes('أبي أغير') ||
    lower.includes('ابي الغي') || lower.includes('أبي ألغي') ||
    lower.includes('قبل التنفيذ') || lower.includes('بعد التنفيذ') ||
    lower.includes('بدأ التنفيذ') || lower.includes('بدء التنفيذ')) {
    return 'edit_cancel';
  }

  if (lower.includes('شكوى') || lower.includes('شكاوى') || lower.includes('اشتكي') || lower.includes('أشتكي') ||
    lower.includes('ابي اشتكي') || lower.includes('أبي أشتكي') ||
    lower.includes('مشكلة') || lower.includes('عندي مشكلة') || lower.includes('فيها مشكلة') ||
    lower.includes('خدمة العملاء') || lower.includes('الدعم') || lower.includes('الدعم الفني') ||
    lower.includes('ما ردوا') || lower.includes('ما احد رد') || lower.includes('ما أحد رد') ||
    lower.includes('تأخير') || lower.includes('تاخير') || lower.includes('ما وصل') || lower.includes('ما وصلني') ||
    lower.includes('غلط') || lower.includes('خطأ') || lower.includes('خطا') || lower.includes('سيء') || lower.includes('سيئة') ||
    lower.includes('زعلان') || lower.includes('غير راضي') || lower.includes('مو راضي') ||
    lower.includes('استفسار') || lower.includes('تواصل') || lower.includes('اتصلوا علي') || lower.includes('اتصلو علي') ||
    lower.includes('رقم الدعم') || lower.includes('رقم الواتس') ||
    lower.includes('الواتساب') || lower.includes('واتس') || lower.includes('واتساب') ||
    lower.includes('خدمة سيئة') || lower.includes('ارفع شكوى')) {
    return 'complaints';
  }

  if (lower.includes('الدفع') || lower.includes('طريقة الدفع') || lower.includes('طرق الدفع') ||
    lower.includes('كيف ادفع') || lower.includes('كيف أدفع') ||
    lower.includes('مدى') || lower.includes('فيزا') || lower.includes('ماستر') || lower.includes('ابل باي') ||
    lower.includes('Apple Pay') || lower.includes('تحويل') || lower.includes('حوالة') ||
    lower.includes('دفع آمن') || lower.includes('الدفع آمن') ||
    lower.includes('فشل الدفع') || lower.includes('مشكلة دفع') ||
    lower.includes('خصم المبلغ') || lower.includes('انخصم المبلغ') || lower.includes('تم الخصم') ||
    lower.includes('الدفع ما تم') || lower.includes('ما قدرت ادفع') ||
    lower.includes('رابط دفع') || lower.includes('فاتورة') || lower.includes('الفاتورة') ||
    lower.includes('إيصال') || lower.includes('ايصال')) {
    return 'payment';
  }

  if (lower.includes('الخدمات') || lower.includes('خدماتكم') || lower.includes('وش خدماتكم') ||
    lower.includes('ايش خدماتكم') || lower.includes('إيش خدماتكم') ||
    lower.includes('ماهي الخدمات') || lower.includes('ما هي الخدمات') ||
    lower.includes('الخدمات المتاحة') || lower.includes('وش تقدمون') || lower.includes('ايش تقدمون') ||
    lower.includes('عندكم اضحية') || lower.includes('عندكم أضحية') ||
    lower.includes('عندكم عقيقة') || lower.includes('عندكم نذر') || lower.includes('عندكم كفارة') ||
    lower.includes('ذبيحة') || lower.includes('ذبائح')) {
    return 'services_available';
  }

  if (lower.includes('أين التنفيذ') || lower.includes('اين التنفيذ') || lower.includes('وين التنفيذ') ||
    lower.includes('مكان التنفيذ') || lower.includes('فين التنفيذ') ||
    lower.includes('في أي دولة') || lower.includes('الدولة') ||
    lower.includes('أفريقيا') || lower.includes('افريقيا') ||
    lower.includes('داخل السعودية') || lower.includes('خارج السعودية') ||
    lower.includes('وين تذبحون') || lower.includes('فين تذبحون') ||
    lower.includes('مكان الذبح') || lower.includes('موقع الذبح') ||
    lower.includes('توزيع وين') || lower.includes('وين التوزيع') ||
    lower.includes('خارج المملكة') || lower.includes('داخل المملكة')) {
    return 'location_execution';
  }

  const trackingPatterns = [
    'تتبع', 'تتبع الطلب', 'تابع الطلب', 'متابعة الطلب',
    'حالة طلبي', 'حالة الطلب', 'وين طلبي', 'فين طلبي',
    'توثيق طلبي', 'مشاهدة التوثيق',
    'وصل التوثيق', 'ما وصل التوثيق',
    'حالة التوثيق', 'ابي اشوف طلبي', 'أبي أشوف طلبي',
    'ابي التوثيق', 'أبي التوثيق',
    'اوردر', 'أوردر', 'order',
  ];
  if (trackingPatterns.some(p => lower.includes(p))) {
    return 'order_tracking';
  }

  if (lower.includes('اضحي') || lower.includes('أضحي') || lower.includes('أضحية') || lower.includes('اضحية')) {
    return 'service_udhiya';
  }
  if (lower.includes('عقيقة') || lower.includes('عقيدة')) {
    return 'service_aqiqah';
  }
  if (lower.includes('نذر') || lower.includes('نذور')) {
    return 'service_nadhr';
  }
  if (lower.includes('كفارة') || lower.includes('كفارات')) {
    return 'service_kaffarah';
  }

  const storePatterns = ['ابي اطلب', 'كيف اطلب', 'اطلب من المتجر', 'المتجر', 'خدم', 'خدمات', 'ذبيحة'];
  if (storePatterns.some(p => lower.includes(p))) {
    return 'store_order';
  }

  if (lower.includes('دعم') || lower.includes('واتساب') || lower.includes('whatsapp') || lower.includes('تواصل')) {
    return 'support';
  }

  return 'unknown';
}

const MAIN_OPTIONS = [
  { label: 'تتبع الطلب', action: 'track' },
  { label: 'مشاهدة التوثيق', action: 'view_proof' },
  { label: 'طلب خدمة من المتجر', action: 'store' },
  { label: '🟢 واتساب', action: 'support' },
];

const SERVICE_REPLIES: Record<string, { text: string }> = {
  service_udhiya: {
    text: 'خدمة الأضحية متاحة عبر متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
  },
  service_aqiqah: {
    text: 'خدمة العقيقة متاحة عبر متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
  },
  service_nadhr: {
    text: 'خدمة النذر متاحة عبر متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
  },
  service_kaffarah: {
    text: 'خدمة الكفارة متاحة عبر متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
  },
  store_order: {
    text: 'يمكنك طلب الخدمة مباشرة من متجر أضحيتي، وسيصلك التوثيق بالصوت والصورة بعد التنفيذ حسب حالة الطلب.',
  },
};

function playSoftPing() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // silently ignore if audio fails
  }
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingLookup, setAwaitingLookup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('adahi_chat_open');
    if (stored === 'true') setIsOpen(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('adahi_chat_open', isOpen.toString());
    if (isOpen) {
      setShowPopup(false);
      sessionStorage.setItem('adahi_popup_shown', 'true');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen || sessionStorage.getItem('adahi_popup_shown') === 'true') return;
    const timer = setTimeout(() => {
      setShowPopup(true);
      setTimeout(() => setPopupVisible(true), 30);
      playSoftPing();
    }, 2000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChat = () => {
    setMessages([{
      role: 'bot',
      text: 'السلام عليكم، حيّاك الله في أضحيتي 🌿\nكيف نقدر نساعدك؟',
      buttons: MAIN_OPTIONS,
    }]);
    setIsOpen(true);
    setPopupVisible(false);
    setTimeout(() => setShowPopup(false), 200);
    sessionStorage.setItem('adahi_popup_shown', 'true');
    sessionStorage.setItem('adahi_greeting_shown', 'true');
  };

  const showTrackingPrompt = () => {
    setMessages(prev => [...prev, {
      role: 'bot',
      text: 'فضلا أدخل رقم الطلب أو رقم الجوال أو البريد الإلكتروني المرتبط بالطلب.\nإذا كان رقمك خارج السعودية، اكتب مفتاح الدولة بدون + وبدون أصفار في البداية، مثل: 9715XXXXXXXX.',
      buttons: MAIN_OPTIONS,
    }]);
    setAwaitingLookup(true);
  };

  const showServiceResponse = (intent: string) => {
    const reply = SERVICE_REPLIES[intent];
    if (!reply) return;
    setMessages(prev => [...prev, {
      role: 'bot',
      text: reply.text,
      buttons: [
        { label: 'اطلب من المتجر', action: 'shop' },
        { label: '🟢 واتساب', action: 'support' },
      ],
    }]);
  };

  const showUnknown = () => {
    setMessages(prev => [...prev, { role: 'bot',
      text: 'أقدر أساعدك في متابعة الطلب، مشاهدة التوثيق، أو طلب خدمات أضحيتي من المتجر. اختر ما يناسبك من الخيارات التالية.',
      buttons: MAIN_OPTIONS,
    }]);
  };

const showGreeting = () => {
    const alreadyGreeted = sessionStorage.getItem('adahi_greeting_shown') === 'true';
    if (alreadyGreeted) {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'حياك الله 🌿\nكيف نقدر نساعدك؟',
        buttons: MAIN_OPTIONS,
      }]);
    } else {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'وعليكم السلام ورحمة الله 🌿\nحياك الله في أضحيتي، كيف نقدر نساعدك؟',
        buttons: MAIN_OPTIONS,
      }]);
      sessionStorage.setItem('adahi_greeting_shown', 'true');
    }
    setIsOpen(true);
    setPopupVisible(false);
    setTimeout(() => setShowPopup(false), 200);
    sessionStorage.setItem('adahi_popup_shown', 'true');
  };

  const showFAQResponse = (intent: string) => {
    const faqResponses: Record<string, { text: string; buttons: { label: string; action: string }[] }> = {
      charity_or_commercial: {
        text: 'نحن شركة سعودية مرخصة ومسجلة بسجل تجاري رقم 7052388860، ولسنا جهة خيرية ولا نجمع تبرعات. نقدم خدماتنا ضمن إطار تجاري موثوق يشمل طلب الذبائح وتنفيذها وتوثيقها حسب الخدمة المختارة.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
      official_store_trust: {
        text: 'متجر أضحيتي الإلكتروني موثق ومعتمد لدى المركز السعودي للأعمال، شهادة رقم 0000129587. نحن شركة سعودية رسمية بسجل تجاري رقم 7052388860، ونوفر تجربة شراء آمنة وموثوقة مع توثيق الطلب بعد التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
      prices: {
        text: 'يمكنك الاطلاع على الأسعار والخدمات المتاحة مباشرة من متجر أضحيتي، حيث تظهر لك تفاصيل كل خدمة قبل إتمام الطلب. جميع الطلبات تتم عبر المتجر بشكل واضح وآمن.',
        buttons: [
          { label: 'عرض الأسعار في المتجر', action: 'shop' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
      how_to_order: {
        text: 'يمكنك طلب الخدمة مباشرة من متجر أضحيتي عبر الرابط التالي. اختر الخدمة المناسبة، أكمل بيانات الطلب، وسيتم تنفيذ الطلب مع توثيق بالصوت والصورة بعد اكتمال التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
      execution_process: {
        text: 'بعد إتمام الطلب، يتم تجهيز الذبيحة وفق الخيارات التي يحددها العميل، ثم تنفيذ عملية الذبح بإشراف مختص. بعد ذلك يتم توزيع اللحوم حسب نوع الخدمة المختارة، مع توثيق كامل لجميع المراحل.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'تتبع الطلب', action: 'track' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
      execution_duration: {
        text: 'مدة تنفيذ الطلب تصل إلى 10 أيام. ويمكنك متابعة حالة الطلب من خلال رقم الطلب أو الجوال أو البريد الإلكتروني المرتبط بالطلب.',
        buttons: [
          { label: 'تتبع الطلب', action: 'track' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
      proof_delivery: {
        text: 'فور الانتهاء من جميع مراحل التوثيق، يتم إرسال التقرير إلى رقم الواتساب الخاص بكم في ملف PDF مرتب وواضح. ويمكنك أيضًا متابعة التوثيق من خلال رقم الطلب أو الجوال أو البريد الإلكتروني.',
        buttons: [
          { label: 'تتبع الطلب', action: 'track' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
edit_cancel: {
        text: 'يمكن طلب التعديل أو الإلغاء قبل بدء تنفيذ الطلب. أما بعد بدء التنفيذ، فلا يمكن الإلغاء نظرًا لارتباط الخدمة بإجراءات تشغيلية مباشرة. للتأكد من حالة طلبك يمكنك التواصل عبر واتساب.',
        buttons: [
          { label: '🟢 واتساب', action: 'support' },
          { label: 'تتبع الطلب', action: 'track' },
        ],
      },
      complaints: {
        text: 'نعتذر لك عن أي إزعاج، ويسعدنا خدمتك ومتابعة طلبك. يمكنك التواصل مباشرة مع الدعم عبر الواتساب، وسيتم مساعدتك بأقرب وقت.',
        buttons: [
          { label: '🟢 واتساب', action: 'support' },
          { label: 'تتبع الطلب', action: 'track' },
        ],
      },
      payment: {
        text: 'يتم إتمام الطلب والدفع من خلال متجر أضحيتي الإلكتروني بشكل آمن وواضح. إذا واجهتك مشكلة في الدفع أو الفاتورة، يمكنك التواصل معنا عبر واتساب لمساعدتك.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
      services_available: {
        text: 'تتوفر في متجر أضحيتي خدمات متعددة مثل الأضحية، العقيقة، النذر، والكفارة، مع توثيق بالصوت والصورة بعد التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
      location_execution: {
        text: 'يتم تنفيذ الطلبات حسب الخدمة المختارة وآلية التشغيل المعتمدة لدى أضحيتي، مع توثيق مراحل التنفيذ بالصوت والصورة بعد اكتمال الطلب.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: '🟢 واتساب', action: 'support' },
        ],
      },
    };

    const response = faqResponses[intent];
    if (response) {
      setMessages(prev => [...prev, { role: 'bot', text: response.text, buttons: response.buttons }]);
    }
  };

  const buildSingleOrderResponse = (order: OrderResult): { text: string; links: { label: string; url: string }[]; buttons?: { label: string; action: string }[] } => {
    const nameGreeting = order.customerName ? `حياك الله يا ${order.customerName} 🌿\n\n` : 'حياك الله 🌿\n\n';
    let body = `تم العثور على طلبك رقم ${order.orderNumber}.\n`;

if (order.proofStatus === 'CANCELLED') {
      return {
        text: `${nameGreeting}${body}طلبك ظاهر لدينا كطلب ملغي. للتفاصيل，你可以 التواصل معنا عبر واتساب.`,
        links: [],
        buttons: [{ label: '🟢 واتساب', action: 'support' }],
      };
    }

    if (order.hasMedia || order.proofStatus === 'READY' || order.proofStatus === 'VIEWED' || order.proofStatus === 'MEDIA_UPLOADED') {
      return {
        text: `${nameGreeting}${body}توثيق طلبك جاهز للمشاهدة ✅\nيمكنك الآن مشاهدة الصور والفيديوهات الخاصة بطلبك.`,
        links: [{ label: 'مشاهدة التوثيق', url: order.proofUrl }],
      };
    }

    if (order.proofStatus === 'PENDING') {
      return {
        text: `${nameGreeting}${body}طلبك موجود لدينا، وجاري التحضير للتنفيذ.\nبعد اكتمال التنفيذ ورفع التوثيق، سيظهر لك زر مشاهدة التوثيق مباشرة.`,
        links: [],
        buttons: [{ label: '🟢 واتساب', action: 'support' }],
      };
    }

    if (order.proofStatus === 'IN_PROGRESS') {
      return {
        text: `${nameGreeting}${body}طلبك قيد التنفيذ حاليًا، وسيتم تحديث التوثيق عند اكتماله.\nبعد اكتمال التنفيذ ورفع التوثيق، سيظهر لك زر مشاهدة التوثيق مباشرة.`,
        links: [],
        buttons: [{ label: '🟢 واتساب', action: 'support' }],
      };
    }

    if (order.proofStatus === 'SLAUGHTERED') {
      return {
        text: `${nameGreeting}${body}تم تنفيذ الذبح، وجاري تجهيز التوثيق ورفع الملفات.\nسيظهر لك زر مشاهدة التوثيق عند اكتمال الرفع.`,
        links: [],
        buttons: [{ label: '🟢 واتساب', action: 'support' }],
      };
    }

    return {
      text: `${nameGreeting}${body}طلبك موجود لدينا، وجاري تجهيز التوثيق حاليًا.\nسيظهر لك رابط مشاهدة التوثيق فور اكتمال رفع الصور أو الفيديوهات.`,
      links: [],
      buttons: [{ label: '🟢 واتساب', action: 'support' }],
    };
  };

  const performLookup = async (text: string) => {
    setIsLoading(true);
    setAwaitingLookup(false);

    try {
      const res = await fetch('/api/chat/order-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();

      if (data.found && data.orders.length > 0) {
        if (data.orders.length === 1) {
          const result = buildSingleOrderResponse(data.orders[0]);
          setMessages(prev => [...prev, { role: 'bot', text: result.text, links: result.links, buttons: result.buttons }]);
        } else {
          const firstName = data.orders[0].customerName || 'عميلنا';
          const greeting = `حياك الله يا ${firstName} 🌿`;
          const intro = 'وجدت أكثر من طلب مرتبط بهذه البيانات. اختر الطلب الذي ترغب بمتابعته.';
          const buttons = data.orders.map((o: OrderResult) => ({
            label: `رقم ${o.orderNumber} - ${o.proofStatus === 'CANCELLED' ? 'ملغي' : o.proofStatus === 'PENDING' ? 'قيد التحضير' : o.proofStatus === 'IN_PROGRESS' ? 'قيد التنفيذ' : 'جاهز'}`,
            action: `select_order:${o.orderNumber}:${o.proofUrl}:${o.hasMedia}:${o.proofStatus}:${o.customerName || ''}`,
          }));
          setMessages(prev => [...prev, { role: 'bot', text: `${greeting}\n${intro}`, buttons }]);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'bot',
            text: data.message || 'لم أجد طلبًا مرتبطًا بهذه البيانات. تأكد من رقم الطلب أو الجوال أو البريد الإلكتروني وحاول مرة أخرى.',
            buttons: MAIN_OPTIONS,
          },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'bot', text: 'حدث خطأ، حاول مرة أخرى', buttons: MAIN_OPTIONS },
      ]);
    }
    setIsLoading(false);
  };

  const handleButton = (action: string) => {
    if (action === 'track' || action === 'view_proof') {
      showTrackingPrompt();
    } else if (action === 'store') {
      window.open('https://odheyati.com', '_blank');
      setMessages(prev => [...prev, { role: 'bot', text: 'تم توجيهك إلى متجر أضحيتي 🌿', buttons: MAIN_OPTIONS }]);
    } else if (action === 'support') {
      window.open('https://api.whatsapp.com/send?phone=966562365161&text=', '_blank');
      setMessages(prev => [...prev, { role: 'bot', text: 'تم فتح محادثة واتساب معنا! 🌿', buttons: MAIN_OPTIONS }]);
    } else if (action === 'shop') {
      window.open('https://odheyati.com', '_blank');
      setMessages(prev => [...prev, { role: 'bot', text: 'تم توجيهك إلى متجر أضحيتي 🌿', buttons: MAIN_OPTIONS }]);
    } else if (action === 'retry') {
      showUnknown();
    } else if (action.startsWith('select_order:')) {
      const parts = action.split(':');
      const orderNumber = parts[1];
      const proofUrl = parts[2];
      const hasMedia = parts[3] === 'true';
      const proofStatus = parts[4];
      const customerName = parts[5] || '';

      const nameGreeting = customerName ? `حياك الله يا ${customerName} 🌿\n\n` : 'حياك الله 🌿\n\n';
      let body = `تم العثور على طلبك رقم ${orderNumber}.\n`;

      let responseText = nameGreeting + body;
      let links: { label: string; url: string }[] = [];
      let buttons: { label: string; action: string }[] | undefined;

if (proofStatus === 'CANCELLED') {
        responseText += 'طلبك ظاهر لدينا كطلب ملغي. للتفاصيل，你可以 التواصل معنا عبر واتساب.';
        buttons = [{ label: '🟢 واتساب', action: 'support' }];
      } else if (hasMedia || proofStatus === 'READY' || proofStatus === 'VIEWED' || proofStatus === 'MEDIA_UPLOADED') {
        responseText += 'توثيق طلبك جاهز للمشاهدة ✅\nيمكنك الآن مشاهدة الصور والفيديوهات الخاصة بطلبك.';
        links = [{ label: 'مشاهدة التوثيق', url: proofUrl }];
      } else if (proofStatus === 'PENDING') {
        responseText += 'طلبك موجود لدينا، وجاري التحضير للتنفيذ.\nبعد اكتمال التنفيذ ورفع التوثيق، سيظهر لك زر مشاهدة التوثيق مباشرة.';
        buttons = [{ label: '🟢 واتساب', action: 'support' }];
      } else if (proofStatus === 'IN_PROGRESS') {
        responseText += 'طلبك قيد التنفيذ حاليًا، وسيتم تحديث التوثيق عند اكتماله.\nبعد اكتمال التنفيذ ورفع التوثيق، سيظهر لك زر مشاهدة التوثيق مباشرة.';
        buttons = [{ label: '🟢 واتساب', action: 'support' }];
      } else if (proofStatus === 'SLAUGHTERED') {
        responseText += 'تم تنفيذ الذبح، وجاري تجهيز التوثيق ورفع الملفات.\nسيظهر لك زر مشاهدة التوثيق عند اكتمال الرفع.';
        buttons = [{ label: '🟢 واتساب', action: 'support' }];
      } else {
        responseText += 'طلبك موجود لدينا، وجاري تجهيز التوثيق حاليًا.\nسيظهر لك رابط مشاهدة التوثيق فور اكتمال رفع الصور أو الفيديوهات.';
        buttons = [{ label: '🟢 واتساب', action: 'support' }];
      }

      setMessages(prev => [...prev, { role: 'bot', text: responseText, links, buttons }]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const text = inputValue.trim();
      if (!text) return;

      setMessages(prev => [...prev, { role: 'user', text }]);
      setInputValue('');

      const intent = detectIntent(text);

      if (intent === 'lookup_input' || awaitingLookup) {
        performLookup(text);
        return;
      }

      switch (intent) {
        case 'greeting':
          showGreeting();
          break;
        case 'order_tracking':
          showTrackingPrompt();
          break;
        case 'service_udhiya':
        case 'service_aqiqah':
        case 'service_nadhr':
        case 'service_kaffarah':
        case 'store_order':
          showServiceResponse(intent);
          break;
        case 'support':
          handleButton('support');
          break;
        case 'charity_or_commercial':
        case 'official_store_trust':
        case 'prices':
        case 'how_to_order':
        case 'execution_process':
        case 'execution_duration':
        case 'proof_delivery':
        case 'edit_cancel':
        case 'complaints':
        case 'payment':
        case 'services_available':
        case 'location_execution':
          showFAQResponse(intent);
          break;
        case 'unknown':
          showUnknown();
          break;
        default:
          showUnknown();
      }
    } catch (error) {
      console.error('CHAT_SEND_ERROR', error);
      setMessages(prev => [...prev, { role: 'bot', text: 'حدث خطأ بسيط، حاول مرة أخرى.' }]);
    }
  };

  const dismissPopup = () => {
    setPopupVisible(false);
    setTimeout(() => setShowPopup(false), 200);
    sessionStorage.setItem('adahi_popup_shown', 'true');
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 left-6 z-50">
        {showPopup && (
          <div
            className={`absolute bottom-full left-0 mb-3 w-72 sm:w-80 rounded-xl shadow-lg overflow-hidden transition-all duration-200 ${popupVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            style={{ backgroundColor: '#fefcf8', border: '2px solid #dca47c', direction: 'rtl' }}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌿</span>
                  <span className="font-semibold text-sm" style={{ color: '#973131' }}>حيّاك الله في أضحيتي 🌿</span>
                </div>
                <button onClick={dismissPopup} className="text-gray-400 hover:text-gray-600 p-1" aria-label="إغلاق">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                تحتاج تتابع طلبك أو تستفسر عن خدماتنا؟ أنا هنا أساعدك.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={openChat}
                  className="flex-1 px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#973131' }}
                >
                  ابدأ المحادثة
                </button>
                <button
                  onClick={dismissPopup}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: '#dca47c', color: '#973131' }}
                >
                  مو الحين
                </button>
              </div>
            </div>
            <div className="absolute -bottom-2 left-6 w-4 h-4 rotate-45" style={{ backgroundColor: '#dca47c' }} />
          </div>
        )}
        <button
          onClick={openChat}
          className="relative group"
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
      </div>
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