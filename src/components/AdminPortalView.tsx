import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  GraduationCap,
  LogIn,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Building2
} from 'lucide-react';
import { User as UserType, AppSettings } from '../types';
import { AppFooter } from './AppFooter';
import { AppAdminDashboard } from './AppAdminDashboard';
import { safeApiFetch } from '../utils/apiClient';

interface AdminPortalViewProps {
  institutionName: string;
  academicYear: string;
  currentUser?: UserType | null;
  settings?: AppSettings;
  onLoginSuccess: (user: UserType) => void;
  onNavigateHome: () => void;
  onLogout?: () => void;
  onOpenDbModal?: () => void;
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  institutionName,
  academicYear,
  currentUser,
  settings,
  onLoginSuccess,
  onNavigateHome,
  onLogout = () => {},
  onOpenDbModal = () => {}
}) => {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in as App Super-Admin (role === 'admin'), show the App Super-Admin Dashboard
  if (currentUser && currentUser.role === 'admin') {
    return (
      <AppAdminDashboard
        currentUser={currentUser}
        settings={settings || { institution: institutionName, year: academicYear, teacher: '' }}
        onLogout={onLogout}
        onNavigateHome={onNavigateHome}
        onOpenDbModal={onOpenDbModal}
      />
    );
  }

  // If logged in as Director or Teacher, restrict access to /admin
  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#F4F0E8] flex flex-col justify-between" dir="rtl">
        <header className="w-full bg-[#1A4E47] text-white py-3.5 px-4 sm:px-8 border-b border-[#C98A3C]/40 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#133D37] border border-[#C98A3C]/40 flex items-center justify-center text-[#C98A3C]">
                <ShieldCheck className="w-5 h-5 text-[#C98A3C]" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-wide font-['Amiri',serif]">
                  بوابة المشرف على التطبيق • /admin
                </div>
                <div className="text-[11px] text-[#C98A3C]">
                  {institutionName}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer border border-white/15"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[#C98A3C]" />
              <span>العودة للبوابة العامة</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#E5DFD4] shadow-xl p-6 sm:p-8 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs mb-2">
              صلاحية مقيدة ومخصصة
            </span>

            <h2 className="text-xl font-bold font-['Amiri',serif] text-[#1F2926]">
              صفحة /admin مخصصة حصرياً للمشرف على التطبيق
            </h2>

            <p className="text-xs text-[#6C6356] mt-3 leading-relaxed">
              أنت متصل حالياً كـ <strong>{currentUser.role === 'director' ? 'مدير المؤسسة' : 'أستاذ'}</strong> ({currentUser.fullName}).
              <br />
              هذه الصفحة مخصصة فقط للمشرف العام على التطبيق لإدارة المدراء والأساتذة وصيانة الخادم. يمكنك متابعة عملك من فضاء المؤسسة التعليمية.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={onNavigateHome}
                className="w-full py-3 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة إلى فضاء المؤسسة والأقسام</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-rose-50 text-[#6C6356] hover:text-rose-700 font-bold text-xs border border-[#E5DFD4] transition-all cursor-pointer"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </main>

        <AppFooter
          institutionName={institutionName}
          onNavigateHome={onNavigateHome}
          isAdminView={true}
        />
      </div>
    );
  }

  // Not logged in -> Show Login form strictly for App Super-Admin
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await safeApiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          username: loginIdentifier.trim(),
          email: loginIdentifier.trim(),
          password: loginPassword
        })
      });

      if (!data || !data.success) {
        throw new Error(data?.error || 'فشل تسجيل الدخول، تحقق من اسم المستخدم أو كلمة المرور');
      }

      // Strict enforcement: ONLY admin role can enter /admin
      if (data.user.role !== 'admin') {
        throw new Error('صفحة /admin مخصصة حصرياً للمشرف على التطبيق (الأستاذ سمير القراشي). مدير المؤسسة والأساتذة يسجلون الدخول من البوابة المدرسية الرئيسية.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F0E8] flex flex-col justify-between" dir="rtl">
      
      {/* Top Bar for Admin Portal */}
      <header className="w-full bg-[#1A4E47] text-white py-3.5 px-4 sm:px-8 border-b border-[#C98A3C]/40 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#133D37] border border-[#C98A3C]/40 flex items-center justify-center text-[#C98A3C] shadow-xs">
              <ShieldCheck className="w-5 h-5 text-[#C98A3C]" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide font-['Amiri',serif]">
                بوابة المشرف العام على التطبيق • /admin
              </div>
              <div className="text-[11px] text-[#C98A3C] font-medium">
                {institutionName} — فضاء الإشراف المركزي على التطبيق
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer border border-white/15"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#C98A3C]" />
            <span>العودة للبوابة العامة والأساتذة</span>
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-3xl border border-[#E5DFD4] shadow-xl overflow-hidden animate-fadeIn">
          
          {/* Header Banner */}
          <div className="bg-[#1A4E47] p-6 text-white text-center relative border-b border-[#C98A3C]/40">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[#133D37] border-2 border-[#C98A3C]/50 flex items-center justify-center text-[#C98A3C] shadow-lg mb-3">
              <ShieldCheck className="w-9 h-9 text-[#C98A3C]" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full bg-[#C98A3C]/20 border border-[#C98A3C]/40 text-[#C98A3C] font-bold text-xs mb-2">
              لوحة التحكم والإشراف على التطبيق
            </span>

            <h2 className="text-xl font-bold font-['Amiri',serif] text-white">
              بوابة المشرف العام على التطبيق
            </h2>
            <p className="text-xs text-[#F2EFE3]/80 mt-1 font-semibold">
              الأستاذ: سمير القراشي • الموسم: {academicYear || '2026/2027'}
            </p>
          </div>

          {/* Form Body */}
          <div className="p-6 sm:p-8 space-y-5">
            
            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              
              {/* Identifier */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1.5">
                  اسم المستخدم أو البريد الإلكتروني للمشرف
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="admin أو mrsamiro69@gmail.com"
                    className="w-full bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl pr-10 pl-3 py-2.5 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white transition-all font-mono"
                  />
                  <User className="w-4 h-4 text-[#6C6356] absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#1F2926]">
                    كلمة المرور السرية
                  </label>
                  <span className="text-[11px] text-[#6C6356]">مشفرة ومحمية</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl pr-10 pl-10 py-2.5 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white transition-all font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-[#6C6356] absolute right-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C6356] hover:text-[#1F2926] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <span>جارٍ التحقق من الصلاحيات الإدارية...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-[#C98A3C]" />
                    <span>دخول المشرف العام على التطبيق</span>
                  </>
                )}
              </button>

            </form>

            {/* Security Notice */}
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4] text-[11px] text-[#6C6356] leading-relaxed space-y-1 text-right">
              <div className="font-bold text-[#1F2926] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1A4E47]" />
                <span>صلاحيات المشرف على التطبيق:</span>
              </div>
              <p>
                إدارة المدراء (إضافة مدير، إزالة مدير)، إدارة الأساتذة (إضافة أستاذ، إزالة أستاذ)، وإدارة النسخ الاحتياطي للنظام.
              </p>
            </div>

            {/* Back to Home Link */}
            <div className="pt-2 text-center border-t border-[#E5DFD4]">
              <button
                type="button"
                onClick={onNavigateHome}
                className="text-xs text-[#1A4E47] font-semibold hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <ArrowRight className="w-3 h-3" />
                <span>العودة إلى بوابة المؤسسة والأساتذة</span>
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* Persistent Footer */}
      <AppFooter
        institutionName={institutionName}
        onNavigateHome={onNavigateHome}
        isAdminView={true}
      />

    </div>
  );
};
