import React, { useState, useEffect } from 'react';
import {
  User,
  Calendar,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  Sparkles
} from 'lucide-react';
import { User as UserType } from '../types';

interface TeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  onProfileUpdated: (updatedUser: UserType) => void;
}

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated
}) => {
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [username, setUsername] = useState(currentUser.username);
  const [email, setEmail] = useState(currentUser.email);
  const [academicYear, setAcademicYear] = useState(currentUser.academicYear || '2026/2027');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFullName(currentUser.fullName);
      setUsername(currentUser.username);
      setEmail(currentUser.email);
      setAcademicYear(currentUser.academicYear || '2026/2027');
      setNewPassword('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const isDirector = currentUser.role === 'director';
  const isAdmin = currentUser.role === 'admin';
  const isFirstLogin = Boolean(currentUser.mustChangeProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('الاسم الكامل لا يمكن أن يكون فارغاً');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('اسم المستخدم لا يمكن أن يكون فارغاً');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        userId: currentUser.id,
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        academicYear: academicYear.trim() || '2026/2027',
        mustChangeProfile: false
      };
      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر تحديث البيانات الشخصية');
      }

      setSuccessMessage('تم حفظ بيانات الحساب وكلمة المرور بنجاح');
      onProfileUpdated(data.user);
      setNewPassword('');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء حفظ التعديلات');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="modal-user-profile"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,18,14,0.85)] backdrop-blur-sm animate-fadeIn"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg bg-[#1E362D] border border-[rgba(242,239,227,0.2)] rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[rgba(242,239,227,0.12)] bg-[#172B24] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2A4F40] border border-[#C98A3C]/40 flex items-center justify-center text-[#C98A3C]">
              {isAdmin ? (
                <ShieldCheck className="w-5 h-5" />
              ) : isDirector ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F2EFE3]">
                {isAdmin
                  ? 'إعدادات حساب المشرف العام'
                  : isDirector
                  ? 'إعدادات وتخصيص حساب مدير المؤسسة'
                  : 'إعدادات الحساب الشخصي'}
              </h3>
              <p className="text-xs text-[rgba(242,239,227,0.6)] mt-0.5">
                تعديل الاسم والبريد الإلكتروني واسم المستخدم وكلمة المرور
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3] hover:bg-[rgba(255,255,255,0.08)] w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          
          {/* First Login Welcome Notice */}
          {isFirstLogin && isDirector && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2A4F40] to-[#1E362D] border-2 border-[#C98A3C] text-[#F2EFE3] text-xs shadow-lg space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#C98A3C] font-bold text-sm">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>مرحباً بك السيد المدير: محمد الشريف!</span>
              </div>
              <p className="text-[rgba(242,239,227,0.85)] leading-relaxed text-[11px]">
                هذا هو تسجيل دخولك الأول. يمكنك الآن تخصيص وتعديل اسمك، وبريدك الإلكتروني الافتراضي، وتعيين كلمة مرور جديدة خاصة بك لحماية وتأمين حسابك.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1.5">
              الاسم الكامل
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="مثال: السيد المدير: محمد الشريف"
                className="w-full pl-3 pr-10 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
              />
              <User className="w-4 h-4 absolute right-3.5 top-3 text-[rgba(242,239,227,0.4)]" />
            </div>
            <p className="text-[11px] text-[rgba(242,239,227,0.5)] mt-1">
              {isDirector ? 'يظهر هذا الاسم في ترويسة إدارة المؤسسة والتقارير المطبوعة.' : 'يظهر هذا الاسم على خرائط الأقسام المسندة إليك ومطبوعات توزيع التلاميذ.'}
            </p>
          </div>

          {/* Username & Email Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1.5">
                اسم المستخدم (رمز الدخول)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="مثال: directeur"
                  className="w-full pl-3 pr-3 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm font-mono text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="directeur.iksan@gmail.com"
                  className="w-full pl-3 pr-10 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm font-mono text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                />
                <Mail className="w-4 h-4 absolute right-3.5 top-3 text-[rgba(242,239,227,0.4)]" />
              </div>
            </div>
          </div>

          {/* Academic Year */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[rgba(242,239,227,0.9)]">
                الموسم الدراسي المعتمد
              </label>
              {!isAdmin && !isDirector && (
                <span className="text-[11px] font-bold text-[#C98A3C] flex items-center gap-1 bg-[#2A4F40] px-2 py-0.5 rounded-md border border-[#C98A3C]/30">
                  <span>🔒 محدد من طرف المدير</span>
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={academicYear}
                onChange={(e) => {
                  if (isAdmin || isDirector) {
                    setAcademicYear(e.target.value);
                  }
                }}
                placeholder="2026/2027"
                disabled={!isAdmin && !isDirector}
                readOnly={!isAdmin && !isDirector}
                required
                className={`w-full pl-3 pr-10 py-2.5 rounded-xl text-sm border focus:outline-none transition-all ${
                  isAdmin || isDirector
                    ? 'bg-[#172B24] border-[rgba(242,239,227,0.18)] text-[#F2EFE3] focus:border-[#C98A3C]'
                    : 'bg-[#11201B] border-[rgba(242,239,227,0.08)] text-[rgba(242,239,227,0.7)] cursor-not-allowed'
                }`}
              />
              <Calendar className="w-4 h-4 absolute right-3.5 top-3 text-[rgba(242,239,227,0.4)]" />
            </div>
            <p className="text-[11px] text-[rgba(242,239,227,0.55)] mt-1.5 leading-relaxed">
              {isAdmin || isDirector
                ? 'بصفتك مديراً للمؤسسة، تعديلك للموسم الدراسي هنا يطبقه على كافة الأساتذة والأقسام.'
                : 'الموسم الدراسي يسجله السيد المدير مرة واحدة ويطبق تلقائياً على المؤسسة.'}
            </p>
          </div>

          {/* Change Password */}
          <div className="pt-2 border-t border-[rgba(242,239,227,0.1)]">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[rgba(242,239,227,0.9)]">
                {isFirstLogin ? 'تعيين كلمة مرور جديدة خاصة بك' : 'تغيير كلمة المرور (اختياري)'}
              </label>
              {isFirstLogin && (
                <span className="text-[11px] text-[#C98A3C] font-semibold">موصى به لتأمين الحساب</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={isFirstLogin ? 'أدخل كلمة مرور جديدة قوية' : 'اترك فارغاً للاحتفاظ بكلمة المرور الحالية'}
                className="w-full pl-10 pr-10 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
              />
              <KeyRound className="w-4 h-4 absolute right-3.5 top-3 text-[rgba(242,239,227,0.4)]" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-3 text-[rgba(242,239,227,0.4)] hover:text-[#F2EFE3]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <span>جارٍ الحفظ...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isFirstLogin ? 'تثبيت وحفظ بيانات الحساب الجديد' : 'حفظ التعديلات في الحساب'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
