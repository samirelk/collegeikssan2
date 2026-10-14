import React, { useState, useEffect } from 'react';
import {
  X,
  FileCheck2,
  Calendar,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  ShieldCheck,
  RefreshCw,
  Users
} from 'lucide-react';
import { SectionItem, User as UserType, TeacherLeaveNoticeItem } from '../types';

interface TeacherLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  sections: SectionItem[];
}

export const TeacherLeaveModal: React.FC<TeacherLeaveModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  sections
}) => {
  const [leaves, setLeaves] = useState<TeacherLeaveNoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form fields
  const [leaveType, setLeaveType] = useState('sick');
  const [targetSectionId, setTargetSectionId] = useState('all');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [slotIds, setSlotIds] = useState('all');
  const [instructions, setInstructions] = useState('');

  // Assigned sections
  const assignedSections = sections.filter(
    (s) =>
      s.assignedTeacherId === currentUser.id ||
      s.assignedTeachers?.some((t) => t.teacherId === currentUser.id)
  );

  const sectionsToChoose = assignedSections.length > 0 ? assignedSections : sections;

  useEffect(() => {
    if (isOpen) {
      fetchLeaves();
    }
  }, [isOpen]);

  const fetchLeaves = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/teacher/leaves?teacherId=${currentUser.id}`, {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.leaves)) {
        setLeaves(data.leaves);
      }
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      setFeedback({ message: 'يرجى تحديد تاريخ بداية الرخصة أو الغياب', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      const targetSec = sections.find((s) => s.id === targetSectionId);
      const sectionName = targetSectionId === 'all' ? 'جميع الأقسام' : targetSec ? `${targetSec.level} - ق ${targetSec.classNumber}` : '';

      const res = await fetch('/api/teacher/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        },
        body: JSON.stringify({
          teacherId: currentUser.id,
          teacherName: currentUser.fullName || currentUser.username,
          subject: currentUser.subject || 'مادة دراسية',
          sectionId: targetSectionId,
          sectionName,
          leaveType,
          startDate,
          endDate: endDate || startDate,
          slotIds,
          instructions: instructions.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          message: 'تم تسجيل إشعار الرخصة بنجاح! سيظهر إشعار تنبيهي وتوجيهاتك في فضاءات التلاميذ المعنيين.',
          type: 'success'
        });
        setInstructions('');
        fetchLeaves();
      } else {
        setFeedback({ message: data.error || 'تعذر تسجيل الرخصة', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ message: err.message || 'حدث خطأ أثناء حفظ الإشعار', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/teacher/leaves/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id
        }
      });
      const data = await res.json();
      if (data.success) {
        setLeaves((prev) => prev.filter((l) => l.id !== id));
        setFeedback({ message: 'تم إلغاء إشعار الرخصة بنجاح واستئناف الحصص', type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err: any) {
      setFeedback({ message: 'فشل حذف إشعار الرخصة', type: 'error' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-[#E5DFD4] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-[#1A4E47] text-white p-5 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#133D37] border border-[#C98A3C]/50 flex items-center justify-center text-[#C98A3C] shadow-inner">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-serif flex items-center gap-2">
                <span>التصريح بالرخص والغياب وإشعار التلاميذ</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#C98A3C]/20 border border-[#C98A3C]/40 text-[#C98A3C] font-sans">
                  إشعار فوري
                </span>
              </h2>
              <p className="text-xs text-[#F2EFE3]/80 mt-0.5">
                تنبيه التلاميذ بحصص الغياب لسبب رخصة قانونية وتزويدهم بتوجيهات وتمارين ينجزونها أثناء فترة الغياب
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`px-6 py-3 text-xs font-bold flex items-center justify-between gap-2 border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#FAF8F5]">
          {/* Create Leave Notice Form */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5DFD4] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <h3 className="font-bold text-sm text-[#1F2926] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#1A4E47]" />
                <span>تسجيل إشعار رخصة جديدة</span>
              </h3>
              <span className="text-[11px] text-[#6C6356]">
                الأستاذ: <strong className="text-[#1A4E47]">{currentUser.fullName || currentUser.username}</strong> ({currentUser.subject || 'مادة دراسية'})
              </span>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Leave Type Selector */}
              <div>
                <label className="block text-xs font-bold text-[#4A4235] mb-2">
                  طبيعة الرخصة أو سبب الغياب المبرر:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'sick', label: 'رخصة مرضية قصيرة', icon: '🏥' },
                    { id: 'admin', label: 'رخصة إدارية استثنائية', icon: '📄' },
                    { id: 'training', label: 'تكوين مستمر / تأطير', icon: '🎓' },
                    { id: 'mission', label: 'مهمة رسمية / لجان', icon: '🏛️' }
                  ].map((lt) => (
                    <button
                      key={lt.id}
                      type="button"
                      onClick={() => setLeaveType(lt.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        leaveType === lt.id
                          ? 'bg-[#1A4E47] text-white border-[#1A4E47] shadow-xs'
                          : 'bg-[#FAF8F5] text-[#6C6356] border-[#E5DFD4] hover:border-[#1A4E47]'
                      }`}
                    >
                      <span className="text-base">{lt.icon}</span>
                      <span>{lt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sections & Period Slots */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A4235] mb-1">
                    الأقسام المعنية بالإشعار <span className="text-rose-500">*</span>:
                  </label>
                  <select
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white font-semibold text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                  >
                    <option value="all">جميع الأقسام المسندة لي (تعميم الإشعار)</option>
                    {sectionsToChoose.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.level} - ق {sec.classNumber} ({sec.roster?.length || sec.seats?.filter(s => s.studentName)?.length || 0} تلميذ)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A4235] mb-1">
                    الحصص المعنية بالغياب:
                  </label>
                  <select
                    value={slotIds}
                    onChange={(e) => setSlotIds(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                  >
                    <option value="all">كامل اليوم (جميع الحصص الصباحية والمسائية)</option>
                    <option value="morning">الفترة الصباحية فقط (08:00 - 12:00)</option>
                    <option value="evening">الفترة المسائية فقط (14:00 - 18:00)</option>
                    <option value="m1,m2">الحصتان الأولى والثانية صباحاً (08:00 - 10:00)</option>
                    <option value="m3,m4">الحصتان الثالثة والرابعة صباحاً (10:00 - 12:00)</option>
                    <option value="e1,e2">الحصتان الأولى والثانية مساءً (14:00 - 16:00)</option>
                    <option value="e3,e4">الحصتان الثالثة والرابعة مساءً (16:00 - 18:00)</option>
                  </select>
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A4235] mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#1A4E47]" />
                    <span>تاريخ بداية الرخصة <span className="text-rose-500">*</span>:</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (!endDate || endDate < e.target.value) {
                        setEndDate(e.target.value);
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A4235] mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#C98A3C]" />
                    <span>تاريخ نهاية الرخصة (تاريخ الاستئناف المتوقع):</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                    required
                  />
                </div>
              </div>

              {/* Student Instructions */}
              <div>
                <label className="block text-xs font-bold text-[#4A4235] mb-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-[#1A4E47]" />
                  <span>توجيهات أو مهام للتلاميذ أثناء فترة الرخصة:</span>
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  placeholder="مثال: يرجى من التلاميذ إنجاز التمارين من الصفحة 60 إلى 62 ومراجعة ملخص الدرس استعداداً للحصة القادمة..."
                  className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-[#C98A3C]" />
                  )}
                  <span>{isSubmitting ? 'جاري الحفظ...' : 'تسجيل إشعار الرخصة وإبلاغ التلاميذ'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Leave Notices List */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5DFD4] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <h3 className="font-bold text-sm text-[#1F2926] flex items-center gap-2">
                <span>سجل إشعارات الرخص والغياب ({leaves.length})</span>
              </h3>
              <button
                type="button"
                onClick={fetchLeaves}
                className="p-1.5 rounded-lg border border-[#D5CDC0] text-[#6C6356] hover:text-[#1A4E47] cursor-pointer"
                title="تحديث"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoading ? (
              <div className="py-10 text-center text-xs text-[#6C6356]">جاري تحميل السجل...</div>
            ) : leaves.length === 0 ? (
              <div className="py-12 text-center text-xs text-emerald-700 font-bold bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <div>✓ لا توجد رخص غياب نشطة مسجلة حالياً</div>
                <div className="text-[11px] font-normal text-emerald-800">
                  جميع حصصك في استعمال الزمان تظهر بانتظام في فضاءات التلاميذ.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {leaves.map((leave) => {
                  const targetSec = sections.find((s) => s.id === leave.sectionId);
                  const secLabel =
                    leave.sectionId === 'all'
                      ? 'جميع الأقسام المسندة'
                      : leave.sectionName || (targetSec ? `${targetSec.level} - ق ${targetSec.classNumber}` : 'قسم محدد');

                  const typeLabel =
                    leave.leaveType === 'sick'
                      ? 'رخصة مرضية'
                      : leave.leaveType === 'admin'
                      ? 'رخصة إدارية استثنائية'
                      : leave.leaveType === 'training'
                      ? 'تكوين مستمر'
                      : leave.leaveType === 'mission'
                      ? 'مهمة رسمية'
                      : 'رخصة قانونية';

                  return (
                    <div
                      key={leave.id}
                      className="p-4 rounded-2xl bg-[#FFFDF8] border-2 border-amber-300/80 flex items-start justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 font-bold text-[11px] border border-amber-300">
                            {typeLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-[#D5CDC0] text-[#1A4E47] font-bold text-xs">
                            {secLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                            نشط ويظهر للتلاميذ
                          </span>
                        </div>

                        <div className="text-xs text-[#1F2926] font-semibold flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-[#8A5A18]" />
                          <span>
                            الفترة: من <strong className="font-mono">{leave.startDate}</strong> إلى{' '}
                            <strong className="font-mono">{leave.endDate}</strong>
                          </span>
                          <span className="text-[#C5BCAD]">•</span>
                          <span className="text-[#6C6356]">الحصص: {leave.slotIds === 'all' ? 'كامل اليوم' : leave.slotIds}</span>
                        </div>

                        {leave.instructions && (
                          <div className="text-xs text-[#554C3F] bg-white p-2.5 rounded-xl border border-amber-200/60 mt-1">
                            <strong>توجيهات للتلاميذ:</strong> {leave.instructions}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(leave.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all cursor-pointer shrink-0"
                        title="إلغاء الرخصة واستئناف العمل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>استئناف / حذف</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#FAF8F5] px-6 py-4 border-t border-[#E5DFD4] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#6C6356]">
            💡 بمجرد تسجيل الرخصة، يتم وسم حصصك في جدول التلميذ وتنبيهه بتوجيهاتك تلقائياً.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-[#D5CDC0] text-xs font-bold text-[#1F2926] hover:bg-[#F2EFE9] transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
