import React, { useState } from 'react';
import {
  GraduationCap,
  KeyRound,
  LogIn,
  AlertCircle,
  HelpCircle,
  QrCode,
  Sparkles,
  School,
  ArrowRight
} from 'lucide-react';
import { StudentData } from './StudentPortalDashboard';

interface StudentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (data: StudentData) => void;
  institutionName: string;
}

export const StudentLoginModal: React.FC<StudentLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  institutionName
}) => {
  const [massarNumber, setMassarNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanMassar = massarNumber.trim();
    const cleanCode = accessCode.trim();

    if (!cleanMassar || !cleanCode) {
      setErrorMessage('يرجى كتابة رقم مسار والكود السري');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          massarNumber: cleanMassar,
          accessCode: cleanCode
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'تعذر تسجيل الدخول، تأكد من صحة رقم مسار والكود');
      }

      onLoginSuccess(json);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء الاتصال');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#E5DFD4] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#1A4E47] text-white p-6 relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#C98A3C]/20 rounded-full blur-xl pointer-events-none"></div>

          <div className="w-14 h-14 rounded-2xl bg-[#133D37] border-2 border-[#C98A3C]/60 flex items-center justify-center mx-auto mb-3 shadow-md text-[#C98A3C]">
            <GraduationCap className="w-8 h-8 text-[#C98A3C]" />
          </div>

          <h2 className="text-xl font-bold font-serif text-white tracking-wide">
            فضاء التلميذ • بوابة المتابعة المدرسية
          </h2>
          <p className="text-xs text-[#F2EFE3]/80 mt-1 max-w-xs mx-auto">
            {institutionName} • الاطلاع على الغيابات، الحصص، ونقاط التميز
          </p>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 text-white/70 hover:text-white font-bold text-lg p-1 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#1F2926] mb-1">
              رقم مسار للتلميذ (Code Massar)
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={massarNumber}
                onChange={(e) => setMassarNumber(e.target.value)}
                placeholder="مثال: G134567891 أو K12345678"
                className="w-full pr-3 pl-3 py-2.5 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono text-sm uppercase placeholder:normal-case"
                autoFocus
              />
            </div>
            <span className="text-[10px] text-[#6C6356] block mt-0.5">
              الحرف الأول متبوعاً بالأرقام كما هو مسجل في بطاقة التلميذ
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1F2926] mb-1">
              الكود السري للولوج (Access Code / PIN)
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="الكود المكون من 6 أرقام"
                className="w-full pr-3 pl-3 py-2.5 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono text-sm tracking-widest"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E5DFD4] text-[11px] text-[#6C6356] leading-relaxed flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-[#C98A3C] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#1F2926] block">كيف أحصل على الكود السري؟</strong>
              يتم تسليم كود الولوج السري لكل تلميذ من طرف إدارة المؤسسة أو الحارس العام. إذا أضعت كودك، يرجى التوجه لمكتب الإدارة.
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-sm rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? 'جاري التحقق...' : 'دخول فضاء التلميذ'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
