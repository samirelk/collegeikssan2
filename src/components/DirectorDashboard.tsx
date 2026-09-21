import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  AlertTriangle,
  UserX,
  FileSpreadsheet,
  Layers,
  Search,
  Printer,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Filter,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Award,
  GraduationCap,
  Calendar,
  Building,
  Plus,
  Building2,
  MoreHorizontal
} from 'lucide-react';
import {
  SectionItem,
  AppSettings,
  User,
  TeacherItem,
  DirectorAnalytics,
  DirectorStudentItem,
  TEACHER_SUBJECTS,
  TeacherSubject
} from '../types';
import { AdminDirectorsManagement } from './AdminDirectorsManagement';
import { DailyArchiveModal } from './DailyArchiveModal';
import { AcademicYearsManagement } from './AcademicYearsManagement';
import { ViolationTypesManagement } from './ViolationTypesManagement';
import { TeacherExcelImportModal } from './TeacherExcelImportModal';
import { DirectorPrintModal } from './DirectorPrintModal';

interface DirectorDashboardProps {
  currentUser: User;
  sections: SectionItem[];
  settings: AppSettings;
  onRefreshSections: () => Promise<void>;
  onOpenSectionModal?: () => void;
  onOpenBatchImportModal?: () => void;
  onOpenApprovalsModal?: () => void;
  onYearChanged?: (newYear: string) => void;
}

export const DirectorDashboard: React.FC<DirectorDashboardProps> = ({
  currentUser,
  sections,
  settings,
  onRefreshSections,
  onOpenSectionModal,
  onOpenBatchImportModal,
  onOpenApprovalsModal,
  onYearChanged
}) => {
  const [activeTab, setActiveTab] = useState<'academic-years' | 'teachers' | 'violations' | 'absences' | 'students' | 'sections' | 'daily-archive'>('academic-years');
  const [violationsSubTab, setViolationsSubTab] = useState<'top10' | 'manage-types'>('top10');
  
  // Analytics & Teachers State
  const [analytics, setAnalytics] = useState<DirectorAnalytics | null>(null);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick Teacher Creation Modal State
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('123456');
  const [newSubject, setNewSubject] = useState<TeacherSubject>('الرياضيات');
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [teacherCreateError, setTeacherCreateError] = useState<string | null>(null);

  // Reset Password Modal State
  const [resettingTeacher, setResettingTeacher] = useState<TeacherItem | null>(null);
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Action status loading
  const [actionTeacherId, setActionTeacherId] = useState<string | null>(null);

  // Student Directory Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('all');

  // Section Deletion State
  const [sectionToDelete, setSectionToDelete] = useState<SectionItem | null>(null);
  const [isDeletingSection, setIsDeletingSection] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Selected Section to inspect roster without desks
  const [inspectSectionId, setInspectSectionId] = useState<string | null>(null);

  // Student Addition & Removal by Director (إضافة تلميذ في آخر الترتيب / إزالة تلميذ في حالة انقطاع أو انتقال)
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [targetSectionForAdd, setTargetSectionForAdd] = useState<SectionItem | null>(null);
  const [newStudentFullName, setNewStudentFullName] = useState('');
  const [newStudentNumberVal, setNewStudentNumberVal] = useState('');
  const [newStudentMassarNumber, setNewStudentMassarNumber] = useState('');
  const [newStudentCustomSeat, setNewStudentCustomSeat] = useState<number | ''>('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const [studentToRemove, setStudentToRemove] = useState<{
    sectionId: string;
    sectionName: string;
    seatNum: number;
    studentName: string;
    studentNumber?: string;
  } | null>(null);
  const [removeReason, setRemoveReason] = useState<'انتقال' | 'انقطاع'>('انتقال');
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);

  // Auth headers for backend RBAC verification
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUser.id,
    'x-user-role': currentUser.role
  });

  useEffect(() => {
    fetchDirectorData();
  }, []);

  const fetchDirectorData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const authHeaderOnly = {
        'x-user-id': currentUser.id,
        'x-user-role': currentUser.role
      };
      const [analyticsRes, teachersRes] = await Promise.all([
        fetch('/api/director/analytics', { headers: authHeaderOnly }).then((r) => r.json()),
        fetch('/api/auth/teachers', { headers: authHeaderOnly }).then((r) => r.json())
      ]);

      if (analyticsRes.success) {
        setAnalytics({
          topViolations: analyticsRes.topViolations || [],
          topAbsences: analyticsRes.topAbsences || [],
          allStudents: analyticsRes.allStudents || [],
          allViolations: analyticsRes.allViolations || [],
          allAbsences: analyticsRes.allAbsences || [],
          summary: analyticsRes.summary || {
            totalStudents: 0,
            totalTeachers: 0,
            totalSections: 0,
            totalViolations: 0,
            totalAbsences: 0
          }
        });
      }

      if (teachersRes.success && Array.isArray(teachersRes.teachers)) {
        setTeachers(teachersRes.teachers);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء تحميل بيانات الإدارة');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchDirectorData(), onRefreshSections()]);
  };

  // Quick Teacher Creation
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherCreateError(null);

    if (!newFullName.trim() || !newUsername.trim() || !newEmail.trim() || !newPassword) {
      setTeacherCreateError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setTeacherCreateError('كلمتا المرور غير متطابقتين، يرجى التأكد وإعادة الإدخال');
      return;
    }

    if (newPassword.length < 4) {
      setTeacherCreateError('كلمة المرور يجب أن لا تقل عن 4 خانات');
      return;
    }

    try {
      setIsCreatingTeacher(true);
      const res = await fetch('/api/auth/admin-create-teacher', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fullName: newFullName.trim(),
          username: newUsername.trim(),
          email: newEmail.trim(),
          password: newPassword,
          subject: newSubject,
          academicYear: settings.year || '2025/2026'
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'تعذر إنشاء حساب الأستاذ');
      }

      setSuccessMessage(`تم إنشاء حساب الأستاذ (${newFullName}) بنجاح.`);
      setIsAddTeacherOpen(false);
      // Reset form
      setNewFullName('');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('123456');
      setNewPasswordConfirm('123456');
      fetchDirectorData();
    } catch (err: any) {
      setTeacherCreateError(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setIsCreatingTeacher(false);
    }
  };

  // Change teacher status
  const handleToggleTeacherStatus = async (teacher: TeacherItem, newStatus: 'active' | 'pending' | 'inactive') => {
    try {
      setActionTeacherId(teacher.id);
      const res = await fetch(`/api/auth/teachers/${teacher.id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر تغيير حالة الأستاذ');
      setSuccessMessage(`تم تحديث حالة الأستاذ (${teacher.fullName}) إلى ${newStatus === 'active' ? 'نشط ومفعل' : newStatus === 'pending' ? 'قيد الانتظار' : 'معطل'}`);
      fetchDirectorData();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionTeacherId(null);
    }
  };

  // Delete single section handler
  const handleDeleteSingleSectionConfirm = async () => {
    if (!sectionToDelete) return;
    try {
      setIsDeletingSection(true);
      const res = await fetch(`/api/sections/${sectionToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر حذف القسم');
      setSuccessMessage(`تم حذف القسم (${sectionToDelete.level} - ${sectionToDelete.classNumber}) بنجاح`);
      setSectionToDelete(null);
      if (inspectSectionId === sectionToDelete.id) {
        setInspectSectionId(null);
      }
      await onRefreshSections();
      await fetchDirectorData();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف القسم');
    } finally {
      setIsDeletingSection(false);
    }
  };

  // Delete all sections handler
  const handleDeleteAllSectionsConfirm = async () => {
    try {
      setIsDeletingAll(true);
      const res = await fetch('/api/sections', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر حذف جميع الأقسام');
      setSuccessMessage(`تم حذف جميع الأقسام بنجاح (${data.count || sections.length} قسم)`);
      setShowDeleteAllModal(false);
      setInspectSectionId(null);
      await onRefreshSections();
      await fetchDirectorData();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف جميع الأقسام');
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Open add student modal for a section
  const handleOpenAddStudent = (sec: SectionItem) => {
    setTargetSectionForAdd(sec);
    const registered = sec.seats.filter((s) => s.name && s.name.trim());
    const nums = registered
      .map((s) => parseInt(s.number || '', 10))
      .filter((n) => !isNaN(n));
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : registered.length + 1;

    // Find first empty seat from 1 to 40
    const occupiedSeats = new Set(registered.map((s) => s.seat));
    let firstEmpty = 1;
    for (let i = 1; i <= 40; i++) {
      if (!occupiedSeats.has(i)) {
        firstEmpty = i;
        break;
      }
    }

    setNewStudentFullName('');
    setNewStudentNumberVal(String(nextNum));
    setNewStudentMassarNumber('');
    setNewStudentCustomSeat(firstEmpty);
    setIsAddStudentModalOpen(true);
  };

  // Submit adding student to end of section
  const handleConfirmAddStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetSectionForAdd || !newStudentFullName.trim()) return;

    setIsAddingStudent(true);
    try {
      const res = await fetch(`/api/sections/${targetSectionForAdd.id}/students`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newStudentFullName.trim(),
          number: newStudentNumberVal.trim() || undefined,
          massarNumber: newStudentMassarNumber.trim() || undefined,
          customSeatNum: newStudentCustomSeat ? Number(newStudentCustomSeat) : undefined
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر إضافة التلميذ');

      setSuccessMessage(
        `تمت بنجاح إضافة التلميذ (${newStudentFullName.trim()}) في آخر ترتيب القسم (${targetSectionForAdd.level} - ${targetSectionForAdd.classNumber}) بالمقعد #${data.seatNum}`
      );
      setIsAddStudentModalOpen(false);
      setTargetSectionForAdd(null);
      setNewStudentFullName('');
      setNewStudentMassarNumber('');
      await Promise.all([onRefreshSections(), fetchDirectorData()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء إضافة التلميذ');
    } finally {
      setIsAddingStudent(false);
    }
  };

  // Confirm student removal (Dropout or Transfer)
  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove) return;

    setIsRemovingStudent(true);
    try {
      const res = await fetch(
        `/api/sections/${studentToRemove.sectionId}/students/${studentToRemove.seatNum}?reason=${encodeURIComponent(removeReason)}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر شطب التلميذ من القسم');

      setSuccessMessage(
        `تم شطب التلميذ (${studentToRemove.studentName}) من القسم بسبب: ${removeReason === 'انقطاع' ? 'الانقطاع عن الدراسة' : 'الانتقال إلى مؤسسة أخرى'}`
      );
      setStudentToRemove(null);
      await Promise.all([onRefreshSections(), fetchDirectorData()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء إزالة التلميذ');
    } finally {
      setIsRemovingStudent(false);
    }
  };

  // Delete teacher
  const handleDeleteTeacher = async (teacher: TeacherItem) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف حساب الأستاذ "${teacher.fullName}" نهائياً من المؤسسة؟`);
    if (!confirmDelete) return;

    try {
      setActionTeacherId(teacher.id);
      const res = await fetch(`/api/auth/teachers/${teacher.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر حذف الأستاذ');
      setSuccessMessage(`تم حذف حساب الأستاذ (${teacher.fullName}) بنجاح`);
      fetchDirectorData();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionTeacherId(null);
    }
  };

  // Manual verify teacher email
  const handleManualVerifyEmail = async (teacher: TeacherItem) => {
    const confirmed = window.confirm(`هل ترغب في تأكيد البريد الإلكتروني (${teacher.email}) للأستاذ "${teacher.fullName}" يدوياً واعتباره موثقاً؟`);
    if (!confirmed) return;

    try {
      setActionTeacherId(teacher.id);
      const res = await fetch('/api/auth/manual-verify-email', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: teacher.id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر تأكيد البريد يدوياً');
      setSuccessMessage(`تم تأكيد بريد الأستاذ (${teacher.fullName}) بنجاح`);
      fetchDirectorData();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionTeacherId(null);
    }
  };

  // Reset teacher password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingTeacher || !newTeacherPassword.trim()) return;

    try {
      setIsResettingPassword(true);
      const res = await fetch(`/api/auth/teachers/${resettingTeacher.id}/reset-password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: newTeacherPassword.trim() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر تحديث كلمة المرور');
      setSuccessMessage(`تم تغيير كلمة المرور للأستاذ (${resettingTeacher.fullName}) بنجاح`);
      setResettingTeacher(null);
      setNewTeacherPassword('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Distinct Levels present in the school sections
  const distinctLevels = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((s) => {
      if (s.level && s.level.trim()) set.add(s.level.trim());
    });
    if (set.size === 0) {
      return ['الأولى إعدادي', 'الثانية إعدادي', 'الثالثة إعدادي'];
    }
    return Array.from(set);
  }, [sections]);

  // Sections filtered by selected level
  const availableSectionsForSelectedLevel = useMemo(() => {
    if (selectedLevelFilter === 'all') return sections;
    return sections.filter((s) => s.level === selectedLevelFilter || s.level.includes(selectedLevelFilter) || selectedLevelFilter.includes(s.level));
  }, [sections, selectedLevelFilter]);

  // Handle level change and reset section filter if it doesn't belong to the newly selected level
  const handleLevelFilterChange = (newLevel: string) => {
    setSelectedLevelFilter(newLevel);
    if (newLevel !== 'all' && selectedSectionFilter !== 'all') {
      const currentSec = sections.find((s) => s.id === selectedSectionFilter);
      if (currentSec && !currentSec.level.includes(newLevel) && !newLevel.includes(currentSec.level)) {
        setSelectedSectionFilter('all');
      }
    }
  };

  // Filter all students
  const filteredStudents = useMemo(() => {
    if (!analytics?.allStudents) return [];
    return analytics.allStudents.filter((st) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = st.studentName.toLowerCase().includes(q);
        const matchNum = st.studentNumber.toLowerCase().includes(q);
        const matchMassar = (st.massarNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchNum && !matchMassar) return false;
      }
      // Section filter
      if (selectedSectionFilter !== 'all' && st.sectionId !== selectedSectionFilter) {
        return false;
      }
      // Level filter
      if (selectedLevelFilter !== 'all' && !st.sectionLevel.includes(selectedLevelFilter)) {
        return false;
      }
      return true;
    });
  }, [analytics?.allStudents, searchQuery, selectedSectionFilter, selectedLevelFilter]);

  // Inspect Section
  const activeInspectSection = useMemo(() => {
    if (!inspectSectionId) return null;
    return sections.find((s) => s.id === inspectSectionId) || null;
  }, [inspectSectionId, sections]);

  // Print Modal State
  const [printModalMode, setPrintModalMode] = useState<'violations' | 'absences' | null>(null);
  const [showHeaderActions, setShowHeaderActions] = useState(false);

  const directorQuickStats = useMemo(() => {
    const registeredStudents = sections.reduce(
      (total, section) => total + section.seats.filter((seat) => seat.name && seat.name.trim()).length,
      0
    );
    const capacity = sections.length * 40;
    const activeTeachers = teachers.filter((teacher) => teacher.status === 'active').length;

    return {
      registeredStudents,
      occupancy: capacity > 0 ? Math.round((registeredStudents / capacity) * 100) : 0,
      activeTeachers
    };
  }, [sections, teachers]);

  // Print view handler
  const handlePrint = (mode: 'violations' | 'absences' = 'violations') => {
    setPrintModalMode(mode);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 font-sans text-[#2A2118] space-y-6">
      
      {/* 1. Executive Director Header */}
      <div className="bg-[#EFE9D5] rounded-2xl border border-[#D9CEB0] p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1A4E47] text-white">
              فضاء مدير المؤسسة
            </span>
            <span className="text-xs text-[#7A6B58]">
              المؤسسة: <strong className="text-[#2A2118]">{settings.institution || 'الثانوية الإعدادية ايكسان'}</strong>
            </span>
            <span className="text-xs text-[#7A6B58]">
              • الموسم الدراسي الحالي: <strong className="text-[#2A2118] font-mono">{settings.year || '2026/2027'}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#2A2118] tracking-tight">
            لوحة قيادة مدير المؤسسة التعليمية
          </h1>
          <p className="text-sm text-[#5B5040] mt-1">
            تدبير شامل: تدبير المواسم الدراسية وأرشفتها، الأقسام والمقاعد، متابعة الأساتذة وسجلات الغياب والمخالفات.
          </p>
        </div>

        {/* Primary actions stay visible; reporting actions remain available below. */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Add Teacher Button */}
          <button
            type="button"
            onClick={() => setIsAddTeacherOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل أستاذ جديد</span>
          </button>

          {/* Quick Add Section Button */}
          {onOpenSectionModal && (
            <button
              type="button"
              onClick={onOpenSectionModal}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#C98A3C] hover:bg-[#B37830] text-[#1E362D] font-bold text-sm shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قسم جديد</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowHeaderActions((value) => !value)}
            aria-expanded={showHeaderActions}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#1F2926] font-bold text-sm border border-[#D9CEB0] transition-colors cursor-pointer"
            title="إجراءات إضافية"
          >
            <MoreHorizontal className="w-4 h-4 text-[#1A4E47]" />
            <span>إجراءات إضافية</span>
          </button>

          {showHeaderActions && (
            <div className="basis-full flex flex-wrap items-center gap-2 justify-end pt-1">
              {onOpenApprovalsModal && (
                <button
                  type="button"
                  onClick={onOpenApprovalsModal}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#1F2926] font-bold text-xs border border-[#D9CEB0] transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-[#1A4E47]" />
                  <span>طلبات الإسناد والموافقات</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handlePrint('violations')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-900 font-bold text-xs border border-red-200 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-red-700" />
                <span>طباعة المخالفات</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrint('absences')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-700" />
                <span>طباعة الغيابات</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F8B4B4] text-[#9B1C1C] text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-xs hover:underline cursor-pointer">إغلاق</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-[#F3FAF7] border border-[#84E1BC] text-[#0E7090] text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#0E9F6E]" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-xs hover:underline cursor-pointer">إغلاق</button>
        </div>
      )}

      {/* 2. Top Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>هيئة التدريس</span>
            <Users className="w-4 h-4 text-[#2D5A27]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#2A2118]">
            {teachers.length}
          </div>
          <div className="text-xs text-[#7A6B58] mt-1">
            أستاذ(ة) مسجل(ة)
          </div>
        </div>

        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>إجمالي الأقسام</span>
            <Layers className="w-4 h-4 text-[#C98A3C]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#2A2118]">
            {sections.length}
          </div>
          <div className="text-xs text-[#7A6B58] mt-1">
            قسم بالمؤسسة
          </div>
        </div>

        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>مجموع التلاميذ</span>
            <GraduationCap className="w-4 h-4 text-[#2A2118]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#2A2118]">
            {isLoading && !analytics ? (
              <span className="text-sm font-sans text-[#7A6B58]">جاري التحميل...</span>
            ) : (
              analytics?.summary?.totalStudents ?? (analytics?.allStudents?.length || 0)
            )}
          </div>
          <div className="text-xs text-[#7A6B58] mt-1">
            تلميذ(ة) في اللوائح
          </div>
        </div>

        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>سجل المخالفات</span>
            <AlertTriangle className="w-4 h-4 text-[#A8443A]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#A8443A]">
            {isLoading && !analytics ? (
              <span className="text-sm font-sans text-[#7A6B58]">جاري التحميل...</span>
            ) : (
              analytics?.summary?.totalViolations ?? 0
            )}
          </div>
          <div className="text-xs text-[#7A6B58] mt-1">
            ملاحظة ومخالفة مسجلة
          </div>
        </div>

        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>حالات الغياب</span>
            <UserX className="w-4 h-4 text-[#8A5A18]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-serif text-[#8A5A18]">
            {isLoading && !analytics ? (
              <span className="text-sm font-sans text-[#7A6B58]">جاري التحميل...</span>
            ) : (
              analytics?.summary?.totalAbsences ?? 0
            )}
          </div>
          <div className="text-xs text-[#7A6B58] mt-1">
            تسجيل غياب مرصود
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { setActiveTab('students'); setInspectSectionId(null); }}
          className="text-right bg-white border border-[#E4DBC0] rounded-xl p-3.5 hover:border-[#1A4E47] transition-colors cursor-pointer"
        >
          <div className="text-[11px] font-bold text-[#7A6B58]">نسبة امتلاء المقاعد</div>
          <div className="flex items-end justify-between gap-3 mt-1">
            <strong className="text-xl font-serif text-[#1A4E47]">{directorQuickStats.occupancy}%</strong>
            <span className="text-[11px] text-[#7A6B58]">{directorQuickStats.registeredStudents} من {sections.length * 40}</span>
          </div>
          <div className="h-1.5 bg-[#EFE9D5] rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-[#1A4E47] rounded-full" style={{ width: `${Math.min(directorQuickStats.occupancy, 100)}%` }} />
          </div>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('teachers'); setInspectSectionId(null); }}
          className="text-right bg-white border border-[#E4DBC0] rounded-xl p-3.5 hover:border-[#1A4E47] transition-colors cursor-pointer"
        >
          <div className="text-[11px] font-bold text-[#7A6B58]">الحسابات النشطة</div>
          <div className="mt-1 text-xl font-serif text-[#1A4E47]">{directorQuickStats.activeTeachers} <span className="text-xs font-sans text-[#7A6B58]">من {teachers.length}</span></div>
          <div className="text-[11px] text-[#7A6B58] mt-1">اضغط لفتح إدارة هيئة التدريس</div>
        </button>
      </div>

      {/* 3. Segmented Navigation Tabs */}
      <div className="bg-[#EFE9D5] p-1.5 rounded-xl border border-[#D9CEB0] flex flex-wrap gap-1">
        {/* Academic Years Tab */}
        <button
          type="button"
          id="director-tab-academic-years"
          onClick={() => { setActiveTab('academic-years'); setInspectSectionId(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'academic-years' && !inspectSectionId
              ? 'bg-[#1A4E47] text-white shadow-xs'
              : 'text-[#5B5040] hover:text-[#2A2118] hover:bg-[rgba(42,33,24,0.06)]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>تدبير المواسم الدراسية</span>
          <span className="px-1.5 py-0.2 rounded-full text-xs bg-emerald-900/60 text-emerald-200 border border-emerald-400/30 font-mono">
            {settings.year || '2026/2027'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('teachers'); setInspectSectionId(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'teachers' && !inspectSectionId
              ? 'bg-[#2A2118] text-[#F4EFDE] shadow-xs'
              : 'text-[#5B5040] hover:text-[#2A2118] hover:bg-[rgba(42,33,24,0.06)]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>لائحة الأساتذة وإدارتهم</span>
          <span className="px-1.5 py-0.2 rounded-full text-xs bg-[rgba(255,255,255,0.2)]">
            {teachers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('violations'); setInspectSectionId(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'violations' && !inspectSectionId
              ? 'bg-[#A8443A] text-white shadow-xs'
              : 'text-[#5B5040] hover:text-[#2A2118] hover:bg-[rgba(42,33,24,0.06)]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>أكثر 10 تلاميذ مخالفات</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('absences'); setInspectSectionId(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'absences' && !inspectSectionId
              ? 'bg-[#8A5A18] text-white shadow-xs'
              : 'text-[#5B5040] hover:text-[#2A2118] hover:bg-[rgba(42,33,24,0.06)]'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>أكثر 10 تلاميذ غياباً</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('students'); setInspectSectionId(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'students' && !inspectSectionId
              ? 'bg-[#2A2118] text-[#F4EFDE] shadow-xs'
              : 'text-[#5B5040] hover:text-[#2A2118] hover:bg-[rgba(42,33,24,0.06)]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>لائحة بأسماء التلاميذ وأرقامهم</span>
          <span className="px-1.5 py-0.2 rounded-full text-xs bg-[rgba(255,255,255,0.2)] font-mono font-bold">
            {analytics?.allStudents ? analytics.allStudents.length : (analytics?.summary?.totalStudents ?? 0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('sections'); setInspectSectionId(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'sections' && !inspectSectionId
              ? 'bg-[#2A2118] text-[#F4EFDE] shadow-xs'
              : 'text-[#5B5040] hover:text-[#2A2118] hover:bg-[rgba(42,33,24,0.06)]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>الأقسام والمستويات</span>
          <span className="px-1.5 py-0.2 rounded-full text-xs bg-[rgba(255,255,255,0.2)]">
            {sections.length}
          </span>
        </button>

        {/* Daily Archive Tab */}
        <button
          type="button"
          id="director-tab-daily-archive"
          onClick={() => { setActiveTab('daily-archive'); setInspectSectionId(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'daily-archive' && !inspectSectionId
              ? 'bg-[#B45309] text-white shadow-xs'
              : 'text-[#5B5040] hover:text-[#2A2118] hover:bg-[rgba(42,33,24,0.06)]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>الأرشيف اليومي (غيابات ومخالفات)</span>
        </button>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB: ACADEMIC YEARS MANAGEMENT */}
      {activeTab === 'academic-years' && !inspectSectionId && (
        <div className="space-y-4">
          <AcademicYearsManagement
            currentUser={currentUser}
            currentAcademicYear={settings.year || '2026/2027'}
            onYearChanged={onYearChanged}
          />
        </div>
      )}

      {/* TAB 1: TEACHERS MANAGEMENT */}
      {activeTab === 'teachers' && !inspectSectionId && (
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4DBC0] pb-4">
            <div>
              <h2 className="text-xl font-bold font-serif text-[#2A2118]">
                لائحة هيئة التدريس وإدارتهم
              </h2>
              <p className="text-xs text-[#7A6B58] mt-0.5">
                متابعة حسابات الأساتذة، المواد المسندة، حالة الحساب، والتحكم الفوري في التفعيل وكلمات المرور.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIsExcelImportOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#2D5A27] hover:bg-[#23471E] text-white font-bold text-xs shadow-xs cursor-pointer"
                title="إضافة أساتذة المادة وتخصصاتهم عبر استصدار أو استيراد ملف Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>📊 استصدار واستيراد أساتذة عبر Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddTeacherOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#2A2118] border border-[#D9CEB0] font-bold text-xs shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-[#2D5A27]" />
                <span>＋ إنشاء حساب فردي</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-[#7A6B58]">
              جاري تحميل بيانات هيئة التدريس...
            </div>
          ) : teachers.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#7A6B58]">
              لا يوجد أي أساتذة مسجلين حتى الآن. استخدم زر "إنشاء حساب أستاذ جديد" لإضافة أستاذ.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EFE9D5] text-[#2A2118] border-b border-[#D9CEB0]">
                    <th className="p-3 font-bold">الأستاذ(ة)</th>
                    <th className="p-3 font-bold">اسم المستخدم / البريد</th>
                    <th className="p-3 font-bold">المادة الدراسية</th>
                    <th className="p-3 font-bold">الأقسام المسندة</th>
                    <th className="p-3 font-bold">الحالة</th>
                    <th className="p-3 font-bold">تاريخ التسجيل</th>
                    <th className="p-3 font-bold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DBC0]">
                  {teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-[#F4EFDE] transition-colors">
                      <td className="p-3 font-bold text-sm text-[#2A2118]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#E8DEC0] flex items-center justify-center font-bold text-xs text-[#2A2118]">
                            {t.fullName.charAt(0)}
                          </div>
                          <span>{t.fullName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-[#5B5040]">
                        <div className="font-mono text-xs text-[#2A2118]">{t.username}</div>
                        <div className="text-[11px] text-[#7A6B58] flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span>{t.email}</span>
                          {t.emailVerified ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200" title="تم التحقق من ملكية البريد الإلكتروني">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              بريد مؤكد
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleManualVerifyEmail(t)}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                              title="انقر لتأكيد البريد الإلكتروني يدوياً واستثنائياً من الإدارة"
                            >
                              <Clock className="w-2.5 h-2.5 text-amber-600" />
                              تأكيد البريد يدوياً
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.8 rounded-md bg-[#E8DEC0] font-bold text-[#2A2118]">
                          {t.subject || 'عام'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#2A2118]">
                        {t.assignedSectionsCount} قسم
                      </td>
                      <td className="p-3">
                        {t.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#DEF7EC] text-[#03543F]">
                            <CheckCircle2 className="w-3 h-3" /> نشط ومفعل
                          </span>
                        ) : t.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF08A] text-[#713F12]">
                            <Clock className="w-3 h-3" /> قيد المراجعة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FDE8E8] text-[#9B1C1C]">
                            <XCircle className="w-3 h-3" /> معطل
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[#7A6B58] font-mono text-[11px]">
                        {t.createdAt ? t.createdAt.slice(0, 10) : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Toggle Status */}
                          {t.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => handleToggleTeacherStatus(t, 'active')}
                              disabled={actionTeacherId === t.id}
                              className="px-2.5 py-1 rounded-md bg-[#057A55] text-white hover:bg-[#046C4E] font-bold text-[11px] cursor-pointer"
                              title="قبول وتفعيل حساب الأستاذ"
                            >
                              موافقة وتفعيل
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleTeacherStatus(t, t.status === 'active' ? 'inactive' : 'active')}
                              disabled={actionTeacherId === t.id}
                              className={`px-2 py-1 rounded-md font-bold text-[11px] cursor-pointer border ${
                                t.status === 'active'
                                  ? 'border-[#E4DBC0] text-[#7A6B58] hover:bg-[#FDE8E8] hover:text-[#9B1C1C]'
                                  : 'bg-[#DEF7EC] text-[#03543F] border-[#BCF0DA]'
                              }`}
                              title={t.status === 'active' ? 'تعطيل الحساب مؤقتاً' : 'إعادة تفعيل الحساب'}
                            >
                              {t.status === 'active' ? 'تعطيل' : 'تفعيل'}
                            </button>
                          )}

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => {
                              setResettingTeacher(t);
                              setNewTeacherPassword('');
                            }}
                            className="p-1.5 rounded-md hover:bg-[#E8DEC0] text-[#5B5040] hover:text-[#2A2118] cursor-pointer"
                            title="تغيير كلمة المرور"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Teacher */}
                          <button
                            type="button"
                            onClick={() => handleDeleteTeacher(t)}
                            disabled={actionTeacherId === t.id}
                            className="p-1.5 rounded-md hover:bg-[#FDE8E8] text-[#7A6B58] hover:text-[#9B1C1C] cursor-pointer"
                            title="حذف حساب الأستاذ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* TAB 2: TOP 10 VIOLATIONS */}
      {activeTab === 'violations' && !inspectSectionId && (
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4DBC0] pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDE8E8] text-[#9B1C1C] mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>الرصد التأديبي والمخالفات</span>
              </div>
              <h2 className="text-xl font-bold font-serif text-[#2A2118]">
                {violationsSubTab === 'top10' ? 'قائمة أكثر 10 تلاميذ ارتكاباً للمخالفات' : 'إدارة قائمة المخالفات المحددة مسبقاً'}
              </h2>
              <p className="text-xs text-[#7A6B58] mt-0.5">
                {violationsSubTab === 'top10'
                  ? 'ترتيب التلاميذ الأكثر تسجيلاً للمخالفات في جميع الأقسام لإجراء المتابعة الإدارية والتأطيرية.'
                  : 'تخصيص وضبط قائمة المخالفات المعتمدة الجاهزة التي يختار منها الأستاذ في ملف كل تلميذ.'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <div className="flex items-center bg-[#EFE9D5] p-1 rounded-xl border border-[#D9CEB0]">
                <button
                  type="button"
                  onClick={() => setViolationsSubTab('top10')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    violationsSubTab === 'top10'
                      ? 'bg-[#1A4E47] text-white shadow-xs'
                      : 'text-[#5B5040] hover:text-[#2A2118]'
                  }`}
                >
                  أكثر 10 مخالفات
                </button>
                <button
                  type="button"
                  onClick={() => setViolationsSubTab('manage-types')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    violationsSubTab === 'manage-types'
                      ? 'bg-[#1A4E47] text-white shadow-xs'
                      : 'text-[#5B5040] hover:text-[#2A2118]'
                  }`}
                >
                  إدارة أنواع المخالفات
                </button>
              </div>

              {violationsSubTab === 'top10' && (
                <button
                  type="button"
                  onClick={() => handlePrint('violations')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-900 font-bold text-xs border border-red-200 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-red-700" />
                  <span>طباعة لائحة وسجل المخالفات</span>
                </button>
              )}
            </div>
          </div>

          {violationsSubTab === 'manage-types' ? (
            <ViolationTypesManagement currentUser={currentUser} />
          ) : !analytics?.topViolations || analytics.topViolations.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#7A6B58] bg-[#F4EFDE] rounded-xl border border-dashed border-[#D9CEB0]">
              لم تُسجل أي مخالفات على التلاميذ حتى الآن. السجل سليم تماماً!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EFE9D5] text-[#2A2118] border-b border-[#D9CEB0]">
                    <th className="p-3 font-bold text-center w-12">الرتبة</th>
                    <th className="p-3 font-bold">اسم التلميذ(ة)</th>
                    <th className="p-3 font-bold">رقم التلميذ (مسار)</th>
                    <th className="p-3 font-bold">القسم والمستوى</th>
                    <th className="p-3 font-bold">الأستاذ المسؤول / المادة</th>
                    <th className="p-3 font-bold text-center">عدد المخالفات</th>
                    <th className="p-3 font-bold">آخر مخالفة مسجلة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DBC0]">
                  {analytics.topViolations.map((v, idx) => (
                    <tr key={`${v.sectionId}-${v.seatNum}`} className="hover:bg-[#F4EFDE] transition-colors">
                      <td className="p-3 text-center font-bold">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-[#A8443A] text-white' : idx === 1 ? 'bg-[#C98A3C] text-white' : idx === 2 ? 'bg-[#E8DEC0] text-[#2A2118]' : 'bg-[rgba(42,33,24,0.06)] text-[#5B5040]'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-sm text-[#2A2118]">
                        {v.studentName}
                      </td>
                      <td className="p-3 font-mono text-xs text-[#5B5040]">
                        {v.massarNumber ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#E8DEC0] font-bold text-[#1A4E47]">
                            {v.massarNumber}
                          </span>
                        ) : v.studentNumber ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#E8DEC0]">
                            N° {v.studentNumber}
                          </span>
                        ) : (
                          `المقعد ${v.seatNum}`
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[#2A2118]">{v.sectionLevel}</span>
                        <span className="text-[#7A6B58] text-[11px] block">({v.sectionClass})</span>
                      </td>
                      <td className="p-3 text-[#5B5040]">
                        <div>{v.teacherName}</div>
                        <div className="text-[11px] text-[#7A6B58]">{v.teacherSubject}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-1 rounded-full font-bold text-xs bg-[#FDE8E8] text-[#9B1C1C]">
                          {v.violationsCount} مخالفات
                        </span>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="text-xs text-[#2A2118] line-clamp-2">
                          {v.lastViolationText || '—'}
                        </div>
                        {v.lastViolationDate && (
                          <div className="text-[10px] text-[#7A6B58] mt-0.5 font-mono">
                            بتاريخ: {v.lastViolationDate}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TOP 10 ABSENCES */}
      {activeTab === 'absences' && !inspectSectionId && (
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4DBC0] pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF08A] text-[#713F12] mb-1">
                <UserX className="w-3.5 h-3.5" />
                <span>رصد المواظبة والغياب</span>
              </div>
              <h2 className="text-xl font-bold font-serif text-[#2A2118]">
                قائمة أكثر 10 تلاميذ تسجيلاً للغياب
              </h2>
              <p className="text-xs text-[#7A6B58] mt-0.5">
                حصر التلاميذ الأكثر تغيباً عن الحصص الدراسية لاتخاذ التدابير الإدارية والتواصل مع أولياء الأمور.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handlePrint('absences')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Printer className="w-3.5 h-3.5 text-amber-700" />
              <span>طباعة لائحة وسجل الغياب</span>
            </button>
          </div>

          {!analytics?.topAbsences || analytics.topAbsences.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#7A6B58] bg-[#F4EFDE] rounded-xl border border-dashed border-[#D9CEB0]">
              لم يتم رصد أي حالات غياب حتى الآن. الحضور كامل وممتاز!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EFE9D5] text-[#2A2118] border-b border-[#D9CEB0]">
                    <th className="p-3 font-bold text-center w-12">الرتبة</th>
                    <th className="p-3 font-bold">اسم التلميذ(ة)</th>
                    <th className="p-3 font-bold">رقم التلميذ (مسار)</th>
                    <th className="p-3 font-bold">القسم والمستوى</th>
                    <th className="p-3 font-bold">الأستاذ المسؤول / المادة</th>
                    <th className="p-3 font-bold text-center">مجموع الغيابات</th>
                    <th className="p-3 font-bold">الحالة اللحظية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DBC0]">
                  {analytics.topAbsences.map((ab, idx) => (
                    <tr key={`${ab.sectionId}-${ab.seatNum}`} className="hover:bg-[#F4EFDE] transition-colors">
                      <td className="p-3 text-center font-bold">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-[#8A5A18] text-white' : idx === 1 ? 'bg-[#C98A3C] text-white' : idx === 2 ? 'bg-[#E8DEC0] text-[#2A2118]' : 'bg-[rgba(42,33,24,0.06)] text-[#5B5040]'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-sm text-[#2A2118]">
                        {ab.studentName}
                      </td>
                      <td className="p-3 font-mono text-xs text-[#5B5040]">
                        {ab.massarNumber ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#E8DEC0] font-bold text-[#1A4E47]">
                            {ab.massarNumber}
                          </span>
                        ) : ab.studentNumber ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#E8DEC0]">
                            N° {ab.studentNumber}
                          </span>
                        ) : (
                          `المقعد ${ab.seatNum}`
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[#2A2118]">{ab.sectionLevel}</span>
                        <span className="text-[#7A6B58] text-[11px] block">({ab.sectionClass})</span>
                      </td>
                      <td className="p-3 text-[#5B5040]">
                        <div>{ab.teacherName}</div>
                        <div className="text-[11px] text-[#7A6B58]">{ab.teacherSubject}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-3 py-1 rounded-full font-bold text-xs bg-[#FEF08A] text-[#713F12]">
                          {ab.absencesCount} غياب
                        </span>
                      </td>
                      <td className="p-3">
                        {ab.currentAttendance === 'absent' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FDE8E8] text-[#9B1C1C]">
                            ✕ غائب اليوم
                          </span>
                        ) : ab.currentAttendance === 'late' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF08A] text-[#713F12]">
                            ⏳ متأخر
                          </span>
                        ) : (
                          <span className="text-[#7A6B58] text-xs">
                            مسجل مسبقاً
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MASTER STUDENT DIRECTORY (NAMES & NUMBERS) */}
      {activeTab === 'students' && !inspectSectionId && (
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E4DBC0] pb-4">
            <div>
              <h2 className="text-xl font-bold font-serif text-[#2A2118]">
                لائحة شاملة بأسماء التلاميذ وأرقامهم
              </h2>
              <p className="text-xs text-[#7A6B58] mt-0.5">
                سجل متكامل وموحد لجميع تلاميذ المؤسسة مصنفاً حسب الأقسام والمستويات مع أرقامهم الترتيبية وبياناتهم.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrint('absences')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[rgba(42,33,24,0.06)] hover:bg-[rgba(42,33,24,0.12)] text-[#2A2118] font-bold text-xs border border-[#D9CEB0] transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة اللائحة الرسمية</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#7A6B58]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم التلميذ أو رقمه الترتيبي..."
                className="w-full pl-3 pr-9 py-2 rounded-xl bg-white border border-[#D9CEB0] text-xs focus:outline-hidden focus:border-[#C98A3C]"
              />
            </div>

            {/* Level Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-[#7A6B58]" />
              <select
                value={selectedLevelFilter}
                onChange={(e) => handleLevelFilterChange(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-white border border-[#D9CEB0] text-xs focus:outline-hidden focus:border-[#C98A3C]"
              >
                <option value="all">كافة المستويات الدراسية</option>
                {distinctLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter (Only sections belonging to the selected level are shown) */}
            <div>
              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-white border border-[#D9CEB0] text-xs focus:outline-hidden focus:border-[#C98A3C]"
              >
                <option value="all">
                  {selectedLevelFilter === 'all'
                    ? `كافة الأقسام (${sections.length} قسم)`
                    : `كافة أقسام ${selectedLevelFilter} (${availableSectionsForSelectedLevel.length} قسم)`}
                </option>
                {availableSectionsForSelectedLevel.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.level} ({sec.classNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Students Table */}
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#7A6B58] bg-[#F4EFDE] rounded-xl border border-dashed border-[#D9CEB0]">
              لم يتم العثور على تلاميذ يطابقون خيارات البحث أو الفلترة المحددة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EFE9D5] text-[#2A2118] border-b border-[#D9CEB0]">
                    <th className="p-3 font-bold w-16 text-center">الرقم</th>
                    <th className="p-3 font-bold">اسم التلميذ(ة) الكامل</th>
                    <th className="p-3 font-bold">رقم مسار / البطاقة</th>
                    <th className="p-3 font-bold">القسم والمستوى</th>
                    <th className="p-3 font-bold">الأستاذ المسؤول والمادة</th>
                    <th className="p-3 font-bold text-center">المخالفات</th>
                    <th className="p-3 font-bold text-center">الغيابات</th>
                    <th className="p-3 font-bold text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DBC0]">
                  {filteredStudents.map((st, i) => (
                    <tr key={`${st.sectionId}-${st.seatNum}`} className="hover:bg-[#F4EFDE] transition-colors">
                      <td className="p-3 font-mono font-bold text-center text-[#2A2118]">
                        {st.studentNumber ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#E8DEC0]">
                            {st.studentNumber}
                          </span>
                        ) : (
                          <span className="text-[#7A6B58]">
                            #{st.seatNum}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-sm text-[#2A2118]">
                        {st.studentName}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {st.massarNumber ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#E8DEC0] font-bold text-[#1A4E47]">
                            {st.massarNumber}
                          </span>
                        ) : (
                          <span className="text-[#7A6B58]">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[#2A2118]">{st.sectionLevel}</span>
                        <span className="text-[#7A6B58] text-[11px] block">({st.sectionClass})</span>
                      </td>
                      <td className="p-3 text-[#5B5040]">
                        <div>{st.teacherName}</div>
                        <div className="text-[11px] text-[#7A6B58]">{st.teacherSubject}</div>
                      </td>
                      <td className="p-3 text-center">
                        {st.violationsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[11px] bg-[#FDE8E8] text-[#9B1C1C]">
                            {st.violationsCount}
                          </span>
                        ) : (
                          <span className="text-[#7A6B58]">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {st.absencesCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[11px] bg-[#FEF08A] text-[#713F12]">
                            {st.absencesCount}
                          </span>
                        ) : (
                          <span className="text-[#7A6B58]">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {st.currentAttendance === 'present' ? (
                          <span className="text-[#03543F] font-bold text-[11px]">✓ حاضر</span>
                        ) : st.currentAttendance === 'absent' ? (
                          <span className="text-[#9B1C1C] font-bold text-[11px]">✕ غائب</span>
                        ) : st.currentAttendance === 'late' ? (
                          <span className="text-[#713F12] font-bold text-[11px]">⏳ متأخر</span>
                        ) : (
                          <span className="text-[#7A6B58] text-[11px]">مسجل</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-[#7A6B58] pt-2 border-t border-[#E4DBC0]">
            <span>إجمالي التلاميذ المعروضين: <strong className="text-[#2A2118]">{filteredStudents.length}</strong> من أصل <strong className="text-[#2A2118]">{analytics?.allStudents?.length || analytics?.summary?.totalStudents || 0}</strong> تلميذ(ة)</span>
            <span>الثانوية الإعدادية ايكسان</span>
          </div>
        </div>
      )}

      {/* TAB 5: SECTIONS OVERVIEW (WITHOUT SEATING DESKS) */}
      {activeTab === 'sections' && !inspectSectionId && (
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4DBC0] pb-4">
            <div>
              <h2 className="text-xl font-bold font-serif text-[#2A2118]">
                الأقسام والمستويات الدراسية بالمؤسسة
              </h2>
              <p className="text-xs text-[#7A6B58] mt-0.5">
                استعراض الأقسام، الأساتذة المسندين لكل مادة، عدد التلاميذ، والوصول المباشر للائحة القسم.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenSectionModal && (
                <button
                  type="button"
                  onClick={onOpenSectionModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2A2118] hover:bg-[#403326] text-[#F4EFDE] font-bold text-xs shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة قسم جديد</span>
                </button>
              )}

              {onOpenBatchImportModal && (
                <button
                  type="button"
                  onClick={onOpenBatchImportModal}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[rgba(42,33,24,0.06)] hover:bg-[rgba(42,33,24,0.12)] text-[#2A2118] font-bold text-xs border border-[#D9CEB0] cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>استيراد جماعي (Excel)</span>
                </button>
              )}

              {sections.length > 0 && (
                <button
                  type="button"
                  id="director-delete-all-sections-btn"
                  onClick={() => setShowDeleteAllModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/20 hover:bg-rose-950/30 text-rose-800 font-bold text-xs border border-rose-300 cursor-pointer transition-colors"
                  title="حذف جميع الأقسام نهائياً من قاعدة البيانات"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                  <span>حذف جميع الأقسام</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((sec) => {
              const filledStudents = sec.seats.filter((s) => s.name && s.name.trim()).length;
              const absentCount = sec.seats.filter((s) => s.attendance === 'absent').length;
              const notesCount = sec.seats.reduce((acc, s) => acc + (s.notes?.length || 0), 0);

              return (
                <div
                  key={sec.id}
                  className="bg-[#F4EFDE] border border-[#E4DBC0] rounded-xl p-4 shadow-xs hover:border-[#C98A3C] transition-all flex flex-col justify-between space-y-3 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#E8DEC0] text-[#2A2118]">
                        {sec.level}
                      </span>
                      <h3 className="text-lg font-bold font-serif text-[#2A2118] mt-1">
                        {sec.classNumber}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenAddStudent(sec)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#EFE9D5] hover:bg-[#E4DBC0] text-[#1A4E47] font-bold text-xs flex items-center gap-1 cursor-pointer border border-[#D9CEB0] transition-colors"
                        title="إضافة تلميذ جديد في آخر ترتيب هذا القسم"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ تلميذ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInspectSectionId(sec.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#2A2118] hover:bg-[#403326] text-[#F4EFDE] font-bold text-xs flex items-center gap-1 cursor-pointer"
                        title="عرض لائحة تلاميذ القسم دون المقاعد"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>لائحة التلاميذ</span>
                      </button>

                      <button
                        type="button"
                        id={`delete-section-btn-${sec.id}`}
                        onClick={() => setSectionToDelete(sec)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs flex items-center gap-1 cursor-pointer border border-rose-200 transition-colors"
                        title="حذف هذا القسم نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف القسم</span>
                      </button>
                    </div>
                  </div>

                  {/* Section Stats */}
                  <div className="grid grid-cols-3 gap-2 bg-[#EFE9D5] p-2.5 rounded-lg text-center text-xs">
                    <div>
                      <div className="text-[10px] text-[#7A6B58]">المسجلون</div>
                      <div className="font-bold text-[#2A2118]">{filledStudents}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#7A6B58]">الغياب</div>
                      <div className="font-bold text-[#8A5A18]">{absentCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#7A6B58]">الملاحظات</div>
                      <div className="font-bold text-[#A8443A]">{notesCount}</div>
                    </div>
                  </div>

                  {/* Assigned Teachers list */}
                  <div className="text-xs space-y-1">
                    <span className="text-[11px] font-bold text-[#7A6B58]">الأساتذة المسندون للقسم:</span>
                    {sec.assignedTeachers && sec.assignedTeachers.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sec.assignedTeachers.map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-white border border-[#D9CEB0] text-[#2A2118]"
                          >
                            <strong>{t.subject}:</strong> {t.teacherName}
                          </span>
                        ))}
                      </div>
                    ) : sec.teacher ? (
                      <div className="text-xs text-[#2A2118]">{sec.teacher}</div>
                    ) : (
                      <div className="text-xs text-[#7A6B58] italic">لم يُسند أستاذ بعد</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INSPECT SECTION STUDENTS TABLE (When clicked from sections list, WITHOUT DESK GRID) */}
      {inspectSectionId && activeInspectSection && (
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl p-5 shadow-xs space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4DBC0] pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setInspectSectionId(null)}
                  className="text-xs font-bold text-[#8A5A18] hover:underline cursor-pointer"
                >
                  ← العودة لقائمة الأقسام
                </button>
                <span className="text-xs text-[#7A6B58]">/</span>
                <span className="text-xs font-bold text-[#2A2118]">
                  لائحة تلاميذ القسم
                </span>
              </div>
              <h2 className="text-xl font-bold font-serif text-[#2A2118]">
                {activeInspectSection.level} — {activeInspectSection.classNumber}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenAddStudent(activeInspectSection)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>إضافة تلميذ في آخر الترتيب</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrint('violations')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[rgba(42,33,24,0.06)] hover:bg-[rgba(42,33,24,0.12)] text-[#2A2118] font-bold text-xs border border-[#D9CEB0] cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة لائحة القسم</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectSectionId(null)}
                className="px-3 py-2 rounded-xl bg-[#E8DEC0] hover:bg-[#D9CEB0] text-[#2A2118] font-bold text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#EFE9D5] text-[#2A2118] border-b border-[#D9CEB0]">
                  <th className="p-3 font-bold w-16 text-center">الرقم</th>
                  <th className="p-3 font-bold">اسم التلميذ(ة) الكامل</th>
                  <th className="p-3 font-bold">رقم مسار / البطاقة</th>
                  <th className="p-3 font-bold text-center">حالة الحضور</th>
                  <th className="p-3 font-bold text-center">عدد الملاحظات</th>
                  <th className="p-3 font-bold">نصوص الملاحظات المسجلة</th>
                  <th className="p-3 font-bold text-center">إجراء المدير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DBC0]">
                {activeInspectSection.seats
                  .filter((s) => s.name && s.name.trim())
                  .map((st) => (
                    <tr key={st.seat} className="hover:bg-[#F4EFDE] transition-colors">
                      <td className="p-3 font-mono font-bold text-center text-[#2A2118]">
                        <span className="px-2 py-0.5 rounded-md bg-[#E8DEC0]">
                          {st.number || st.seat}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-sm text-[#2A2118]">
                        {st.name}
                      </td>
                      <td className="p-3 font-mono text-xs text-[#5B5040]">
                        {st.massarNumber ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#E8DEC0] font-bold text-[#1A4E47]">
                            {st.massarNumber}
                          </span>
                        ) : (
                          <span className="text-[#7A6B58]">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {st.attendance === 'present' ? (
                          <span className="text-[#03543F] font-bold">✓ حاضر</span>
                        ) : st.attendance === 'absent' ? (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-[#FDE8E8] text-[#9B1C1C]">
                            ✕ غائب
                          </span>
                        ) : st.attendance === 'late' ? (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-[#FEF08A] text-[#713F12]">
                            ⏳ متأخر
                          </span>
                        ) : (
                          <span className="text-[#7A6B58]">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold">
                        {st.notes && st.notes.length > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#FDE8E8] text-[#9B1C1C]">
                            {st.notes.length}
                          </span>
                        ) : (
                          <span className="text-[#7A6B58]">0</span>
                        )}
                      </td>
                      <td className="p-3 max-w-sm">
                        {st.notes && st.notes.length > 0 ? (
                          <ul className="space-y-1">
                            {st.notes.map((n) => (
                              <li key={n.id} className="text-[11px] text-[#2A2118] bg-[#EFE9D5] p-1.5 rounded-md">
                                <span className="font-mono text-[#7A6B58] text-[10px] ml-1">{n.date}:</span>
                                <span>{n.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[#7A6B58] text-[11px]">لا توجد ملاحظات</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setStudentToRemove({
                              sectionId: activeInspectSection.id,
                              sectionName: `${activeInspectSection.level} - ${activeInspectSection.classNumber}`,
                              seatNum: st.seat,
                              studentName: st.name,
                              studentNumber: st.number
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer"
                          title="شطب التلميذ من القسم بسبب انتقال أو انقطاع"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>إزالة (انتقال/انقطاع)</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4.7 DAILY ARCHIVE TAB (أرشيف الغيابات والمخالفات اليومي) */}
      {activeTab === 'daily-archive' && !inspectSectionId && (
        <div className="animate-in fade-in duration-150">
          <DailyArchiveModal
            isOpen={true}
            onClose={() => {}}
            currentUser={currentUser}
            sections={sections}
            embedded={true}
          />
        </div>
      )}

      {/* MODAL: DIRECT QUICK TEACHER CREATION */}
      {isAddTeacherOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddTeacherOpen(false);
          }}
        >
          <div className="bg-[#F4EFDE] text-[#2A2118] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-[#E4DBC0]">
            <div className="p-5 border-b border-[#E4DBC0] bg-[#EFE9D5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#2D5A27] text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-serif text-[#2A2118]">
                    إنشاء حساب أستاذ جديد
                  </h3>
                  <p className="text-xs text-[#7A6B58]">
                    إضافة عضو جديد في هيئة التدريس وتفعيل حسابه مباشرة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTeacherOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5B5040] hover:bg-[rgba(42,33,24,0.1)] cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="p-5 space-y-3.5">
              {teacherCreateError && (
                <div className="p-3 rounded-lg bg-[#FDE8E8] border border-[#F8B4B4] text-[#9B1C1C] text-xs">
                  {teacherCreateError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#2A2118] mb-1">
                  الاسم الكامل للأستاذ(ة) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ذ. محمد العلوي"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9CEB0] text-xs focus:outline-hidden focus:border-[#2D5A27]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2A2118] mb-1">
                    اسم المستخدم (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="alaoui_math"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9CEB0] text-xs font-mono focus:outline-hidden focus:border-[#2D5A27]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2A2118] mb-1">
                    المادة الدراسية *
                  </label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value as TeacherSubject)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9CEB0] text-xs focus:outline-hidden focus:border-[#2D5A27]"
                  >
                    {TEACHER_SUBJECTS.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2A2118] mb-1">
                  البريد الإلكتروني *
                </label>
                <input
                  type="email"
                  required
                  placeholder="prof.alaoui@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9CEB0] text-xs focus:outline-hidden focus:border-[#2D5A27]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2A2118] mb-1">
                    كلمة المرور *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9CEB0] text-xs font-mono focus:outline-hidden focus:border-[#2D5A27]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2A2118] mb-1">
                    تأكيد كلمة المرور *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9CEB0] text-xs font-mono focus:outline-hidden focus:border-[#2D5A27]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#EFE9D5] rounded-xl text-[11px] text-[#5B5040] space-y-1">
                <div>الموسم الدراسي: <strong>{settings.year || '2025/2026'}</strong> (معمم من طرف المدير)</div>
                <div>حالة الحساب: <strong className="text-[#03543F]">مفعل ونشط فوراً</strong></div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4DBC0]">
                <button
                  type="button"
                  onClick={() => setIsAddTeacherOpen(false)}
                  className="px-4 py-2 rounded-xl bg-transparent hover:bg-[rgba(42,33,24,0.06)] text-[#5B5040] font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTeacher}
                  className="px-5 py-2 rounded-xl bg-[#2D5A27] hover:bg-[#23471E] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreatingTeacher ? 'جاري الإنشاء...' : 'تأكيد وإنشاء الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCEL BATCH TEACHER IMPORT */}
      <TeacherExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onSuccess={() => {
          fetchDirectorData();
          setSuccessMessage('تم استيراد وحفظ بيانات الأساتذة بنجاح من ملف Excel.');
        }}
        existingTeachers={teachers}
        academicYear={settings.year || '2025/2026'}
      />

      {/* MODAL: RESET TEACHER PASSWORD */}
      {resettingTeacher && (
        <div
          className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResettingTeacher(null);
          }}
        >
          <div className="bg-[#F4EFDE] text-[#2A2118] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#E4DBC0]">
            <div className="p-4 border-b border-[#E4DBC0] bg-[#EFE9D5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#8A5A18]" />
                <h3 className="text-base font-bold font-serif text-[#2A2118]">
                  تغيير كلمة المرور للأستاذ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResettingTeacher(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#5B5040] hover:bg-[rgba(42,33,24,0.1)] cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-4 space-y-3">
              <div className="text-xs text-[#5B5040]">
                الأستاذ: <strong className="text-[#2A2118]">{resettingTeacher.fullName}</strong> ({resettingTeacher.email})
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2A2118] mb-1">
                  كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  required
                  placeholder="أدخل كلمة مرور جديدة"
                  value={newTeacherPassword}
                  onChange={(e) => setNewTeacherPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9CEB0] text-xs font-mono focus:outline-hidden focus:border-[#C98A3C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4DBC0]">
                <button
                  type="button"
                  onClick={() => setResettingTeacher(null)}
                  className="px-3 py-1.5 rounded-lg bg-transparent text-[#5B5040] font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-4 py-1.5 rounded-lg bg-[#2A2118] hover:bg-[#403326] text-[#F4EFDE] font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {isResettingPassword ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Single Section */}
      {sectionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSectionToDelete(null)}>
          <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#E4DBC0] bg-rose-50">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold font-serif text-rose-900">
                  تأكيد حذف القسم ({sectionToDelete.level} - {sectionToDelete.classNumber})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSectionToDelete(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-800 hover:bg-rose-100 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-[#2A2118] leading-relaxed">
                هل أنت متأكد أنك تريد حذف هذا القسم؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-normal">
                سيتم حذف القسم ومخطط مقاعده الـ 40 ولائحة التلاميذ والملاحظات المسجلة عليه نهائياً، مع الحفاظ على باقي الأقسام.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 p-4 border-t border-[#E4DBC0] bg-[#F4EFDE]">
              <button
                type="button"
                onClick={() => setSectionToDelete(null)}
                disabled={isDeletingSection}
                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-[#5B5040] font-bold text-xs border border-[#D9CEB0] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                id="director-confirm-delete-section-btn"
                disabled={isDeletingSection}
                onClick={handleDeleteSingleSectionConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingSection ? 'جاري الحذف...' : 'تأكيد الحذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Student to End of Section (Director) */}
      {isAddStudentModalOpen && targetSectionForAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setIsAddStudentModalOpen(false)}>
          <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#E4DBC0] bg-[#1A4E47] text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-300" />
                <h3 className="text-sm font-bold font-serif">
                  إضافة تلميذ في آخر ترتيب القسم
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStudentModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAddStudent} className="p-5 space-y-4">
              <div className="p-3 bg-[#EFE9D5]/60 border border-[#D9CEB0] rounded-xl text-xs text-[#5B5040] space-y-1">
                <div>القسم المستهدف: <strong className="text-[#1A4E47]">{targetSectionForAdd.level} - القسم {targetSectionForAdd.classNumber}</strong></div>
                <div>الترتيب: سيتم إدراجه تلقائياً في <strong>آخر لائحة القسم</strong> بعد التلاميذ الحاليين.</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2A2118] mb-1">
                  الاسم الكامل للتلميذ (الاسم والنسب) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: يوسف الإدريسي"
                  value={newStudentFullName}
                  onChange={(e) => setNewStudentFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9CEB0] rounded-xl text-[#2A2118] focus:outline-hidden focus:border-[#1A4E47] focus:ring-1 focus:ring-[#1A4E47]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2A2118] mb-1">
                  رقم مسار / البطاقة
                </label>
                <input
                  type="text"
                  placeholder="مثال: J135489726"
                  value={newStudentMassarNumber}
                  onChange={(e) => setNewStudentMassarNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D9CEB0] rounded-xl text-[#2A2118] font-mono focus:outline-hidden focus:border-[#1A4E47] focus:ring-1 focus:ring-[#1A4E47]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2A2118] mb-1">
                    رقم الترتيب في القسم
                  </label>
                  <input
                    type="text"
                    value={newStudentNumberVal}
                    onChange={(e) => setNewStudentNumberVal(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D9CEB0] rounded-xl text-[#2A2118] focus:outline-hidden focus:border-[#1A4E47]"
                    title="الرقم الترتيبي التلقائي في القسم"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2A2118] mb-1">
                    رقم المقعد المخصص (1-40)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={newStudentCustomSeat}
                    onChange={(e) => setNewStudentCustomSeat(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D9CEB0] rounded-xl text-[#2A2118] focus:outline-hidden focus:border-[#1A4E47]"
                    placeholder="تلقائي"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E4DBC0]">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  disabled={isAddingStudent}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-[#5B5040] font-bold text-xs border border-[#D9CEB0] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent || !newStudentFullName.trim()}
                  className="px-5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isAddingStudent ? 'جاري الإضافة...' : 'تأكيد إضافة التلميذ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Remove Student (Transfer or Dropout) */}
      {studentToRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setStudentToRemove(null)}>
          <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#E4DBC0] bg-rose-700 text-white">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-200" />
                <h3 className="text-sm font-bold font-serif">
                  شطب تلميذ من القسم (إجراء إداري)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStudentToRemove(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-950">
                <div className="text-sm font-bold text-rose-900">
                  التلميذ: {studentToRemove.studentName} {studentToRemove.studentNumber ? `(رقم: ${studentToRemove.studentNumber})` : ''}
                </div>
                <div>القسم: <strong>{studentToRemove.sectionName}</strong></div>
                <div>رقم المقعد المشغول: <strong>المقعد #{studentToRemove.seatNum}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2A2118] mb-2">
                  سبب الشطب من القسم <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                    removeReason === 'انتقال' ? 'bg-[#EFE9D5] border-[#1A4E47] text-[#1A4E47] font-bold' : 'bg-white border-[#D9CEB0] text-[#5B5040]'
                  }`}>
                    <input
                      type="radio"
                      name="removeReason"
                      value="انتقال"
                      checked={removeReason === 'انتقال'}
                      onChange={() => setRemoveReason('انتقال')}
                      className="accent-[#1A4E47]"
                    />
                    <span className="text-xs">انتقال إلى مؤسسة أخرى</span>
                  </label>

                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                    removeReason === 'انقطاع' ? 'bg-rose-100 border-rose-600 text-rose-900 font-bold' : 'bg-white border-[#D9CEB0] text-[#5B5040]'
                  }`}>
                    <input
                      type="radio"
                      name="removeReason"
                      value="انقطاع"
                      checked={removeReason === 'انقطاع'}
                      onChange={() => setRemoveReason('انقطاع')}
                      className="accent-rose-700"
                    />
                    <span className="text-xs">انقطاع عن الدراسة</span>
                  </label>
                </div>
              </div>

              <p className="text-[11px] text-[#7A6B58] leading-relaxed">
                ملاحظة: سيتم تحرير المقعد بالقسم وشطب التلميذ من اللائحة الرسمية، وتسجيل هذا الإجراء في سجل العمليات الإدارية بالمؤسسة.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E4DBC0]">
                <button
                  type="button"
                  onClick={() => setStudentToRemove(null)}
                  disabled={isRemovingStudent}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-[#5B5040] font-bold text-xs border border-[#D9CEB0] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isRemovingStudent}
                  onClick={handleConfirmRemoveStudent}
                  className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserX className="w-4 h-4" />
                  <span>{isRemovingStudent ? 'جاري الشطب...' : 'تأكيد شطب التلميذ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete All Sections */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setShowDeleteAllModal(false)}>
          <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#E4DBC0] bg-rose-100/70">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
                <h3 className="text-base font-bold font-serif text-rose-950">
                  تأكيد حذف جميع الأقسام بالمؤسسة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-800 hover:bg-rose-200/60 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm font-bold text-rose-950 leading-relaxed">
                هل أنت متأكد أنك تريد حذف جميع الأقسام؟ سيتم حذف جميع الأقسام نهائيًا ولا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed space-y-1">
                <div>• إجمالي الأقسام التي سيتم حذفها: <strong>{sections.length} قسم</strong>.</div>
                <div>• سيتم مسح جميع مخططات الجلوس، لوائح التلاميذ، والملاحظات المرتبطة بهذه الأقسام فقط.</div>
                <div>• حسابات الأساتذة، المديرين، والأرشيف العام ستبقى محفوظة دون مساس.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 p-4 border-t border-[#E4DBC0] bg-[#F4EFDE]">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeletingAll}
                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-[#5B5040] font-bold text-xs border border-[#D9CEB0] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                id="director-confirm-delete-all-sections-btn"
                disabled={isDeletingAll}
                onClick={handleDeleteAllSectionsConfirm}
                className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingAll ? 'جاري حذف جميع الأقسام...' : 'تأكيد حذف الكل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Director Batch Print Modal */}
      {printModalMode && (
        <DirectorPrintModal
          mode={printModalMode}
          sections={sections}
          settings={settings}
          violationsData={analytics?.allViolations || []}
          absencesData={analytics?.allAbsences || []}
          onClose={() => setPrintModalMode(null)}
        />
      )}

    </div>
  );
};
