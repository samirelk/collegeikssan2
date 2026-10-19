import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Save,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Radio,
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';

interface AndroidGatewayConfig {
  enabled: boolean;
  url: string;
  token?: string;
  schoolPhone?: string;
  defaultChannel: 'whatsapp' | 'android_sms' | 'both';
}

interface SmsLog {
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
  const [config, setConfig] = useState<AndroidGatewayConfig>({
    enabled: false,
    url: '',
    token: '',
    schoolPhone: '',
    defaultChannel: 'whatsapp'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Fetch current config
  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/admin/sms-gateway/config');
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر تحميل إعدادات بوابة SMS');
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
        body: JSON.stringify(config)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر حفظ الإعدادات');
      }

      setSaveSuccess('تم حفظ إعدادات بوابة هاتف الإدارة بنجاح ✓');
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
      setErrorMsg('يرجى كتابة رقم هاتف لإرسال رسالة الاختبار إليه');
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
          url: config.url,
          token: config.token,
          testPhone: testPhone.trim()
        })
      });

      const data = await res.json();
      setTestResult(data);
      fetchLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'فشل الاتصال بهاتف الإدارة'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#1A4E47] via-[#16433D] to-[#1A4E47] text-white shadow-lg border border-[#C98A3C]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-[#C98A3C] flex items-center justify-center text-[#FDE047] shadow-inner shrink-0">
            <Smartphone className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold font-['Amiri',serif] m-0">
                بوابة هاتف الإدارة للرسائل القصيرة (Android SMS Gateway)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-bold">
                أوفر حل بالمغرب 🇲🇦
              </span>
            </div>
            <p className="text-xs text-white/80 mt-1 max-w-2xl leading-relaxed">
              تحويل أي هاتف أندرويد عادي في مكتب الإدارة مع شريحة SIM عادية (فورفي غير محدود بـ 49 إلى 99 درهم شهرياً) إلى خادم إرسال رسائل SMS أوتوماتيكي ومباشر لأولياء الأمور دون دفع 2 دراهم للرسالة الواحدة!
            </p>
          </div>
        </div>

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
        {/* Left Column: Configuration Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-[#E5DFD4] shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-[#1A4E47]" />
                <h3 className="font-bold text-base text-[#1F2926]">إعدادات بوابة هاتف الإدارة</h3>
              </div>

              {/* Enable / Disable Switch */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-bold text-[#1F2926]">
                  {config.enabled ? 'البوابة مفعلة ✓' : 'البوابة معطلة'}
                </span>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="space-y-4">
              {/* Gateway URL */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  رابط خادم التطبيق على هاتف الأندرويد (Gateway Endpoint URL) *
                </label>
                <input
                  type="url"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="مثال: http://192.168.1.50:8080/send أو https://api.sms-gate.app/3rdparty/v1/message"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-[#1A4E47] focus:ring-2 focus:ring-[#1A4E47]/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
                />
                <p className="text-[11px] text-[#6C6356] mt-1">
                  الرابط الذي يظهره تطبيق SMS Gateway عند تشغيله على هاتف الإدارة (محلياً أو سحابياً).
                </p>
              </div>

              {/* Gateway Token */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  رمز الأمان / كلمة المرور البرمجية (API Token / Key) (اختياري)
                </label>
                <input
                  type="password"
                  value={config.token || ''}
                  onChange={(e) => setConfig({ ...config, token: e.target.value })}
                  placeholder="أدخل رمز الحماية إن تم تفعيله في تطبيق هاتف الأندرويد"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-[#1A4E47] focus:ring-2 focus:ring-[#1A4E47]/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
                />
              </div>

              {/* School Phone Number */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  رقم هاتف شريحة الإدارة (رقم الهاتف الموجود بالهاتف)
                </label>
                <input
                  type="tel"
                  value={config.schoolPhone || ''}
                  onChange={(e) => setConfig({ ...config, schoolPhone: e.target.value })}
                  placeholder="مثال: 0612345678"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-[#1A4E47] focus:ring-2 focus:ring-[#1A4E47]/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
                />
                <p className="text-[11px] text-[#6C6356] mt-1">
                  الرقم الذي يتلقى منه أولياء الأمور الرسائل النصية الرسمية للإدارة.
                </p>
              </div>

              {/* Channel Preference */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1.5">
                  قنوات التحقق المعتمدة للتلاميذ وأولياء الأمور
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${config.defaultChannel === 'whatsapp' ? 'bg-[#E8F2F0] border-[#1A4E47] text-[#1A4E47] font-bold' : 'bg-[#FAF8F5] border-[#E5DFD4] text-[#6C6356]'}`}>
                    <input
                      type="radio"
                      name="defaultChannel"
                      value="whatsapp"
                      checked={config.defaultChannel === 'whatsapp'}
                      onChange={() => setConfig({ ...config, defaultChannel: 'whatsapp' })}
                      className="text-[#1A4E47]"
                    />
                    <span className="text-xs">واتساب أولاً (مجاني) 💬</span>
                  </label>

                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${config.defaultChannel === 'android_sms' ? 'bg-[#E8F2F0] border-[#1A4E47] text-[#1A4E47] font-bold' : 'bg-[#FAF8F5] border-[#E5DFD4] text-[#6C6356]'}`}>
                    <input
                      type="radio"
                      name="defaultChannel"
                      value="android_sms"
                      checked={config.defaultChannel === 'android_sms'}
                      onChange={() => setConfig({ ...config, defaultChannel: 'android_sms' })}
                      className="text-[#1A4E47]"
                    />
                    <span className="text-xs">SMS هاتف الإدارة 📱</span>
                  </label>

                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${config.defaultChannel === 'both' ? 'bg-[#E8F2F0] border-[#1A4E47] text-[#1A4E47] font-bold' : 'bg-[#FAF8F5] border-[#E5DFD4] text-[#6C6356]'}`}>
                    <input
                      type="radio"
                      name="defaultChannel"
                      value="both"
                      checked={config.defaultChannel === 'both'}
                      onChange={() => setConfig({ ...config, defaultChannel: 'both' })}
                      className="text-[#1A4E47]"
                    />
                    <span className="text-xs">كلاهما متاحان للتلميذ ⭐</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5DFD4] flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C98A3C]" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-[#C98A3C]" />
                    <span>حفظ إعدادات البوابة</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Test Dispatch Tool */}
          <div className="bg-white p-6 rounded-3xl border border-[#E5DFD4] shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#E5DFD4]">
              <Send className="w-5 h-5 text-amber-700" />
              <h3 className="font-bold text-base text-[#1F2926]">اختبار إرسال رسالة تجريبية فورية</h3>
            </div>

            <p className="text-xs text-[#6C6356]">
              أدخل رقم هاتفك الشخصي للتأكد من أن هاتف الإدارة متصل بالشبكة ويقوم بإرسال الرسائل فعلياً عبر شريحته:
            </p>

            <div className="flex gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="مثال: 0612345678 أو 0712345678"
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#D5CDC0] focus:border-[#1A4E47] focus:ring-2 focus:ring-[#1A4E47]/20 outline-none text-xs font-mono bg-[#FAF8F5] text-left dir-ltr"
              />

              <button
                type="button"
                onClick={handleTestSend}
                disabled={isTesting || !testPhone.trim()}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 shrink-0"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الإرسال للتجربة...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>إرسال رسالة اختبار الآن 🚀</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-rose-50 border-rose-200 text-rose-950 font-medium'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-bold">
                    {testResult.success ? 'نجح الإرسال عبر هاتف الإدارة! ✓' : 'تعذر الإرسال عبر هاتف الإدارة:'}
                  </div>
                  <div className="text-[11px] leading-relaxed">{testResult.message}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Practical Step-by-Step Guide (1 col) */}
        <div className="space-y-6">
          <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#E5DFD4] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E5DFD4] text-[#1A4E47] font-bold text-sm">
              <HelpCircle className="w-5 h-5 text-[#C98A3C]" />
              <span>دليل التثبيت والتشغيل (3 خطوات بسيطة)</span>
            </div>

            <ol className="space-y-3.5 text-xs text-[#4F4335] pr-4 list-decimal leading-relaxed">
              <li>
                <strong className="text-[#1F2926] block mb-0.5">شريحة SIM مع فورفي SMS:</strong>
                ضع شريحة هاتف عادية (اتصالات المغرب، إنوي، أو أورنج) عليها عرض رسائل غير محدود (Forfait SMS Illimité) في هاتف أندرويد الإدارة.
              </li>
              <li>
                <strong className="text-[#1F2926] block mb-0.5">تثبيت تطبيق Gateway المجاني:</strong>
                حمّل أحد التطبيقات المجانية الخفيفة التالية على هاتف الأندرويد:
                <div className="mt-2 space-y-1.5 font-sans">
                  <div className="p-2 rounded-xl bg-white border border-[#E5DFD4]">
                    <div className="font-bold text-[#1A4E47] flex items-center justify-between">
                      <span>1. SMS Gateway for Android</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">موصى به ⭐</span>
                    </div>
                    <div className="text-[10px] text-[#6C6356] mt-0.5">
                      تطبيق مجاني وخفيف (sms-gate.app)، يعطيك رابط السيرفر المحلي أو السحابي بضغطة زر واحدة.
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-[#E5DFD4]">
                    <div className="font-bold text-[#1F2926]">2. Traccar SMS Gateway</div>
                    <div className="text-[10px] text-[#6C6356] mt-0.5">
                      تطبيق مفتوح المصدر ومجاني بدون أي إعلانات.
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-[#E5DFD4]">
                    <div className="font-bold text-[#1F2926]">3. Textbee.dev</div>
                    <div className="text-[10px] text-[#6C6356] mt-0.5">
                      يوفر رابط سحابي مجاني يعمل في أي مكان دون الحاجة لوجود الهاتف على نفس شبكة Wi-Fi.
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <strong className="text-[#1F2926] block mb-0.5">تشغيل الخادم ونسخ الرابط:</strong>
                اضغط على زر «Start Server» في التطبيق على الهاتف، وانسخ الرابط الذي يظهره التطبيق وضعه في خانة رابط الخادم أعلاه، واضغط حفظ!
              </li>
            </ol>
          </div>

          {/* WhatsApp info badge */}
          <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
              <span className="text-base">💬</span>
              <span>خيار واتساب (WhatsApp) نشط دائماً</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              خيار إرسال رمز التحقق عبر واتساب متاح دائماً مجاناً لجميع التلاميذ وأولياء الأمور بنقرة واحدة كبديل فوري وبدون أي اشتراكات أو أجهزة إضافية.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent SMS Dispatch Logs */}
      <div className="bg-white p-6 rounded-3xl border border-[#E5DFD4] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#1A4E47]" />
            <h3 className="font-bold text-base text-[#1F2926]">سجل أحدث عمليات إرسال الرسائل (SMS Dispatch Logs)</h3>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="text-xs font-bold text-[#1A4E47] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6C6356] bg-[#FAF8F5] rounded-2xl">
            لا توجد عمليات إرسال مسجلة حتى الآن. عند طلب أي تلميذ أو ولي أمر لرمز التحقق، ستظهر العملية هنا مع حالتها.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5DFD4] text-[#6C6356] bg-[#FAF8F5]">
                  <th className="p-3 font-bold">رقم المستلم</th>
                  <th className="p-3 font-bold">المرسل</th>
                  <th className="p-3 font-bold">البوابة المستخدمة</th>
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
                    <td className="p-3 font-medium text-[#1A4E47]">{log.senderName}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F2F0] text-[#1A4E47] border border-[#1A4E47]/20">
                        {log.gateway}
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
