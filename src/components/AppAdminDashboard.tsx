import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  Database,
  UserPlus,
  Trash2,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  LogOut,
  ExternalLink,
  Lock,
  Mail,
  User,
  Search,
  Filter,
  Layers,
  BookOpen,
  Edit3,
  Download,
  Eye,
  Activity,
  Smartphone,
  MessageSquare
} from 'lucide-react';
import { User as UserType, TeacherItem, TEACHER_SUBJECTS, TeacherSubject, AppSettings } from '../types';
import { AdminDirectorsManagement } from './AdminDirectorsManagement';
import { VisitorManagement } from './VisitorManagement';
import { AndroidSmsGatewayManagement } from './AndroidSmsGatewayManagement';

interface AppAdminDashboardProps {
  currentUser: UserType;
  settings: AppSettings;
  onLogout: () => void;
  onNavigateHome: () => void;
  onOpenDbModal: () => void;
}

export const AppAdminDashboard: React.FC<AppAdminDashboardProps> = ({
  currentUser,
  settings,
  onLogout,
  onNavigateHome,
  onOpenDbModal
}) => {
  const [activeTab, setActiveTab] = useState<'directors' | 'teachers' | 'system' | 'visitors' | 'sms-gateway'>('directors');

  // Teachers State
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState('all');
  const [actionTeacherId, setActionTeacherId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Teacher Modal
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Teacher@2026');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('Teacher@2026');
  const [newSubject, setNewSubject] = useState<TeacherSubject>('الرياضيات');
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [teacherCreateError, setTeacherCreateError] = useState<string | null>(null);

  // Edit Teacher Modal
  const [editTeacherTarget, setEditTeacherTarget] = useState<TeacherItem | null>(null);
  const [editTeacherFullName, setEditTeacherFullName] = useState('');
  const [editTeacherUsername, setEditTeacherUsername] = useState('');
  const [editTeacherEmail, setEditTeacherEmail] = useState('');
  const [editTeacherSubject, setEditTeacherSubject] = useState<TeacherSubject>('الرياضيات');
  const [editTeacherPassword, setEditTeacherPassword] = useState('');
  const [editTeacherStatus, setEditTeacherStatus] = useState<'active' | 'inactive'>('active');
  const [isEditingTeacher, setIsEditingTeacher] = useState(false);
  const [editTeacherError, setEditTeacherError] = useState<string | null>(null);

  // Reset Teacher Password Modal
  const [resettingTeacher, setResettingTeacher] = useState<TeacherItem | null>(null);
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete Teacher Modal
  const [deleteTeacherTarget, setDeleteTeacherTarget] = useState<TeacherItem | null>(null);
  const [isDeletingTeacher, setIsDeletingTeacher] = useState(false);

  // Auth headers for backend RBAC verification
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUser.id,
    'x-user-role': currentUser.role
  });

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setIsLoadingTeachers(true);
    try {
      const res = await fetch('/api/auth/teachers', {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success) {
        setTeachers(data.teachers || []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingTeachers(false);
    }
  };

  const handleCreateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherCreateError(null);

    if (newPassword !== newPasswordConfirm) {
      setTeacherCreateError('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    try {
      setIsCreatingTeacher(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fullName: newFullName.trim(),
          username: newUsername.trim(),
          email: newEmail.trim(),
          password: newPassword,
          role: 'teacher',
          subject: newSubject,
          academicYear: settings.year || '2026/2027'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر تسجيل الأستاذ');
      }

      setSuccessMessage(`تمت إضافة الأستاذ (${newFullName}) بنجاح`);
      setIsAddTeacherOpen(false);
      setNewFullName('');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('Teacher@2026');
      setNewPasswordConfirm('Teacher@2026');
      fetchTeachers();
    } catch (err: any) {
      setTeacherCreateError(err.message);
    } finally {
      setIsCreatingTeacher(false);
    }
  };

  const openEditTeacherModal = (teacher: TeacherItem) => {
    setEditTeacherTarget(teacher);
    setEditTeacherFullName(teacher.fullName);
    setEditTeacherUsername(teacher.username);
    setEditTeacherEmail(teacher.email);
    setEditTeacherSubject(teacher.subject as TeacherSubject || 'الرياضيات');
    setEditTeacherPassword('');
    setEditTeacherStatus(teacher.status === 'inactive' ? 'inactive' : 'active');
    setEditTeacherError(null);
  };

  const handleEditTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeacherTarget) return;
    setEditTeacherError(null);

    if (!editTeacherFullName.trim() || !editTeacherUsername.trim() || !editTeacherEmail.trim()) {
      setEditTeacherError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (editTeacherPassword.trim() && editTeacherPassword.trim().length < 4) {
      setEditTeacherError('كلمة المرور يجب أن لا تقل عن 4 خانات في حال الرغبة بتغييرها');
      return;
    }

    try {
      setIsEditingTeacher(true);
      const res = await fetch(`/api/auth/teachers/${editTeacherTarget.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fullName: editTeacherFullName.trim(),
          username: editTeacherUsername.trim(),
          email: editTeacherEmail.trim(),
          subject: editTeacherSubject,
          password: editTeacherPassword.trim() ? editTeacherPassword.trim() : undefined,
          status: editTeacherStatus
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'تعذر تحديث بيانات الأستاذ');
      }

      setSuccessMessage(`تم تحديث بيانات الأستاذ (${editTeacherFullName}) بنجاح`);
      setEditTeacherTarget(null);
      fetchTeachers();
    } catch (err: any) {
      setEditTeacherError(err.message);
    } finally {
      setIsEditingTeacher(false);
    }
  };

  const handleToggleTeacherStatus = async (teacher: TeacherItem) => {
    const nextStatus = teacher.status === 'active' ? 'inactive' : 'active';
    setActionTeacherId(teacher.id);
    try {
      const res = await fetch(`/api/auth/teachers/${teacher.id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر تغيير حالة حساب الأستاذ');

      setSuccessMessage(`تم ${nextStatus === 'active' ? 'تفعيل' : 'تعطيل'} حساب الأستاذ بنجاح`);
      fetchTeachers();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionTeacherId(null);
    }
  };

  const handleResetTeacherPassword = async (e: React.FormEvent) => {
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
      if (!data.success) throw new Error(data.error || 'تعذر تعيين كلمة المرور');

      setSuccessMessage(`تم تحديث كلمة المرور للأستاذ (${resettingTeacher.fullName}) بنجاح`);
      setResettingTeacher(null);
      setNewTeacherPassword('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteTeacherConfirm = async () => {
    if (!deleteTeacherTarget) return;
    try {
      setIsDeletingTeacher(true);
      const res = await fetch(`/api/auth/teachers/${deleteTeacherTarget.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر حذف حساب الأستاذ');

      setSuccessMessage(`تم حذف الأستاذ (${deleteTeacherTarget.fullName}) نهائياً من النظام`);
      setDeleteTeacherTarget(null);
      fetchTeachers();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsDeletingTeacher(false);
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    if (teacherSearch.trim()) {
      const q = teacherSearch.trim().toLowerCase();
      const matchName = t.fullName.toLowerCase().includes(q);
      const matchUser = t.username.toLowerCase().includes(q);
      const matchEmail = t.email.toLowerCase().includes(q);
      if (!matchName && !matchUser && !matchEmail) return false;
    }
    if (teacherSubjectFilter !== 'all' && t.subject !== teacherSubjectFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F4F0E8] flex flex-col justify-between" dir="rtl">
      {/* Super-Admin Topbar */}
      <header className="w-full bg-[#1A4E47] text-white py-3.5 px-4 sm:px-8 border-b border-[#C98A3C]/40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#133D37] border-2 border-[#C98A3C]/60 flex items-center justify-center text-[#C98A3C] shadow-md">
              <ShieldCheck className="w-6 h-6 text-[#C98A3C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold font-['Amiri',serif] tracking-wide text-white">
                  لوحة المشرف العام على التطبيق (/admin)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#C98A3C]/20 border border-[#C98A3C]/40 text-[#C98A3C] font-bold text-[10px]">
                  المشرف العام
                </span>
              </div>
              <div className="text-xs text-[#F2EFE3]/80 mt-0.5">
                الأستاذ: سمير القراشي • الموسم الحالي: <strong className="text-white font-mono">{settings.year || '2026/2027'}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/20 shadow-xs"
              title="معاينة واجهة المؤسسة والأساتذة"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#C98A3C]" />
              <span>معاينة واجهة المؤسسة المدرسية</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-900/30 hover:bg-rose-900/50 text-rose-200 text-xs font-bold transition-all cursor-pointer border border-rose-700/30"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {/* Role Explanation Card */}
        <div className="p-5 rounded-3xl bg-white border border-[#E5DFD4] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#1A4E47] text-white font-bold text-xs">
                صلاحيات المشرف العام على التطبيق
              </span>
              <span className="text-xs text-[#6C6356]">
                فصل الصلاحيات الإدارية
              </span>
            </div>
            <h2 className="text-xl font-bold font-['Amiri',serif] text-[#1F2926]">
              الإشراف الشامل على المدراء والأساتذة وقاعدة البيانات
            </h2>
            <p className="text-xs text-[#6C6356] mt-1 max-w-3xl leading-relaxed">
              المشرف العام هو المشرف على النظام: يضيف مدير، يزيل مدير. يضيف أستاذ، يزيل أستاذ، ويدير النسخ الاحتياطي المركزي. أما مدير المؤسسة فهو المسير الإداري للمؤسسة (الأقسام، التلاميذ، الأرشيف اليومي، والمواسم الدراسية).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenDbModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#D5CDC0] font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Database className="w-4 h-4 text-[#1A4E47]" />
              <span>إدارة النسخ الاحتياطي</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-shake">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-xs font-bold hover:underline cursor-pointer">إغلاق</button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-xs font-bold hover:underline cursor-pointer">إغلاق</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white p-1.5 rounded-2xl border border-[#E5DFD4] shadow-xs flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('directors')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'directors'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>إدارة مدراء المؤسسة (يضيف مدير / يزيل مدير)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('teachers')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'teachers'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>إدارة الأساتذة (يضيف أستاذ / يزيل أستاذ)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {teachers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'system'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>صيانة النظام والنسخ الاحتياطي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('visitors')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'visitors'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Eye className="w-4 h-4 text-[#C98A3C]" />
            <span>إحصائيات وزوار التطبيق (المباشر)</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sms-gateway')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'sms-gateway'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>بوابة واتساب (WhatsApp Cloud)</span>
          </button>
        </div>

        {/* TAB 1: DIRECTORS MANAGEMENT */}
        {activeTab === 'directors' && (
          <div className="space-y-4">
            <AdminDirectorsManagement currentUser={currentUser} />
          </div>
        )}

        {/* TAB 2: TEACHERS MANAGEMENT */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            {/* Header / Add Teacher Bar */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <input
                    type="text"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    placeholder="بحث باسم الأستاذ أو المعرف..."
                    className="w-64 pr-9 pl-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                  />
                  <Search className="w-4 h-4 text-[#6C6356] absolute right-3 top-1/2 -translate-y-1/2" />
                </div>

                <select
                  value={teacherSubjectFilter}
                  onChange={(e) => setTeacherSubjectFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                >
                  <option value="all">كافة المواد ({teachers.length})</option>
                  {TEACHER_SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsAddTeacherOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة أستاذ جديد</span>
              </button>
            </div>

            {/* Teachers Table */}
            <div className="bg-white rounded-2xl border border-[#E5DFD4] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E5DFD4] bg-[#FAF8F5] flex items-center justify-between">
                <span className="font-bold text-xs text-[#1F2926]">
                  قائمة الأساتذة المسجلين ({filteredTeachers.length})
                </span>
                <span className="text-[11px] text-[#6C6356]">
                  يمكن للمشرف العام تفعيل أو تعطيل الحساب، إعادة تعيين كلمة المرور، أو حذف الأستاذ نهائياً.
                </span>
              </div>

              {isLoadingTeachers ? (
                <div className="p-8 text-center text-xs text-[#6C6356]">جارٍ تحميل الأساتذة...</div>
              ) : filteredTeachers.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6C6356]">لا يوجد أساتذة مطابقون.</div>
              ) : (
                <div className="divide-y divide-[#E5DFD4]">
                  {filteredTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#FAF8F5] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#E8F2F0] text-[#1A4E47] border border-[#D5CDC0] flex items-center justify-center font-bold text-sm shrink-0">
                          {teacher.fullName.charAt(0) || 'أ'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#1F2926]">
                              {teacher.fullName}
                            </span>
                            {teacher.subject && (
                              <span className="px-2 py-0.5 rounded-full bg-[#E8F2F0] text-[#1A4E47] font-bold text-[10px] border border-[#1A4E47]/20">
                                مادة {teacher.subject}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                teacher.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {teacher.status === 'active' ? 'نشط' : 'معطل'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6C6356] mt-0.5 flex items-center gap-2 font-mono" dir="ltr">
                            <span>@{teacher.username}</span>
                            <span>•</span>
                            <span>{teacher.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions for teacher */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Toggle Status */}
                        <button
                          type="button"
                          disabled={actionTeacherId === teacher.id}
                          onClick={() => handleToggleTeacherStatus(teacher)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            teacher.status === 'active'
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {teacher.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                        </button>

                        {/* Edit Teacher Data */}
                        <button
                          type="button"
                          onClick={() => openEditTeacherModal(teacher)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-white text-[#1F2926] font-bold text-xs border border-[#D5CDC0] transition-all cursor-pointer"
                          title="تعديل بيانات الأستاذ"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#6C6356]" />
                          <span>تعديل</span>
                        </button>

                        {/* Reset Password */}
                        <button
                          type="button"
                          onClick={() => {
                            setResettingTeacher(teacher);
                            setNewTeacherPassword('');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-white text-[#1F2926] font-bold text-xs border border-[#D5CDC0] transition-all cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#6C6356]" />
                          <span>كلمة المرور</span>
                        </button>

                        {/* Delete Teacher */}
                        <button
                          type="button"
                          onClick={() => setDeleteTeacherTarget(teacher)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer"
                          title="حذف الأستاذ نهائياً من التطبيق"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>حذف الأستاذ</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM & DATABASE */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#E8F2F0] text-[#1A4E47] flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F2926] font-['Amiri',serif]">
                    قاعدة بيانات النظام والنسخ الاحتياطي المركزي
                  </h3>
                  <p className="text-xs text-[#6C6356]">
                    المحرك يعتمد على SQLite المدمج المحمي، مع دعم كامل للتصدير والاسترجاع في ثوانٍ معدودة.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#E5DFD4]">
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4]">
                  <span className="text-xs text-[#6C6356] block">الموسم المعتمد</span>
                  <span className="text-xl font-bold font-mono text-[#1F2926] mt-1 block">
                    {settings.year || '2026/2027'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4]">
                  <span className="text-xs text-[#6C6356] block">المؤسسة التعليمية</span>
                  <span className="text-base font-bold text-[#1F2926] mt-1 block">
                    {settings.institution || 'الثانوية الإعدادية ايكسان'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4]">
                  <span className="text-xs text-[#6C6356] block">حالة قاعدة البيانات</span>
                  <span className="text-base font-bold text-emerald-700 mt-1 block flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    متصلة ونشطة
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenDbModal}
                  className="px-5 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  <Database className="w-4 h-4 text-[#C98A3C]" />
                  <span>فتح نافذة النسخ الاحتياطي والاسترجاع</span>
                </button>

                <a
                  href="/api/export-php-package"
                  download="echsa_php_mysql_complete_package.tar.gz"
                  className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 no-underline"
                  title="تحميل حزمة PHP & MySQL الكاملة للاستضافة على cPanel / XAMPP / InfinityFree"
                >
                  <Download className="w-4 h-4 text-amber-200" />
                  <span>تصدير حزمة PHP & MySQL للاستضافات المجانية (cPanel / XAMPP)</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VISITORS TRACKING & REALTIME STATS (Admin only) */}
        {activeTab === 'visitors' && (
          <div className="space-y-4">
            <VisitorManagement currentUser={currentUser} />
          </div>
        )}

        {/* TAB 5: ANDROID SMS GATEWAY & WHATSAPP MANAGEMENT */}
        {activeTab === 'sms-gateway' && (
          <div className="space-y-4">
            <AndroidSmsGatewayManagement />
          </div>
        )}
      </main>

      {/* Modal: Add Teacher */}
      {isAddTeacherOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E5DFD4] animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#1A4E47]" />
                <h3 className="font-bold text-sm text-[#1F2926] font-['Amiri',serif]">
                  إضافة أستاذ جديد بواسطة المشرف العام
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTeacherOpen(false)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {teacherCreateError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{teacherCreateError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeacherSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  الاسم الكامل للأستاذ
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="مثال: ذ. عبد الرحيم التازي"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  مادة التدريس
                </label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value as TeacherSubject)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                >
                  {TEACHER_SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">
                    اسم المستخدم (Login)
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="prof_tazi"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="tazi@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">
                    كلمة المرور
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">
                    تأكيد كلمة المرور
                  </label>
                  <input
                    type="password"
                    required
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setIsAddTeacherOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTeacher}
                  className="px-4 py-2 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isCreatingTeacher ? 'جاري الإضافة...' : 'تأكيد إضافة الأستاذ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Teacher Data */}
      {editTeacherTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E5DFD4] animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#1A4E47]" />
                <h3 className="font-bold text-base text-[#1F2926]">تعديل بيانات الأستاذ</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditTeacherTarget(null)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditTeacherSubmit} className="space-y-3.5 mt-4 text-xs">
              {editTeacherError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {editTeacherError}
                </div>
              )}

              <div>
                <label className="block font-bold text-[#1F2926] mb-1">الاسم الكامل *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#7A6B58] absolute right-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={editTeacherFullName}
                    onChange={(e) => setEditTeacherFullName(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1F2926] mb-1">اسم المستخدم *</label>
                  <input
                    type="text"
                    required
                    value={editTeacherUsername}
                    onChange={(e) => setEditTeacherUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47] font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1F2926] mb-1">المادة المدرسة *</label>
                  <select
                    value={editTeacherSubject}
                    onChange={(e) => setEditTeacherSubject(e.target.value as TeacherSubject)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47]"
                  >
                    {TEACHER_SUBJECTS.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F2926] mb-1">البريد الإلكتروني *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#7A6B58] absolute right-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={editTeacherEmail}
                    onChange={(e) => setEditTeacherEmail(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47] font-mono text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1F2926] mb-1">كلمة مرور جديدة (اختياري)</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#7A6B58] absolute right-3 top-2.5" />
                    <input
                      type="password"
                      value={editTeacherPassword}
                      onChange={(e) => setEditTeacherPassword(e.target.value)}
                      placeholder="اتركه فارغاً للإبقاء عليها"
                      className="w-full pr-9 pl-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1F2926] mb-1">حالة الحساب</label>
                  <select
                    value={editTeacherStatus}
                    onChange={(e) => setEditTeacherStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47]"
                  >
                    <option value="active">مفعل ونشط</option>
                    <option value="inactive">معطل وموقوف</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setEditTeacherTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isEditingTeacher}
                  className="px-4 py-2 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isEditingTeacher ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Teacher Password */}
      {resettingTeacher && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E5DFD4]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#1A4E47]" />
                <h3 className="font-bold text-sm text-[#1F2926]">تغيير كلمة مرور الأستاذ</h3>
              </div>
              <button
                type="button"
                onClick={() => setResettingTeacher(null)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#6C6356] mt-3">
              تعيين كلمة مرور جديدة لحساب <strong>{resettingTeacher.fullName}</strong>
            </p>

            <form onSubmit={handleResetTeacherPassword} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  required
                  value={newTeacherPassword}
                  onChange={(e) => setNewTeacherPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingTeacher(null)}
                  className="px-3 py-1.5 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-4 py-1.5 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isResettingPassword ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Teacher */}
      {deleteTeacherTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E5DFD4]">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-base text-center text-[#1F2926] font-['Amiri',serif]">
              حذف حساب الأستاذ ({deleteTeacherTarget.fullName})
            </h3>

            <p className="text-xs text-[#6C6356] text-center mt-2 leading-relaxed">
              هل أنت متأكد من حذف هذا الأستاذ نهائياً؟ سيتم إلغاء إسناد أي أقسام مرتبطة به.
            </p>

            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTeacherTarget(null)}
                className="px-4 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeletingTeacher}
                onClick={handleDeleteTeacherConfirm}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeletingTeacher ? 'جارٍ الحذف...' : 'تأكيد الحذف نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
