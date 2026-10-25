import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Send,
  X,
  Phone,
  CheckCircle2,
  Clock,
  User,
  BookOpen,
  School,
  ShieldAlert,
  Smartphone,
  MessageSquare,
  Sparkles,
  Info
} from 'lucide-react';

interface AbsenceConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentNumber?: string;
  seatNum: number;
  massarNumber?: string;
  sectionId: string;
  sectionName?: string;
  sectionLevel?: string;
  sectionClass?: string;
  teacherName?: string;
  teacherSubject?: string;
  guardianPhone?: string;
  guardianPhoneVerified?: boolean;
  institutionName?: string;
  onConfirm: (options: {
    sendNotification: boolean;
    guardianPhone: string;
    customNote?: string;
  }) => Promise<void>;
}

export const AbsenceConfirmationModal: React.FC<AbsenceConfirmationModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentNumber,
  seatNum,
  massarNumber,
  sectionId,
  sectionName,
  sectionLevel,
  sectionClass,
  teacherName = 'أستاذ المادة',
  teacherSubject = 'المادة',
  guardianPhone = '',
  guardianPhoneVerified = false,
  institutionName = 'الثانوية الإعدادية ايكسان',
  onConfirm
}) => {
  const [phone, setPhone] = useState(guardianPhone);
  const [sendNotification, setSendNotification] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Time & session info
  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const currentDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  // Reset & load phone when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setPhone(guardianPhone || '');
    setIsEditingPhone(!guardianPhone);
    setSendNotification(true);
    setIsSubmitting(false);

    // If phone is missing, try to lookup dynamically from student accounts
    if (!guardianPhone && (massarNumber || studentName)) {
      setLookupLoading(true);
      fetch(
        `/api/admin/student-guardian-info?massarNumber=${encodeURIComponent(massarNumber || '')}&studentName=${encodeURIComponent(studentName)}&sectionId=${encodeURIComponent(sectionId)}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.info?.guardianPhone) {
            setPhone(data.info.guardianPhone);
            setIsEditingPhone(false);
          }
        })
        .catch(() => {})
        .finally(() => setLookupLoading(false));
    }
  }, [isOpen, guardianPhone, massarNumber, studentName, sectionId]);

  if (!isOpen) return null;

  const displaySection = sectionName || (sectionLevel ? `${sectionLevel} - القسم ${sectionClass || ''}` : 'القسم');

  // Preview message text for guardian
  const messagePreview = `المملكة المغربية • ${institutionName}\nإشعار غياب فوري: نحيطكم علماً أن ابنكم/ابنتكم (${studentName}) مسجل(ة) غائب(ة) الآن عن حصة (${teacherSubject}) بتاريخ ${currentDate} على الساعة ${currentTime}.\nيرجى التواصل مع إدارة المؤسسة أو الإدلاء بمبرر قانوني لتسوية الوضعية.`;

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        sendNotification: sendNotification && Boolean(phone.trim()),
        guardianPhone: phone.trim()
      });
      onClose();
    } catch (err) {
      console.error('Confirmation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#14231E] border border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-right text-[#F2EFE3]"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-red-950/80 border-b border-rose-500/30 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-600/30 border border-rose-400/50 flex items-center justify-center text-rose-300 shadow-md">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-rose-100 flex items-center gap-2">
                <span>تأكيد تسجيل غياب تلميذ</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-normal">
                  الحصة الحالية
                </span>
              </h3>
              <p className="text-xs text-rose-200/80 mt-0.5">
                تأكيد التغيب وإرسال إشعار فوري لولي الأمر عبر واتساب أو الرسائل القصيرة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Student & Session Card */}
          <div className="bg-[#1A312A] border border-[rgba(242,239,227,0.12)] rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] text-[rgba(242,239,227,0.6)] block mb-0.5">اسم التلميذ(ة):</span>
                <span className="text-base sm:text-lg font-black text-[#F2EFE3] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#C98A3C]" />
                  <span>{studentName}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {studentNumber && (
                  <span className="px-2.5 py-1 rounded-xl bg-[#2A4F40] border border-[#C98A3C]/50 text-amber-200 font-mono text-xs font-bold">
                    رقم {studentNumber}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 text-stone-200 text-xs font-bold">
                  🪑 مقعد {seatNum}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2 text-[rgba(242,239,227,0.85)]">
                <School className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>القسم: <b>{displaySection}</b></span>
              </div>

              <div className="flex items-center gap-2 text-[rgba(242,239,227,0.85)]">
                <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>المادة: <b>{teacherSubject}</b></span>
              </div>

              <div className="flex items-center gap-2 text-[rgba(242,239,227,0.85)]">
                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>التوقيت: <b>{currentTime} ({currentDate})</b></span>
              </div>

              <div className="flex items-center gap-2 text-[rgba(242,239,227,0.85)]">
                <User className="w-3.5 h-3.5 text-[#C98A3C] shrink-0" />
                <span>الأستاذ: <b>{teacherName}</b></span>
              </div>
            </div>

            {massarNumber && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-[rgba(242,239,227,0.6)]">رمز مسار (Massar):</span>
                <span className="font-mono text-amber-300 font-bold bg-black/30 px-2 py-0.5 rounded border border-amber-500/30">
                  {massarNumber}
                </span>
              </div>
            )}
          </div>

          {/* Guardian Phone Section */}
          <div className="bg-[#1A312A] border border-[rgba(242,239,227,0.12)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-[#F2EFE3]">هاتف ولي الأمر للإشعار:</span>
              </div>
              {phone ? (
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(!isEditingPhone)}
                  className="text-[11px] text-[#C98A3C] hover:underline cursor-pointer"
                >
                  {isEditingPhone ? 'إلغاء التعديل' : 'تعديل الرقم'}
                </button>
              ) : null}
            </div>

            {isEditingPhone ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <Phone className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 0612345678 أو 0712345678"
                    className="w-full pr-9 pl-3 py-2 rounded-xl bg-black/40 border border-[#C98A3C]/60 text-amber-200 text-xs font-mono placeholder:text-white/30 focus:outline-hidden focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
                <p className="text-[10px] text-amber-200/80">
                  💡 سيتم حفظ رقم الهاتف تلقائياً في ملف التلميذ للاستعمال في كافة الإشعارات اللاحقة.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-300" dir="ltr">
                    {phone}
                  </span>
                  {guardianPhoneVerified && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" /> موثق
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-emerald-200/70">جاهز للإرسال الآلي</span>
              </div>
            )}

            {!phone && !lookupLoading && (
              <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-2.5 text-xs text-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">رقم ولي الأمر غير مسجل حالياً:</span>
                  <span className="text-[11px] opacity-90">
                    يمكنك إدخال الرقم في الحقل أعلاه ليصل الإشعار فوراً، أو الاستمرار بتسجيل الغياب داخلياً فقط.
                  </span>
                </div>
              </div>
            )}

            {/* Checkbox: Dispatch notification */}
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={sendNotification}
                onChange={(e) => setSendNotification(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-black/40 border-white/20 cursor-pointer"
              />
              <span className="text-xs text-[rgba(242,239,227,0.9)] select-none">
                إرسال إشعار فوري لولي الأمر الآن عبر واتساب (WhatsApp Cloud / واتساب المباشر) بكون التلميذ غائب
              </span>
            </label>
          </div>

          {/* Message Preview Box */}
          {sendNotification && (
            <div className="bg-black/30 border border-white/10 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[rgba(242,239,227,0.7)] font-bold">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>معاينة إشعار واتساب الصادر لولي الأمر:</span>
                </span>
                <span className="text-emerald-400 text-[10px]">واتساب رسمي فوري</span>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 text-xs text-amber-100/90 whitespace-pre-line leading-relaxed font-sans">
                {messagePreview}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#0E1A16] border-t border-[rgba(242,239,227,0.12)] p-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            إلغاء الأمر
          </button>

          <button
            type="button"
            onClick={handleConfirmSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50 transition-all hover:scale-102 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>جاري التسجيل والإرسال عبر واتساب...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>تأكيد تسجيل الغياب وإشعار ولي الأمر عبر واتساب</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
