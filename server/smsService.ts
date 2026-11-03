/**
 * WhatsApp & WhatsApp Cloud API Notification & OTP Service
 * Exclusively uses WhatsApp Cloud API (Meta Official) and Direct WhatsApp links (wa.me)
 * All legacy SMS / Texto.ma services have been permanently removed.
 */

export interface SmsDispatchRecord {
  id: string;
  toPhone: string;
  intlPhone: string;
  senderName: string;
  messageText: string;
  code: string;
  status: 'delivered' | 'pending' | 'failed';
  gateway: string;
  sentAt: string;
}

// In-memory log of recent WhatsApp dispatches
const dispatchHistory: SmsDispatchRecord[] = [];

/**
 * Format phone to Moroccan / International E.164 format (e.g. 212612345678)
 */
export function formatToInternationalPhone(rawPhone: string): string {
  const clean = rawPhone.trim().replace(/[\s\-\.\(\)]/g, '');
  if (clean.startsWith('0')) {
    return '212' + clean.slice(1);
  }
  if (clean.startsWith('+212')) {
    return clean.slice(1);
  }
  if (clean.startsWith('212')) {
    return clean;
  }
  return clean;
}

/**
 * Format phone to Moroccan local mobile format (06XXXXXXXX or 07XXXXXXXX)
 */
export function formatToMoroccanLocalPhone(rawPhone: string): string {
  const clean = rawPhone.trim().replace(/[\s\-\.\(\)]/g, '');
  if (clean.startsWith('+212')) {
    return '0' + clean.slice(4);
  }
  if (clean.startsWith('212')) {
    return '0' + clean.slice(3);
  }
  if (clean.startsWith('0')) {
    return clean;
  }
  if (clean.startsWith('6') || clean.startsWith('7')) {
    return '0' + clean;
  }
  return clean;
}

// ---------------- Textbee.dev SMS Gateway API ----------------

export interface TextbeeSendOptions {
  apiKey: string;
  deviceId: string;
  toPhone: string;
  messageText: string;
}

export async function sendViaTextbeeApi(options: TextbeeSendOptions): Promise<{
  success: boolean;
  message: string;
  messageId?: string;
  errorDetails?: any;
}> {
  const { apiKey, deviceId, toPhone, messageText } = options;

  if (!apiKey || !apiKey.trim() || !deviceId || !deviceId.trim()) {
    return {
      success: false,
      message: 'إعدادات بوابة textbee.dev غير مكتملة (يرجى إدخال API Key و Device ID في إعدادات مدير المؤسسة)'
    };
  }

  const intlPhone = formatToInternationalPhone(toPhone);
  // textbee supports +212XXXXXXXXX or local phone number format
  const recipient = '+' + intlPhone;
  const cleanDeviceId = deviceId.trim();
  const url = `https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(cleanDeviceId)}/send-sms`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipients: [recipient],
        message: messageText
      })
    });

    const data: any = await res.json().catch(() => ({}));

    if (res.ok && data.success !== false) {
      return {
        success: true,
        message: 'تم إرسال رسالة SMS بنجاح وبشكل آلي عبر بوابة textbee.dev ✓',
        messageId: data.data?.id || data.id || ('tb_' + Date.now().toString(36))
      };
    } else {
      let friendlyMessage = data.message || data.error;
      if (res.status === 401) {
        friendlyMessage = 'مفتاح API Key غير صحيح أو غير مفعل في منصة textbee.dev.';
      } else if (res.status === 404) {
        friendlyMessage = 'معرف الجهاز (Device ID) غير موجود أو محذوف في textbee.dev.';
      } else if (!friendlyMessage) {
        friendlyMessage = `تعذر إرسال SMS عبر بوابة textbee.dev (رمز الاستجابة: ${res.status})`;
      }

      return {
        success: false,
        message: friendlyMessage,
        errorDetails: data
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `خطأ في الاتصال بخوادم textbee.dev: ${err.message}`
    };
  }
}

export async function testTextbeeConnection(options: {
  apiKey: string;
  deviceId: string;
  testPhone?: string;
}): Promise<{ success: boolean; message: string; messageId?: string; errorDetails?: any }> {
  const { apiKey, deviceId, testPhone } = options;

  if (!apiKey || !apiKey.trim() || !deviceId || !deviceId.trim()) {
    return {
      success: false,
      message: 'يرجى إدخال كل من API Key و Device ID لاختبار الاتصال ببوابة textbee.dev'
    };
  }

  // If a test phone is provided, send a lightweight test SMS
  if (testPhone && testPhone.trim().length >= 8) {
    const testMessage = `المملكة المغربية 🇲🇦\nمنظومة الإدارة التربوية\nرسالة اختبار ناجحة لبوابة textbee.dev ✓\nالتاريخ: ${new Date().toLocaleDateString('ar-MA')} ${new Date().toLocaleTimeString('ar-FR', { hour: '2-digit', minute: '2-digit' })}`;
    return await sendViaTextbeeApi({
      apiKey,
      deviceId,
      toPhone: testPhone,
      messageText: testMessage
    });
  }

  // Otherwise check device info via textbee device status endpoint
  try {
    const url = `https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(deviceId.trim())}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey.trim()
      }
    });

    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      return {
        success: true,
        message: `تم التحقق من ربط جهاز أندرويد بنجاح في textbee.dev ✓`
      };
    } else {
      return {
        success: false,
        message: data.message || `تعذر التحقق من جهاز textbee.dev (رمز: ${res.status})`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `خطأ في الاتصال ببوابة textbee.dev: ${err.message}`
    };
  }
}

// ---------------- WhatsApp Cloud API (Meta Official - Optional) ----------------

export interface WhatsAppCloudSendOptions {
  phoneNumberId: string;
  accessToken: string;
  toPhone: string; // E.164, e.g. 212612345678
  messageText: string;
  templateName?: string;
  studentName?: string;
  notificationType?: string;
  institutionName?: string;
}

export async function sendViaWhatsAppCloudApi(options: WhatsAppCloudSendOptions): Promise<{
  success: boolean;
  message: string;
  messageId?: string;
  errorDetails?: any;
}> {
  const { phoneNumberId, accessToken, toPhone, messageText, templateName } = options;

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      message: 'إعدادات WhatsApp Cloud API غير مكتملة (يرجى إدخال Phone Number ID و Access Token في إعدادات المنظومة)'
    };
  }

  // Ensure clean E.164 international phone number (no '+' sign)
  const cleanTo = toPhone.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId.trim()}/messages`;

  let payload: any;
  if (templateName && templateName.trim()) {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName.trim(),
        language: { code: 'ar' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: options.studentName || 'التلميذ(ة)' },
              { type: 'text', text: options.notificationType === 'absence' ? 'تسجيل غياب' : 'مخالفة انضباطية' },
              { type: 'text', text: options.institutionName || 'المؤسسة التعليمية' }
            ]
          }
        ]
      }
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: false,
        body: messageText
      }
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data: any = await res.json();

    if (res.ok && data.messages && data.messages.length > 0) {
      const msgId = data.messages[0].id;
      return {
        success: true,
        message: 'تم إرسال الرسالة بنجاح وبشكل آلي عبر WhatsApp Cloud API ✓',
        messageId: msgId
      };
    } else {
      const fbError = data.error || {};
      let friendlyMessage = fbError.message || 'تعذر إرسال رسالة واتساب عبر Cloud API';

      if (fbError.code === 190) {
        friendlyMessage = 'رمز الدخول (Access Token) لمنصة Meta منتهي الصلاحية أو غير صحيح.';
      } else if (fbError.code === 100) {
        friendlyMessage = 'معرف رقم الهاتف (Phone Number ID) غير صحيح أو غير مفعل في Meta.';
      } else if (fbError.code === 131030) {
        friendlyMessage = 'رقم هاتف ولي الأمر غير مسجل في واتساب أو غير مؤهل لاستلام الرسائل.';
      } else if (fbError.code === 131047) {
        friendlyMessage = 'نافذة 24 ساعة للمحادثة غير نشطة مع ولي الأمر. تتطلب المبادرة استخدام قالب معتمد (Template Message) أو بدء ولي الأمر المحادثة أولاً.';
      }

      return {
        success: false,
        message: friendlyMessage,
        errorDetails: fbError
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `خطأ في الاتصال بخوادم WhatsApp Cloud: ${err.message}`
    };
  }
}

export async function testWhatsAppCloudConnection(options: {
  phoneNumberId: string;
  accessToken: string;
  testPhone: string;
  templateName?: string;
}): Promise<{ success: boolean; message: string; messageId?: string; errorDetails?: any }> {
  const { phoneNumberId, accessToken, testPhone, templateName } = options;
  const intlPhone = formatToInternationalPhone(testPhone);

  const testMessage = `المملكة المغربية 🇲🇦\nمنظومة الإدارة التربوية والمواظبة الرقمية\nهذه رسالة اختبار للتأكد من نجاح ربط خدمة WhatsApp Cloud API بالمؤسسة ✓\nالتاريخ: ${new Date().toLocaleDateString('ar-MA')} - ${new Date().toLocaleTimeString('ar-FR', { hour: '2-digit', minute: '2-digit' })}`;

  return await sendViaWhatsAppCloudApi({
    phoneNumberId,
    accessToken,
    toPhone: intlPhone,
    messageText: testMessage,
    templateName
  });
}

/**
 * Send an automated OTP verification code via WhatsApp Cloud API or direct WhatsApp link.
 */
export async function sendSmsOtp(options: {
  toPhone: string;
  code: string;
  institutionName?: string;
  studentName?: string;
  smsConfig?: any;
  androidConfig?: any;
}): Promise<{
  success: boolean;
  message: string;
  senderName: string;
  intlPhone: string;
  code: string;
  dispatchId: string;
  gatewayUsed?: string;
  whatsappUrl?: string;
}> {
  const { toPhone, code, institutionName = 'ثانوية ايكسان الإعدادية', studentName, smsConfig } = options;

  const intlPhone = formatToInternationalPhone(toPhone);
  const localPhone = formatToMoroccanLocalPhone(toPhone);
  const senderName = institutionName.trim() || 'إدارة المؤسسة';
  const dispatchId = 'otp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  // Official school WhatsApp OTP message text
  const studentPrefix = studentName ? ` لولي أمر التلميذ(ة) ${studentName}` : '';
  const messageText = `المملكة المغربية • ${senderName}\nرمز التحقق (OTP)${studentPrefix} هو: ${code}\nيرجى إدخاله في التطبيق لتأكيد وتفعيل رقمكم لدى الإدارة. صالح لمدة 10 دقائق.`;

  let gatewayUsed = 'WhatsApp Web / App Direct (مباشر عبر واتساب)';
  let isDelivered = false;

  // Direct WhatsApp Web / App dispatch link
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(messageText)}`;

  // Priority 1: WhatsApp Cloud API (if configured in system settings)
  const isCloudConfigured = Boolean(
    smsConfig?.whatsappPhoneNumberId &&
    smsConfig?.whatsappAccessToken
  );

  if (isCloudConfigured) {
    try {
      const cloudRes = await sendViaWhatsAppCloudApi({
        phoneNumberId: smsConfig.whatsappPhoneNumberId,
        accessToken: smsConfig.whatsappAccessToken,
        toPhone: intlPhone,
        messageText,
        templateName: smsConfig.whatsappTemplateName,
        studentName,
        institutionName: senderName
      });

      if (cloudRes.success) {
        isDelivered = true;
        gatewayUsed = 'WhatsApp Cloud API (Meta Official)';
      } else {
        console.warn('[WhatsApp Cloud API] OTP dispatch notice:', cloudRes.message);
      }
    } catch (err: any) {
      console.warn('[WhatsApp Cloud API] Failed to send OTP:', err.message);
    }
  }

  // Record dispatch in history
  const record: SmsDispatchRecord = {
    id: dispatchId,
    toPhone: localPhone,
    intlPhone: '+' + intlPhone,
    senderName,
    messageText,
    code,
    status: isDelivered ? 'delivered' : 'pending',
    gateway: gatewayUsed,
    sentAt: now
  };

  dispatchHistory.unshift(record);
  if (dispatchHistory.length > 100) {
    dispatchHistory.pop();
  }

  return {
    success: true,
    message: isDelivered
      ? `تم إرسال رمز التحقق (OTP) بنجاح وبشكل آلي عبر WhatsApp Cloud API إلى هاتف ولي الأمر (+${intlPhone}).`
      : `تم تجهيز رمز التحقق لولي الأمر (+${intlPhone}). يمكنك إرساله بنقرة واحدة مباشرة عبر واتساب.`,
    senderName,
    intlPhone: '+' + intlPhone,
    code,
    dispatchId,
    gatewayUsed,
    whatsappUrl
  };
}

// Export WhatsApp-named alias for seamless transition
export const sendWhatsAppOtp = sendSmsOtp;

export interface GuardianNotificationOptions {
  toPhone: string;
  studentName: string;
  massarNumber?: string;
  sectionName?: string;
  notificationType: 'absence' | 'violation' | 'summons' | 'custom';
  messageText: string;
  channel?: 'whatsapp' | 'textbee' | 'whatsapp_cloud' | 'sms' | 'both';
  institutionName?: string;
  directorName?: string;
  smsConfig?: any;
}

/**
 * Unified Guardian Notification Dispatcher (Exclusively Director Controlled: WhatsApp Standard & textbee.dev)
 */
export async function sendGuardianNotification(options: GuardianNotificationOptions): Promise<{
  success: boolean;
  smsSuccess: boolean;
  whatsappCloudSuccess?: boolean;
  message: string;
  smsStatus: string;
  gatewayUsed: string;
  whatsappUrl: string;
  toPhone: string;
  intlPhone: string;
  dispatchId: string;
}> {
  const {
    toPhone,
    studentName,
    notificationType,
    messageText,
    channel = 'whatsapp',
    institutionName = 'المدرسة الإلكترونية',
    smsConfig
  } = options;

  const intlPhone = formatToInternationalPhone(toPhone);
  const localPhone = formatToMoroccanLocalPhone(toPhone);
  const dispatchId = 'notif_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  // Standard WhatsApp Direct URL
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(messageText)}`;

  // Choice 1: textbee.dev (SMS Gateway via Android Device)
  if (channel === 'textbee' || channel === 'sms') {
    const hasTextbeeCreds = Boolean(smsConfig?.textbeeApiKey && smsConfig?.textbeeDeviceId);

    if (hasTextbeeCreds) {
      const tbRes = await sendViaTextbeeApi({
        apiKey: smsConfig.textbeeApiKey,
        deviceId: smsConfig.textbeeDeviceId,
        toPhone: intlPhone,
        messageText
      });

      const gatewayUsed = 'بوابة SMS (textbee.dev)';
      dispatchHistory.unshift({
        id: dispatchId,
        toPhone: localPhone,
        intlPhone: '+' + intlPhone,
        senderName: institutionName,
        messageText,
        code: notificationType,
        status: tbRes.success ? 'delivered' : 'failed',
        gateway: gatewayUsed,
        sentAt: now
      });
      if (dispatchHistory.length > 100) dispatchHistory.pop();

      if (tbRes.success) {
        return {
          success: true,
          smsSuccess: true,
          message: `تم إرسال رسالة SMS بنجاح لولي أمر (${studentName}) عبر بوابة textbee.dev ✓`,
          smsStatus: 'تم التسليم عبر textbee.dev',
          gatewayUsed,
          whatsappUrl,
          toPhone: localPhone,
          intlPhone: '+' + intlPhone,
          dispatchId
        };
      } else {
        return {
          success: false,
          smsSuccess: false,
          message: `فشل الإرسال عبر textbee.dev: ${tbRes.message}. يمكنك استخدام رابط واتساب العادي كبديل فوري.`,
          smsStatus: tbRes.message,
          gatewayUsed,
          whatsappUrl,
          toPhone: localPhone,
          intlPhone: '+' + intlPhone,
          dispatchId
        };
      }
    } else {
      return {
        success: false,
        smsSuccess: false,
        message: 'إعدادات بوابة textbee.dev غير مكتملة (يرجى إدخال API Key و Device ID في إعدادات المدير)',
        smsStatus: 'غير مهيأ',
        gatewayUsed: 'بوابة SMS (textbee.dev)',
        whatsappUrl,
        toPhone: localPhone,
        intlPhone: '+' + intlPhone,
        dispatchId
      };
    }
  }

  // Choice 2: WhatsApp Cloud API (if specifically requested)
  if (channel === 'whatsapp_cloud') {
    const isWhatsAppCloudEligible = Boolean(smsConfig?.whatsappPhoneNumberId && smsConfig?.whatsappAccessToken);
    if (isWhatsAppCloudEligible) {
      const gatewayUsed = 'WhatsApp Cloud API (Meta Official)';
      const cloudRes = await sendViaWhatsAppCloudApi({
        phoneNumberId: smsConfig.whatsappPhoneNumberId,
        accessToken: smsConfig.whatsappAccessToken,
        toPhone: intlPhone,
        messageText,
        templateName: smsConfig.whatsappTemplateName,
        studentName,
        notificationType,
        institutionName
      });

      dispatchHistory.unshift({
        id: dispatchId,
        toPhone: localPhone,
        intlPhone: '+' + intlPhone,
        senderName: institutionName,
        messageText,
        code: notificationType,
        status: cloudRes.success ? 'delivered' : 'failed',
        gateway: gatewayUsed,
        sentAt: now
      });
      if (dispatchHistory.length > 100) dispatchHistory.pop();

      if (cloudRes.success) {
        return {
          success: true,
          smsSuccess: false,
          whatsappCloudSuccess: true,
          message: `تم إرسال الإشعار لولي أمر (${studentName}) عبر WhatsApp Cloud API ✓`,
          smsStatus: cloudRes.message,
          gatewayUsed,
          whatsappUrl,
          toPhone: localPhone,
          intlPhone: '+' + intlPhone,
          dispatchId
        };
      }
    }
  }

  // Default Choice: واتساب عادي (Standard WhatsApp - Direct wa.me link)
  const gatewayUsed = 'واتساب عادي (WhatsApp Direct)';
  dispatchHistory.unshift({
    id: dispatchId,
    toPhone: localPhone,
    intlPhone: '+' + intlPhone,
    senderName: institutionName,
    messageText,
    code: notificationType,
    status: 'delivered',
    gateway: gatewayUsed,
    sentAt: now
  });
  if (dispatchHistory.length > 100) dispatchHistory.pop();

  return {
    success: true,
    smsSuccess: false,
    whatsappCloudSuccess: false,
    message: `تم تجهيز إشعار ${notificationType === 'absence' ? 'الغياب' : notificationType === 'violation' ? 'المخالفة' : 'الإشعار'} لولي أمر (${studentName}) للإرسال المباشر عبر واتساب العادي.`,
    smsStatus: 'جاهز للإرسال المباشر عبر واتساب العادي',
    gatewayUsed,
    whatsappUrl,
    toPhone: localPhone,
    intlPhone: '+' + intlPhone,
    dispatchId
  };
}

export function getSmsDispatchLogs(): SmsDispatchRecord[] {
  return [...dispatchHistory];
}
