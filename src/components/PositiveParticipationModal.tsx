import React, { useState } from 'react';
import {
  Sparkles,
  Star,
  Award,
  ThumbsUp,
  Plus,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  HeartHandshake,
  Lightbulb,
  BookCheck,
  Trophy,
  Printer
} from 'lucide-react';
import { SeatItem, SectionItem, User as UserType, PositiveParticipationItem } from '../types';
import { printStudentPositiveParticipationsReport } from '../utils/printNotes';

interface PositiveParticipationModalProps {
  section: SectionItem;
  seat: SeatItem;
  currentUser: UserType | null;
  onClose: () => void;
  onAddPositiveParticipation: (data: {
    participationType: string;
    points: number;
    note?: string;
    date?: string;
    time?: string;
  }) => Promise<void>;
  onDeletePositiveParticipation: (id: string) => Promise<void>;
}

const PRESET_TYPES = [
  { title: 'مشاركة صفية متميزة وإجابة صحيحة', points: 1, icon: Star, color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { title: 'إنجاز متقن للواجبات والتمارين', points: 1, icon: BookCheck, color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
  { title: 'تفكير إبداعي وفهم عميق للدرس', points: 2, icon: Lightbulb, color: 'text-blue-500 bg-blue-50 border-blue-200' },
  { title: 'سلوك ونظام مثالي داخل الحجرة', points: 1, icon: Award, color: 'text-purple-500 bg-purple-50 border-purple-200' },
  { title: 'مساعدة الزملاء وروح التعاون الإيجابي', points: 1, icon: HeartHandshake, color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { title: 'تفوق وتميز في التقييم اليومي', points: 2, icon: Trophy, color: 'text-amber-600 bg-amber-100 border-amber-300' },
];

export const PositiveParticipationModal: React.FC<PositiveParticipationModalProps> = ({
  section,
  seat,
  currentUser,
  onClose,
  onAddPositiveParticipation,
  onDeletePositiveParticipation
}) => {
  const [selectedType, setSelectedType] = useState<string>(PRESET_TYPES[0].title);
  const [points, setPoints] = useState<number>(PRESET_TYPES[0].points);
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const normalizeText = (str?: string): string => {
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
  };

  const matchesCurrentStudent = (
    studentName?: string,
    studentNumber?: string,
    massarNumber?: string,
    partName?: string,
    partNum?: string,
    partMassar?: string
  ): boolean => {
    const sName = normalizeText(studentName);
    const pName = normalizeText(partName);
    if (!sName && !pName) return false;

    const sMassar = (massarNumber || '').trim().toUpperCase();
    const pMassar = (partMassar || '').trim().toUpperCase();
    if (sMassar && pMassar && sMassar === pMassar) return true;

    if (sName && pName && sName === pName) return true;
    if (sName && pName && (sName.includes(pName) || pName.includes(sName))) {
      const sNum = String(studentNumber || '').trim();
      const pNum = String(partNum || '').trim();
      if (!sNum || !pNum || sNum === pNum) return true;
    }
    return false;
  };

  const studentDisplayName = seat.name && seat.name.trim() ? seat.name.trim() : `المقعد رقم ${seat.seat}`;

  const participations: PositiveParticipationItem[] = (seat.positiveParticipations || []).filter((p) => {
    if (!seat.name || !seat.name.trim()) return false;
    return matchesCurrentStudent(seat.name, seat.number, seat.massarNumber, p.studentName, p.studentNumber, p.massarNumber);
  });
  const totalPoints = participations.reduce((acc, p) => acc + (p.points || 1), 0);

  const handleSelectPreset = (item: typeof PRESET_TYPES[0]) => {
    setSelectedType(item.title);
    setPoints(item.points);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType.trim()) {
      setErrorMsg('يرجى تحديد نوع المشاركة الإيجابية');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onAddPositiveParticipation({
        participationType: selectedType.trim(),
        points: Math.max(1, points),
        note: customNote.trim() || undefined
      });
      setSuccessMsg('تم تسجيل المشاركة الإيجابية وتعزيز التلميذ بنجاح ⭐');
      setCustomNote('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ المشاركة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا التعزيز الإيجابي؟')) return;
    try {
      setDeletingId(id);
      await onDeletePositiveParticipation(id);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حذف المشاركة');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-1.5 sm:p-4 overflow-y-auto">
      <div
        className="bg-[#FAF8F5] text-[#1F2926] rounded-2xl sm:rounded-3xl shadow-2xl border border-[#D5CDC0] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[96vh] sm:max-h-[92vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-[#1A4E47] text-white border-b border-[#163F3A] p-3.5 sm:p-5 pr-3.5 pl-12 sm:px-6 relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-2.5 top-2.5 sm:left-4 sm:top-4 p-1.5 sm:p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold shadow-md shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-900" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-bold font-serif text-white truncate">
                  المشاركات الإيجابية والتعزيز
                </h3>
                <span className="bg-amber-400 text-emerald-950 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-black">
                  ⭐ نقاط التميز
                </span>
              </div>
              <p className="text-emerald-100 text-[11px] sm:text-xs mt-0.5">
                تحفيز التلميذ ورصد السلوكيات والمشاركات المتميزة داخل الحصة
              </p>
            </div>
          </div>

          {/* Student Banner */}
          <div className="mt-3 bg-[#133D37] border border-[#2B665E] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <User className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="text-emerald-200">التلميذ:</span>
              <strong className="text-white text-sm sm:text-base font-bold">{studentDisplayName}</strong>
              {seat.number && (
                <span className="bg-white/20 px-2 py-0.5 rounded-md font-mono text-emerald-100 text-[11px] sm:text-xs">
                  رقم: {seat.number}
                </span>
              )}
              {seat.massarNumber && (
                <span className="bg-emerald-950/60 px-2 py-0.5 rounded-md font-mono text-emerald-200 text-[11px] sm:text-xs">
                  مسار: {seat.massarNumber}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/40 px-2.5 py-1 rounded-xl text-amber-200 font-bold text-xs">
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                <span>الرصيد:</span>
                <span className="text-emerald-950 font-black px-1.5 py-0.5 bg-amber-400 rounded-md shadow-xs">
                  {totalPoints} ⭐
                </span>
              </div>

              {/* Print buttons for Teacher & Admin */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    printStudentPositiveParticipationsReport({
                      level: section.level,
                      classNumber: section.classNumber,
                      studentName: studentDisplayName,
                      studentNumber: seat.number,
                      massarNumber: seat.massarNumber,
                      seatNum: seat.seat,
                      teacherName: currentUser?.fullName || currentUser?.username,
                      subject: currentUser?.subject,
                      participations,
                      totalPoints,
                      mode: 'report'
                    });
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFE9D5] hover:bg-[#E4DBC0] text-[#1A4E47] border border-[#D9CEB0] font-bold text-[11px] shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="طباعة بطاقة وسجل المشاركات الإيجابية للتلميذ"
                >
                  <Printer className="w-3 h-3 text-[#1A4E47]" />
                  <span>طباعة السجل</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    printStudentPositiveParticipationsReport({
                      level: section.level,
                      classNumber: section.classNumber,
                      studentName: studentDisplayName,
                      studentNumber: seat.number,
                      massarNumber: seat.massarNumber,
                      seatNum: seat.seat,
                      teacherName: currentUser?.fullName || currentUser?.username,
                      subject: currentUser?.subject,
                      participations,
                      totalPoints,
                      mode: 'certificate'
                    });
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-[11px] shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="طباعة شهادة تقدير وتشجيع تربوي رسمية"
                >
                  <Award className="w-3 h-3" />
                  <span>شهادة تقدير</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 flex-1 bg-[#FAF8F5]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between">
              <span>{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 font-bold animate-pulse">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form to add participation */}
          <form onSubmit={handleSubmit} className="bg-[#FBF8EF] p-4 sm:p-5 rounded-2xl border border-[#E4DBC0] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#1F2926] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#1A4E47]" />
                <span>إضافة نقطة تميز / مشاركة إيجابية جديدة:</span>
              </h4>
              <span className="text-xs text-[#7A6B58]">اختر نموذجاً أو اكتب مخصصاً</span>
            </div>

            {/* Presets grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_TYPES.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = selectedType === item.title;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(item)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#1A4E47] bg-[#E8F2F0] shadow-xs ring-2 ring-[#1A4E47]/20'
                        : 'border-[#E4DBC0] bg-white hover:border-[#1A4E47] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg border shrink-0 ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#1F2926] leading-snug">{item.title}</div>
                      <div className="text-[11px] text-[#1A4E47] font-bold mt-0.5">
                        +{item.points} {item.points === 1 ? 'نقطة' : 'نقاط'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom / edited input */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#2A2118] mb-1">
                  عنوان المشاركة الإيجابية:
                </label>
                <input
                  type="text"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  placeholder="مثال: إجابة نموذجية، حفظ السورة، مساعدة زميل..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#D9CEB0] focus:outline-hidden focus:border-[#1A4E47] focus:ring-1 focus:ring-[#1A4E47] bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2A2118] mb-1">
                  النقاط التشجيعية:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={points}
                    onChange={(e) => setPoints(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-center text-sm font-bold rounded-xl border border-[#D9CEB0] focus:outline-hidden focus:border-[#1A4E47] focus:ring-1 focus:ring-[#1A4E47] bg-white font-mono"
                  />
                  <span className="text-xs text-[#7A6B58] font-bold">⭐</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2A2118] mb-1">
                ملاحظة إضافية أو تفصيل الإنجاز (اختياري):
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="مثال: تميز في تمرين المعادلات، تفاعل ممتاز أثناء الشرح..."
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#D9CEB0] focus:outline-hidden focus:border-[#1A4E47] focus:ring-1 focus:ring-[#1A4E47] bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] active:bg-[#0D2824] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>تسجيل التعزيز والإشادة</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* History of Positive Participations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#1F2926] flex items-center gap-2">
                <Award className="w-4 h-4 text-[#1A4E47]" />
                <span>سجل تعزيزات ومشاركات التلميذ ({participations.length}):</span>
              </h4>
              {participations.length > 0 && (
                <span className="text-xs text-[#1A4E47] bg-[#E8F2F0] font-bold px-2.5 py-0.5 rounded-full border border-[#B9D8D2]">
                  المجموع: {totalPoints} نقاط
                </span>
              )}
            </div>

            {participations.length === 0 ? (
              <div className="text-center py-8 bg-[#FBF8EF] rounded-2xl border border-dashed border-[#D9CEB0] p-6">
                <Sparkles className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-[#2A2118] text-sm font-bold">لا توجد مشاركات إيجابية مسجلة بعد لهذا التلميذ</p>
                <p className="text-[#7A6B58] text-xs mt-1">
                  استخدم النموذج أعلاه لتحفيز التلميذ وتسجيل أول نقطة تميز له اليوم!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {participations.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white border border-[#E4DBC0] shadow-2xs hover:border-[#1A4E47] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold shrink-0 mt-0.5">
                        <span className="text-xs font-black">+{item.points || 1}</span>
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-[#1F2926] flex items-center gap-1.5 flex-wrap">
                          <span>{item.participationType}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.2 rounded-md">
                            ⭐ {item.points || 1} {item.points === 1 ? 'نقطة' : 'نقاط'}
                          </span>
                        </div>
                        {item.note && (
                          <p className="text-xs text-stone-600 mt-0.5 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-100 inline-block">
                            «{item.note}»
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-stone-400" />
                            <span>{item.recordedDate}</span>
                          </span>
                          {item.recordedTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-stone-400" />
                              <span>{item.recordedTime}</span>
                            </span>
                          )}
                          {item.teacherName && (
                            <span>الأستاذ: <strong className="text-stone-600">{item.teacherName}</strong></span>
                          )}
                          {item.teacherSubject && (
                            <span className="text-emerald-700 font-medium">({item.teacherSubject})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                      title="حذف هذا السجل"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <div className="text-xs text-stone-500">
            القسم: <strong>{section.level} - القسم {section.classNumber}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
