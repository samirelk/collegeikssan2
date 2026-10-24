import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  KeyRound,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  Lock,
  Download,
  Users,
  Phone,
  Camera,
  Upload,
  Check,
  X,
  ShieldCheck,
  Edit,
  Clock,
  Sparkles,
  UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Section, AppSettings } from '../types';
import { printReportHtml } from '../utils/printNotes';

export interface StudentAccountItem {
  id: string;
  massarNumber: string;
  studentName: string;
  sectionId: string;
  sectionLevel?: string;
  sectionClass?: string;
  studentNumber: string;
  accessCode: string;
  photoUrl?: string;
  guardianPhone?: string;
  guardianPhoneVerified?: boolean;
  profileCompleted?: boolean;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  approvalNotes?: string;
  approvedAt?: string;
  approvedBy?: string;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StudentAccountsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  settings: AppSettings;
}

export const StudentAccountsManagementModal: React.FC<StudentAccountsManagementModalProps> = ({
  isOpen,
  onClose,
  sections,
  settings
}) => {
  const [accounts, setAccounts] = useState<StudentAccountItem[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'incomplete'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionAccountId, setActionAccountId] = useState<string | null>(null);
  const [isBatchApproving, setIsBatchApproving] = useState(false);

  // Director Edit Modal State for Student Photo and Guardian Phone
  const [editingStudent, setEditingStudent] = useState<StudentAccountItem | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string>('');
  const [editGuardianPhone, setEditGuardianPhone] = useState<string>('');
  const [editApprovalStatus, setEditApprovalStatus] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [editCameraError, setEditCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preset student avatars for instant choice
  const presetAvatars = [
    'https://images.unsplash.com/photo-1544717305-2782549b5136?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=240&h=240&fit=crop&crop=faces&q=80'
  ];

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const url = selectedSectionId !== 'all' ? `/api/student/accounts?sectionId=${selectedSectionId}` : '/api/student/accounts';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setAccounts(json.accounts || []);
      }
    } catch (err: any) {
      setFeedback({ message: 'تعذر تحميل حسابات وأكواد التلاميذ', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen, selectedSectionId]);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Stop camera when closing edit modal or unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!editingStudent) {
      stopCamera();
    }
  }, [editingStudent]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  // Open Edit Modal for a student
  const openEditModal = (account: StudentAccountItem) => {
    setEditingStudent(account);
    setEditPhotoUrl(account.photoUrl || '');
    setEditGuardianPhone(account.guardianPhone || '');
    setEditApprovalStatus(account.approvalStatus || (account.guardianPhoneVerified ? 'approved' : 'approved'));
    setEditNotes(account.approvalNotes || '');
    setIsCameraActive(false);
    setEditCameraError(null);
  };

  const closeEditModal = () => {
    stopCamera();
    setEditCameraError(null);
    setEditingStudent(null);
  };

  // Camera handling for Director Edit
  const startCamera = async () => {
    setEditCameraError(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setEditCameraError('المتصفح لا يدعم الوصول المباشر للكاميرا في هذه البيئة. يرجى رفع صورة من جهازك.');
      setIsCameraActive(false);
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      setIsCameraActive(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.message?.includes('Permission denied')) {
        setEditCameraError('تم رفض صلاحية الكاميرا في المتصفح. يمكنك رفع صورة مباشرة من جهازك أو اختيار صورة جاهزة.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setEditCameraError('لم يتم العثور على كاميرا في هذا الجهاز. يرجى رفع صورة.');
      } else {
        setEditCameraError('تعذر فتح الكاميرا حالياً. يرجى رفع صورة من جهازك.');
      }
    }
  };

  if (!isOpen) return null;

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight) || 300;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setEditPhotoUrl(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditCameraError('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setEditPhotoUrl(resizedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Save Director Changes (Photo, Phone, Approval Status)
  const handleSaveStudentEdit = async () => {
    if (!editingStudent) return;
    setIsSavingEdit(true);

    try {
      const res = await fetch(`/api/student/accounts/${editingStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'director',
          'x-user-name': settings.institution || 'مدير المؤسسة'
        },
        body: JSON.stringify({
          photoUrl: editPhotoUrl,
          guardianPhone: editGuardianPhone.trim().replace(/\s+/g, ''),
          approvalStatus: editApprovalStatus,
          guardianPhoneVerified: editApprovalStatus === 'approved',
          approvalNotes: editNotes
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر حفظ تعديلات التلميذ');

      setAccounts(prev => prev.map(a => a.id === editingStudent.id ? {
        ...a,
        photoUrl: editPhotoUrl,
        guardianPhone: editGuardianPhone.trim().replace(/\s+/g, ''),
        approvalStatus: editApprovalStatus,
        guardianPhoneVerified: editApprovalStatus === 'approved',
        approvalNotes: editNotes
      } : a));

      setFeedback({
        message: `تم بنجاح تحديث وتثبيت صورة ورقم هاتف التلميذ (${editingStudent.studentName}) في قاعدة البيانات ✓`,
        type: 'success'
      });
      closeEditModal();
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Director single-click approve
  const handleApproveStudent = async (account: StudentAccountItem) => {
    setActionAccountId(account.id);
    try {
      const res = await fetch(`/api/student/accounts/${account.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'director',
          'x-user-name': settings.institution || 'مدير المؤسسة'
        }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر المصادقة على التلميذ');

      setAccounts(prev => prev.map(a => a.id === account.id ? {
        ...a,
        approvalStatus: 'approved',
        guardianPhoneVerified: true
      } : a));

      setFeedback({
        message: `تمت المصادقة على صورة ورقم هاتف التلميذ (${account.studentName}) رسمياً بنجاح ✓`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setActionAccountId(null);
    }
  };

  // Director batch approve all pending
  const handleBatchApprove = async () => {
    const pendingCount = accounts.filter(a => a.approvalStatus === 'pending' || (a.profileCompleted && !a.guardianPhoneVerified)).length;
    if (pendingCount === 0) {
      setFeedback({ message: 'لا توجد طلبات معلقة للمصادقة حالياً.', type: 'error' });
      return;
    }

    if (!confirm(`هل أنت متأكد من المصادقة على جميع الصور وأرقام الهواتف المعلقة (${pendingCount} تلميذاً) دفعة واحدة؟`)) {
      return;
    }

    setIsBatchApproving(true);
    try {
      const res = await fetch('/api/student/accounts/batch-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'director',
          'x-user-name': settings.institution || 'مدير المؤسسة'
        },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر إتمام المصادقة الجماعية');

      setAccounts(prev => prev.map(a => {
        if (a.approvalStatus === 'pending' || (a.profileCompleted && !a.guardianPhoneVerified)) {
          return { ...a, approvalStatus: 'approved', guardianPhoneVerified: true };
        }
        return a;
      }));

      setFeedback({
        message: json.message || `تمت المصادقة الجماعية بنجاح على ${json.count || pendingCount} تلميذاً ✓`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setIsBatchApproving(false);
    }
  };

  // Regenerate single student access code
  const handleRegenerateCode = async (id: string, name: string) => {
    setActionAccountId(id);
    try {
      const res = await fetch(`/api/student/accounts/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر توليد كود جديد');

      setAccounts(prev => prev.map(a => a.id === id ? { ...a, accessCode: json.newCode } : a));
      setFeedback({ message: `تم توليد كود جديد للتلميذ (${name}): ${json.newCode}`, type: 'success' });
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setActionAccountId(null);
    }
  };

  // Administration set custom student password
  const handleCustomCodePrompt = async (id: string, name: string, currentCode: string) => {
    const newCode = prompt(`أدخل كلمة المرور (PIN) الجديدة للتلميذ (${name}):`, currentCode);
    if (!newCode || !newCode.trim() || newCode.trim() === currentCode) return;
    try {
      setActionAccountId(id);
      const res = await fetch(`/api/student/accounts/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customCode: newCode.trim() })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر تعديل الكود');
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, accessCode: newCode.trim() } : a));
      setFeedback({ message: `تم تعديل كلمة مرور التلميذ (${name}) بنجاح إلى: ${newCode.trim()} وحفظها في قاعدة البيانات ✓`, type: 'success' });
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setActionAccountId(null);
    }
  };

  // Regenerate section access codes
  const handleRegenerateSectionCodes = async () => {
    if (selectedSectionId === 'all') {
      setFeedback({ message: 'يرجى تحديد قسم معين لتوليد أكواد تلاميذه', type: 'error' });
      return;
    }
    const secName = sections.find(s => s.id === selectedSectionId)?.classNumber || '';
    if (!confirm(`هل أنت متأكد من إعادة توليد أكواد سرية جديدة لجميع تلاميذ هذا القسم؟ ستتغير الأكواد القديمة.`)) {
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/student/accounts/section/${selectedSectionId}/regenerate`, {
        method: 'POST'
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر توليد الأكواد');

      setFeedback({ message: json.message || 'تم تحديث الأكواد بنجاح', type: 'success' });
      fetchAccounts();
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
      setIsLoading(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) {
      setFeedback({ message: 'لا توجد حسابات للتصدير', type: 'error' });
      return;
    }

    const rows = filteredAccounts.map((a, idx) => ({
      'الرقم الترتيبي': idx + 1,
      'الاسم الكامل للتلميذ': a.studentName,
      'المستوى': a.sectionLevel || '—',
      'القسم': a.sectionClass || '—',
      'رقم مسار (Code Massar)': a.massarNumber,
      'هاتف ولي الأمر': a.guardianPhone || 'غير مسجل',
      'حالة المصادقة': a.approvalStatus === 'approved' ? 'مصادق عليه من المدير ✓' : (a.approvalStatus === 'pending' ? 'في انتظار المصادقة ⏳' : 'غير مكتمل'),
      'الكود السري للدخول': a.accessCode,
      'آخر تاريخ تسجيل دخول': a.lastLogin ? a.lastLogin.slice(0, 16).replace('T', ' ') : 'لم يدخل بعد'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'أكواد_فضاء_التلميذ');

    const fileName = `أكواد_فضاء_التلميذ_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    setFeedback({ message: 'تم تصدير ملف الإكسيل بنجاح', type: 'success' });
  };

  // Print Student Login Slips
  const handlePrintSlips = () => {
    if (filteredAccounts.length === 0) {
      setFeedback({ message: 'لا توجد حسابات للطباعة', type: 'error' });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>بطاقات ولوج فضاء التلميذ - ${settings.institution}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body {
            font-family: 'Amiri', serif, system-ui;
            direction: rtl;
            background: #fff;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8mm;
          }
          .card {
            border: 2px dashed #999;
            border-radius: 8px;
            padding: 10px 14px;
            page-break-inside: avoid;
            background: #fafafa;
          }
          .header {
            border-bottom: 1px solid #ccc;
            padding-bottom: 4px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .title { font-weight: bold; font-size: 13px; color: #1A4E47; }
          .inst { font-size: 11px; color: #555; }
          .name { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
          .row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
          .label { color: #555; }
          .val { font-weight: bold; font-family: monospace; font-size: 13px; color: #1A4E47; }
          .pin { background: #e5e5e5; padding: 2px 8px; border-radius: 4px; font-size: 14px; letter-spacing: 2px; }
          .instructions { font-size: 10px; color: #666; margin-top: 6px; border-top: 1px solid #eee; padding-top: 4px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="grid">
          ${filteredAccounts.map(a => `
            <div class="card">
              <div class="header">
                <span class="title">بطاقة ولوج فضاء التلميذ</span>
                <span class="inst">${settings.institution}</span>
              </div>
              <div class="name">${a.studentName}</div>
              <div class="row">
                <span class="label">القسم:</span>
                <span class="val">${a.sectionLevel || ''} - ق ${a.sectionClass || ''}</span>
              </div>
              <div class="row">
                <span class="label">اسم الدخول (مسار):</span>
                <span class="val">${a.massarNumber}</span>
              </div>
              <div class="row">
                <span class="label">الكود السري (PIN):</span>
                <span class="val pin">${a.accessCode}</span>
              </div>
              <div class="instructions">
                ولوج المنصة: الدخول برقم مسار والكود السري أعلاه لمتابعة الغيابات، النقط والواجبات المدرسية.
              </div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    printReportHtml(html);
  };

  // Counts for tabs & filters
  const pendingCount = accounts.filter(a => a.approvalStatus === 'pending' || (a.profileCompleted && !a.guardianPhoneVerified)).length;
  const approvedCount = accounts.filter(a => a.approvalStatus === 'approved' || a.guardianPhoneVerified).length;
  const incompleteCount = accounts.filter(a => !a.photoUrl && !a.guardianPhone).length;

  // Filter accounts
  const filteredAccounts = accounts.filter(a => {
    // 1. Approval filter
    if (approvalFilter === 'pending') {
      const isPending = a.approvalStatus === 'pending' || (a.profileCompleted && !a.guardianPhoneVerified);
      if (!isPending) return false;
    } else if (approvalFilter === 'approved') {
      const isApproved = a.approvalStatus === 'approved' || a.guardianPhoneVerified;
      if (!isApproved) return false;
    } else if (approvalFilter === 'incomplete') {
      if (a.photoUrl || a.guardianPhone) return false;
    }

    // 2. Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      a.studentName.toLowerCase().includes(q) ||
      a.massarNumber.toLowerCase().includes(q) ||
      (a.guardianPhone && a.guardianPhone.includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !editingStudent) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-6xl w-full shadow-2xl border-2 border-[#C98A3C]/40 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1A4E47] text-white p-5 sm:p-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#133D37] border-2 border-[#C98A3C] flex items-center justify-center text-[#C98A3C] shadow-lg shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#C98A3C]/20 border border-[#C98A3C]/50 text-[#C98A3C] text-[10px] font-bold mb-1">
                <Sparkles className="w-3 h-3" />
                <span>إدارة المؤسسة • فضاء التلميذ</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-white tracking-wide">
                حسابات التلاميذ، المصادقة على الصور وأرقام الهواتف
              </h2>
              <p className="text-xs text-[#F2EFE3]/80 mt-0.5">
                تعديل وتحديث صور وأرقام هواتف التلاميذ وأولياء أمورهم، والمصادقة المباشرة عليها دون الحاجة لرسائل SMS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`px-5 py-3 text-xs flex items-center justify-between shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            <span className="font-bold flex items-center gap-1.5">
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              {feedback.message}
            </span>
            <button onClick={() => setFeedback(null)} className="font-bold hover:underline cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {/* Filters and Actions Bar */}
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E5DFD4] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم التلميذ، مسار أو الهاتف..."
                className="w-full pr-8 pl-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-white text-xs"
              />
              <Search className="w-3.5 h-3.5 text-[#6C6356] absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Section Filter */}
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-white font-semibold text-[#1F2926] text-xs"
            >
              <option value="all">كافة أقسام المؤسسة ({accounts.length} تلميذ)</option>
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.level} - القسم {sec.classNumber}
                </option>
              ))}
            </select>

            {/* Approval Status Filter */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#D5CDC0]">
              <button
                type="button"
                onClick={() => setApprovalFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  approvalFilter === 'all' ? 'bg-[#1A4E47] text-white shadow-2xs' : 'text-[#6C6356] hover:bg-gray-100'
                }`}
              >
                الكل ({accounts.length})
              </button>
              <button
                type="button"
                onClick={() => setApprovalFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                  approvalFilter === 'pending' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <span>في انتظار المصادقة</span>
                {pendingCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${approvalFilter === 'pending' ? 'bg-white text-amber-700' : 'bg-amber-200 text-amber-900'}`}>
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setApprovalFilter('approved')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  approvalFilter === 'approved' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                مصادق عليهم ({approvedCount})
              </button>
              <button
                type="button"
                onClick={() => setApprovalFilter('incomplete')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  approvalFilter === 'incomplete' ? 'bg-gray-700 text-white shadow-2xs' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                غير مكتمل ({incompleteCount})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Batch Approve Button */}
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={isBatchApproving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-[#1A4E47] hover:brightness-110 text-white font-bold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="المصادقة دفعة واحدة على جميع الصور وأرقام الهواتف المعلقة"
              >
                {isBatchApproving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C98A3C]" />
                )}
                <span>المصادقة على جميع المعلقين ({pendingCount}) ✓</span>
              </button>
            )}

            {selectedSectionId !== 'all' && (
              <button
                type="button"
                onClick={handleRegenerateSectionCodes}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                title="توليد أكواد جديدة لجميع تلاميذ هذا القسم"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تجديد أكواد القسم</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintSlips}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#D5CDC0] font-bold text-xs transition-all cursor-pointer shadow-xs"
              title="طباعة بطاقات ولوج التلاميذ الورقية للقص والتوزيع"
            >
              <Printer className="w-3.5 h-3.5 text-[#C98A3C]" />
              <span>طباعة البطاقات (Slips)</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
              title="تصدير الأكواد إلى ملف Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        {/* Accounts Table Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#6C6356]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1A4E47] mb-2" />
              <span>جاري تحميل حسابات وبيانات التلاميذ...</span>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#6C6356]">
              لا توجد حسابات تلاميذ مطابقة لمعايير البحث الحالية
            </div>
          ) : (
            <div className="border border-[#E5DFD4] rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E5DFD4] text-[#6C6356]">
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-3 text-center">الصورة الشخصية</th>
                    <th className="py-3 px-4">اسم التلميذ</th>
                    <th className="py-3 px-4">القسم والمستوى</th>
                    <th className="py-3 px-4">رقم مسار</th>
                    <th className="py-3 px-4">هاتف ولي الأمر (واتساب)</th>
                    <th className="py-3 px-4 text-center">حالة المصادقة</th>
                    <th className="py-3 px-4">الكود السري (PIN)</th>
                    <th className="py-3 px-4">آخر دخول</th>
                    <th className="py-3 px-4 text-center">إجراءات المدير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD4]">
                  {filteredAccounts.map((a, idx) => {
                    const isPending = a.approvalStatus === 'pending' || (a.profileCompleted && !a.guardianPhoneVerified);
                    const isApproved = a.approvalStatus === 'approved' || a.guardianPhoneVerified;

                    return (
                      <tr key={a.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-[#6C6356]">{idx + 1}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => openEditModal(a)}
                            className="relative group cursor-pointer inline-block"
                            title="انقر لتعديل أو تغيير الصورة"
                          >
                            {a.photoUrl ? (
                              <img
                                src={a.photoUrl}
                                alt={a.studentName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-[#C98A3C]/70 mx-auto shadow-xs group-hover:ring-2 group-hover:ring-[#1A4E47] transition-all"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center text-xs font-bold mx-auto group-hover:ring-2 group-hover:ring-[#1A4E47]">
                                {a.studentName.trim()[0] || 'ت'}
                              </div>
                            )}
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1A4E47] text-white flex items-center justify-center text-[9px] shadow-xs opacity-0 group-hover:opacity-100 transition-opacity">
                              ✎
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#1F2926]">
                          <div>{a.studentName}</div>
                          {a.studentNumber && (
                            <span className="text-[10px] text-[#6C6356] font-mono">رقم #{a.studentNumber}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#1A4E47]">
                          {a.sectionLevel || ''} - ق {a.sectionClass || ''}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-[#1A4E47]">
                          <code>{a.massarNumber}</code>
                        </td>
                        <td className="py-3 px-4">
                          {a.guardianPhone ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <a
                                href={`https://wa.me/${a.guardianPhone.replace(/\D/g, '').startsWith('0') ? '212' + a.guardianPhone.replace(/\D/g, '').slice(1) : a.guardianPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-mono text-xs font-bold border border-emerald-300 transition-colors"
                                title="انقر للمراسلة الفورية عبر واتساب"
                              >
                                <Phone className="w-3 h-3 text-emerald-700" />
                                <span>{a.guardianPhone}</span>
                              </a>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#A39989] italic">غير مسجل</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>مصادق عليه ✓</span>
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>في انتظار المصادقة ⏳</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">لم يقدم بعد</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#EFE9D5] border border-[#C98A3C]/40 text-[#1A4E47] tracking-widest inline-block">
                            {a.accessCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#6C6356]">
                          {a.lastLogin ? a.lastLogin.slice(0, 16).replace('T', ' ') : 'لم يدخل بعد'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Approve button if pending */}
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleApproveStudent(a)}
                                disabled={actionAccountId === a.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1 disabled:opacity-50"
                                title="المصادقة الفورية على صورة ورقم هاتف هذا التلميذ"
                              >
                                <Check className="w-3 h-3" />
                                <span>مصادقة ✓</span>
                              </button>
                            )}

                            {/* Director Edit button */}
                            <button
                              type="button"
                              onClick={() => openEditModal(a)}
                              className="px-2 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#D5CDC0] text-[11px] font-bold transition-all cursor-pointer shadow-xs inline-flex items-center gap-1"
                              title="تعديل الصورة ورقم هاتف ولي الأمر"
                            >
                              <Edit className="w-3 h-3 text-[#C98A3C]" />
                              <span>تعديل الصورة/الهاتف</span>
                            </button>

                            {/* Edit PIN button */}
                            <button
                              type="button"
                              onClick={() => handleCustomCodePrompt(a.id, a.studentName, a.accessCode)}
                              disabled={actionAccountId === a.id}
                              className="px-2 py-1 rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1 disabled:opacity-50"
                              title="تعديل كلمة مرور الدخول PIN"
                            >
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              <span>PIN</span>
                            </button>

                            {/* Regenerate PIN button */}
                            <button
                              type="button"
                              onClick={() => handleRegenerateCode(a.id, a.studentName)}
                              disabled={actionAccountId === a.id}
                              className="p-1 rounded-lg bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 transition-colors cursor-pointer disabled:opacity-50"
                              title="توليد كود دخول جديد عشوائي"
                            >
                              <RefreshCw className={`w-3 h-3 ${actionAccountId === a.id ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#E5DFD4] flex items-center justify-between text-xs text-[#6C6356] shrink-0">
          <div className="flex items-center gap-3">
            <span>إجمالي التلاميذ: <strong>{filteredAccounts.length}</strong></span>
            {pendingCount > 0 && (
              <span className="text-amber-700 font-bold">
                (في انتظار المصادقة: {pendingCount})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DIRECTOR EDIT MODAL: Update Student Photo & Guardian Phone */}
      {/* ======================================================== */}
      {editingStudent && (
        <div
          className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
          dir="rtl"
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border-2 border-[#C98A3C]/40 space-y-5 animate-in zoom-in-95 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5DFD4] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#1A4E47] text-[#C98A3C] flex items-center justify-center font-bold">
                  ✎
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F2926]">
                    تعديل صورة ورقم هاتف التلميذ
                  </h3>
                  <p className="text-xs text-[#6C6356]">
                    {editingStudent.studentName} ({editingStudent.massarNumber}) • {editingStudent.sectionLevel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Photo Section */}
            <div className="space-y-3 bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E5DFD4]">
              <label className="block text-xs font-bold text-[#1F2926]">
                الصورة الشخصية للتلميذ:
              </label>

              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#C98A3C] shadow-sm bg-white flex items-center justify-center">
                    {editPhotoUrl ? (
                      <img src={editPhotoUrl} alt="صورة التلميذ" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  {editPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditPhotoUrl('')}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-xs hover:bg-rose-700 cursor-pointer"
                      title="إزالة الصورة"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  {/* Camera view if open */}
                  {isCameraActive ? (
                    <div className="p-2 bg-black rounded-xl flex flex-col items-center gap-1.5">
                      <video ref={videoRef} autoPlay playsInline muted className="w-36 h-36 rounded-lg object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-3 py-1 rounded-lg bg-[#C98A3C] text-white font-bold text-xs"
                        >
                          التقاط
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-2 py-1 rounded-lg bg-gray-600 text-white text-xs"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3 py-1.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#C98A3C]" />
                        <span>تشغيل الكاميرا</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-[#1A4E47] border border-[#C5DDD8] font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#C98A3C]" />
                        <span>رفع صورة من الجهاز</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  )}

                  {editCameraError && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-950 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="text-[11px] leading-tight">{editCameraError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCameraError(null);
                          fileInputRef.current?.click();
                        }}
                        className="px-2 py-0.5 rounded-lg bg-[#1A4E47] hover:bg-[#133D37] text-white text-[10px] font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        اختيار صورة
                      </button>
                    </div>
                  )}

                  {/* Preset Avatars */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-[#6C6356] block w-full">صور جاهزة:</span>
                    {presetAvatars.map((av, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setEditPhotoUrl(av);
                          stopCamera();
                        }}
                        className={`w-7 h-7 rounded-lg overflow-hidden border transition-transform hover:scale-105 cursor-pointer ${
                          editPhotoUrl === av ? 'border-[#1A4E47] ring-2 ring-[#1A4E47]/40' : 'border-gray-200'
                        }`}
                      >
                        <img src={av} alt="avatar" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Guardian Phone Section */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1F2926]">
                رقم هاتف ولي الأمر (واتساب / إشعارات الغياب):
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={editGuardianPhone}
                  onChange={(e) => setEditGuardianPhone(e.target.value)}
                  placeholder="مثال: 0612345678 أو 0712345678"
                  className="w-full px-3 py-2 pr-9 rounded-xl border border-[#D5CDC0] focus:border-[#1A4E47] focus:ring-2 focus:ring-[#1A4E47]/20 outline-none text-xs font-mono font-bold bg-white text-left dir-ltr"
                />
                <Phone className="w-4 h-4 text-[#1A4E47] absolute right-3 top-2.5 pointer-events-none" />
              </div>
              <p className="text-[11px] text-[#6C6356]">
                يمكن لمدير المؤسسة إدخال أو تعديل رقم الهاتف مباشرة من استمارة التسجيل أو بطاقة التلميذ.
              </p>
            </div>

            {/* Approval Status Toggle */}
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-950">
                <input
                  type="checkbox"
                  checked={editApprovalStatus === 'approved'}
                  onChange={(e) => setEditApprovalStatus(e.target.checked ? 'approved' : 'pending')}
                  className="w-4 h-4 accent-[#1A4E47] rounded-sm cursor-pointer"
                />
                <span>مصادقة واعتماد رسمي مباشر من طرف مدير المؤسسة ✓</span>
              </label>
              <p className="text-[11px] text-emerald-800 pr-6">
                عند التأشير عليها، تصبح الصورة ورقم الهاتف معتمدين رسمياً في كافة لوائح الأقسام وسجلات الغياب دون الحاجة لأي رسالة SMS.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5DFD4]">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveStudentEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#1A4E47] to-[#133D37] text-white font-bold text-xs shadow-md hover:brightness-110 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#C98A3C]" />
                    <span>حفظ وتثبيت التعديلات ✓</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
