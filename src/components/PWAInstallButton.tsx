import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'floating';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running inside standalone PWA, hide install prompts
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (isInstallable) {
      setIsInstalling(true);
      const success = await install();
      setIsInstalling(false);
      if (!success) {
        setShowAndroidGuide(true);
      }
      return;
    }
    // If not iOS and prompt not ready yet, show mobile instructions
    setShowAndroidGuide(true);
  };

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          title="تثبيت التطبيق على هاتفك المحمول كبرنامج مستقل"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border ${
            isIOS
              ? 'bg-[#EBF1FA] text-[#1E3A8A] border-[#1E3A8A]/20 hover:bg-[#DCE6F5]'
              : 'bg-gradient-to-r from-[#0F2445] to-[#1E3A8A] text-[#FDE88F] border-[#E5B242]/40 hover:brightness-110 active:scale-95'
          } ${className}`}
        >
          <img src="/pwa-192x192.png" alt="أيقونة المدرسة" className="w-4 h-4 rounded-md object-cover shadow-2xs shrink-0" />
          <span className="hidden sm:inline">تثبيت التطبيق بالهاتف</span>
          <span className="sm:hidden">تثبيت</span>
          <Download className="w-3 h-3 text-[#FDE88F]/90 shrink-0" />
        </button>
      )}

      {variant === 'banner' && (
        <div className={`p-4 rounded-2xl bg-gradient-to-r from-[#0A1E46] via-[#12326C] to-[#071533] text-white border border-[#FDE88F]/40 shadow-md ${className}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-right">
              <div className="w-12 h-12 rounded-xl bg-[#071533] border border-[#FDE88F]/50 flex items-center justify-center shrink-0 shadow-inner overflow-hidden p-1">
                <img src="/pwa-192x192.png" alt="أيقونة المدرسة" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#FDE88F] flex items-center gap-1.5">
                  تثبيت تطبيق المدرسة الرقمية على هاتفك
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E5B242]/20 border border-[#E5B242]/40 text-[#FDE88F]">
                    PWA سريع
                  </span>
                </h4>
                <p className="text-xs text-[#E2E8F0]/85 mt-0.5">
                  احصل على وصول مباشر وفوري من شاشة هاتفك مثل تطبيق أصلي بأيقونة المدرسة الرسمية
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#E5B242] hover:bg-[#FDE88F] text-[#0A1E46] font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4 text-[#0A1E46]" />
              <span>{isIOS ? 'طريقة التثبيت على الآيفون' : 'تثبيت الآن على الهاتف'}</span>
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Guided Install Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-[#FAF8F5] p-6 shadow-2xl border border-[#D5CDC0] text-right">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#0A1E46] border border-[#E5B242]/40 flex items-center justify-center shrink-0 overflow-hidden shadow-xs p-1">
                  <img src="/pwa-192x192.png" alt="أيقونة المدرسة" className="w-full h-full object-cover rounded-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F2926]">تثبيت التطبيق على iPhone / iPad</h3>
                  <p className="text-[11px] text-[#7A6B58]">أيقونة المدرسة الرسمية على شاشة هاتفك</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 rounded-lg text-[#7A6B58] hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 space-y-3.5 text-xs text-[#2A2118]">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E5DFD4]">
                <div className="w-7 h-7 rounded-lg bg-[#EAE5D9] text-[#164E3F] flex items-center justify-center font-bold shrink-0">
                  1
                </div>
                <div>
                  <div className="font-bold mb-0.5 flex items-center gap-1.5">
                    اضغط على زر المشاركة <Share className="w-3.5 h-3.5 text-blue-600 inline" />
                  </div>
                  <p className="text-[#6C6356] text-[11px]">
                    ستجد زر المشاركة (مربع مع سهم للأعلى) في أسفل شاشة متصفح Safari (أو في الأعلى على الآيباد).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E5DFD4]">
                <div className="w-7 h-7 rounded-lg bg-[#EAE5D9] text-[#164E3F] flex items-center justify-center font-bold shrink-0">
                  2
                </div>
                <div>
                  <div className="font-bold mb-0.5 flex items-center gap-1.5">
                    اختر "إضافة إلى الشاشة الرئيسية" <PlusSquare className="w-3.5 h-3.5 text-emerald-700 inline" />
                  </div>
                  <p className="text-[#6C6356] text-[11px]">
                    مرر القائمة للأسفل قليلاً واضغط على خيار (Add to Home Screen).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E5DFD4]">
                <div className="w-7 h-7 rounded-lg bg-[#EAE5D9] text-[#164E3F] flex items-center justify-center font-bold shrink-0">
                  3
                </div>
                <div>
                  <div className="font-bold mb-0.5 flex items-center gap-1.5">
                    اضغط على "إضافة" (Add) في الزاوية العلوية
                  </div>
                  <p className="text-[#6C6356] text-[11px]">
                    سيظهر رمز التطبيق مباشرة على شاشة هاتفك مع إمكانية فتحه بكامل الشاشة وبدون أشرطة التصفح.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5DFD4] flex items-center justify-between">
              <span className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> تطبيق ويب تقدمي رسمي
              </span>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="px-5 py-2 rounded-xl bg-[#1F3E32] text-white hover:bg-[#2B5444] text-xs font-bold transition shadow-xs cursor-pointer"
              >
                فهمت، حسناً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Android / Chrome Guided Install Modal */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-[#FAF8F5] p-6 shadow-2xl border border-[#D5CDC0] text-right">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#0A1E46] border border-[#E5B242]/40 flex items-center justify-center shrink-0 overflow-hidden shadow-xs p-1">
                  <img src="/pwa-192x192.png" alt="أيقونة المدرسة" className="w-full h-full object-cover rounded-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F2926]">تثبيت التطبيق على هاتف Android</h3>
                  <p className="text-[11px] text-[#7A6B58]">بأيقونة المدرسة الرسمية على شاشة هاتفك</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAndroidGuide(false)}
                className="p-1.5 rounded-lg text-[#7A6B58] hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 space-y-3.5 text-xs text-[#2A2118]">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E5DFD4]">
                <div className="w-7 h-7 rounded-lg bg-[#EAE5D9] text-[#164E3F] flex items-center justify-center font-bold shrink-0">
                  1
                </div>
                <div>
                  <div className="font-bold mb-0.5 flex items-center gap-1.5">
                    افتح قائمة المتصفح (⋮)
                  </div>
                  <p className="text-[#6C6356] text-[11px]">
                    اضغط على أيقونة الثلاث نقاط الرأسية في أعلى يسار أو يمين متصفح Chrome في هاتفك.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E5DFD4]">
                <div className="w-7 h-7 rounded-lg bg-[#EAE5D9] text-[#164E3F] flex items-center justify-center font-bold shrink-0">
                  2
                </div>
                <div>
                  <div className="font-bold mb-0.5 flex items-center gap-1.5 text-emerald-800">
                    اضغط على "تثبيت التطبيق" (Install app) أو "إضافة إلى الشاشة الرئيسية"
                  </div>
                  <p className="text-[#6C6356] text-[11px]">
                    ستظهر لك رسالة تأكيد التثبيت مع اسم وأيقونة المنظومة الرسمية.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E5DFD4]">
                <div className="w-7 h-7 rounded-lg bg-[#EAE5D9] text-[#164E3F] flex items-center justify-center font-bold shrink-0">
                  3
                </div>
                <div>
                  <div className="font-bold mb-0.5 flex items-center gap-1.5">
                    اضغط على "تثبيت" (Install)
                  </div>
                  <p className="text-[#6C6356] text-[11px]">
                    سيتم تنزيل الأيقونة وإضافتها لشاشتك الرئيسية، ويمكن فتح المنظومة مباشرة كتطبيق هاتف سريع ومستقل!
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5DFD4] flex items-center justify-between">
              <span className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> تثبيت آمن بدون متجر Play
              </span>
              <button
                type="button"
                onClick={() => setShowAndroidGuide(false)}
                className="px-5 py-2 rounded-xl bg-[#1F3E32] text-white hover:bg-[#2B5444] text-xs font-bold transition shadow-xs cursor-pointer"
              >
                فهمت، حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
