import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  UserPlus,
  KeyRound,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  Mail,
  Lock,
  User,
  Edit3
} from 'lucide-react';
import { DirectorItem, User as UserType } from '../types';

interface AdminDirectorsManagementProps {
  currentUser: UserType;
  onRefresh?: () => void;
}

export const AdminDirectorsManagement: React.FC<AdminDirectorsManagementProps> = ({
  currentUser
}) => {
  const [directors, setDirectors] = useState<DirectorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Director Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Director@2026');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('Director@2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit / Replace Director Modal
  const [editTarget, setEditTarget] = useState<DirectorItem | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAcademicYear, setEditAcademicYear] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<DirectorItem | null>(null);
  const [newDirectorPassword, setNewDirectorPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<DirectorItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auth headers for backend RBAC verification
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUser.id,
    'x-user-role': currentUser.role
  });

  useEffect(() => {
    fetchDirectors();
  }, []);

  const fetchDirectors = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/directors', {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success) {
        setDirectors(data.directors || []);
      } else {
        setErrorMessage(data.error || 'تعذر تحميل قائمة المدراء');
      }
    } catch {
      setErrorMessage('حدث خطأ أثناء الاتصال بالخادم لتحميل قائمة المدراء');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleToggleStatus = async (director: DirectorItem) => {
    const nextStatus = director.status === 'active' ? 'inactive' : 'active';
    setActionLoadingId(director.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/admin/directors/${director.id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || (nextStatus === 'active' ? 'تم تفعيل حساب المدير بنجاح' : 'تم تعطيل حساب المدير بنجاح'));
        setDirectors((prev) =>
          prev.map((d) => (d.id === director.id ? { ...d, status: nextStatus } : d))
        );
      } else {
        setErrorMessage(data.error || 'تعذر تغيير حالة حساب المدير');
      }
    } catch {
      setErrorMessage('حدث خطأ في الاتصال بالخادم لتحديث حالة المدير');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateDirector = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newFullName.trim() || !newUsername.trim() || !newEmail.trim()) {
      setAddError('يرجى تعبئة كافة الحقول المطلوبة');
      return;
    }
    if (newPassword.length < 4) {
      setAddError('كلمة المرور يجب أن لا تقل عن 4 خانات');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setAddError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/directors', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fullName: newFullName.trim(),
          username: newUsername.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          status: 'active'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('تمت إضافة حساب المدير وتفعيله بنجاح');
        setIsAddModalOpen(false);
        setNewFullName('');
        setNewUsername('');
        setNewEmail('');
        setNewPassword('Director@2026');
        setNewPasswordConfirm('Director@2026');
        fetchDirectors();
      } else {
        setAddError(data.error || 'فشل إنشاء حساب المدير');
      }
    } catch {
      setAddError('حدث خطأ أثناء الاتصال بالخادم لإنشاء الحساب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (dir: DirectorItem) => {
    setEditTarget(dir);
    setEditFullName(dir.fullName);
    setEditUsername(dir.username);
    setEditEmail(dir.email);
    setEditAcademicYear(dir.academicYear || '2026/2027');
    setEditPassword('');
    setEditStatus(dir.status === 'inactive' ? 'inactive' : 'active');
    setEditError(null);
  };

  const handleEditDirector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);

    if (!editFullName.trim() || !editUsername.trim() || !editEmail.trim()) {
      setEditError('يرجى تعبئة كافة الحقول الإلزامية');
      return;
    }
    if (editPassword.trim() && editPassword.trim().length < 4) {
      setEditError('كلمة المرور يجب أن لا تقل عن 4 خانات في حال الرغبة بتغييرها');
      return;
    }

    setIsEditing(true);
    try {
      const res = await fetch(`/api/admin/directors/${editTarget.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fullName: editFullName.trim(),
          username: editUsername.trim(),
          email: editEmail.trim().toLowerCase(),
          academicYear: editAcademicYear.trim(),
          password: editPassword.trim() ? editPassword.trim() : undefined,
          status: editStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`تم تحديث واستبدال بيانات مدير المؤسسة (${editFullName}) بنجاح`);
        setEditTarget(null);
        fetchDirectors();
      } else {
        setEditError(data.error || 'تعذر تعديل بيانات المدير');
      }
    } catch {
      setEditError('حدث خطأ أثناء الاتصال بالخادم لتعديل بيانات المدير');
    } finally {
      setIsEditing(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);

    if (!newDirectorPassword || newDirectorPassword.trim().length < 4) {
      setResetError('كلمة المرور يجب أن لا تقل عن 4 خانات');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch(`/api/admin/directors/${resetTarget.id}/reset-password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: newDirectorPassword.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`تم تغيير كلمة المرور للمدير (${resetTarget.fullName}) بنجاح`);
        setResetTarget(null);
        setNewDirectorPassword('');
      } else {
        setResetError(data.error || 'تعذر إعادة تعيين كلمة المرور');
      }
    } catch {
      setResetError('حدث خطأ أثناء الاتصال بالخادم لتحديث كلمة المرور');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteDirector = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/admin/directors/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`تم حذف حساب المدير (${deleteTarget.fullName}) بنجاح`);
        setDirectors((prev) => prev.filter((d) => d.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setErrorMessage(data.error || 'تعذر حذف حساب المدير');
      }
    } catch {
      setErrorMessage('حدث خطأ أثناء حذف حساب المدير من الخادم');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5DFD4] p-5 sm:p-6 shadow-xs">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5DFD4]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#E8F2F0] text-[#1A4E47] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1F2926]">
                إدارة حسابات إدارة المؤسسة (المدراء)
              </h2>
              <p className="text-xs text-[#6C6356] mt-0.5">
                صلاحية حصرية للمشرف العام: إضافة مدير، تفعيل أو تعطيل حسابه، وإعادة تعيين كلمة المرور
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              fetchDirectors();
            }}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-xl text-[#6C6356] hover:text-[#1A4E47] hover:bg-[#FAF8F5] border border-[#D5CDC0] transition-colors cursor-pointer"
            title="تحديث اللائحة"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1A4E47]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-xs cursor-pointer transition-all active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>＋ إضافة حساب مدير جديد</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMessage}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMessage}
          </span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Supervisor Authority Note */}
      <div className="mt-4 p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD4] text-xs text-[#5B5040] flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#1A4E47] shrink-0" />
        <span>
          أنت مسجل حالياً بصفتك <strong>المشرف العام ({currentUser.fullName})</strong>. الحسابات المعرفة هنا هي التي تمتلك صلاحية تسيير المنظومة ومصادقة إسناد الفصول واعتماد أنشطة الأساتذة.
        </span>
      </div>

      {/* Directors Table */}
      <div className="mt-5">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[#7A6B58] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#1A4E47]" />
            <span>جاري تحميل بيانات حسابات المدراء...</span>
          </div>
        ) : directors.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#7A6B58] bg-[#FAF8F5] rounded-xl border border-dashed border-[#D5CDC0]">
            <Building2 className="w-8 h-8 text-[#7A6B58] mx-auto mb-2 opacity-50" />
            <p className="font-bold text-[#1F2926]">لا يوجد حالياً أي حساب مدير مسجل</p>
            <p className="text-xs text-[#6C6356] mt-1">
              استخدم زر "＋ إضافة حساب مدير جديد" لتعيين مدير للمؤسسة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] text-[#1F2926] border-b border-[#E5DFD4]">
                  <th className="p-3 font-bold">المدير</th>
                  <th className="p-3 font-bold">اسم المستخدم / البريد</th>
                  <th className="p-3 font-bold">الصفة والموسم</th>
                  <th className="p-3 font-bold">الحالة الحالية</th>
                  <th className="p-3 font-bold">تاريخ الإنشاء</th>
                  <th className="p-3 font-bold text-center">إجراءات المشرف العام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD4]">
                {directors.map((dir) => (
                  <tr key={dir.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    
                    <td className="p-3 font-bold text-sm text-[#1F2926]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#E8F2F0] text-[#1A4E47] font-bold text-xs flex items-center justify-center shrink-0">
                          {dir.fullName.charAt(0)}
                        </div>
                        <div>
                          <div>{dir.fullName}</div>
                          <span className="text-[10px] font-normal text-[#6C6356]">مدير المؤسسة</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-[#5B5040]">
                      <div className="font-mono text-xs font-semibold text-[#1F2926]">{dir.username}</div>
                      <div className="text-[11px] text-[#6C6356]">{dir.email}</div>
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md bg-[#E8F2F0] text-[#1A4E47] font-bold text-[11px]">
                        مدير تربوي ({dir.academicYear || '2025/2026'})
                      </span>
                    </td>

                    <td className="p-3">
                      {dir.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> مفعل ونشط
                        </span>
                      ) : dir.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 text-amber-600" /> قيد المراجعة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3 text-rose-600" /> معطل وموقوف
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-[#6C6356] font-mono text-[11px]">
                      {dir.createdAt ? dir.createdAt.slice(0, 10) : '—'}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        
                        {/* Toggle Status (Activate / Deactivate) */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(dir)}
                          disabled={actionLoadingId === dir.id}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all border ${
                            dir.status === 'active'
                              ? 'border-[#D5CDC0] text-[#6C6356] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                          }`}
                          title={dir.status === 'active' ? 'تعطيل حساب المدير مؤقتاً' : 'تفعيل وتنشيط حساب المدير'}
                        >
                          {actionLoadingId === dir.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : dir.status === 'active' ? (
                            'تعطيل الحساب'
                          ) : (
                            'تفعيل الحساب'
                          )}
                        </button>

                        {/* Edit / Replace Director Data */}
                        <button
                          type="button"
                          onClick={() => openEditModal(dir)}
                          className="p-1.5 rounded-lg border border-[#D5CDC0] text-[#6C6356] hover:text-[#1A4E47] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                          title="تعديل أو استبدال بيانات المدير"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Reset Password */}
                        <button
                          type="button"
                          onClick={() => {
                            setResetError(null);
                            setNewDirectorPassword('');
                            setResetTarget(dir);
                          }}
                          className="p-1.5 rounded-lg border border-[#D5CDC0] text-[#6C6356] hover:text-[#1A4E47] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                          title="إعادة تعيين كلمة المرور للمدير"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Director */}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(dir)}
                          className="p-1.5 rounded-lg border border-[#D5CDC0] text-[#6C6356] hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
                          title="حذف حساب المدير نهائياً"
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

      {/* Modal: Add New Director */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5DFD4] animate-in fade-in zoom-in duration-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#1A4E47]" />
                <h3 className="font-bold text-base text-[#1F2926]">إضافة حساب مدير جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {addError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                {addError}
              </div>
            )}

            <form onSubmit={handleCreateDirector} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  الاسم الكامل للسيد المدير <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="مثال: السيد المدير: عبد الله العمراني"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  اسم المستخدم (للتسجيل) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="مثال: directeur"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  البريد الإلكتروني الرسمي <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="directeur@example.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono text-left"
                  dir="ltr"
                />
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

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>سيتم تفعيل حساب المدير فورياً بمجرد تأكيد الإضافة بواسطة المشرف العام.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الإنشاء...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>تأكيد إنشاء حساب المدير</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Modal: Reset Director Password */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E5DFD4]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#1A4E47]" />
                <h3 className="font-bold text-sm text-[#1F2926]">تغيير كلمة مرور المدير</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#6C6356] mt-3">
              تعيين كلمة مرور جديدة لحساب <strong>{resetTarget.fullName}</strong> ({resetTarget.username})
            </p>

            {resetError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  required
                  value={newDirectorPassword}
                  onChange={(e) => setNewDirectorPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-3 py-1.5 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-3.5 py-1.5 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit / Replace Director Data */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5DFD4] animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#1A4E47]" />
                <h3 className="font-bold text-base text-[#1F2926]">تعديل / استبدال بيانات المدير</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditDirector} className="space-y-3.5 mt-4 text-xs">
              {editError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {editError}
                </div>
              )}

              <div>
                <label className="block font-bold text-[#1F2926] mb-1">الاسم الكامل للمدير *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#7A6B58] absolute right-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="مثال: ذ. عبد الرحمن العلوي"
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
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="director.iksan"
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47] font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1F2926] mb-1">الموسم الدراسي</label>
                  <input
                    type="text"
                    value={editAcademicYear}
                    onChange={(e) => setEditAcademicYear(e.target.value)}
                    placeholder="2026/2027"
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47] font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F2926] mb-1">البريد الإلكتروني الرسمي *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#7A6B58] absolute right-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="director@iksan.edu.ma"
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
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="اتركه فارغاً للإبقاء عليها"
                      className="w-full pr-9 pl-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1F2926] mb-1">حالة الحساب</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl focus:outline-none focus:border-[#1A4E47]"
                  >
                    <option value="active">مفعل ونشط</option>
                    <option value="inactive">معطل وموقوف</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                💡 <strong>ملاحظة المشرف العام:</strong> يمكنك استبدال المدير الحالي بمدير جديد بتحديث الاسم والبريد واسم المستخدم وكلمة المرور هنا مباشرة.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-4 py-2 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isEditing ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Director */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E5DFD4]">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <h3 className="font-bold text-sm text-center text-[#1F2926]">
              تأكيد حذف حساب المدير
            </h3>
            
            <p className="text-xs text-center text-[#6C6356] mt-2">
              هل أنت متأكد من رغبتك في حذف حساب المدير <strong>{deleteTarget.fullName}</strong> ({deleteTarget.username})؟ لن يتمكن هذا المستخدم من تسجيل الدخول بعد الآن.
            </p>

            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl border border-[#D5CDC0] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteDirector}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'جاري الحذف...' : 'نعم، حذف الحساب'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
