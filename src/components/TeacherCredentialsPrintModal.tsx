import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  X,
  KeyRound,
  Eye,
  EyeOff,
  Search,
  Filter,
  Scissors,
  TableProperties,
  Download,
  Check,
  Building2,
  Calendar,
  Lock,
  UserCheck,
  ShieldCheck,
  School
} from 'lucide-react';
import { AppSettings, User } from '../types';
import { printTeacherCredentialsReport } from '../utils/printNotes';

export interface TeacherCredentialItem {
  id: string;
  username: string;
  email: string;
  password?: string;
  fullName: string;
  role: string;
  academicYear?: string;
  status: string;
  subject?: string;
  emailVerified?: boolean;
  createdAt?: string;
  assignedSectionsCount?: number;
}

export interface TeacherCredentialsPrintModalProps {
  currentUser: User;
  settings: AppSettings;
  onClose: () => void;
  initialTeacherId?: string;
}

export const TeacherCredentialsPrintModal: React.FC<TeacherCredentialsPrintModalProps> = ({
  currentUser,
  settings,
  onClose,
  initialTeacherId
}) => {
  const [teachers, setTeachers] = useState<TeacherCredentialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showPasswords, setShowPasswords] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [singleTeacherForPrint, setSingleTeacherForPrint] = useState<TeacherCredentialItem | null>(null);

  const institutionName = settings.institution || 'الثانوية الإعدادية ايكسان';
  const academicYear = settings.year || '2026/2027';

  // Fetch credentials from secure Director/Admin endpoint
  useEffect(() => {
    let isMounted = true;
    const fetchCredentials = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/director/teachers/credentials', {
          headers: {
            'x-user-id': currentUser.id,
            'x-user-role': currentUser.role
          }
        });
        const data = await res.json();
        if (isMounted) {
          if (data.success && Array.isArray(data.teachers)) {
            setTeachers(data.teachers);
            if (initialTeacherId) {
              const matched = data.teachers.find((t: any) => t.id === initialTeacherId);
              if (matched) {
                setSearchQuery(matched.fullName);
              }
            }
          } else {
            setError(data.error || 'تعذر تحميل بيانات حسابات الأساتذة');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'خطأ في الاتصال بالخادم');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCredentials();
    return () => {
      isMounted = false;
    };
  }, [currentUser, initialTeacherId]);

  // Extract distinct subjects
  const distinctSubjects = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => {
      if (t.subject && t.subject.trim()) {
        set.add(t.subject.trim());
      }
    });
    return Array.from(set).sort();
  }, [teachers]);

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.fullName.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.subject && t.subject.toLowerCase().includes(q));

      const matchesSubject = subjectFilter === 'all' || t.subject === subjectFilter;

      return matchesSearch && matchesSubject;
    });
  }, [teachers, searchQuery, subjectFilter]);

  // If printing a single slip, isolate that teacher; otherwise print all filtered teachers
  const displayedTeachers = useMemo(() => {
    if (singleTeacherForPrint) {
      return [singleTeacherForPrint];
    }
    return filteredTeachers;
  }, [singleTeacherForPrint, filteredTeachers]);

  const handlePrint = () => {
    setSingleTeacherForPrint(null);
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const handlePrintSingle = (t: TeacherCredentialItem) => {
    setSingleTeacherForPrint(t);
    setTimeout(() => {
      window.print();
      const resetTimer = setTimeout(() => {
        setSingleTeacherForPrint(null);
      }, 1500);
      window.addEventListener('afterprint', () => {
        clearTimeout(resetTimer);
        setSingleTeacherForPrint(null);
      }, { once: true });
    }, 80);
  };

  const handleCopyCredentials = (t: TeacherCredentialItem) => {
    const pwd = t.password && t.password.trim() ? t.password.trim() : '123456';
    const text = `اسم الأستاذ: ${t.fullName}\nالمادة: ${t.subject || 'غير محدد'}\nاسم المستخدم: ${t.username}\nكلمة المرور: ${pwd}\nرابط المنصة: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleExportCSV = () => {
    if (filteredTeachers.length === 0) return;
    const header = ['الرقم', 'الاسم الكامل', 'المادة الدراسية', 'اسم المستخدم', 'البريد الإلكتروني', 'كلمة المرور', 'الموسم الدراسي', 'حالة الحساب'];
    const rows = filteredTeachers.map((t, idx) => [
      idx + 1,
      `"${t.fullName.replace(/"/g, '""')}"`,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      `"${t.username}"`,
      `"${t.email}"`,
      `"${((t.password && t.password.trim()) || '123456').replace(/"/g, '""')}"`,
      `"${t.academicYear || academicYear}"`,
      t.status === 'active' ? 'مفعل' : 'معلق'
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `حسابات_أساتذة_${institutionName.replace(/\s+/g, '_')}_${academicYear.replace('/', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible">
      {/* Print-specific style overrides */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            background: white !important;
            color: black !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden;
          }
          #teacher-credentials-print-area,
          #teacher-credentials-print-area * {
            visibility: visible !important;
          }
          #teacher-credentials-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 4mm !important;
            background: white !important;
            color: black !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-card-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }
      `}</style>

      <div className="bg-[#FAF7F0] border border-[#D9CEB0] rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden print:border-none print:shadow-none print:rounded-none print:max-h-none print:bg-white">
        
        {/* MODAL HEADER (No Print) */}
        <div className="no-print p-4 sm:p-5 bg-gradient-to-r from-[#2A4D3B] via-[#1E3B2C] to-[#152B20] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#3D6952]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-serif flex items-center gap-2">
                <span>طباعة بطاقات وبيانات دخول هيئة التدريس</span>
                <span className="text-xs font-sans px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30">
                  خاص بالسيد المدير
                </span>
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                توليد بطاقات وقسيمات فردية لتوزيعها على الأساتذة لتمكينهم من تسجيل الدخول لحساباتهم.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || filteredTeachers.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#1B3628] font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ طباعة الآن</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOOLBAR CONTROLS (No Print) */}
        <div className="no-print p-3 sm:p-4 bg-[#F2ECDC] border-b border-[#D9CEB0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#E5DDC7] p-1 rounded-xl border border-[#CFC3A5]">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-[#2A4D3B] text-white shadow-xs'
                    : 'text-[#5A4E3D] hover:text-[#2A2118]'
                }`}
                title="بطاقات وقسيمات فردية للقص والتسليم"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>بطاقات تسليم فردية (قص ✂️)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[#2A4D3B] text-white shadow-xs'
                    : 'text-[#5A4E3D] hover:text-[#2A2118]'
                }`}
                title="جدول إجمالي للحسابات والتوقيع بالاستلام"
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span>لائحة إجمالية للتوقيع 📋</span>
              </button>
            </div>

            {/* Toggle Passwords Visibility */}
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#4A3E2D] border border-[#D9CEB0] text-xs font-bold transition-colors cursor-pointer"
              title={showPasswords ? 'إخفاء كلمات المرور في المعاينة' : 'إظهار كلمات المرور في المعاينة'}
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{showPasswords ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredTeachers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#2D5A27] border border-[#D9CEB0] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              title="تصدير بيانات الحسابات كملف Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير CSV</span>
            </button>
          </div>

          {/* Search & Subject Filter */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7D6B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن أستاذ أو مادة..."
                className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl bg-white border border-[#D9CEB0] text-[#2A2118] focus:outline-hidden focus:ring-1 focus:ring-[#2A4D3B]"
              />
            </div>

            {distinctSubjects.length > 0 && (
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl bg-white border border-[#D9CEB0] text-[#2A2118] focus:outline-hidden focus:ring-1 focus:ring-[#2A4D3B]"
              >
                <option value="all">جميع المواد ({teachers.length})</option>
                {distinctSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* PRINTABLE BODY AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0 print:overflow-visible" id="teacher-credentials-print-area">
          {isLoading ? (
            <div className="py-20 text-center text-sm text-[#7A6B58]">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#2A4D3B] border-t-transparent mb-3" />
              <p>جاري استخراج بيانات الأساتذة وكلمات المرور...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-center">
              {error}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#7A6B58] bg-white rounded-2xl border border-dashed border-[#D9CEB0] p-6">
              <KeyRound className="w-12 h-12 text-[#B3A68F] mx-auto mb-3" />
              <h3 className="font-bold text-[#2A2118] text-base mb-1">لا توجد حسابات أساتذة مطابقة</h3>
              <p className="text-xs text-[#7A6B58] max-w-md mx-auto">
                {teachers.length === 0
                  ? 'لم يتم تسجيل أو استيراد أي أساتذة حتى الآن. يرجى إضافة الأساتذة من لوحة المدير عبر زر "استيراد Excel" أو "إنشاء حساب فردي" أولاً.'
                  : 'لا يوجد أساتذة يطابقون معايير البحث أو المادة المحددة.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* OFFICIAL PRINT HEADER (Visible on print & screen) */}
              <div className="border-b-2 border-[#1E3B2C] pb-4 mb-4 text-center">
                <div className="flex items-center justify-between text-xs text-[#5B5040] mb-2 font-serif">
                  <div className="text-right">
                    <p className="font-bold text-[#1E3B2C]">المملكة المغربية</p>
                    <p>وزارة التربية الوطنية والتعليم الأولي والرياضة</p>
                    <p>الأكاديمية الجهوية للتربية والتكوين</p>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-[#1E3B2C] flex items-center justify-center p-1">
                    <School className="w-7 h-7 text-[#1E3B2C]" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-[#1E3B2C]">{institutionName}</p>
                    <p>الموسم الدراسي: {academicYear}</p>
                    <p>الإدارة التربوية / مكتب السيد المدير</p>
                  </div>
                </div>

                <h1 className="text-lg sm:text-xl font-bold font-serif text-[#1E3B2C] mt-2">
                  {viewMode === 'cards'
                    ? 'بطاقات تسليم بيانات الولوج للحسابات الشخصية لهيئة التدريس'
                    : 'لائحة تسليم بيانات الولوج للحسابات الشخصية مع التوقيع بالاستلام'}
                </h1>
                <p className="text-xs text-[#7A6B58] mt-0.5">
                  منظومة تدبير الفصول الدراسية وتتبع الغياب والمواظبة • العدد: {displayedTeachers.length} أستاذ(ة)
                </p>
              </div>

              {/* 1. CARDS / SLIPS MODE (✂️ 6 to 8 cards per page with scissors) */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-card-grid">
                  {displayedTeachers.map((t, idx) => (
                    <div
                      key={t.id}
                      className="page-break-inside-avoid relative bg-white border-2 border-dashed border-[#8C7D6B] rounded-xl p-4 shadow-xs print:shadow-none print:border-black/60 print:rounded-none flex flex-col justify-between"
                      style={{ minHeight: '230px' }}
                    >
                      {/* Cut line indicator */}
                      <div className="absolute -top-2.5 left-6 bg-white px-2 text-[10px] font-mono text-[#8C7D6B] print:text-black flex items-center gap-1 border border-dashed border-[#B3A68F] rounded-full">
                        <Scissors className="w-2.5 h-2.5" />
                        <span>قـص من هـنـا ✂️</span>
                      </div>

                      {/* Slip Header */}
                      <div>
                        <div className="flex items-center justify-between border-b border-[#E5DFD4] pb-2 mb-2.5">
                          <div>
                            <span className="text-[10px] font-bold text-[#1E3B2C] block">
                              {institutionName} • {academicYear}
                            </span>
                            <span className="text-[11px] font-bold text-[#2A2118]">
                              وصل تسليم الحساب الشخصي (رقم {idx + 1})
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFE9D5] text-[#4A3E2D] font-bold border border-[#D9CEB0]">
                            {t.subject || 'هيئة التدريس'}
                          </span>
                        </div>

                        {/* Credentials Data Box */}
                        <div className="bg-[#FAF8F5] border border-[#E5DFD4] rounded-lg p-2.5 mb-2.5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#6C6356] font-medium text-[11px]">الأستاذ(ة):</span>
                            <span className="font-bold text-[#1E3B2C] text-sm">{t.fullName}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[#6C6356] font-medium text-[11px]">المادة المسندة:</span>
                            <span className="font-bold text-[#2A2118]">{t.subject || '—'}</span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[#EFEAE1]">
                            <span className="text-[#6C6356] font-medium text-[11px]">اسم المستخدم:</span>
                            <span className="font-mono font-bold text-[#1E3B2C] text-xs bg-white px-1.5 py-0.5 rounded border border-[#D9CEB0] select-all">
                              {t.username}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[#6C6356] font-medium text-[11px]">البريد الإلكتروني:</span>
                            <span className="font-mono text-[11px] text-[#4A3E2D] bg-white px-1.5 py-0.5 rounded border border-[#D9CEB0] select-all">
                              {t.email}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[#EFEAE1] bg-amber-50/70 p-1.5 rounded border border-amber-200/60">
                            <span className="text-amber-900 font-bold text-[11px] flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-700" />
                              <span>كلمة المرور الأولية:</span>
                            </span>
                            <span className="font-mono font-bold text-amber-950 text-sm tracking-wider select-all print:hidden">
                              {showPasswords ? ((t.password && t.password.trim()) || '123456') : '••••••••'}
                            </span>
                            <span className="font-mono font-bold text-amber-950 text-sm tracking-wider select-all hidden print:inline">
                              {(t.password && t.password.trim()) || '123456'}
                            </span>
                          </div>
                        </div>

                        {/* Instructions */}
                        <p className="text-[9px] text-[#7A6B58] leading-tight mb-2">
                          ⚠️ <strong>توجيه أمني:</strong> هذا الوصل شخصي وسري. يرجى تسجيل الدخول وتغيير كلمة المرور فوراً من خانة الملف الشخصي لضمان حماية حسابكم.
                        </p>
                      </div>

                      {/* Teacher Receipt Signature Box */}
                      <div className="border-t border-[#D9CEB0] pt-2 flex items-center justify-between text-[10px] text-[#5A4E3D]">
                        <div>
                          <span>تاريخ التسليم: .... / .... / 202..</span>
                        </div>
                        <div className="text-left font-serif">
                          <span>توقيع الأستاذ(ة) بالاستلام:</span>
                          <span className="inline-block w-24 border-b border-dotted border-black/40 mr-1" />
                        </div>
                      </div>

                      {/* Screen-only Actions (Copy & Print Single Slip) */}
                      <div className="no-print mt-2 pt-2 border-t border-dashed border-[#E5DFD4] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handlePrintSingle(t)}
                          className="flex items-center gap-1 text-[11px] text-[#2A4D3B] hover:text-[#152B20] font-bold cursor-pointer bg-[#FAF8F5] hover:bg-[#EFE9D5] px-2.5 py-1 rounded-lg border border-[#D9CEB0] transition-colors"
                          title="طباعة وصل هذا الأستاذ بمفرده"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-600" />
                          <span>طباعة هذا الوصل 🖨️</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(t)}
                          className="flex items-center gap-1 text-[11px] text-[#2A4D3B] hover:text-[#152B20] font-bold cursor-pointer"
                        >
                          {copiedId === t.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">تم النسخ!</span>
                            </>
                          ) : (
                            <span>نسخ البيانات</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. MASTER TABLE MODE (📋 Formal Sign-off Table) */}
              {viewMode === 'table' && (
                <div className="border border-[#1E3B2C] rounded-xl overflow-x-auto print:rounded-none bg-white">
                  <table className="w-full text-right text-xs border-collapse min-w-[650px] print:min-w-0">
                    <thead>
                      <tr className="bg-[#1E3B2C] text-white print:bg-[#1E3B2C] print:text-white">
                        <th className="p-2.5 font-bold border border-[#1E3B2C] text-center w-10">#</th>
                        <th className="p-2.5 font-bold border border-[#1E3B2C]">الأستاذ(ة)</th>
                        <th className="p-2.5 font-bold border border-[#1E3B2C] text-center">المادة</th>
                        <th className="p-2.5 font-bold border border-[#1E3B2C]">اسم المستخدم</th>
                        <th className="p-2.5 font-bold border border-[#1E3B2C]">البريد الإلكتروني</th>
                        <th className="p-2.5 font-bold border border-[#1E3B2C] text-center">كلمة المرور الأولية</th>
                        <th className="p-2.5 font-bold border border-[#1E3B2C] text-center w-24">تاريخ التسليم</th>
                        <th className="p-2.5 font-bold border border-[#1E3B2C] text-center w-36">توقيع الأستاذ بالاستلام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9CEB0]">
                      {displayedTeachers.map((t, idx) => (
                        <tr key={t.id} className="hover:bg-[#FAF8F5] transition-colors page-break-inside-avoid">
                          <td className="p-2 text-center font-mono font-bold text-[#6C6356] border border-[#E5DFD4]">
                            {idx + 1}
                          </td>
                          <td className="p-2 font-bold text-[#1E3B2C] border border-[#E5DFD4]">
                            {t.fullName}
                          </td>
                          <td className="p-2 text-center text-[#4A3E2D] font-medium border border-[#E5DFD4]">
                            {t.subject || '—'}
                          </td>
                          <td className="p-2 font-mono text-[11px] font-bold text-[#2A2118] border border-[#E5DFD4]">
                            {t.username}
                          </td>
                          <td className="p-2 font-mono text-[11px] text-[#5A4E3D] border border-[#E5DFD4]">
                            {t.email}
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-amber-950 bg-amber-50/50 border border-[#E5DFD4]">
                            <span className="print:hidden">
                              {showPasswords ? ((t.password && t.password.trim()) || '123456') : '••••••••'}
                            </span>
                            <span className="hidden print:inline font-mono font-bold text-amber-950">
                              {(t.password && t.password.trim()) || '123456'}
                            </span>
                          </td>
                          <td className="p-2 text-center text-[10px] text-[#8C7D6B] border border-[#E5DFD4]">
                            ..... / ..... / 202..
                          </td>
                          <td className="p-2 text-center border border-[#E5DFD4]">
                            <div className="h-7 w-full border-b border-dotted border-black/40" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Table Footer with Official Director Stamp */}
                  <div className="p-6 bg-[#FAF8F5] border-t-2 border-[#1E3B2C] flex items-center justify-between text-xs font-serif">
                    <div className="text-right">
                      <p className="font-bold text-[#1E3B2C]">ملاحظة إدارية:</p>
                      <p className="text-[#6C6356] text-[11px] max-w-md">
                        تُحفظ هذه اللائحة الموقعة لدى السيد مدير المؤسسة كأرشيف رسمي يثبت تسليم حسابات الولوج لكافة أطر هيئة التدريس بالمؤسسة.
                      </p>
                    </div>

                    <div className="text-center font-bold text-[#1E3B2C] space-y-8">
                      <p>توقيع وخاتم السيد مدير المؤسسة</p>
                      <p className="text-xs font-sans text-[#7A6B58]">{settings.teacher || 'محمد الشريف'}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* MODAL FOOTER (No Print) */}
        <div className="no-print p-4 bg-[#EFE9D5] border-t border-[#D9CEB0] flex items-center justify-between gap-3 text-xs">
          <div className="text-[#6C6356] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>يتم توليد بيانات الولوج بأمان عبر الصلاحيات الحصرية للمدير العام والمشرف.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || filteredTeachers.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A4D3B] hover:bg-[#1E3B2C] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ طباعة الآن (Print)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#4A3E2D] border border-[#D9CEB0] font-bold text-xs transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
