import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Printer,
  Trash2,
  Plus,
  Clock,
  X,
  Loader2,
  ShieldAlert,
  User,
  BookOpen,
  CheckCircle2,
  MessageCircle,
  Share2
} from 'lucide-react';
import { SeatItem, SectionItem, AppSettings, User as UserType, ViolationTypeItem, StudentViolationRecord } from '../types';
import { printViolationsReport, printSingleViolationNotice, shareViolationViaWhatsApp } from '../utils/printNotes';

interface ViolationsModalProps {
  section: SectionItem;
  seat: SeatItem;
  settings: AppSettings;
  currentUser: UserType | null;
  onClose: () => void;
  onAddViolation: (data: {
    violationType: string;
    actionTaken?: string;
    teacherName?: string;
    teacherSubject?: string;
    date?: string;
    time?: string;
  }) => Promise<void>;
  onDeleteViolation: (violationId: string) => Promise<void>;
  studentHistory?: {
    absences: Array<{ id: number; status: string; recordedDate: string; sessionPeriod: string; teacherName: string; teacherSubject: string; justified: string }>;
    absenceDays: string[];
    absenceRecordCount: number;
    violations: Array<{ id: string; violationType: string; actionTaken: string; recordedDate: string; recordedTime: string; teacherName: string }>;
  } | null;
  isStudentHistoryLoading?: boolean;
}

export const ViolationsModal: React.FC<ViolationsModalProps> = ({
  section,
  seat,
  settings,
  currentUser,
  onClose,
  onAddViolation,
  onDeleteViolation,
  studentHistory,
  isStudentHistoryLoading = false
}) => {
  const [violationTypes, setViolationTypes] = useState<ViolationTypeItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [actionTaken, setActionTaken] = useState<string>('تنبيه شفهي');
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justRecordedViolation, setJustRecordedViolation] = useState<{
    violationType: string;
    actionTaken: string;
    teacherName: string;
    teacherSubject: string;
    date: string;
    time: string;
  } | null>(null);

  // Load predefined violation types
  useEffect(() => {
    fetchViolationTypes();
  }, []);

  const fetchViolationTypes = async () => {
    try {
      setIsLoadingTypes(true);
      const res = await fetch('/api/violation-types');
      const data = await res.json();
      if (data.success && Array.isArray(data.types) && data.types.length > 0) {
        setViolationTypes(data.types);
        setSelectedType(data.types[0].title);
      } else {
        // Fallback default list
        const fallback = [
          'عدم إحضار الأدوات المدرسية',
          'عدم إنجاز الواجبات المنزلية',
          'التشويش داخل القسم',
          'عدم احترام الأستاذ',
          'عدم احترام زملاء القسم',
          'استعمال الهاتف أثناء الحصة',
          'مغادرة القسم دون إذن',
          'عدم الانضباط',
          'إتلاف ممتلكات المؤسسة',
          'مخالفة النظام الداخلي'
        ].map((title, idx) => ({ id: `fallback_${idx}`, title, orderIndex: idx }));
        setViolationTypes(fallback as any);
        setSelectedType(fallback[0].title);
      }
    } catch (err) {
      console.error('Error fetching violation types:', err);
    } finally {
      setIsLoadingTypes(false);
    }
  };

  // Format date & time with French numerals in GMT (e.g. 18/09/2026, 14:30 GMT)
  const getFrenchDateTime = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    const day = pad(d.getUTCDate());
    const month = pad(d.getUTCMonth() + 1);
    const year = d.getUTCFullYear();
    const hours = pad(d.getUTCHours());
    const minutes = pad(d.getUTCMinutes());
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}`
    };
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType.trim()) {
      setErrorMsg('يرجى تحديد نوع المخالفة من القائمة');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const { date, time } = getFrenchDateTime();

      const teacherName = currentUser?.fullName || section.teacher || settings.teacher || 'أستاذ المادة';
      const teacherSubject = currentUser?.subject || 'المادة';

      await onAddViolation({
        violationType: selectedType.trim(),
        actionTaken,
        teacherName,
        teacherSubject,
        date,
        time
      });

      setJustRecordedViolation({
        violationType: selectedType.trim(),
        actionTaken,
        teacherName,
        teacherSubject,
        date,
        time
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تسجيل المخالفة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSingle = (v: {
    violationType: string;
    actionTaken?: string;
    teacherName?: string;
    teacherSubject?: string;
    date?: string;
    time?: string;
  }) => {
    printSingleViolationNotice({
      institution: settings.institution || 'المؤسسة التعليمية',
      academicYear: currentUser?.academicYear || settings.year || '2026/2027',
      level: section.level,
      classNumber: section.classNumber,
      teacherName: v.teacherName || currentUser?.fullName || section.teacher || 'أستاذ المادة',
      subject: v.teacherSubject || currentUser?.subject || '',
      studentName: seat.name || 'غير مسجل',
      studentNumber: seat.number,
      massarNumber: seat.massarNumber,
      violationType: v.violationType,
      actionTaken: v.actionTaken || 'تنبيه شفهي',
      date: v.date,
      time: v.time
    });
  };

  const handleWhatsAppShare = (v: {
    violationType: string;
    actionTaken?: string;
    teacherName?: string;
    teacherSubject?: string;
    date?: string;
    time?: string;
  }) => {
    shareViolationViaWhatsApp({
      institution: settings.institution || 'المؤسسة التعليمية',
      studentName: seat.name || 'غير مسجل',
      level: section.level,
      classNumber: section.classNumber,
      massarNumber: seat.massarNumber,
      violationType: v.violationType,
      date: v.date,
      time: v.time,
      teacherName: v.teacherName || currentUser?.fullName || section.teacher || 'أستاذ المادة',
      subject: v.teacherSubject || currentUser?.subject || '',
      actionTaken: v.actionTaken || 'تنبيه شفهي'
    });
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await onDeleteViolation(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrint = () => {
    const violationsList = seat.violations || [];

    printViolationsReport({
      institution: settings.institution || 'المؤسسة التعليمية',
      academicYear: currentUser?.academicYear || settings.year || '2026/2027',
      level: section.level,
      classNumber: section.classNumber,
      teacherName: currentUser?.fullName || section.teacher || settings.teacher || '—',
      subject: currentUser?.subject || '',
      studentName: seat.name || 'غير مسجل',
      seatNum: seat.seat,
      studentNumber: seat.number,
      massarNumber: seat.massarNumber,
      violations: violationsList
    });
  };

  const studentDisplayName = seat.name ? seat.name : `المقعد #${seat.seat}`;

  // Unified list of violations for this seat - STRICTLY violations only
  const violationsList: StudentViolationRecord[] = seat.violations || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#FAF8F5] text-[#1F2926] rounded-2xl w-full max-w-2xl max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-[#D5CDC0] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-3 sm:p-5 border-b border-[#E5DFD5] flex items-start justify-between gap-2.5 sm:gap-3 bg-gradient-to-r from-[#F5F0E6] to-[#FAF8F5] relative pr-3 pl-12 sm:px-5">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 border border-red-200">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-bold font-serif text-[#1F2926] m-0 truncate">
                  سجل المخالفات — {studentDisplayName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                  {violationsList.length} مخالفات
                </span>
              </div>

              <div className="text-[11px] sm:text-xs text-[#5E6D66] mt-1 flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="font-semibold bg-[#E8F2F0] text-[#1A4E47] px-1.5 py-0.5 rounded-md">
                  المقعد #{seat.seat}
                </span>
                {seat.number && (
                  <span>
                    الرقم: <strong className="font-mono text-[#1F2926]">{seat.number}</strong>
                  </span>
                )}
                {seat.massarNumber && (
                  <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded-md border border-blue-200">
                    مسار: <strong className="font-mono font-bold">{seat.massarNumber}</strong>
                  </span>
                )}
                <span>· {section.level} ({section.classNumber})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold rounded-lg bg-white hover:bg-[#F5F0E6] border border-[#D5CDC0] text-[#1F2926] transition-colors cursor-pointer shadow-2xs"
              title="طباعة بطاقة تسجيل المخالفات الرسمية"
            >
              <Printer className="w-3.5 h-3.5 text-red-700" />
              <span className="hidden sm:inline">طباعة السجل</span>
              <span className="sm:hidden">طباعة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="absolute left-2.5 top-2.5 sm:relative sm:left-auto sm:top-auto w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[#5E6D66] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer text-lg font-bold"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Teacher Recording Info Box */}
          <div className="bg-white p-3.5 rounded-xl border border-[#E5DFD5] flex items-center justify-between text-xs text-[#5E6D66] flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#1A4E47]" />
              <span>الأستاذ المسجل: <strong className="text-[#1F2926]">{currentUser?.fullName || section.teacher || 'أستاذ المادة'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#1A4E47]" />
              <span>المادة: <strong className="text-[#1F2926]">{currentUser?.subject || 'عامة'}</strong></span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
              <Clock className="w-3 h-3" />
              <span>التاريخ بالأرقام الفرنسية: {getFrenchDateTime().date}</span>
            </div>
          </div>

          <div className="bg-[#F7F3EB] border border-[#E5DFD4] rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-sm font-bold text-[#1F2926]">بطاقة معلومات التلميذ</h4>
                <div className="text-xs text-[#6C6356] mt-1">{seat.name || 'تلميذ غير مسجل'} · المقعد {seat.seat}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
                <span className="px-2 py-1 rounded-lg bg-white border border-[#D5CDC0] text-[#1F2926]">الرقم: {seat.number || '—'}</span>
                <span className="px-2 py-1 rounded-lg bg-white border border-[#D5CDC0] text-[#1F2926]">مسار: {seat.massarNumber || '—'}</span>
                <span className="px-2 py-1 rounded-lg bg-[#E8F2F0] border border-[#B9D8D2] text-[#1A4E47]">
                  الحالة: {seat.statusColor === 'excellent' ? 'متفوق' : seat.statusColor === 'needs_help' ? 'يحتاج مساعدة' : seat.statusColor === 'special_case' ? 'حالة خاصة' : seat.statusColor === 'reserved' ? 'محجوز' : 'عادي'}
                </span>
              </div>
            </div>

            {isStudentHistoryLoading ? (
              <div className="text-xs text-[#6C6356]">جارٍ تحميل سجل الغياب والمخالفات...</div>
            ) : studentHistory ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="bg-white rounded-lg border border-[#E5DFD4] p-2.5">
                    <div className="text-[10px] text-[#6C6356]">أيام الغياب</div>
                    <div className="text-lg font-bold text-[#8A5A18]">{studentHistory.absenceDays.length}</div>
                  </div>
                  <div className="bg-white rounded-lg border border-[#E5DFD4] p-2.5">
                    <div className="text-[10px] text-[#6C6356]">سجلات الغياب</div>
                    <div className="text-lg font-bold text-[#8A5A18]">{studentHistory.absenceRecordCount}</div>
                  </div>
                  <div className="bg-white rounded-lg border border-[#E5DFD4] p-2.5 col-span-2 sm:col-span-1">
                    <div className="text-[10px] text-[#6C6356]">المخالفات</div>
                    <div className="text-lg font-bold text-[#A8443A]">{studentHistory.violations.length}</div>
                  </div>
                </div>

                {studentHistory.absences.length > 0 && (
                  <div className="bg-white rounded-lg border border-[#E5DFD4] overflow-hidden">
                    <div className="px-3 py-2 text-xs font-bold text-[#8A5A18] border-b border-[#E5DFD4]">تفاصيل الغياب حسب التاريخ والحصة</div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#F0EBE2]">
                      {studentHistory.absences.map((absence) => (
                        <div key={absence.id} className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono text-[#1F2926]">{absence.recordedDate}</span>
                          <span className="text-[#6C6356]">{absence.sessionPeriod}</span>
                          <span className={absence.status === 'late' ? 'text-amber-700 font-bold' : 'text-rose-700 font-bold'}>{absence.status === 'late' ? 'تأخر' : 'غياب'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Form to Select Predefined Violation */}
          <div className="bg-[#FAF4EB] border border-[#E8DCC8] rounded-xl p-4 shadow-2xs">
            <h4 className="text-sm font-bold text-[#8A481B] mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>تسجيل مخالفة جديدة من القائمة المعتمدة</span>
            </h4>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Select Predefined Violation */}
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="select-violation-type" className="block text-xs font-bold text-[#4F3F2F]">
                    نوع المخالفة المحددة مسبقاً داخل النظام *
                  </label>
                  {isLoadingTypes ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-[#5E6D66]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري تحميل قائمة المخالفات المعتمدة...</span>
                    </div>
                  ) : (
                    <select
                      id="select-violation-type"
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full bg-white border border-[#D5CDC0] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 cursor-pointer shadow-2xs"
                      required
                    >
                      {violationTypes.map((vt) => (
                        <option key={vt.id} value={vt.title}>
                          {vt.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-[#7A6B58] mt-0.5">
                    يتم اختيار المخالفة من القائمة المحددة مسبقاً بدقة لتفادي الكتابة اليدوية.
                  </p>
                </div>

                {/* Select Action Taken */}
                <div className="space-y-1">
                  <label htmlFor="select-action-taken" className="block text-xs font-bold text-[#4F3F2F]">
                    الإجراء المتخذ
                  </label>
                  <select
                    id="select-action-taken"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    className="w-full bg-white border border-[#D5CDC0] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 cursor-pointer shadow-2xs"
                  >
                    <option value="تنبيه شفهي">تنبيه شفهي</option>
                    <option value="تنبيه كتابي">تنبيه كتابي</option>
                    <option value="تسجيل في الدفتر">تسجيل في الدفتر</option>
                    <option value="إشعار ولي الأمر">إشعار ولي الأمر</option>
                    <option value="إحالة على الحراسة العامة">إحالة على الحراسة العامة</option>
                    <option value="إحالة على مجلس الانضباط">إحالة على مجلس الانضباط</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#7A6B58]">
                  تُسجل المخالفة فوراً باسم الأستاذ وتظهر في السجل الموحد للتلميذ.
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || isLoadingTypes}
                  className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري التسجيل...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>تسجيل المخالفة في السجل</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Instant Actions after recording violation */}
            {justRecordedViolation && (
              <div className="mt-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-emerald-900">
                      تم تسجيل المخالفة بنجاح: "{justRecordedViolation.violationType}"
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setJustRecordedViolation(null)}
                    className="text-emerald-700 hover:text-emerald-950 text-xs p-1"
                    title="إغلاق الإشعار"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => handlePrintSingle(justRecordedViolation)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة إشعار رسمي للمخالفة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleWhatsAppShare(justRecordedViolation)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>إرسال عبر واتساب (WhatsApp)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Student Violations History */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#5E6D66] uppercase tracking-wider flex items-center justify-between">
              <span>المخالفات المسجلة في ملف التلميذ ({violationsList.length})</span>
              <span className="text-[11px] text-gray-500 font-normal">
                التاريخ والوقت بالأرقام الفرنسية
              </span>
            </h4>

            {violationsList.length === 0 ? (
              <div className="text-center py-10 text-[#5E6D66] bg-white rounded-xl border border-dashed border-[#D5CDC0] space-y-1.5">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 mb-1" />
                <p className="text-xs font-bold text-emerald-800">لا توجد أي مخالفات مسجلة لهذا التلميذ حتى الآن.</p>
                <p className="text-[11px] text-[#7A6B58]">
                  سجل التلميذ سليم (سلوك وانضباط حسن داخل القسم).
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {violationsList.map((v, idx) => (
                  <div
                    key={v.id || idx}
                    className="bg-white rounded-xl p-3 sm:p-3.5 border border-red-100 hover:border-red-200 shadow-2xs transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-red-100 text-red-800 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-red-900 leading-snug">
                            {v.violationType || (v as any).text}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#5E6D66] mt-1 flex-wrap">
                            <span className="flex items-center gap-1 font-mono text-[11px] text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md font-semibold">
                              <Clock className="w-3 h-3 text-gray-500" />
                              <span>{v.recordedDate || (v as any).date}</span>
                              <span>—</span>
                              <span>{v.recordedTime || (v as any).time}</span>
                            </span>
                            {v.teacherName && (
                              <span className="text-[#1F2926]">
                                👤 <strong>{v.teacherName}</strong>
                              </span>
                            )}
                            {v.teacherSubject && (
                              <span className="text-[#1A4E47] bg-[#E8F2F0] px-1.5 py-0.5 rounded-md text-[11px]">
                                📚 {v.teacherSubject}
                              </span>
                            )}
                            {v.actionTaken && (
                              <span className="text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md text-[11px] font-semibold">
                                ⚖️ {v.actionTaken}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Print Single Violation Notice */}
                        <button
                          type="button"
                          onClick={() => handlePrintSingle({
                            violationType: v.violationType || (v as any).text,
                            actionTaken: v.actionTaken,
                            teacherName: v.teacherName,
                            teacherSubject: v.teacherSubject,
                            date: v.recordedDate || (v as any).date,
                            time: v.recordedTime || (v as any).time
                          })}
                          className="text-gray-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="طباعة إشعار رسمي لهذه المخالفة"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Send via WhatsApp */}
                        <button
                          type="button"
                          onClick={() => handleWhatsAppShare({
                            violationType: v.violationType || (v as any).text,
                            actionTaken: v.actionTaken,
                            teacherName: v.teacherName,
                            teacherSubject: v.teacherSubject,
                            date: v.recordedDate || (v as any).date,
                            time: v.recordedTime || (v as any).time
                          })}
                          className="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="إرسال إشعار المخالفة عبر واتساب"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        {/* Delete Violation */}
                        <button
                          type="button"
                          onClick={() => handleDelete(v.id)}
                          disabled={deletingId === v.id}
                          className="text-gray-400 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="حذف هذه المخالفة من السجل"
                        >
                          {deletingId === v.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#E5DFD5] bg-[#F5F0E6] flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-[#5E6D66] flex items-center gap-2">
            <span>مجموع المخالفات:</span>
            <strong className="text-red-800 font-bold font-mono">{violationsList.length}</strong>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* WhatsApp Share for Latest Violation */}
            <button
              type="button"
              onClick={() => {
                if (violationsList.length > 0) {
                  const target = violationsList[0];
                  handleWhatsAppShare({
                    violationType: target.violationType || (target as any).text,
                    actionTaken: target.actionTaken,
                    teacherName: target.teacherName,
                    teacherSubject: target.teacherSubject,
                    date: target.recordedDate || (target as any).date,
                    time: target.recordedTime || (target as any).time
                  });
                }
              }}
              disabled={violationsList.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="إرسال المخالفة الأخيرة عبر تطبيق واتساب لولي الأمر"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>إرسال عبر واتساب</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة بطاقة المخالفات الرسمية A4</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#EAE4D6] text-[#1F2926] border border-[#D5CDC0] text-xs font-bold transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
