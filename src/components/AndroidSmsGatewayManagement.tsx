import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Save,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  FileText,
  Clock,
  Sparkles,
  Zap,
  Key,
  Layers,
  Info
} from 'lucide-react';

interface WhatsAppGatewayConfig {
  provider: 'whatsapp_cloud';
  whatsappCloudEnabled: boolean;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  whatsappBusinessAccountId?: string;
  whatsappTemplateName?: string;
  schoolPhone?: string;
  defaultChannel: 'whatsapp_cloud';
}

interface WhatsAppLog {
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

export const AndroidSmsGatewayManagement: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppGatewayConfig>({
    provider: 'whatsapp_cloud',
    whatsappCloudEnabled: true,
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    whatsappBusinessAccountId: '',
    whatsappTemplateName: '',
    schoolPhone: '',
    defaultChannel: 'whatsapp_cloud'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; error?: string; messageId?: string } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Fetch current config
  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/admin/sms-gateway/config');
      const data = await res.json();
      if (data.success && data.config) {
        setConfig({
          provider: 'whatsapp_cloud',
          whatsappCloudEnabled: true,
          whatsappPhoneNumberId: data.config.whatsappPhoneNumberId || '',
          whatsappAccessToken: data.config.whatsappAccessToken || '',
          whatsappBusinessAccountId: data.config.whatsappBusinessAccountId || '',
          whatsappTemplateName: data.config.whatsappTemplateName || '',
          schoolPhone: data.config.schoolPhone || '',
          defaultChannel: 'whatsapp_cloud'
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر تحميل إعدادات بوابة واتساب');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const res = await fetch('/api/admin/sms-gateway/logs');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, []);

  // Save config
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSaveSuccess(null);

      const res = await fetch('/api/admin/sms-gateway/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin'
        },
        body: JSON.stringify({
          ...config,
          provider: 'whatsapp_cloud',
          whatsappCloudEnabled: true,
          defaultChannel: 'whatsapp_cloud'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر حفظ الإعدادات');
      }

      setSaveSuccess('تم حفظ إعدادات بوابة WhatsApp Cloud API بنجاح ✓');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  // Test send
  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      setErrorMsg('يرجى كتابة رقم هاتف مغربي لإرسال رسالة الاختبار إليه (مثال: 0612345678 أو 0712345678)');
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      setErrorMsg(null);

      const res = await fetch('/api/admin/sms-gateway/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin'
        },
        body: JSON.stringify({
          provider: 'whatsapp_cloud',
          phoneNumberId: config.whatsappPhoneNumberId,
          accessToken: config.whatsappAccessToken,
          templateName: config.whatsappTemplateName,
          testPhone: testPhone.trim()
        })
      });

      const data = await res.json();
      setTestResult(data);
      fetchLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'فشل الاتصال بخوادم WhatsApp Cloud'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#1A4E47] via-[#143E38] to-[#1A4E47] text-white shadow-lg border border-emerald-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold font-['Amiri',serif] m-0">
                بوابة إشعارات WhatsApp Cloud API الرسمية (Meta)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-bold">
                1,000 محادثة شهرياً مجاناً 🚀
              </span>
            </div>
            <p className="text-xs text-white/80 mt-1 max-w-2xl leading-relaxed">
              تم إلغاء خيار الرسائل القصيرة SMS نظراً لارتفاع تكاليفها، والاعتماد رسمياً وحصرياً على <strong className="text-emerald-200 font-mono">WhatsApp Cloud API من شركة Meta</strong> لإرسال الإشعارات لأولياء الأمور آلياً وسحابياً وبأعلى سرعة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-white transition-colors cursor-pointer shrink-0 border border-emerald-400/30 flex items-center gap-1.5 text-xs font-bold no-underline"
            title="فتح منصة Meta for Developers"
          >
            <ExternalLink className="w-4 h-4 text-emerald-300" />
            <span>Meta Developers</span>
          </a>

          <button
            type="button"
            onClick={() => {
              fetchConfig();
              fetchLogs();
            }}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0 border border-white/20 flex items-center gap-1.5 text-xs font-bold"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: WhatsApp Cloud Configuration Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-[#E5DFD4] shadow-xs space-y-6">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  WA
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1F2926]">مفاتيح الاتصال بـ Meta WhatsApp Cloud API (Graph v21.0)</h3>
                  <p className="text-[11px] text-[#6C6356]">ربط سحابي رسمي - 1,000 محادثة خدمة شهرية مجانية 100%</p>
                </div>
              </div>
              <span className="text-[11px] text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full font-bold">
                سحابي بدون هاتف مفتوح ✓
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  معرف رقم الهاتف (Phone Number ID) *
                </label>
                <input
                  type="text"
                  value={config.whatsappPhoneNumberId}
                  onChange={(e) => setConfig({ ...config, whatsappPhoneNumberId: e.target.value })}
                  placeholder="مثال: 104829104820194"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
                />
                <p className="text-[11px] text-[#6C6356] mt-1">
                  تجد هذا المعرف في لوحة <strong className="font-mono text-emerald-800">developers.facebook.com</strong> تحت: WhatsApp &gt; API Setup &gt; Phone number ID.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  رمز الوصول الدائم (Permanent System User Access Token) *
                </label>
                <input
                  type="password"
                  value={config.whatsappAccessToken}
                  onChange={(e) => setConfig({ ...config, whatsappAccessToken: e.target.value })}
                  placeholder="EAA..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
                />
                <p className="text-[11px] text-[#6C6356] mt-1">
                  الـ Token الممنوح لحساب النظام في Meta Business Manager مع صلاحية <code className="font-mono text-emerald-800 font-bold">whatsapp_business_messaging</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">
                    معرف الحساب التجاري (WABA ID - اختياري)
                  </label>
                  <input
                    type="text"
                    value={config.whatsappBusinessAccountId || ''}
                    onChange={(e) => setConfig({ ...config, whatsappBusinessAccountId: e.target.value })}
                    placeholder="مثال: 10839201948271"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">
                    اسم القالب المعتمد (Template Name - اختياري)
                  </label>
                  <input
                    type="text"
                    value={config.whatsappTemplateName || ''}
                    onChange={(e) => setConfig({ ...config, whatsappTemplateName: e.target.value })}
                    placeholder="مثال: school_parent_notification"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
                  />
                  <p className="text-[10px] text-[#6C6356] mt-0.5">
                    لإرسال الرسائل خارج نافذة الـ 24 ساعة بدون انتظار تفاعل الولي أولاً.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-3 border-t border-[#E5DFD4] flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-emerald-200" />
                    <span>حفظ مفاتيح WhatsApp Cloud API</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Test Dispatch Tool */}
          <div className="bg-white p-6 rounded-3xl border border-[#E5DFD4] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2.5">
                <Send className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-base text-[#1F2926]">تجربة إرسال رسالة اختبار عبر WhatsApp Cloud</h3>
              </div>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                فوري ومجاني
              </span>
            </div>

            <p className="text-xs text-[#6C6356]">
              أدخل رقم هاتفك المغربي (مثال: <strong className="font-mono text-[#1F2926]">0612345678</strong> أو <strong className="font-mono text-[#1F2926]">0712345678</strong>) واضغط إرسال لمعاينة رد خوادم واتساب فوراً:
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="06XXXXXXXX أو 07XXXXXXXX"
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
              />

              <button
                type="button"
                onClick={handleTestSend}
                disabled={isTesting || !testPhone.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الاتصال بخوادم واتساب...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-emerald-200" />
                    <span>إرسال رسالة تجريبية الآن 🚀</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-fadeIn ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-amber-50 border-amber-300 text-amber-950 font-medium'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1">
                  <div className="font-bold text-sm">
                    {testResult.success ? 'نجح الاتصال والإرسال بنجاح! ✓' : 'نتيجة الاتصال بالبوابة:'}
                  </div>
                  <div className="text-xs leading-relaxed">{testResult.message}</div>

                  {testResult.messageId && (
                    <div className="text-[11px] font-mono text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded w-fit">
                      معرف الرسالة في واتساب: {testResult.messageId}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Guide & Quick Help */}
        <div className="space-y-6">
          {/* Zero Cost Benefit Card */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-[#FAF8F5] p-5 rounded-3xl border border-emerald-300 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
              <Sparkles className="w-5 h-5 text-emerald-700" />
              <span>لماذا تم الاستغناء عن SMS نهائياً؟</span>
            </div>

            <ul className="space-y-2.5 text-xs text-emerald-950 pr-4 list-disc leading-relaxed">
              <li>
                <strong>تكاليف SMS المرتفعة:</strong> رسائل SMS تتطلب شحن رصيد مستمر وتكلف أموالاً باهظة شهرياً للمؤسسة.
              </li>
              <li>
                <strong>1,000 محادثة شهرياً مجاناً من Meta:</strong> كل حساب WhatsApp Business يحصل على 1,000 محادثة خدمة مجانية كل شهر بتكلفة <strong>0 درهم</strong>.
              </li>
              <li>
                <strong>بدون أجهزة في الإدارة:</strong> لا حاجة لشراء هواتف أندرويد مخصصة أو تركيب شرائح SIM وتشغيلها على مدار اليوم.
              </li>
              <li>
                <strong>إرسال سحابي آلي فوري:</strong> الرسائل تصل لهواتف أولياء الأمور مباشرة وبشكل آلي وموثق دون الحاجة لأي تدخل يدوي.
              </li>
            </ul>
          </div>

          {/* Quick Setup Steps */}
          <div className="bg-white p-5 rounded-3xl border border-[#E5DFD4] space-y-3">
            <div className="flex items-center gap-2 text-[#1A4E47] font-bold text-sm">
              <Layers className="w-5 h-5 text-emerald-700" />
              <span>خطوات الحصول على بيانات Meta WhatsApp:</span>
            </div>
            <ol className="text-xs text-[#524B40] space-y-2 pr-4 list-decimal leading-relaxed">
              <li>ادخل إلى <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">developers.facebook.com</a> وسجل بحساب فيسبوك الإدارة.</li>
              <li>أنشئ تطبيقاً جديداً واخر النوع <strong>Business</strong>.</li>
              <li>أضف منتج <strong>WhatsApp</strong> للتطبيق.</li>
              <li>في صفحة <strong>API Setup</strong>، انسخ <strong>Phone Number ID</strong> و <strong>Access Token</strong> والصقهما هنا.</li>
              <li>اضغط حفظ، وجرب الإرسال لهاتفك للتأكد من نجاح الربط فوراً!</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent WhatsApp Dispatch Logs */}
      <div className="bg-white p-6 rounded-3xl border border-[#E5DFD4] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-emerald-800" />
            <h3 className="font-bold text-base text-[#1F2926]">سجل عمليات إرسال إشعارات واتساب</h3>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6C6356] bg-[#FAF8F5] rounded-2xl">
            لا توجد إشعارات واتساب مسجلة حتى الآن. عند إرسال أي إشعار لولي أمر، ستظهر العملية هنا مع حالتها وتفاصيلها.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5DFD4] text-[#6C6356] bg-[#FAF8F5]">
                  <th className="p-3 font-bold">رقم المستلم</th>
                  <th className="p-3 font-bold">المرسل</th>
                  <th className="p-3 font-bold">القناة المستخدمة</th>
                  <th className="p-3 font-bold">الحالة</th>
                  <th className="p-3 font-bold">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD4]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="p-3 font-mono font-bold text-[#1F2926] dir-ltr text-right">
                      {log.intlPhone || log.toPhone}
                    </td>
                    <td className="p-3 font-medium text-emerald-900">{log.senderName}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        WhatsApp Cloud API
                      </span>
                    </td>
                    <td className="p-3">
                      {log.status === 'delivered' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>تم الإرسال ✓</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>فشل الإرسال</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-[#6C6356] whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleString('ar-MA', { timeZone: 'UTC' })} (GMT)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
