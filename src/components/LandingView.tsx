import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  Share2,
  BookmarkCheck,
  Sparkles,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  School,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  Download
} from 'lucide-react';
import { User as UserType } from '../types';
import heroClassroomImg from '../assets/images/classroom_students_1789420946355.jpg';
import { AppFooter } from './AppFooter';
import { SchoolActivitiesWall } from './SchoolActivitiesWall';
import { safeApiFetch } from '../utils/apiClient';
import { PWAInstallButton } from './PWAInstallButton';

interface LandingViewProps {
  institutionName: string;
  academicYear: string;
  onLoginSuccess: (user: UserType) => void;
  onOpenForgotPassword: () => void;
  onNavigateAdmin?: () => void;
  onOpenStudentLogin?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  institutionName,
  academicYear,
  onLoginSuccess,
  onOpenForgotPassword,
  onNavigateAdmin,
  onOpenStudentLogin
}) => {
  const [activeMode, setActiveMode] = useState<'login' | 'register'>('login');
  
  // Login credentials
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register credentials
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSubject, setRegSubject] = useState('الرياضيات');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Registration pending approval state (Order #5)
  const [registeredPendingInfo, setRegisteredPendingInfo] = useState<{
    fullName: string;
    email: string;
    subject: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPendingLoginWarning, setIsPendingLoginWarning] = useState(false);

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPendingLoginWarning(false);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage('يرجى كتابة البريد الإلكتروني (أو اسم المستخدم) والرقم السري');
      return;
    }

    setIsLoading(true);
    try {
      const data = await safeApiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginEmail.trim(),
          username: loginEmail.trim(),
          email: loginEmail.trim(),
          password: loginPassword
        })
      });

      if (!data || !data.success) {
        if (data && data.isPending) {
          setIsPendingLoginWarning(true);
        }
        throw new Error(data?.error || 'فشل تسجيل الدخول، تأكد من صحة البريد والرقم السري');
      }
      onLoginSuccess(data.user);
    } catch (err: any) {
      if (err.data?.isPending) {
        setIsPendingLoginWarning(true);
      }
      setErrorMessage(err.message || 'حدث خطأ أثناء الاتصال');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Register (Order #5: Confirm password & pending status)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regFullName.trim() || !regEmail.trim() || !regPassword.trim() || !regConfirmPassword.trim()) {
      setErrorMessage('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (regPassword.length < 4) {
      setErrorMessage('الرقم السري (كلمة المرور) يجب أن لا يقل عن 4 خانات');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين، يرجى إعادة التأكد');
      return;
    }

    setIsLoading(true);
    try {
      const username = regEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || `prof_${Date.now()}`;
      const data = await safeApiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          username,
          email: regEmail.trim(),
          password: regPassword,
          confirmPassword: regConfirmPassword,
          academicYear,
          subject: regSubject
        })
      });

      if (!data || !data.success) {
        throw new Error(data?.error || 'فشل إنشاء الحساب الجديد');
      }

      // Order #5: Teachers account is pending Director approval
      setRegisteredPendingInfo({
        fullName: regFullName.trim(),
        email: regEmail.trim(),
        subject: regSubject
      });
      setRegPassword('');
      setRegConfirmPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 md:py-8 font-['Tajawal',sans-serif]">
      
      {/* Top Bar matching image */}
      <header className="relative flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F2F0] border border-[#D5CDC0] flex items-center justify-center text-[#1A4E47] shadow-xs">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#1F2926] m-0 font-['Amiri',serif]">
              المدرسة الإلكترونية
            </h1>
            <p className="text-xs text-[#6C6356] m-0">
              {institutionName || 'الثانوية الإعدادية ايكسان'} • الموسم الدراسي {academicYear || '2026/2027'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* PWA Mobile & Desktop Install Button */}
          <PWAInstallButton variant="header" />

          {/* Student Portal Button */}
          {onOpenStudentLogin && (
            <button
              type="button"
              onClick={onOpenStudentLogin}
              className="px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#1A4E47] to-[#133D37] hover:brightness-110 border border-[#C98A3C]/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="دخول فضاء التلميذ برقم مسار"
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#C98A3C]" />
              <span>فضاء التلميذ (مسار)</span>
            </button>
          )}

          {/* Dedicated Admin Portal Link */}
          <button
            type="button"
            onClick={onNavigateAdmin}
            className="px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold text-[#1A4E47] bg-[#E8F2F0] hover:bg-[#D5E9E5] border border-[#1A4E47]/30 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="بوابة الإدارة والمشرف العام (/admin)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#C98A3C]" />
            <span>بوابة الإدارة</span>
          </button>
        </div>
      </header>

      {/* Feature tags row exactly matching the image */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap mb-8 text-xs text-[#6C6356]">
        <div className="flex items-center gap-1.5 bg-white/70 px-3 py-1 rounded-full border border-[#E5DFD4] shadow-xs">
          <span className="text-[#1A4E47] font-bold">✓</span>
          <span>أقسام خاصة بحسابك</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/70 px-3 py-1 rounded-full border border-[#E5DFD4] shadow-xs">
          <span className="text-[#1A4E47] font-bold">✓</span>
          <span>حفظ تلقائي</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/70 px-3 py-1 rounded-full border border-[#E5DFD4] shadow-xs">
          <span className="text-[#1A4E47] font-bold">↗</span>
          <span>مشاركة للإدارة</span>
        </div>
      </div>

      {/* Main Grid: Visual Hero Card & Login Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
        
        {/* Visual Hero Card matching photo */}
        <div className="lg:col-span-6 relative group">
          <div className="relative rounded-3xl overflow-hidden border border-[#DCD3C3] shadow-md bg-white aspect-[4/5] max-h-[480px] w-full">
            <img
              src={heroClassroomImg}
              alt="تلاميذ الثانوية الإعدادية ايكسان في قاعة الدرس"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {/* Subtle soft gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

            {/* Floating Card at Bottom of Photo */}
            <div className="absolute bottom-4 inset-x-4">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-[#E5DFD4] shadow-lg text-center">
                <h3 className="text-lg sm:text-xl font-bold text-[#1F2926] font-['Amiri',serif] m-0 mb-1">
                  ابدأ بتنظيم أقسامك
                </h3>
                <p className="text-xs sm:text-sm text-[#6C6356] m-0 leading-snug">
                  اسمك ومؤسستك أولاً، ثم كل أقسامك في مكان واحد
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Card (خانات وضع الايميل والرقم السري للاتصال) */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border border-[#E5DFD4] shadow-md">
          
          {/* Form Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#E8F2F0] text-[#1A4E47] flex items-center justify-center font-bold">
                {activeMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              </div>
              <h2 className="text-xl font-bold text-[#1F2926] font-['Amiri',serif] m-0">
                {activeMode === 'login' ? 'تسجيل الدخول إلى حسابك' : 'إنشاء حساب أستاذ جديد'}
              </h2>
            </div>
            <p className="text-xs text-[#6C6356] m-0">
              {activeMode === 'login'
                ? 'أدخل بريدك الإلكتروني والرقم السري للوصول المباشر إلى معلوماتك وأقسامك'
                : 'أنشئ حسابك لإسناد أقسامك وتوزيع المقاعد وتسجيل الحضور'}
            </p>
          </div>

          {/* Student Space Quick Access Card */}
          {onOpenStudentLogin && (
            <div className="p-3.5 mb-5 rounded-2xl bg-[#FBF8EF] border border-[#C98A3C]/40 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1A4E47] text-[#C98A3C] flex items-center justify-center font-bold shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1A4E47]">فضاء التلميذ (Code Massar)</div>
                  <div className="text-[10px] text-[#6C6356]">ادخل برقم مسار والكود السري للاطلاع على غياباتك وحصصك</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenStudentLogin}
                className="px-3.5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                دخول التلميذ
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <span className="font-bold shrink-0 text-sm leading-none">⚠️</span>
              <div className="flex-1">
                <span>{errorMessage}</span>
                {isPendingLoginWarning && (
                  <p className="mt-1.5 text-[11px] text-amber-800 font-normal leading-relaxed bg-amber-100/60 p-2 rounded-lg border border-amber-300/60">
                    الحساب في حالة <strong>معلق في انتظار التفعيل</strong>. تنص ضوابط المؤسسة على ضرورة قيام السيد المدير بالموافقة على الحساب وتفعيله قبل إتاحة تسجيل الدخول.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pending Approval Success Screen (Order #5) */}
          {registeredPendingInfo ? (
            <div className="p-5 rounded-2xl bg-[#F4F9F6] border border-[#C2E2D6] space-y-4 text-center animate-fadeIn">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#E3F4EC] border border-[#2D8A68]/30 flex items-center justify-center text-[#1A4E47]">
                <Clock className="w-7 h-7 text-[#1A4E47] animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-[#1F2926]">
                  تم تسجيل الحساب بنجاح!
                </h4>
                <p className="text-xs font-semibold text-[#1A4E47]">
                  الحساب حالياً قيد المراجعة بانتظار موافقة وتفعيل السيد المدير
                </p>
              </div>

              <div className="p-3 bg-white/90 rounded-xl border border-[#D5EADB] text-right text-xs space-y-1.5 text-[#483F33]">
                <div>الأستاذ(ة): <strong className="text-[#1F2926]">{registeredPendingInfo.fullName}</strong></div>
                <div>البريد الإلكتروني: <span className="font-mono text-[#1A4E47]">{registeredPendingInfo.email}</span></div>
                <div>المادة الدراسية: <span className="font-semibold text-[#1F2926]">{registeredPendingInfo.subject}</span></div>
                <div>الموسم الدراسي: <strong className="text-[#8A5A18]">{academicYear}</strong> (مركزي)</div>
              </div>

              <p className="text-[11px] text-[#6C6356] leading-relaxed">
                وفق النظام الإداري المعتمد، لا يمكن للأستاذ تسجيل الدخول إلا بعد قيام السيد المدير بالموافقة على الحساب وتفعيله من لوحة الإدارة.
              </p>

              <button
                type="button"
                onClick={() => {
                  setRegisteredPendingInfo(null);
                  setActiveMode('login');
                  setErrorMessage(null);
                }}
                className="w-full py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                العودة إلى نافذة تسجيل الدخول
              </button>
            </div>
          ) : activeMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1.5">
                  البريد الإلكتروني أو اسم المستخدم
                </label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6C6356]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="اسم المستخدم أو البريد الإلكتروني"
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD4] rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#1F2926]">
                    الرقم السري (كلمة المرور)
                  </label>
                  <button
                    type="button"
                    onClick={onOpenForgotPassword}
                    className="text-[11px] text-[#1A4E47] hover:underline font-semibold cursor-pointer"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6C6356]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD4] rounded-xl pr-9 pl-10 py-2.5 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white transition-all"
                  />
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
                className="w-full py-3 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>جاري تسجيل الدخول...</span>
                ) : (
                  <>
                    <span>دخول إلى حسابي</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center border-t border-[#E5DFD4]/60">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('register');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-[#1A4E47] font-semibold hover:underline cursor-pointer"
                >
                  ليس لديك حساب بعد؟ طلب تسجيل حساب أستاذ جديد
                </button>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Institutional notice about centralized academic year (Order #6) */}
              <div className="p-2.5 rounded-xl bg-[#F8F5EC] border border-[#E8DFC8] text-[11px] text-[#6C5938] flex items-center justify-between">
                <span>الموسم الدراسي المعتمد: <strong className="text-[#1F2926]">{academicYear}</strong></span>
                <span className="text-[10px] font-bold bg-[#E8DFC8] text-[#483F33] px-2 py-0.5 rounded-md">
                  مركزي (إشراف الإدارة)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  الاسم الكامل (الأستاذ / الأستاذة)
                </label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="مثال: ذ. عبد الله الإدريسي"
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD4] rounded-xl px-3 py-2 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  المادة التدريسية
                </label>
                <select
                  value={regSubject}
                  onChange={(e) => setRegSubject(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD4] rounded-xl px-3 py-2 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white"
                >
                  <option value="الرياضيات">الرياضيات</option>
                  <option value="اللغة العربية">اللغة العربية</option>
                  <option value="اللغة الفرنسية">اللغة الفرنسية</option>
                  <option value="العلوم الفيزيائية">الفيزياء والكيمياء</option>
                  <option value="علوم الحياة والأرض">علوم الحياة والأرض</option>
                  <option value="الاجتماعيات">التاريخ والجغرافيا (الاجتماعيات)</option>
                  <option value="التربية الإسلامية">التربية الإسلامية</option>
                  <option value="اللغة الإنجليزية">اللغة الإنجليزية</option>
                  <option value="المعلوميات">المعلوميات</option>
                  <option value="التربية البدنية">التربية البدنية</option>
                  <option value="التربية الأسرية">التربية الأسرية</option>
                  <option value="التربية التشكيلية والموسيقية">التربية الفنية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="prof.name@gmail.com"
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD4] rounded-xl px-3 py-2 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  الرقم السري (كلمة المرور)
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="اختر كلمة مرور قوية"
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD4] rounded-xl pr-3 pl-10 py-2 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C6356] hover:text-[#1F2926] cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (Order #5) */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  تأكيد الرقم السري (إعادة الإدخال)
                </label>
                <div className="relative">
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة الرقم السري للتأكيد"
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD4] rounded-xl pr-3 pl-10 py-2 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C6356] hover:text-[#1F2926] cursor-pointer"
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                ℹ️ <strong>ملاحظة هامة:</strong> بعد التسجيل سيخضع الحساب لمراجعة وتفعيل السيد المدير قبل أن تتمكن من تسجيل الدخول.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>جاري إرسال طلب الحساب...</span>
                ) : (
                  <>
                    <span>تسجيل الحساب وإرساله للمدير للموافقة</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('login');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-[#1A4E47] font-semibold hover:underline cursor-pointer"
                >
                  لديك حساب بالفعل؟ تسجيل الدخول
                </button>
              </div>
            </form>
          )}

        </div>

      </div>

      {/* PWA Mobile App Install Invitation Banner */}
      <div className="max-w-4xl mx-auto w-full mb-8">
        <PWAInstallButton variant="banner" />
      </div>

      {/* School Activities & Photos Wall (Order requested by user: bottom of page above footer) */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <SchoolActivitiesWall
          currentUser={null}
          institutionName={institutionName}
          onOpenLoginModal={() => {
            setActiveMode('login');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>

      {/* Persistent Institutional Footer (Order #2) */}
      <AppFooter
        institutionName={institutionName}
        onNavigateAdmin={onNavigateAdmin}
      />

    </div>
  );
};
