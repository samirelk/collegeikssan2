import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  AlertTriangle,
  UserX,
  CheckCircle2,
  X,
  Phone,
  RefreshCw,
  Sparkles,
  Users,
  ShieldAlert,
  Edit2,
  Check,
  Copy,
  Zap,
  Info
} from 'lucide-react';

export type NotificationType = 'absence' | 'violation' | 'summons' | 'custom';

export interface StudentNotificationItem {
  studentName: string;
  massarNumber?: string;
  sectionId?: string;
  sectionLevel?: string;
  sectionClass?: string;
  guardianPhone?: string;
  photoUrl?: string;
  type?: NotificationType;
  details?: {
    date?: string;
    time?: string;
    subject?: string;
    reason?: string;
    count?: number;
  };
}

interface ParentNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: StudentNotificationItem | null;
  batchStudents?: StudentNotificationItem[];
  institutionName?: string;
  onSuccess?: () => void;
}

export const ParentNotificationModal: React.FC<ParentNotificationModalProps> = ({
  isOpen,
  onClose,
  student,
  batchStudents,
  institutionName = 'المدرسة الإلكترونية',
  onSuccess
}) => {
  const isBatch = Boolean(batchStudents && batchStudents.length > 0);

  // Single mode state
  const [phone, setPhone] = useState('');
  const [notifType, setNotifType] = useState<NotificationType>('absence');
  const [customText, setCustomText] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Batch mode state
  const [batchList, setBatchList] = useState<StudentNotificationItem[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ sent: number; total: number; failed: number } | null>(null);
  const [failedList, setFailedList] = useState<{ studentName: string; phone: string; error?: string }[]>([]);

  // Populate data when modal opens
  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      setFailedList([]);
      return;
    }

    if (isBatch && batchStudents) {
      setBatchList(batchStudents);
      setNotifType(batchStudents[0]?.type || 'absence');
      setFailedList([]);
    } else if (student) {
      const initialType = student.type || 'absence';
      setNotifType(initialType);
      
      const p = student.guardianPhone || '';
      setPhone(p);
      setIsEditingPhone(!p);

      // Fetch fresh phone from DB if empty
      if (!p && student.massarNumber) {
        fetch(`/api/admin/student-guardian-info?massarNumber=${encodeURIComponent(student.massarNumber)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.info?.guardianPhone) {
              setPhone(data.info.guardianPhone);
              setIsEditingPhone(false);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, student, batchStudents, isBatch]);

  // Generate standard Moroccan message text
  const generateMessageText = (
    sName: string,
    type: NotificationType,
    details?: { date?: string; time?: string; subject?: string; reason?: string; count?: number },
    secName?: string
  ): string => {
    const d = details?.date || new Date().toLocaleDateString('ar-MA');
    const childRef = sName ? `ابنكم/ابنتكم (${sName})` : 'ابنكم/ابنتكم';
    const classRef = secName ? ` (${secName})` : '';
    const subjectRef = details?.subject ? ` في مادة (${details.subject})` : '';

    if (type === 'absence') {
      const countRef = details?.count ? ` [إجمالي الغيابات: ${details.count}]` : '';
      return `المملكة المغربية • ${institutionName}\nنحيطكم علماً بأن ${childRef}${classRef} قد سجل(ت) غياباً عن الحصة الدراسية${subjectRef} بتاريخ ${d}.${countRef}\nيرجى موافاة إدارة المؤسسة بمبرر الغياب القانوني لتسوية الوضعية.`;
    }

    if (type === 'violation') {
      const vReason = details?.reason || 'مخالفة انضباطية داخل الحصة';
      return `المملكة المغربية • ${institutionName}\nنحيطكم علماً بأن ${childRef}${classRef} قد ارتكب(ت) مخالفة انضباطية: (${vReason}) بتاريخ ${d}.\nيرجى التواصل مع إدارة المؤسسة أو الحضور للحراسة العامة لتسوية الأمر.`;
    }

    if (type === 'summons') {
      const appTime = details?.time ? ` على الساعة ${details.time}` : '';
      return `المملكة المغربية • ${institutionName}\nاستدعاء رسمي لولي أمر التلميذ(ة) ${childRef}${classRef}.\nنرجو حضوركم لمقر إدارة المؤسسة بتاريخ ${d}${appTime} لأمر إداري وتربوي يهم التمدرس.`;
    }

    return `المملكة المغربية • ${institutionName}\nإشعار إداري وتربوي يخص التلميذ(ة) ${childRef}${classRef}.\nيرجى متابعة الحالة المدرسية والتواصل مع الإدارة.`;
  };

  // Current preview message
  const currentPreviewText = customText.trim()
    ? customText
    : student
      ? generateMessageText(
          student.studentName,
          notifType,
          student.details,
          student.sectionLevel ? `${student.sectionLevel} ${student.sectionClass || ''}` : undefined
        )
      : '';

  // Clean phone to Moroccan format
  const cleanPhone = phone.trim().replace(/[\s\-\.\(\)\+]/g, '');

  // Copy message text to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(currentPreviewText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = currentPreviewText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // Send single via WhatsApp Cloud API
  const handleSendSingleWhatsAppCloud = async () => {
    if (!cleanPhone || cleanPhone.length < 8) {
      setFeedback({ message: 'يرجى إدخال رقم هاتف صحيح لولي الأمر (مثال: 0612345678 أو 0712345678)', type: 'error' });
      return;
    }

    setIsSending(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/notify-guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          massarNumber: student?.massarNumber,
          studentName: student?.studentName,
          sectionId: student?.sectionId,
          sectionName: student?.sectionLevel ? `${student.sectionLevel} ${student.sectionClass || ''}` : undefined,
          guardianPhone: cleanPhone,
          notificationType: notifType,
          channel: 'whatsapp_cloud',
          customMessage: customText.trim() ? customText : undefined,
          details: student?.details
        })
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({
          message: data.message || `تم إرسال الإشعار بنجاح إلى ولي أمر (${student?.studentName}) على الرقم (${data.toPhone || cleanPhone}) عبر WhatsApp Cloud API ✓`,
          type: 'success'
        });
        if (onSuccess) onSuccess();
      } else {
        const errorMsg = data.message || data.error || 'تعذر الإرسال عبر WhatsApp Cloud API.';
        setFeedback({
          message: errorMsg,
          type: 'error'
        });
      }
    } catch (err: any) {
      setFeedback({
        message: `حدث خطأ أثناء الاتصال بخوادم WhatsApp Cloud: ${err?.message || 'خطأ في الشبكة'}`,
        type: 'error'
      });
    } finally {
      setIsSending(false);
    }
  };

  // Send Batch via WhatsApp Cloud API
  const handleSendBatchWhatsAppCloud = async () => {
    const validItems = batchList.filter(s => s.guardianPhone && s.guardianPhone.trim().length >= 8);
    if (validItems.length === 0) {
      setFeedback({ message: 'لا يوجد أي تلميذ برقم هاتف مسجل في هذه اللائحة.', type: 'error' });
      return;
    }

    if (!confirm(`هل أنت متأكد من إرسال إشعارات واتساب إلى أولياء أمور (${validItems.length}) تلميذاً دفعة واحدة عبر WhatsApp Cloud API؟`)) {
      return;
    }

    setIsSending(true);
    setFeedback(null);
    setFailedList([]);
    setBatchProgress({ sent: 0, total: validItems.length, failed: 0 });

    try {
      const res = await fetch('/api/admin/notify-guardians-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validItems.map(s => ({
            studentName: s.studentName,
            massarNumber: s.massarNumber,
            sectionId: s.sectionId,
            sectionName: s.sectionLevel ? `${s.sectionLevel} ${s.sectionClass || ''}` : undefined,
            guardianPhone: s.guardianPhone,
            date: s.details?.date,
            subject: s.details?.subject,
            customMessage: customText.trim() ? customText : undefined
          })),
          channel: 'whatsapp_cloud',
          notificationType: notifType
        })
      });

      const data = await res.json();
      if (data.success) {
        setBatchProgress({
          sent: data.successCount || 0,
          total: validItems.length,
          failed: data.failedCount || 0
        });

        if (Array.isArray(data.results)) {
          const failed = data.results.filter((r: any) => !r.success);
          setFailedList(failed);
        }

        setFeedback({
          message: data.message || `تم بنجاح إرسال ${data.successCount} إشعار لأولياء الأمور عبر WhatsApp Cloud API ✓`,
          type: data.successCount > 0 ? 'success' : 'warning'
        });
        if (onSuccess) onSuccess();
      } else {
        throw new Error(data.error || 'فشلت عملية الإرسال الجماعي عبر WhatsApp Cloud API');
      }
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border-2 border-emerald-600/40 overflow-hidden animate-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A4E47] via-[#143E38] to-[#1A4E47] text-white p-5 sm:p-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-lg shrink-0">
                <MessageSquare className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[10px] font-bold mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>بوابة إشعارات WhatsApp Cloud API الرسمية</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-white tracking-wide">
                  {isBatch
                    ? `إشعار جماعي عبر WhatsApp Cloud (${batchList.length} تلميذاً) 📢`
                    : `إشعار ولي أمر التلميذ(ة) عبر WhatsApp Cloud 💬`}
                </h2>
                <p className="text-xs text-[#F2EFE3]/80 mt-0.5">
                  إرسال سحابي آلي ومباشر عبر خوادم Meta الرسمية (1,000 محادثة شهرياً مجاناً)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Student Banner (Single Mode) */}
          {!isBatch && student && (
            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/90 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={student.studentName}
                    className="w-8 h-8 rounded-full object-cover border border-[#C98A3C]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    {student.studentName.slice(0, 1)}
                  </div>
                )}
                <div>
                  <span className="font-bold text-sm">{student.studentName}</span>
                  {student.massarNumber && (
                    <span className="text-emerald-300 font-mono text-xs mr-2 font-bold">
                      ({student.massarNumber})
                    </span>
                  )}
                </div>
              </div>

              {student.sectionLevel && (
                <span className="px-2.5 py-1 rounded-lg bg-white/15 text-[11px] font-semibold">
                  {student.sectionLevel} {student.sectionClass || ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-start gap-2.5 animate-in slide-in-from-top ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-500/40 text-emerald-950'
                  : feedback.type === 'warning'
                    ? 'bg-amber-50 border-amber-500/40 text-amber-950'
                    : 'bg-rose-50 border-rose-500/40 text-rose-950'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <span>{feedback.message}</span>
              </div>
            </div>
          )}

          {/* Single Mode: Guardian Phone Input */}
          {!isBatch && (
            <div className="space-y-2 bg-[#FAF8F5] p-4 rounded-2xl border border-[#E5DFD4]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#1F2926] flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-700" />
                  <span>رقم هاتف ولي الأمر (لإرسال إشعار WhatsApp Cloud):</span>
                </label>
                {phone && !isEditingPhone && (
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(true)}
                    className="text-[11px] text-[#1A4E47] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3 text-[#C98A3C]" />
                    <span>تعديل الرقم</span>
                  </button>
                )}
              </div>

              {isEditingPhone ? (
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06XXXXXXXX أو 07XXXXXXXX"
                    className="flex-1 px-3 py-2 rounded-xl border border-[#D5CDC0] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-mono bg-white text-left dir-ltr"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(false)}
                    disabled={!cleanPhone}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    تأكيد
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#D5CDC0]">
                  <span className="font-mono font-bold text-sm text-[#1F2926] dir-ltr">
                    {phone || 'لا يوجد رقم مسجل'}
                  </span>
                  <span className="text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                    جاهز للإرسال السحابي ✓
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Batch Mode: Recipient Summary */}
          {isBatch && (
            <div className="space-y-3 bg-[#FAF8F5] p-4 rounded-2xl border border-[#E5DFD4]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#1F2926] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#1A4E47]" />
                  <span>لائحة أولياء الأمور المستهدفين عبر WhatsApp Cloud ({batchList.length}):</span>
                </span>
                <span className="text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                  {batchList.filter(s => s.guardianPhone).length} جاهز للإرسال
                </span>
              </div>

              {/* Recipient preview list */}
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#E5DFD4]">
                {batchList.map((item, idx) => (
                  <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1F2926]">{item.studentName}</span>
                    {item.guardianPhone ? (
                      <span className="font-mono text-[11px] text-emerald-800 dir-ltr">
                        {item.guardianPhone}
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold">
                        بدون رقم
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {batchProgress && (
                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold flex items-center justify-between">
                  <span>تم إرسال: {batchProgress.sent} من {batchProgress.total}</span>
                  {batchProgress.failed > 0 && (
                    <span className="text-rose-700">تعذر: {batchProgress.failed}</span>
                  )}
                </div>
              )}

              {/* Failed items note */}
              {failedList.length > 0 && (
                <div className="mt-2 p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-1.5 text-xs text-rose-900">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>تلاميذ تعذر الإرسال الآلي لأولياء أمورهم ({failedList.length}):</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {failedList.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] bg-white p-1 rounded border border-rose-100">
                        <span className="font-bold text-gray-800">{f.studentName}</span>
                        <span className="text-rose-700 text-[10px]">{f.error || 'خطأ في استجابة واتساب'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notification Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1F2926] block">
              نوع الإشعار المراد إرساله:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'absence', label: 'إشعار غياب 🔴', icon: UserX },
                { id: 'violation', label: 'مخالفة سلوكية ⚠️', icon: AlertTriangle },
                { id: 'summons', label: 'استدعاء ولي الأمر 📋', icon: ShieldAlert },
                { id: 'custom', label: 'إشعار مخصص 💬', icon: MessageSquare }
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = notifType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setNotifType(t.id as NotificationType);
                      setCustomText('');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm scale-102'
                        : 'bg-white hover:bg-[#FAF8F5] text-[#5B5040] border-[#D5CDC0]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-300' : 'text-[#7A6B58]'}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message Text Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-[#1F2926]">
                نص رسالة WhatsApp Cloud:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#FAF8F5] border border-[#D5CDC0] text-[11px] font-bold text-[#1A4E47] transition-all cursor-pointer shadow-2xs"
                  title="نسخ نص الرسالة بالكامل لاستخدامه في أي تطبيق آخر"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">تم النسخ ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#C98A3C]" />
                      <span>نسخ نص الرسالة</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-[#7A6B58] font-mono">
                  {currentPreviewText.length} حرف
                </span>
              </div>
            </div>

            <textarea
              rows={4}
              value={customText || currentPreviewText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="نص الإشعار..."
              className="w-full p-3 rounded-2xl border border-[#D5CDC0] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs leading-relaxed text-[#1F2926] bg-[#FAF8F5] resize-none font-sans"
            />
            <div className="flex items-center justify-between text-[11px] text-[#7A6B58]">
              <span>الرسالة تتضمن ترويسة المملكة المغربية واسم المؤسسة وتُرسل آلياً عبر WhatsApp Cloud API.</span>
              {customText && (
                <button
                  type="button"
                  onClick={() => setCustomText('')}
                  className="text-emerald-700 hover:underline font-bold"
                >
                  استعادة النص التلقائي
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer / Dispatch Actions */}
        <div className="p-4 sm:p-5 bg-[#FAF8F5] border-t border-[#E5DFD4] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs cursor-pointer transition-colors"
          >
            إغلاق
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2.5 justify-end">
            {/* Single Mode: Only WhatsApp Cloud API */}
            {!isBatch ? (
              <button
                type="button"
                onClick={handleSendSingleWhatsAppCloud}
                disabled={!cleanPhone || isSending}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                title="إرسال آلي وسريع عبر WhatsApp Cloud API (مجاني 1,000 محادثة شهرياً)"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الإرسال عبر WhatsApp Cloud API...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-emerald-200" />
                    <span>إرسال آلي WhatsApp Cloud 🚀</span>
                  </>
                )}
              </button>
            ) : (
              /* Batch Mode: Only WhatsApp Cloud API */
              <button
                type="button"
                onClick={handleSendBatchWhatsAppCloud}
                disabled={isSending}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                title="إرسال إشعارات جماعية عبر WhatsApp Cloud لكافة التلاميذ في اللائحة دفعة واحدة"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>جاري إرسال إشعارات WhatsApp Cloud الجماعية...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-emerald-200" />
                    <span>إرسال جماعي آلي عبر WhatsApp Cloud 🚀</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
