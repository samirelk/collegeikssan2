import React, { useState } from 'react';
import {
  Globe,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Server,
  Download,
  Smartphone,
  Laptop,
  X,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

interface CustomDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainName?: string;
  appTitle?: string;
}

export const CustomDomainModal: React.FC<CustomDomainModalProps> = ({
  isOpen,
  onClose,
  domainName = 'ikssan.lyceecom.com',
  appTitle = 'المدرسة الرقمية • ثانوية إيكسان'
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  const dnsRecords = [
    {
      type: 'CNAME',
      name: 'ikssan',
      value: 'ghs.googlehosted.com.',
      ttl: '3600 (أو تلقائي Auto)',
      desc: 'توجيه النطاق الفرعي ikssan التابع لـ lyceecom.com إلى خوادم Google Cloud الرسمية المشغلة للتطبيق'
    },
    {
      type: 'TXT (اختياري للتحقق)',
      name: 'ikssan',
      value: 'google-site-verification=...',
      ttl: '3600',
      desc: 'إثبات ملكية النطاق في Google Search Console / Google Cloud Domains إن طلب ذلك'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-[#E5DFD4] overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="bg-[#1A4E47] text-white p-5 sm:p-6 border-b border-[#C98A3C]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#C98A3C] shadow-inner">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">دليل ربط وتثبيت التطبيق على النطاق المخصص</h3>
              <p className="text-xs text-white/80 font-mono dir-ltr text-right mt-0.5">
                https://{domainName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto text-right">
          {/* Status banner */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <strong className="block font-bold text-sm text-emerald-900">
                النطاق المخصص المشترى من Google: {domainName}
              </strong>
              <p className="text-emerald-800 leading-relaxed">
                التطبيق مهيأ بالكامل للعمل كمنظومة ويب متقدمة (PWA) تدعم التثبيت المباشر على الهواتف الذكية والحواسيب مع شهادة أمان SSL/HTTPS مشفرة مجاناً وتلقائياً.
              </p>
            </div>
          </div>

          {/* STEP 1: DNS Configuration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1F2926] border-b border-[#E5DFD4] pb-2">
              <span className="w-6 h-6 rounded-lg bg-[#1A4E47] text-white flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>خطوات ضبط سجلات DNS في لوحة تحكم Google Domains / Squarespace</span>
            </div>

            <ol className="text-xs text-[#5E6D66] space-y-2.5 list-decimal list-inside pr-1">
              <li>
                افتح حسابك في <strong className="text-[#1F2926]">Google Domains</strong> (أو Squarespace Domains بعد انتقال إدارة نطاقات غوغل إليها).
              </li>
              <li>
                انتقل إلى إدارة النطاق الرئيسي: <strong className="font-mono text-[#1A4E47]">lyceecom.com</strong> ثم اضغط على قسم <strong className="text-[#1F2926]">DNS</strong> (أو إدارة السجلات DNS Records).
              </li>
              <li>
                أضف سجل <strong className="text-[#1F2926]">CNAME</strong> جديداً بالقيم الموضحة في الجدول أسفله:
              </li>
            </ol>

            {/* DNS Records Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#E5DFD4] shadow-xs">
              <table className="w-full text-xs text-right">
                <thead className="bg-[#FAF8F5] text-[#1F2926] font-bold border-b border-[#E5DFD4]">
                  <tr>
                    <th className="p-3">نوع السجل (Type)</th>
                    <th className="p-3">الاسم / المضيف (Host)</th>
                    <th className="p-3">القيمة / الوجهة (Value / Target)</th>
                    <th className="p-3">المدة (TTL)</th>
                    <th className="p-3 text-center">نسخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD4]">
                  {dnsRecords.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-[#1A4E47]">{rec.type}</td>
                      <td className="p-3 font-mono font-bold text-gray-900 dir-ltr text-right">{rec.name}</td>
                      <td className="p-3 font-mono text-gray-800 dir-ltr text-right max-w-xs truncate" title={rec.value}>
                        {rec.value}
                      </td>
                      <td className="p-3 font-mono text-gray-600">{rec.ttl}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleCopy(rec.value, `dns_${idx}`)}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#E5DFD4] text-[#1A4E47] border border-[#D5E2DF] font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                        >
                          {copiedKey === `dns_${idx}` ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === `dns_${idx}` ? 'تم النسخ' : 'نسخ'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[#6C6356] bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              💡 <strong>ملاحظة تقنية:</strong> يستغرق انتشار سجلات DNS الجديدة ما بين 15 دقيقة إلى ساعتين كحد أقصى، وتقوم غوغل بإصدار شهادة الأمان SSL/HTTPS وتفعيلها تلقائياً بدون أي تكلفة إضافية.
            </p>
          </div>

          {/* STEP 2: Installation as App (PWA) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1F2926] border-b border-[#E5DFD4] pb-2">
              <span className="w-6 h-6 rounded-lg bg-[#C98A3C] text-white flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>طريقة تثبيت التطبيق على الهواتف الذكية والحواسيب (PWA)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Android & iOS Phone Install */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A4E47]">
                  <Smartphone className="w-4 h-4 text-[#C98A3C]" />
                  <span>تثبيت على هواتف الأندرويد والآيفون</span>
                </div>
                <ul className="text-xs text-[#5E6D66] space-y-1.5 list-disc list-inside">
                  <li>
                    افتح المتصفح (Chrome أو Safari) واكتب: <strong className="font-mono text-[#1F2926]">ikssan.lyceecom.com</strong>.
                  </li>
                  <li>
                    اضغط على قائمة المتصفح (⋮) أو زر المشاركة (<ExternalLink className="w-3 h-3 inline mx-0.5" />).
                  </li>
                  <li>
                    اختر <strong className="text-emerald-800">"تثبيت التطبيق" (Install App)</strong> أو <strong className="text-emerald-800">"إضافة إلى الشاشة الرئيسية" (Add to Home screen)</strong>.
                  </li>
                  <li>
                    يظهر التطبيق كأيقونة مستقلة بشاشة هاتفك تعمل بكامل الشاشة وبدون شريط المتصفح.
                  </li>
                </ul>
              </div>

              {/* PC & Mac Install */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A4E47]">
                  <Laptop className="w-4 h-4 text-[#C98A3C]" />
                  <span>تثبيت على حواسيب الإدارة والأساتذة (Windows / Mac)</span>
                </div>
                <ul className="text-xs text-[#5E6D66] space-y-1.5 list-disc list-inside">
                  <li>
                    افتح الرابط في متصفح <strong className="text-[#1F2926]">Google Chrome</strong> أو <strong className="text-[#1F2926]">Microsoft Edge</strong>.
                  </li>
                  <li>
                    ستظهر أيقونة كمبيوتر صغيرة (<Download className="w-3 h-3 inline mx-0.5" />) في شريط العنوان بالأعلى تطلب "تثبيت تطبيق المنظومة".
                  </li>
                  <li>
                    اضغط على <strong className="text-emerald-800">تثبيت (Install)</strong> لتفتح المنظومة في نافذة سطح مكتب مستقلة سريعة وخفيفة.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Quick Copy Link for Sharing */}
          <div className="p-4 rounded-2xl bg-[#1A4E47]/5 border border-[#1A4E47]/20 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-bold text-[#1A4E47]">رابط المنظومة الرسمي لتوزيعه على الأساتذة والتلاميذ:</div>
              <div className="font-mono text-xs text-gray-700 font-bold dir-ltr text-right mt-0.5">
                https://{domainName}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(`https://${domainName}`, 'full_url')}
              className="px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {copiedKey === 'full_url' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>تم نسخ الرابط!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#C98A3C]" />
                  <span>نسخ الرابط الرسمي</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#E5DFD4] flex items-center justify-between">
          <span className="text-xs text-[#6C6356]">
            الثانوية الإعدادية إيكسان • بوابة lyceecom.com
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
