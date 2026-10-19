import React, { useState, useEffect } from 'react';
import {
  Plus,
  Database,
  History,
  HardDrive,
  ShieldCheck,
  User,
  LogIn,
  LogOut,
  Layers,
  Settings,
  Clock,
  Sparkles,
  Home,
  Building2,
  Calendar,
  UserX,
  AlertTriangle
} from 'lucide-react';
import { AppSettings, DbStats, User as UserType } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface TopbarProps {
  settings: AppSettings;
  onOpenAddModal: () => void;
  onOpenDbModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenDailyArchiveModal?: () => void;
  onOpenViolationsRegisterModal?: () => void;
  onOpenPositiveReportModal?: () => void;
  dbStats: DbStats | null;
  saveStatusText: string | null;
  currentUser: UserType | null;
  onOpenAuthModal: (tab?: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenProfileModal: () => void;
  onOpenTeacherAssignmentModal: () => void;
  onOpenAdminApprovalsModal: () => void;
  pendingRequestsCount: number;
  onGoHome?: () => void;
  onNavigateAdmin?: () => void;
  isAdminRoute?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  settings,
  onOpenAddModal,
  onOpenDbModal,
  onOpenHistoryModal,
  onOpenDailyArchiveModal,
  onOpenViolationsRegisterModal,
  onOpenPositiveReportModal,
  dbStats,
  saveStatusText,
  currentUser,
  onOpenAuthModal,
  onLogout,
  onOpenProfileModal,
  onOpenTeacherAssignmentModal,
  onOpenAdminApprovalsModal,
  pendingRequestsCount,
  onGoHome,
  onNavigateAdmin,
  isAdminRoute = false,
}) => {
  const [utcTime, setUtcTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const utcHours = String(utcTime.getUTCHours()).padStart(2, '0');
  const utcMinutes = String(utcTime.getUTCMinutes()).padStart(2, '0');

  return (
    <div className="relative flex items-center justify-between gap-4 flex-wrap mb-6 pb-4 border-b border-[#E5DFD4]">
      
      {/* Brand & Institution Info - Clicking returns directly to Home */}
      <div
        id="topbar-brand-home"
        onClick={onGoHome}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onGoHome?.();
          }
        }}
        className="flex items-center gap-3.5 cursor-pointer group select-none transition-all p-1.5 -m-1.5 rounded-2xl hover:bg-[#F2EFE9]/70 active:scale-[0.99]"
        title="الصفحة الرئيسية — اضغط هنا للرجوع إلى الصفحة الرئيسية مباشرة"
      >
        <div className="w-11 h-11 rounded-2xl bg-[#E8F2F0] group-hover:bg-[#D8ECE8] border border-[#D5CDC0] group-hover:border-[#1A4E47]/40 flex items-center justify-center text-[#1A4E47] shadow-xs shrink-0 transition-all">
          <Database className="w-5 h-5 group-hover:scale-105 transition-transform" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F2926] group-hover:text-[#1A4E47] m-0 tracking-wide font-['Amiri',serif] transition-colors">
              المدرسة الإلكترونية
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-[#1A4E47]/10 text-[#1A4E47] font-bold text-[11px] hidden md:inline">
              منظومة تدبير الفصول والغيابات والمخالفات
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#6C6356] flex-wrap">
            <span>{settings.institution || 'الثانوية الإعدادية ايكسان'}</span>
            <span className="text-[#D5CDC0]">•</span>
            <span className="font-semibold text-[#1A4E47]">
              {currentUser ? `الموسم: ${currentUser.academicYear || settings.year}` : `الموسم: ${settings.year || '2025/2026'}`}
            </span>
            <span className="text-[#D5CDC0]">•</span>
            
            {/* Legal time badge prominently displayed right next to institution info */}
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-700 text-white font-bold text-xs shadow-xs border border-emerald-800"
              title="التوقيت القانوني الرسمي المعتمد بالمملكة المغربية (GMT)"
            >
              <Clock className="w-3.5 h-3.5 text-[#FDE047] animate-pulse shrink-0" />
              <span className="text-emerald-100 font-semibold">التوقيت القانوني:</span>
              <span className="font-mono font-black text-sm text-white tracking-wider">
                {utcHours}:{utcMinutes}
              </span>
              <span className="text-[10px] bg-emerald-950 text-[#FDE047] px-1 py-0.2 rounded font-mono font-extrabold">
                GMT
              </span>
            </span>

            {saveStatusText ? (
              <>
                <span className="text-[#D5CDC0]">•</span>
                <span className="text-emerald-700 font-semibold animate-pulse">{saveStatusText}</span>
              </>
            ) : null}
            <span className="text-[11px] text-[#1A4E47] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              ← العودة للرئيسية
            </span>
          </div>
        </div>
      </div>

      {/* Action & User Navigation Area */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        
        {/* PWA Mobile & Desktop Install Button */}
        <PWAInstallButton variant="header" />

        {/* Quick Home / الرئيسية Button */}
        <button
          type="button"
          id="btn-nav-home"
          onClick={onGoHome}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs active:scale-[0.98] ${
            !isAdminRoute
              ? 'bg-white hover:bg-[#FAF8F5] text-[#1A4E47] border-[#E5DFD4] hover:border-[#1A4E47]/40'
              : 'bg-[#FAF8F5] text-[#6C6356] border-[#D5CDC0] hover:bg-white'
          }`}
          title="الرجوع إلى الصفحة الرئيسية مباشرة"
        >
          <Home className="w-4 h-4 text-[#1A4E47]" />
          <span>الرئيسية</span>
        </button>

        {/* Dedicated Admin Portal Navigation Button - Only visible for Super Admin or on /admin */}
        {(isAdminRoute || currentUser?.role === 'admin') && (
          <button
            type="button"
            id="btn-nav-admin-portal"
            onClick={onNavigateAdmin}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs active:scale-[0.98] ${
              isAdminRoute
                ? 'bg-[#1A4E47] text-white border-[#1A4E47]'
                : 'bg-[#E8F2F0] hover:bg-[#D5E9E5] text-[#1A4E47] border-[#1A4E47]/20'
            }`}
            title="بوابة المشرف العام على التطبيق (/admin)"
          >
            <ShieldCheck className={`w-4 h-4 ${isAdminRoute ? 'text-[#C98A3C]' : 'text-[#1A4E47]'}`} />
            <span>إدارة</span>
          </button>
        )}

        {/* 1. Independent Absences Register (سجل الغيابات) */}
        {onOpenDailyArchiveModal && (
          <button
            type="button"
            id="btn-nav-daily-archive"
            onClick={onOpenDailyArchiveModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs active:scale-[0.98] bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200"
            title="سجل الغيابات ومراقبة حالات الغياب والتأخر اليومية"
          >
            <UserX className="w-4 h-4 text-rose-600" />
            <span>سجل الغيابات</span>
          </button>
        )}

        {/* 2. Independent Violations Register (سجل المخالفات) */}
        {onOpenViolationsRegisterModal && (
          <button
            type="button"
            id="btn-nav-violations-register"
            onClick={onOpenViolationsRegisterModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs active:scale-[0.98] bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
            title="سجل المخالفات والانضباط المدرسي - طباعة المخالفات وإشعار أولياء الأمور"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>سجل المخالفات</span>
          </button>
        )}

        {/* Positive Participations & Honor Roll Print Button (Accessible for everyone) */}
        {onOpenPositiveReportModal && (
          <button
            type="button"
            id="btn-nav-positive-participations"
            onClick={onOpenPositiveReportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs active:scale-[0.98] bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border-[#F59E0B]/40"
            title="سجل ولوحة شرف المشاركات الإيجابية والتعزيز (طباعة للقسم أو التلميذ)"
          >
            <Sparkles className="w-4 h-4 text-[#D97706]" />
            <span className="hidden sm:inline">المشاركات الإيجابية ⭐</span>
            <span className="sm:hidden">إيجابية ⭐</span>
          </button>
        )}
        
        {/* User Account Controls */}
        {currentUser ? (
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-[#E5DFD4] shadow-xs">
            
            {/* If Admin or Director: Approvals Dashboard Button */}
            {currentUser.role === 'admin' || currentUser.role === 'director' ? (
              <button
                type="button"
                id="btn-admin-approvals"
                onClick={onOpenAdminApprovalsModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8F2F0] hover:bg-[#D5E9E5] text-[#1A4E47] text-xs font-bold transition-all cursor-pointer border border-[#1A4E47]/20"
                title={currentUser.role === 'admin' ? "لوحة المشرف العام للموافقة على طلبات إسناد الأقسام وإدارة المدراء" : "لوحة إدارة المؤسسة واعتماد الأقسام"}
              >
                {currentUser.role === 'admin' ? (
                  <ShieldCheck className="w-4 h-4 text-[#1A4E47]" />
                ) : (
                  <Building2 className="w-4 h-4 text-[#1A4E47]" />
                )}
                <span>{currentUser.role === 'admin' ? 'لوحة المشرف' : 'لوحة الإدارة'}</span>
                {pendingRequestsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-mono font-bold text-[10px] animate-pulse">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            ) : null}

            {/* Integrated Profile & Quick Logout Capsule */}
            <div className="flex items-center bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl pl-1 pr-2.5 py-1 text-xs shadow-2xs">
              <button
                type="button"
                id="btn-user-profile"
                onClick={onOpenProfileModal}
                className="flex items-center gap-1.5 text-[#1F2926] hover:text-[#1A4E47] font-semibold transition-all cursor-pointer"
                title="إعدادات الحساب والموسم الدراسي"
              >
                {currentUser.role === 'admin' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1A4E47]" />
                ) : currentUser.role === 'director' ? (
                  <Building2 className="w-3.5 h-3.5 text-[#1A4E47]" />
                ) : (
                  <User className="w-3.5 h-3.5 text-[#1A4E47]" />
                )}
                <span className="max-w-[120px] sm:max-w-[160px] truncate">
                  {currentUser.fullName}
                  {currentUser.role === 'teacher' && currentUser.subject && (
                    <span className="text-[10px] text-[#1A4E47] mr-1">({currentUser.subject})</span>
                  )}
                </span>
                <Settings className="w-3 h-3 text-[#6C6356]" />
              </button>

              <div className="w-[1px] h-3.5 bg-[#D5CDC0] mx-1.5" />

              <span
                className="w-2 h-2 rounded-full bg-emerald-600 shadow-[0_0_0_2px_rgba(16,185,129,0.18)]"
                title="الاتصال بقاعدة البيانات نشط ومؤمن"
                aria-label="الاتصال بقاعدة البيانات نشط"
              />

              {/* Compact, unobtrusive Logout Button with clear tooltip */}
              <button
                type="button"
                id="btn-logout"
                onClick={onLogout}
                className="p-1 rounded-lg text-[#6C6356] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer flex items-center justify-center mr-0.5"
                title="تسجيل الخروج"
                aria-label="تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Not Logged In: Login & Register Buttons */
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-open-login"
              onClick={() => onOpenAuthModal('login')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#1A4E47] hover:bg-[#133D37] text-white transition-all cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>تسجيل الدخول</span>
            </button>
            <button
              type="button"
              id="btn-open-register"
              onClick={() => onOpenAuthModal('register')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-[#1A4E47] bg-white hover:bg-[#FAF8F5] border border-[#D5CDC0] transition-all cursor-pointer"
            >
              <span>تسجيل أستاذ جديد</span>
            </button>
          </div>
        )}

        {/* Database & Backup Button (Director/Admin only) */}
        {currentUser?.role === 'admin' && (
          <button
            type="button"
            id="btn-open-db-tools"
            onClick={onOpenDbModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#1F2926] bg-white hover:bg-[#FAF8F5] border border-[#D5CDC0] transition-all cursor-pointer shadow-xs"
            title="عرض إحصائيات قاعدة البيانات والنسخ الاحتياطي (خاص بالمدير)"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#1A4E47]" />
            <span>قاعدة البيانات</span>
            {dbStats && (
              <span className="bg-[#FAF8F5] px-1.5 py-0.5 rounded-full text-[10px] font-mono text-[#6C6356] border border-[#E5DFD4]">
                {dbStats.fileSizeKb} KB
              </span>
            )}
          </button>
        )}

        {/* Change History Button (Director/Admin only) */}
        {currentUser?.role === 'admin' && (
          <button
            type="button"
            id="btn-open-history"
            onClick={onOpenHistoryModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#1F2926] bg-white hover:bg-[#FAF8F5] border border-[#D5CDC0] transition-all cursor-pointer shadow-xs"
            title="سجل التعديلات المحفوظة (خاص بالمدير)"
          >
            <History className="w-3.5 h-3.5 text-[#1A4E47]" />
            <span>السجل</span>
          </button>
        )}

        {/* Add Section Button: Hidden for administration to prevent obstructing clean visibility; available contextually inside sections tab */}
        {(!currentUser || currentUser.role === 'teacher') && (
          <button
            type="button"
            id="btn-add-section"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#1A4E47] hover:bg-[#133D37] text-white shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة قسم</span>
          </button>
        )}

      </div>

    </div>
  );
};
