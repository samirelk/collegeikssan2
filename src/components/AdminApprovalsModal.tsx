import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Users,
  Layers,
  Mail,
  Send,
  Trash2,
  RefreshCw,
  AlertCircle,
  KeyRound,
  FileText,
  UserCheck,
  UserPlus,
  Building2
} from 'lucide-react';
import { SectionAssignmentRequest, SectionItem, SentEmail, User as UserType } from '../types';
import { AdminDirectorsManagement } from './AdminDirectorsManagement';

interface TeacherItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  academicYear: string;
  status: string;
  subject?: string;
  emailVerified?: boolean;
  createdAt: string;
  assignedSectionsCount: number;
}

interface AdminApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: SectionItem[];
  onRequestReviewedOrAssigned: () => void;
  currentUser?: UserType | null;
}

export const AdminApprovalsModal: React.FC<AdminApprovalsModalProps> = ({
  isOpen,
  onClose,
  sections,
  onRequestReviewedOrAssigned,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'direct' | 'teachers' | 'directors' | 'outbox'>('requests');
  const [requests, setRequests] = useState<SectionAssignmentRequest[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [outboxEmails, setOutboxEmails] = useState<SentEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Direct assign form state
  const [directSectionId, setDirectSectionId] = useState('');
  const [directTeacherId, setDirectTeacherId] = useState('');

  // Add teacher form state
  const [showAddTeacherForm, setShowAddTeacherForm] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherUsername, setNewTeacherUsername] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('123456');
  const [newTeacherSubject, setNewTeacherSubject] = useState('الرياضيات');
  const [newTeacherYear, setNewTeacherYear] = useState('2025/2026');

  useEffect(() => {
    if (isOpen) {
      loadAllAdminData();
    }
  }, [isOpen]);

  const loadAllAdminData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const authHeaders: Record<string, string> = currentUser ? {
        'x-user-id': currentUser.id,
        'x-user-role': currentUser.role
      } : {};
      const [reqRes, teachRes, emailRes] = await Promise.all([
        fetch('/api/assignment-requests').then((r) => r.json()),
        fetch('/api/auth/teachers', { headers: authHeaders }).then((r) => r.json()),
        fetch('/api/emails/outbox?limit=50').then((r) => r.json())
      ]);

      if (reqRes.success && Array.isArray(reqRes.requests)) {
        setRequests(reqRes.requests);
      }
      if (teachRes.success && Array.isArray(teachRes.teachers)) {
        setTeachers(teachRes.teachers);
      }
      if (emailRes.success && Array.isArray(emailRes.emails)) {
        setOutboxEmails(emailRes.emails);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء تحميل بيانات الإدارة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (requestId: string, decision: 'approved' | 'rejected') => {
    setActionLoadingId(requestId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/assignment-requests/${requestId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerId: 'admin' })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت معالجة الطلب');
      }

      setSuccessMessage(
        decision === 'approved'
          ? 'تمت الموافقة على طلب إسناد القسم بنجاح، وأصبح بإمكان الأستاذ الآن إدارة التلاميذ والمقاعد.'
          : 'تم رفض طلب الإسناد وإشعار الأستاذ.'
      );

      await loadAllAdminData();
      onRequestReviewedOrAssigned();
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء اتخاذ القرار');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDirectAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directSectionId || !directTeacherId) {
      setErrorMessage('يرجى تحديد القسم والأستاذ لإتمام الإسناد');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/sections/${directSectionId}/assign-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: directTeacherId })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر إسناد القسم');
      }

      setSuccessMessage('تم إسناد القسم إلى الأستاذ مباشرة بنجاح.');
      setDirectSectionId('');
      setDirectTeacherId('');
      await loadAllAdminData();
      onRequestReviewedOrAssigned();
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء الإسناد المباشر');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassign = async (sectionId: string, teacherId?: string, teacherName?: string) => {
    const confirmMsg = teacherName 
      ? `هل تريد إلغاء إسناد الأستاذ (${teacherName}) من هذا القسم؟`
      : 'هل تريد إلغاء إسناد هذا القسم؟';
    if (!window.confirm(confirmMsg)) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/sections/${sectionId}/unassign-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر إلغاء الإسناد');
      }

      setSuccessMessage('تم إلغاء إسناد الأستاذ من القسم بنجاح.');
      await loadAllAdminData();
      onRequestReviewedOrAssigned();
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء إلغاء الإسناد');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string, teacherName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب الأستاذ (${teacherName}) وإلغاء إسناد أي أقسام مرتبطة به؟`)) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const authHeaders: Record<string, string> = currentUser ? {
        'x-user-id': currentUser.id,
        'x-user-role': currentUser.role
      } : {};
      const res = await fetch(`/api/auth/teachers/${teacherId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر حذف الحساب');
      }

      setSuccessMessage(`تم حذف حساب الأستاذ ${teacherName} بنجاح.`);
      await loadAllAdminData();
      onRequestReviewedOrAssigned();
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء حذف الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualVerifyEmail = async (teacherId: string, teacherName: string, email: string) => {
    if (!window.confirm(`هل ترغب في تأكيد البريد الإلكتروني (${email}) للأستاذ "${teacherName}" يدوياً؟`)) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/manual-verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: teacherId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر تأكيد البريد يدوياً');
      }

      setSuccessMessage(`تم تأكيد بريد الأستاذ (${teacherName}) بنجاح`);
      await loadAllAdminData();
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء تأكيد البريد');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherUsername.trim() || !newTeacherEmail.trim() || !newTeacherPassword.trim()) {
      setErrorMessage('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/auth/admin-create-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newTeacherName.trim(),
          username: newTeacherUsername.trim(),
          email: newTeacherEmail.trim(),
          password: newTeacherPassword,
          subject: newTeacherSubject,
          academicYear: newTeacherYear.trim() || '2025/2026'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر إنشاء حساب الأستاذ');
      }

      setSuccessMessage(`تم إنشاء حساب الأستاذ "${newTeacherName}" بنجاح! كلمة المرور: ${newTeacherPassword}`);
      setShowAddTeacherForm(false);
      setNewTeacherName('');
      setNewTeacherUsername('');
      setNewTeacherEmail('');
      setNewTeacherPassword('123456');
      await loadAllAdminData();
      onRequestReviewedOrAssigned();
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  return (
    <div
      id="modal-admin-approvals"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,18,14,0.85)] backdrop-blur-sm animate-fadeIn"
      dir="rtl"
    >
      <div className="relative w-full max-w-4xl bg-[#1E362D] border border-[rgba(242,239,227,0.2)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[rgba(242,239,227,0.12)] bg-[#172B24] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#2A4F40] border border-[#C98A3C]/40 flex items-center justify-center text-[#C98A3C] shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-[#F2EFE3]">
                  لوحة المشرف العام (مدير المؤسسة)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#C98A3C] text-[#1E362D] text-[11px] font-bold">
                  admin
                </span>
              </div>
              <p className="text-xs text-[rgba(242,239,227,0.6)] mt-0.5">
                الثانوية الإعدادية ايكسان • الموافقة على طلبات إسناد الأقسام، إدارة الأساتذة ومتابعة البريد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAllAdminData}
              className="text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3] hover:bg-[rgba(255,255,255,0.08)] p-2 rounded-xl transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#C98A3C]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3] hover:bg-[rgba(255,255,255,0.08)] w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 pb-0 bg-[#172B24] border-b border-[rgba(242,239,227,0.08)] flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            id="admin-tab-requests"
            onClick={() => setActiveTab('requests')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'border-[#C98A3C] text-[#C98A3C]'
                : 'border-transparent text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>طلبات الإسناد بانتظار الموافقة</span>
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-mono font-bold">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="admin-tab-direct"
            onClick={() => setActiveTab('direct')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'direct'
                ? 'border-[#C98A3C] text-[#C98A3C]'
                : 'border-transparent text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>الإسناد المباشر للأقسام</span>
          </button>

          <button
            type="button"
            id="admin-tab-teachers"
            onClick={() => setActiveTab('teachers')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'teachers'
                ? 'border-[#C98A3C] text-[#C98A3C]'
                : 'border-transparent text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>الأساتذة المسجلون ({teachers.length})</span>
          </button>

          {/* Director Management Tab (Only for General Supervisor) */}
          {(!currentUser || currentUser.role === 'admin') && (
            <button
              type="button"
              id="admin-tab-directors"
              onClick={() => setActiveTab('directors')}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'directors'
                  ? 'border-[#C98A3C] text-[#C98A3C]'
                  : 'border-transparent text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3]'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>إدارة المدراء</span>
            </button>
          )}

          <button
            type="button"
            id="admin-tab-outbox"
            onClick={() => setActiveTab('outbox')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'outbox'
                ? 'border-[#C98A3C] text-[#C98A3C]'
                : 'border-transparent text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3]'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>صندوق البريد الصادر ({outboxEmails.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: PENDING REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#172B24] rounded-2xl border border-[rgba(242,239,227,0.1)] text-xs text-[rgba(242,239,227,0.8)] leading-relaxed">
                <span className="font-bold text-[#C98A3C]">دور المشرف (المدير):</span> كما هو مطلوب بنظام المؤسسة، لا تظهر أسماء التلاميذ وأرقامهم وتوزيع المقاعد لأي أستاذ إلا بعد موافقتك على طلب إسناد القسم. بمجرد الضغط على «موافقة وإسناد»، يتم فتح القسم للأستاذ فوراً.
              </div>

              {requests.length === 0 ? (
                <div className="py-12 text-center text-xs text-[rgba(242,239,227,0.5)] bg-[rgba(0,0,0,0.15)] rounded-2xl border border-[rgba(242,239,227,0.08)]">
                  لا توجد طلبات إسناد مقدمة حالياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const isRejected = req.status === 'rejected';

                    return (
                      <div
                        key={req.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isPending
                            ? 'bg-[#172B24] border-amber-500/40 shadow-sm'
                            : isApproved
                            ? 'bg-[#172B24]/70 border-emerald-500/30'
                            : 'bg-[#172B24]/40 border-rose-500/20 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          
                          {/* Teacher & Section Details */}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#F2EFE3] text-sm">
                                {req.teacherName}
                              </span>
                              <span className="text-xs text-[rgba(242,239,227,0.5)]">
                                ({req.teacherEmail})
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-[#2A4F40] text-[#C98A3C] text-xs font-bold">
                                {req.level} - القسم {req.classNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 text-xs border border-emerald-500/30">
                                مادة: {(req as any).teacherSubject || 'عام'}
                              </span>
                            </div>

                            {req.requestNote && (
                              <div className="mt-1.5 p-2 rounded-xl bg-[rgba(0,0,0,0.25)] text-xs text-[rgba(242,239,227,0.85)] border border-[rgba(242,239,227,0.06)]">
                                <span className="text-[rgba(242,239,227,0.5)] text-[10px] block">ملاحظة الأستاذ:</span>
                                {req.requestNote}
                              </div>
                            )}

                            <div className="text-[11px] text-[rgba(242,239,227,0.4)] mt-1.5 flex items-center gap-2">
                              <span>تاريخ الطلب: {new Date(req.requestedAt).toLocaleString('ar-MA')}</span>
                              {req.reviewedAt && (
                                <>
                                  <span>•</span>
                                  <span>تاريخ المراجعة: {new Date(req.reviewedAt).toLocaleString('ar-MA')}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons or Status Badge */}
                          <div className="shrink-0 flex items-center gap-2">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  disabled={actionLoadingId === req.id}
                                  onClick={() => handleReview(req.id, 'rejected')}
                                  className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-200 text-xs font-bold border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  رفض
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoadingId === req.id}
                                  onClick={() => handleReview(req.id, 'approved')}
                                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>موافقة وإسناد</span>
                                </button>
                              </>
                            ) : isApproved ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تمت الموافقة والإسناد</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-950 text-rose-300 text-xs font-bold border border-rose-500/40">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>مرفوض</span>
                              </span>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIRECT ASSIGNMENT */}
          {activeTab === 'direct' && (
            <div className="space-y-4">
              <form onSubmit={handleDirectAssign} className="p-4 rounded-2xl bg-[#172B24] border border-[rgba(242,239,227,0.12)] space-y-3">
                <h4 className="text-sm font-bold text-[#F2EFE3] flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#C98A3C]" />
                  <span>إسناد قسم لأستاذ مباشرة بدون انتظار طلب</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                      اختر القسم:
                    </label>
                    <select
                      value={directSectionId}
                      onChange={(e) => setDirectSectionId(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                    >
                      <option value="">-- اختر القسم المراد إسناده --</option>
                      {sections.map((s) => {
                        const teachersList = s.assignedTeachers && s.assignedTeachers.length > 0
                          ? s.assignedTeachers.map(t => `${t.teacherName} (${t.subject})`).join('، ')
                          : s.assignedTeacherName ? s.assignedTeacherName : 'غير مسند';
                        return (
                          <option key={s.id} value={s.id}>
                            {s.level} - القسم {s.classNumber} [الأساتذة: {teachersList}]
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                      اختر الأستاذ:
                    </label>
                    <select
                      value={directTeacherId}
                      onChange={(e) => setDirectTeacherId(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                    >
                      <option value="">-- اختر الأستاذ المسجل --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName} (مادة: {t.subject || 'عام'}) - {t.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(() => {
                  const selSec = sections.find(s => s.id === directSectionId);
                  const selTeacher = teachers.find(t => t.id === directTeacherId);
                  if (!selSec || !selTeacher) return null;

                  const conflict = (selSec.assignedTeachers || []).find(
                    t => t.teacherId !== selTeacher.id &&
                      (t.subject || 'عام').trim().toLowerCase() === (selTeacher.subject || 'عام').trim().toLowerCase()
                  );

                  if (conflict) {
                    return (
                      <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>
                          تنبيه: مادة {selTeacher.subject || 'عام'} مسندة مسبقاً للأستاذ ({conflict.teacherName}). يمكن إسناد نفس القسم لأساتذة مواد مختلفة.
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    id="btn-submit-direct-assign"
                    disabled={isLoading || (() => {
                      const selSec = sections.find(s => s.id === directSectionId);
                      const selTeacher = teachers.find(t => t.id === directTeacherId);
                      if (!selSec || !selTeacher) return false;
                      return !!(selSec.assignedTeachers || []).find(
                        t => t.teacherId !== selTeacher.id &&
                          (t.subject || 'عام').trim().toLowerCase() === (selTeacher.subject || 'عام').trim().toLowerCase()
                      );
                    })()}
                    className="px-5 py-2.5 rounded-xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الإسناد المباشر</span>
                  </button>
                </div>
              </form>

              {/* Existing Sections Assignment Status */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[rgba(242,239,227,0.7)]">
                  حالة إسناد أقسام المؤسسة حالياً (إسناد القسم لأساتذة مواد دراسية مختلفة):
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {sections.map((sec) => {
                    const teachersList = sec.assignedTeachers && sec.assignedTeachers.length > 0
                      ? sec.assignedTeachers
                      : sec.assignedTeacherId && sec.assignedTeacherName
                      ? [{ teacherId: sec.assignedTeacherId, teacherName: sec.assignedTeacherName, subject: 'عام' }]
                      : [];

                    return (
                      <div
                        key={sec.id}
                        className="p-3.5 rounded-2xl bg-[#172B24] border border-[rgba(242,239,227,0.1)] text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-[#F2EFE3] text-sm flex items-center gap-2">
                            <span>{sec.level}</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#2A4F40] text-[#C98A3C] font-mono font-bold text-xs">
                              القسم {sec.classNumber}
                            </span>
                          </div>
                          <span className="text-[10px] text-[rgba(242,239,227,0.5)] font-semibold">
                            {teachersList.length > 0 ? `${teachersList.length} أستاذ مسند` : 'غير مسند'}
                          </span>
                        </div>

                        {teachersList.length === 0 ? (
                          <div className="text-[11px] text-[rgba(242,239,227,0.4)] py-1">
                            غير مسند لأي أستاذ حالياً
                          </div>
                        ) : (
                          <div className="space-y-1.5 pt-1">
                            {teachersList.map((t, idx) => (
                              <div
                                key={t.teacherId || idx}
                                className="flex items-center justify-between gap-2 p-1.5 px-2 rounded-xl bg-[#1E362D] border border-[rgba(242,239,227,0.08)]"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-[#F2EFE3]">{t.teacherName}</span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-[#2A4F40] text-[#C98A3C] text-[10px] font-bold">
                                    {t.subject || 'عام'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleUnassign(sec.id, t.teacherId, t.teacherName)}
                                  className="px-2 py-0.5 rounded-lg bg-rose-950/50 text-rose-300 hover:bg-rose-900 border border-rose-500/30 text-[10px] transition-colors cursor-pointer"
                                  title={`إلغاء إسناد ${t.teacherName} من هذا القسم`}
                                >
                                  إلغاء الإسناد
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: REGISTERED TEACHERS */}
          {activeTab === 'teachers' && (
            <div className="space-y-4">
              {/* Header with Add Teacher toggle */}
              <div className="flex items-center justify-between gap-3 p-3 bg-[#172B24] rounded-2xl border border-[rgba(242,239,227,0.1)]">
                <div>
                  <h4 className="text-xs font-bold text-[#F2EFE3]">قائمة الأساتذة المسجلين بالمؤسسة ({teachers.length})</h4>
                  <p className="text-[11px] text-[rgba(242,239,227,0.55)]">يمكنك إضافة أستاذ جديد أو حذف حساب أستاذ أو متابعة إسناد الأقسام</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddTeacherForm(!showAddTeacherForm)}
                  className="px-3.5 py-2 rounded-xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{showAddTeacherForm ? 'إلغاء الإضافة' : '➕ إضافة أستاذ جديد'}</span>
                </button>
              </div>

              {/* Add Teacher Form */}
              {showAddTeacherForm && (
                <form onSubmit={handleAdminCreateTeacher} className="p-4 rounded-2xl bg-[#172B24] border border-[#C98A3C]/40 space-y-3 animate-fadeIn">
                  <div className="text-xs font-bold text-[#C98A3C] flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4" />
                    <span>إدخال بيانات الأستاذ الجديد</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                        الاسم الكامل:
                      </label>
                      <input
                        type="text"
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        placeholder="مثال: ذ. خالد الصالحي"
                        required
                        className="w-full px-3 py-2 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                        اسم المستخدم:
                      </label>
                      <input
                        type="text"
                        value={newTeacherUsername}
                        onChange={(e) => setNewTeacherUsername(e.target.value)}
                        placeholder="مثال: prof_salhi"
                        required
                        className="w-full px-3 py-2 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                        البريد الإلكتروني:
                      </label>
                      <input
                        type="email"
                        value={newTeacherEmail}
                        onChange={(e) => setNewTeacherEmail(e.target.value)}
                        placeholder="teacher@example.com"
                        required
                        className="w-full px-3 py-2 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                        المادة المُدرَّسة:
                      </label>
                      <select
                        value={newTeacherSubject}
                        onChange={(e) => setNewTeacherSubject(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                      >
                        {[
                          'الرياضيات',
                          'الفيزياء والكيمياء',
                          'علوم الحياة والأرض',
                          'اللغة العربية',
                          'اللغة الفرنسية',
                          'اللغة الإنجليزية',
                          'التاريخ والجغرافيا',
                          'التربية الإسلامية',
                          'التكنولوجيا',
                          'الإعلاميات',
                          'التربية البدنية',
                          'التربية التشكيلية',
                          'التربية الموسيقية',
                          'فلسفة / أخرى'
                        ].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                        كلمة المرور الأولية:
                      </label>
                      <input
                        type="text"
                        value={newTeacherPassword}
                        onChange={(e) => setNewTeacherPassword(e.target.value)}
                        placeholder="123456"
                        required
                        className="w-full px-3 py-2 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] font-mono focus:outline-none focus:border-[#C98A3C]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                        الموسم الدراسي:
                      </label>
                      <input
                        type="text"
                        value={newTeacherYear}
                        onChange={(e) => setNewTeacherYear(e.target.value)}
                        placeholder="2025/2026"
                        required
                        className="w-full px-3 py-2 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] focus:outline-none focus:border-[#C98A3C]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddTeacherForm(false)}
                      className="px-3.5 py-2 rounded-xl text-xs text-[rgba(242,239,227,0.7)] hover:bg-[rgba(255,255,255,0.08)] cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-5 py-2 rounded-xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      حفظ وإنشاء الحساب
                    </button>
                  </div>
                </form>
              )}

              {teachers.length === 0 ? (
                <div className="py-12 text-center text-xs text-[rgba(242,239,227,0.5)] bg-[rgba(0,0,0,0.15)] rounded-2xl border border-[rgba(242,239,227,0.08)]">
                  لم يسجل أي أستاذ حسابه حتى الآن.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teachers.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl bg-[#172B24] border border-[rgba(242,239,227,0.1)] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#2A4F40] flex items-center justify-center text-[#C98A3C] font-bold text-xs">
                              {t.fullName.slice(0, 1)}
                            </div>
                            <div>
                              <div className="font-bold text-[#F2EFE3] text-xs flex items-center gap-2">
                                <span>{t.fullName}</span>
                                {t.subject && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#2A4F40] text-[#C98A3C] text-[10px] font-medium border border-[#C98A3C]/20">
                                    {t.subject}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-[rgba(242,239,227,0.5)] flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>{t.email}</span>
                                <span>•</span>
                                <span>@{t.username}</span>
                                {t.emailVerified ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 text-[10px] font-sans font-bold border border-emerald-500/30">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>مؤكد البريد</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleManualVerifyEmail(t.id, t.fullName, t.email)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 text-[10px] font-sans font-medium border border-amber-500/30 hover:bg-amber-900 transition-colors cursor-pointer"
                                    title="تأكيد البريد الإلكتروني يدوياً"
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>تأكيد البريد يدوياً</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeacher(t.id, t.fullName)}
                            className="p-1.5 text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                            title="حذف الحساب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="mt-3 p-2 rounded-xl bg-[rgba(0,0,0,0.2)] text-[11px] text-[rgba(242,239,227,0.7)] flex justify-between">
                          <span>الموسم الدراسي: <strong className="text-[#F2EFE3]">{t.academicYear}</strong></span>
                          <span>الأقسام المسندة: <strong className="text-[#C98A3C] font-mono">{t.assignedSectionsCount}</strong></span>
                        </div>
                      </div>

                      <div className="text-[10px] text-[rgba(242,239,227,0.4)] mt-2 pt-2 border-t border-[rgba(242,239,227,0.06)]">
                        تاريخ التسجيل: {new Date(t.createdAt).toLocaleDateString('ar-MA')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: OUTBOX EMAILS */}
          {activeTab === 'outbox' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#172B24] rounded-2xl border border-[rgba(242,239,227,0.1)] text-xs text-[rgba(242,239,227,0.8)] leading-relaxed">
                <span className="font-bold text-[#C98A3C]">سجل البريد الصادر للمؤسسة:</span> يتم توثيق كافة الرسائل الصادرة الخاصة باستعادة كلمات المرور وتنبيهات الموافقة على طلبات الأساتذة فور إرسالها لضمان عدم ضياع أي بيانات دخول.
              </div>

              {outboxEmails.length === 0 ? (
                <div className="py-12 text-center text-xs text-[rgba(242,239,227,0.5)] bg-[rgba(0,0,0,0.15)] rounded-2xl border border-[rgba(242,239,227,0.08)]">
                  لا توجد رسائل صادرة في السجل حتى الآن.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {outboxEmails.map((em) => (
                    <div
                      key={em.id}
                      className="p-3.5 rounded-2xl bg-[#172B24] border border-[rgba(242,239,227,0.1)] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-[#C98A3C]" />
                          <span className="font-bold text-[#F2EFE3]">{em.subject}</span>
                        </div>
                        <div className="text-[10px] text-[rgba(242,239,227,0.45)]">
                          {new Date(em.sentAt).toLocaleString('ar-MA')}
                        </div>
                      </div>

                      <div className="text-[11px] text-[rgba(242,239,227,0.7)] flex items-center gap-2">
                        <span>إلى:</span>
                        <span className="font-mono text-[#F2EFE3]">{em.to}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[rgba(0,0,0,0.3)] text-[10px] font-mono text-[#C98A3C]">
                          {em.type}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[rgba(0,0,0,0.3)] text-xs text-[rgba(242,239,227,0.85)] font-mono whitespace-pre-wrap leading-relaxed border border-[rgba(242,239,227,0.06)]">
                        {em.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Directors Management (General Supervisor Only) */}
          {activeTab === 'directors' && (
            <div className="space-y-4">
              <AdminDirectorsManagement
                currentUser={currentUser || {
                  id: 'usr_admin_samir',
                  username: 'admin',
                  email: 'mrsamiro69@gmail.com',
                  fullName: 'الأستاذ: سمير القراشي (المشرف العام)',
                  role: 'admin',
                  academicYear: '2025/2026',
                  status: 'active',
                  createdAt: ''
                }}
              />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgba(242,239,227,0.12)] bg-[#172B24] flex justify-between items-center shrink-0">
          <div className="text-xs text-[rgba(242,239,227,0.7)] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C98A3C]" />
            <span>فضاء المشرف العام وإدارة المؤسسة • الثانوية الإعدادية ايكسان</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-xs font-bold text-[#F2EFE3] transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
