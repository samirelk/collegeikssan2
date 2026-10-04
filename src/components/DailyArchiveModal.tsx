import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  UserX,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  ChevronRight,
  ChevronLeft,
  X,
  ShieldAlert,
  ShieldCheck,
  Building,
  UserCheck,
  Stethoscope,
  Info,
  FileSpreadsheet
} from 'lucide-react';
import { MassarAbsenceModal } from './MassarAbsenceModal';
import { StudentAttendanceCardModal } from './StudentAttendanceCardModal';
import {
  DailyAbsenceItem,
  DailyViolationItem,
  DailyArchiveStats,
  DailyArchiveResponse,
  SectionItem,
  User,
  AbsenceJustifiedStatus,
  ViolationCategory,
  DisciplinaryAction
} from '../types';
import { printDailyArchiveReport } from '../utils/printNotes';

interface DailyArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  sections: SectionItem[];
  embedded?: boolean; // When rendered inline in Director Dashboard
  institutionName?: string;
  academicYear?: string;
}

const VIOLATION_CATEGORIES: ViolationCategory[] = [
  'تشويش داخل القسم',
  'عدم إحضار اللوازم المدرسية',
  'عدم إنجاز الواجب المنزلي',
  'سوء سلوك وقلة انضباط',
  'استخدام الهاتف النقال',
  'تأخر متكرر عن الحصة',
  'هندام غير لائق',
  'إتلاف التجهيزات المدرسية',
  'مخالفة تربوية أخرى'
];

const DISCIPLINARY_ACTIONS: DisciplinaryAction[] = [
  'تنبيه شفهي',
  'إنذار كتابي',
  'إشعار لولي الأمر',
  'إحالة للحراسة العامة',
  'استدعاء ولي الأمر',
  'إحالة لمجلس الانضباط'
];

const SESSION_PERIODS = [
  'كامل اليوم',
  'الفترة الصباحية (08:30 - 12:30)',
  'الفترة المسائية (14:30 - 18:30)',
  'الحصة 1 (08:30 - 09:30)',
  'الحصة 2 (09:30 - 10:30)',
  'الحصة 3 (10:30 - 11:30)',
  'الحصة 4 (11:30 - 12:30)',
  'الحصة 5 (14:30 - 15:30)',
  'الحصة 6 (15:30 - 16:30)',
  'الحصة 7 (16:30 - 17:30)',
  'الحصة 8 (17:30 - 18:30)'
];

export const DailyArchiveModal: React.FC<DailyArchiveModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  sections,
  embedded = false,
  institutionName,
  academicYear
}) => {
  // Current selected date (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'absences' | 'violations' | 'summary' | 'risk'>('absences');

  // Archive Data
  const [absences, setAbsences] = useState<DailyAbsenceItem[]>([]);
  const [violations, setViolations] = useState<DailyViolationItem[]>([]);
  const [repeatedStudents, setRepeatedStudents] = useState<any[]>([]);
  const [monthlySectionsSummary, setMonthlySectionsSummary] = useState<any[]>([]);

  // Student Attendance Card Modal state
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<{
    studentName: string;
    sectionId: string;
    sectionName: string;
    studentNumber?: string;
    massarNumber?: string;
    seatNum?: number;
  } | null>(null);
  const [showStudentCardModal, setShowStudentCardModal] = useState(false);
  const [stats, setStats] = useState<DailyArchiveStats>({
    totalAbsences: 0,
    totalLates: 0,
    totalViolations: 0,
    justifiedCount: 0,
    unjustifiedCount: 0,
    sectionsAffected: 0,
    topSectionAbsences: '—'
  });
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Inner Filter
  const isTeacher = currentUser?.role === 'teacher';
  const [searchQuery, setSearchQuery] = useState('');
  const [absenceScope, setAbsenceScope] = useState<'current_active' | 'all_archive'>('current_active');
  const [absenceStatusFilter, setAbsenceStatusFilter] = useState<'all' | 'absent' | 'late' | 'justified' | 'unjustified'>('all');
  const [violationCategoryFilter, setViolationCategoryFilter] = useState<string>('all');

  // Add Absence Modal State
  const [isAddAbsenceOpen, setIsAddAbsenceOpen] = useState(false);
  const [newAbsenceSectionId, setNewAbsenceSectionId] = useState(sections[0]?.id || '');
  const [newAbsenceStudentName, setNewAbsenceStudentName] = useState('');
  const [newAbsenceStudentNumber, setNewAbsenceStudentNumber] = useState('');
  const [newAbsenceSeatNum, setNewAbsenceSeatNum] = useState<number>(1);
  const [newAbsenceStatus, setNewAbsenceStatus] = useState<'absent' | 'late'>('absent');
  const [newAbsencePeriod, setNewAbsencePeriod] = useState('كامل اليوم');
  const [newAbsenceJustified, setNewAbsenceJustified] = useState<AbsenceJustifiedStatus>('unjustified');
  const [newAbsenceReason, setNewAbsenceReason] = useState('');
  const [isSubmittingAbsence, setIsSubmittingAbsence] = useState(false);

  // Add Violation Modal State
  const [isAddViolationOpen, setIsAddViolationOpen] = useState(false);
  const [newViolSectionId, setNewViolSectionId] = useState(sections[0]?.id || '');
  const [newViolStudentName, setNewViolStudentName] = useState('');
  const [newViolStudentNumber, setNewViolStudentNumber] = useState('');
  const [newViolSeatNum, setNewViolSeatNum] = useState<number | ''>('');
  const [newViolType, setNewViolType] = useState<string>(VIOLATION_CATEGORIES[0]);
  const [newViolDesc, setNewViolDesc] = useState('');
  const [newViolAction, setNewViolAction] = useState<string>(DISCIPLINARY_ACTIONS[0]);
  const [newViolTime, setNewViolTime] = useState('09:00');
  const [isSubmittingViolation, setIsSubmittingViolation] = useState(false);

  // Edit Justification Modal
  const [editingAbsence, setEditingAbsence] = useState<DailyAbsenceItem | null>(null);
  const [editJustifiedStatus, setEditJustifiedStatus] = useState<AbsenceJustifiedStatus>('justified');
  const [editJustifiedReason, setEditJustifiedReason] = useState('');
  const [isSubmittingEditJustification, setIsSubmittingEditJustification] = useState(false);

  // Print Mode
  const [isPrintPreview, setIsPrintPreview] = useState(false);

  // Massar Export & Import Modal
  const [showMassarModal, setShowMassarModal] = useState(false);

  const visibleSections = useMemo(() => {
    if (currentUser?.role !== 'teacher') return sections;
    return sections.filter((section) =>
      section.assignedTeacherId === currentUser.id ||
      section.assignedTeachers?.some((teacher) => teacher.teacherId === currentUser.id)
    );
  }, [currentUser, sections]);

  useEffect(() => {
    if (visibleSections.length > 0) {
      setNewAbsenceSectionId((current) => visibleSections.some((section) => section.id === current) ? current : visibleSections[0].id);
      setNewViolSectionId((current) => visibleSections.some((section) => section.id === current) ? current : visibleSections[0].id);
    }
  }, [visibleSections]);

  // Fetch Archive Data from Server
  const fetchArchiveData = async (date: string, secId: string = selectedSectionFilter) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const teacherScope = currentUser?.role === 'teacher' ? `&teacherId=${encodeURIComponent(currentUser.id)}` : '';
      const url = `/api/daily-archive?date=${encodeURIComponent(date)}${secId !== 'all' ? `&sectionId=${encodeURIComponent(secId)}` : ''}${teacherScope}`;
      const res = await fetch(url);
      const json: DailyArchiveResponse = await res.json();
      if (json.success) {
        setAbsences(json.absences || []);
        setViolations(json.violations || []);
        setStats(json.stats || {
          totalAbsences: 0,
          totalLates: 0,
          totalViolations: 0,
          justifiedCount: 0,
          unjustifiedCount: 0,
          sectionsAffected: 0
        });
        if (json.availableDates) {
          setAvailableDates(json.availableDates);
        }

        // Fetch early warning repeated absences list
        try {
          const repRes = await fetch('/api/attendance/repeated-absences?threshold=3');
          const repJson = await repRes.json();
          if (repJson.success && Array.isArray(repJson.students)) {
            setRepeatedStudents(repJson.students);
          }
        } catch {}

        // Fetch monthly sections summary
        try {
          const monthParam = date ? date.slice(0, 7) : new Date().toISOString().slice(0, 7);
          const monRes = await fetch(`/api/attendance/monthly-summary?month=${monthParam}`);
          const monJson = await monRes.json();
          if (monJson.success && Array.isArray(monJson.summary)) {
            setMonthlySectionsSummary(monJson.summary);
          }
        } catch {}
      } else {
        setErrorMsg('فشل في تحميل بيانات الأرشيف اليومي');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || embedded) {
      fetchArchiveData(selectedDate, selectedSectionFilter);
    }
  }, [isOpen, embedded, selectedDate, selectedSectionFilter]);

  // Date shifting helpers
  const handleShiftDate = (days: number) => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + days);
      setSelectedDate(d.toISOString().slice(0, 10));
    } catch {
      setSelectedDate(todayStr);
    }
  };

  // Formatted date string in Arabic
  const formattedArabicDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat('ar-MA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(dateObj);
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Auto-fill student info when section & seat changes in Add Absence
  const currentSectionSeats = useMemo(() => {
    const sec = visibleSections.find(s => s.id === newAbsenceSectionId);
    return sec?.seats || [];
  }, [visibleSections, newAbsenceSectionId]);

  const handleSeatChangeForAbsence = (seatNum: number) => {
    setNewAbsenceSeatNum(seatNum);
    const foundSeat = currentSectionSeats.find(s => (s.seat ?? s.seatNum) === seatNum);
    if (foundSeat && (foundSeat.name || foundSeat.studentName)) {
      setNewAbsenceStudentName(foundSeat.name || foundSeat.studentName || '');
      setNewAbsenceStudentNumber(foundSeat.number || foundSeat.studentNumber || '');
    }
  };

  // Handle Add Absence Submit
  const handleCreateAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAbsenceSectionId || !newAbsenceStudentName.trim()) {
      alert('يرجى تحديد القسم واسم التلميذ');
      return;
    }

    setIsSubmittingAbsence(true);
    try {
      const res = await fetch('/api/daily-archive/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: newAbsenceSectionId,
          seatNum: newAbsenceSeatNum,
          studentName: newAbsenceStudentName.trim(),
          studentNumber: newAbsenceStudentNumber.trim(),
          status: newAbsenceStatus,
          recordedDate: selectedDate,
          sessionPeriod: newAbsencePeriod,
          justified: newAbsenceJustified,
          justificationReason: newAbsenceReason.trim(),
          teacherName: currentUser?.fullName || '',
          teacherSubject: currentUser?.subject || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('تم تسجيل الغياب بنجاح في الأرشيف اليومي');
        setIsAddAbsenceOpen(false);
        setNewAbsenceStudentName('');
        setNewAbsenceStudentNumber('');
        setNewAbsenceReason('');
        fetchArchiveData(selectedDate);
      } else {
        alert(data.error || 'تعذر تسجيل الغياب');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في الاتصال');
    } finally {
      setIsSubmittingAbsence(false);
    }
  };

  // Handle Add Violation Submit
  const handleCreateViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViolSectionId || !newViolStudentName.trim() || !newViolDesc.trim()) {
      alert('يرجى إدخال اسم التلميذ ووصف المخالفة');
      return;
    }

    setIsSubmittingViolation(true);
    try {
      const res = await fetch('/api/daily-archive/violations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {})
        },
        body: JSON.stringify({
          sectionId: newViolSectionId,
          seatNum: newViolSeatNum ? Number(newViolSeatNum) : undefined,
          studentName: newViolStudentName.trim(),
          studentNumber: newViolStudentNumber.trim(),
          violationType: newViolType,
          description: newViolDesc.trim(),
          actionTaken: newViolAction,
          teacherName: currentUser?.fullName || '',
          teacherSubject: currentUser?.subject || '',
          recordedDate: selectedDate,
          recordedTime: newViolTime || '09:00'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('تم تسجيل المخالفة بنجاح في الأرشيف اليومي');
        setIsAddViolationOpen(false);
        setNewViolStudentName('');
        setNewViolStudentNumber('');
        setNewViolDesc('');
        fetchArchiveData(selectedDate);
      } else {
        alert(data.error || 'تعذر تسجيل المخالفة');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في الاتصال');
    } finally {
      setIsSubmittingViolation(false);
    }
  };

  // Handle Update Justification
  const handleUpdateJustification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAbsence) return;

    setIsSubmittingEditJustification(true);
    try {
      const res = await fetch(`/api/daily-archive/absences/${editingAbsence.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          justified: editJustifiedStatus,
          justificationReason: editJustifiedReason.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('تم تحديث وضعية تبرير الغياب بنجاح');
        setEditingAbsence(null);
        fetchArchiveData(selectedDate);
      } else {
        alert(data.error || 'تعذر التحديث');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ أثناء التحديث');
    } finally {
      setIsSubmittingEditJustification(false);
    }
  };

  // Handle Delete Absence
  const handleDeleteAbsence = async (id: number, name: string) => {
    try {
      const res = await fetch(`/api/daily-archive/absences/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`تم حذف سجل غياب (${name}) بنجاح`);
        fetchArchiveData(selectedDate);
      } else {
        alert(data.error || 'تعذر الحذف');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في الاتصال');
    }
  };

  // Handle Delete Violation
  const handleDeleteViolation = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/daily-archive/violations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`تم حذف سجل مخالفة (${name}) بنجاح`);
        fetchArchiveData(selectedDate);
      } else {
        alert(data.error || 'تعذر الحذف');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في الاتصال');
    }
  };

  // Handle Resolve Active Absence (إنهاء حالة الغياب الحالي وتوثيقها في الأرشيف)
  const handleResolveAbsence = async (id: number, name: string) => {
    try {
      const res = await fetch(`/api/daily-archive/absences/${id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'director'
        },
        body: JSON.stringify({
          actorId: currentUser?.id || '',
          actorRole: currentUser?.role || 'director',
          actorName: currentUser?.fullName || '',
          actorSubject: currentUser?.subject || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`تم رفع الغياب الحالي للتلميذ (${name}) وتوثيقه في الأرشيف كغياب مسوّى`);
        fetchArchiveData(selectedDate);
      } else {
        alert(data.error || 'تعذر رفع الغياب');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في الاتصال');
    }
  };

  // Filtered Absences
  const filteredAbsences = useMemo(() => {
    return absences.filter(item => {
      // Scope filter: current active vs full archive
      if (absenceScope === 'current_active' && item.removedAt) {
        return false;
      }

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.studentName.toLowerCase().includes(q);
        const matchesNum = (item.studentNumber || '').toLowerCase().includes(q);
        const matchesSection = `${item.sectionLevel || ''} ${item.sectionClass || ''}`.toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesSection) return false;
      }

      // Status filter
      if (absenceStatusFilter === 'absent' && item.status !== 'absent') return false;
      if (absenceStatusFilter === 'late' && item.status !== 'late') return false;
      if (absenceStatusFilter === 'justified' && (!item.justified || item.justified === 'unjustified')) return false;
      if (absenceStatusFilter === 'unjustified' && item.justified && item.justified !== 'unjustified') return false;

      return true;
    });
  }, [absences, searchQuery, absenceStatusFilter, absenceScope]);

  const activeAbsencesCount = useMemo(() => absences.filter(a => !a.removedAt).length, [absences]);
  const resolvedAbsencesCount = useMemo(() => absences.filter(a => !!a.removedAt).length, [absences]);

  // Filtered Violations
  const filteredViolations = useMemo(() => {
    return violations.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.studentName.toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        const matchesTeacher = (item.teacherName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTeacher) return false;
      }

      if (violationCategoryFilter !== 'all' && item.violationType !== violationCategoryFilter) {
        return false;
      }

      return true;
    });
  }, [violations, searchQuery, violationCategoryFilter]);

  // Dedicated Print Function using Isolated Iframe
  const handlePrintDailyArchive = () => {
    const secObj = visibleSections.find(s => s.id === selectedSectionFilter);
    const secName = secObj ? `${secObj.level} - فوج ${secObj.classNumber}` : 'كافة الأقسام والمستويات';

    const printed = printDailyArchiveReport({
      institution: institutionName || 'الثانوية الإعدادية ايكسان',
      academicYear: academicYear || currentUser?.academicYear || '2026/2027',
      dateStr: selectedDate,
      formattedArabicDate: formattedArabicDate,
      sectionFilterName: secName,
      absences: filteredAbsences,
      violations: filteredViolations,
      stats: stats
    });

    if (!printed) {
      window.print();
    }
  };

  // If modal is not open and not embedded, don't render
  if (!isOpen && !embedded) return null;

  const content = (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Date Details */}
          <div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                isTeacher ? 'bg-rose-500/10 text-rose-700' : 'bg-amber-500/10 text-amber-700'
              }`}>
                {isTeacher ? <UserX className="w-5 h-5 text-rose-600" /> : <Calendar className="w-5 h-5 text-amber-600" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <span>{isTeacher ? 'الغيابات الحالية (قيد الغياب الآن)' : 'أرشيف الغيابات والمخالفات اليومي'}</span>
                  {selectedDate === todayStr && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isTeacher ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isTeacher ? 'اليوم' : 'اليوم'}
                    </span>
                  )}
                </h2>
                <p className="text-sm font-medium text-slate-500 mt-0.5">
                  {isTeacher ? 'مراقبة فورية للمتغيبين حالياً في حصصك وأقسامك الدراسية' : formattedArabicDate}
                </p>
              </div>
            </div>
          </div>

          {/* Date Picker & Navigation Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              title="اليوم السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-amber-500 outline-hidden bg-slate-50"
              />
            </div>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              title="اليوم التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {selectedDate !== todayStr && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                العودة لليوم
              </button>
            )}

            {/* Quick Available Dates Dropdown */}
            {availableDates.length > 0 && (
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 outline-hidden"
              >
                <option value={selectedDate}>تصفح سجلات الأيام...</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>
                    {d === todayStr ? `اليوم (${d})` : d}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => fetchArchiveData(selectedDate)}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
            </button>

            <button
              onClick={handlePrintDailyArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-slate-800 text-white hover:bg-slate-900 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السجل</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar: Section Selector */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">تصفية حسب القسم:</span>
            <select
              value={selectedSectionFilter}
              onChange={e => setSelectedSectionFilter(e.target.value)}
              className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">جميع الأقسام ({visibleSections.length} قسم)</option>
              {visibleSections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.level} - فوج {sec.classNumber} ({sec.assignedTeacherName || 'بدون أستاذ'})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowMassarModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white shadow-xs transition-all cursor-pointer"
              title="تصدير واستيراد الغيابات وفق منظومة مسار (Massar Excel / CSV)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
              <span>منظومة مسار (استيراد / تصدير)</span>
            </button>

            <button
              onClick={() => setIsAddAbsenceOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل غياب / تأخر</span>
            </button>

            <button
              onClick={() => setIsAddViolationOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل مخالفة / ملاحظة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Daily Key Indicators (بطاقات المؤشرات الإحصائية لليوم) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Absences */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي الغيابات</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">{stats.totalAbsences}</span>
            <span className="text-xs text-slate-500">تلميذ</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span className="text-emerald-600 font-medium">{stats.justifiedCount} مبرر</span>
            <span>•</span>
            <span className="text-rose-600 font-medium">{stats.unjustifiedCount} غير مبرر</span>
          </div>
        </div>

        {/* Total Lates */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">حالات التأخر</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{stats.totalLates}</span>
            <span className="text-xs text-slate-500">حالة</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">تأخر عن موعد الحصة</p>
        </div>

        {/* Total Violations */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">المخالفات والملاحظات</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600">{stats.totalViolations}</span>
            <span className="text-xs text-slate-500">مخالفة</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">مسجلة بالسجل السلوكي</p>
        </div>

        {/* Affected Sections */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">الأقسام المتأثرة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600">{stats.sectionsAffected}</span>
            <span className="text-xs text-slate-500">أقسام</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate" title={stats.topSectionAbsences}>
            الأكثر غياباً: {stats.topSectionAbsences || 'لا يوجد'}
          </p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('absences')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'absences'
                ? 'bg-white text-rose-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <UserX className="w-4 h-4 text-rose-600" />
            <span>{isTeacher ? 'الغيابات الحالية' : 'سجل الغيابات والتأخرات اليومية'}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'absences' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {isTeacher ? activeAbsencesCount : absences.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('violations')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'violations'
                ? 'bg-white text-purple-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-purple-600" />
            <span>سجل المخالفات والملاحظات السلوكية</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'violations' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {violations.length}
            </span>
          </button>

          {!isTeacher && (
            <button
              onClick={() => setActiveTab('summary')}
              className={`py-2.5 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'summary'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>التقرير الإداري</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('risk')}
            className={`py-2.5 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'risk'
                ? 'bg-white text-rose-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>تنبيه الغياب المتكرر</span>
            {repeatedStudents.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                {repeatedStudents.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Absences & Lates Table */}
        {activeTab === 'absences' && (
          <div className="p-5 space-y-4">
            {/* Absence Scope Selector: الغياب الحالي للأستاذ vs الأرشيف الشامل للمدير */}
            {isTeacher ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                  <span className="text-sm font-bold text-rose-900">مراقبة حية: قائمة التلاميذ الغائبين حالياً في حصصك وأقسامك الدراسية</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-rose-700 bg-white px-2.5 py-1 rounded-xl border border-rose-200 font-medium">
                    يتم عرض المتغيبين حالياً فقط (تُخفى الغيابات التي تمت تسويتها)
                  </span>
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-600 text-white shadow-xs">
                    {activeAbsencesCount} تلميذاً غائباً
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 bg-slate-100/90 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAbsenceScope('current_active')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      absenceScope === 'current_active'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-300 animate-pulse"></span>
                    <span>الغياب الحالي (قيد الغياب الآن)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      absenceScope === 'current_active' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {activeAbsencesCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbsenceScope('all_archive')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      absenceScope === 'all_archive'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <span>أرشيف كافة الغيابات (المستمر والمنتهي)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      absenceScope === 'all_archive' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {absences.length}
                    </span>
                  </button>
                </div>

                {absenceScope === 'current_active' ? (
                  <div className="text-xs text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                    <span>مراقبة حية: التلاميذ الذين لم تتم إزالة غيابهم بعد ({activeAbsencesCount} تلميذاً)</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-medium">
                    سجل أرشيفي موثق يشمل جميع الغيابات ({resolvedAbsencesCount} تمت تسويتها وإزالتها)
                  </div>
                )}
              </div>
            )}

            {/* Search & Status Filter */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم، الرقم الترتيبي، أو القسم..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-hidden bg-slate-50"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                <span className="text-xs text-slate-500 font-medium ml-1">الحالة:</span>
                {(['all', 'absent', 'late', 'justified', 'unjustified'] as const).map(st => {
                  const labels = {
                    all: 'الكل',
                    absent: 'غياب فقط',
                    late: 'تأخر فقط',
                    justified: 'مبرر',
                    unjustified: 'غير مبرر'
                  };
                  return (
                    <button
                      key={st}
                      onClick={() => setAbsenceStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        absenceStatusFilter === st
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {labels[st]}
                    </button>
                  );
                })}

                {!isTeacher && (
                  <button
                    type="button"
                    onClick={() => setShowMassarModal(true)}
                    className="mr-2 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title="استيراد وتصدير الغيابات وفق منظومة مسار (Excel / CSV)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
                    <span>تصدير / استيراد مسار</span>
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            {filteredAbsences.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <UserCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-base font-bold text-slate-700">لا توجد غيابات أو تأخرات مسجلة في هذا اليوم</p>
                <p className="text-xs text-slate-400 mt-1">
                  نسبة حضور ممتازة، أو يمكنك الضغط على "تسجيل غياب / تأخر" لإضافة سجل جديد
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">التلميذ(ة)</th>
                      <th className="py-3 px-3">القسم والمستوى</th>
                      <th className="py-3 px-3">المقعد</th>
                      <th className="py-3 px-3">الوضعية</th>
                      <th className="py-3 px-3">حالة السجل</th>
                      <th className="py-3 px-3">الحصة / الفترة</th>
                      <th className="py-3 px-3">الأستاذ(ة) / المادة</th>
                      <th className="py-3 px-3">وضعية التبرير</th>
                      <th className="py-3 px-3">ملاحظات وسبب التبرير</th>
                      <th className="py-3 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredAbsences.map((ab, idx) => (
                      <tr key={ab.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {ab.studentName}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {ab.massarNumber && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200" title="رقم مسار">
                                {ab.massarNumber}
                              </span>
                            )}
                            {ab.studentNumber && (
                              <span className="text-[11px] font-normal text-slate-400">
                                رقم: {ab.studentNumber}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-medium">
                            {ab.sectionLevel} (فوج {ab.sectionClass})
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {ab.seatNum ? `مقعد #${ab.seatNum}` : '—'}
                        </td>
                        <td className="py-3 px-3">
                          {ab.status === 'absent' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              غياب
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3 text-amber-600" />
                              تأخر
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {!ab.removedAt ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                              قيد الغياب الآن
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                تمت تسويته / أزيل
                              </span>
                              <div className="text-[10px] text-slate-500 font-normal">
                                {ab.removerName ? `بواسطة: ${ab.removerName}` : 'بواسطة الإدارة'}
                              </div>
                              {ab.durationLabel && (
                                <div className="text-[10px] text-slate-400 font-normal">
                                  المدة: {ab.durationLabel}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {ab.sessionPeriod || 'كامل اليوم'}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {ab.teacherName ? (
                            <div>
                              <span>{ab.teacherName}</span>
                              {ab.teacherSubject && (
                                <span className="block text-[11px] text-slate-400 font-normal">
                                  ({ab.teacherSubject})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => {
                              setEditingAbsence(ab);
                              setEditJustifiedStatus(ab.justified || 'justified');
                              setEditJustifiedReason(ab.justificationReason || '');
                            }}
                            className="group flex items-center gap-1.5 text-xs text-right cursor-pointer"
                            title="انقر لتعديل وضعية التبرير"
                          >
                            {ab.justified === 'justified' && (
                              <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200">
                                مبرر ✓
                              </span>
                            )}
                            {ab.justified === 'medical' && (
                              <span className="px-2 py-0.5 rounded-md font-semibold bg-blue-100 text-blue-800 group-hover:bg-blue-200 flex items-center gap-1">
                                <Stethoscope className="w-3 h-3" />
                                شهادة طبية
                              </span>
                            )}
                            {ab.justified === 'permission' && (
                              <span className="px-2 py-0.5 rounded-md font-semibold bg-purple-100 text-purple-800 group-hover:bg-purple-200">
                                إذن مسبق
                              </span>
                            )}
                            {(!ab.justified || ab.justified === 'unjustified') && (
                              <span className="px-2 py-0.5 rounded-md font-semibold bg-rose-50 text-rose-700 border border-rose-200 group-hover:bg-rose-100">
                                غير مبرر ✕
                              </span>
                            )}
                            <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                          {ab.justificationReason || ab.notes || '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentForCard({
                                  studentName: ab.studentName,
                                  studentNumber: ab.studentNumber,
                                  massarNumber: ab.massarNumber,
                                  sectionId: ab.sectionId,
                                  sectionName: `${ab.sectionLevel} - فوج ${ab.sectionClass}`,
                                  seatNum: ab.seatNum
                                });
                                setShowStudentCardModal(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold inline-flex items-center gap-1 transition-colors border border-blue-200 cursor-pointer shadow-2xs"
                              title="فتح بطاقة المواظبة الفردية واستخراج إشعار ولي الأمر"
                            >
                              <FileText className="w-3 h-3 text-blue-600" />
                              <span>كشف / إشعار</span>
                            </button>
                            {!ab.removedAt && (
                              <button
                                type="button"
                                onClick={() => handleResolveAbsence(ab.id, ab.studentName)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                                title="إنهاء الغياب الحالي وتوثيقه في الأرشيف (ورقة دخول التلميذ)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>رفع الغياب</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteAbsence(ab.id, ab.studentName)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="حذف هذا السجل نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Violations Table */}
        {activeTab === 'violations' && (
          <div className="p-5 space-y-4">
            {/* Search & Category Filter */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو وصف المخالفة..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden bg-slate-50"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs text-slate-500 font-medium">نوع المخالفة:</span>
                <select
                  value={violationCategoryFilter}
                  onChange={e => setViolationCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white"
                >
                  <option value="all">جميع أنواع المخالفات</option>
                  {VIOLATION_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Violations Table */}
            {filteredViolations.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-base font-bold text-slate-700">لا توجد مخالفات مسجلة في هذا اليوم</p>
                <p className="text-xs text-slate-400 mt-1">
                  أجواء دراسية منضبطة، أو اضغط على "تسجيل مخالفة / ملاحظة" لإدراج مخالفة جديدة
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">التلميذ(ة)</th>
                      <th className="py-3 px-3">القسم</th>
                      <th className="py-3 px-3">المقعد</th>
                      <th className="py-3 px-3">نوع المخالفة</th>
                      <th className="py-3 px-3">الوصف والتفاصيل</th>
                      <th className="py-3 px-3">الإجراء المتخذ</th>
                      <th className="py-3 px-3">الأستاذ(ة)</th>
                      <th className="py-3 px-3">الوقت</th>
                      <th className="py-3 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredViolations.map((v, idx) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {v.studentName}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {v.massarNumber && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200" title="رقم مسار">
                                {v.massarNumber}
                              </span>
                            )}
                            {v.studentNumber && (
                              <span className="text-[11px] font-normal text-slate-400">
                                رقم: {v.studentNumber}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-medium">
                            {v.sectionLevel} (فوج {v.sectionClass})
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {v.seatNum ? `مقعد #${v.seatNum}` : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-800">
                            {v.violationType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 max-w-sm">
                          {v.description}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
                            {v.actionTaken || 'تنبيه شفهي'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {v.teacherName || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {v.recordedTime}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleDeleteViolation(v.id, v.studentName)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="حذف هذه المخالفة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Summary & Printable Administrative Report */}
        {activeTab === 'summary' && (
          <div className="p-6 space-y-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>ملخص التقرير الإداري اليومي للمؤسسة</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                يقدم هذا التقرير تحليلاً شاملاً لنسب المواظبة والانضباط المدرسي ليوم <strong>{formattedArabicDate}</strong> بالثانوية الإعدادية ايكسان.
                يمكن للحراسة العامة والإدارة التربوية طباعة هذا التقرير كوثيقة رسمية للإرشيف أو التفتيش الإداري.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-bold text-slate-800 text-sm mb-3">مؤشرات المواظبة العامة:</h4>
                <ul className="space-y-2 text-xs text-slate-700">
                  <li className="flex justify-between py-1 border-b border-slate-100">
                    <span>إجمالي حالات الغياب:</span>
                    <strong className="text-rose-600">{stats.totalAbsences} تلميذ</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-slate-100">
                    <span>إجمالي حالات التأخر:</span>
                    <strong className="text-amber-600">{stats.totalLates} حالة</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-slate-100">
                    <span>الغيابات المبررة:</span>
                    <strong className="text-emerald-600">{stats.justifiedCount} حالة</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-slate-100">
                    <span>الغيابات غير المبررة:</span>
                    <strong className="text-rose-700">{stats.unjustifiedCount} حالة</strong>
                  </li>
                  <li className="flex justify-between py-1">
                    <span>أعلى قسم تسجيلاً للغياب اليوم:</span>
                    <strong className="text-slate-900">{stats.topSectionAbsences}</strong>
                  </li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-bold text-slate-800 text-sm mb-3">مؤشرات السلوك والانضباط:</h4>
                <ul className="space-y-2 text-xs text-slate-700">
                  <li className="flex justify-between py-1 border-b border-slate-100">
                    <span>إجمالي المخالفات المسجلة:</span>
                    <strong className="text-purple-600">{stats.totalViolations} مخالفة</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-slate-100">
                    <span>عدد الأقسام المعنية بالمخالفات:</span>
                    <strong className="text-blue-600">{stats.sectionsAffected} قسم</strong>
                  </li>
                  <li className="flex justify-between py-1">
                    <span>حالة الأجواء العامة:</span>
                    <span className="font-bold text-emerald-600">
                      {stats.totalViolations === 0 ? 'انضباط تام وهدوء ممتاز' : 'متابعة تربوية جارية مع الحراسة العامة'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={handlePrintDailyArchive}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-black transition-colors shadow-sm flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة ورقة المراقبة اليومية الرسمية</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Early Warning - Repeated Absences */}
        {activeTab === 'risk' && (
          <div className="p-5 space-y-4">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-900">
                  نظام التنبيه المبكر: التلاميذ في دائرة خطر الغياب المتكرر (3 حصص فأكثر)
                </h3>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  ترصد هذه اللوحة تلقائياً كافة التلاميذ الذين راكموا 3 حصص غياب أو أكثر على صعيد المؤسسة، لتنبيه الإدارة والحراسة العامة وتوجيه استدعاءات وإشعارات عاجلة لأولياء الأمور قبل بلوغ عتبة الانقطاع.
                </p>
              </div>
            </div>

            {repeatedStudents.length === 0 ? (
              <div className="py-16 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                <UserCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-base font-bold text-slate-800">لا يوجد أي تلميذ في دائرة الخطر حالياً</p>
                <p className="text-xs text-slate-500 mt-1">
                  كافة التلاميذ لديهم معدل غيابات سليم وأقل من العتبة التحذيرية (أقل من 3 غيابات).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">اسم التلميذ(ة)</th>
                      <th className="p-3">القسم</th>
                      <th className="p-3 text-center">مستوى الخطورة</th>
                      <th className="p-3 text-center">مجموع الغيابات</th>
                      <th className="p-3 text-center">غير مبرر</th>
                      <th className="p-3 text-center">مبرر</th>
                      <th className="p-3">آخر تاريخ غياب</th>
                      <th className="p-3 text-center">إجراءات المتابعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {repeatedStudents.map((st, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-bold">{i + 1}</td>
                        <td className="p-3 font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentForCard({
                                studentName: st.studentName,
                                studentNumber: st.studentNumber,
                                sectionId: st.sectionId,
                                sectionName: st.sectionName
                              });
                              setShowStudentCardModal(true);
                            }}
                            className="hover:text-emerald-700 hover:underline cursor-pointer text-right flex items-center gap-1.5"
                          >
                            <span>{st.studentName}</span>
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </td>
                        <td className="p-3 text-slate-700">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                            {st.sectionName}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {st.riskLevel === 'critical' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              حرج (5+ غيابات)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              إنذار (3-4 غيابات)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-rose-700 text-sm">
                          {st.absencesCount} حصة
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-rose-900">
                          {st.unjustifiedCount}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-700">
                          {st.justifiedCount}
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {st.lastAbsenceDate || '—'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentForCard({
                                studentName: st.studentName,
                                studentNumber: st.studentNumber,
                                sectionId: st.sectionId,
                                sectionName: st.sectionName
                              });
                              setShowStudentCardModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#1A4E47] hover:bg-[#133E38] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>كشف المواظبة وإشعار ولي الأمر</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: Add New Daily Absence Form */}
      {isAddAbsenceOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-600 shrink-0" />
                <span>تسجيل غياب أو تأخر في الأرشيف اليومي</span>
              </h3>
              <button
                onClick={() => setIsAddAbsenceOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAbsence} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">القسم:</label>
                <select
                  value={newAbsenceSectionId}
                  onChange={e => {
                    setNewAbsenceSectionId(e.target.value);
                    const sec = visibleSections.find(s => s.id === e.target.value);
                    if (sec && sec.seats && sec.seats[0]) {
                      handleSeatChangeForAbsence(sec.seats[0].seat ?? sec.seats[0].seatNum ?? 1);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  required
                >
                  {visibleSections.map(sec => (
                    <option key={sec.id} value={sec.id}>
                      {sec.level} - فوج {sec.classNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المقعد (اختياري):</label>
                  <select
                    value={newAbsenceSeatNum}
                    onChange={e => handleSeatChangeForAbsence(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {currentSectionSeats.map(s => {
                      const num = s.seat ?? s.seatNum ?? 1;
                      const displayName = s.name || s.studentName;
                      return (
                        <option key={num} value={num}>
                          مقعد #{num} {displayName ? `- ${displayName}` : '(شاغر)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع التسجيل:</label>
                  <select
                    value={newAbsenceStatus}
                    onChange={e => setNewAbsenceStatus(e.target.value as 'absent' | 'late')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="absent">غياب (غياب عن الحصة)</option>
                    <option value="late">تأخر (حضور بعد الموعد)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم التلميذ(ة):</label>
                  <input
                    type="text"
                    value={newAbsenceStudentName}
                    onChange={e => setNewAbsenceStudentName(e.target.value)}
                    placeholder="الاسم الكامل للتلميذ"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الرقم الترتيبي (اختياري):</label>
                  <input
                    type="text"
                    value={newAbsenceStudentNumber}
                    onChange={e => setNewAbsenceStudentNumber(e.target.value)}
                    placeholder="مثلاً: 12"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الفترة / الحصة:</label>
                <select
                  value={newAbsencePeriod}
                  onChange={e => setNewAbsencePeriod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {SESSION_PERIODS.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">وضعية التبرير:</label>
                  <select
                    value={newAbsenceJustified}
                    onChange={e => setNewAbsenceJustified(e.target.value as AbsenceJustifiedStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="unjustified">غير مبرر</option>
                    <option value="justified">مبرر</option>
                    <option value="medical">شهادة طبية</option>
                    <option value="permission">رخصة / إذن مسبق</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">سبب أو ملاحظة التبرير:</label>
                  <input
                    type="text"
                    value={newAbsenceReason}
                    onChange={e => setNewAbsenceReason(e.target.value)}
                    placeholder="سبب الغياب أو رقم الشهادة الطبية"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddAbsenceOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAbsence}
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {isSubmittingAbsence ? 'جاري الحفظ...' : 'حفظ وتسجيل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add New Daily Violation Form */}
      {isAddViolationOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>تسجيل مخالفة أو ملاحظة سلوكية</span>
              </h3>
              <button
                onClick={() => setIsAddViolationOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateViolation} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">القسم:</label>
                <select
                  value={newViolSectionId}
                  onChange={e => setNewViolSectionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  required
                >
                  {visibleSections.map(sec => (
                    <option key={sec.id} value={sec.id}>
                      {sec.level} - فوج {sec.classNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم التلميذ(ة):</label>
                  <input
                    type="text"
                    value={newViolStudentName}
                    onChange={e => setNewViolStudentName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم المقعد (اختياري):</label>
                  <input
                    type="number"
                    value={newViolSeatNum}
                    onChange={e => setNewViolSeatNum(e.target.value ? Number(e.target.value) : '')}
                    placeholder="رقم المقعد"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع المخالفة:</label>
                  <select
                    value={newViolType}
                    onChange={e => setNewViolType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    {VIOLATION_CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">وقت الحدوث:</label>
                  <input
                    type="time"
                    value={newViolTime}
                    onChange={e => setNewViolTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف المخالفة أو الملاحظة:</label>
                <textarea
                  rows={3}
                  value={newViolDesc}
                  onChange={e => setNewViolDesc(e.target.value)}
                  placeholder="اكتب وصفاً دقيقاً لما حدث داخل القسم أو الساحة..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الإجراء المتخذ:</label>
                <select
                  value={newViolAction}
                  onChange={e => setNewViolAction(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {DISCIPLINARY_ACTIONS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddViolationOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingViolation}
                  className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {isSubmittingViolation ? 'جاري الحفظ...' : 'تسجيل المخالفة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Quick Edit Justification Status */}
      {editingAbsence && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[95vh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-bold text-slate-800">
                تحديث وضعية التبرير للتلميذ(ة): {editingAbsence.studentName}
              </h3>
              <button
                onClick={() => setEditingAbsence(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateJustification} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الوضعية:</label>
                <select
                  value={editJustifiedStatus}
                  onChange={e => setEditJustifiedStatus(e.target.value as AbsenceJustifiedStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                >
                  <option value="justified">مبرر</option>
                  <option value="medical">شهادة طبية رسمية</option>
                  <option value="permission">رخصة / إذن مسبق من الإدارة</option>
                  <option value="unjustified">غير مبرر</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تفاصيل أو ملاحظات التبرير:</label>
                <input
                  type="text"
                  value={editJustifiedReason}
                  onChange={e => setEditJustifiedReason(e.target.value)}
                  placeholder="مثلاً: أحضر شهادة طبية من المركز الصحي رقم 42"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAbsence(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditJustification}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-black transition-colors"
                >
                  {isSubmittingEditJustification ? 'جاري الحفظ...' : 'حفظ الوضعية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Massar Absences Import & Export Modal */}
      <MassarAbsenceModal
        isOpen={showMassarModal}
        onClose={() => setShowMassarModal(false)}
        absences={absences}
        sections={sections}
        selectedDate={selectedDate}
        onImportSuccess={() => {
          fetchArchiveData(selectedDate);
        }}
        onToast={(msg) => {
          setSuccessMsg(msg);
          setTimeout(() => setSuccessMsg(null), 5000);
        }}
      />

      {/* PRINT-ONLY OFFICIAL SURVEILLANCE SHEET (تظهر فقط عند الطباعة عبر CSS) */}
      <div className="hidden print:block font-serif text-black p-6 space-y-4 text-xs">
        <table className="w-full border-collapse border-b-2 border-[#854d0e] pb-3 mb-3">
          <tbody>
            <tr>
              <td className="w-[40%] text-right text-xs leading-relaxed text-black">
                المملكة المغربية<br />
                وزارة التربية الوطنية والتعليم الأولي والرياضة<br />
                <b className="text-sm text-[#854d0e]">{institutionName || 'الثانوية الإعدادية ايكسان'}</b>
              </td>
              <td className="w-[20%] text-center">
                <div className="text-2xl text-[#854d0e]">🏛️</div>
              </td>
              <td className="w-[40%] text-left text-xs leading-relaxed text-black">
                الموسم الدراسي: <b>{academicYear || currentUser?.academicYear || '2026/2027'}</b><br />
                تاريخ الاستخراج: <b>{formattedArabicDate} ({selectedDate})</b><br />
                الساعة: <b>{new Date().toLocaleTimeString('ar-MA', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} (GMT)</b>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-center my-3">
          <div className="inline-block text-base font-bold text-red-800 bg-red-50 border border-red-600 rounded-full px-6 py-1">
            ورقة المراقبة اليومية للغيابات والمخالفات السلوكية
          </div>
        </div>

        {/* Print Absences */}
        <div>
          <h3 className="font-bold text-sm mb-2 underline">أولاً: سجل الغيابات والتأخرات اليومية ({absences.length} حالة):</h3>
          <table className="w-full border-collapse border border-black text-right text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-1">#</th>
                <th className="border border-black p-1">اسم التلميذ(ة)</th>
                <th className="border border-black p-1">القسم</th>
                <th className="border border-black p-1">المقعد</th>
                <th className="border border-black p-1">الحالة</th>
                <th className="border border-black p-1">الفترة</th>
                <th className="border border-black p-1">الأستاذ(ة)</th>
                <th className="border border-black p-1">التبرير</th>
                <th className="border border-black p-1">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {absences.map((a, i) => (
                <tr key={a.id}>
                  <td className="border border-black p-1">{i + 1}</td>
                  <td className="border border-black p-1 font-bold">{a.studentName}</td>
                  <td className="border border-black p-1">{a.sectionLevel} ({a.sectionClass})</td>
                  <td className="border border-black p-1">{a.seatNum || '—'}</td>
                  <td className="border border-black p-1">{a.status === 'absent' ? 'غياب' : 'تأخر'}</td>
                  <td className="border border-black p-1">{a.sessionPeriod}</td>
                  <td className="border border-black p-1">{a.teacherName}</td>
                  <td className="border border-black p-1">
                    {a.justified === 'justified' ? 'مبرر' : a.justified === 'medical' ? 'شهادة طبية' : a.justified === 'permission' ? 'إذن' : 'غير مبرر'}
                  </td>
                  <td className="border border-black p-1">{a.justificationReason || a.notes || '—'}</td>
                </tr>
              ))}
              {absences.length === 0 && (
                <tr>
                  <td colSpan={9} className="border border-black p-2 text-center">
                    لا يوجد أي غياب مسجل في هذا اليوم.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Print Violations */}
        <div className="pt-2">
          <h3 className="font-bold text-sm mb-2 underline">ثانياً: سجل المخالفات والملاحظات التربوية ({violations.length} مخالفة):</h3>
          <table className="w-full border-collapse border border-black text-right text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-1">#</th>
                <th className="border border-black p-1">اسم التلميذ(ة)</th>
                <th className="border border-black p-1">القسم</th>
                <th className="border border-black p-1">نوع المخالفة</th>
                <th className="border border-black p-1">الوصف</th>
                <th className="border border-black p-1">الإجراء المتخذ</th>
                <th className="border border-black p-1">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, i) => (
                <tr key={v.id}>
                  <td className="border border-black p-1">{i + 1}</td>
                  <td className="border border-black p-1 font-bold">{v.studentName}</td>
                  <td className="border border-black p-1">{v.sectionLevel} ({v.sectionClass})</td>
                  <td className="border border-black p-1">{v.violationType}</td>
                  <td className="border border-black p-1">{v.description}</td>
                  <td className="border border-black p-1">{v.actionTaken}</td>
                  <td className="border border-black p-1">{v.recordedTime}</td>
                </tr>
              ))}
              {violations.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-black p-2 text-center">
                    لا توجد أي مخالفة مسجلة في هذا اليوم.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="pt-8 grid grid-cols-2 text-center font-bold text-xs">
          <div>
            <p>توقيع الحارس العام للخارجية</p>
            <div className="h-16"></div>
          </div>
          <div>
            <p>توقيع وخاتم مدير المؤسسة</p>
            <div className="h-16"></div>
          </div>
        </div>
      </div>
    </div>
  );

  // If embedded in Director Dashboard, render directly
  if (embedded) {
    return content;
  }

  // Modal Overlay Container
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-slate-100 rounded-2xl sm:rounded-3xl max-w-6xl w-full max-h-[96vh] sm:max-h-[92vh] overflow-y-auto p-2.5 sm:p-4 md:p-6 shadow-2xl border border-slate-300 relative">
        <button
          onClick={onClose}
          className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 p-1.5 sm:p-2 rounded-full bg-white/80 hover:bg-white text-slate-600 hover:text-black shadow-xs z-10 transition-colors"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {content}
      </div>
    </div>
  );
};
