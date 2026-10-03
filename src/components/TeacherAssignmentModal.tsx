import React, { useState, useEffect } from 'react';
import {
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Layers,
  FileText,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Lock,
  ChevronRight
} from 'lucide-react';
import { User, AvailableSectionItem } from '../types';

interface TeacherAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSectionApprovedOrAssigned: () => void;
}

export const TeacherAssignmentModal: React.FC<TeacherAssignmentModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSectionApprovedOrAssigned
}) => {
  const [availableSections, setAvailableSections] = useState<AvailableSectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState<AvailableSectionItem | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchAvailableSections();
    }
  }, [isOpen, currentUser]);

  const fetchAvailableSections = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/sections/available-for-request?teacherId=${currentUser.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.sections)) {
        setAvailableSections(data.sections);
      } else {
        throw new Error(data.error || 'تعذر تحميل قائمة الأقسام');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء جلب الأقسام المتاحة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSection) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/assignment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: currentUser.id,
          sectionId: selectedSection.id,
          requestNote: requestNote.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إرسال طلب الإسناد');
      }

      setSuccessMessage(`تم إرسال طلب إسناد ${selectedSection.level} - القسم ${selectedSection.classNumber} بنجاح إلى السيد المدير للموافقة عليه.`);
      setSelectedSection(null);
      setRequestNote('');
      fetchAvailableSections();
      onSectionApprovedOrAssigned();
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const approvedCount = availableSections.filter((s) => s.assignmentStatus === 'approved').length;
  const pendingCount = availableSections.filter((s) => s.assignmentStatus === 'pending').length;

  return (
    <div
      id="modal-teacher-assignments"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[rgba(10,18,14,0.85)] backdrop-blur-sm animate-fadeIn overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-3xl bg-[#1E362D] border border-[rgba(242,239,227,0.2)] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh] sm:max-h-[88vh]">
        
        {/* Header */}
        <div className="p-3.5 sm:p-6 pb-3 sm:pb-4 border-b border-[rgba(242,239,227,0.12)] bg-[#172B24] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#2A4F40] border border-[#C98A3C]/40 flex items-center justify-center text-[#C98A3C] shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-xl font-bold text-[#F2EFE3] truncate">
                طلب إسناد أقسام المؤسسة
              </h3>
              <p className="text-[11px] sm:text-xs text-[rgba(242,239,227,0.6)] mt-0.5 truncate">
                الثانوية الإعدادية ايكسان • طلب إسناد الأقسام إلى حساب الأستاذ {currentUser.fullName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchAvailableSections}
              className="text-[rgba(242,239,227,0.6)] hover:text-[#F2EFE3] hover:bg-[rgba(255,255,255,0.08)] p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer"
              title="تحديث القائمة"
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

        {/* Info Banner */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-[#2A4F40]/30 border-b border-[rgba(242,239,227,0.08)] flex items-center justify-between flex-wrap gap-2 sm:gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-[rgba(242,239,227,0.85)]">
            <Lock className="w-4 h-4 text-[#C98A3C] shrink-0" />
            <span>
              قاعدة إسناد الأقسام: يمكن إسناد نفس القسم لعدة أساتذة إذا كانت المواد مختلفة، ولا تُسند المادة نفسها لأستاذين في الوقت نفسه.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-900/60 text-emerald-300 font-semibold border border-emerald-500/30">
              المسندة إليك: {approvedCount}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-900/60 text-amber-300 font-semibold border border-amber-500/30">
              قيد المراجعة: {pendingCount}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-3 sm:space-y-4">
          
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

          {/* Section Request Form if a section is selected */}
          {selectedSection && (
            <form onSubmit={handleSendRequest} className="p-4 rounded-2xl bg-[#172B24] border border-[#C98A3C] space-y-3 shadow-lg animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-[#F2EFE3]">
                  <Send className="w-4 h-4 text-[#C98A3C]" />
                  <span>
                    تأكيد طلب إسناد: {selectedSection.level} - القسم {selectedSection.classNumber} 
                    <span className="text-xs text-[#C98A3C] font-normal mr-2">
                      (لمادة: {currentUser.subject || 'التعليم العام'})
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSection(null)}
                  className="text-xs text-[rgba(242,239,227,0.5)] hover:text-[#F2EFE3]"
                >
                  إلغاء
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[rgba(242,239,227,0.8)] mb-1">
                  ملاحظة أو رسالة للمشرف (المدير) - اختياري:
                </label>
                <textarea
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder={`مثال: السلام عليكم، أقوم بتدريس مادة ${currentUser.subject || 'التخصص'} لهذا القسم وفق جدول الحصص الرسمي.`}
                  rows={2}
                  className="w-full px-3.5 py-2 bg-[#1E362D] border border-[rgba(242,239,227,0.18)] rounded-xl text-xs text-[#F2EFE3] placeholder-[rgba(242,239,227,0.35)] focus:outline-none focus:border-[#C98A3C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedSection(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[rgba(242,239,227,0.7)] hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  id="btn-submit-assignment-request"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#C98A3C] hover:bg-[#D8994A] text-[#1E362D] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'جارٍ الإرسال...' : 'إرسال طلب الإسناد للمدير'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Available Sections List */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[rgba(242,239,227,0.6)] flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C98A3C]" />
              <span>جارٍ تحميل أقسام الثانوية الإعدادية ايكسان...</span>
            </div>
          ) : availableSections.length === 0 ? (
            <div className="py-12 text-center text-xs text-[rgba(242,239,227,0.6)] bg-[rgba(0,0,0,0.15)] rounded-2xl border border-[rgba(242,239,227,0.08)]">
              لا توجد أقسام مسجلة بالمؤسسة حتى الآن. يمكن للسيد المدير استيراد أو إنشاء الأقسام.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableSections.map((sec) => {
                const isApproved = sec.assignmentStatus === 'approved';
                const isPending = sec.assignmentStatus === 'pending';
                const isSameSubjectConflict = (sec.assignmentStatus as string) === 'same_subject_conflict' || (sec as any).sameSubjectConflict;
                const conflictTeacherName = (sec as any).conflictTeacherName;
                const assignedList = (sec as any).assignedTeachers || sec.assignedSubjects || [];

                return (
                  <div
                    key={sec.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isApproved
                        ? 'bg-[#172B24]/90 border-emerald-500/50 shadow-sm'
                        : isPending
                        ? 'bg-[#172B24]/70 border-amber-500/50'
                        : isSameSubjectConflict
                        ? 'bg-[#172B24]/60 border-rose-900/40 opacity-80'
                        : 'bg-[#172B24] border-[rgba(242,239,227,0.15)] hover:border-[#C98A3C]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#F2EFE3] text-sm">
                            {sec.level}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#2A4F40] text-[#C98A3C] font-mono font-bold text-xs">
                            القسم {sec.classNumber}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-[11px] text-[rgba(242,239,227,0.6)]">
                          <Users className="w-3.5 h-3.5 text-[#C98A3C]" />
                          <span>{sec.studentCount} تلميذاً مسجلاً</span>
                        </div>

                        {/* List of currently assigned teachers across all subjects */}
                        {assignedList.length > 0 && (
                          <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-[rgba(242,239,227,0.5)]">الأساتذة المسندون:</span>
                            {assignedList.map((t: any, idx: number) => {
                              const isMe = t.teacherId === currentUser.id;
                              return (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border ${
                                    isMe
                                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 font-bold'
                                      : 'bg-[#1E362D] text-[rgba(242,239,227,0.8)] border-[rgba(242,239,227,0.1)]'
                                  }`}
                                >
                                  <span>{t.teacherName}</span>
                                  <span className="text-[9px] text-[#C98A3C]">({t.subject || 'عام'})</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="shrink-0">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>مسند إليك</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                            <Clock className="w-3 h-3" />
                            <span>قيد المراجعة</span>
                          </span>
                        )}
                        {!isApproved && !isPending && isSameSubjectConflict && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] font-semibold border border-rose-600/40">
                            <AlertCircle className="w-3 h-3" />
                            <span>قيد الساعة نفسها</span>
                          </span>
                        )}
                        {!isApproved && !isPending && !isSameSubjectConflict && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2A4F40]/60 text-[#C98A3C] text-[10px] font-semibold border border-[#C98A3C]/30">
                            <span>متاح للفترة</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="mt-3 pt-3 border-t border-[rgba(242,239,227,0.08)] flex items-center justify-between">
                      {isApproved ? (
                        <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                          <span>✓ يمكنك الاطلاع على مقاعد وتلاميذ القسم لمادة ({currentUser.subject || 'تخصصك'})</span>
                        </div>
                      ) : isPending ? (
                        <div className="text-[11px] text-amber-300 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>طلبك قيد مراجعة السيد المدير لمادة ({currentUser.subject || 'العامة'})...</span>
                        </div>
                      ) : isSameSubjectConflict ? (
                        <div className="w-full p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-[11px] flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>
                            مادة هذا الأستاذ مسندة مسبقاً للأستاذ ({conflictTeacherName}). يمكن إسناد نفس القسم لمواد مختلفة.
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSection(sec);
                            setRequestNote('');
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-[#2A4F40] hover:bg-[#C98A3C] text-[#F2EFE3] hover:text-[#1E362D] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>طلب إسناد هذا القسم إليّ (لمادة {currentUser.subject || 'مادتك'})</span>
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgba(242,239,227,0.12)] bg-[#172B24] flex justify-between items-center shrink-0">
          <div className="text-xs text-[rgba(242,239,227,0.6)]">
            ملاحظة: يمكنك إرسال أكثر من طلب إذا كنت تدرّس عدة أقسام في المؤسسة.
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
