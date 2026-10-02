import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  KeyRound,
  Mail,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar,
  Eye,
  EyeOff,
  Copy,
  Check,
  Clock
} from 'lucide-react';
import { User as UserType } from '../types';
import { safeApiFetch } from '../utils/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserType) => void;
  defaultTab?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  defaultTab = 'login'
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot' | 'verify'>(defaultTab);

  // Login form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAcademicYear, setRegAcademicYear] = useState('2025/2026');
  const [regSubject, setRegSubject] = useState('الرياضيات');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [registeredPendingInfo, setRegisteredPendingInfo] = useState<{
    fullName: string;
    email: string;
    username: string;
  } | null>(null);

  // Email verification state
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [emailVerifiedSuccess, setEmailVerifiedSuccess] = useState(false);
  const [verifiedUserInfo, setVerifiedUserInfo] = useState<UserType | null>(null);

  // Forgot password form
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotResult, setForgotResult] = useState<{
    success: boolean;
    email: string;
    username: string;
    tempPassword: string;
    message: string;
  } | null>(null);
  const [copiedTempPass, setCopiedTempPass] = useState(false);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPendingLoginWarning, setIsPendingLoginWarning] = useState(false);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (isOpen) {
      // Sync central academic year from server settings
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.settings?.year) {
            setRegAcademicYear(data.settings.year);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsPendingLoginWarning(false);

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMessage('يرجى ملء اسم المستخدم أو البريد الإلكتروني وكلمة المرور');
      return;
    }

    setIsLoading(true);
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
        if (data && data.needsEmailVerification) {
          setVerifyEmail(data.email || loginIdentifier.trim());
          setActiveTab('verify');
          setErrorMessage('يرجى تأكيد بريدك الإلكتروني أولاً. تم إرسال رمز التحقق المكون من 6 أرقام إلى بريدك الإلكتروني.');
          return;
        }
        if (data && data.isPending) {
          setIsPendingLoginWarning(true);
        }
        throw new Error(data?.error || 'فشل تسجيل الدخول، تأكد من صحة البيانات');
      }

      onLoginSuccess(data.user);
      onClose();
    } catch (err: any) {
      if (err.data?.needsEmailVerification) {
        setVerifyEmail(err.data.email || loginIdentifier.trim());
        setActiveTab('verify');
        setErrorMessage('يرجى تأكيد بريدك الإلكتروني أولاً. تم إرسال رمز التحقق المكون من 6 أرقام إلى بريدك الإلكتروني.');
        return;
      }
      if (err.data?.isPending) {
        setIsPendingLoginWarning(true);
      }
      setErrorMessage(err.message || 'خطأ أثناء تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register (Order #5 & #6)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regFullName.trim() || !regUsername.trim() || !regEmail.trim() || !regPassword.trim() || !regConfirmPassword.trim()) {
      setErrorMessage('جميع الحقول مطلوبة لإنشاء حساب الأستاذ');
      return;
    }

    if (regPassword.length < 4) {
      setErrorMessage('كلمة المرور يجب أن لا تقل عن 4 خانات');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين، يرجى إعادة التأكد');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          username: regUsername.trim(),
          email: regEmail.trim(),
          academicYear: regAcademicYear.trim() || '2025/2026',
          subject: regSubject,
          password: regPassword,
          confirmPassword: regConfirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر إنشاء الحساب');
      }

      setVerifyEmail(regEmail.trim());
      setRegisteredPendingInfo({
        fullName: regFullName.trim(),
        email: regEmail.trim(),
        username: regUsername.trim()
      });
      setRegPassword('');
      setRegConfirmPassword('');

      if (data.needsEmailVerification) {
        setActiveTab('verify');
        setSuccessMessage('تم تسجيل الحساب بنجاح! يرجى إدخال رمز التأكيد المكون من 6 أرقام المرسل إلى بريدك الإلكتروني.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Email Verification
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!verifyEmail.trim() || !verifyCode.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني ورمز التأكيد المكون من 6 أرقام');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: verifyEmail.trim(),
          code: verifyCode.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'رمز التأكيد غير صحيح أو انتهت صلاحيته');
      }

      setEmailVerifiedSuccess(true);
      setVerifiedUserInfo(data.user);
      setSuccessMessage(data.message || 'تم تأكيد بريدك الإلكتروني بنجاح!');
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء التحقق من الرمز');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Resend Verification Code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || !verifyEmail.trim()) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResending(true);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: verifyEmail.trim() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر إعادة إرسال الرمز');
      }

      setResendCooldown(60);
      setSuccessMessage(data.message || `تم إرسال رمز تأكيد جديد إلى ${verifyEmail}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء إعادة إرسال الرمز');
    } finally {
      setIsResending(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setForgotResult(null);

    if (!forgotIdentifier.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني أو اسم المستخدم المسجل');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر استعادة كلمة المرور');
      }

      setForgotResult(data);
      setSuccessMessage('تم استرجاع معلومات الحساب وتوليد كلمة مرور جديدة صالحة للاستخدام فوراً');
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء استعادة الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTempPass(true);
    setTimeout(() => setCopiedTempPass(false), 2000);
  };

  return (
    <div
      id="modal-auth"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[rgba(10,18,14,0.85)] backdrop-blur-sm animate-fadeIn overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg bg-[#1E362D] border border-[rgba(242,239,227,0.2)] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[96vh] sm:max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-3.5 sm:p-6 pb-3 sm:pb-4 border-b border-[rgba(242,239,227,0.12)] bg-[#172B24] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#2A4F40] border border-[#C98A3C]/40 flex items-center justify-center text-[#C98A3C] shrink-0">
                {activeTab === 'login' && <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />}
                {activeTab === 'register' && <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />}
                {activeTab === 'verify' && <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
                {activeTab === 'forgot' && <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-xl font-bold text-[#F2EFE3] truncate">
                  {activeTab === 'login' && 'تسجيل الدخول إلى النظام'}
                  {activeTab === 'register' && 'تسجيل حساب أستاذ جديد'}
                  {activeTab === 'verify' && 'تأكيد البريد الإلكتروني'}
                  {activeTab === 'forgot' && 'استعادة معلومات الدخول'}
                </h3>
                <p className="text-[11px] sm:text-xs text-[rgba(242,239,227,0.6)] mt-0.5 truncate">
                  الثانوية الإعدادية ايكسان • إدارة وتوزيع المقاعد
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3] hover:bg-[rgba(255,255,255,0.08)] w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-base sm:text-lg transition-colors cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 sm:gap-1.5 mt-3 sm:mt-4 p-1 bg-[rgba(0,0,0,0.25)] rounded-xl sm:rounded-2xl border border-[rgba(242,239,227,0.08)]">
            <button
              type="button"
              id="tab-btn-login"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                activeTab === 'login'
                  ? 'bg-[#C98A3C] text-[#1E362D] shadow-sm'
                  : 'text-[rgba(242,239,227,0.7)] hover:text-[#F2EFE3]'
              }`}
            >
              دخول
            </button>
            <button
              type="button"
              id="tab-btn-register"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                activeTab === 'register'
                  ? 'bg-[#C98A3C] text-[#1E362D] shadow-sm'
                  : 'text-[rgba(242,239,227,0.7)] hover:text-[#F2EFE3]'
              }`}
            >
              حساب جديد
            </button>
            <button
              type="button"
              id="tab-btn-verify"
              onClick={() => {
                setActiveTab('verify');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                activeTab === 'verify'
                  ? 'bg-[#C98A3C] text-[#1E362D] shadow-sm'
                  : 'text-[rgba(242,239,227,0.7)] hover:text-[#F2EFE3]'
              }`}
            >
              تأكيد
            </button>
            <button
              type="button"
              id="tab-btn-forgot"
              onClick={() => {
                setActiveTab('forgot');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium transition-all cursor-pointer text-center ${
                activeTab === 'forgot'
                  ? 'bg-[#C98A3C] text-[#1E362D] shadow-sm'
                  : 'text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3]'
              }`}
            >
              نسيت السر
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 flex-1 overflow-y-auto">
          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {isPendingLoginWarning && (
                  <p className="mt-1.5 p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px]">
                    الحساب في حالة <strong>معلق في انتظار التفعيل</strong>. تتطلب لوائح المؤسسة موافقة وتفعيل السيد المدير قبل إمكانية تسجيل الدخول.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Pending Approval Success Screen (Order #5) */}
          {registeredPendingInfo && (
            <div className="p-5 rounded-2xl bg-[#172B24] border border-[#C98A3C]/40 space-y-4 text-center animate-fadeIn">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#2A4F40] border border-[#C98A3C]/40 flex items-center justify-center text-[#C98A3C]">
                <Clock className="w-7 h-7 text-[#C98A3C] animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-[#F2EFE3]">
                  تم تسجيل حساب الأستاذ بنجاح!
                </h4>
                <p className="text-xs font-semibold text-[#C98A3C]">
                  الحساب حالياً قيد المراجعة بانتظار موافقة وتفعيل السيد المدير
                </p>
              </div>

              <div className="p-3.5 bg-[#1E362D] rounded-xl border border-[rgba(242,239,227,0.12)] text-right text-xs space-y-1.5 text-[rgba(242,239,227,0.8)]">
                <div>الأستاذ: <strong className="text-[#F2EFE3]">{registeredPendingInfo.fullName}</strong></div>
                <div>اسم المستخدم: <span className="font-mono text-[#C98A3C]">@{registeredPendingInfo.username}</span></div>
                <div>البريد: <span className="font-mono text-[#F2EFE3]">{registeredPendingInfo.email}</span></div>
                <div>الموسم الدراسي: <strong className="text-[#C98A3C]">{regAcademicYear}</strong> (مركزي)</div>
              </div>

              <p className="text-[11px] text-[rgba(242,239,227,0.6)] leading-relaxed">
                وفق سياسة المؤسسة، لا يمكن الدخول إلا بعد قيام السيد المدير بتفعيل الحساب من لوحة الإدارة العامة.
              </p>

              <button
                type="button"
                onClick={() => {
                  setRegisteredPendingInfo(null);
                  setActiveTab('login');
                  setErrorMessage(null);
                }}
                className="w-full py-2.5 rounded-xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                العودة إلى نافذة تسجيل الدخول
              </button>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {!registeredPendingInfo && activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1.5">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="input-login-identifier"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
                    required
                    className="w-full pl-3 pr-10 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C] transition-colors"
                  />
                  <User className="w-4 h-4 absolute right-3.5 top-3 text-[rgba(242,239,227,0.4)]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[rgba(242,239,227,0.9)]">
                    كلمة المرور
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('forgot')}
                    className="text-[11px] text-[#C98A3C] hover:underline cursor-pointer"
                  >
                    نسيت كلمة السر؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    id="input-login-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C] transition-colors"
                  />
                  <KeyRound className="w-4 h-4 absolute right-3.5 top-3 text-[rgba(242,239,227,0.4)]" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute left-3.5 top-3 text-[rgba(242,239,227,0.4)] hover:text-[#F2EFE3]"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-login"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-2xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <span>جارٍ التحقق...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>تسجيل الدخول</span>
                  </>
                )}
              </button>


            </form>
          )}

          {/* 2. REGISTER TEACHER FORM */}
          {!registeredPendingInfo && activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              
              <div className="p-3 rounded-2xl bg-[#172B24] border border-[rgba(242,239,227,0.1)] text-xs text-[rgba(242,239,227,0.8)] leading-relaxed">
                <span className="font-bold text-[#C98A3C]">ملاحظة هامة للأساتذة:</span> عند التسجيل، سيتم إنشاء حسابك الخاص لتتمكن من تصفح أقسام المؤسسة وطلب إسناد الأقسام التي تدرّسها، وفور موافقة السيد المدير تظهر لك أسماء التلاميذ وأرقامهم وتوزيع المقاعد.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1">
                  الاسم الكامل للأستاذ(ة)
                </label>
                <input
                  type="text"
                  id="input-reg-fullname"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="مثال: الأستاذ محمد بنعلي"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1">
                    اسم المستخدم (رمز الدخول)
                  </label>
                  <input
                    type="text"
                    id="input-reg-username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="مثال: prof_benali"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1">
                    المادة المُدرَّسة
                  </label>
                  <select
                    id="input-reg-subject"
                    value={regSubject}
                    onChange={(e) => setRegSubject(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                  >
                    {[
                      'الرياضيات',
                      'الفيزياء والكيمياء',
                      'علوم الحياة والأرض',
                      'اللغة العربية',
                      'اللغة الفرنسية',
                      'اللغة الإنجليزية',
                      'التاريخ والجغرافيا',
                      'التربية الإسلامية',
                      'التكنولوجيا',
                      'الإعلاميات',
                      'التربية البدنية',
                      'التربية التشكيلية',
                      'التربية الموسيقية',
                      'فلسفة / أخرى'
                    ].map((subj) => (
                      <option key={subj} value={subj} className="bg-[#172B24] text-[#F2EFE3]">
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1">
                    البريد الإلكتروني (لتلقي التنبيهات وكلمة المرور)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="input-reg-email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      required
                      className="w-full pl-3 pr-9 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C]"
                    />
                    <Mail className="w-4 h-4 absolute right-3 top-3 text-[rgba(242,239,227,0.4)]" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[rgba(242,239,227,0.9)]">
                      الموسم الدراسي المعتمد
                    </label>
                    <span className="text-[10px] text-[#C98A3C] bg-[#C98A3C]/10 px-1.5 py-0.5 rounded border border-[#C98A3C]/20">
                      مركزي من الإدارة
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      id="input-reg-year"
                      value={regAcademicYear}
                      readOnly
                      className="w-full pl-3 pr-9 py-2.5 bg-[#14231E] border border-[rgba(242,239,227,0.12)] rounded-xl text-sm text-[#C98A3C] font-mono cursor-not-allowed"
                    />
                    <Calendar className="w-4 h-4 absolute right-3 top-3 text-[#C98A3C]" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1">
                    كلمة المرور (الرقم السري)
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      id="input-reg-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="اختر كلمة مرور"
                      required
                      className="w-full pl-10 pr-9 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C]"
                    />
                    <KeyRound className="w-4 h-4 absolute right-3 top-3 text-[rgba(242,239,227,0.4)]" />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute left-3.5 top-3 text-[rgba(242,239,227,0.4)] hover:text-[#F2EFE3]"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1">
                    تأكيد كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      id="input-reg-confirm-password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور"
                      required
                      className="w-full pl-10 pr-9 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C]"
                    />
                    <KeyRound className="w-4 h-4 absolute right-3 top-3 text-[rgba(242,239,227,0.4)]" />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute left-3.5 top-3 text-[rgba(242,239,227,0.4)] hover:text-[#F2EFE3]"
                    >
                      {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
                ℹ️ <strong>تنبيه إداري:</strong> بعد إرسال الطلب، يتطلب الحساب موافقة وتفعيل السيد المدير قبل تسجيل الدخول.
              </div>

              <button
                type="submit"
                id="btn-submit-register"
                disabled={isLoading}
                className="w-full mt-3 py-3 rounded-2xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <span>جارٍ إرسال طلب الحساب...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>تسجيل الحساب وإرساله للإدارة للموافقة</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. EMAIL VERIFICATION FORM */}
          {activeTab === 'verify' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#172B24] border border-[#C98A3C]/30 text-xs text-[rgba(242,239,227,0.85)] leading-relaxed space-y-1.5">
                <div className="flex items-center gap-2 text-[#C98A3C] font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>تأكيد ملكية البريد الإلكتروني (منع الحسابات الوهمية)</span>
                </div>
                <p className="text-[11px] text-[rgba(242,239,227,0.7)]">
                  يضمن تأكيد البريد الإلكتروني عدم مشاركة أي شخص بإيميلات غير صحيحة، ويتيح استلام الإشعارات المدرسية ونتائج طلبات إسناد الأقسام وتنبيهات المؤسسة فور صدورها.
                </p>
              </div>

              {!emailVerifiedSuccess ? (
                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1.5">
                      البريد الإلكتروني أو اسم المستخدم
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="input-verify-email"
                        value={verifyEmail}
                        onChange={(e) => setVerifyEmail(e.target.value)}
                        placeholder="أدخل بريدك الإلكتروني أو اسم المستخدم"
                        required
                        className="w-full pl-3 pr-10 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C]"
                      />
                      <Mail className="w-4 h-4 absolute right-3.5 top-3 text-[rgba(242,239,227,0.4)]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[rgba(242,239,227,0.9)]">
                        رمز التأكيد المكون من 6 أرقام
                      </label>
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={isResending || resendCooldown > 0 || !verifyEmail.trim()}
                        className="text-[11px] text-[#C98A3C] hover:underline disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isResending
                          ? 'جارٍ الإرسال...'
                          : resendCooldown > 0
                          ? `إعادة الإرسال بعد (${resendCooldown} ثانية)`
                          : 'إعادة إرسال الرمز'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        id="input-verify-code"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        required
                        className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 bg-[#172B24] border border-[#C98A3C]/40 rounded-xl text-[#C98A3C] placeholder-[rgba(242,239,227,0.2)] focus:outline-none focus:border-[#C98A3C] focus:ring-1 focus:ring-[#C98A3C]"
                      />
                    </div>
                    <p className="text-[11px] text-[rgba(242,239,227,0.5)] mt-1.5 text-center">
                      تم إرسال رمز مكون من 6 أرقام إلى بريدك (صلاحية الرمز: 30 دقيقة)
                    </p>
                  </div>

                  <button
                    type="submit"
                    id="btn-submit-verify-code"
                    disabled={isVerifying || !verifyCode.trim() || !verifyEmail.trim()}
                    className="w-full py-3 rounded-2xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <span>جارٍ التحقق من الرمز...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد الحساب والبريد الإلكتروني</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-5 rounded-2xl bg-[#172B24] border border-emerald-500/40 space-y-4 text-center animate-fadeIn">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-[#F2EFE3]">
                      تم تأكيد البريد الإلكتروني بنجاح!
                    </h4>
                    <p className="text-xs text-emerald-300">
                      أصبح بريدك الإلكتروني موثقاً رسمياً ومؤهلاً لاستقبال كافة إشعارات المؤسسة
                    </p>
                  </div>

                  <div className="p-3 bg-[#1E362D] rounded-xl border border-[rgba(242,239,227,0.1)] text-right text-xs space-y-1 text-[rgba(242,239,227,0.8)]">
                    <div>البريد المؤكد: <span className="font-mono text-[#F2EFE3]">{verifyEmail}</span></div>
                    {verifiedUserInfo?.status === 'pending' && (
                      <div className="text-amber-300 text-[11px] pt-1 border-t border-[rgba(242,239,227,0.08)]">
                        ℹ️ حسابك قيد المراجعة بانتظار موافقة وتفعيل السيد المدير، وسيصلك إشعار بالبريد فور تفعيله.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier(verifyEmail);
                      setActiveTab('login');
                      setEmailVerifiedSuccess(false);
                      setSuccessMessage(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    الانتقال إلى تسجيل الدخول
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. FORGOT PASSWORD FORM */}
          {activeTab === 'forgot' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-[#172B24] border border-[rgba(242,239,227,0.1)] text-xs text-[rgba(242,239,227,0.8)] leading-relaxed">
                إذا نسيت كلمة المرور، أدخل بريدك الإلكتروني أو اسم المستخدم المسجل، وسيتم فوراً إرسال معلومات الدخول الجديدة وكلمة مرور مؤقتة صالحة للاستخدام.
              </div>

              {!forgotResult ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[rgba(242,239,227,0.9)] mb-1.5">
                      البريد الإلكتروني أو اسم المستخدم المسجل
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="input-forgot-identifier"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="مثال: mrsamir069@gmail.com أو admin"
                        required
                        className="w-full pl-3 pr-10 py-2.5 bg-[#172B24] border border-[rgba(242,239,227,0.18)] rounded-xl text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C]"
                      />
                      <Mail className="w-4 h-4 absolute right-3.5 top-3 text-[rgba(242,239,227,0.4)]" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="btn-submit-forgot"
                    disabled={isLoading}
                    className="w-full py-3 rounded-2xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span>جارٍ المعالجة...</span>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>إرسال معلومات الدخول الجديدة إلى البريد</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-4 rounded-2xl bg-[#172B24] border border-[#C98A3C]/40 space-y-3">
                  <div className="flex items-center gap-2 text-[#C98A3C] font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>تم بنجاح! تفاصيل معلومات الدخول الجديدة:</span>
                  </div>

                  <div className="space-y-2 text-xs bg-[rgba(0,0,0,0.3)] p-3 rounded-xl border border-[rgba(242,239,227,0.1)]">
                    <div className="flex justify-between items-center">
                      <span className="text-[rgba(242,239,227,0.6)]">البريد المستلم:</span>
                      <span className="font-mono text-[#F2EFE3]">{forgotResult.email}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[rgba(242,239,227,0.6)]">اسم المستخدم:</span>
                      <span className="font-mono text-[#F2EFE3]">{forgotResult.username}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[rgba(242,239,227,0.1)]">
                      <span className="text-[rgba(242,239,227,0.6)]">كلمة المرور الجديدة:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#C98A3C] text-sm select-all">
                          {forgotResult.tempPassword}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(forgotResult.tempPassword)}
                          className="p-1 text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3] transition-colors"
                          title="نسخ كلمة المرور"
                        >
                          {copiedTempPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-[rgba(242,239,227,0.65)] leading-relaxed">
                    تم إيداع رسالة بريدية في صندوق البريد الصادر للمؤسسة. يمكنك الآن تسجيل الدخول مباشرة بهذه البيانات وتغيير كلمة المرور في أي وقت من ملفك الشخصي.
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier(forgotResult.username);
                      setLoginPassword(forgotResult.tempPassword);
                      setActiveTab('login');
                      setForgotResult(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#2A4F40] hover:bg-[#346250] text-[#F2EFE3] text-xs font-bold transition-colors cursor-pointer"
                  >
                    الانتقال لتسجيل الدخول مباشرة
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
