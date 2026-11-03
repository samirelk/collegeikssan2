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
  Smartphone,
  Phone,
  Radio,
  Info
} from 'lucide-react';

interface NotificationGatewayConfig {
  provider: 'whatsapp' | 'textbee';
  // Textbee.dev Android Gateway
  textbeeApiKey: string;
  textbeeDeviceId: string;
  textbeeEnabled: boolean;
  // WhatsApp Standard
  whatsappEnabled: boolean;
  defaultChannel: 'whatsapp' | 'textbee';
}

interface DispatchLog {
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
  const [config, setConfig] = useState<NotificationGatewayConfig>({
    provider: 'whatsapp',
    textbeeApiKey: '',
    textbeeDeviceId: '',
    textbeeEnabled: true,
    whatsappEnabled: true,
    defaultChannel: 'whatsapp'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Test state
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; error?: string; messageId?: string } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<DispatchLog[]>([]);
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
          provider: data.config.provider === 'textbee' ? 'textbee' : 'whatsapp',
          textbeeApiKey: data.config.textbeeApiKey || '',
          textbeeDeviceId: data.config.textbeeDeviceId || '',
          textbeeEnabled: data.config.textbeeEnabled !== false,
          whatsappEnabled: data.config.whatsappEnabled !== false,
          defaultChannel: data.config.defaultChannel === 'textbee' ? 'textbee' : 'whatsapp'
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر تحميل إعدادات بوابات الإشعارات');
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
          'x-user-role': 'director'
        },
        body: JSON.stringify({
          provider: config.defaultChannel,
          defaultChannel: config.defaultChannel,
          textbeeApiKey: config.textbeeApiKey,
          textbeeDeviceId: config.textbeeDeviceId,
          textbeeEnabled: config.textbeeEnabled,
          whatsappEnabled: config.whatsappEnabled
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر حفظ الإعدادات');
      }

      setSaveSuccess('تم حفظ إعدادات قنوات الإشعارات بنجاح ✓');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  // Test Textbee Connection & SMS
  const handleTestTextbee = async () => {
    if (!config.textbeeApiKey.trim() || !config.textbeeDeviceId.trim()) {
      setErrorMsg('يرجى إدخال كل من API Key و Device ID أولاً لاختبار بوابة textbee.dev');
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      setErrorMsg(null);

      const res = await fetch('/api/admin/sms-gateway/test-textbee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'director'
        },
        body: JSON.stringify({
          apiKey: config.textbeeApiKey.trim(),
          deviceId: config.textbeeDeviceId.trim(),
          testPhone: testPhone.trim() || undefined
        })
      });

      const data = await res.json();
      setTestResult(data);
      fetchLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'فشل الاتصال بخوادم textbee.dev'
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
          <div className="w-14 h-14 rounded-2xl bg-black/40 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
            <ShieldCheck className="w-8 h-8 text-amber-300" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold mb-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>محرك إشعارات أولياء الأمور • خاص بمدير المؤسسة فقط</span>
            </div>
            <h2 className="text-xl font-bold font-serif text-white tracking-wide">
              إعدادات قنوات إرسال الإشعارات (واتساب عادي / textbee.dev)
            </h2>
            <p className="text-xs text-[#F2EFE3]/80 mt-1 max-w-xl leading-relaxed">
              يقوم مدير المؤسسة حصرياً بإرسال إشعارات الغياب والمخالفات والاستدعاءات لأولياء الأمور عبر خيارين: <b>واتساب عادي</b> أو <b>بوابة textbee.dev</b>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchConfig();
            fetchLogs();
          }}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث الحالة</span>
        </button>
      </div>

      {/* Save Success / Error Messages */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-500/40 text-emerald-950 font-bold text-xs flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-500/40 text-rose-950 font-bold text-xs flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Settings */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Channel Selection Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E5DFD4] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-[#1A4E47]" />
              <h3 className="font-bold text-base text-[#1F2926]">
                القناة الافتراضية المعتمدة للمؤسسة:
              </h3>
            </div>
            <span className="text-xs text-gray-500 font-bold">
              يمكنك التبديل بينهما في أي وقت عند إرسال أي إشعار
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp Standard */}
            <label
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                config.defaultChannel === 'whatsapp'
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="defaultChannel"
                value="whatsapp"
                checked={config.defaultChannel === 'whatsapp'}
                onChange={() => setConfig({ ...config, defaultChannel: 'whatsapp' })}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-700" />
                  <span className="font-bold text-sm text-gray-900">واتساب عادي (WhatsApp Standard)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    جاهز ومجاني
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  يفتح محادثة واتساب الرسمية مع ولي الأمر بنقرة واحدة عبر الحاسوب أو الهاتف، مع رسالة تربوية مهيأة بالكامل.
                </p>
              </div>
            </label>

            {/* textbee.dev SMS */}
            <label
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                config.defaultChannel === 'textbee'
                  ? 'border-sky-600 bg-sky-50/70 shadow-xs'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="defaultChannel"
                value="textbee"
                checked={config.defaultChannel === 'textbee'}
                onChange={() => setConfig({ ...config, defaultChannel: 'textbee' })}
                className="mt-1 text-sky-600 focus:ring-sky-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-700" />
                  <span className="font-bold text-sm text-gray-900">بوابة textbee.dev (SMS Gateway)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                    رسائل SMS
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  إرسال رسائل SMS نصية مباشرة إلى هواتف أولياء الأمور عبر تطبيق هاتف أندرويد المؤسسة المرتبط بمنصة textbee.dev.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Textbee.dev Configuration Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E5DFD4] shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-sky-700" />
              <div>
                <h3 className="font-bold text-base text-[#1F2926]">
                  إعدادات بوابة textbee.dev (SMS Gateway)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  اربط هاتف أندرويد المؤسسة لإرسال رسائل SMS للأولياء عبر المنصة العالمية textbee.dev
                </p>
              </div>
            </div>
            <a
              href="https://textbee.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-700 hover:text-sky-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>موقع textbee.dev الرسمي</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Quick Setup Instructions */}
          <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 text-xs text-sky-950 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-sky-900">
              <Info className="w-4 h-4 text-sky-700" />
              <span>خطوات الربط السريع مع textbee.dev:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 pr-1 text-[11px] text-sky-900/90 leading-relaxed">
              <li>قم بإنشاء حساب مجاني على موقع <b>textbee.dev</b>.</li>
              <li>قم بتحميل وتثبيت تطبيق Textbee على هاتف أندرويد المؤسسة (المزود ببطاقة SIM لإرسال SMS).</li>
              <li>قم بتسجيل الدخول في التطبيق، وسيعطيك الـ <b>Device ID</b> الخاص بالجهاز.</li>
              <li>انسخ كلاً من <b>API Key</b> و <b>Device ID</b> من لوحة تحكم textbee.dev وضعهما في الحقول أدناه.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-sky-700" />
                <span>مفتاح الـ API الخاص بالحساب (API Key):</span>
              </label>
              <input
                type="password"
                value={config.textbeeApiKey}
                onChange={(e) => setConfig({ ...config, textbeeApiKey: e.target.value })}
                placeholder="مثال: tb_api_live_xxxxxxxx..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20 outline-none text-xs font-mono bg-white text-left dir-ltr"
              />
              <span className="text-[10px] text-gray-500">
                يمكن العثور عليه في Dashboard → API Keys على منصة textbee.dev.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-sky-700" />
                <span>معرف جهاز أندرويد (Device ID):</span>
              </label>
              <input
                type="text"
                value={config.textbeeDeviceId}
                onChange={(e) => setConfig({ ...config, textbeeDeviceId: e.target.value })}
                placeholder="مثال: 64f8c2b7a9e1..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20 outline-none text-xs font-mono bg-white text-left dir-ltr"
              />
              <span className="text-[10px] text-gray-500">
                يظهر في تطبيق Textbee على الهاتف أو في صفحة Devices بالمنصة.
              </span>
            </div>
          </div>

          {/* Test Textbee Box */}
          <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAF8F5] p-3.5 rounded-2xl">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-gray-800 block">
                اختبار الاتصال وإرسال SMS تجريبي:
              </label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="رقم الهاتف للاختبار: 06XXXXXXXX"
                className="w-full sm:w-64 px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-mono text-left dir-ltr bg-white"
              />
            </div>
            <button
              type="button"
              onClick={handleTestTextbee}
              disabled={isTesting || !config.textbeeApiKey || !config.textbeeDeviceId}
              className="px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري اختبار الاتصال...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>اختبار بوابة textbee.dev 🚀</span>
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-start gap-2.5 animate-in fade-in ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-rose-50 border-rose-400 text-rose-950'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <span>{testResult.message}</span>
                {testResult.messageId && (
                  <span className="block font-mono text-[10px] text-gray-600">
                    معرف الرسالة: {testResult.messageId}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp Standard Information Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E5DFD4] shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <MessageSquare className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-base text-[#1F2926]">
              واتساب عادي (WhatsApp Standard Direct)
            </h3>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5 leading-relaxed">
            <p>
              ✓ خدمة <b>واتساب عادي</b> مدمجة بالكامل وتعمل بشكل فوري بدون أي اشتراك أو تكلفة مالية أو متطلبات تقنية.
            </p>
            <p>
              ✓ عند الضغط على إرسال إشعار، يقوم النظام بتجهيز النص الرسمي المعتمد وفتح تطبيق واتساب على جهاز المدير فوراً متضمناً رقم هاتف ولي الأمر والنص الكامل، ليرسله المدير بنقرة واحدة.
            </p>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 rounded-2xl bg-[#1A4E47] hover:bg-[#143E38] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>جاري حفظ الإعدادات...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-amber-300" />
                <span>حفظ إعدادات بوابات الإشعارات ✓</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Dispatch History Logs */}
      <div className="bg-white rounded-3xl p-6 border border-[#E5DFD4] shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#1A4E47]" />
            <div>
              <h3 className="font-bold text-base text-[#1F2926]">
                سجل الإشعارات المرسلة لأولياء الأمور
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                تتبع العمليات الصادرة عبر واتساب عادي وبوابة textbee.dev
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="text-xs text-[#1A4E47] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs">
            لا توجد إشعارات مسجلة حديثاً في السجل.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#FAF8F5] text-gray-700 sticky top-0">
                <tr>
                  <th className="p-2.5 font-bold">التوقيت</th>
                  <th className="p-2.5 font-bold">هاتف ولي الأمر</th>
                  <th className="p-2.5 font-bold">نوع الإشعار</th>
                  <th className="p-2.5 font-bold">القناة المستخدمة</th>
                  <th className="p-2.5 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-2.5 text-gray-500 font-mono text-[11px]">
                      {new Date(log.sentAt).toLocaleTimeString('ar-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(log.sentAt).toLocaleDateString('ar-MA')}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-gray-800 dir-ltr text-right">
                      {log.toPhone}
                    </td>
                    <td className="p-2.5 font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px]">
                        {log.code === 'absence' ? 'غياب' : log.code === 'violation' ? 'مخالفة' : log.code === 'summons' ? 'استدعاء' : log.code}
                      </span>
                    </td>
                    <td className="p-2.5 text-gray-700 font-medium">
                      {log.gateway}
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.status === 'delivered' ? 'ناجح ✓' : log.status === 'pending' ? 'قيد الإرسال' : 'تعذر'}
                      </span>
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
