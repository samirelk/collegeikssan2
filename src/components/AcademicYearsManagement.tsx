import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Sparkles,
  Info,
  CalendarCheck,
  CalendarDays
} from 'lucide-react';
import { AcademicYearItem, User as UserType } from '../types';

interface AcademicYearsManagementProps {
  currentUser: UserType;
  currentAcademicYear: string;
  onYearChanged?: (newYear: string) => void;
}

export const AcademicYearsManagement: React.FC<AcademicYearsManagementProps> = ({
  currentUser,
  currentAcademicYear,
  onYearChanged
}) => {
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal: Add Academic Year
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newIsCurrent, setNewIsCurrent] = useState(false);
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Modal: Confirm Archive
  const [archiveTarget, setArchiveTarget] = useState<AcademicYearItem | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Modal: Confirm Delete
  const [deleteTarget, setDeleteTarget] = useState<AcademicYearItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  const fetchAcademicYears = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/academic-years');
      const data = await res.json();
      if (data.success) {
        setAcademicYears(data.academicYears || []);
      } else {
        setErrorMessage(data.error || 'تعذر تحميل قائمة المواسم الدراسية');
      }
    } catch {
      setErrorMessage('خطأ في الاتصال بالخادم لتحميل المواسم الدراسية');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: Open add modal with calculated defaults (1 September - 3 July)
  const openAddModalWithDefaults = () => {
    setAddError(null);
    // Find highest start year
    let nextStartYear = 2027;
    if (academicYears.length > 0) {
      const maxYear = academicYears.reduce((max, y) => {
        const parts = y.name.split(/[\/\-_]/);
        const yNum = parseInt(parts[0], 10);
        return !isNaN(yNum) && yNum > max ? yNum : max;
      }, 2026);
      nextStartYear = maxYear + 1;
    }

    const nextEndYear = nextStartYear + 1;
    setNewYearName(`${nextStartYear}/${nextEndYear}`);
    setNewStartDate(`${nextStartYear}-09-01`); // 1 شتنبر
    setNewEndDate(`${nextEndYear}-07-30`);   // 30 يوليوز
    setNewIsCurrent(false);
    setNewNotes('');
    setIsAddModalOpen(true);
  };

  // Handle create new academic year
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newYearName.trim(),
          startDate: newStartDate.trim() || undefined,
          endDate: newEndDate.trim() || undefined,
          isCurrent: newIsCurrent,
          notes: newNotes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر إضافة الموسم الدراسي');
      }

      setAcademicYears(data.academicYears || []);
      setSuccessMessage(data.message || `تمت إضافة الموسم الدراسي (${newYearName}) بنجاح`);
      setIsAddModalOpen(false);

      if (newIsCurrent) {
        onYearChanged?.(newYearName.trim());
      }
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set as current active year
  const handleSetCurrent = async (year: AcademicYearItem) => {
    setActionLoadingId(year.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/academic-years/${year.id}/set-current`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر تغيير الموسم الدراسي الحالي');

      setAcademicYears(data.academicYears || []);
      setSuccessMessage(`تم تفعيل الموسم الدراسي (${year.name}) كموسم نشط للمؤسسة`);
      onYearChanged?.(year.name);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Archive academic year (حين انتهاء الموسم الدراسي يتم أرشفته)
  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setIsArchiving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/academic-years/${archiveTarget.id}/archive`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر أرشفة الموسم الدراسي');

      setAcademicYears(data.academicYears || []);
      setSuccessMessage(`تمت أرشفة الموسم الدراسي (${archiveTarget.name}) بنجاح وحفظ كافة بياناته.`);
      setArchiveTarget(null);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsArchiving(false);
    }
  };

  // Unarchive academic year
  const handleUnarchive = async (year: AcademicYearItem) => {
    setActionLoadingId(year.id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/academic-years/${year.id}/unarchive`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر إلغاء الأرشفة');

      setAcademicYears(data.academicYears || []);
      setSuccessMessage(`تم إلغاء أرشفة الموسم الدراسي (${year.name})`);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete academic year
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/academic-years/${deleteTarget.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر حذف الموسم الدراسي');

      setAcademicYears(data.academicYears || []);
      setSuccessMessage(`تم حذف الموسم الدراسي (${deleteTarget.name}) بنجاح`);
      setDeleteTarget(null);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper date formatter: e.g. "2026-09-01" -> "1 شتنبر 2026"
  const formatArabicDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      const monthNames: { [k: string]: string } = {
        '01': 'يناير',
        '02': 'فبراير',
        '03': 'مارس',
        '04': 'أبريل',
        '05': 'ماي',
        '06': 'يونيو',
        '07': 'يوليوز',
        '08': 'غشت',
        '09': 'شتنبر',
        '10': 'أكتوبر',
        '11': 'نونبر',
        '12': 'دجنبر'
      };
      const m = monthNames[month] || month;
      return `${parseInt(day, 10)} ${m} ${year}`;
    } catch {
      return dateStr;
    }
  };

  const currentYearObj = academicYears.find((y) => y.isCurrent) || academicYears.find((y) => y.name === '2026/2027');

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Info Banner */}
      <div className="p-5 rounded-2xl bg-[#F8F5EE] border border-[#E5DFD4] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#1A4E47] text-white font-bold text-xs">
              تدبير المواسم الدراسية
            </span>
            <span className="text-xs text-[#6C6356]">
              خاص بمدير المؤسسة
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Amiri',serif] text-[#1F2926]">
            سجل المواسم الدراسية وأرشيف الأعوام
          </h2>
          <p className="text-xs text-[#6C6356] mt-1 max-w-2xl leading-relaxed">
            يمكن للمدير في كل موسم دراسي جديد إضافة موسم دراسي مع التحديد الافتراضي للتواريخ (يبدأ يوم 1 شتنبر وينتهي يوم 30 يوليوز من العام الموالي). وعند انتهاء الموسم الدراسي يتم أرشفته لحفظ سجلات التلاميذ والغيابات.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModalWithDefaults}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة موسم دراسي جديد</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-shake">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-xs font-bold hover:underline cursor-pointer">إغلاق</button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-xs font-bold hover:underline cursor-pointer">إغلاق</button>
        </div>
      )}

      {/* Active Season Highlight Card */}
      {currentYearObj && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#1A4E47] to-[#133D37] text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between gap-4 flex-wrap relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#C98A3C]/20 border border-[#C98A3C]/50 flex items-center justify-center text-[#C98A3C] shrink-0">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#C98A3C] uppercase tracking-wide">
                    الموسم الدراسي الحالي المعتمد
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold">
                    نشط حالياً
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-0.5">
                  {currentYearObj.name}
                </div>
                <div className="text-xs text-[#F2EFE3]/80 mt-1 flex items-center gap-2">
                  <span>يبدأ: <strong>{formatArabicDate(currentYearObj.startDate)}</strong></span>
                  <span>•</span>
                  <span>ينتهي: <strong>{formatArabicDate(currentYearObj.endDate)}</strong></span>
                </div>
              </div>
            </div>

            {/* Archive button for current year */}
            <div className="flex items-center gap-2">
              {!currentYearObj.isArchived ? (
                <button
                  type="button"
                  onClick={() => setArchiveTarget(currentYearObj)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer"
                  title="أرشفة هذا الموسم الدراسي عند انتهائه"
                >
                  <Archive className="w-3.5 h-3.5 text-[#C98A3C]" />
                  <span>أرشفة هذا الموسم الدراسي</span>
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-200 text-xs font-bold border border-amber-400/30 flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5" />
                  <span>موسم مؤرشف</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List of All Academic Years */}
      <div className="bg-white rounded-2xl border border-[#E5DFD4] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E5DFD4] bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#1A4E47]" />
            <h3 className="font-bold text-sm text-[#1F2926]">
              كافة المواسم الدراسية المسجلة ({academicYears.length})
            </h3>
          </div>
          <span className="text-xs text-[#6C6356]">
            المعلومات الافتراضية: من 1 شتنبر إلى 30 يوليوز
          </span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-xs text-[#6C6356]">
            جارٍ تحميل بيانات المواسم الدراسية...
          </div>
        ) : academicYears.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#6C6356]">
            لا توجد مواسم دراسية مسجلة حالياً.
          </div>
        ) : (
          <div className="divide-y divide-[#E5DFD4]">
            {academicYears.map((year) => (
              <div
                key={year.id}
                className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  year.isCurrent ? 'bg-[#F2F8F6]/60' : 'hover:bg-[#FAF8F5]'
                }`}
              >
                {/* Year Details */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      year.isCurrent
                        ? 'bg-[#1A4E47] text-white border-[#1A4E47]'
                        : year.isArchived
                        ? 'bg-gray-100 text-gray-500 border-gray-200'
                        : 'bg-[#FAF8F5] text-[#1A4E47] border-[#D5CDC0]'
                    }`}
                  >
                    {year.isArchived ? (
                      <Archive className="w-5 h-5" />
                    ) : (
                      <Calendar className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-base font-bold text-[#1F2926]">
                        الموسم الدراسي: {year.name}
                      </span>

                      {year.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          <span>الموسم الحالي النشط</span>
                        </span>
                      )}

                      {year.isArchived && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold text-[10px] border border-gray-300 flex items-center gap-1">
                          <Archive className="w-3 h-3 text-gray-500" />
                          <span>مؤرشف</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#6C6356] mt-1 flex items-center gap-2 flex-wrap">
                      <span>يبدأ: <strong>{formatArabicDate(year.startDate)}</strong></span>
                      <span className="text-[#D5CDC0]">•</span>
                      <span>ينتهي: <strong>{formatArabicDate(year.endDate)}</strong></span>
                      {year.notes && (
                        <>
                          <span className="text-[#D5CDC0]">•</span>
                          <span className="text-[#8C8376] italic">{year.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Set as Current Button */}
                  {!year.isCurrent && (
                    <button
                      type="button"
                      disabled={actionLoadingId === year.id}
                      onClick={() => handleSetCurrent(year)}
                      className="px-3 py-1.5 rounded-xl bg-[#E8F2F0] hover:bg-[#D5E9E5] text-[#1A4E47] font-bold text-xs border border-[#1A4E47]/20 transition-all cursor-pointer disabled:opacity-50"
                      title="تعيين هذا الموسم كموسم دراسي نشط للمؤسسة"
                    >
                      {actionLoadingId === year.id ? 'جارٍ التعيين...' : 'تعيين كموسم حالي'}
                    </button>
                  )}

                  {/* Archive / Unarchive Button */}
                  {!year.isArchived ? (
                    <button
                      type="button"
                      onClick={() => setArchiveTarget(year)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-amber-50 text-[#92400E] font-bold text-xs border border-[#E5DFD4] hover:border-amber-300 transition-all cursor-pointer"
                      title="أرشفة هذا الموسم عند انتهائه"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>أرشفة الموسم</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoadingId === year.id}
                      onClick={() => handleUnarchive(year)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-gray-100 text-gray-700 font-bold text-xs border border-gray-300 transition-all cursor-pointer"
                      title="إلغاء أرشفة الموسم"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      <span>إلغاء الأرشفة</span>
                    </button>
                  )}

                  {/* Delete Button (Allowed only if not current) */}
                  {!year.isCurrent && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(year)}
                      className="p-1.5 rounded-xl text-[#6C6356] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="حذف هذا الموسم الدراسي"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add Academic Year */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#E5DFD4] animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E8F2F0] text-[#1A4E47] flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1F2926] font-['Amiri',serif]">
                    إضافة موسم دراسي جديد
                  </h3>
                  <p className="text-xs text-[#6C6356]">
                    المعلومات الافتراضية محددة تلقائياً بناءً على التقويم المدرسي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Explanatory Notice */}
            <div className="mt-4 p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD4] text-xs text-[#6C6356] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#1A4E47] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-[#1F2926] block mb-0.5">القاعدة الافتراضية للموسم الدراسي:</strong>
                يبدأ الموسم الدراسي رسمياً يوم <strong>1 شتنبر</strong> وينتهي يوم <strong>30 يوليوز</strong> من العام الموالي. يمكنك تعديل التواريخ يدوياً إذا اقتضت الحاجة.
              </div>
            </div>

            {addError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {/* Season Name */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  اسم الموسم الدراسي (مثال: 2026/2027 أو 2027/2028)
                </label>
                <input
                  type="text"
                  required
                  value={newYearName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewYearName(val);
                    // auto calculate dates if year changed
                    const parts = val.split(/[\/\-_]/);
                    const y = parseInt(parts[0], 10);
                    if (!isNaN(y) && y >= 2000 && y <= 2100) {
                      setNewStartDate(`${y}-09-01`);
                      setNewEndDate(`${y + 1}-07-30`);
                    }
                  }}
                  placeholder="2027/2028"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono text-left font-bold"
                  dir="ltr"
                />
              </div>

              {/* Start and End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">
                    تاريخ البداية (افتراضياً: 1 شتنبر)
                  </label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-[#6C6356] mt-0.5 block">
                    {formatArabicDate(newStartDate)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">
                    تاريخ الانتهاء (افتراضياً: 30 يوليوز)
                  </label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-[#6C6356] mt-0.5 block">
                    {formatArabicDate(newEndDate)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  ملاحظات أو توصيف اختياري
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="مثال: الموسم الدراسي المعتمد لمؤسسة ايكسان"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
              </div>

              {/* Make current checkbox */}
              <label className="flex items-center gap-2 text-xs text-[#1F2926] font-semibold cursor-pointer p-2.5 rounded-xl hover:bg-[#FAF8F5] border border-transparent hover:border-[#E5DFD4]">
                <input
                  type="checkbox"
                  checked={newIsCurrent}
                  onChange={(e) => setNewIsCurrent(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1A4E47] accent-[#1A4E47] cursor-pointer"
                />
                <span>تعيين هذا الموسم كموسم دراسي حالي نشط فوراً</span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? 'جاري الإضافة...' : 'تأكيد إضافة الموسم الدراسي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Archive */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E5DFD4]">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
              <Archive className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-base text-center text-[#1F2926] font-['Amiri',serif]">
              أرشفة الموسم الدراسي ({archiveTarget.name})
            </h3>
            
            <p className="text-xs text-[#6C6356] text-center mt-2 leading-relaxed">
              عند انتهاء الموسم الدراسي، يتم أرشفته للاحتفاظ بجميع لوائح الأقسام وسجلات الغياب والتلاميذ دون تعديلها، مع إمكانية مراجعتها والرجوع إليها في أي وقت.
            </p>

            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={handleArchiveConfirm}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isArchiving ? 'جارٍ الأرشفة...' : 'تأكيد أرشفة الموسم'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E5DFD4]">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-base text-center text-[#1F2926] font-['Amiri',serif]">
              حذف الموسم الدراسي ({deleteTarget.name})
            </h3>

            <p className="text-xs text-[#6C6356] text-center mt-2 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف هذا الموسم الدراسي نهائياً من السجل؟
            </p>

            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
