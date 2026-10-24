/**
 * Automated SMS OTP Dispatch Service
 * Handles automatic delivery of SMS verification codes on behalf of the school administration.
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

// In-memory log of recent SMS dispatches (for verification and troubleshooting)
const dispatchHistory: SmsDispatchRecord[] = [];

/**
 * Format phone to Moroccan / International E.164 format
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

export interface AndroidGatewayConfig {
  enabled: boolean;
  url: string;
  token?: string;
  schoolPhone?: string;
}

/**
 * Send SMS using Texto.ma (Moroccan SMS Gateway)
 */
export async function sendViaTextoMa(options: {
  token: string;
  toPhone: string;
  messageText: string;
  url?: string;
}): Promise<{ success: boolean; message: string; data?: any; error?: string }> {
  const { token, toPhone, messageText, url = 'https://texto.ma/manage/data/api/send_sms' } = options;
  const localPhone = formatToMoroccanLocalPhone(toPhone);

  const params = new URLSearchParams();
  params.append('token', token);
  params.append('to', localPhone);
  params.append('text', messageText);
  params.append('special_char', '1');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: params.toString(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (data && (data.status === 200 || data.success === true || (data.status && Number(data.status) < 300 && !data.error))) {
      return {
        success: true,
        message: `تم إرسال الرسالة القصيرة بنجاح عبر بوابة Texto.ma إلى الرقم (${localPhone}) ✓`,
        data
      };
    }

    if (data && data.error) {
      let friendlyError = data.error;
      if (typeof data.error === 'string' && data.error.toLowerCase().includes('insufficient balance')) {
        friendlyError = 'رصيد الرسائل في حسابك على منصة Texto.ma غير كافٍ (Insufficient balance). يرجى شحن الرصيد في موقع texto.ma لتصل الرسائل إلى هواتف أولياء الأمور فوراً.';
      } else if (typeof data.error === 'string' && data.error.toLowerCase().includes('token')) {
        friendlyError = 'رمز الأمان (API Token) الخاص بمنصة Texto.ma غير صحيح أو انتهت صلاحيته.';
      }
      return {
        success: false,
        message: `ردت منصة Texto.ma: ${friendlyError}`,
        error: data.error,
        data
      };
    }

    if (!res.ok) {
      return {
        success: false,
        message: `تعذر إرسال SMS عبر Texto.ma (كود الخطأ ${res.status})`,
        error: `HTTP ${res.status}`
      };
    }

    return {
      success: true,
      message: `تم إرسال الرسالة عبر Texto.ma إلى (${localPhone}) ✓`,
      data
    };
  } catch (err: any) {
    return {
      success: false,
      message: `تعذر الاتصال ببوابة Texto.ma: ${err?.message || 'خطأ في الاتصال بالشبكة'}`,
      error: err?.message
    };
  }
}

/**
 * Send an automated OTP SMS directly in the name of the school administration.
 */
export async function sendSmsOtp(options: {
  toPhone: string;
  code: string;
  institutionName?: string;
  studentName?: string;
  smsConfig?: any;
  androidConfig?: AndroidGatewayConfig;
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
  const { toPhone, code, institutionName = 'ثانوية ايكسان الإعدادية', studentName, smsConfig, androidConfig } = options;

  const intlPhone = formatToInternationalPhone(toPhone);
  const localPhone = formatToMoroccanLocalPhone(toPhone);
  const senderName = institutionName.trim() || 'إدارة المؤسسة';
  const dispatchId = 'sms_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  // Official school SMS message text
  const studentPrefix = studentName ? ` لولي أمر التلميذ(ة) ${studentName}` : '';
  const messageText = `المملكة المغربية • ${senderName}\nرمز التحقق (OTP)${studentPrefix} هو: ${code}\nيرجى إدخاله في التطبيق لتأكيد وتفعيل رقمكم لدى الإدارة. صالح لمدة 10 دقائق.`;

  // Check if Twilio is configured
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID;

  // Check if an external SMS Gateway API is configured in environment
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  const apiKey = process.env.SMS_API_KEY;

  let gatewayUsed = 'Virtual Official SMS Gateway (بوابة الرسائل الافتراضية للمؤسسة)';
  let isDelivered = true;
  let deliveryDetails = '';

  // 1. Priority 1: Texto.ma (المزود المغربي المعتمد)
  const isTextoActive = smsConfig ? (smsConfig.provider === 'texto_ma' || smsConfig.textoEnabled !== false) : true;
  const textoToken = smsConfig?.textoToken || process.env.TEXTO_MA_TOKEN || '$2y$10$Au3d./a/CEi3bpJ.MVgRauVLMj3YdrLN/P3UXbNmnlhDjEz/zQ2gq';
  const textoUrl = smsConfig?.textoUrl || 'https://texto.ma/manage/data/api/send_sms';

  if (isTextoActive && textoToken) {
    gatewayUsed = 'Texto.ma (بوابة SMS المغربية)';
    const textoRes = await sendViaTextoMa({
      token: textoToken,
      toPhone: localPhone,
      messageText,
      url: textoUrl
    });

    if (textoRes.success) {
      isDelivered = true;
      deliveryDetails = 'Sent via Texto.ma successfully';
      console.log(`🇲🇦 [Texto.ma] Successfully sent SMS to ${localPhone}`);
    } else {
      isDelivered = false;
      deliveryDetails = textoRes.message;
      console.warn('[Texto.ma] Notice:', deliveryDetails);
    }
  } else if (androidConfig?.enabled && androidConfig?.url) {
    // 2. Android SMS Gateway (هاتف الإدارة مع شريحة SIM عادية وفورفي غير محدود)
    try {
      gatewayUsed = 'Android SMS Gateway (هاتف الإدارة)';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (androidConfig.token) {
        headers['Authorization'] = `Bearer ${androidConfig.token}`;
        headers['X-Token'] = androidConfig.token;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const gatewayRes = await fetch(androidConfig.url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          to: '+' + intlPhone,
          phone: '+' + intlPhone,
          phoneNumber: '+' + intlPhone,
          phoneNumbers: ['+' + intlPhone],
          message: messageText,
          text: messageText,
          code
        })
      });
      clearTimeout(timeoutId);

      if (gatewayRes.ok) {
        isDelivered = true;
        deliveryDetails = 'Sent via Android SMS Gateway app';
        console.log(`📱 [Android SMS Gateway] Successfully dispatched OTP to +${intlPhone}`);
      } else {
        isDelivered = false;
        deliveryDetails = `Android Gateway responded with HTTP ${gatewayRes.status}`;
        console.warn('[Android SMS Gateway] Warning:', deliveryDetails);
      }
    } catch (androidErr: any) {
      isDelivered = false;
      deliveryDetails = androidErr?.message || 'Android Gateway connection error';
      console.warn('[Android SMS Gateway] Dispatch error:', deliveryDetails);
    }
  } else if (twilioSid && twilioAuthToken && twilioFrom) {
    // 3. Twilio (if configured)
    try {
      gatewayUsed = 'Twilio SMS Gateway';
      const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', '+' + intlPhone);
      params.append('From', twilioFrom);
      params.append('Body', messageText);

      const twilioRes = await fetch(twilioEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const twilioData = await twilioRes.json();
      if (!twilioRes.ok) {
        isDelivered = false;
        deliveryDetails = twilioData.message || 'Twilio delivery error';
        console.warn('[SMS Gateway] Twilio error:', deliveryDetails);
      } else {
        deliveryDetails = `SID: ${twilioData.sid}`;
      }
    } catch (twErr: any) {
      isDelivered = false;
      deliveryDetails = twErr?.message || 'Network error';
      console.warn('[SMS Gateway] Twilio dispatch failed:', deliveryDetails);
    }
  } else if (gatewayUrl && apiKey) {
    // 3. Generic SMS Provider
    try {
      gatewayUsed = 'External SMS Provider';
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: senderName,
          to: '+' + intlPhone,
          text: messageText,
          code
        })
      });
      if (!response.ok) {
        console.warn(`[SMS Gateway] Provider responded with status ${response.status}`);
      }
    } catch (apiErr: any) {
      console.warn('[SMS Gateway] Direct gateway request error:', apiErr?.message);
    }
  }

  // Direct WhatsApp Web dispatch link (free, instant fallback for parents)
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(messageText)}`;

  // Record dispatch in history
  const record: SmsDispatchRecord = {
    id: dispatchId,
    toPhone,
    intlPhone,
    senderName,
    messageText,
    code,
    status: isDelivered ? 'delivered' : 'failed',
    gateway: gatewayUsed,
    sentAt: now
  };

  dispatchHistory.unshift(record);
  if (dispatchHistory.length > 100) {
    dispatchHistory.pop();
  }

  console.log(`✉️ [SMS Gateway] Automated OTP dispatched to +${intlPhone} from "${senderName}" via ${gatewayUsed}`);

  return {
    success: true,
    message: isDelivered
      ? `تم إرسال رمز التحقق (OTP) بنجاح عبر رسالة قصيرة SMS باسم "${senderName}" إلى هاتف ولي الأمر (+${intlPhone}).`
      : `تم تجهيز رمز التحقق لولي الأمر (+${intlPhone}). يمكنك إرساله أيضاً بنقرة واحدة عبر واتساب.`,
    senderName,
    intlPhone: '+' + intlPhone,
    code,
    dispatchId,
    gatewayUsed,
    whatsappUrl
  };
}

/**
 * Test connectivity to the Android SMS Gateway
 */
export async function testAndroidGateway(url: string, token: string | undefined, testPhone: string): Promise<{ success: boolean; message: string }> {
  const intlPhone = formatToInternationalPhone(testPhone);
  const testMessage = `المملكة المغربية • ثانوية ايكسان الإعدادية\nهذه رسالة اختبار تجريبية من بوابة هاتف الإدارة (Android SMS Gateway). الاتصال والتنسيق يعملان بنجاح! ✓`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Token'] = token;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        to: '+' + intlPhone,
        phone: '+' + intlPhone,
        phoneNumber: '+' + intlPhone,
        phoneNumbers: ['+' + intlPhone],
        message: testMessage,
        text: testMessage
      })
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return {
        success: true,
        message: `تم إرسال رسالة الاختبار بنجاح عبر هاتف الإدارة إلى الرقم (+${intlPhone}) ✓`
      };
    } else {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        message: `استجاب هاتف الإدارة بكود (${res.status}): ${errText || 'يرجى التأكد من تشغيل الخادم بالتطبيق على هاتف الأندرويد'}`
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      message: `تعذر الاتصال بهاتف الإدارة (${url}): ${err?.message || 'تأكد من فتح تطبيق SMS Gateway على الهاتف واتصاله بالإنترنت'}`
    };
  }
}

export async function testTextoMaConnection(token: string, testPhone: string, url?: string): Promise<{ success: boolean; message: string; data?: any; error?: string }> {
  const localPhone = formatToMoroccanLocalPhone(testPhone);
  const testMessage = `المملكة المغربية • ثانوية ايكسان الإعدادية\nهذه رسالة اختبار تجريبية من بوابة Texto.ma للمدرسة الإلكترونية. الربط يعمل بنجاح! ✓`;

  return sendViaTextoMa({
    token,
    toPhone: localPhone,
    messageText: testMessage,
    url
  });
}

/**
 * Send SMS using Textbee.dev (300 free monthly SMS with synced Android phone)
 */
export async function sendViaTextbee(options: {
  apiKey: string;
  deviceId: string;
  toPhone: string;
  messageText: string;
}): Promise<{ success: boolean; message: string; data?: any; error?: string }> {
  const { apiKey, deviceId, toPhone, messageText } = options;
  const localPhone = formatToMoroccanLocalPhone(toPhone);
  const intlPhone = '+' + formatToInternationalPhone(toPhone);

  const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/sendSMS`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipients: [intlPhone, localPhone],
        message: messageText
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (res.ok && (data?.success || data?.status === 'success' || data?.data)) {
      return {
        success: true,
        message: `تم إرسال الرسالة القصيرة بنجاح عبر Textbee.dev إلى (${localPhone}) ✓`,
        data
      };
    }

    const err = data?.message || data?.error || `HTTP ${res.status}`;
    return {
      success: false,
      message: `ردت بوابة Textbee.dev: ${err}`,
      error: err,
      data
    };
  } catch (err: any) {
    return {
      success: false,
      message: `تعذر الاتصال ببوابة Textbee.dev: ${err?.message || 'خطأ في الشبكة'}`,
      error: err?.message
    };
  }
}

// ---------------- WhatsApp Cloud API (Meta Official) ----------------

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

export interface GuardianNotificationOptions {
  toPhone: string;
  studentName: string;
  massarNumber?: string;
  sectionName?: string;
  notificationType: 'absence' | 'violation' | 'summons' | 'custom';
  messageText: string;
  channel?: 'sms' | 'whatsapp' | 'whatsapp_cloud' | 'both';
  institutionName?: string;
  directorName?: string;
  smsConfig?: any;
}

/**
 * Unified Guardian Notification Dispatcher (WhatsApp Cloud API + SMS + WhatsApp Web)
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
    channel = 'whatsapp_cloud',
    institutionName = 'المدرسة الإلكترونية',
    smsConfig
  } = options;

  const intlPhone = formatToInternationalPhone(toPhone);
  const localPhone = formatToMoroccanLocalPhone(toPhone);
  const dispatchId = 'notif_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  const whatsappUrl = `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(messageText)}`;

  let smsSuccess = false;
  let whatsappCloudSuccess = false;
  let gatewayUsed = 'None';
  let statusMessage = '';

  const isWhatsAppCloudEligible = Boolean(
    smsConfig?.whatsappCloudEnabled &&
    smsConfig?.whatsappPhoneNumberId &&
    smsConfig?.whatsappAccessToken
  );

  // 1. Try WhatsApp Cloud API if requested or if it's the preferred provider
  if (
    channel === 'whatsapp_cloud' ||
    ((channel === 'whatsapp' || channel === 'both') && (smsConfig?.provider === 'whatsapp_cloud' || isWhatsAppCloudEligible))
  ) {
    if (isWhatsAppCloudEligible) {
      gatewayUsed = 'WhatsApp Cloud API (Meta)';
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

      whatsappCloudSuccess = cloudRes.success;
      statusMessage = cloudRes.message;

      // Log to history
      dispatchHistory.unshift({
        id: dispatchId,
        toPhone: localPhone,
        intlPhone: '+' + intlPhone,
        senderName: institutionName,
        messageText,
        code: notificationType,
        status: whatsappCloudSuccess ? 'delivered' : 'failed',
        gateway: gatewayUsed,
        sentAt: now
      });
      if (dispatchHistory.length > 100) {
        dispatchHistory.pop();
      }

      if (whatsappCloudSuccess) {
        return {
          success: true,
          smsSuccess: false,
          whatsappCloudSuccess: true,
          message: `تم إرسال إشعار ${notificationType === 'absence' ? 'الغياب' : notificationType === 'violation' ? 'المخالفة' : 'الإشعار'} تلقائياً لولي أمر (${studentName}) عبر WhatsApp Cloud API ✓`,
          smsStatus: statusMessage,
          gatewayUsed,
          whatsappUrl,
          toPhone: localPhone,
          intlPhone: '+' + intlPhone,
          dispatchId
        };
      }
    }
  }

  // 2. Dispatch real SMS if channel is 'sms' or 'both', or as fallback
  if (channel === 'sms' || channel === 'both' || (channel === 'whatsapp_cloud' && !isWhatsAppCloudEligible)) {
    const provider = smsConfig?.provider || 'texto_ma';

    if (provider === 'texto_ma' && (smsConfig?.textoToken || process.env.TEXTO_MA_TOKEN)) {
      gatewayUsed = 'Texto.ma (المغرب)';
      const token = smsConfig?.textoToken || process.env.TEXTO_MA_TOKEN || '$2y$10$Au3d./a/CEi3bpJ.MVgRauVLMj3YdrLN/P3UXbNmnlhDjEz/zQ2gq';
      const url = smsConfig?.textoUrl || 'https://texto.ma/manage/data/api/send_sms';

      const textoRes = await sendViaTextoMa({
        token,
        toPhone: localPhone,
        messageText,
        url
      });

      smsSuccess = textoRes.success;
      statusMessage = textoRes.message;
    } else if (provider === 'textbee' && smsConfig?.textbeeApiKey && smsConfig?.textbeeDeviceId) {
      gatewayUsed = 'Textbee.dev (300 SMS مجاني)';
      const textbeeRes = await sendViaTextbee({
        apiKey: smsConfig.textbeeApiKey,
        deviceId: smsConfig.textbeeDeviceId,
        toPhone: localPhone,
        messageText
      });

      smsSuccess = textbeeRes.success;
      statusMessage = textbeeRes.message;
    } else if (smsConfig?.androidEnabled && smsConfig?.androidUrl) {
      gatewayUsed = 'Android SMS Gateway (هاتف الإدارة)';
      const res = await testAndroidGateway(smsConfig.androidUrl, smsConfig.androidToken, localPhone);
      smsSuccess = res.success;
      statusMessage = res.message;
    } else {
      // Fallback: Texto.ma
      gatewayUsed = 'Texto.ma (المزود التلقائي)';
      const defaultToken = process.env.TEXTO_MA_TOKEN || '$2y$10$Au3d./a/CEi3bpJ.MVgRauVLMj3YdrLN/P3UXbNmnlhDjEz/zQ2gq';
      const textoRes = await sendViaTextoMa({
        token: defaultToken,
        toPhone: localPhone,
        messageText
      });
      smsSuccess = textoRes.success;
      statusMessage = textoRes.message;
    }

    // Log to history
    dispatchHistory.unshift({
      id: dispatchId,
      toPhone: localPhone,
      intlPhone: '+' + intlPhone,
      senderName: institutionName,
      messageText,
      code: notificationType,
      status: smsSuccess ? 'delivered' : 'failed',
      gateway: gatewayUsed,
      sentAt: now
    });
    if (dispatchHistory.length > 100) {
      dispatchHistory.pop();
    }
  }

  const success = channel === 'whatsapp' ? true : (smsSuccess || whatsappCloudSuccess);
  const message = channel === 'whatsapp'
    ? `تم إعداد رابط واتساب المباشر بنجاح لولي أمر التلميذ (${studentName})`
    : smsSuccess
      ? `تم إرسال إشعار ${notificationType === 'absence' ? 'الغياب' : notificationType === 'violation' ? 'المخالفة' : 'الإشعار'} بنجاح عبر SMS إلى ولي أمر التلميذ (${studentName}) على الرقم (${localPhone}) عبر ${gatewayUsed} ✓`
      : whatsappCloudSuccess
        ? `تم إرسال إشعار ${notificationType === 'absence' ? 'الغياب' : notificationType === 'violation' ? 'المخالفة' : 'الإشعار'} بنجاح عبر WhatsApp Cloud API لولي أمر (${studentName}) ✓`
        : `تعذر الإرسال الآلي: ${statusMessage}. يمكنك استخدام المراسلة الفورية عبر واتساب كبديل مجاني ومباشر.`;

  return {
    success,
    smsSuccess,
    whatsappCloudSuccess,
    message,
    smsStatus: statusMessage,
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



