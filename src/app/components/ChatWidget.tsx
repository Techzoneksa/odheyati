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

interface ServiceCard {
  title: string;
  description: string;
  buttonLabel: string;
  url: string;
}

interface Message {
  role: 'bot' | 'user';
  text: string;
  buttons?: { label: string; action: string; isWhatsApp?: boolean }[];
  links?: { label: string; url: string }[];
  serviceCards?: ServiceCard[];
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
  | 'show_service_cards'
  | 'livestock_types'
  | 'goat_sheep_question'
  | 'distribution_country'
  | 'delivery_inside_saudi'
  | 'execution_location'
  | 'meat_delivery_or_receiving'
  | 'small_talk'
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
    'الوو',
  ];
  if (exactGreetings.some(p => cleanText === p || cleanText.startsWith(p + ' '))) {
    return 'greeting';
  }

  if (lower.includes('كيف الحال') || lower.includes('كيف حالك') ||
    lower.includes('كيفك') || lower.includes('كيفكم') ||
    lower.includes('وش اخبارك') || lower.includes('وش أخبارك') ||
    lower.includes('ايش اخبارك') || lower.includes('إيش أخبارك') ||
    lower.includes('اخبارك') || lower.includes('أخبارك') ||
    lower.includes('علومك') || lower.includes('وش علومك') ||
    lower.includes('طمني عنك') ||
    lower.includes('عامل ايه') || lower.includes('عاملين ايه') ||
    lower.includes('كيف الأمور') || lower.includes('كيف الامور') ||
    lower.includes('كيف الوضع') ||
    lower.includes('تمام') || lower.includes('تمام؟') ||
    lower.includes('الحمد لله') ||
    lower.includes('هلا كيفك') || lower.includes('مرحبا كيفك') ||
    cleanText === 'كيفك' || cleanText === 'كيف الحال' || cleanText === 'كيف حالك' ||
    cleanText === 'بخير' || cleanText === 'الحمد لله') {
    return 'small_talk';
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
    lower.includes('كيف اشتري') || lower.includes('كيف أشتري') ||
    lower.includes('كيف الشراء') || lower.includes('كيف الطلب') ||
    lower.includes('طريقة الطلب') || lower.includes('طريقة الشراء') ||
    lower.includes('كيف اسوي طلب') || lower.includes('كيف أسوي طلب') ||
    lower.includes('ابغى اشتري') || lower.includes('اريد اشتري') ||
    lower.includes('الطلب من وين') || lower.includes('من وين اطلب') ||
    lower.includes('رابط الطلب') || lower.includes('رابط المتجر') ||
    lower.includes('ادخل المتجر') || lower.includes('وين المتجر') ||
    lower.includes('اطلب الآن') || lower.includes('اطلب الان') ||
    lower.includes('طلب خدمة') ||
    lower.includes('وش خدماتكم') || lower.includes('وش الخدمات') ||
    lower.includes('ايش الخدمات') || lower.includes('وش خدمات') ||
    lower.includes('ماهي الخدمات') || lower.includes('ما هي الخدمات') ||
    lower.includes('الخدمات') || lower.includes('الخدمة') ||
    lower.includes('الخدمة من وين') || lower.includes('خدم من وين') ||
    lower.includes('أبغى خدمة') || lower.includes('أبي خدمة') ||
    lower.includes('أبغى أضحية') || lower.includes('أبي أضحية') ||
    lower.includes('أبغى عقيقة') || lower.includes('أبي عقيقة') ||
    lower.includes('أبغى نذر') || lower.includes('أبي نذر') ||
    lower.includes('أبغى كفارة') || lower.includes('أبي كفارة') ||
    lower.includes('ابغى اضحية') || lower.includes('ابي اضحية') ||
    lower.includes('طلب من المتجر') || lower.includes('اطلب من المتجر') ||
    lower.includes('عندكم أضحية') || lower.includes('عندكم اضحية') ||
    lower.includes('عندكم عقيقة') || lower.includes('عندكم نذر') || lower.includes('عندكم كفارة') ||
    cleanText === 'اطلب' || cleanText === 'الطلب' ||
    cleanText === 'شراء' || cleanText === 'الشراء') {
    return 'show_service_cards';
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

  if (lower.includes('انواع المواشي') || lower.includes('أنواع المواشي') ||
    lower.includes('وش المواشي') || lower.includes('ايش المواشي') || lower.includes('إيش المواشي') ||
    lower.includes('نوع الذبيحة') || lower.includes('انواع الذبائح') || lower.includes('أنواع الذبائح') ||
    lower.includes('وش الذبائح') || lower.includes('ايش الذبائح') || lower.includes('إيش الذبائح') ||
    lower.includes('نوع الاضحية') || lower.includes('نوع الأضحية') ||
    lower.includes('وش المتوفر') || lower.includes('ايش المتوفر') || lower.includes('إيش المتوفر') ||
    lower.includes('المتوفر من المواشي') || lower.includes('المتوفر من الذبائح') ||
    lower.includes('تيس') || lower.includes('تيوس') || lower.includes('تويس') || lower.includes('التويس') ||
    lower.includes('خروف') || lower.includes('خرفان') ||
    lower.includes('غنم') || lower.includes('ماعز') ||
    lower.includes('سواكني') || lower.includes('بربري') || lower.includes('حري') || lower.includes('نعيمي') ||
    lower.includes('ذبحة') || lower.includes('ذبائح') ||
    lower.includes('الأغنام') || lower.includes('الاغنام') ||
    lower.includes('عندكم تيس') || lower.includes('عندكم تيوس') ||
    lower.includes('عندكم خروف') || lower.includes('عندكم خرفان') ||
    lower.includes('عندكم غنم') || lower.includes('عندكم ماعز')) {
    return 'livestock_types';
  }

  if (lower.includes('هل عندكم تيس') ||
    lower.includes('ابي تيس') || lower.includes('أبي تيس') || lower.includes('ابغى تيس') || lower.includes('أبغى تيس') || lower.includes('اريد تيس') || lower.includes('أريد تيس') ||
    lower.includes('تيس صومالي') || lower.includes('تيس افريقي') || lower.includes('تيس أفريقي') ||
    lower.includes('هل عندكم خروف') ||
    lower.includes('ابي خروف') || lower.includes('أبي خروف') || lower.includes('ابغى خروف') || lower.includes('أبغى خروف') ||
    lower.includes('ابي غنم') || lower.includes('أبي غنم') ||
    lower.includes('ابي ماعز') || lower.includes('أبي ماعز')) {
    return 'goat_sheep_question';
  }

  if (lower.includes('في اي بلد') || lower.includes('في أي بلد') ||
    lower.includes('اي بلد') || lower.includes('أي بلد') ||
    lower.includes('وين التوزيع') || lower.includes('فين التوزيع') ||
    lower.includes('أين التوزيع') || lower.includes('اين التوزيع') ||
    lower.includes('وين التسليم') || lower.includes('فين التسليم') ||
    lower.includes('أين التسليم') || lower.includes('اين التسليم') ||
    lower.includes('بلد التوزيع') || lower.includes('دولة التوزيع') ||
    lower.includes('بلد التسليم') || lower.includes('دولة التسليم') ||
    lower.includes('بلد التنفيذ') || lower.includes('دولة التنفيذ') ||
    lower.includes('التوزيع فين') || lower.includes('التوزيع وين') ||
    lower.includes('التسليم فين') || lower.includes('التسليم وين') ||
    lower.includes('توزعون فين') || lower.includes('توزعون وين') ||
    lower.includes('تسلمون فين') || lower.includes('تسلمون وين') ||
    lower.includes('وين توزعون') || lower.includes('فين توزعون') ||
    lower.includes('أين توزعون') || lower.includes('اين توزعون') ||
    lower.includes('وين توزعين') || lower.includes('فين توزعين') ||
    lower.includes('أين توزعين') || lower.includes('اين توزعين') ||
    lower.includes('وين تسلمون') || lower.includes('فين تسلمون') ||
    lower.includes('أين تسلمون') || lower.includes('اين تسلمون') ||
    lower.includes('مكان التوزيع') || lower.includes('موقع التوزيع') ||
    lower.includes('مكان التسليم') || lower.includes('موقع التسليم') ||
    lower.includes('لمن توزعون') || lower.includes('على مين توزعون') ||
    lower.includes('لمن تسلمون') || lower.includes('على مين تسلمون') ||
    lower.includes('المستفيدين') || lower.includes('المستفيد') ||
    lower.includes('توزيع افريقيا') || lower.includes('توزيع أفريقيا') ||
    lower.includes('توزعون في افريقيا') || lower.includes('توزعون في أفريقيا') ||
    lower.includes('تنفيذ في افريقيا') || lower.includes('تنفيذ في أفريقيا') ||
    lower.includes('بلد افريقي') || lower.includes('بلد أفريقي') ||
    lower.includes('الدولة') || lower.includes('اي دولة') || lower.includes('أي دولة') ||
    lower.includes('خارج السعودية') || lower.includes('خارج المملكة') ||
    lower.includes('التوزيع خارج المملكة') || lower.includes('التنفيذ خارج المملكة') ||
    lower.includes('وين تروح اللحوم') || lower.includes('فين تروح اللحوم') ||
    lower.includes('وين تروح الذبيحة') || lower.includes('فين تروح الذبيحة') ||
    lower.includes('اللحم يروح وين') || lower.includes('اللحم يروح لفين') ||
    lower.includes('هل التوزيع داخل السعودية') || lower.includes('هل التوزيع داخل المملكة') ||
    lower.includes('هل التسليم داخل السعودية') || lower.includes('هل التسليم داخل المملكة')) {
    return 'distribution_country';
  }

  if (lower.includes('توصيل') ||
    lower.includes('توصيل داخل المملكة') || lower.includes('توصيل داخل السعودية') ||
    lower.includes('توصيل بالسعودية') || lower.includes('توصيل للمملكة') ||
    lower.includes('هل يوجد توصيل') || lower.includes('هل عندكم توصيل') || lower.includes('في توصيل') || lower.includes('فيه توصيل') ||
    lower.includes('توصلون') || lower.includes('توصلون داخل السعودية') || lower.includes('توصلون داخل المملكة') ||
    lower.includes('توصيل للبيت') || lower.includes('توصيل للمنزل') || lower.includes('توصيل للعميل') ||
    lower.includes('توصيل لحوم') || lower.includes('توصيل الذبيحة') || lower.includes('توصيل اللحم') ||
    lower.includes('توصلون اللحم') || lower.includes('توصلون الذبيحة') ||
    lower.includes('توصلون للبيت') || lower.includes('توصلون المنزل') || lower.includes('توصلون للعنوان') || lower.includes('توصلون لعنواني') ||
    lower.includes('توصيل جدة') || lower.includes('توصيل مكة') || lower.includes('توصيل مكه') ||
    lower.includes('توصيل الرياض') || lower.includes('توصيل المدينة') || lower.includes('توصيل المدينة المنورة') ||
    lower.includes('توصيل الدمام') || lower.includes('توصيل الخبر') || lower.includes('توصيل الظهران') ||
    lower.includes('توصيل الطائف') || lower.includes('توصيل أبها') || lower.includes('توصيلابها') ||
    lower.includes('توصيل خميس مشيط') || lower.includes('توصيل جازان') || lower.includes('توصيل جيزان') ||
    lower.includes('توصيل نجران') || lower.includes('توصيل تبوك') || lower.includes('توصيل حائل') ||
    lower.includes('توصيل القصيم') || lower.includes('توصيل بريدة') || lower.includes('توصيل عنيزة') ||
    lower.includes('توصيل الخرج') || lower.includes('توصيل ينبع') || lower.includes('توصيل رابغ') ||
    lower.includes('توصيل الباحة') || lower.includes('توصيل عرعر') || lower.includes('توصيل سكاكا') ||
    lower.includes('توصيل القريات') || lower.includes('توصيل حفر الباطن') || lower.includes('توصيل الأحساء') || lower.includes('توصيل الاحساء') ||
    lower.includes('توصيل الهفوف') || lower.includes('توصيل القطيف') || lower.includes('توصيل الجبيل') ||
    lower.includes('توصيل بيشة') || lower.includes('توصيل محايل') || lower.includes('توصيل القنفذة') ||
    lower.includes('توصيل الليث') || lower.includes('توصيل وادي الدواسر') || lower.includes('توصيل الدوادمي') ||
    lower.includes('توصيل المجمعة') || lower.includes('توصيل الزلفي') || lower.includes('توصيل الرس') ||
    lower.includes('توصيل الوجه') || lower.includes('توصيل ضباء') || lower.includes('توصيل العلا') ||
    lower.includes('توصيل رفحاء') || lower.includes('توصيل طريف') || lower.includes('توصيل شرورة') ||
    lower.includes('توصيل صبيا') || lower.includes('توصيل أحد رفيدة') || lower.includes('توصيل احد رفيدة') ||
    lower.includes('داخل جدة') || lower.includes('داخل مكة') || lower.includes('داخل مكه') || lower.includes('داخل الرياض') ||
    lower.includes('داخل الدمام') || lower.includes('داخل المدينة') || lower.includes('داخل الطائف') ||
    lower.includes('داخل أبها') || lower.includes('داخلابها') || lower.includes('داخل المدينة المنورة') ||
    lower.includes('داخل جازان') || lower.includes('داخل نجران') || lower.includes('داخل تبوك') ||
    lower.includes('داخل القصيم') || lower.includes('داخل حائل') ||
    lower.includes('مناطق المملكة') || lower.includes('كل مناطق المملكة') || lower.includes('جميع مناطق المملكة') ||
    lower.includes('مدن المملكة') || lower.includes('مناطق السعودية') || lower.includes('كل السعودية') ||
    lower.includes('جدة') || lower.includes('مكة') || lower.includes('مكه') ||
    lower.includes('الرياض') || lower.includes('المدينة') || lower.includes('المدينة المنورة') ||
    lower.includes('الدمام') || lower.includes('الخبر') || lower.includes('الظهران') ||
    lower.includes('الطائف') || lower.includes('أبها') || lower.includes('ابها') ||
    lower.includes('خميس مشيط') || lower.includes('جازان') || lower.includes('جيزان') ||
    lower.includes('نجران') || lower.includes('تبوك') || lower.includes('حائل') ||
    lower.includes('القصيم') || lower.includes('بريدة') || lower.includes('عنيزة') ||
    lower.includes('الخرج') || lower.includes('ينبع') || lower.includes('رابغ') ||
    lower.includes('الباحة') || lower.includes('عرعر') || lower.includes('سكاكا') ||
    lower.includes('القريات') || lower.includes('حفر الباطن') || lower.includes('الأحساء') || lower.includes('الاحساء') ||
    lower.includes('الهفوف') || lower.includes('القطيف') || lower.includes('الجبيل') ||
    lower.includes('بيشة') || lower.includes('محايل') || lower.includes('القنفذة') ||
    lower.includes('الليث') || lower.includes('وادي الدواسر') || lower.includes('الدوادمي') ||
    lower.includes('المجمعة') || lower.includes('الزلفي') || lower.includes('الرس') ||
    lower.includes('الوجه') || lower.includes('ضباء') || lower.includes('العلا') ||
    lower.includes('رفحاء') || lower.includes('طريف') || lower.includes('شرورة') ||
    lower.includes('صبيا') || lower.includes('أحد رفيدة') || lower.includes('احد رفيدة') ||
    lower.includes('الشحن') || lower.includes('شحن اللحم') || lower.includes('شحن الذبيحة') ||
    lower.includes('تشحنون اللحم') || lower.includes('تشحنون الذبيحة') ||
    lower.includes('ترسلون اللحم') || lower.includes('ترسلون الذبيحة') ||
    lower.includes('تغليف اللحم') ||
    lower.includes('استلام من الفرع') || lower.includes('اخذ من الفرع') || lower.includes('أخذ من الفرع') ||
    lower.includes('وين استلم') || lower.includes('فين استلم') || lower.includes('أين أستلم') || lower.includes('اين استلم') ||
    lower.includes('وين استلم اللحم') || lower.includes('فين استلم اللحم') || lower.includes('أين أستلم اللحم') || lower.includes('اين استلم اللحم') ||
    lower.includes('وين استلم الذبيحة') || lower.includes('فين استلم الذبيحة') || lower.includes('أين أستلم الذبيحة') || lower.includes('اين استلم الذبيحة') ||
    lower.includes('جدة') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم')) ||
    lower.includes('مكة') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم')) ||
    lower.includes('الرياض') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم')) ||
    lower.includes('الدمام') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم')) ||
    lower.includes('المدينة') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم')) ||
    lower.includes('الطائف') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم')) ||
    lower.includes('أبها') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم')) ||
    lower.includes('جازان') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم')) ||
    lower.includes('تبوك') && (lower.includes('توصل') || lower.includes('توصيل') || lower.includes('استلم') || lower.includes('أستلم'))) {
    return 'delivery_inside_saudi';
  }

  if (lower.includes('التنفيذ داخل السعودية') || lower.includes('التنفيذ خارج السعودية') ||
    lower.includes('وين التنفيذ') || lower.includes('فين التنفيذ') ||
    lower.includes('أين التنفيذ') || lower.includes('اين التنفيذ') ||
    lower.includes('مكان التنفيذ') || lower.includes('مكان الذبح') ||
    lower.includes('وين الذبح') || lower.includes('فين الذبح') ||
    lower.includes('أين الذبح') || lower.includes('اين الذبح') ||
    lower.includes('تذبحون وين') || lower.includes('تذبحون فين') ||
    lower.includes('تذبحون داخل السعودية') || lower.includes('تذبحون خارج السعودية') ||
    lower.includes('هل الذبح في السعودية') || lower.includes('هل الذبح خارج السعودية') ||
    lower.includes('بلد التنفيذ') || lower.includes('دولة التنفيذ')) {
    return 'execution_location';
  }

  if (lower.includes('استلام اللحم') || lower.includes('استلم اللحم') ||
    lower.includes('استلام الذبيحة') || lower.includes('استلم الذبيحة') ||
    lower.includes('اخذ اللحم') || lower.includes('أخذ اللحم') ||
    lower.includes('ابي اللحم') || lower.includes('أبي اللحم') || lower.includes('ابغى اللحم') || lower.includes('أبغى اللحم') ||
    lower.includes('توصلون اللحم') || lower.includes('ترسلون اللحم') || lower.includes('تشحنون اللحم') ||
    lower.includes('هل استلم اللحم') || lower.includes('هل أستلم اللحم') ||
    lower.includes('هل يوصلني اللحم') || lower.includes('اللحم يوصل') || lower.includes('اللحم عندي') ||
    lower.includes('توصيل اللحم') || lower.includes('توصيل الذبيحة') ||
    lower.includes('هل اللحم يوصل السعودية') || lower.includes('هل الذبيحة توصل السعودية') ||
    lower.includes('ابغى الذبيحة عندي') || lower.includes('أبغى الذبيحة عندي') ||
    lower.includes('ابغى أستلم اللحم') || lower.includes('أبي أستلم اللحم')) {
    return 'meat_delivery_or_receiving';
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

const WHATSAPP_ICON = '/icons/whatsapp-svgrepo-com.svg';
const PRODUCTS_URL = 'https://odheyati.com/ar/%D8%A7%D9%84%D9%85%D9%86%D8%AA%D8%AC%D8%A7%D8%AA/c1947708130';
const WHATSAPP_URL = 'https://api.whatsapp.com/send?phone=966562365161&text=';

const MAIN_OPTIONS = [
  { label: 'تتبع الطلب', action: 'track' },
  { label: 'مشاهدة التوثيق', action: 'view_proof' },
  { label: 'طلب خدمة من المتجر', action: 'store' },
  { label: 'واتساب', action: 'support', isWhatsApp: true },
];

const SERVICE_REPLIES: Record<string, { text: string; buttonLabel: string }> = {
  service_udhiya: {
    text: 'خدمة الأضحية متاحة عبر متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
    buttonLabel: 'اطلب الأضحية',
  },
  service_aqiqah: {
    text: 'خدمة العقيقة متاحة عبر متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
    buttonLabel: 'اطلب العقيقة',
  },
  service_nadhr: {
    text: 'خدمة النذر متاحة عبر متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
    buttonLabel: 'اطلب النذر',
  },
  service_kaffarah: {
    text: 'خدمة الكفارة متاحة عبر متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
    buttonLabel: 'اطلب الكفارة',
  },
  store_order: {
    text: 'يمكنك طلب الخدمة مباشرة من متجر أضحيتي، ويمكنك الطلب بسهولة مع توثيق بالصوت والصورة بعد التنفيذ.',
    buttonLabel: 'اطلب من المتجر',
  },
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingLookup, setAwaitingLookup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        { label: reply.buttonLabel, action: 'shop' },
        { label: 'واتساب', action: 'support', isWhatsApp: true },
      ],
    }]);
  };

  const showUnknown = () => {
    setMessages(prev => [...prev, {
      role: 'bot',
      text: 'أقدر أساعدك في متابعة الطلب، مشاهدة التوثيق، أو طلب خدمات أضحيتي من المتجر. اختر ما يناسبك من الخيارات التالية.',
      buttons: MAIN_OPTIONS,
    }]);
  };

  const showServiceCards = () => {
    setMessages(prev => [...prev, {
      role: 'bot',
      text: 'اختر الخدمة التي ترغب بطلبها من متجر أضحيتي:',
      serviceCards: [
        {
          title: 'الأضحية',
          description: 'خدمة الأضحية متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.',
          buttonLabel: 'اطلب الأضحية',
          url: PRODUCTS_URL,
        },
        {
          title: 'العقيقة',
          description: 'خدمة العقيقة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.',
          buttonLabel: 'اطلب العقيقة',
          url: PRODUCTS_URL,
        },
        {
          title: 'النذر',
          description: 'خدمة النذر متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.',
          buttonLabel: 'اطلب النذر',
          url: PRODUCTS_URL,
        },
        {
          title: 'الكفارة',
          description: 'خدمة الكفارة متاحة عبر متجر أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.',
          buttonLabel: 'اطلب الكفارة',
          url: PRODUCTS_URL,
        },
      ],
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
  };

  const showSmallTalk = () => {
    setMessages(prev => [...prev, {
      role: 'bot',
      text: 'بخير ونعمة، حيّاك الله في أضحيتي 🌿\nكيف نقدر نساعدك اليوم؟',
      buttons: MAIN_OPTIONS,
    }]);
    setIsOpen(true);
  };

  const showFAQResponse = (intent: string) => {
    const faqResponses: Record<string, { text: string; buttons: { label: string; action: string; isWhatsApp?: boolean }[] }> = {
      charity_or_commercial: {
        text: 'نحن شركة سعودية مرخصة ومسجلة بسجل تجاري رقم 7052388860، ولسنا جهة خيرية ولا نجمع تبرعات. نقدم خدماتنا ضمن إطار تجاري موثوق يشمل طلب الذبائح وتنفيذها وتوثيقها حسب الخدمة المختارة.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      official_store_trust: {
        text: 'متجر أضحيتي الإلكتروني موثق ومعتمد لدى المركز السعودي للأعمال، شهادة رقم 0000129587. نحن شركة سعودية رسمية بسجل تجاري رقم 7052388860، ونوفر تجربة شراء آمنة وموثوقة مع توثيق الطلب بعد التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      prices: {
        text: 'يمكنك الاطلاع على الأسعار والخدمات المتاحة مباشرة من متجر أضحيتي، حيث تظهر لك تفاصيل كل خدمة قبل إتمام الطلب. جميع الطلبات تتم عبر المتجر بشكل واضح وآمن.',
        buttons: [
          { label: 'عرض الأسعار في المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      how_to_order: {
        text: 'يمكنك طلب الخدمة مباشرة من متجر أضحيتي عبر الرابط التالي. اختر الخدمة المناسبة، أكمل بيانات الطلب، وسيتم تنفيذ الطلب مع توثيق بالصوت والصورة بعد اكتمال التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      execution_process: {
        text: 'بعد إتمام الطلب، يتم تجهيز الذبيحة وفق الخيارات التي يحددها العميل، ثم تنفيذ عملية الذبح بإشراف مختص. بعد ذلك يتم توزيع اللحوم حسب نوع الخدمة المختارة، مع توثيق كامل لجميع المراحل.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'تتبع الطلب', action: 'track' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      execution_duration: {
        text: 'مدة تنفيذ الطلب تصل إلى 10 أيام. ويمكنك متابعة حالة الطلب من خلال رقم الطلب أو الجوال أو البريد الإلكتروني المرتبط بالطلب.',
        buttons: [
          { label: 'تتبع الطلب', action: 'track' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      proof_delivery: {
        text: 'فور الانتهاء من جميع مراحل التوثيق، يتم إرسال التقرير إلى رقم الواتساب الخاص بكم في ملف PDF مرتب وواضح. ويمكنك أيضًا متابعة التوثيق من خلال رقم الطلب أو الجوال أو البريد الإلكتروني.',
        buttons: [
          { label: 'تتبع الطلب', action: 'track' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      edit_cancel: {
        text: 'يمكن طلب التعديل أو الإلغاء قبل بدء تنفيذ الطلب. أما بعد بدء التنفيذ، فلا يمكن الإلغاء نظرًا لارتباط الخدمة بإجراءات تشغيلية مباشرة. للتأكد من حالة طلبك يمكنك التواصل عبر واتساب.',
        buttons: [
          { label: 'واتساب', action: 'support', isWhatsApp: true },
          { label: 'تتبع الطلب', action: 'track' },
        ],
      },
      complaints: {
        text: 'نعتذر لك عن أي إزعاج، ويسعدنا خدمتك ومتابعة طلبك. يمكنك التواصل مباشرة مع الدعم عبر الواتساب، وسيتم مساعدتك بأقرب وقت.',
        buttons: [
          { label: 'واتساب', action: 'support', isWhatsApp: true },
          { label: 'تتبع الطلب', action: 'track' },
        ],
      },
      payment: {
        text: 'يتم إتمام الطلب والدفع من خلال متجر أضحيتي الإلكتروني بشكل آمن وواضح. إذا واجهتك مشكلة في الدفع أو الفاتورة، يمكنك التواصل معنا عبر واتساب لمساعدتك.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      services_available: {
        text: 'تتوفر في متجر أضحيتي خدمات متعددة مثل الأضحية، العقيقة، النذر، والكفارة، مع توثيق بالصوت والصورة بعد التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      location_execution: {
        text: 'يتم تنفيذ الطلبات حسب الخدمة المختارة وآلية التشغيل المعتمدة لدى أضحيتي، مع توثيق مراحل التنفيذ بالصوت والصورة بعد اكتمال الطلب.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      livestock_types: {
        text: 'المتوفر في متجر أضحيتي يعتمد على الخدمات المعروضة في صفحة الطلب، وتشمل خيارات من المواشي مثل التيوس والخرفان حسب المتاح في المتجر. يمكنك مشاهدة الأنواع والأسعار من صفحة المنتجات مباشرة.',
        buttons: [
          { label: 'عرض المنتجات', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      goat_sheep_question: {
        text: 'نعم، تتوفر خيارات من المواشي حسب المعروض في متجر أضحيتي، مثل التيوس والخرفان حسب توفرها في صفحة المنتجات. يمكنك اختيار الخدمة والنوع المناسب من المتجر مباشرة.',
        buttons: [
          { label: 'عرض المنتجات', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      distribution_country: {
        text: 'يتم تنفيذ وتوزيع الطلبات خارج المملكة، ويكون التوزيع في أفريقيا حسب آلية التشغيل المعتمدة لدى أضحيتي، مع توثيق مراحل التنفيذ بالصوت والصورة بعد اكتمال الطلب.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      delivery_inside_saudi: {
        text: 'خدمة أضحيتي الحالية ليست توصيل لحوم داخل المملكة. يتم تنفيذ وتوزيع الطلبات خارج المملكة، مع إرسال التوثيق بالصوت والصورة بعد التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      execution_location: {
        text: 'يتم تنفيذ الطلبات خارج المملكة، ويكون التنفيذ والتوزيع في أفريقيا حسب الخدمة المختارة وآلية التشغيل المعتمدة لدى أضحيتي، مع توثيق بالصوت والصورة بعد التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
      meat_delivery_or_receiving: {
        text: 'الخدمة لا تشمل توصيل اللحوم للعميل داخل المملكة. يتم تنفيذ وتوزيع الطلبات خارج المملكة، ويصلكم التوثيق بالصوت والصورة بعد اكتمال التنفيذ.',
        buttons: [
          { label: 'اطلب من المتجر', action: 'shop' },
          { label: 'واتساب', action: 'support', isWhatsApp: true },
        ],
      },
    };

    const response = faqResponses[intent];
    if (response) {
      setMessages(prev => [...prev, { role: 'bot', text: response.text, buttons: response.buttons }]);
    }
  };

  const buildSingleOrderResponse = (order: OrderResult): { text: string; links: { label: string; url: string }[]; buttons?: { label: string; action: string; isWhatsApp?: boolean }[] } => {
    const nameGreeting = order.customerName ? `حياك الله يا ${order.customerName} 🌿\n\n` : 'حياك الله 🌿\n\n';
    const body = `تم العثور على طلبك رقم ${order.orderNumber}.\n`;

    if (order.proofStatus === 'CANCELLED') {
      return {
        text: `${nameGreeting}${body}طلبك ظاهر لدينا كطلب ملغي. للتفاصيل، يمكنك التواصل معنا عبر واتساب.`,
        links: [],
        buttons: [{ label: 'واتساب', action: 'support', isWhatsApp: true }],
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
        buttons: [{ label: 'واتساب', action: 'support', isWhatsApp: true }],
      };
    }

    if (order.proofStatus === 'IN_PROGRESS') {
      return {
        text: `${nameGreeting}${body}طلبك قيد التنفيذ حاليًا، وسيتم تحديث التوثيق عند اكتماله.\nبعد اكتمال التنفيذ ورفع التوثيق، سيظهر لك زر مشاهدة التوثيق مباشرة.`,
        links: [],
        buttons: [{ label: 'واتساب', action: 'support', isWhatsApp: true }],
      };
    }

    if (order.proofStatus === 'SLAUGHTERED') {
      return {
        text: `${nameGreeting}${body}تم تنفيذ الذبح، وجاري تجهيز التوثيق ورفع الملفات.\nسيظهر لك زر مشاهدة التوثيق عند اكتمال الرفع.`,
        links: [],
        buttons: [{ label: 'واتساب', action: 'support', isWhatsApp: true }],
      };
    }

    return {
      text: `${nameGreeting}${body}طلبك موجود لدينا، وجاري تجهيز التوثيق حاليًا.\nسيظهر لك رابط مشاهدة التوثيق فور اكتمال رفع الصور أو الفيديوهات.`,
      links: [],
      buttons: [{ label: 'واتساب', action: 'support', isWhatsApp: true }],
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
      showServiceCards();
    } else if (action === 'support') {
      window.open(WHATSAPP_URL, '_blank');
      setMessages(prev => [...prev, { role: 'bot', text: 'تم فتح محادثة واتساب معنا! 🌿', buttons: MAIN_OPTIONS }]);
    } else if (action === 'shop') {
      window.open(PRODUCTS_URL, '_blank');
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
      const body = `تم العثور على طلبك رقم ${orderNumber}.\n`;

      let responseText = nameGreeting + body;
      let links: { label: string; url: string }[] = [];
      let buttons: { label: string; action: string; isWhatsApp?: boolean }[] | undefined;

      if (proofStatus === 'CANCELLED') {
        responseText += 'طلبك ظاهر لدينا كطلب ملغي. للتفاصيل، يمكنك التواصل معنا عبر واتساب.';
        buttons = [{ label: 'واتساب', action: 'support', isWhatsApp: true }];
      } else if (hasMedia || proofStatus === 'READY' || proofStatus === 'VIEWED' || proofStatus === 'MEDIA_UPLOADED') {
        responseText += 'توثيق طلبك جاهز للمشاهدة ✅\nيمكنك الآن مشاهدة الصور والفيديوهات الخاصة بطلبك.';
        links = [{ label: 'مشاهدة التوثيق', url: proofUrl }];
      } else if (proofStatus === 'PENDING') {
        responseText += 'طلبك موجود لدينا، وجاري التحضير للتنفيذ.\nبعد اكتمال التنفيذ ورفع التوثيق، سيظهر لك زر مشاهدة التوثيق مباشرة.';
        buttons = [{ label: 'واتساب', action: 'support', isWhatsApp: true }];
      } else if (proofStatus === 'IN_PROGRESS') {
        responseText += 'طلبك قيد التنفيذ حاليًا، وسيتم تحديث التوثيق عند اكتماله.\nبعد اكتمال التنفيذ ورفع التوثيق، سيظهر لك زر مشاهدة التوثيق مباشرة.';
        buttons = [{ label: 'واتساب', action: 'support', isWhatsApp: true }];
      } else if (proofStatus === 'SLAUGHTERED') {
        responseText += 'تم تنفيذ الذبح، وجاري تجهيز التوثيق ورفع الملفات.\nسيظهر لك زر مشاهدة التوثيق عند اكتمال الرفع.';
        buttons = [{ label: 'واتساب', action: 'support', isWhatsApp: true }];
      } else {
        responseText += 'طلبك موجود لدينا، وجاري تجهيز التوثيق حاليًا.\nسيظهر لك رابط مشاهدة التوثيق فور اكتمال رفع الصور أو الفيديوهات.';
        buttons = [{ label: 'واتساب', action: 'support', isWhatsApp: true }];
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

      console.log('CHAT_INTENT', { intent, textLength: text.length, textPreview: text.substring(0, 30) });

      if (intent === 'lookup_input' || awaitingLookup) {
        performLookup(text);
        return;
      }

      const callAIReply = async (msgText: string) => {
        console.log('CHAT_UNKNOWN_CALL_AI_START', { msgLength: msgText.length });
        setMessages(prev => [...prev, { role: 'bot', text: 'جاري كتابة الرد...', buttons: [] }]);
        try {
          const res = await fetch('/api/chat/ai-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msgText }),
          });
          const data = await res.json();

          setMessages(prev => {
            const filtered = prev.filter(m => !(m.role === 'bot' && m.text === 'جاري كتابة الرد...'));
            const reply = data.reply || 'أقدر أساعدك في متابعة الطلب، مشاهدة التوثيق، أو طلب خدمات أضحيتي من المتجر.';
            const buttons = data.buttons || MAIN_OPTIONS;
            console.log('CHAT_UNKNOWN_CALL_AI_SUCCESS', { replyLength: reply.length });
            return [...filtered, { role: 'bot', text: reply, buttons }];
          });
        } catch (err) {
          console.error('CHAT_UNKNOWN_CALL_AI_ERROR', { message: err instanceof Error ? err.message : 'unknown' });
          setMessages(prev => {
            const filtered = prev.filter(m => !(m.role === 'bot' && m.text === 'جاري كتابة الرد...'));
            return [...filtered, { role: 'bot', text: 'أقدر أساعدك في متابعة الطلب، مشاهدة التوثيق، أو طلب خدمات أضحيتي من المتجر. اختر ما يناسبك من الخيارات التالية.', buttons: MAIN_OPTIONS }];
          });
        }
      };

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
        case 'show_service_cards':
          showServiceCards();
          break;
        case 'livestock_types':
        case 'goat_sheep_question':
        case 'distribution_country':
        case 'delivery_inside_saudi':
        case 'execution_location':
        case 'meat_delivery_or_receiving':
          showFAQResponse(intent);
          break;
        case 'small_talk':
          showSmallTalk();
          break;
        case 'unknown':
          callAIReply(text);
          break;
        default:
          callAIReply(text);
      }
    } catch (error) {
      console.error('CHAT_SEND_ERROR', error);
      setMessages(prev => [...prev, { role: 'bot', text: 'حدث خطأ بسيط، حاول مرة أخرى.' }]);
    }
  };

  const ADATHI_RED = '#973131';
  const ADATHI_GOLD = '#dca47c';
  const ADATHI_BROWN = '#917e69';
  const ADATHI_CREAM_BG = '#fff8f2';
  const BOT_BUBBLE = '#ffffff';
  const USER_BUBBLE = '#f5ede0';
  const WIDGET_BG = '#faf6f1';
  const INPUT_BG = '#f0ece4';

  if (!isOpen) {
    return (
      <div style={{ position: 'fixed', zIndex: 50, left: '12px', bottom: '20px' }}>
        <button
          onClick={openChat}
          style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          aria-label="مساعد أضحيتي"
        >
          <span style={{
            position: 'absolute',
            bottom: '100%',
            marginBottom: '8px',
            right: 0,
            paddingLeft: '10px',
            paddingRight: '10px',
            paddingTop: '6px',
            paddingBottom: '6px',
            fontSize: '13px',
            borderRadius: '8px',
            backgroundColor: '#333',
            color: '#fff',
            whiteSpace: 'nowrap',
            opacity: 0,
            transform: 'translateY(4px)',
            transition: 'opacity 0.2s, transform 0.2s',
            pointerEvents: 'none',
            fontFamily: 'inherit',
          }} className="adahi-fab-tooltip">
            مساعد أضحيتي
          </span>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: ADATHI_RED,
            boxShadow: '0 4px 16px rgba(151,49,49,0.4)',
            position: 'relative',
          }} className="adahi-pulse-ring">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16ZM7 12H17V14H7V12ZM7 9H17V11H7V9ZM7 6H17V8H7V6Z" fill="white"/>
            </svg>
          </span>
        </button>
        <style>{`
          @keyframes adahi-pulse-anim {
            0% { box-shadow: 0 0 0 0 rgba(151,49,49,0.5); }
            70% { box-shadow: 0 0 0 14px rgba(151,49,49,0); }
            100% { box-shadow: 0 0 0 0 rgba(151,49,49,0); }
          }
          .adahi-pulse-ring {
            animation: adahi-pulse-anim 2s ease-out infinite;
          }
          .adahi-pulse-ring:hover {
            animation: none;
            transform: scale(1.05);
            transition: transform 0.2s;
          }
          button:hover .adahi-fab-tooltip {
            opacity: 1 !important;
            transform: translateY(0) !important;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      zIndex: 50,
      left: '12px',
      right: '12px',
      bottom: '20px',
      maxWidth: 'min(400px, calc(100vw - 24px))',
      width: '100%',
      direction: 'rtl',
      overflow: 'hidden',
    }}>
      <div style={{
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'min(70vh, 600px)',
        backgroundColor: WIDGET_BG,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          backgroundColor: ADATHI_RED,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              aria-label="إغلاق"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}>
                🌿
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px', fontFamily: 'inherit' }}>مساعد أضحيتي</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontFamily: 'inherit' }}>نحن هنا لمساعدتك</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            aria-label="تصغير"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>

        {!isMinimized && (
          <>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minHeight: 0,
              maxHeight: 'min(55vh, 480px)',
              backgroundColor: WIDGET_BG,
            }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                }}>
                  <div style={{
                    maxWidth: '85%',
                    borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    padding: '10px 12px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    backgroundColor: msg.role === 'user' ? USER_BUBBLE : BOT_BUBBLE,
                    color: '#333',
                    fontFamily: 'inherit',
                  }}>
                    <p style={{
                      fontSize: '13px',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line',
                      margin: 0,
                    }}>{msg.text}</p>
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {msg.buttons.map((btn, j) => (
                          <button
                            key={j}
                            onClick={() => handleButton(btn.action)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 600,
                              fontFamily: 'inherit',
                              backgroundColor: btn.isWhatsApp ? '#25D366' : ADATHI_RED,
                              color: '#fff',
                              border: 'none',
                              cursor: 'pointer',
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                              maxWidth: '100%',
                              transition: 'opacity 0.15s',
                            }}
                          >
                            {btn.isWhatsApp && (
                              <img src={WHATSAPP_ICON} alt="" width="14" height="14" style={{ display: 'inline-block', flexShrink: 0 }} />
                            )}
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.links && msg.links.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        {msg.links.map((lnk, j) => (
                          <a
                            key={j}
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              padding: '5px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: ADATHI_GOLD,
                              color: '#fff',
                              textDecoration: 'none',
                              fontFamily: 'inherit',
                            }}
                          >
                            {lnk.label}
                          </a>
                        ))}
                      </div>
                    )}
                    {msg.serviceCards && msg.serviceCards.length > 0 && (
                      <div style={{
                        marginTop: '10px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '8px',
                      }}>
                        {msg.serviceCards.map((card, j) => (
                          <a
                            key={j}
                            href={card.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'block',
                              padding: '10px',
                              borderRadius: '12px',
                              backgroundColor: '#fff',
                              textDecoration: 'none',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                            }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: 700, color: ADATHI_RED, marginBottom: '4px', fontFamily: 'inherit' }}>{card.title}</div>
                            <div style={{ fontSize: '11px', color: '#666', lineHeight: 1.5, marginBottom: '8px', fontFamily: 'inherit', overflowWrap: 'anywhere' }}>{card.description}</div>
                            <div style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              textAlign: 'center',
                              padding: '5px',
                              borderRadius: '16px',
                              color: '#fff',
                              backgroundColor: ADATHI_RED,
                              fontFamily: 'inherit',
                            }}>{card.buttonLabel}</div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ borderRadius: '12px', padding: '10px 14px', backgroundColor: '#fff' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[0, 150, 300].map(delay => (
                        <span key={delay} style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: '#ccc',
                          animation: 'bounce 1s ease-in-out infinite',
                          animationDelay: `${delay}ms`,
                          display: 'block',
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '10px 12px',
                backgroundColor: INPUT_BG,
                flexShrink: 0,
              }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="اكتب رسالة..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '24px',
                  border: 'none',
                  fontSize: '13px',
                  color: '#333',
                  backgroundColor: '#fff',
                  outline: 'none',
                  fontFamily: 'inherit',
                  direction: 'rtl',
                  minWidth: 0,
                  boxSizing: 'border-box',
                }}
                dir="rtl"
              />
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: '9px 16px',
                  borderRadius: '24px',
                  backgroundColor: isLoading ? ADATHI_BROWN : ADATHI_RED,
                  color: '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  transition: 'background-color 0.2s',
                }}
              >
                إرسال
              </button>
            </form>
          </>
        )}
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}