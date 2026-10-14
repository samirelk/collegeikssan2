import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Printer,
  FileText,
  User,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Share2,
  MessageCircle,
  ShieldAlert,
  Send,
  Building2,
  CheckCircle2,
  AlertCircle,
  Download,
  School,
  ExternalLink
} from 'lucide-react';
import { SectionItem, AppSettings, User as UserType } from '../types';
import {
  printAllViolationsReport,
  printSingleViolationNotice,
  printParentViolationNotice,
  shareViolationViaWhatsApp
} from '../utils/printNotes';

export interface ViolationRecordItem {
  id: string;
  section_id: string;
  sectionId?: string;
  seat_num?: number;
  seatNum?: number;
  student_name: string;
  studentName?: string;
  student_number?: string;
  studentNumber?: string;
  massar_number?: string;
  massarNumber?: string;
  violation_type: string;
  violationType?: string;
  description: string;
  action_taken?: string;
  actionTaken?: string;
  teacher_name?: string;
  teacherName?: string;
  teacher_subject?: string;
  teacherSubject?: string;
  teacher_id?: string;
  teacherId?: string;
  recorded_date: string;
  recordedDate?: string;
  recorded_time: string;
  recordedTime?: string;
  section_level?: string;
  section_class?: string;
}

interface ViolationsRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
  sections: SectionItem[];
  settings: AppSettings;
  onRefreshData?: () => void;
}

const VIOLATION_CATEGORIES = [
  'تشويش داخل القسم',
  'عدم إحضار اللوازم المدرسية',
  'عدم إنجاز الواجب المنزلي',
  'سوء سلوك وقلة انضباط',
  'استخدام الهاتف النقال',
  'تأخر متكرر عن الحصة',
  'هندام غير لائق',
  'مغادرة القسم دون إذن',
  'عدم احترام الأستاذ',
  'عدم احترام زملاء القسم',
  'إتلاف التجهيزات المدرسية',
  'مخالفة تربوية أخرى'
];

const DISCIPLINARY_ACTIONS = [
  'تنبيه شفهي',
  'إنذار كتابي',
  'إشعار لولي الأمر',
  'استدعاء ولي الأمر',
  'إحالة للحراسة العامة',
  'إحالة لمجلس الانضباط',
  'تعهد خطي بالانضباط'
];

export const ViolationsRegisterModal: React.FC<ViolationsRegisterModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  sections,
  settings,
  onRefreshData
}) => {
  const isTeacher = currentUser?.role === 'teacher';

  // Filter sections belonging to teacher if teacher
  const teacherSections = useMemo(() => {
    if (!isTeacher || !currentUser?.assignedSections) return sections;
    return sections.filter((s) => currentUser.assignedSections?.includes(s.id));
  }, [sections, isTeacher, currentUser]);

  const [violations, setViolations] = useState<ViolationRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Violation Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSectionId, setNewSectionId] = useState<string>(teacherSections[0]?.id || sections[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentNumber, setNewStudentNumber] = useState<string>('');
  const [newMassarNumber, setNewMassarNumber] = useState<string>('');
  const [newSeatNum, setNewSeatNum] = useState<number | undefined>(undefined);
  const [newViolationType, setNewViolationType] = useState<string>(VIOLATION_CATEGORIES[0]);
  const [newDescription, setNewDescription] = useState<string>('');
  const [newActionTaken, setNewActionTaken] = useState<string>('تنبيه شفهي');
  const [issueSummons, setIssueSummons] = useState<boolean>(false);
  const [summonsAppointmentDate, setSummonsAppointmentDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [summonsAppointmentTime, setSummonsAppointmentTime] = useState<string>('10:00');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Parent Notice Modal
  const [parentNoticeItem, setParentNoticeItem] = useState<ViolationRecordItem | null>(null);
  const [customAppointmentDate, setCustomAppointmentDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [customAppointmentTime, setCustomAppointmentTime] = useState<string>('10:00');

  // Deleting State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load violations
  const fetchViolations = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let url = '/api/violations?';
      const params = new URLSearchParams();

      if (isTeacher && currentUser) {
        params.append('teacherId', currentUser.id);
        params.append('teacherName', currentUser.fullName);
      }

      if (selectedSectionFilter !== 'all') {
        params.append('sectionId', selectedSectionFilter);
      }

      const res = await fetch(`/api/violations?${params.toString()}`, {
        headers: currentUser
          ? {
              'x-user-id': currentUser.id,
              'x-user-role': currentUser.role
            }
          : {}
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر تحميل سجل المخالفات');
      }

      setViolations(data.violations || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تحميل سجل المخالفات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchViolations();
    }
  }, [isOpen, selectedSectionFilter]);

  // Students list for selected section in Add Modal
  const currentAddSection = useMemo(() => {
    return sections.find((s) => s.id === newSectionId);
  }, [sections, newSectionId]);

  const sectionStudentsList = useMemo(() => {
    if (!currentAddSection || !Array.isArray(currentAddSection.seats)) return [];
    return currentAddSection.seats
      .filter((seat) => seat.student && seat.student.name?.trim())
      .map((seat) => ({
        seatNum: seat.seatNum,
        name: seat.student.name.trim(),
        studentNumber: seat.student.studentNumber || String(seat.seatNum),
        massarNumber: seat.student.massarNumber || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [currentAddSection]);

  const handleStudentSelect = (studentName: string) => {
    setNewStudentName(studentName);
    const found = sectionStudentsList.find((s) => s.name === studentName);
    if (found) {
      setNewStudentNumber(found.studentNumber);
      setNewMassarNumber(found.massarNumber);
      setNewSeatNum(found.seatNum);
    }
  };

  // Submit new violation
  const handleCreateViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionId || !newStudentName.trim() || !newDescription.trim()) {
      setErrorMessage('يرجى تحديد القسم، اسم التلميذ، وكتابة تفاصيل المخالفة');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const nowTimeStr = new Date().toLocaleTimeString('ar-FR', { hour: '2-digit', minute: '2-digit' });

      const res = await fetch('/api/violations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser
            ? {
                'x-user-id': currentUser.id,
                'x-user-role': currentUser.role
              }
            : {})
        },
        body: JSON.stringify({
          sectionId: newSectionId,
          seatNum: newSeatNum,
          studentName: newStudentName.trim(),
          studentNumber: newStudentNumber,
          massarNumber: newMassarNumber,
          violationType: newViolationType,
          description: newDescription.trim(),
          actionTaken: newActionTaken,
          teacherName: currentUser?.fullName || 'الأستاذ',
          teacherSubject: currentUser?.subject || '',
          recordedDate: todayStr,
          recordedTime: nowTimeStr,
          issueParentSummons: issueSummons,
          summonsDate: issueSummons ? summonsAppointmentDate : undefined,
          appointmentTime: issueSummons ? summonsAppointmentTime : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر تسجيل المخالفة');
      }

      setSuccessMessage(data.message || 'تم تسجيل المخالفة بنجاح ✓');
      setIsAddModalOpen(false);
      setNewDescription('');
      setNewStudentName('');
      setNewMassarNumber('');
      setIssueSummons(false);
      await fetchViolations();
      onRefreshData?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تسجيل المخالفة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete violation
  const handleDeleteViolation = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا السجل نهائياً؟')) return;

    setDeletingId(id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/violations/${id}`, {
        method: 'DELETE',
        headers: currentUser
          ? {
              'x-user-id': currentUser.id,
              'x-user-role': currentUser.role
            }
          : {}
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر حذف المخالفة');
      }

      setSuccessMessage('تم حذف المخالفة من السجل بنجاح ✓');
      setViolations((prev) => prev.filter((v) => v.id !== id));
      onRefreshData?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف المخالفة');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered violations
  const filteredViolations = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return violations.filter((v) => {
      // Category filter
      const vType = v.violation_type || v.violationType || '';
      if (selectedCategoryFilter !== 'all' && vType !== selectedCategoryFilter) {
        return false;
      }

      // Action filter
      const vAction = v.action_taken || v.actionTaken || '';
      if (selectedActionFilter !== 'all' && vAction !== selectedActionFilter) {
        return false;
      }

      // Date range filter
      const vDate = v.recorded_date || v.recordedDate || '';
      if (dateRangeFilter === 'today' && vDate !== todayStr) {
        return false;
      }
      if (dateRangeFilter === 'week') {
        const d = new Date(vDate);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (d < weekAgo) return false;
      }
      if (dateRangeFilter === 'month') {
        const thisMonth = todayStr.slice(0, 7);
        if (!vDate.startsWith(thisMonth)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sName = (v.student_name || v.studentName || '').toLowerCase();
        const mNum = (v.massar_number || v.massarNumber || '').toLowerCase();
        const sNum = (v.student_number || v.studentNumber || '').toLowerCase();
        const tName = (v.teacher_name || v.teacherName || '').toLowerCase();
        const secL = (v.section_level || '').toLowerCase();
        const secC = (v.section_class || '').toLowerCase();

        const match =
          sName.includes(q) ||
          mNum.includes(q) ||
          sNum.includes(q) ||
          tName.includes(q) ||
          secL.includes(q) ||
          secC.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [violations, selectedCategoryFilter, selectedActionFilter, dateRangeFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = violations.filter((v) => (v.recorded_date || v.recordedDate) === todayStr).length;
    const summonsCount = violations.filter((v) => {
      const act = v.action_taken || v.actionTaken || '';
      return act.includes('استدعاء') || act.includes('إشعار');
    }).length;

    // Top violation category
    const catCounts: Record<string, number> = {};
    violations.forEach((v) => {
      const type = v.violation_type || v.violationType || 'أخرى';
      catCounts[type] = (catCounts[type] || 0) + 1;
    });
    let topCat = '—';
    let max = 0;
    Object.entries(catCounts).forEach(([cat, count]) => {
      if (count > max) {
        max = count;
        topCat = cat;
      }
    });

    return {
      total: violations.length,
      today: todayCount,
      summons: summonsCount,
      topCategory: topCat
    };
  }, [violations]);

  // Print all filtered violations
  const handlePrintAllViolations = () => {
    const secObj = sections.find((s) => s.id === selectedSectionFilter);
    const sectionTitle =
      selectedSectionFilter === 'all'
        ? isTeacher
          ? 'جميع الأقسام المسندة للأستاذ'
          : 'جميع أقسام المؤسسة'
        : secObj
        ? `${secObj.level} (${secObj.classNumber})`
        : 'القسم المحدد';

    const formattedList = filteredViolations.map((v) => {
      const sec = sections.find((s) => s.id === (v.section_id || v.sectionId));
      return {
        id: v.id,
        sectionName: sec ? `${sec.level} (${sec.classNumber})` : v.section_level ? `${v.section_level} (${v.section_class})` : '—',
        level: sec?.level || v.section_level,
        classNumber: sec?.classNumber || v.section_class,
        studentName: v.student_name || v.studentName || '—',
        studentNumber: v.student_number || v.studentNumber || '',
        massarNumber: v.massar_number || v.massarNumber || '',
        violationType: v.violation_type || v.violationType || 'مخالفة',
        recordedDate: v.recorded_date || v.recordedDate || '',
        recordedTime: v.recorded_time || v.recordedTime || '',
        teacherName: v.teacher_name || v.teacherName || '',
        teacherSubject: v.teacher_subject || v.teacherSubject || '',
        actionTaken: v.action_taken || v.actionTaken || 'تنبيه شفهي',
        notes: v.description || ''
      };
    });

    const printed = printAllViolationsReport({
      institution: settings.institution || 'المدرسة الرقمية',
      academicYear: settings.year || '2025/2026',
      sectionTitle,
      dateFilterText:
        dateRangeFilter === 'today'
          ? 'اليوم'
          : dateRangeFilter === 'week'
          ? 'آخر 7 أيام'
          : dateRangeFilter === 'month'
          ? 'هذا الشهر'
          : undefined,
      violations: formattedList
    });

    if (printed) {
      setSuccessMessage('تم تجهيز وإرسال تقرير المخالفات للطباعة بنجاح ✓');
    }
  };

  // Print single violation notice
  const handlePrintSingleNotice = (v: ViolationRecordItem) => {
    const sec = sections.find((s) => s.id === (v.section_id || v.sectionId));
    printSingleViolationNotice({
      institution: settings.institution || 'المدرسة الرقمية',
      academicYear: settings.year || '2025/2026',
      level: sec?.level || v.section_level || 'الفصل',
      classNumber: sec?.classNumber || v.section_class || '1',
      teacherName: v.teacher_name || v.teacherName || currentUser?.fullName || 'الأستاذ',
      subject: v.teacher_subject || v.teacherSubject || currentUser?.subject || '',
      studentName: v.student_name || v.studentName || '',
      studentNumber: v.student_number || v.studentNumber || '',
      massarNumber: v.massar_number || v.massarNumber || '',
      violationType: v.violation_type || v.violationType || '',
      actionTaken: v.action_taken || v.actionTaken || 'تنبيه شفهي',
      date: v.recorded_date || v.recordedDate || '',
      time: v.recorded_time || v.recordedTime || '',
      notes: v.description || ''
    });
  };

  // Print official parent summons slip
  const handlePrintParentSummons = (v: ViolationRecordItem) => {
    const sec = sections.find((s) => s.id === (v.section_id || v.sectionId));
    printParentViolationNotice({
      institution: settings.institution || 'المدرسة الرقمية',
      academicYear: settings.year || '2025/2026',
      studentName: v.student_name || v.studentName || '',
      studentNumber: v.student_number || v.studentNumber || '',
      massarNumber: v.massar_number || v.massarNumber || '',
      sectionName: sec ? `${sec.level} (${sec.classNumber})` : undefined,
      level: sec?.level || v.section_level,
      classNumber: sec?.classNumber || v.section_class,
      violationType: v.violation_type || v.violationType || '',
      description: v.description || '',
      actionTaken: v.action_taken || v.actionTaken || 'استدعاء ولي الأمر',
      recordedDate: v.recorded_date || v.recordedDate || '',
      recordedTime: v.recorded_time || v.recordedTime || '',
      teacherName: v.teacher_name || v.teacherName || currentUser?.fullName || 'الأستاذ',
      teacherSubject: v.teacher_subject || v.teacherSubject || currentUser?.subject || '',
      appointmentDate: customAppointmentDate,
      appointmentTime: customAppointmentTime
    });
    setParentNoticeItem(null);
  };

  // WhatsApp notification
  const handleSendWhatsApp = (v: ViolationRecordItem) => {
    const sec = sections.find((s) => s.id === (v.section_id || v.sectionId));
    shareViolationViaWhatsApp({
      studentName: v.student_name || v.studentName || '',
      sectionName: sec ? `${sec.level} (${sec.classNumber})` : v.section_level || 'الفصل',
      violationType: v.violation_type || v.violationType || '',
      actionTaken: v.action_taken || v.actionTaken || 'تنبيه شفهي',
      teacherName: v.teacher_name || v.teacherName || currentUser?.fullName || '',
      subject: v.teacher_subject || v.teacherSubject || currentUser?.subject || '',
      date: v.recorded_date || v.recordedDate || '',
      time: v.recorded_time || v.recordedTime || '',
      institution: settings.institution || 'المدرسة الرقمية'
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredViolations.length === 0) {
      alert('لا توجد مخالفات لتصديرها');
      return;
    }

    const headers = [
      '#',
      'التلميذ',
      'رقم مسار',
      'القسم',
      'نوع المخالفة',
      'التفاصيل والملاحظات',
      'الإجراء المتخذ',
      'الأستاذ المسجل',
      'المادة',
      'التاريخ',
      'التوقيت'
    ];

    const rows = filteredViolations.map((v, i) => {
      const sec = sections.find((s) => s.id === (v.section_id || v.sectionId));
      return [
        i + 1,
        `"${(v.student_name || v.studentName || '').replace(/"/g, '""')}"`,
        `"${v.massar_number || v.massarNumber || ''}"`,
        `"${sec ? `${sec.level} (${sec.classNumber})` : v.section_level || ''}"`,
        `"${(v.violation_type || v.violationType || '').replace(/"/g, '""')}"`,
        `"${(v.description || '').replace(/"/g, '""')}"`,
        `"${(v.action_taken || v.actionTaken || '').replace(/"/g, '""')}"`,
        `"${(v.teacher_name || v.teacherName || '').replace(/"/g, '""')}"`,
        `"${(v.teacher_subject || v.teacherSubject || '').replace(/"/g, '""')}"`,
        `"${v.recorded_date || v.recordedDate || ''}"`,
        `"${v.recorded_time || v.recordedTime || ''}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `سجل_المخالفات_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto" dir="rtl">
      <div className="bg-[#FAF8F5] w-full max-w-6xl max-h-[92vh] rounded-2xl sm:rounded-3xl border-2 border-[#1A4E47]/30 shadow-2xl flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A4E47] via-[#163F39] to-[#0F2E29] text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-[#C98A3C]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#C98A3C]/20 border border-[#C98A3C]/50 flex items-center justify-center text-[#C98A3C] shadow-xs">
              <ShieldAlert className="w-6 h-6 text-[#C98A3C]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold font-['Amiri',serif] tracking-wide text-white m-0">
                  سجل المخالفات والانضباط المدرسي
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#C98A3C] text-[#133D37] font-bold text-[11px] shadow-xs">
                  {isTeacher ? 'فضاء الأستاذ' : 'الإدارة العامة'}
                </span>
                <span className="text-white/60 text-xs hidden sm:inline">• المدرسة الرقمية</span>
              </div>
              <p className="text-xs text-[#F2EFE3]/80 mt-0.5">
                سجل مستقل وشامل لرصد مخالفات التلاميذ، تحرير الإشعارات الرسمية لأولياء الأمور، والطباعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchViolations}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>إجمالي المخالفات</span>
                <ShieldAlert className="w-4 h-4 text-[#991b1b]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#991b1b] mt-1">
                {stats.total}
              </div>
              <div className="text-[10px] text-[#6C6356] mt-0.5">مسجلة في السجل الرسمي</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>مخالفات اليوم</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#8A5A18] mt-1">
                {stats.today}
              </div>
              <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                {stats.today === 0 ? 'لا مخالفات اليوم ✓' : 'حالات مسجلة اليوم'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>استدعاءات أولياء الأمور</span>
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-blue-900 mt-1">
                {stats.summons}
              </div>
              <div className="text-[10px] text-blue-700 font-semibold mt-0.5">إشعار رسمي صادر</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>المخالفة الأكثر تكراراً</span>
                <AlertTriangle className="w-4 h-4 text-[#C98A3C]" />
              </div>
              <div className="text-sm font-bold text-[#1F2926] mt-1 truncate" title={stats.topCategory}>
                {stats.topCategory}
              </div>
              <div className="text-[10px] text-[#6C6356] mt-0.5">سلوك يحتاج إلى تأطير</div>
            </div>
          </div>

          {/* Action Header Bar */}
          <div className="bg-white p-3 rounded-2xl border border-[#E5DFD4] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Add Violation Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#C98A3C]" />
                <span>تسجيل مخالفة جديدة</span>
              </button>

              {/* Print All Violations Button */}
              <button
                type="button"
                onClick={handlePrintAllViolations}
                disabled={filteredViolations.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFF8E8] hover:bg-[#FCEFD0] text-[#8A5A18] border border-[#F2D89C] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                title="طباعة سجل المخالفات المجمع مع الترويسة المغربية الرسمية"
              >
                <Printer className="w-4 h-4 text-[#C98A3C]" />
                <span>طباعة جميع المخالفات ({filteredViolations.length})</span>
              </button>

              {/* Export to CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredViolations.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                title="تصدير جدول المخالفات إلى ملف إكسل CSV"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>تصدير Excel</span>
              </button>
            </div>

            <div className="text-xs text-[#6C6356]">
              المطابق للبحث: <strong className="text-[#1A4E47] font-mono">{filteredViolations.length}</strong> من أصل {violations.length}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-2xl border border-[#E5DFD4] shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#8A7E6C] absolute right-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث: اسم التلميذ، مسار، الرقم..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs"
              />
            </div>

            {/* Section Filter */}
            <div>
              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs cursor-pointer"
              >
                <option value="all">
                  {isTeacher ? 'كافة أقسامي المسندة' : 'كافة أقسام المؤسسة'}
                </option>
                {teacherSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.level} ({sec.classNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs cursor-pointer"
              >
                <option value="all">كافة أنواع المخالفات</option>
                {VIOLATION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <select
                value={selectedActionFilter}
                onChange={(e) => setSelectedActionFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs cursor-pointer"
              >
                <option value="all">كافة الإجراءات المتخذة</option>
                {DISCIPLINARY_ACTIONS.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#D5CDC0]">
              <button
                type="button"
                onClick={() => setDateRangeFilter('all')}
                className={`flex-1 py-1 text-center rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  dateRangeFilter === 'all' ? 'bg-[#1A4E47] text-white' : 'text-[#6C6356]'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setDateRangeFilter('today')}
                className={`flex-1 py-1 text-center rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  dateRangeFilter === 'today' ? 'bg-[#1A4E47] text-white' : 'text-[#6C6356]'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setDateRangeFilter('week')}
                className={`flex-1 py-1 text-center rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  dateRangeFilter === 'week' ? 'bg-[#1A4E47] text-white' : 'text-[#6C6356]'
                }`}
              >
                الأسبوع
              </button>
              <button
                type="button"
                onClick={() => setDateRangeFilter('month')}
                className={`flex-1 py-1 text-center rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  dateRangeFilter === 'month' ? 'bg-[#1A4E47] text-white' : 'text-[#6C6356]'
                }`}
              >
                الشهر
              </button>
            </div>
          </div>

          {/* Violations List Table */}
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#1A4E47] animate-spin mx-auto" />
              <div className="text-xs text-[#6C6356]">جاري تحميل سجل المخالفات...</div>
            </div>
          ) : filteredViolations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5DFD4] p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-base text-[#1F2926]">لا توجد مخالفات مسجلة مطابقة لمعايير البحث</h3>
              <p className="text-xs text-[#6C6356] max-w-md mx-auto">
                السجل سليم وخالٍ من المخالفات في النطاق المحدد، أو لم يتم تسجيل أي مخالفة لهذا القسم بعد.
              </p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1A4E47] text-white font-bold text-xs mt-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#C98A3C]" />
                <span>تسجيل مخالفة جديدة الآن</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#E5DFD4] bg-white shadow-xs">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#1A4E47] text-white text-[11px]">
                      <th className="py-3 px-3 font-bold text-center w-12">#</th>
                      <th className="py-3 px-3 font-bold">التلميذ(ة)</th>
                      <th className="py-3 px-3 font-bold text-center">رقم مسار</th>
                      <th className="py-3 px-3 font-bold text-center">القسم</th>
                      <th className="py-3 px-3 font-bold">نوع المخالفة والتفاصيل</th>
                      <th className="py-3 px-3 font-bold text-center">الإجراء المتخذ</th>
                      <th className="py-3 px-3 font-bold text-center">الأستاذ المسجل</th>
                      <th className="py-3 px-3 font-bold text-center">التاريخ والتوقيت</th>
                      <th className="py-3 px-3 font-bold text-center w-40">الإعدادات والإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DFD4]">
                    {filteredViolations.map((v, idx) => {
                      const sec = sections.find((s) => s.id === (v.section_id || v.sectionId));
                      const secName = sec ? `${sec.level} (${sec.classNumber})` : v.section_level ? `${v.section_level} (${v.section_class})` : '—';
                      const vDate = v.recorded_date || v.recordedDate || '—';
                      const vTime = v.recorded_time || v.recordedTime || '';

                      return (
                        <tr key={v.id} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3 px-3 text-center font-mono font-bold text-[#6C6356]">
                            {idx + 1}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-[#1F2926] text-[13px]">
                              {v.student_name || v.studentName}
                            </div>
                            {(v.student_number || v.studentNumber) && (
                              <div className="text-[10px] text-[#6C6356]">
                                رقم الترتيب: {v.student_number || v.studentNumber}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-[#1A4E47]">
                            {v.massar_number || v.massarNumber || '—'}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-[#FAF0DC] text-[#8A5A18] font-bold text-[11px] border border-[#F2D89C]">
                              {secName}
                            </span>
                          </td>

                          <td className="py-3 px-3 max-w-xs">
                            <div className="font-bold text-rose-800 text-xs flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>{v.violation_type || v.violationType}</span>
                            </div>
                            {v.description && (
                              <p className="text-[11px] text-[#555] mt-0.5 line-clamp-2">
                                {v.description}
                              </p>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                              (v.action_taken || v.actionTaken)?.includes('استدعاء') || (v.action_taken || v.actionTaken)?.includes('مجلس')
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : (v.action_taken || v.actionTaken)?.includes('إنذار') || (v.action_taken || v.actionTaken)?.includes('إشعار')
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}>
                              {v.action_taken || v.actionTaken || 'تنبيه شفهي'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center text-xs text-[#333]">
                            <div className="font-semibold">{v.teacher_name || v.teacherName || '—'}</div>
                            {(v.teacher_subject || v.teacherSubject) && (
                              <div className="text-[10px] text-[#6C6356] font-mono">
                                ({v.teacher_subject || v.teacherSubject})
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center font-mono text-[11px] text-[#6C6356]">
                            <div>{vDate}</div>
                            {vTime && <div className="text-[10px] text-slate-400">{vTime}</div>}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Parent Summons Notice */}
                              <button
                                type="button"
                                onClick={() => {
                                  setParentNoticeItem(v);
                                }}
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                                title="استخراج استدعاء وإشعار رسمي لولي الأمر"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* WhatsApp Notice */}
                              <button
                                type="button"
                                onClick={() => handleSendWhatsApp(v)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                                title="إرسال إشعار فوري لولي الأمر عبر واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Single Notice Slip */}
                              <button
                                type="button"
                                onClick={() => handlePrintSingleNotice(v)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                                title="طباعة إشعار المخالفة الفردي"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteViolation(v.id)}
                                disabled={deletingId === v.id}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                                title="حذف المخالفة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredViolations.map((v, idx) => {
                  const sec = sections.find((s) => s.id === (v.section_id || v.sectionId));
                  const secName = sec ? `${sec.level} (${sec.classNumber})` : v.section_level || '—';
                  const vDate = v.recorded_date || v.recordedDate || '—';
                  const vTime = v.recorded_time || v.recordedTime || '';

                  return (
                    <div key={v.id} className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#1A4E47] text-white flex items-center justify-center font-mono font-bold text-xs">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-sm text-[#1F2926]">
                              {v.student_name || v.studentName}
                            </div>
                            <div className="text-[11px] text-[#6C6356] font-mono">
                              مسار: {v.massar_number || v.massarNumber || '—'}
                            </div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg bg-[#FAF0DC] text-[#8A5A18] font-bold text-xs border border-[#F2D89C]">
                          {secName}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-rose-950 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{v.violation_type || v.violationType}</span>
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-white text-rose-800 border border-rose-300">
                            {v.action_taken || v.actionTaken || 'تنبيه'}
                          </span>
                        </div>
                        {v.description && (
                          <p className="text-xs text-[#444] pt-1">
                            {v.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#6C6356] pt-1 border-t border-[#E5DFD4]">
                        <span>الأستاذ: {v.teacher_name || v.teacherName || '—'}</span>
                        <span className="font-mono">{vDate} {vTime}</span>
                      </div>

                      {/* Action buttons on card */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setParentNoticeItem(v)}
                          className="flex items-center justify-center gap-1 p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-700" />
                          <span>استدعاء</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(v)}
                          className="flex items-center justify-center gap-1 p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                          <span>واتساب</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintSingleNotice(v)}
                          className="flex items-center justify-center gap-1 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>إشعار</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteViolation(v.id)}
                          className="flex items-center justify-center gap-1 p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#FAF8F5] p-3.5 sm:p-4 border-t border-[#E5DFD4] flex items-center justify-between text-xs text-[#6C6356] shrink-0">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-[#1A4E47]" />
            <span>المدرسة الرقمية • {settings.institution || 'الثانوية الإعدادية ايكسان'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold transition-colors cursor-pointer shadow-xs"
          >
            إغلاق السجل
          </button>
        </div>
      </div>

      {/* SUB-MODAL 1: ADD NEW VIOLATION */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl border-2 border-[#1A4E47] shadow-2xl overflow-hidden my-auto">
            <div className="bg-[#1A4E47] text-white p-4 flex items-center justify-between border-b border-[#C98A3C]/40">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#C98A3C]" />
                <h3 className="font-bold text-base font-['Amiri',serif]">تسجيل مخالفة انضباطية جديدة</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateViolation} className="p-5 space-y-4 text-xs">
              {/* Section Selector */}
              <div>
                <label className="block font-bold text-[#1F2926] mb-1">
                  القسم الدراسي: <span className="text-rose-600">*</span>
                </label>
                <select
                  value={newSectionId}
                  onChange={(e) => {
                    setNewSectionId(e.target.value);
                    setNewStudentName('');
                    setNewMassarNumber('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs"
                  required
                >
                  {teacherSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.level} ({sec.classNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Selection (Choose from Section list or write custom) */}
              <div>
                <label className="block font-bold text-[#1F2926] mb-1">
                  اختيار التلميذ(ة): <span className="text-rose-600">*</span>
                </label>
                {sectionStudentsList.length > 0 ? (
                  <select
                    value={newStudentName}
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs"
                    required
                  >
                    <option value="">-- اختر التلميذ(ة) من لائحة القسم ({sectionStudentsList.length} تلميذ) --</option>
                    {sectionStudentsList.map((st) => (
                      <option key={`${st.name}_${st.seatNum}`} value={st.name}>
                        #{st.studentNumber} - {st.name} {st.massarNumber ? `(${st.massarNumber})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="اكتب اسم التلميذ(ة)..."
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs"
                    required
                  />
                )}
              </div>

              {/* Massar Number & Student Number auto-fills */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#6C6356] mb-1">رقم مسار (Massar):</label>
                  <input
                    type="text"
                    value={newMassarNumber}
                    onChange={(e) => setNewMassarNumber(e.target.value)}
                    placeholder="مثال: J123456789"
                    className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#6C6356] mb-1">رقم الترتيب / المقعد:</label>
                  <input
                    type="text"
                    value={newStudentNumber}
                    onChange={(e) => setNewStudentNumber(e.target.value)}
                    placeholder="مثال: 12"
                    className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs font-mono"
                  />
                </div>
              </div>

              {/* Violation Category */}
              <div>
                <label className="block font-bold text-[#1F2926] mb-1">
                  طبيعة ونوع المخالفة: <span className="text-rose-600">*</span>
                </label>
                <select
                  value={newViolationType}
                  onChange={(e) => setNewViolationType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs"
                >
                  {VIOLATION_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Disciplinary Action */}
              <div>
                <label className="block font-bold text-[#1F2926] mb-1">
                  الإجراء التربوي المتخذ:
                </label>
                <select
                  value={newActionTaken}
                  onChange={(e) => setNewActionTaken(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs"
                >
                  {DISCIPLINARY_ACTIONS.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block font-bold text-[#1F2926] mb-1">
                  تفاصيل وحيثيات المخالفة: <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="وصف دقيق لما قام به التلميذ داخل الحصة أو الفصل..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] focus:bg-white focus:border-[#1A4E47] outline-none text-xs resize-none"
                  required
                />
              </div>

              {/* Parent Summons Checkbox & Details */}
              <div className="p-3.5 rounded-2xl bg-[#FFF8E8] border border-[#F2D89C] space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={issueSummons}
                    onChange={(e) => setIssueSummons(e.target.checked)}
                    className="w-4 h-4 text-[#8A5A18] rounded focus:ring-0 cursor-pointer"
                  />
                  <span className="font-bold text-[#8A5A18] text-xs">
                    إصدار استدعاء رسمي فوري لولي أمر التلميذ(ة) لحضور المؤسسة
                  </span>
                </label>

                {issueSummons && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#F2D89C]/60 animate-fadeIn">
                    <div>
                      <label className="block font-bold text-[#6C6356] mb-1">تاريخ الحضور المطلوب:</label>
                      <input
                        type="date"
                        value={summonsAppointmentDate}
                        onChange={(e) => setSummonsAppointmentDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-white text-xs font-mono"
                        required={issueSummons}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#6C6356] mb-1">توقيت الحضور:</label>
                      <input
                        type="time"
                        value={summonsAppointmentTime}
                        onChange={(e) => setSummonsAppointmentTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-white text-xs font-mono"
                        required={issueSummons}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري التسجيل...' : 'تأكيد وحفظ المخالفة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: PARENT SUMMONS SETUP & PRINT */}
      {parentNoticeItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl border-2 border-amber-500 shadow-2xl overflow-hidden my-auto">
            <div className="bg-amber-500 text-amber-950 p-4 flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-950" />
                <span>استخراج استدعاء رسمي لولي الأمر</span>
              </div>
              <button
                type="button"
                onClick={() => setParentNoticeItem(null)}
                className="p-1 rounded-lg hover:bg-amber-600/30 text-amber-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                <div>التلميذ(ة): <strong>{parentNoticeItem.student_name || parentNoticeItem.studentName}</strong></div>
                <div>المخالفة: <strong className="text-rose-800">{parentNoticeItem.violation_type || parentNoticeItem.violationType}</strong></div>
              </div>

              <div>
                <label className="block font-bold text-[#1F2926] mb-1">تاريخ الحضور المطلوب للإدارة:</label>
                <input
                  type="date"
                  value={customAppointmentDate}
                  onChange={(e) => setCustomAppointmentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F2926] mb-1">توقيت الحضور:</label>
                <input
                  type="time"
                  value={customAppointmentTime}
                  onChange={(e) => setCustomAppointmentTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] bg-[#FAF8F5] font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setParentNoticeItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintParentSummons(parentNoticeItem)}
                  className="px-5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-[#C98A3C]" />
                  <span>طباعة الاستدعاء الرسمي</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
