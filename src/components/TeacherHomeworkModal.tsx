import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Video,
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  Calendar,
  Clock,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { SectionItem, User as UserType, ClassHomeworkItem, HomeworkPostType } from '../types';

interface TeacherHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  sections: SectionItem[];
}

export const TeacherHomeworkModal: React.FC<TeacherHomeworkModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  sections
}) => {
  const [homeworks, setHomeworks] = useState<ClassHomeworkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form states
  const [postType, setPostType] = useState<HomeworkPostType>('homework');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urlLink, setUrlLink] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [filterSectionId, setFilterSectionId] = useState<string>('all');

  // Filter sections assigned to this teacher
  const assignedSections = sections.filter(
    (s) =>
      s.assignedTeacherId === currentUser.id ||
      s.assignedTeachers?.some((t) => t.teacherId === currentUser.id)
  );

  const sectionsToChoose = assignedSections.length > 0 ? assignedSections : sections;

  useEffect(() => {
    if (isOpen) {
      if (!selectedSectionId && sectionsToChoose.length > 0) {
        setSelectedSectionId(sectionsToChoose[0].id);
      }
      fetchHomeworks();
    }
  }, [isOpen]);

  const fetchHomeworks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/teacher/homeworks?teacherId=${currentUser.id}`, {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.homeworks)) {
        setHomeworks(data.homeworks);
      }
    } catch (err) {
      console.error('Failed to fetch homeworks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedback({ message: 'يرجى إدخال عنوان الواجب أو الدرس', type: 'error' });
      return;
    }
    if (!selectedSectionId) {
      setFeedback({ message: 'يرجى تحديد القسم المستهدف', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      const targetSec = sections.find((s) => s.id === selectedSectionId);
      const sectionName = targetSec ? `${targetSec.level} - ق ${targetSec.classNumber}` : '';

      const res = await fetch('/api/teacher/homeworks', {
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
          sectionId: selectedSectionId,
          sectionName,
          postType,
          title: title.trim(),
          description: description.trim(),
          urlLink: urlLink.trim(),
          dueDate: dueDate.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ message: 'تم نشر المحتوى بنجاح وسيظهر فوراً في فضاء التلاميذ!', type: 'success' });
        setTitle('');
        setDescription('');
        setUrlLink('');
        setDueDate('');
        fetchHomeworks();
      } else {
        setFeedback({ message: data.error || 'فشل نشر المحتوى', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ message: err.message || 'حدث خطأ أثناء النشر', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/teacher/homeworks/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id
        }
      });
      const data = await res.json();
      if (data.success) {
        setHomeworks((prev) => prev.filter((h) => h.id !== id));
        setFeedback({ message: 'تم حذف المنشور بنجاح', type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err: any) {
      setFeedback({ message: 'فشل حذف المنشور', type: 'error' });
    }
  };

  if (!isOpen) return null;

  const filteredList =
    filterSectionId === 'all'
      ? homeworks
      : homeworks.filter((h) => h.sectionId === filterSectionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-[#E5DFD4] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="bg-[#1A4E47] text-white p-5 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#133D37] border border-[#C98A3C]/50 flex items-center justify-center text-[#C98A3C] shadow-inner">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-serif flex items-center gap-2">
                <span>فضاء نشر الواجبات والدروس الرقمية</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#C98A3C]/20 border border-[#C98A3C]/40 text-[#C98A3C] font-sans">
                  مساحة الأستاذ
                </span>
              </h2>
              <p className="text-xs text-[#F2EFE3]/80 mt-0.5">
                نشر الواجبات المدرسية، روابط الفيديوهات التعليمية وملخصات الدروس مباشرة في فضاءات تلاميذك
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
          {/* Section 1: Create New Post Form */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5DFD4] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <h3 className="font-bold text-sm text-[#1F2926] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#1A4E47]" />
                <span>إضافة واجب أو درس رقمي جديد</span>
              </h3>
              <span className="text-[11px] text-[#6C6356]">
                الأستاذ: <strong className="text-[#1A4E47]">{currentUser.fullName || currentUser.username}</strong> ({currentUser.subject || 'مادة دراسية'})
              </span>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Post Type Selector */}
              <div>
                <label className="block text-xs font-bold text-[#4A4235] mb-2">
                  نوع المنشور:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPostType('homework')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      postType === 'homework'
                        ? 'bg-[#1A4E47] text-white border-[#1A4E47] shadow-xs'
                        : 'bg-[#FAF8F5] text-[#6C6356] border-[#E5DFD4] hover:border-[#1A4E47]'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>واجب منزلي تمارين</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostType('video')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      postType === 'video'
                        ? 'bg-[#8A5A18] text-white border-[#8A5A18] shadow-xs'
                        : 'bg-[#FAF8F5] text-[#6C6356] border-[#E5DFD4] hover:border-[#8A5A18]'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>فيديو / رابط مختصر</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostType('lesson')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      postType === 'lesson'
                        ? 'bg-[#1F2926] text-white border-[#1F2926] shadow-xs'
                        : 'bg-[#FAF8F5] text-[#6C6356] border-[#E5DFD4] hover:border-[#1F2926]'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>درس / ملخص مكتوب</span>
                  </button>
                </div>
              </div>

              {/* Target Section & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-[#4A4235] mb-1">
                    القسم المستهدف <span className="text-rose-500">*</span>:
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white font-semibold text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                    required
                  >
                    {sectionsToChoose.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.level} - ق {sec.classNumber} ({sec.studentCount} تلميذ)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#4A4235] mb-1">
                    عنوان المنشور <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      postType === 'homework'
                        ? 'مثال: تمارين الأسبوع في الحساب الحرفي ص 45'
                        : postType === 'video'
                        ? 'مثال: شرح مبسط بالفيديو لدرس التنفس عند الكائنات الحية'
                        : 'مثال: ملخص شامل لدروس الدورة الأولى'
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                    required
                  />
                </div>
              </div>

              {/* Description / Instructions */}
              <div>
                <label className="block text-xs font-bold text-[#4A4235] mb-1">
                  نص التوجيهات أو المطلوب إنجازه:
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="اكتب التوجيهات الدقيقة للتلاميذ، أرقام التمارين، شروط الإنجاز أو المحاور الأساسية..."
                  className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                />
              </div>

              {/* URL Link & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A4235] mb-1 flex items-center gap-1">
                    <LinkIcon className="w-3.5 h-3.5 text-[#C98A3C]" />
                    <span>رابط مختصر / فيديو يوتيوب أو ملف:</span>
                  </label>
                  <input
                    type="url"
                    value={urlLink}
                    onChange={(e) => setUrlLink(e.target.value)}
                    placeholder="https://youtu.be/... أو https://bit.ly/..."
                    className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] font-mono text-left focus:outline-hidden focus:border-[#1A4E47]"
                  />
                  <span className="text-[10px] text-[#8C8275] mt-0.5 block">
                    يمكنك وضع أي رابط مختصر لمقطع فيديو أو مستند Google Drive
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A4235] mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#1A4E47]" />
                    <span>آخر أجل للإنجاز / التسليم (اختياري):</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:border-[#1A4E47]"
                  />
                  <span className="text-[10px] text-[#8C8275] mt-0.5 block">
                    يحدد التاريخ الأقصى لإحضار الواجب أو مراجعة الدرس
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[#C98A3C]" />
                  )}
                  <span>{isSubmitting ? 'جاري النشر...' : 'نشر للتلاميذ الآن'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Published Homeworks & Lessons List */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5DFD4] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#1F2926]">
                  قائمة المنشورات والواجبات الحالية ({filteredList.length})
                </h3>
              </div>

              {/* Filter by section */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6C6356]">تصفية بالقسم:</span>
                <select
                  value={filterSectionId}
                  onChange={(e) => setFilterSectionId(e.target.value)}
                  className="text-xs p-1.5 px-2.5 rounded-lg border border-[#D5CDC0] bg-white text-[#1F2926]"
                >
                  <option value="all">جميع الأقسام ({homeworks.length})</option>
                  {sectionsToChoose.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.level} - ق {s.classNumber}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={fetchHomeworks}
                  className="p-1.5 rounded-lg border border-[#D5CDC0] text-[#6C6356] hover:text-[#1A4E47] cursor-pointer"
                  title="تحديث القائمة"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-10 text-center text-xs text-[#6C6356]">جاري تحميل المنشورات...</div>
            ) : filteredList.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6C6356] bg-[#FAF8F5] rounded-xl border border-dashed border-[#D5CDC0] space-y-2">
                <BookOpen className="w-8 h-8 text-[#C5BCAD] mx-auto" />
                <div className="font-bold text-[#1F2926]">لم تقم بنشر أي واجبات أو دروس حتى الآن</div>
                <p className="text-[11px] text-[#8C8275]">
                  استخدم النموذج أعلاه لنشر أول واجب منزلي أو مقطع فيديو لشرح الدرس لتلاميذك.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredList.map((item) => {
                  const targetSec = sections.find((s) => s.id === item.sectionId);
                  const secLabel = item.sectionName || (targetSec ? `${targetSec.level} - ق ${targetSec.classNumber}` : 'قسم محدد');

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4] hover:border-[#C98A3C] transition-all space-y-2.5 relative flex flex-col justify-between"
                    >
                      <div>
                        {/* Header badge & Section */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                              item.postType === 'video'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : item.postType === 'lesson'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {item.postType === 'video' ? (
                              <>
                                <Video className="w-3 h-3" />
                                <span>فيديو تعليمي</span>
                              </>
                            ) : item.postType === 'lesson' ? (
                              <>
                                <FileText className="w-3 h-3" />
                                <span>درس / ملخص</span>
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-3 h-3" />
                                <span>واجب منزلي</span>
                              </>
                            )}
                          </span>

                          <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-white border border-[#D5CDC0] text-[#1A4E47]">
                            {secLabel}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="font-bold text-xs sm:text-sm text-[#1F2926] leading-snug">
                          {item.title}
                        </h4>

                        {/* Description */}
                        {item.description && (
                          <p className="text-xs text-[#554C3F] mt-1.5 whitespace-pre-wrap leading-relaxed line-clamp-3">
                            {item.description}
                          </p>
                        )}

                        {/* URL Link if available */}
                        {item.urlLink && (
                          <div className="mt-2 pt-2 border-t border-[#E5DFD4]/80">
                            <a
                              href={item.urlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] text-[#1A4E47] hover:underline font-mono bg-white px-2.5 py-1 rounded-lg border border-[#D5CDC0]"
                            >
                              <ExternalLink className="w-3 h-3 text-[#C98A3C]" />
                              <span className="truncate max-w-[220px]">{item.urlLink}</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Footer meta & delete */}
                      <div className="flex items-center justify-between text-[10px] text-[#8C8275] pt-2 border-t border-[#E5DFD4] mt-2">
                        <div className="flex items-center gap-2">
                          {item.dueDate && (
                            <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-sm">
                              تسليم: {item.dueDate}
                            </span>
                          )}
                          <span>نُشر: {new Date(item.createdAt).toLocaleDateString('ar-MA')}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="flex items-center gap-1 text-rose-600 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
                          title="حذف المنشور"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#FAF8F5] px-6 py-4 border-t border-[#E5DFD4] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#6C6356]">
            💡 جميع الواجبات والدروس تظهر فورياً في فضاء التلميذ الخاص برقم مسار.
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
