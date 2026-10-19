import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Shuffle, ListOrdered, ArrowLeftRight, GripVertical, FileSpreadsheet, Download, Sparkles, Upload, ShieldCheck, ShieldAlert, Lock, User as UserIcon, LogIn, UserPlus, KeyRound, CircleCheck as CheckCircle2, Clock, Send, CircleAlert as AlertCircle, Layers, ChevronRight, Palette, Check, X, ListFilter as Filter, Users, Printer, ArrowLeft, Calendar, Settings, Trash2, Award, ArrowUpDown, BookOpen, FileCheck2, Megaphone } from 'lucide-react';
import { printNotesReport, printViolationsReport, printClassroomSeatingPlan } from './utils/printNotes';
import {
  AppSettings,
  SectionItem,
  SeatItem,
  NoteItem,
  StudentViolationRecord,
  PositiveParticipationItem,
  RosterItem,
  DbStats,
  ChangeLogItem,
  User as UserType,
  SeatStatusColor,
  SeatAttendance,
  SEAT_STATUS_LIST
} from './types';
import { BatchImportModal } from './components/BatchImportModal';
import { Topbar } from './components/Topbar';
import { AuthModal } from './components/AuthModal';
import { TeacherProfileModal } from './components/TeacherProfileModal';
import { TeacherAssignmentModal } from './components/TeacherAssignmentModal';
import { TeacherHomeworkModal } from './components/TeacherHomeworkModal';
import { TeacherLeaveModal } from './components/TeacherLeaveModal';
import { AdminApprovalsModal } from './components/AdminApprovalsModal';
import { DirectorDashboard } from './components/DirectorDashboard';
import { ViolationsModal } from './components/ViolationsModal';
import { ViolationsRegisterModal } from './components/ViolationsRegisterModal';
import { PositiveParticipationModal } from './components/PositiveParticipationModal';
import { PositiveParticipationsReportModal } from './components/PositiveParticipationsReportModal';
import { LandingView } from './components/LandingView';
import { AdminPortalView } from './components/AdminPortalView';
import { AppFooter } from './components/AppFooter';
import { SchoolActivitiesWall } from './components/SchoolActivitiesWall';
import { DailyArchiveModal } from './components/DailyArchiveModal';
import { DbInfoModal } from './components/DbInfoModal';
import { TeacherTimetable } from './components/TeacherTimetable';
import { RosterReorderModal } from './components/RosterReorderModal';
import { StudentPortalDashboard, StudentData } from './components/StudentPortalDashboard';
import { StudentLoginModal } from './components/StudentLoginModal';
import { CustomDomainModal } from './components/CustomDomainModal';

function normalizeArabicText(str?: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function matchClientStudent(
  targetName?: string,
  targetNum?: string,
  targetMassar?: string,
  recordName?: string,
  recordNum?: string,
  recordMassar?: string
): boolean {
  if (!targetName && !recordName) return false;
  const tName = normalizeArabicText(targetName);
  const rName = normalizeArabicText(recordName);
  if (!tName && !rName) return false;

  const tMassar = (targetMassar || '').trim().toUpperCase();
  const rMassar = (recordMassar || '').trim().toUpperCase();
  if (tMassar && rMassar && tMassar === rMassar) return true;

  if (tName && rName && tName === rName) return true;

  if (tName && rName && (tName.includes(rName) || rName.includes(tName))) {
    const tNum = String(targetNum || '').trim();
    const rNum = String(recordNum || '').trim();
    if (!tNum || !rNum || tNum === rNum) return true;
  }
  return false;
}

export default function App() {
  // Independent Admin Route State (/admin) (Order #1)
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const h = window.location.hash;
      const s = window.location.search;
      return p === '/admin' || h === '#/admin' || h === '#admin' || s.includes('admin');
    }
    return false;
  });

  // Authentication & User state
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    try {
      const saved = localStorage.getItem('echsa_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTeacherAssignmentModal, setShowTeacherAssignmentModal] = useState(false);
  const [showTeacherHomeworkModal, setShowTeacherHomeworkModal] = useState(false);
  const [showTeacherLeaveModal, setShowTeacherLeaveModal] = useState(false);
  const [showViolationsRegisterModal, setShowViolationsRegisterModal] = useState(false);
  const [showAdminApprovalsModal, setShowAdminApprovalsModal] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Sections filter for teachers / admin
  const [teacherFilterTab, setTeacherFilterTab] = useState<'timetable' | 'my' | 'all'>('timetable');

  // Settings state
  const [settings, setSettings] = useState<AppSettings>({
    institution: 'الثانوية الإعدادية ايكسان',
    year: '2026/2027',
    teacher: ''
  });
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Sections state
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Batch Multi-Section Import Modal state
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);

  // Drag & Drop and Seat Swap state
  const [draggingSeat, setDraggingSeat] = useState<number | null>(null);
  const [dropTargetSeat, setDropTargetSeat] = useState<number | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<number | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  // Modals state
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newLevel, setNewLevel] = useState('المستوى الأول');
  const [newClassNumber, setNewClassNumber] = useState('');
  const [newTeacher, setNewTeacher] = useState('');

  const [showEditSectionModal, setShowEditSectionModal] = useState(false);
  const [editLevel, setEditLevel] = useState('');
  const [editClassNumber, setEditClassNumber] = useState('');
  const [editTeacher, setEditTeacher] = useState('');

  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const [showDeleteAllSectionsModal, setShowDeleteAllSectionsModal] = useState(false);
  const [isDeletingAllSections, setIsDeletingAllSections] = useState(false);
  const [showRosterReorderModal, setShowRosterReorderModal] = useState(false);

  // Student Portal State (فضاء التلميذ)
  const [studentPortalData, setStudentPortalData] = useState<StudentData | null>(() => {
    try {
      const saved = sessionStorage.getItem('echsa_student_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isStudentLoginOpen, setIsStudentLoginOpen] = useState(false);

  // Violations & Notes Modal state
  const [activeSeatModal, setActiveSeatModal] = useState<{
    seatNum: number;
    name: string;
    notes: NoteItem[];
    violations?: StudentViolationRecord[];
  } | null>(null);

  // Positive Participation Modal state
  const [activePositiveParticipationModal, setActivePositiveParticipationModal] = useState<{
    seatNum: number;
    studentName: string;
    studentNumber?: string;
    massarNumber?: string;
    rosterId?: string | null;
  } | null>(null);
  const [studentHistory, setStudentHistory] = useState<{
    absences: Array<{
      id: number;
      status: string;
      recordedDate: string;
      sessionPeriod: string;
      teacherName: string;
      teacherSubject: string;
      removerName?: string;
      removerSubject?: string;
      removedAt?: string | null;
      absenceMode?: 'hours' | 'days';
      durationHours?: number;
      durationDays?: number;
      durationLabel?: string;
      isOngoing?: boolean;
      justified: string;
      justificationReason?: string;
      notes?: string;
      createdAt?: string;
    }>;
    absenceDays: string[];
    absenceRecordCount: number;
    totalHours?: number;
    totalDays?: number;
    violations: Array<{ id: string; violationType: string; actionTaken: string; recordedDate: string; recordedTime: string; teacherName: string }>;
  } | null>(null);
  const [isStudentHistoryLoading, setIsStudentHistoryLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // DB Info & History modal
  const [showDbInfoModal, setShowDbInfoModal] = useState(false);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [historyLogs, setHistoryLogs] = useState<ChangeLogItem[]>([]);

  // Cloud Deployment Modal
  const [showDeployModal, setShowDeployModal] = useState(false);

  // Daily Archive Modal (غيابات ومخالفات يومية)
  const [showDailyArchiveModal, setShowDailyArchiveModal] = useState(false);

  // Positive Participations & Honor Roll Modal state (المشاركات الإيجابية والتحفيز)
  const [showPositiveReportModal, setShowPositiveReportModal] = useState(false);
  const [positiveReportInitialStudent, setPositiveReportInitialStudent] = useState<string | undefined>(undefined);

  const teacherOverview = React.useMemo(() => {
    if (currentUser?.role !== 'teacher') return null;

    const assignedSections = sections.filter((section) =>
      section.assignedTeacherId === currentUser.id ||
      section.assignedTeachers?.some((teacher) => teacher.teacherId === currentUser.id)
    );
    const students = assignedSections.reduce(
      (total, section) => total + section.seats.filter((seat) => seat.name && seat.name.trim()).length,
      0
    );
    const absences = assignedSections.reduce(
      (total, section) => total + section.seats.filter((seat) => seat.attendance === 'absent').length,
      0
    );
    const notes = assignedSections.reduce(
      (total, section) => total + section.seats.reduce((count, seat) => count + (seat.notes?.length || 0), 0),
      0
    );
    const violations = assignedSections.reduce(
      (total, section) => total + section.seats.reduce((count, seat) => count + (seat.violations?.length || 0), 0),
      0
    );

    return { sections: assignedSections.length, students, absences, notes, violations };
  }, [currentUser, sections]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // 0. Visitor Tracking & Presence (متابعة زوار الموقع)
  useEffect(() => {
    let visitorId = '';
    try {
      visitorId = localStorage.getItem('lyceecom_visitor_id') || '';
      if (!visitorId) {
        visitorId = 'vis_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        localStorage.setItem('lyceecom_visitor_id', visitorId);
      }
    } catch {
      visitorId = 'vis_temp_' + Date.now();
    }

    const sendTrack = async () => {
      try {
        const visitorType = currentUser
          ? (currentUser.role === 'admin' ? 'admin' : currentUser.role === 'director' ? 'director' : 'teacher')
          : 'guest';

        await fetch('/api/visitors/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId,
            userId: currentUser?.id,
            visitorType,
            userName: currentUser?.fullName || '',
            userEmail: currentUser?.email || '',
            subject: currentUser?.subject || '',
            path: window.location.pathname || '/',
            pageTitle: document.title || 'المدرسة الرقمية'
          })
        });
      } catch {
        // Silent
      }
    };

    sendTrack();
    const timer = setInterval(sendTrack, 3 * 60 * 1000); // Heartbeat every 3 minutes
    return () => clearInterval(timer);
  }, [currentUser]);

  // 1. Initial Load from Backend
  useEffect(() => {
    fetchInitialData();
    refreshDbStatsAndPending();
  }, []);

  const refreshDbStatsAndPending = async () => {
    try {
      const res = await fetch('/api/db/stats');
      const data = await res.json();
      if (data.success && data.stats) {
        setDbStats(data.stats);
        if (typeof data.stats.pendingRequestsCount === 'number') {
          setPendingRequestsCount(data.stats.pendingRequestsCount);
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchInitialData = async (viewer: UserType | null = currentUser) => {
    setIsLoading(true);
    try {
      const [settingsRes, sectionsRes] = await Promise.all([
        fetch('/api/settings').then((r) => r.json()),
        fetch('/api/sections', {
          headers: viewer ? {
            'x-user-id': viewer.id,
            'x-user-role': viewer.role
          } : {}
        }).then((r) => r.json())
      ]);

      if (settingsRes.installed === false && settingsRes.redirect) {
        window.location.href = settingsRes.redirect;
        return;
      }

      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
      }
      if (sectionsRes.success && Array.isArray(sectionsRes.sections)) {
        setSections(sectionsRes.sections);
      }
      refreshDbStatsAndPending();
    } catch (err) {
      console.error('Error fetching data from server:', err);
      showToast('تعذر الاتصال بالخادم، يُرجى إعادة المحاولة');
    } finally {
      setIsLoading(false);
    }
  };

  // Auth Handlers
  const handleLoginSuccess = (user: UserType) => {
    setCurrentUser(user);
    if (user.role === 'teacher') {
      setTeacherFilterTab('timetable');
    }
    try {
      localStorage.setItem('echsa_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    showToast(`مرحباً بك ${user.fullName}`);
    fetchInitialData(user);

    // If user has mustChangeProfile (first login for Director or required by system), prompt profile modal immediately
    if (user.mustChangeProfile) {
      setShowProfileModal(true);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setTeacherFilterTab('timetable');
    try {
      localStorage.removeItem('echsa_user');
    } catch (e) {
      console.error(e);
    }
    setActiveSectionId(null);
    showToast('تم تسجيل الخروج بنجاح');
  };

  // Route synchronization for /admin and / (Order #1)
  useEffect(() => {
    const handleLocationChange = () => {
      const p = window.location.pathname;
      const h = window.location.hash;
      const s = window.location.search;
      setIsAdminRoute(p === '/admin' || h === '#/admin' || h === '#admin' || s.includes('admin'));
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateToAdmin = () => {
    setIsAdminRoute(true);
    try {
      window.history.pushState({}, '', '/admin');
    } catch (e) {
      window.location.hash = '/admin';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setIsAdminRoute(false);
    try {
      window.history.pushState({}, '', '/');
    } catch (e) {
      window.location.hash = '';
    }
    setActiveSectionId(null);
    setShowAuthModal(false);
    setShowProfileModal(false);
    setShowTeacherAssignmentModal(false);
    setShowTeacherHomeworkModal(false);
    setShowTeacherLeaveModal(false);
    setShowAdminApprovalsModal(false);
    setShowBatchImportModal(false);
    setShowAddSectionModal(false);
    setShowEditSectionModal(false);
    setShowDbInfoModal(false);
    setShowDeployModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileUpdated = (updatedUser: UserType) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('echsa_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error(e);
    }
    showToast('تم تحديث البيانات بنجاح');
  };

  const handleSectionApprovedOrAssigned = () => {
    fetchInitialData();
    refreshDbStatsAndPending();
  };

  // 2. Save App Settings to Backend
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setSettingsSavedToast(true);
        setTimeout(() => setSettingsSavedToast(false), 2500);
        showToast('تم حفظ إعدادات المؤسسة في قاعدة البيانات');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء حفظ الإعدادات');
    }
  };

  // 3. Create Section
  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassNumber.trim()) {
      showToast('يرجى إدخال رقم القسم');
      return;
    }

    try {
      const res = await fetch('/api/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: newLevel,
          classNumber: newClassNumber.trim(),
          teacher: newTeacher.trim() || settings.teacher
        })
      });
      const data = await res.json();
      if (data.success && data.section) {
        setSections((prev) => [...prev, data.section]);
        setActiveSectionId(data.section.id);
        setShowAddSectionModal(false);
        setNewClassNumber('');
        setNewTeacher('');
        showToast('تمت إضافة القسم الجديد وتثبيته بقاعدة البيانات');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء إضافة القسم');
    }
  };

  // 4. Update Section Meta
  const handleUpdateSectionMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSection) return;

    try {
      const res = await fetch(`/api/sections/${activeSection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: editLevel,
          classNumber: editClassNumber,
          teacher: editTeacher
        })
      });
      const data = await res.json();
      if (data.success) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === activeSection.id
              ? { ...s, level: editLevel, classNumber: editClassNumber, teacher: editTeacher }
              : s
          )
        );
        setShowEditSectionModal(false);
        showToast('تم تحديث بيانات القسم بنجاح');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء تحديث بيانات القسم');
    }
  };

  // 5. Delete Section
  const handleDeleteSectionConfirm = async () => {
    if (!sectionToDelete) return;
    try {
      const res = await fetch(`/api/sections/${sectionToDelete}`, {
        method: 'DELETE',
        headers: currentUser ? {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        } : {}
      });
      const data = await res.json();
      if (data.success) {
        setSections((prev) => prev.filter((s) => s.id !== sectionToDelete));
        if (activeSectionId === sectionToDelete) {
          setActiveSectionId(null);
        }
        setSectionToDelete(null);
        showToast('تم حذف القسم ومقاعده وملاحظاته من قاعدة البيانات');
      } else {
        showToast(data.error || 'خطأ أثناء حذف القسم');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء حذف القسم');
    }
  };

  // 5b. Delete All Sections (Director Bulk Action)
  const handleDeleteAllSectionsConfirm = async () => {
    try {
      setIsDeletingAllSections(true);
      const res = await fetch('/api/sections', {
        method: 'DELETE',
        headers: currentUser ? {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        } : {}
      });
      const data = await res.json();
      if (data.success) {
        setSections([]);
        setActiveSectionId(null);
        setShowDeleteAllSectionsModal(false);
        showToast('تم حذف جميع الأقسام نهائياً بنجاح');
      } else {
        showToast(data.error || 'خطأ أثناء حذف جميع الأقسام');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء حذف جميع الأقسام');
    } finally {
      setIsDeletingAllSections(false);
    }
  };

  // 6. Batch Updates Mechanism for Seats & Attendance (آلية التحديث المجمع لتقليل استهلاك حصة Firestore)
  const pendingSeatUpdatesRef = useRef<Map<string, {
    sectionId: string;
    seatNum: number;
    updates: Record<string, any>;
  }>>(new Map());
  const batchFlushTimeoutRef = useRef<any>(null);

  // Flush pending batch updates to backend /api/sections/:id/seats/batch-update
  const flushPendingSeatUpdates = () => {
    if (batchFlushTimeoutRef.current) {
      clearTimeout(batchFlushTimeoutRef.current);
      batchFlushTimeoutRef.current = null;
    }

    if (pendingSeatUpdatesRef.current.size === 0) return;

    // Group updates by sectionId
    const updatesBySection: Record<string, any[]> = {};
    pendingSeatUpdatesRef.current.forEach(({ sectionId, seatNum, updates }) => {
      if (!updatesBySection[sectionId]) updatesBySection[sectionId] = [];
      updatesBySection[sectionId].push({
        seatNum,
        ...updates
      });
    });

    // Clear queue
    pendingSeatUpdatesRef.current.clear();

    // Send batch update for each section in a single POST request
    Object.entries(updatesBySection).forEach(([sectionId, updates]) => {
      fetch(`/api/sections/${sectionId}/seats/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'teacher'
        },
        body: JSON.stringify({
          updates,
          actorId: currentUser?.id || '',
          actorRole: currentUser?.role || 'teacher'
        })
      }).catch((err) => console.error('Failed to flush batch seat updates:', err));
    });
  };

  // Flush any pending updates when active section changes
  useEffect(() => {
    return () => {
      flushPendingSeatUpdates();
    };
  }, [activeSectionId]);

  // 6. Update Seat (Name / Number / Roster Link / Status Color / Attendance)
  const handleSeatChange = (
    sectionId: string,
    seatNum: number,
    field: 'name' | 'number' | 'massarNumber' | 'rosterId' | 'statusColor' | 'attendance',
    value: any
  ) => {
    if (field === 'attendance') {
      const currentSeat = sections.find((sec) => sec.id === sectionId)?.seats.find((st) => st.seat === seatNum);
      const studentName = currentSeat?.name?.trim() || `المقعد ${seatNum}`;
      if (value === 'absent') {
        showToast(`تم تسجيل غياب: ${studentName}`);
      } else if (value === 'present') {
        showToast(`تم تسجيل حضور: ${studentName}`);
      } else if (value === 'late') {
        showToast(`تم تسجيل تأخر: ${studentName}`);
      } else if (value === null) {
        showToast(`تم إلغاء تحديد الحالة لـ ${studentName}`);
      }
    }

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;

        // Collect all positive participations pool for this section
        const allParts = [
          ...(sec.seats.flatMap((s) => s.positiveParticipations || [])),
          ...(sec.roster?.flatMap((r) => r.positiveParticipations || []) || [])
        ];
        const seen = new Set<string>();
        const uniqueParts = allParts.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        return {
          ...sec,
          seats: sec.seats.map((st) => {
            if (st.seat !== seatNum) return st;
            const updated = { ...st, [field]: value };

            // Positive participations follow the student, not the seat
            if (field === 'name' || field === 'rosterId') {
              const effectiveName = (updated.name || '').trim();
              if (!effectiveName) {
                updated.positiveParticipations = [];
                updated.positiveParticipationCount = 0;
              } else {
                const studentParts = uniqueParts.filter((p) =>
                  matchClientStudent(effectiveName, updated.number, updated.massarNumber, p.studentName, p.studentNumber, p.massarNumber)
                );
                updated.positiveParticipations = studentParts;
                updated.positiveParticipationCount = studentParts.reduce((sum, p) => sum + (p.points || 1), 0);
              }
            }

            return updated;
          })
        };
      })
    );

    const currentSec = sections.find((sec) => sec.id === sectionId);
    const targetSeat = currentSec?.seats.find((st) => st.seat === seatNum);
    const queueKey = `${sectionId}_${seatNum}`;
    const existing = pendingSeatUpdatesRef.current.get(queueKey);
    const prev = existing?.updates || {};

    const updatePayload = {
      name: field === 'name' ? value : (prev.name !== undefined ? prev.name : targetSeat?.name),
      number: field === 'number' ? value : (prev.number !== undefined ? prev.number : targetSeat?.number),
      massarNumber: field === 'massarNumber' ? value : (prev.massarNumber !== undefined ? prev.massarNumber : targetSeat?.massarNumber),
      rosterId: field === 'rosterId' ? value : (prev.rosterId !== undefined ? prev.rosterId : targetSeat?.rosterId),
      statusColor: field === 'statusColor' ? value : (prev.statusColor !== undefined ? prev.statusColor : targetSeat?.statusColor),
      attendance: field === 'attendance' ? value : (prev.attendance !== undefined ? prev.attendance : targetSeat?.attendance),
      [field]: value
    };

    // Buffer into the batch update queue
    pendingSeatUpdatesRef.current.set(queueKey, {
      sectionId,
      seatNum,
      updates: updatePayload
    });

    // If attendance changed, flush immediately; otherwise debounce to coalesce keystrokes
    if (field === 'attendance') {
      flushPendingSeatUpdates();
    } else {
      if (batchFlushTimeoutRef.current) clearTimeout(batchFlushTimeoutRef.current);
      batchFlushTimeoutRef.current = setTimeout(flushPendingSeatUpdates, 400);
    }
  };

  // 6a-2. Atomic Assign Student to Seat (Ensures all fields, infractions, points and notes move with student)
  const handleAssignStudent = (
    sectionId: string,
    seatNum: number,
    student: { rosterId: string | null; name: string; number: string; massarNumber?: string }
  ) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;

        const allParts = [
          ...(sec.seats.flatMap((s) => s.positiveParticipations || [])),
          ...(sec.roster?.flatMap((r) => r.positiveParticipations || []) || [])
        ];
        const allViols = sec.seats.flatMap((s) => s.violations || []);
        const allNotes = sec.seats.flatMap((s) => s.notes || []);

        const cleanName = (student.name || '').trim();
        const existingSeat = sec.seats.find((s) =>
          cleanName && matchClientStudent(cleanName, student.number, student.massarNumber || '', s.name, s.number, s.massarNumber)
        );

        const studentParts = cleanName
          ? allParts.filter((p) => matchClientStudent(cleanName, student.number, student.massarNumber || '', p.studentName, p.studentNumber, p.massarNumber))
          : [];
        const studentViols = cleanName
          ? allViols.filter((v) => matchClientStudent(cleanName, student.number, student.massarNumber || '', v.studentName, v.studentNumber, v.massarNumber))
          : [];
        const studentNotes = cleanName
          ? (existingSeat?.notes || allNotes.filter((n: any) => n.studentName && matchClientStudent(cleanName, student.number, student.massarNumber || '', n.studentName, n.studentNumber, n.massarNumber)))
          : [];

        return {
          ...sec,
          seats: sec.seats.map((st) => {
            if (st.seat !== seatNum) return st;
            return {
              ...st,
              rosterId: student.rosterId,
              name: student.name,
              number: student.number,
              massarNumber: student.massarNumber || '',
              statusColor: existingSeat?.statusColor || st.statusColor || 'default',
              attendance: existingSeat?.attendance || null,
              totalAbsencesCount: existingSeat?.totalAbsencesCount || 0,
              previousSessionAbsence: existingSeat?.previousSessionAbsence || null,
              violations: studentViols,
              positiveParticipations: studentParts,
              positiveParticipationCount: studentParts.reduce((sum, p) => sum + (p.points || 1), 0),
              notes: studentNotes
            };
          })
        };
      })
    );

    const queueKey = `${sectionId}_${seatNum}`;
    const existing = pendingSeatUpdatesRef.current.get(queueKey);
    const prev = existing?.updates || {};
    const updatePayload = {
      ...prev,
      name: student.name,
      number: student.number,
      massarNumber: student.massarNumber || '',
      rosterId: student.rosterId
    };
    pendingSeatUpdatesRef.current.set(queueKey, {
      sectionId,
      seatNum,
      updates: updatePayload
    });

    if (batchFlushTimeoutRef.current) clearTimeout(batchFlushTimeoutRef.current);
    batchFlushTimeoutRef.current = setTimeout(flushPendingSeatUpdates, 200);
  };

  // 6b. Drag and Drop / Seat Swapping
  const handleSwapSeats = async (seatANum: number, seatBNum: number) => {
    if (!activeSectionId || seatANum === seatBNum || seatANum < 1 || seatANum > 40 || seatBNum < 1 || seatBNum > 40) {
      setDraggingSeat(null);
      setDropTargetSeat(null);
      setSwapSourceSeat(null);
      return;
    }

    // Flush any pending individual updates first
    flushPendingSeatUpdates();

    const currentSec = sections.find((s) => s.id === activeSectionId);
    if (!currentSec) return;

    const seatA = currentSec.seats.find((s) => s.seat === seatANum);
    const seatB = currentSec.seats.find((s) => s.seat === seatBNum);
    if (!seatA || !seatB) return;

    // Optimistic state update: swap names, numbers, massarNumbers, rosterIds, statusColor, attendance, and notes
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSectionId) return sec;
        return {
          ...sec,
          seats: sec.seats.map((st) => {
            if (st.seat === seatANum) {
              return {
                ...st,
                name: seatB.name,
                number: seatB.number,
                massarNumber: seatB.massarNumber,
                rosterId: seatB.rosterId,
                statusColor: seatB.statusColor,
                attendance: seatB.attendance,
                totalAbsencesCount: seatB.totalAbsencesCount,
                previousSessionAbsence: seatB.previousSessionAbsence,
                notes: seatB.notes,
                violations: seatB.violations,
                positiveParticipations: seatB.positiveParticipations,
                positiveParticipationCount: seatB.positiveParticipationCount
              };
            }
            if (st.seat === seatBNum) {
              return {
                ...st,
                name: seatA.name,
                number: seatA.number,
                massarNumber: seatA.massarNumber,
                rosterId: seatA.rosterId,
                statusColor: seatA.statusColor,
                attendance: seatA.attendance,
                totalAbsencesCount: seatA.totalAbsencesCount,
                previousSessionAbsence: seatA.previousSessionAbsence,
                notes: seatA.notes,
                violations: seatA.violations,
                positiveParticipations: seatA.positiveParticipations,
                positiveParticipationCount: seatA.positiveParticipationCount
              };
            }
            return st;
          })
        };
      })
    );

    const nameA = seatA.name.trim() ? seatA.name : `المقعد ${seatANum}`;
    const nameB = seatB.name.trim() ? seatB.name : `المقعد ${seatBNum}`;
    showToast(`تم تبديل [${nameA}] مع [${nameB}] بنجاح`);

    setDraggingSeat(null);
    setDropTargetSeat(null);
    setSwapSourceSeat(null);

    // Call backend API
    try {
      const res = await fetch(`/api/sections/${activeSectionId}/swap-seats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatA: seatANum,
          seatB: seatBNum,
          actorId: currentUser?.id || '',
          actorRole: currentUser?.role || 'teacher'
        })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'فشل حفظ تبديل المقاعد في قاعدة البيانات');
        fetchInitialData();
      }
    } catch (err) {
      console.error('Error swapping seats:', err);
      showToast('خطأ في الاتصال بالخادم أثناء التبديل');
      fetchInitialData();
    }
  };

  // 6c. Batch Attendance Marking for active section (تحديث مجمع لجميع المقاعد بطلب واحد)
  const handleMarkAllPresent = () => {
    if (!activeSectionId) return;
    const currentSec = sections.find((s) => s.id === activeSectionId);
    if (!currentSec) return;
    const filledSeats = currentSec.seats.filter((s) => s.name && s.name.trim() !== '');
    if (filledSeats.length === 0) {
      showToast('لا يوجد تلاميذ مسجلين في مقاعد هذا القسم بعد');
      return;
    }

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSectionId) return sec;
        return {
          ...sec,
          seats: sec.seats.map((st) => {
            if (!st.name || st.name.trim() === '') return st;
            return { ...st, attendance: 'present' as SeatAttendance };
          })
        };
      })
    );

    // Send single batch update instead of 40 individual HTTP calls!
    const batchUpdates = filledSeats.map((st) => ({
      seatNum: st.seat,
      attendance: 'present',
      name: st.name,
      number: st.number,
      massarNumber: st.massarNumber,
      rosterId: st.rosterId,
      statusColor: st.statusColor
    }));

    fetch(`/api/sections/${activeSectionId}/seats/batch-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'teacher'
      },
      body: JSON.stringify({
        updates: batchUpdates,
        actorId: currentUser?.id || '',
        actorRole: currentUser?.role || 'teacher'
      })
    }).catch((err) => console.error('Batch mark all present error:', err));

    showToast(`تم تسجيل حضور جميع التلاميذ (${filledSeats.length}) بنجاح ✓`);
  };

  const handleClearAttendance = () => {
    if (!activeSectionId) return;
    const currentSec = sections.find((s) => s.id === activeSectionId);
    const hasAbsentSeats = currentSec?.seats.some((st) => st.attendance === 'absent' || st.attendance === 'late');
    if (hasAbsentSeats) {
      const confirmed = window.confirm('هل تريد إزالة حالات الغياب/التأخر المسجلة في هذا القسم؟');
      if (!confirmed) return;
    }

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== activeSectionId) return sec;
        return {
          ...sec,
          seats: sec.seats.map((st) => ({ ...st, attendance: null }))
        };
      })
    );

    const attendedSeats = currentSec?.seats.filter((st) => st.attendance) || [];
    if (attendedSeats.length > 0) {
      // Send single batch update instead of multiple individual calls!
      const batchUpdates = attendedSeats.map((st) => ({
        seatNum: st.seat,
        attendance: null,
        name: st.name,
        number: st.number,
        massarNumber: st.massarNumber,
        rosterId: st.rosterId,
        statusColor: st.statusColor
      }));

      fetch(`/api/sections/${activeSectionId}/seats/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'teacher'
        },
        body: JSON.stringify({
          updates: batchUpdates,
          actorId: currentUser?.id || '',
          actorRole: currentUser?.role || 'teacher'
        })
      }).catch((err) => console.error('Batch clear attendance error:', err));
    }

    showToast('تمت إعادة تعيين تسجيل الحضور لهذا القسم');
  };

  // 6c. Randomize / Shuffle Seats
  const handleShuffleSeats = async () => {
    if (!activeSectionId) return;
    setIsShuffling(true);
    showToast('جاري التوزيع العشوائي للتلاميذ على المقاعد الـ 40...');

    try {
      const res = await fetch(`/api/sections/${activeSectionId}/shuffle-seats`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`تم التوزيع العشوائي لـ ${data.assignedCount || ''} تلميذاً على المقاعد بنجاح!`);
        // Refresh sections from DB
        const secRes = await fetch('/api/sections', {
          headers: currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {}
        }).then((r) => r.json());
        if (secRes.success && Array.isArray(secRes.sections)) {
          setSections(secRes.sections);
        }
      } else {
        showToast(data.message || 'فشل التوزيع العشوائي');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء التوزيع العشوائي للمقاعد');
    } finally {
      setIsShuffling(false);
    }
  };

  // 6d. Sequential Ordering by Student Number (1..40)
  const handleOrderByNumber = async () => {
    if (!activeSectionId) return;
    setIsOrdering(true);
    showToast('جاري الترتيب الافتراضي للتلاميذ حسب الرقم ابتداءً من 1...');

    try {
      const res = await fetch(`/api/sections/${activeSectionId}/order-by-number`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم ترتيب التلاميذ في المقاعد حسب أرقامهم التسلسلية ابتداءً من المقعد 1 بنجاح!');
        // Refresh sections from DB
        const secRes = await fetch('/api/sections', {
          headers: currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {}
        }).then((r) => r.json());
        if (secRes.success && Array.isArray(secRes.sections)) {
          setSections(secRes.sections);
        }
      } else {
        showToast(data.message || 'فشل ترتيب التلاميذ');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء ترتيب التلاميذ');
    } finally {
      setIsOrdering(false);
    }
  };

  // 7. Add Student Violation
  const handleAddViolation = async (data: {
    violationType: string;
    actionTaken?: string;
    teacherName?: string;
    teacherSubject?: string;
    date?: string;
    time?: string;
  }) => {
    if (!activeSectionId || !activeSeatModal) return;

    try {
      const res = await fetch(
        `/api/sections/${activeSectionId}/seats/${activeSeatModal.seatNum}/violations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {})
          },
          body: JSON.stringify({
            violationType: data.violationType,
            actionTaken: data.actionTaken,
            teacherName: currentUser?.fullName || data.teacherName,
            teacherSubject: currentUser?.subject || data.teacherSubject,
            teacherId: currentUser?.id || '',
            date: data.date,
            time: data.time
          })
        }
      );
      const resData = await res.json();
      if (resData.success && resData.violation) {
        const addedViol: StudentViolationRecord = resData.violation;

        setActiveSeatModal((prev) => {
          if (!prev) return null;
          const currentViols = prev.violations || [];
          const noteObj: NoteItem = {
            id: addedViol.id,
            text: addedViol.violationType,
            date: addedViol.recordedDate,
            time: addedViol.recordedTime
          };
          return {
            ...prev,
            violations: [addedViol, ...currentViols],
            notes: [noteObj, ...prev.notes]
          };
        });

        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id !== activeSectionId) return sec;
            return {
              ...sec,
              seats: sec.seats.map((st) => {
                if (st.seat !== activeSeatModal.seatNum) return st;
                const currentViols = st.violations || [];
                const noteObj: NoteItem = {
                  id: addedViol.id,
                  text: addedViol.violationType,
                  date: addedViol.recordedDate,
                  time: addedViol.recordedTime
                };
                return {
                  ...st,
                  violations: [addedViol, ...currentViols],
                  notes: [noteObj, ...(st.notes || [])]
                };
              })
            };
          })
        );

        showToast('تم تسجيل المخالفة وحفظها بنجاح');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء تسجيل المخالفة');
    }
  };

  // 8. Delete Student Violation
  const handleDeleteViolation = async (violationId: string) => {
    if (!activeSectionId || !activeSeatModal) return;

    try {
      const res = await fetch(
        `/api/sections/${activeSectionId}/seats/${activeSeatModal.seatNum}/violations/${violationId}`,
        { 
          method: 'DELETE',
          headers: currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {}
        }
      );
      const resData = await res.json();
      if (resData.success) {
        setActiveSeatModal((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            violations: (prev.violations || []).filter((v) => v.id !== violationId),
            notes: prev.notes.filter((n) => n.id !== violationId)
          };
        });

        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id !== activeSectionId) return sec;
            return {
              ...sec,
              seats: sec.seats.map((st) => {
                if (st.seat !== activeSeatModal.seatNum) return st;
                return {
                  ...st,
                  violations: (st.violations || []).filter((v) => v.id !== violationId),
                  notes: (st.notes || []).filter((n) => n.id !== violationId)
                };
              })
            };
          })
        );
        showToast('تم حذف المخالفة من السجل');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء حذف المخالفة');
    }
  };

  // 8b. Add Positive Participation (المشاركات الإيجابية والتعزيز)
  const handleAddPositiveParticipation = async (data: {
    participationType: string;
    points: number;
    note?: string;
    date?: string;
    time?: string;
  }) => {
    if (!activeSectionId || !activePositiveParticipationModal) return;

    const studentName = (activePositiveParticipationModal.studentName || '').trim();
    if (!studentName) {
      showToast('لا يمكن تسجيل مشاركة إيجابية لمقعد فارغ بدون تلميذ');
      return;
    }

    try {
      const res = await fetch(
        `/api/sections/${activeSectionId}/seats/${activePositiveParticipationModal.seatNum}/positive-participations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {})
          },
          body: JSON.stringify({
            studentName,
            studentNumber: activePositiveParticipationModal.studentNumber || '',
            massarNumber: activePositiveParticipationModal.massarNumber || '',
            seatNum: activePositiveParticipationModal.seatNum,
            participationType: data.participationType,
            points: data.points,
            note: data.note,
            teacherName: currentUser?.fullName || '',
            teacherSubject: currentUser?.subject || '',
            teacherId: currentUser?.id || '',
            recordedDate: data.date,
            recordedTime: data.time
          })
        }
      );
      const resData = await res.json();
      if (resData.success && resData.participation) {
        const added: PositiveParticipationItem = resData.participation;

        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id !== activeSectionId) return sec;
            return {
              ...sec,
              seats: sec.seats.map((st) => {
                const isTargetStudent = matchClientStudent(
                  st.name,
                  st.number,
                  st.massarNumber,
                  added.studentName,
                  added.studentNumber,
                  added.massarNumber
                );
                if (!isTargetStudent) return st;

                // Clean out any stale participations that don't belong to this student
                const currentPos = (st.positiveParticipations || []).filter((p) =>
                  matchClientStudent(st.name, st.number, st.massarNumber, p.studentName, p.studentNumber, p.massarNumber)
                );
                const updatedPos = [added, ...currentPos];
                const updatedCount = updatedPos.reduce((sum, p) => sum + (p.points || 1), 0);
                return {
                  ...st,
                  positiveParticipations: updatedPos,
                  positiveParticipationCount: updatedCount
                };
              })
            };
          })
        );

        showToast(`تم تسجيل المشاركة الإيجابية للتلميذ (${added.studentName}) بنجاح ⭐`);
      } else {
        throw new Error(resData.error || 'فشل حفظ المشاركة الإيجابية');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'خطأ في حفظ المشاركة الإيجابية');
      throw err;
    }
  };

  // 8c. Delete Positive Participation
  const handleDeletePositiveParticipation = async (participationId: string) => {
    if (!activeSectionId || !activePositiveParticipationModal) return;

    try {
      const res = await fetch(
        `/api/sections/${activeSectionId}/positive-participations/${participationId}`,
        {
          method: 'DELETE',
          headers: currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {}
        }
      );
      const resData = await res.json();
      if (resData.success) {
        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id !== activeSectionId) return sec;
            return {
              ...sec,
              seats: sec.seats.map((st) => {
                const isTargetStudent = matchClientStudent(
                  st.name,
                  st.number,
                  st.massarNumber,
                  activePositiveParticipationModal.studentName,
                  activePositiveParticipationModal.studentNumber,
                  activePositiveParticipationModal.massarNumber
                );
                if (!isTargetStudent) return st;

                const updatedPos = (st.positiveParticipations || []).filter((p) => p.id !== participationId);
                const updatedCount = updatedPos.reduce((sum, p) => sum + (p.points || 1), 0);
                return {
                  ...st,
                  positiveParticipations: updatedPos,
                  positiveParticipationCount: updatedCount
                };
              })
            };
          })
        );
        showToast('تم حذف سجل المشاركة الإيجابية');
      }
    } catch (err: any) {
      console.error(err);
      showToast('خطأ أثناء حذف المشاركة');
      throw err;
    }
  };

  // Legacy Add Seat Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSectionId || !activeSeatModal || !newNoteText.trim()) return;

    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    const dateStr = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
    const timeStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

    try {
      const res = await fetch(
        `/api/sections/${activeSectionId}/seats/${activeSeatModal.seatNum}/notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {})
          },
          body: JSON.stringify({
            text: newNoteText.trim(),
            date: dateStr,
            time: timeStr,
            teacherId: currentUser?.id || ''
          })
        }
      );
      const data = await res.json();
      if (data.success && data.note) {
        const addedNote: NoteItem = data.note;

        setActiveSeatModal((prev) =>
          prev ? { ...prev, notes: [addedNote, ...prev.notes] } : null
        );

        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id !== activeSectionId) return sec;
            return {
              ...sec,
              seats: sec.seats.map((st) => {
                if (st.seat !== activeSeatModal.seatNum) return st;
                return { ...st, notes: [addedNote, ...st.notes] };
              })
            };
          })
        );

        setNewNoteText('');
        showToast('تمت إضافة الملاحظة وحفظها في قاعدة البيانات');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء حفظ الملاحظة');
    }
  };

  // 8. Delete Seat Note
  const handleDeleteNote = async (noteId: string) => {
    if (!activeSectionId || !activeSeatModal) return;

    try {
      const res = await fetch(
        `/api/sections/${activeSectionId}/seats/${activeSeatModal.seatNum}/notes/${noteId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setActiveSeatModal((prev) =>
          prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : null
        );

        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id !== activeSectionId) return sec;
            return {
              ...sec,
              seats: sec.seats.map((st) => {
                if (st.seat !== activeSeatModal.seatNum) return st;
                return { ...st, notes: st.notes.filter((n) => n.id !== noteId) };
              })
            };
          })
        );
        showToast('تم حذف الملاحظة من قاعدة البيانات');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء حذف الملاحظة');
    }
  };

  // 9. Excel Roster Import
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSectionId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: '' });

        if (!data || data.length === 0) {
          showToast('الملف لا يحتوي على بيانات كافية');
          return;
        }

        const roster: RosterItem[] = [];

        // Check for Moroccan school Excel format:
        // Rows 1-10 are ignored (skiprows=10), data starts at row 11 (index 10)
        // Col A (0): Student Number starting from 1
        // Col B (1): Massar Number / رقم مسار
        // Col C (2): Family Name / النسب (nasab)
        // Col D (3): First Name / الاسم (ism)
        if (data.length > 10) {
          for (let r = 10; r < data.length; r++) {
            const row = data[r];
            if (!row || !Array.isArray(row)) continue;

            const rawNum = row[0] !== undefined && row[0] !== null ? row[0] : '';
            const colB = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
            const colC = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : '';
            const colD = row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '';

            // Skip table header if at row 10 or 11
            if (
              colB.includes('مسار') || colB.includes('Massar') || colB.includes('massar') ||
              colC.includes('النسب') || colC.includes('Nom') || colC.includes('nom') ||
              colD.includes('الاسم') || colD.includes('Prénom') || colD.includes('prenom') ||
              String(rawNum).includes('رقم') || String(rawNum).includes('N°')
            ) {
              continue;
            }

            const numStr = String(rawNum).trim();
            if (!numStr || (!colC && !colD)) continue;

            let numParsed = numStr;
            const numVal = Number(rawNum);
            if (!isNaN(numVal) && isFinite(numVal)) {
              numParsed = String(Math.floor(numVal));
            }

            // f"{ism} {nasab}".strip()
            const fullName = [colD, colC].filter(Boolean).join(' ').trim();
            if (fullName && fullName.length >= 2) {
              roster.push({
                id: 'r_' + r + '_' + Math.random().toString(36).slice(2, 6),
                name: fullName,
                number: numParsed || String(roster.length + 1),
                massarNumber: colB
              });
            }
          }
        }

        // Fallback to dynamic header detection if needed
        if (roster.length === 0) {
          let lastNameCol = -1;
          let firstNameCol = -1;
          let nameCol = -1;
          let numCol = -1;
          let massarCol = 1;
          let headerRowIdx = -1;

          for (let r = 0; r < Math.min(data.length, 15); r++) {
            const row = data[r];
            if (!row || !Array.isArray(row)) continue;
            let fLast = -1, fFirst = -1, fName = -1, fNum = -1, fMassar = -1;

            row.forEach((col: any, c: number) => {
              const val = String(col || '').trim().toLowerCase();
              if (val.includes('مسار') || val.includes('massar') || val.includes('cne')) fMassar = c;
              else if (val.includes('نسب') || val.includes('عائلي') || val.includes('nom')) fLast = c;
              else if (val.includes('شخصي') || val.includes('prénom') || val.includes('prenom')) fFirst = c;
              else if (val.includes('اسم') || val.includes('الاسم') || val.includes('name') || val.includes('تلميذ')) fName = c;

              if (val.includes('رقم') || val.includes('الرقم') || val.includes('تسجيل') || val.includes('id') || val.includes('number') || val.includes('ترتيب') || val.includes('n°')) {
                fNum = c;
              }
            });

            if (fLast !== -1 && fFirst !== -1) {
              headerRowIdx = r;
              lastNameCol = fLast;
              firstNameCol = fFirst;
              numCol = fNum !== -1 ? fNum : 0;
              if (fMassar !== -1) massarCol = fMassar;
              break;
            } else if (fName !== -1) {
              headerRowIdx = r;
              nameCol = fName;
              numCol = fNum !== -1 ? fNum : (fName === 0 ? 1 : 0);
              if (fMassar !== -1) massarCol = fMassar;
              break;
            }
          }

          const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
          for (let r = startRow; r < data.length; r++) {
            const row = data[r];
            if (!row) continue;

            let fullName = '';
            if (lastNameCol !== -1 && firstNameCol !== -1) {
              const last = row[lastNameCol] ? String(row[lastNameCol]).trim() : '';
              const first = row[firstNameCol] ? String(row[firstNameCol]).trim() : '';
              fullName = [last, first].filter(Boolean).join(' ').trim();
            } else if (nameCol !== -1 && row[nameCol]) {
              fullName = String(row[nameCol]).trim();
            } else if (row[2] && row[3]) {
              fullName = `${String(row[2]).trim()} ${String(row[3]).trim()}`.trim();
            } else if (row[0]) {
              fullName = String(row[0]).trim();
            }

            if (!fullName || fullName.length < 2) continue;

            const numVal = numCol !== -1 && row[numCol] !== undefined ? String(row[numCol]).trim() : String(roster.length + 1);
            const massarVal = massarCol !== -1 && row[massarCol] !== undefined ? String(row[massarCol]).trim() : '';
            roster.push({
              id: 'r_' + r + '_' + Math.random().toString(36).slice(2, 6),
              name: fullName,
              number: numVal,
              massarNumber: massarVal
            });
          }
        }

        if (roster.length === 0) {
          showToast('لم يتم العثور على أسماء في الملف');
          return;
        }

        // Default ordering: Sort sequentially by student number starting from 1
        roster.sort((a, b) => {
          const numA = parseInt(a.number || '0', 10);
          const numB = parseInt(b.number || '0', 10);
          if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) return numA - numB;
          return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
        });

        const res = await fetch(`/api/sections/${activeSectionId}/roster`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roster })
        });
        const resData = await res.json();

        if (resData.success) {
          // Trigger order by number so students are assigned to seats 1..40 automatically
          await fetch(`/api/sections/${activeSectionId}/order-by-number`, { method: 'POST' });
          const secRes = await fetch('/api/sections', {
            headers: currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {}
          }).then((r) => r.json());
          if (secRes.success && Array.isArray(secRes.sections)) {
            setSections(secRes.sections);
          }
          showToast(`تم استيراد ${roster.length} تلميذاً مع أرقام مسار وترتيبهم تصاعدياً من الرقم 1`);
        }
      } catch (err) {
        console.error('Error parsing excel:', err);
        showToast('خطأ أثناء قراءة ملف Excel');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // 10. Database Stats & History Modal
  const handleOpenDbInfo = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch('/api/db/stats').then((r) => r.json()),
        fetch('/api/history?limit=25').then((r) => r.json())
      ]);
      if (statsRes.success) setDbStats(statsRes.stats);
      if (historyRes.success) setHistoryLogs(historyRes.logs);
      setShowDbInfoModal(true);
    } catch (err) {
      console.error(err);
      showToast('خطأ في جلب بيانات قاعدة البيانات');
    }
  };

  // 11. Full Backup Export
  const handleExportBackup = () => {
    window.location.href = '/api/db/export';
  };

  // 12. Full Backup Import
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        const res = await fetch('/api/db/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
        const data = await res.json();

        if (data.success) {
          showToast(`تم استرجاع النسخة الاحتياطية (${data.count} قسم) بنجاح`);
          fetchInitialData();
          setShowDbInfoModal(false);
        } else {
          showToast(data.error || 'فشل استرجاع النسخة الاحتياطية');
        }
      } catch (err) {
        console.error(err);
        showToast('صيغة ملف النسخة الاحتياطية غير صحيحة');
      } finally {
        if (backupInputRef.current) backupInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const activeSection = sections.find((s) => s.id === activeSectionId) || null;

  const openStudentRecord = async (seat: SeatItem) => {
    if (!activeSectionId) return;
    setActiveSeatModal({
      seatNum: seat.seat,
      name: seat.name,
      notes: seat.notes || [],
      violations: seat.violations || []
    });
    setStudentHistory(null);
    setIsStudentHistoryLoading(true);
    try {
      const qParams = new URLSearchParams({
        ...(seat.name ? { studentName: seat.name } : {}),
        ...(seat.number ? { studentNumber: seat.number } : {})
      });
      const response = await fetch(`/api/students/${encodeURIComponent(activeSectionId)}/${seat.seat}/history?${qParams.toString()}`, {
        headers: currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {}
      });
      const data = await response.json();
      if (data.success) setStudentHistory(data.history);
    } catch (error) {
      console.error('Failed to load student history:', error);
    } finally {
      setIsStudentHistoryLoading(false);
    }
  };

  const handlePrint = () => {
    if (activeSeatModal && activeSection) {
      const seatObj = activeSection.seats.find((s) => s.seat === activeSeatModal.seatNum);
      const studentNumber = seatObj?.number;
      const teacherName = currentUser?.fullName || activeSection.teacher || settings.teacher || '—';
      const subject = currentUser?.subject || '';

      printNotesReport({
        institution: settings.institution || 'الثانوية الإعدادية ايكسان',
        academicYear: currentUser?.academicYear || settings.year || '2025/2026',
        level: activeSection.level,
        classNumber: activeSection.classNumber,
        teacherName,
        subject,
        studentName: activeSeatModal.name || 'غير مسجل',
        seatNum: activeSeatModal.seatNum,
        studentNumber,
        notes: activeSeatModal.notes,
      });

      showToast(`تم فتح أمر طباعة بطاقة الملاحظات للتلميذ (${activeSeatModal.name || `مقعد #${activeSeatModal.seatNum}`})`);
    } else {
      window.print();
    }
  };

  const handlePrintClassroomPlan = () => {
    if (!activeSection) return;
    printClassroomSeatingPlan({
      institution: settings.institution || 'الثانوية الإعدادية ايكسان',
      academicYear: currentUser?.academicYear || settings.year || '2026/2027',
      section: {
        id: activeSection.id,
        level: activeSection.level,
        classNumber: activeSection.classNumber,
        teacher: activeSection.teacher || settings.teacher
      },
      teacherName: currentUser?.fullName || activeSection.teacher || settings.teacher,
      subject: currentUser?.subject || '',
      seats: activeSection.seats.map((s) => ({
        seat: s.seat,
        name: s.name,
        number: s.number,
        massarNumber: s.massarNumber,
        statusColor: s.statusColor
      }))
    });
  };

  // Dedicated Admin Route (/admin) - exclusively for App Super-Admin (مشرف التطبيق)
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-[#F4F0E8]" dir="rtl">
        <AdminPortalView
          institutionName={settings.institution || 'الثانوية الإعدادية ايكسان'}
          academicYear={settings.year || '2026/2027'}
          currentUser={currentUser}
          settings={settings}
          onLoginSuccess={(user) => {
            handleLoginSuccess(user);
          }}
          onNavigateHome={handleGoHome}
          onLogout={handleLogout}
          onOpenDbModal={handleOpenDbInfo}
        />
        <DbInfoModal
          isOpen={showDbInfoModal}
          onClose={() => setShowDbInfoModal(false)}
          dbStats={dbStats}
          historyLogs={historyLogs}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          backupInputRef={backupInputRef}
          onRefresh={handleOpenDbInfo}
        />
        {toastMessage && (
          <div className="toast show">
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // If student is logged in, show dedicated Student Portal Dashboard
  if (studentPortalData) {
    return (
      <StudentPortalDashboard
        data={studentPortalData}
        institutionName={settings.institution || 'الثانوية الإعدادية ايكسان'}
        academicYear={settings.year || '2025/2026'}
        onUpdateData={(newData) => {
          setStudentPortalData(newData);
          try {
            sessionStorage.setItem('echsa_student_session', JSON.stringify(newData));
          } catch {}
        }}
        onLogout={() => {
          setStudentPortalData(null);
          try {
            sessionStorage.removeItem('echsa_student_session');
          } catch {}
        }}
      />
    );
  }

  // If user is not logged in, show the clean Landing & Login screen requested by user
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F7F3EB] py-6 px-4" dir="rtl">
        <LandingView
          institutionName={settings.institution || 'الثانوية الإعدادية ايكسان'}
          academicYear={settings.year || '2025/2026'}
          onLoginSuccess={(user) => {
            handleLoginSuccess(user);
          }}
          onOpenForgotPassword={() => {
            setAuthModalTab('forgot');
            setShowAuthModal(true);
          }}
          onNavigateAdmin={navigateToAdmin}
          onOpenStudentLogin={() => setIsStudentLoginOpen(true)}
        />

        {/* Student Login Modal */}
        <StudentLoginModal
          isOpen={isStudentLoginOpen}
          onClose={() => setIsStudentLoginOpen(false)}
          onLoginSuccess={(data) => {
            setStudentPortalData(data);
            try {
              sessionStorage.setItem('echsa_student_session', JSON.stringify(data));
            } catch {}
          }}
          institutionName={settings.institution || 'الثانوية الإعدادية ايكسان'}
        />

        {/* Forgot password modal if requested */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={(user) => {
            handleLoginSuccess(user);
            setShowAuthModal(false);
          }}
          defaultTab={authModalTab}
        />

        {/* Toast */}
        {toastMessage && (
          <div className="toast show">
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app" dir="rtl">
      {/* Top Header Navigation */}
      <Topbar
        settings={settings}
        onOpenAddModal={() => setShowAddSectionModal(true)}
        onOpenDbModal={handleOpenDbInfo}
        onOpenHistoryModal={handleOpenDbInfo}
        onOpenDailyArchiveModal={() => setShowDailyArchiveModal(true)}
        onOpenViolationsRegisterModal={() => setShowViolationsRegisterModal(true)}
        onOpenPositiveReportModal={() => {
          setPositiveReportInitialStudent(undefined);
          setShowPositiveReportModal(true);
        }}
        dbStats={dbStats}
        saveStatusText={settingsSavedToast ? 'تم الحفظ في قاعدة البيانات' : null}
        currentUser={currentUser}
        onOpenAuthModal={(tab = 'login') => {
          setAuthModalTab(tab);
          setShowAuthModal(true);
        }}
        onLogout={handleLogout}
        onOpenProfileModal={() => setShowProfileModal(true)}
        onOpenTeacherAssignmentModal={() => setShowTeacherAssignmentModal(true)}
        onOpenAdminApprovalsModal={() => setShowAdminApprovalsModal(true)}
        pendingRequestsCount={pendingRequestsCount}
        onGoHome={handleGoHome}
        onNavigateAdmin={navigateToAdmin}
        isAdminRoute={isAdminRoute}
      />

      {/* Dedicated Admin/Supervisor Banner when accessing /admin */}
      {isAdminRoute && currentUser.role === 'admin' && (
        <div className="mb-5 p-4 rounded-2xl bg-[#172B24] border-2 border-[#C98A3C]/60 text-[#F2EFE3] flex items-center justify-between gap-4 flex-wrap shadow-md animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2A4F40] border border-[#C98A3C]/50 text-[#C98A3C] flex items-center justify-center font-bold shrink-0 shadow-xs">
              <ShieldCheck className="w-7 h-7 text-[#C98A3C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#F2EFE3] font-['Amiri',serif]">
                  بوابة المشرف العام ومدير المؤسسة: الأستاذ سمير القراشي
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#C98A3C] text-[#1E362D] font-bold text-[11px] shadow-xs">
                  الرابط المباشر /admin
                </span>
              </div>
              <div className="text-xs text-[rgba(242,239,227,0.8)] mt-0.5">
                الثانوية الإعدادية ايكسان • تحكم كامل في أقسام المؤسسة، تفعيل حسابات الأساتذة، ومصادقة طلبات الإسناد.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGoHome}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#F2EFE3] font-semibold text-xs border border-white/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>الواجهة العامة</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Action Shortcuts Ribbon */}
      <div className="flex items-center justify-between gap-3 mb-5 p-2 bg-white rounded-2xl border border-[#E5DFD4] shadow-xs flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Batch Multi-Section Import (Only for Admin / Director) */}
          {(currentUser.role === 'admin' || currentUser.role === 'director') && (
            <button
              id="batch-import-top-btn"
              onClick={() => setShowBatchImportModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#E8F2F0] hover:bg-[#D5E9E5] text-[#1A4E47] font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-[#1A4E47]/20 shadow-xs"
              title="استيراد ملف شامل لجميع الأقسام والتلاميذ (Excel / CSV) مع تقسيم عشوائي للمقاعد"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#1A4E47]" />
              <span>استيراد ملف الأقسام والتلاميذ (Excel / CSV)</span>
            </button>
          )}

        </div>

        {/* Logged in role tag */}
        <div className="text-[11px] text-[#6C6356] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
        </div>
      </div>

      {/* Role-Specific Welcoming & Notification Banners */}
      {currentUser.role === 'admin' || currentUser.role === 'director' ? (
        /* 1. Director / Admin Banner */
        <div className="p-4 mb-5 rounded-2xl bg-white border border-[#E5DFD4] flex items-center justify-between gap-4 flex-wrap shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F2F0] border border-[#D5CDC0] text-[#1A4E47] flex items-center justify-center font-bold shrink-0 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#1F2926] font-['Amiri',serif]">
                  {currentUser.role === 'admin' ? 'بوابة مشرف التطبيق (إدارة المؤسسة)' : 'لوحة إدارة المؤسسة (مدير المؤسسة)'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#E8F2F0] text-[#1A4E47] font-bold text-[10px] border border-[#1A4E47]/20">
                  {currentUser.role === 'admin' ? 'مشرف التطبيق' : 'مدير المؤسسة'}
                </span>
              </div>
              <div className="text-xs text-[#6C6356] mt-0.5">
                تتحكم في كافة أقسام الثانوية الإعدادية ايكسان، تدبير المواسم الدراسية، والموافقة على طلبات إسناد الأقسام للأساتذة.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setActiveSectionId(null);
                setTeacherFilterTab(teacherFilterTab === 'timetable' ? 'all' : 'timetable');
              }}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
                teacherFilterTab === 'timetable'
                  ? 'bg-[#1A4E47] text-white'
                  : 'bg-[#E8F2F0] hover:bg-[#D0E4E0] text-[#1A4E47] border border-[#B9D8D2]'
              }`}
              title="عرض وتدبير استعمال الزمان وجدول الحصص"
            >
              <Calendar className="w-4 h-4" />
              <span>{teacherFilterTab === 'timetable' ? 'عرض بطاقات الأقسام' : 'استعمال الزمان (جدول الحصص)'}</span>
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#1F2926] font-semibold text-xs border border-[#D5CDC0] cursor-pointer flex items-center gap-1.5"
              title="تعديل بيانات الحساب والاسم والموسم الدراسي"
            >
              <Settings className="w-3.5 h-3.5 text-[#6C6356]" />
              <span>تعديل بياناتي والموسم</span>
            </button>
            <button
              onClick={() => setShowAdminApprovalsModal(true)}
              className="px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>إدارة طلبات الأساتذة والموافقات</span>
              {pendingRequestsCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-400 text-black font-mono font-bold rounded-full text-[11px] animate-bounce">
                  {pendingRequestsCount} طلبات جديدة
                </span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* 2. Teacher Banner */
        <div className="p-4 mb-5 rounded-2xl bg-white border border-[#E5DFD4] flex items-center justify-between gap-4 flex-wrap shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F2F0] border border-[#D5CDC0] text-[#1A4E47] flex items-center justify-center font-bold shrink-0 shadow-xs">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#1F2926] font-['Amiri',serif]">
                  فضاء الأستاذ: {currentUser.fullName}
                </span>
                {currentUser.subject && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E8F2F0] text-[#1A4E47] text-xs font-bold border border-[#1A4E47]/20">
                    مادة {currentUser.subject}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-[#FAF8F5] text-[#6C6356] font-mono text-[10px] border border-[#E5DFD4]">
                  الموسم: {currentUser.academicYear || settings.year}
                </span>
              </div>
              <div className="text-xs text-[#6C6356] mt-0.5">
                تظهر هنا أقسامك المسندة إليك ومقاعد التلاميذ وحالات الحضور. لطلب إسناد أقسام جديدة اضغط على الزر أدناه.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setActiveSectionId(null);
                setTeacherFilterTab(teacherFilterTab === 'timetable' ? 'my' : 'timetable');
              }}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
                teacherFilterTab === 'timetable'
                  ? 'bg-[#1A4E47] text-white'
                  : 'bg-[#E8F2F0] hover:bg-[#D0E4E0] text-[#1A4E47] border border-[#B9D8D2]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{teacherFilterTab === 'timetable' ? 'عرض بطاقات الأقسام' : 'استعمال الزمان (جدول الحصص)'}</span>
            </button>
            <button
              onClick={() => setShowTeacherAssignmentModal(true)}
              className="px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Layers className="w-4 h-4" />
              <span>طلب إسناد أقسام جديدة</span>
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#1F2926] font-semibold text-xs border border-[#D5CDC0] cursor-pointer"
            >
              تعديل بياناتي والموسم
            </button>
          </div>
        </div>
      )}

      {/* Main View Area: Either Director Dashboard OR Section Seating Plan OR Sections Dashboard Grid */}
      {isLoading ? (
        <div className="empty-state">
          <div className="icon">⏳</div>
          <p>جاري تحميل البيانات من قاعدة البيانات...</p>
        </div>
      ) : currentUser && (currentUser.role === 'director' || currentUser.role === 'admin') ? (
        <DirectorDashboard
          currentUser={currentUser}
          sections={sections}
          settings={settings}
          onRefreshSections={fetchInitialData}
          onOpenSectionModal={() => setShowAddSectionModal(true)}
          onOpenBatchImportModal={() => setShowBatchImportModal(true)}
          onOpenApprovalsModal={() => setShowAdminApprovalsModal(true)}
          onYearChanged={(newYear) => {
            setSettings((prev) => ({ ...prev, year: newYear }));
            if (currentUser) {
              setCurrentUser((prev) => prev ? { ...prev, academicYear: newYear } : null);
            }
            showToast(`تم تعيين الموسم الدراسي النشط إلى: ${newYear}`);
          }}
        />
      ) : activeSection ? (
        /* Classroom Seating Map View */
        <main>
          <button
            id="back-to-sections-btn"
            className="back-link"
            onClick={() => setActiveSectionId(null)}
          >
            <span>→ رجوع إلى قائمة الأقسام</span>
          </button>

          {/* Access Control Guard: Teacher assignment must be approved or user is Admin */}
          {!currentUser || (currentUser.role !== 'admin' && activeSection.assignedTeacherId !== currentUser.id && !(activeSection.assignedTeachers?.some((t) => t.teacherId === currentUser.id))) ? (
            <div className="p-8 my-6 rounded-3xl bg-[#172B24] border border-[#C98A3C]/40 text-center max-w-xl mx-auto space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-[#2A4F40] border border-[#C98A3C]/40 text-[#C98A3C] flex items-center justify-center mx-auto shadow-md">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#F2EFE3]">
                {activeSection.level} - القسم {activeSection.classNumber}
              </h3>
              <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.3)] border border-[rgba(242,239,227,0.12)] text-xs text-[rgba(242,239,227,0.85)] leading-relaxed text-right space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#C98A3C] text-sm">
                  <ShieldCheck className="w-4 h-4 text-[#C98A3C]" />
                  <span>نظام الخصوصية وتوزيع الأقسام (الثانوية الإعدادية ايكسان)</span>
                </div>
                <p>
                  بناءً على توجيهات إدارة المؤسسة، يمكن إسناد نفس القسم لعدة أساتذة بحسب موادهم. لا تظهر أسماء التلاميذ وأرقامهم وتوزيع مقاعدهم لأي أستاذ إلا بعد تسجيل حسابه، وتقديم طلب إسناد هذا القسم إليه لمادته، وموافقة السيد المدير (المشرف) على الطلب.
                </p>
                {((activeSection.assignedTeachers && activeSection.assignedTeachers.length > 0) || activeSection.assignedTeacherName) && (
                  <div className="text-[11px] text-amber-200/80 pt-1">
                    الأساتذة المسندون حالياً: <b>
                      {activeSection.assignedTeachers && activeSection.assignedTeachers.length > 0
                        ? activeSection.assignedTeachers.map((t) => `${t.teacherName} (${t.subject || 'عام'})`).join('، ')
                        : activeSection.assignedTeacherName}
                    </b>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
                {currentUser ? (
                  <button
                    onClick={() => setShowTeacherAssignmentModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>طلب إسناد هذا القسم من السيد المدير</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setAuthModalTab('login');
                      setShowAuthModal(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>تسجيل الدخول / فتح حساب أستاذ</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveSectionId(null)}
                  className="px-4 py-2.5 rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-[#F2EFE3] text-xs font-semibold cursor-pointer"
                >
                  الرجوع إلى قائمة الأقسام
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="section-header">
                <div className="info">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 id="current-section-title" className="display">
                      {activeSection.level} - القسم {activeSection.classNumber}
                    </h2>
                    {currentUser.role === 'admin' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#C98A3C] text-[#1E362D] font-bold text-xs">
                        إشراف المدير العام
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold text-xs border border-emerald-500/40">
                        ✓ قسمك المسند والمعتمد
                      </span>
                    )}
                  </div>

                  <div className="tags">
                    {currentUser.role === 'teacher' && (
                      <span>
                        الأستاذ الحاضر: <b>{currentUser.fullName} {currentUser.subject ? `(${currentUser.subject})` : ''}</b>
                      </span>
                    )}
                    <span>
                      الموسم الدراسي: <b>{currentUser.academicYear || settings.year || '2025/2026'}</b>
                    </span>
                    <span>
                      المسجلين في المقاعد:{' '}
                      <b>
                        {activeSection.seats.filter((s) => s.name.trim() !== '').length} / 40
                      </b>
                    </span>
                    {activeSection.roster && activeSection.roster.length > 0 && (
                      <span className="text-amber-300">
                        📋 اللائحة المستوردة: <b>{activeSection.roster.length} تلميذاً</b>
                      </span>
                    )}
                  </div>
                </div>

                <div className="actions">
                  {currentUser?.role === 'teacher' && (
                    <button
                      className="btn btn-ghost btn-sm text-[#E8F2F0] border-[#1A4E47] bg-[#1A4E47]/30 hover:bg-[#1A4E47]/50 flex items-center gap-1.5"
                      onClick={() => {
                        setActiveSectionId(null);
                        setTeacherFilterTab('timetable');
                      }}
                      title="العودة مباشرة إلى استعمال الزمان وجدول الحصص"
                    >
                      <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                      <span>📅 جدول الحصص</span>
                    </button>
                  )}

                  <button
                    id="order-by-number-btn"
                    className="btn btn-ghost btn-sm text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 flex items-center gap-1.5 cursor-pointer"
                    onClick={handleOrderByNumber}
                    disabled={isOrdering}
                    title="الترتيب الافتراضي للتلاميذ حسب الرقم تصاعدياً ابتداءً من الرقم 1 في المقعد 1"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isOrdering ? 'جاري الترتيب...' : 'ترتيب حسب الرقم (1-40)'}</span>
                  </button>

                  <button
                    id="manage-roster-order-btn"
                    className="btn btn-ghost btn-sm text-cyan-200 border-cyan-500/40 hover:bg-cyan-500/15 flex items-center gap-1.5 cursor-pointer shadow-xs"
                    onClick={() => setShowRosterReorderModal(true)}
                    title="سحب وترتيب لائحة التلاميذ سابقاً أو لاحقاً مع تحيين الأرقام تلقائياً"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-cyan-300" />
                    <span>ترتيب التلاميذ وتحيين الأرقام ⇅</span>
                  </button>

                  <button
                    id="shuffle-seats-btn"
                    className="btn btn-ghost btn-sm text-amber-300 border-amber-500/40 hover:bg-amber-500/10 flex items-center gap-1.5"
                    onClick={handleShuffleSeats}
                    disabled={isShuffling}
                    title="إعادة توزيع عشوائي لجميع التلاميذ على المقاعد الـ 40"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isShuffling ? 'جاري التوزيع...' : 'تقسيم عشوائي على المقاعد'}</span>
                  </button>

                  <button
                    id="print-seating-chart-btn"
                    className="btn btn-ghost btn-sm text-sky-200 border-sky-500/40 hover:bg-sky-500/10 flex items-center gap-1.5"
                    onClick={handlePrintClassroomPlan}
                    title="طباعة خريطة ومخطط جلوس التلاميذ للقسم الرسمية (A4)"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-300" />
                    <span>طباعة مخطط المقاعد</span>
                  </button>

                  <button
                    id="print-positive-participations-btn"
                    className="btn btn-ghost btn-sm text-amber-200 border-amber-500/40 hover:bg-amber-500/15 flex items-center gap-1.5 font-bold shadow-xs cursor-pointer"
                    onClick={() => {
                      setPositiveReportInitialStudent(undefined);
                      setShowPositiveReportModal(true);
                    }}
                    title="سجل ولوحة شرف المشاركات الإيجابية والتعزيز (طباعة للقسم أو التلميذ)"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>سجل المشاركات الإيجابية ⭐</span>
                  </button>

                  {currentUser?.role === 'admin' && (
                    <>
                      <button
                        id="batch-import-section-btn"
                        className="btn btn-ghost btn-sm text-amber-200 border-amber-500/30 hover:bg-amber-500/10 flex items-center gap-1.5"
                        onClick={() => setShowBatchImportModal(true)}
                        title="استيراد ملف شامل أو تبديل الأقسام (خاص بالمدير)"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                        <span>📂 استيراد ملف شامل</span>
                      </button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx, .xls, .csv"
                        style={{ display: 'none' }}
                        onChange={handleExcelImport}
                      />
                      <button
                        id="import-excel-btn"
                        className="btn btn-ghost btn-sm"
                        onClick={() => fileInputRef.current?.click()}
                        title="استيراد لائحة التلاميذ من ملف Excel أو CSV"
                      >
                        <span>📥 استيراد لائحة القسم</span>
                      </button>

                      <button
                        id="edit-section-btn"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditLevel(activeSection.level);
                          setEditClassNumber(activeSection.classNumber);
                          setEditTeacher(activeSection.teacher || settings.teacher);
                          setShowEditSectionModal(true);
                        }}
                      >
                        <span>✎ تعديل بيانات القسم</span>
                      </button>

                      <button
                        id="delete-current-section-btn"
                        className="btn btn-danger btn-sm"
                        onClick={() => setSectionToDelete(activeSection.id)}
                      >
                        <span>🗑 حذف القسم</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Attendance & Color Legend Panel */}
              {(() => {
                const filledList = activeSection.seats.filter((s) => s.name && s.name.trim() !== '');
                const countPresent = filledList.filter((s) => s.attendance === 'present').length;
                const countAbsent = filledList.filter((s) => s.attendance === 'absent').length;
                const countLate = filledList.filter((s) => s.attendance === 'late').length;
                const countUnmarked = filledList.length - countPresent - countAbsent - countLate;

                return (
                  <div className="bg-[#172B24] border border-[rgba(242,239,227,0.14)] rounded-2xl p-3.5 mb-4 shadow-sm space-y-3">
                    {/* Attendance Row */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#F2EFE3] flex items-center gap-1.5">
                          <span>📋 تسجيل الحضور اليومي:</span>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40 flex items-center gap-1">
                          <span>✓ حاضر:</span>
                          <span className="font-mono">{countPresent}</span>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 font-bold border border-rose-500/40 flex items-center gap-1">
                          <span>✕ غائب:</span>
                          <span className="font-mono">{countAbsent}</span>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 font-bold border border-amber-500/40 flex items-center gap-1">
                          <span>⏳ متأخر:</span>
                          <span className="font-mono">{countLate}</span>
                        </span>
                        {countUnmarked > 0 && (
                          <span className="text-[11px] text-[rgba(242,239,227,0.6)]">
                            (غير مسجل: {countUnmarked})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleMarkAllPresent}
                          className="px-3 py-1 rounded-xl bg-[#2A4F40] hover:bg-[#346250] text-[#F2EFE3] text-xs font-semibold transition-colors cursor-pointer border border-[rgba(242,239,227,0.2)]"
                          title="وضع علامة حاضر لجميع التلاميذ المسجلين في المقاعد"
                        >
                          <span>✓ تسجيل الكل حاضر</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAttendance}
                          className="px-2.5 py-1 rounded-xl bg-black/25 hover:bg-black/40 text-[rgba(242,239,227,0.7)] text-xs transition-colors cursor-pointer"
                          title="مسح تسجيلات الحضور لهذا اليوم"
                        >
                          <span>إعادة تعيين</span>
                        </button>
                      </div>
                    </div>

                    {/* Color Status Legend */}
                    <div className="pt-2 border-t border-[rgba(242,239,227,0.08)] flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-[#C98A3C] text-[11px]">🎨 دليل تلوين المقاعد (Legend):</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#DCFCE7] text-[#065F46] font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                          <span>متفوق</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FEF3C7] text-[#92400E] font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                          <span>يحتاج مساعدة</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-[#0284C7]"></span>
                          <span>حالة خاصة</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F3E8FF] text-[#6B21A8] font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-[#A855F7]"></span>
                          <span>محجوز / فارغ</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F4EFDE] text-[#2A2118] font-medium text-[11px] border border-[#E4DBC0]">
                          <span className="w-2 h-2 rounded-full bg-[#A8A29E]"></span>
                          <span>عادي</span>
                        </span>
                      </div>

                      <div className="text-[11px] text-[rgba(242,239,227,0.5)]">
                        انقر على أيقونة 🎨 داخل بطاقة المقعد لاختيار حالته
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Interactive Drag & Drop Helper Bar */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 mb-4 text-xs text-amber-950 flex items-center justify-between flex-wrap gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <span>
                    <b>خاصية السحب والإفلات (Drag & Drop):</b> يمكنك سحب بطاقة أي تلميذ وإفلاتها فوق أي مقعد آخر لنقله أو تبديل الأماكن فوراً! كما يمكنك النقر على زر <b>«تبديل»</b> في أي مقعد للنقل السريع على الشاشات اللمسية.
                  </span>
                </div>
                <button
                  type="button"
                  className="text-amber-800 underline font-bold hover:text-amber-950"
                  onClick={handleShuffleSeats}
                  disabled={isShuffling}
                >
                  🎲 توزيع عشوائي جديد
                </button>
              </div>

              {/* Active Swap Source Indicator Banner */}
              {swapSourceSeat !== null && (
                <div className="swap-banner">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔄</span>
                    <span>
                      <b>وضع التبديل نشط:</b> تم تحديد المقعد رقم <b>{swapSourceSeat}</b> ({activeSection.seats.find((s) => s.seat === swapSourceSeat)?.name || 'مقعد شاغر'}). انقر الآن على أي مقعد آخر لنقل التلميذ إليه أو تبديل المكان معه!
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost text-white border-white/40 hover:bg-white/10"
                    onClick={() => setSwapSourceSeat(null)}
                  >
                    ✕ إلغاء التبديل
                  </button>
                </div>
              )}

              {/* Classroom Layout: 4 Rows of 5 Double Desks */}
              <div className="rows-wrap">
                {[1, 2, 3, 4].map((rowNum) => {
                  const startSeat = (rowNum - 1) * 10 + 1;
                  const desks = [0, 1, 2, 3, 4].map((deskIndex) => {
                    const s1 = startSeat + deskIndex * 2;
                    const s2 = s1 + 1;
                    return [s1, s2];
                  });

                  return (
                    <div key={rowNum} className="row-frame" id={`row-frame-${rowNum}`}>
                      <div className="row-label">الصف {rowNum}</div>
                      <div className="desks-grid">
                        {desks.map(([seat1Num, seat2Num], dIndex) => {
                          const seat1 = activeSection.seats.find((s) => s.seat === seat1Num) || {
                            seat: seat1Num,
                            name: '',
                            number: '',
                            notes: [],
                            rosterId: null
                          };
                          const seat2 = activeSection.seats.find((s) => s.seat === seat2Num) || {
                            seat: seat2Num,
                            name: '',
                            number: '',
                            notes: [],
                            rosterId: null
                          };

                          return (
                            <div key={dIndex} className="desk" id={`desk-${rowNum}-${dIndex + 1}`}>
                              {/* Seat 1 */}
                              <SeatCard
                                sectionId={activeSection.id}
                                seat={seat1}
                                roster={activeSection.roster}
                                onSeatChange={handleSeatChange}
                                onAssignStudent={handleAssignStudent}
                                onOpenNotes={() => openStudentRecord(seat1)}
                                onOpenPositiveParticipation={() => {
                                  if (!seat1.name || !seat1.name.trim()) {
                                    showToast('يرجى تعيين تلميذ في المقعد أولاً لتسجيل مشاركة إيجابية');
                                    return;
                                  }
                                  setActivePositiveParticipationModal({
                                    seatNum: seat1.seat,
                                    studentName: seat1.name.trim(),
                                    studentNumber: seat1.number || '',
                                    massarNumber: seat1.massarNumber || '',
                                    rosterId: seat1.rosterId || null
                                  });
                                }}
                                isDragging={draggingSeat === seat1.seat}
                                isDropTarget={dropTargetSeat === seat1.seat}
                                isSelectedForSwap={swapSourceSeat === seat1.seat}
                                onDragStart={(sNum) => setDraggingSeat(sNum)}
                                onDragOver={(sNum) => setDropTargetSeat(sNum)}
                                onDragLeave={(sNum) => setDropTargetSeat((curr) => (curr === sNum ? null : curr))}
                                onDrop={(src, tgt) => handleSwapSeats(src, tgt)}
                                onDragEnd={() => {
                                  setDraggingSeat(null);
                                  setDropTargetSeat(null);
                                }}
                                onSelectForSwap={(sNum) => {
                                  if (swapSourceSeat === null) {
                                    setSwapSourceSeat(sNum);
                                    const stName = activeSection.seats.find((s) => s.seat === sNum)?.name;
                                    showToast(`تم تحديد المقعد ${sNum} ${stName ? `(${stName})` : ''}. انقر على أي مقعد آخر للتبديل.`);
                                  } else if (swapSourceSeat === sNum) {
                                    setSwapSourceSeat(null);
                                  } else {
                                    handleSwapSeats(swapSourceSeat, sNum);
                                  }
                                }}
                              />

                              {/* Seat 2 */}
                              <SeatCard
                                sectionId={activeSection.id}
                                seat={seat2}
                                roster={activeSection.roster}
                                onSeatChange={handleSeatChange}
                                onAssignStudent={handleAssignStudent}
                                onOpenNotes={() => openStudentRecord(seat2)}
                                onOpenPositiveParticipation={() => {
                                  if (!seat2.name || !seat2.name.trim()) {
                                    showToast('يرجى تعيين تلميذ في المقعد أولاً لتسجيل مشاركة إيجابية');
                                    return;
                                  }
                                  setActivePositiveParticipationModal({
                                    seatNum: seat2.seat,
                                    studentName: seat2.name.trim(),
                                    studentNumber: seat2.number || '',
                                    massarNumber: seat2.massarNumber || '',
                                    rosterId: seat2.rosterId || null
                                  });
                                }}
                                isDragging={draggingSeat === seat2.seat}
                                isDropTarget={dropTargetSeat === seat2.seat}
                                isSelectedForSwap={swapSourceSeat === seat2.seat}
                                onDragStart={(sNum) => setDraggingSeat(sNum)}
                                onDragOver={(sNum) => setDropTargetSeat(sNum)}
                                onDragLeave={(sNum) => setDropTargetSeat((curr) => (curr === sNum ? null : curr))}
                                onDrop={(src, tgt) => handleSwapSeats(src, tgt)}
                                onDragEnd={() => {
                                  setDraggingSeat(null);
                                  setDropTargetSeat(null);
                                }}
                                onSelectForSwap={(sNum) => {
                                  if (swapSourceSeat === null) {
                                    setSwapSourceSeat(sNum);
                                    const stName = activeSection.seats.find((s) => s.seat === sNum)?.name;
                                    showToast(`تم تحديد المقعد ${sNum} ${stName ? `(${stName})` : ''}. انقر على أي مقعد آخر للتبديل.`);
                                  } else if (swapSourceSeat === sNum) {
                                    setSwapSourceSeat(null);
                                  } else {
                                    handleSwapSeats(swapSourceSeat, sNum);
                                  }
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      ) : (
        /* Sections Grid Dashboard */
        <main>
          {/* Role-tailored Banner & Header */}
          {currentUser?.role !== 'teacher' && (
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="display text-2xl m-0">الأقسام المسجلة بالمؤسسة ({sections.length})</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {currentUser?.role === 'admin' && (
                  <>
                    <button
                      id="batch-import-grid-btn"
                      onClick={() => setShowBatchImportModal(true)}
                      className="btn btn-secondary btn-sm flex items-center gap-1.5"
                      title="استيراد ملف شامل لجميع الأقسام والتلاميذ (Excel / CSV) مع توزيع عشوائي"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-amber-700" />
                      <span>📂 استيراد ملف شامل (Excel)</span>
                    </button>

                    <button
                      id="add-section-grid-btn"
                      onClick={() => setShowAddSectionModal(true)}
                      className="btn btn-primary btn-sm"
                    >
                      <span>＋ إضافة قسم جديد</span>
                    </button>

                    {sections.length > 0 && (
                      <button
                        id="delete-all-sections-grid-btn"
                        onClick={() => setShowDeleteAllSectionsModal(true)}
                        className="btn btn-danger btn-sm flex items-center gap-1.5"
                        title="حذف جميع الأقسام نهائياً من قاعدة البيانات"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف جميع الأقسام</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab Filter for Teachers and Directors */}
          {currentUser && (
            <div className="flex items-center gap-2 mb-4 border-b border-[#E5DFD4] pb-3 flex-wrap">
              {currentUser.role === 'teacher' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTeacherFilterTab('timetable')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      teacherFilterTab === 'timetable'
                        ? 'bg-[#1A4E47] text-white shadow-xs'
                        : 'bg-white text-[#6C6356] border border-[#D5CDC0] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>📅 استعمال الزمان (جدول الحصص)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherFilterTab('my')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      teacherFilterTab === 'my'
                        ? 'bg-[#1A4E47] text-white shadow-xs'
                        : 'bg-white text-[#6C6356] border border-[#D5CDC0] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    أقسامي المسندة (
                    {sections.filter((s) => s.assignedTeacherId === currentUser.id || s.assignedTeachers?.some((t) => t.teacherId === currentUser.id)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherFilterTab('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      teacherFilterTab === 'all'
                        ? 'bg-[#1A4E47] text-white shadow-xs'
                        : 'bg-white text-[#6C6356] border border-[#D5CDC0] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    جميع أقسام المؤسسة ({sections.length})
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTeacherFilterTab(teacherFilterTab === 'timetable' ? 'all' : 'timetable')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      teacherFilterTab === 'timetable'
                        ? 'bg-[#1A4E47] text-white shadow-xs'
                        : 'bg-white text-[#6C6356] border border-[#D5CDC0] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>📅 استعمال الزمان (جدول الحصص)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherFilterTab('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      teacherFilterTab === 'all'
                        ? 'bg-[#1A4E47] text-white shadow-xs'
                        : 'bg-white text-[#6C6356] border border-[#D5CDC0] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    عرض بطاقات الأقسام ({sections.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {currentUser?.role === 'teacher' && teacherOverview && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-5" dir="rtl">
              <button
                type="button"
                onClick={() => setTeacherFilterTab('timetable')}
                className={`text-right rounded-xl p-3 border transition-all cursor-pointer ${
                  teacherFilterTab === 'timetable'
                    ? 'bg-[#1A4E47] text-white border-[#1A4E47] shadow-xs'
                    : 'bg-[#E8F2F0] border-[#B9D8D2] hover:border-[#1A4E47]'
                }`}
              >
                <div className={`text-[11px] font-bold flex items-center gap-1 ${teacherFilterTab === 'timetable' ? 'text-white' : 'text-[#1A4E47]'}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>استعمال الزمان</span>
                </div>
                <div className={`text-sm font-bold mt-1 ${teacherFilterTab === 'timetable' ? 'text-white' : 'text-[#1A4E47]'}`}>جدول الحصص 📅</div>
              </button>
              <button
                type="button"
                onClick={() => setTeacherFilterTab('my')}
                className={`text-right border rounded-xl p-3 hover:border-[#1A4E47] transition-colors cursor-pointer ${
                  teacherFilterTab === 'my' ? 'bg-[#E8F2F0] border-[#1A4E47]' : 'bg-white border-[#E5DFD4]'
                }`}
              >
                <div className="text-[11px] font-bold text-[#5C746F]">أقسامي المسندة</div>
                <div className="text-2xl font-bold text-[#1A4E47] mt-1">{teacherOverview.sections}</div>
              </button>
              <button
                type="button"
                onClick={() => setTeacherFilterTab('my')}
                className="text-right bg-white border border-[#E5DFD4] rounded-xl p-3 hover:border-[#1A4E47] transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-bold text-[#6C6356]">تلاميذي</div>
                <div className="text-2xl font-bold text-[#1F2926] mt-1">{teacherOverview.students}</div>
              </button>
              <button
                type="button"
                onClick={() => setShowDailyArchiveModal(true)}
                className="text-right bg-[#FFF8E8] border border-[#F2D89C] rounded-xl p-3 hover:border-[#C98A3C] transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-bold text-[#8A5A18]">غيابات حالية</div>
                <div className="text-2xl font-bold text-[#8A5A18] mt-1">{teacherOverview.absences}</div>
              </button>
              <button
                type="button"
                onClick={() => setShowTeacherHomeworkModal(true)}
                className="text-right bg-gradient-to-br from-[#FAF8F5] to-white border border-[#B9D8D2] hover:border-[#1A4E47] rounded-xl p-3 transition-colors cursor-pointer shadow-2xs group"
                title="نشر واجبات منزلية وروابط فيديوهات وملخصات للتلاميذ"
              >
                <div className="text-[11px] font-bold text-[#1A4E47] flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-[#1A4E47]" />
                  <span>الواجبات والدروس</span>
                </div>
                <div className="text-sm font-bold text-[#1F2926] mt-1">نشر للتلاميذ 📚</div>
              </button>
              <button
                type="button"
                onClick={() => setShowTeacherLeaveModal(true)}
                className="text-right bg-gradient-to-br from-[#FFFDF8] to-[#FFF9EE] border border-amber-300 hover:border-amber-500 rounded-xl p-3 transition-colors cursor-pointer shadow-2xs group"
                title="التصريح برخصة أو غياب في حصة مع إشعار التلاميذ بالتوجيهات"
              >
                <div className="text-[11px] font-bold text-[#8A5A18] flex items-center gap-1">
                  <FileCheck2 className="w-3.5 h-3.5 text-[#8A5A18]" />
                  <span>رخص وغياب</span>
                </div>
                <div className="text-sm font-bold text-amber-950 mt-1">إشعار التلاميذ 📝</div>
              </button>
              <button
                type="button"
                onClick={() => setShowViolationsRegisterModal(true)}
                className="text-right bg-gradient-to-br from-rose-50/80 to-white border border-rose-300 hover:border-rose-500 rounded-xl p-3 transition-colors cursor-pointer shadow-2xs group"
                title="سجل المخالفات والانضباط المدرسي - طباعة المخالفات وإشعار أولياء الأمور"
              >
                <div className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>المخالفات</span>
                </div>
                <div className="text-2xl font-bold text-rose-700 mt-1">
                  {teacherOverview.violations ?? 0}
                </div>
              </button>
            </div>
          )}

          {teacherFilterTab === 'timetable' && currentUser ? (
            <TeacherTimetable
              currentUser={currentUser}
              sections={sections}
              settings={settings}
              onSelectSection={(secId) => {
                setActiveSectionId(secId);
              }}
              onOpenHomeworkModal={() => setShowTeacherHomeworkModal(true)}
              onOpenLeaveModal={() => setShowTeacherLeaveModal(true)}
            />
          ) : (
            (() => {
            const displayedSections =
              currentUser?.role === 'teacher' && teacherFilterTab === 'my'
                ? sections.filter((s) => s.assignedTeacherId === currentUser.id || s.assignedTeachers?.some((t) => t.teacherId === currentUser.id))
                : sections;

            if (sections.length === 0) {
              return (
                <div className="empty-state">
                  <div className="icon">🏫</div>
                  <p>لا توجد أقسام مسجلة حتى الآن.</p>
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => setShowAddSectionModal(true)}
                      className="btn btn-primary"
                      style={{ marginTop: 14 }}
                    >
                      <span>إضافة أول قسم</span>
                    </button>
                  )}
                </div>
              );
            }

            if (displayedSections.length === 0 && currentUser?.role === 'teacher' && teacherFilterTab === 'my') {
              return (
                <div className="empty-state">
                  <div className="icon">📚</div>
                  <p className="font-bold text-sm">لم يتم إسناد أي قسم لك حتى الآن</p>
                  <p className="text-xs text-[rgba(242,239,227,0.6)] mt-1">
                    يمكنك تقديم طلب إسناد لإدارة المؤسسة، أو استعراض جميع الأقسام.
                  </p>
                  <div className="flex items-center gap-2 mt-3 justify-center">
                    <button
                      onClick={() => setShowTeacherAssignmentModal(true)}
                      className="btn btn-primary btn-sm"
                    >
                      <span>طلب إسناد قسم الآن</span>
                    </button>
                    <button
                      onClick={() => setTeacherFilterTab('all')}
                      className="btn btn-ghost btn-sm"
                    >
                      <span>استعراض جميع الأقسام</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="sections-grid">
                {displayedSections.map((sec) => {
                  const isAssignedToMe = Boolean(
                    currentUser &&
                    (currentUser.id === sec.assignedTeacherId ||
                     sec.assignedTeachers?.some((t) => t.teacherId === currentUser.id))
                  );
                  const canAccess = Boolean(currentUser && (currentUser.role === 'admin' || isAssignedToMe));
                  const filledCount = sec.seats.filter((s) => s.name.trim() !== '').length;
                  const totalNotes = sec.seats.reduce((acc, s) => acc + s.notes.length, 0);

                  return (
                    <div
                      key={sec.id}
                      id={`section-card-${sec.id}`}
                      className={`section-card ${isAssignedToMe ? 'ring-2 ring-[#C98A3C]' : ''}`}
                      onClick={() => {
                        if (!currentUser) {
                          showToast('وجب تسجيل الدخول أولاً كأستاذ أو كمدير لعرض وتدبير تلاميذ هذا القسم');
                          setAuthModalTab('login');
                          setShowAuthModal(true);
                          return;
                        }
                        setActiveSectionId(sec.id);
                      }}
                    >
                      {currentUser?.role === 'admin' && (
                        <button
                          className="del-x"
                          title="حذف هذا القسم"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSectionToDelete(sec.id);
                          }}
                        >
                          ✕
                        </button>
                      )}

                      <div className="flex items-center justify-between mb-2 gap-1">
                      <h3 className="display m-0 text-base">
                        {sec.level} - القسم {sec.classNumber}
                      </h3>
                      {currentUser?.role === 'admin' ? (
                        sec.assignedTeachers && sec.assignedTeachers.length > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                            {sec.assignedTeachers.length} أساتذة مسندين
                          </span>
                        ) : sec.assignedTeacherName ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                            مسند: {sec.assignedTeacherName}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                            غير مسند
                          </span>
                        )
                      ) : currentUser?.role === 'teacher' ? (
                        isAssignedToMe ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                            ✓ مسند إليك
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 text-[10px] border border-amber-500/30 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>يتطلب موافقة المدير</span>
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-black/40 text-[rgba(242,239,227,0.6)] text-[10px] border border-white/10 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>تسجيل مطلوب</span>
                        </span>
                      )}
                    </div>

                    <div className="meta">
                      <span>
                        الأساتذة:{' '}
                        {sec.assignedTeachers && sec.assignedTeachers.length > 0
                          ? sec.assignedTeachers.map((t) => `${t.teacherName} (${t.subject || 'عام'})`).join('، ')
                          : sec.assignedTeacherName || (sec.teacher || settings.teacher || '—')}
                      </span>
                      {totalNotes > 0 && canAccess && (
                        <span className="text-amber-200">
                          📝 {totalNotes} ملاحظة مسجلة
                        </span>
                      )}
                    </div>

                    <div className="count">
                      {canAccess ? (
                        <span>👥 {filledCount} / 40 تلميذاً</span>
                      ) : (
                        <span className="text-[rgba(242,239,227,0.6)] text-xs flex items-center gap-1">
                          <Lock className="w-3 h-3 text-[#C98A3C]" />
                          <span>الأسماء تظهر بعد الموافقة</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })())}
        </main>
      )}

      {/* School Activities & Photos Wall (bottom of page, above footer) */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
        <SchoolActivitiesWall
          currentUser={currentUser}
          institutionName={settings.institution || 'الثانوية الإعدادية ايكسان'}
        />
      </div>

      {/* Persistent Institutional Footer (Order #2) */}
      <AppFooter
        institutionName={settings.institution || 'الثانوية الإعدادية ايكسان'}
        onNavigateAdmin={navigateToAdmin}
        onNavigateHome={handleGoHome}
        isAdminView={isAdminRoute || currentUser?.role === 'admin'}
      />

      {/* Toast Notification */}
      <div className={`toast ${toastMessage || settingsSavedToast ? 'show' : ''}`}>
        {toastMessage || 'تم حفظ التغييرات بنجاح'}
      </div>

      {/* Modal: Add Section */}
      {showAddSectionModal && (
        <div className="overlay" onClick={() => setShowAddSectionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>إضافة قسم جديد</h3>
              <button
                className="modal-close"
                onClick={() => setShowAddSectionModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSection}>
              <div className="modal-body">
                <div className="form-row">
                  <label htmlFor="select-new-level">المستوى</label>
                  <select
                    id="select-new-level"
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                  >
                    <option value="المستوى الأول">المستوى الأول</option>
                    <option value="المستوى الثاني">المستوى الثاني</option>
                    <option value="المستوى الثالث">المستوى الثالث</option>
                    <option value="المستوى الرابع">المستوى الرابع</option>
                    <option value="المستوى الخامس">المستوى الخامس</option>
                    <option value="المستوى السادس">المستوى السادس</option>
                    <option value="الجذع المشترك">الجذع المشترك</option>
                    <option value="الأولى بكالوريا">الأولى بكالوريا</option>
                    <option value="الثانية بكالوريا">الثانية بكالوريا</option>
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="input-new-class-num">رقم القسم</label>
                  <input
                    id="input-new-class-num"
                    type="text"
                    placeholder="مثال: 1 أو 2 أو 3..."
                    required
                    value={newClassNumber}
                    onChange={(e) => setNewClassNumber(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="input-new-teacher">اسم الأستاذ (اختياري)</label>
                  <input
                    id="input-new-teacher"
                    type="text"
                    placeholder={settings.teacher || 'اسم أستاذ المادة'}
                    value={newTeacher}
                    onChange={(e) => setNewTeacher(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-foot">
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowAddSectionModal(false)}
                  >
                    إلغاء
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    إضافة القسم
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Section Meta */}
      {showEditSectionModal && activeSection && (
        <div className="overlay" onClick={() => setShowEditSectionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>تعديل بيانات القسم</h3>
              <button
                className="modal-close"
                onClick={() => setShowEditSectionModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateSectionMeta}>
              <div className="modal-body">
                <div className="form-row">
                  <label htmlFor="select-edit-level">المستوى</label>
                  <select
                    id="select-edit-level"
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                  >
                    <option value="المستوى الأول">المستوى الأول</option>
                    <option value="المستوى الثاني">المستوى الثاني</option>
                    <option value="المستوى الثالث">المستوى الثالث</option>
                    <option value="المستوى الرابع">المستوى الرابع</option>
                    <option value="المستوى الخامس">المستوى الخامس</option>
                    <option value="المستوى السادس">المستوى السادس</option>
                    <option value="الجذع المشترك">الجذع المشترك</option>
                    <option value="الأولى بكالوريا">الأولى بكالوريا</option>
                    <option value="الثانية بكالوريا">الثانية بكالوريا</option>
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="input-edit-class-num">رقم القسم</label>
                  <input
                    id="input-edit-class-num"
                    type="text"
                    required
                    value={editClassNumber}
                    onChange={(e) => setEditClassNumber(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="input-edit-teacher">اسم الأستاذ</label>
                  <input
                    id="input-edit-teacher"
                    type="text"
                    value={editTeacher}
                    onChange={(e) => setEditTeacher(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-foot">
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowEditSectionModal(false)}
                  >
                    إلغاء
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    حفظ التعديلات
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Section */}
      {sectionToDelete && (
        <div className="overlay" onClick={() => setSectionToDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>تأكيد حذف القسم</h3>
              <button
                className="modal-close"
                onClick={() => setSectionToDelete(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text text-sm leading-relaxed">
                هل أنت متأكد أنك تريد حذف هذا القسم؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            <div className="modal-foot">
              <div className="confirm-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSectionToDelete(null)}
                >
                  إلغاء
                </button>
                <button
                  id="confirm-delete-btn"
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteSectionConfirm}
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete All Sections */}
      {showDeleteAllSectionsModal && (
        <div className="overlay" onClick={() => setShowDeleteAllSectionsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="text-rose-700">تأكيد حذف جميع الأقسام</h3>
              <button
                className="modal-close"
                onClick={() => setShowDeleteAllSectionsModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text text-sm leading-relaxed font-bold text-rose-950">
                هل أنت متأكد أنك تريد حذف جميع الأقسام؟ سيتم حذف جميع الأقسام نهائيًا ولا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="p-3 mt-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-normal">
                سيتم حذف كافة المقاعد ولوائح التلاميذ المسجلة بهذه الأقسام نهائياً، مع الحفاظ على حسابات الأساتذة والأرشيف.
              </div>
            </div>
            <div className="modal-foot">
              <div className="confirm-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowDeleteAllSectionsModal(false)}
                  disabled={isDeletingAllSections}
                >
                  إلغاء
                </button>
                <button
                  id="confirm-delete-all-btn"
                  className="btn btn-danger btn-sm"
                  disabled={isDeletingAllSections}
                  onClick={handleDeleteAllSectionsConfirm}
                >
                  {isDeletingAllSections ? 'جاري حذف الكل...' : 'تأكيد حذف الكل'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Student Violations */}
      {activeSeatModal && activeSection && (() => {
        const currentSeat = activeSection.seats.find((s) => s.seat === activeSeatModal.seatNum) || {
          seat: activeSeatModal.seatNum,
          name: activeSeatModal.name,
          number: '',
          notes: activeSeatModal.notes,
          violations: activeSeatModal.violations || [],
          rosterId: null
        };

        return (
          <ViolationsModal
            section={activeSection}
            seat={currentSeat}
            settings={settings}
            currentUser={currentUser}
            onClose={() => {
              setActiveSeatModal(null);
              setStudentHistory(null);
            }}
            onAddViolation={handleAddViolation}
            onDeleteViolation={handleDeleteViolation}
            studentHistory={studentHistory}
            isStudentHistoryLoading={isStudentHistoryLoading}
          />
        );
      })()}

      {/* Modal: Positive Participation & Rewards (المشاركات الإيجابية والتعزيز) */}
      {(() => {
        if (!activePositiveParticipationModal || !activeSection) return null;
        const currentSeat = activeSection.seats.find(
          (s) => s.seat === activePositiveParticipationModal.seatNum
        );
        if (!currentSeat) return null;

        return (
          <PositiveParticipationModal
            section={activeSection}
            seat={currentSeat}
            currentUser={currentUser}
            onClose={() => setActivePositiveParticipationModal(null)}
            onAddPositiveParticipation={handleAddPositiveParticipation}
            onDeletePositiveParticipation={handleDeletePositiveParticipation}
          />
        );
      })()}

      {/* Modal: Positive Participations Report & Honor Roll (لوحة شرف وسجل المشاركات الإيجابية والتعزيز) */}
      <PositiveParticipationsReportModal
        isOpen={showPositiveReportModal}
        onClose={() => {
          setShowPositiveReportModal(false);
          setPositiveReportInitialStudent(undefined);
        }}
        currentUser={currentUser}
        sections={sections}
        initialSectionId={activeSectionId || undefined}
        initialStudentName={positiveReportInitialStudent}
      />

      {/* Modal: Database Stats & Change History */}
      <DbInfoModal
        isOpen={showDbInfoModal}
        onClose={() => setShowDbInfoModal(false)}
        dbStats={dbStats}
        historyLogs={historyLogs}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        backupInputRef={backupInputRef}
        onRefresh={handleOpenDbInfo}
      />

      {/* Batch Import Modal (10 Sections & Students) */}
      <BatchImportModal
        isOpen={showBatchImportModal}
        onClose={() => setShowBatchImportModal(false)}
        onImportSuccess={() => {
          fetchInitialData();
        }}
        onToast={showToast}
      />

      {/* Authentication Modal (Login / Register / Forgot Password) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab={authModalTab}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Teacher Profile & Password Modal */}
      {currentUser && (
        <TeacherProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          currentUser={currentUser}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      {/* Teacher Section Assignment Request Modal */}
      {currentUser && (
        <TeacherAssignmentModal
          isOpen={showTeacherAssignmentModal}
          onClose={() => setShowTeacherAssignmentModal(false)}
          currentUser={currentUser}
          onSectionApprovedOrAssigned={handleSectionApprovedOrAssigned}
        />
      )}

      {/* Teacher Homework & Digital Lessons Modal */}
      {currentUser && (
        <TeacherHomeworkModal
          isOpen={showTeacherHomeworkModal}
          onClose={() => setShowTeacherHomeworkModal(false)}
          currentUser={currentUser}
          sections={sections}
        />
      )}

      {/* Teacher Leave & Absence Declaration Modal */}
      {currentUser && (
        <TeacherLeaveModal
          isOpen={showTeacherLeaveModal}
          onClose={() => setShowTeacherLeaveModal(false)}
          currentUser={currentUser}
          sections={sections}
        />
      )}

      {/* Director / Admin Approvals & Section Assignment Dashboard Modal */}
      <AdminApprovalsModal
        isOpen={showAdminApprovalsModal}
        onClose={() => setShowAdminApprovalsModal(false)}
        sections={sections}
        onRequestReviewedOrAssigned={handleSectionApprovedOrAssigned}
        currentUser={currentUser}
      />

      {/* Daily Archive Modal (سجل الغيابات اليومي المستقل) */}
      <DailyArchiveModal
        isOpen={showDailyArchiveModal}
        onClose={() => setShowDailyArchiveModal(false)}
        currentUser={currentUser}
        sections={sections}
      />

      {/* Independent Violations Register Modal (سجل المخالفات والانضباط المدرسي المستقل) */}
      <ViolationsRegisterModal
        isOpen={showViolationsRegisterModal}
        onClose={() => setShowViolationsRegisterModal(false)}
        currentUser={currentUser}
        sections={sections}
        settings={settings}
        onRefreshData={() => fetchInitialData(currentUser)}
      />

      {/* Roster Reorder & Renumber Modal (سحب وترتيب التلاميذ وتحيين الأرقام) */}
      {showRosterReorderModal && activeSection && (
        <RosterReorderModal
          isOpen={showRosterReorderModal}
          onClose={() => setShowRosterReorderModal(false)}
          section={activeSection}
          currentUser={currentUser}
          onRefresh={async () => {
            const secRes = await fetch('/api/sections', {
              headers: currentUser ? { 'x-user-id': currentUser.id, 'x-user-role': currentUser.role } : {}
            }).then((r) => r.json());
            if (secRes.success && Array.isArray(secRes.sections)) {
              setSections(secRes.sections);
            }
          }}
          onToast={showToast}
        />
      )}

      {/* Print Sheet Area (Only rendered when printing) */}
      {activeSeatModal && activeSection && (
        <div id="print-area" style={{ display: 'none' }}>
          <h1 className="print-sheet-title">{settings.institution || 'المؤسسة التعليمية'}</h1>
          <div className="print-sheet-sub">
            {settings.year ? `الموسم الدراسي: ${settings.year}` : ''}
          </div>

          <div className="print-info-grid">
            <div>
              <b>المستوى:</b> {activeSection.level}
            </div>
            <div>
              <b>القسم:</b> {activeSection.classNumber}
            </div>
            <div>
              <b>الأستاذ:</b> {activeSection.teacher || settings.teacher || '—'}
            </div>
            <div>
              <b>رقم المقعد:</b> {activeSeatModal.seatNum}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <b>اسم التلميذ:</b> {activeSeatModal.name || '—'}
            </div>
          </div>

          <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>سجل الملاحظات المسجلة:</h3>
          <table className="print-notes-table">
            <thead>
              <tr>
                <th style={{ width: '35px' }}>#</th>
                <th style={{ width: '130px' }}>التاريخ والساعة</th>
                <th>نص الملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {activeSeatModal.notes.map((n, idx) => (
                <tr key={n.id || idx}>
                  <td>{idx + 1}</td>
                  <td className="p-date">
                    {n.date} {n.time}
                  </td>
                  <td>{n.text}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-footer">
            تم استخراج هذه الوثيقة من منظومة المدرسة الرقمية بتاريخ {new Date().toLocaleDateString('ar-SA', { timeZone: 'UTC' })} (توقيت غرينتش GMT)
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponent: Individual Seat Card
// -------------------------------------------------------------
interface SeatCardProps {
  sectionId: string;
  seat: SeatItem;
  roster: RosterItem[];
  onSeatChange: (
    sectionId: string,
    seatNum: number,
    field: 'name' | 'number' | 'massarNumber' | 'rosterId' | 'statusColor' | 'attendance',
    value: any
  ) => void;
  onAssignStudent?: (
    sectionId: string,
    seatNum: number,
    student: { rosterId: string | null; name: string; number: string; massarNumber?: string }
  ) => void;
  onOpenNotes: () => void;
  onOpenPositiveParticipation?: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  isSelectedForSwap?: boolean;
  onDragStart?: (seatNum: number) => void;
  onDragOver?: (seatNum: number) => void;
  onDragLeave?: (seatNum: number) => void;
  onDrop?: (sourceSeat: number, targetSeat: number) => void;
  onDragEnd?: () => void;
  onSelectForSwap?: (seatNum: number) => void;
}

const SEAT_COLOR_OPTIONS: Array<{ id: SeatStatusColor; label: string; dot: string; bg: string }> = [
  { id: 'default', label: 'عادي (افتراضي)', dot: '#A8A29E', bg: '#F4EFDE' },
  { id: 'excellent', label: 'تلميذ متفوق', dot: '#10B981', bg: '#DCFCE7' },
  { id: 'needs_help', label: 'يحتاج مساعدة / دعم', dot: '#F59E0B', bg: '#FEF3C7' },
  { id: 'special_case', label: 'حالة خاصة (صحية/سمعية)', dot: '#0284C7', bg: '#E0F2FE' },
  { id: 'reserved', label: 'مقعد محجوز / فارغ', dot: '#A855F7', bg: '#F3E8FF' },
];

function SeatCard({
  sectionId,
  seat,
  roster,
  onSeatChange,
  onAssignStudent,
  onOpenNotes,
  onOpenPositiveParticipation,
  isDragging = false,
  isDropTarget = false,
  isSelectedForSwap = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onSelectForSwap
}: SeatCardProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close color picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    }
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);

  const hasRoster = roster && roster.length > 0;
  const hasStudent = Boolean(seat.name && seat.name.trim());
  const currentStatusColor = seat.statusColor || 'default';

  const handleSelectStudent = (rosterId: string) => {
    if (!rosterId) {
      if (onAssignStudent) {
        onAssignStudent(sectionId, seat.seat, { rosterId: null, name: '', number: '', massarNumber: '' });
      } else {
        onSeatChange(sectionId, seat.seat, 'rosterId', null);
      }
      return;
    }
    const student = roster.find((r) => r.id === rosterId);
    if (student) {
      if (onAssignStudent) {
        onAssignStudent(sectionId, seat.seat, {
          rosterId: student.id,
          name: student.name,
          number: student.number,
          massarNumber: student.massarNumber || ''
        });
      } else {
        onSeatChange(sectionId, seat.seat, 'rosterId', student.id);
        onSeatChange(sectionId, seat.seat, 'name', student.name);
        onSeatChange(sectionId, seat.seat, 'number', student.number);
        onSeatChange(sectionId, seat.seat, 'massarNumber', student.massarNumber || '');
      }
    }
  };

  const handleToggleAttendance = (status: 'present' | 'absent' | 'late') => {
    const nextVal = seat.attendance === status ? null : status;
    onSeatChange(sectionId, seat.seat, 'attendance', nextVal);
  };

  const handleSelectColor = (color: SeatStatusColor) => {
    onSeatChange(sectionId, seat.seat, 'statusColor', color);
    setShowColorPicker(false);
  };

  return (
    <div
      className={`seat status-${currentStatusColor} ${isDragging ? 'is-dragging' : ''} ${isDropTarget ? 'drop-target' : ''} ${isSelectedForSwap ? 'selected-for-swap' : ''} ${hasStudent ? 'is-draggable' : ''}`}
      id={`seat-${seat.seat}`}
      draggable={hasStudent}
      onDragStart={(e) => {
        if (!hasStudent) return;
        e.dataTransfer.setData('text/plain', String(seat.seat));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(seat.seat);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver?.(seat.seat);
      }}
      onDragLeave={() => onDragLeave?.(seat.seat)}
      onDrop={(e) => {
        e.preventDefault();
        const sourceSeatNum = Number(e.dataTransfer.getData('text/plain'));
        if (sourceSeatNum && sourceSeatNum !== seat.seat) {
          onDrop?.(sourceSeatNum, seat.seat);
        }
      }}
      onDragEnd={onDragEnd}
    >
      <span className="num">{seat.seat}</span>

      {/* Top Grip & Controls Bar */}
      <div className="seat-drag-bar">
        {hasStudent ? (
          <div
            className="drag-grip-btn"
            title="اضغط واسحب لتغيير مكان التلميذ وإسقاطه في مقعد آخر (Drag & Drop)"
          >
            <GripVertical className="w-3 h-3 text-amber-800 shrink-0" />
            <span>اسحب</span>
          </div>
        ) : (
          <span className="text-[10px] text-amber-900/60 font-medium">مقعد شاغر</span>
        )}

        <div className="flex items-center gap-1 relative" ref={colorPickerRef}>
          {/* Color Picker Button */}
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-1 rounded bg-[rgba(42,33,24,0.06)] hover:bg-[rgba(42,33,24,0.12)] border border-[rgba(42,33,24,0.14)] text-amber-900 transition-colors cursor-pointer"
            title="تلوين المقعد بحسب حالة التلميذ (متفوق، يحتاج مساعدة، محجوز...)"
          >
            <Palette className="w-3 h-3" />
          </button>

          {/* Color Dropdown Menu */}
          {showColorPicker && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-[#D6CEBA] shadow-lg rounded-xl p-1.5 z-30 min-w-[170px] text-right text-xs">
              <div className="text-[10px] font-bold text-gray-500 px-2 py-1 border-b border-gray-100 mb-1">
                تلوين المقعد:
              </div>
              {SEAT_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectColor(opt.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-gray-800 hover:bg-gray-100 ${
                    currentStatusColor === opt.id ? 'bg-amber-50 font-bold text-amber-900' : ''
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full border border-black/20"
                      style={{ backgroundColor: opt.dot }}
                    />
                    <span>{opt.label}</span>
                  </span>
                  {currentStatusColor === opt.id && <Check className="w-3.5 h-3.5 text-amber-700" />}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Special Status Tag Badge */}
      {currentStatusColor === 'excellent' && (
        <div className="mb-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 justify-center">
          <span>🟢 تلميذ متفوق</span>
        </div>
      )}
      {currentStatusColor === 'needs_help' && (
        <div className="mb-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 justify-center">
          <span>🟡 يحتاج مساعدة/دعم</span>
        </div>
      )}
      {currentStatusColor === 'special_case' && (
        <div className="mb-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1 justify-center">
          <span>🔵 حالة خاصة</span>
        </div>
      )}
      {currentStatusColor === 'reserved' && (
        <div className="mb-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1 justify-center">
          <span>🟣 مقعد محجوز / شاغر</span>
        </div>
      )}

      {/* Name field */}
      <div className="field">
        <label htmlFor={`seat-name-${seat.seat}`}>اسم التلميذ</label>
        <input
          id={`seat-name-${seat.seat}`}
          type="text"
          placeholder="اسم التلميذ"
          value={seat.name}
          onChange={(e) => onSeatChange(sectionId, seat.seat, 'name', e.target.value)}
        />
      </div>

      {/* Student Number field */}
      <div className="field">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`seat-num-input-${seat.seat}`} className="text-[10px] font-bold text-[#5B5040] block mb-0.5">
            رقم
          </label>
          <button
            type="button"
            onClick={() => onSelectForSwap?.(seat.seat)}
            className={`swap-action-btn ${isSelectedForSwap ? 'bg-blue-600 text-white font-bold' : ''}`}
            title={isSelectedForSwap ? 'إلغاء التحديد' : 'تحديد المقعد ثم النقر على مقعد آخر للتبديل'}
          >
            <ArrowLeftRight className="w-3 h-3 shrink-0" />
            <span>{isSelectedForSwap ? 'محدد ✓' : 'تبديل'}</span>
          </button>
        </div>
        {hasRoster ? (
          <select
            id={`seat-num-input-${seat.seat}`}
            value={seat.number}
            onChange={(e) => {
              const match = roster.find((item) => item.number === e.target.value);
              if (match) {
                handleSelectStudent(match.id);
              } else {
                onSeatChange(sectionId, seat.seat, 'number', e.target.value);
              }
            }}
            className="w-full text-xs font-mono text-center"
          >
            <option value="">— اختر الرقم —</option>
            {roster.map((r) => (
              <option key={r.id} value={r.number}>{r.number}</option>
            ))}
          </select>
        ) : (
          <input
            id={`seat-num-input-${seat.seat}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="1"
            value={seat.number}
            onChange={(e) => {
              const clean = e.target.value.replace(/[^0-9]/g, '');
              onSeatChange(sectionId, seat.seat, 'number', clean);
            }}
            className="w-full text-xs font-mono text-center"
          />
        )}
      </div>

      {/* Daily Attendance Recording Toolbar */}
      {hasStudent && (
        <div className="mt-2 pt-1.5 border-t border-[rgba(42,33,24,0.12)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#4F4335]">تسجيل الحضور:</span>
            {seat.attendance && (
              <span className={`attendance-tag ${seat.attendance}`}>
                {seat.attendance === 'present' && '✓ حاضر'}
                {seat.attendance === 'absent' && '✕ غائب'}
                {seat.attendance === 'late' && '⏳ متأخر'}
              </span>
            )}
          </div>
          {!seat.attendance && seat.previousSessionAbsence && (
            <div
              className="mb-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center justify-between truncate"
              title={`تغيب في حصة سابقة اليوم (${seat.previousSessionAbsence.sessionPeriod || ''} - الأستاذ: ${seat.previousSessionAbsence.teacherName || ''})`}
            >
              <span>⚠️ غائب في حصة سابقة</span>
              <span className="text-[8px] text-amber-700 font-mono">({seat.previousSessionAbsence.sessionPeriod || 'سابقة'})</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => handleToggleAttendance('present')}
              className={`py-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                seat.attendance === 'present'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
              title="تسجيل حضور"
            >
              ✓ حاضر
            </button>
            <button
              type="button"
              onClick={() => handleToggleAttendance('absent')}
              className={`py-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                seat.attendance === 'absent'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
              title="تسجيل غياب"
            >
              ✕ غائب
            </button>
            <button
              type="button"
              onClick={() => handleToggleAttendance('late')}
              className={`py-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                seat.attendance === 'late'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
              title="تسجيل تأخر"
            >
              ⏳ متأخر
            </button>
          </div>
        </div>
      )}

      {/* Actions: Positive Participation & Violations */}
      <div className="grid grid-cols-2 gap-1 mt-2">
        {(() => {
          const hasStudentName = Boolean(seat.name && seat.name.trim());
          const matchingParticipations = (seat.positiveParticipations || []).filter((p) =>
            hasStudentName && matchClientStudent(seat.name, seat.number, seat.massarNumber, p.studentName, p.studentNumber, p.massarNumber)
          );
          const positivePoints = hasStudentName
            ? (matchingParticipations.length > 0
                ? matchingParticipations.reduce((sum, p) => sum + (p.points || 1), 0)
                : (seat.positiveParticipationCount || 0))
            : 0;

          return (
            <button
              id={`seat-positive-btn-${seat.seat}`}
              type="button"
              className={`note-btn !mt-0 transition-all flex items-center justify-center gap-1 ${
                positivePoints > 0
                  ? '!bg-emerald-50 hover:!bg-emerald-100 !text-emerald-900 border !border-emerald-300 font-bold'
                  : '!bg-emerald-50/50 hover:!bg-emerald-100/60 !text-emerald-800 border !border-dashed !border-emerald-300'
              }`}
              onClick={onOpenPositiveParticipation || onOpenNotes}
              title={hasStudentName ? `تسجيل مشاركة إيجابية للتلميذ (${seat.name})` : 'مقعد شاغر بدون تلميذ'}
            >
              <span>⭐ مشاركة</span>
              {positivePoints > 0 && (
                <span className="badge !bg-emerald-700 !text-white font-black">+{positivePoints}</span>
              )}
            </button>
          );
        })()}

        {(() => {
          const violationsCount = seat.violations ? seat.violations.length : 0;

          return (
            <button
              id={`seat-violations-btn-${seat.seat}`}
              type="button"
              className={`note-btn !mt-0 transition-all flex items-center justify-center gap-1 ${
                violationsCount > 0
                  ? '!bg-rose-50 hover:!bg-rose-100 !text-rose-900 border !border-rose-300 font-bold'
                  : '!bg-[rgba(42,33,24,0.06)] hover:!bg-[rgba(42,33,24,0.12)]'
              }`}
              onClick={onOpenNotes}
              title="تسجيل وإدارة مخالفات التلميذ"
            >
              <span>⚠️ مخالفة</span>
              {violationsCount > 0 && (
                <span className="badge !bg-rose-700 !text-white font-black">{violationsCount}</span>
              )}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
