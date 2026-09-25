import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Award,
  Sparkles,
  Printer,
  X,
  User,
  Users,
  Search,
  Calendar,
  ChevronDown,
  Star,
  BookCheck,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { SectionItem, User as UserType, PositiveParticipationItem } from '../types';
import {
  printStudentPositiveParticipationsReport,
  printSectionPositiveParticipationsReport
} from '../utils/printNotes';

interface PositiveParticipationsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
  sections: SectionItem[];
  initialSectionId?: string;
  initialStudentName?: string;
}

export const PositiveParticipationsReportModal: React.FC<PositiveParticipationsReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  sections,
  initialSectionId,
  initialStudentName
}) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    initialSectionId || (sections.length > 0 ? sections[0].id : '')
  );
  const [reportScope, setReportScope] = useState<'section' | 'student'>(
    initialStudentName ? 'student' : 'section'
  );
  const [selectedStudentName, setSelectedStudentName] = useState<string>(
    initialStudentName || ''
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'honor-roll' | 'detailed-log'>('honor-roll');

  // Update selected section if initialSectionId changes or sections load
  useEffect(() => {
    if (initialSectionId && sections.some((s) => s.id === initialSectionId)) {
      setSelectedSectionId(initialSectionId);
    } else if (!selectedSectionId && sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [initialSectionId, sections]);

  useEffect(() => {
    if (initialStudentName) {
      setSelectedStudentName(initialStudentName);
      setReportScope('student');
    }
  }, [initialStudentName]);

  const currentSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || sections[0];
  }, [sections, selectedSectionId]);

  // Aggregate all students and their positive participations in currentSection
  const studentsData = useMemo(() => {
    if (!currentSection) return [];

    const map = new Map<
      string,
      {
        name: string;
        number: string;
        massarNumber: string;
        seatNum?: number;
        points: number;
        participationsCount: number;
        participations: PositiveParticipationItem[];
      }
    >();

    // 1. Process seats
    currentSection.seats?.forEach((seat) => {
      const name = (seat.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const parts = seat.positiveParticipations || [];
      const pts =
        seat.positiveParticipationCount !== undefined
          ? seat.positiveParticipationCount
          : parts.reduce((sum, p) => sum + (p.points || 1), 0);

      map.set(key, {
        name,
        number: seat.number || (seat.seat ? String(seat.seat) : ''),
        massarNumber: seat.massarNumber || '',
        seatNum: seat.seat,
        points: pts,
        participationsCount: parts.length,
        participations: parts
      });
    });

    // 2. Process roster to catch any unseated students who have participations
    currentSection.roster?.forEach((r) => {
      const name = (r.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name,
          number: r.number || '',
          massarNumber: r.massarNumber || '',
          seatNum: undefined,
          points: r.positiveParticipationCount || 0,
          participationsCount: 0,
          participations: []
        });
      } else {
        const existing = map.get(key)!;
        if (!existing.massarNumber && r.massarNumber) {
          existing.massarNumber = r.massarNumber;
        }
        if (!existing.number && r.number) {
          existing.number = r.number;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.points - a.points);
  }, [currentSection]);

  // Collect all participations across this section
  const allSectionParticipations = useMemo(() => {
    return studentsData.flatMap((s) => s.participations).sort((a, b) => {
      const dateA = a.createdAt || a.recordedDate || '';
      const dateB = b.createdAt || b.recordedDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [studentsData]);

  // Set default student if scope is student and none selected
  useEffect(() => {
    if (reportScope === 'student' && !selectedStudentName && studentsData.length > 0) {
      setSelectedStudentName(studentsData[0].name);
    }
  }, [reportScope, selectedStudentName, studentsData]);

  const selectedStudentObj = useMemo(() => {
    if (!selectedStudentName) return studentsData[0] || null;
    return (
      studentsData.find(
        (s) => s.name.trim().toLowerCase() === selectedStudentName.trim().toLowerCase()
      ) ||
      studentsData[0] ||
      null
    );
  }, [studentsData, selectedStudentName]);

  // Filtered lists for live display
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return studentsData;
    const term = searchTerm.trim().toLowerCase();
    return studentsData.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.number.includes(term) ||
        s.massarNumber.toLowerCase().includes(term)
    );
  }, [studentsData, searchTerm]);

  // Stats
  const totalPoints = useMemo(() => {
    return studentsData.reduce((sum, s) => sum + s.points, 0);
  }, [studentsData]);

  const activeCount = useMemo(() => {
    return studentsData.filter((s) => s.points > 0).length;
  }, [studentsData]);

  const topStudent = useMemo(() => {
    return studentsData.length > 0 && studentsData[0].points > 0 ? studentsData[0] : null;
  }, [studentsData]);

  // Print Handlers
  const handlePrintSection = () => {
    if (!currentSection) return;
    printSectionPositiveParticipationsReport({
      level: currentSection.level,
      classNumber: currentSection.classNumber,
      teacherName: currentUser?.fullName || currentUser?.username,
      subject: currentUser?.subject,
      students: studentsData,
      allParticipations: allSectionParticipations
    });
  };

  const handlePrintStudent = (mode: 'report' | 'certificate') => {
    if (!currentSection || !selectedStudentObj) return;
    printStudentPositiveParticipationsReport({
      level: currentSection.level,
      classNumber: currentSection.classNumber,
      studentName: selectedStudentObj.name,
      studentNumber: selectedStudentObj.number,
      massarNumber: selectedStudentObj.massarNumber,
      seatNum: selectedStudentObj.seatNum,
      teacherName: currentUser?.fullName || currentUser?.username,
      subject: currentUser?.subject,
      participations: selectedStudentObj.participations,
      totalPoints: selectedStudentObj.points,
      mode
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-amber-200/80 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[92vh]"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 text-white p-5 sm:p-6 relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-300 text-amber-950 flex items-center justify-center font-bold shadow-md shrink-0">
              <Trophy className="w-7 h-7 text-amber-900" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-bold font-serif text-white">
                  سجل ولوحة شرف المشاركات الإيجابية والتحفيز
                </h3>
                <span className="bg-amber-300 text-amber-950 text-xs px-2.5 py-0.5 rounded-full font-black">
                  ⭐ متاح للإدارة والأساتذة
                </span>
              </div>
              <p className="text-amber-100 text-xs sm:text-sm mt-0.5">
                طباعة لوحة الشرف وتقارير التعزيز والسلوك الإيجابي حسب القسم أو حسب التلميذ
              </p>
            </div>
          </div>
        </div>

        {/* Filter & Controls Toolbar */}
        <div className="bg-amber-50/70 border-b border-amber-200/70 p-4 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Section Selector */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-800 shrink-0" />
              <span className="text-xs font-bold text-amber-900">القسم:</span>
              <select
                value={selectedSectionId}
                onChange={(e) => {
                  setSelectedSectionId(e.target.value);
                  setSelectedStudentName('');
                }}
                className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-amber-950 shadow-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.level} ({sec.classNumber}) {sec.teacher ? `- ${sec.teacher}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope Switcher: By Section OR By Student */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-amber-300 shadow-xs">
              <button
                type="button"
                onClick={() => setReportScope('section')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reportScope === 'section'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-100/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>حسب القسم (لوحة الشرف والسجل)</span>
              </button>

              <button
                type="button"
                onClick={() => setReportScope('student')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reportScope === 'student'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-100/60'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>حسب التلميذ (شهادة وبطاقة)</span>
              </button>
            </div>
          </div>

          {/* Student Selector when Scope is 'student' */}
          {reportScope === 'student' && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/50">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <User className="w-4 h-4 text-amber-800 shrink-0" />
                <span className="text-xs font-bold text-amber-900">اختر التلميذ(ة):</span>
                <select
                  value={selectedStudentName}
                  onChange={(e) => setSelectedStudentName(e.target.value)}
                  className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-amber-950 flex-1 max-w-sm shadow-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {studentsData.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name} {st.number ? `(#${st.number})` : ''} - {st.points} ⭐
                    </option>
                  ))}
                </select>
              </div>

              {/* Print Student Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintStudent('report')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                  title="طباعة بطاقة وسجل المشاركات الإيجابية الكامل"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة بطاقة وسجل التلميذ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintStudent('certificate')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                  title="طباعة شهادة تقدير وتحفيز تربوي رسمية"
                >
                  <Award className="w-4 h-4" />
                  <span>شهادة تقدير وتشجيع</span>
                </button>
              </div>
            </div>
          )}

          {/* Section Print Action Button when Scope is 'section' */}
          {reportScope === 'section' && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('honor-roll')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'honor-roll'
                      ? 'bg-amber-200/80 text-amber-950 font-black'
                      : 'text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  🏅 لوحة الشرف والترتيب
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('detailed-log')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'detailed-log'
                      ? 'bg-amber-200/80 text-amber-950 font-black'
                      : 'text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  📋 السجل التفصيلي ({allSectionParticipations.length})
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrintSection}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ طباعة لوحة الشرف وسجل القسم (A4)</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-stone-50">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-amber-200/80 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-xs font-bold text-amber-800">إجمالي نقاط القسم</div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
                ⭐ {totalPoints}
              </div>
            </div>

            <div className="bg-white border border-amber-200/80 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-xs font-bold text-amber-800">التلاميذ المتميزون</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                {activeCount} / {studentsData.length}
              </div>
            </div>

            <div className="bg-white border border-amber-200/80 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-xs font-bold text-amber-800">المشاركات المسجلة</div>
              <div className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
                {allSectionParticipations.length}
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 rounded-2xl p-3 text-center shadow-xs">
              <div className="text-xs font-bold text-amber-900">متصدر القسم 🥇</div>
              <div className="text-xs sm:text-sm font-black text-amber-950 truncate mt-1">
                {topStudent ? topStudent.name : '—'}
              </div>
              {topStudent && (
                <div className="text-[11px] font-bold text-amber-700">
                  {topStudent.points} نقطة تميز
                </div>
              )}
            </div>
          </div>

          {/* VIEW MODE 1: SECTION VIEW */}
          {reportScope === 'section' && (
            <div className="space-y-4">
              {activeSubTab === 'honor-roll' ? (
                <div className="bg-white border border-amber-200 rounded-2xl shadow-xs overflow-hidden">
                  <div className="p-3.5 bg-amber-50/70 border-b border-amber-200/80 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-600" />
                      <h4 className="font-bold text-amber-950 text-sm">
                        لوحة الشرف وتصنيف التلاميذ حسب رصيد النقاط
                      </h4>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="بحث عن تلميذ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white border border-stone-200 rounded-xl pr-8 pl-3 py-1 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-700 font-bold">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-12">الرتبة</th>
                          <th className="py-2.5 px-3">الاسم الكامل للتلميذ(ة)</th>
                          <th className="py-2.5 px-3 text-center w-16">الرقم</th>
                          <th className="py-2.5 px-3 text-center w-28">رقم مسار</th>
                          <th className="py-2.5 px-3 text-center w-24">رصيد النقاط</th>
                          <th className="py-2.5 px-3 text-center w-20">المشاركات</th>
                          <th className="py-2.5 px-3 text-center w-36">الوسام والتقدير</th>
                          <th className="py-2.5 px-3 text-center w-28">طباعة فردية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-stone-400 font-bold">
                              لا توجد بيانات مطابقة
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((st, i) => {
                            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                            const badge =
                              st.points >= 5
                                ? '🌟 وسام الامتياز'
                                : st.points >= 3
                                ? '🏅 وسام التميز'
                                : st.points > 0
                                ? '👍 وسام الاجتهاد'
                                : '—';
                            const badgeColor =
                              st.points >= 5
                                ? 'bg-amber-100 text-amber-900 border-amber-200'
                                : st.points >= 3
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                                : st.points > 0
                                ? 'bg-sky-100 text-sky-900 border-sky-200'
                                : 'text-stone-400';

                            return (
                              <tr
                                key={st.name}
                                className={`hover:bg-amber-50/40 transition-colors ${
                                  i < 3 ? 'bg-amber-50/20' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center font-bold text-sm">
                                  {medal}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-stone-900">
                                  {st.name}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-stone-600">
                                  {st.number || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-stone-600">
                                  {st.massarNumber || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-block bg-amber-100 border border-amber-300 text-amber-950 font-black px-2 py-0.5 rounded-lg text-xs">
                                    ⭐ {st.points}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center text-stone-600 font-bold">
                                  {st.participationsCount}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeColor}`}
                                  >
                                    {badge}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedStudentName(st.name);
                                      setReportScope('student');
                                    }}
                                    className="p-1 rounded-lg hover:bg-amber-100 text-amber-800 transition-colors cursor-pointer"
                                    title="عرض وطباعة بطاقة التلميذ"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Detailed participations log tab */
                <div className="bg-white border border-amber-200 rounded-2xl shadow-xs overflow-hidden">
                  <div className="p-3.5 bg-amber-50/70 border-b border-amber-200/80 flex items-center justify-between">
                    <h4 className="font-bold text-amber-950 text-sm">
                      السجل التفصيلي لجميع المشاركات الإيجابية المسجلة
                    </h4>
                    <span className="text-xs text-amber-800 font-bold">
                      {allSectionParticipations.length} مشاركة
                    </span>
                  </div>

                  <div className="divide-y divide-stone-100 max-h-[380px] overflow-y-auto">
                    {allSectionParticipations.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 font-bold">
                        لم يتم تسجيل أي مشاركات إيجابية في هذا القسم بعد
                      </div>
                    ) : (
                      allSectionParticipations.map((p, idx) => (
                        <div
                          key={p.id || idx}
                          className="p-3 hover:bg-stone-50 transition-colors flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-[11px]">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className="text-stone-900 text-sm">
                                  {p.studentName || '—'}
                                </strong>
                                <span className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                  ⭐ {p.participationType}
                                </span>
                                <span className="bg-emerald-100 text-emerald-950 px-1.5 py-0.5 rounded-md font-black text-[11px]">
                                  +{p.points || 1}
                                </span>
                              </div>
                              {p.note && (
                                <p className="text-stone-500 text-[11px] mt-0.5">{p.note}</p>
                              )}
                            </div>
                          </div>

                          <div className="text-left text-stone-400 font-mono text-[11px]">
                            <div>{p.recordedDate || '—'}</div>
                            <div>{p.teacherName || ''}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: STUDENT VIEW */}
          {reportScope === 'student' && selectedStudentObj && (
            <div className="space-y-4">
              {/* Student Hero Card */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-100/40 to-emerald-500/10 border-2 border-amber-300 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
                    ⭐
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-amber-950 font-serif">
                      {selectedStudentObj.name}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-amber-800 mt-1 flex-wrap font-bold">
                      <span>القسم: {currentSection.level} ({currentSection.classNumber})</span>
                      {selectedStudentObj.number && (
                        <span>الرقم: #{selectedStudentObj.number}</span>
                      )}
                      {selectedStudentObj.massarNumber && (
                        <span className="font-mono">مسار: {selectedStudentObj.massarNumber}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white/90 border border-amber-300 px-4 py-2 rounded-2xl shadow-xs">
                  <div>
                    <div className="text-xs text-amber-800 font-bold">رصيد نقاط التميز:</div>
                    <div className="text-2xl font-black text-amber-600">
                      {selectedStudentObj.points} ⭐
                    </div>
                  </div>
                  <div className="border-r border-amber-200 pr-3">
                    <div className="text-xs text-stone-500 font-bold">عدد المشاركات:</div>
                    <div className="text-lg font-bold text-stone-800">
                      {selectedStudentObj.participationsCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Participations List for Student */}
              <div className="bg-white border border-amber-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-3.5 bg-amber-50/70 border-b border-amber-200/80 flex items-center justify-between">
                  <h4 className="font-bold text-amber-950 text-sm">
                    سجل مشاركات وتعزيزات التلميذ(ة)
                  </h4>
                  <span className="text-xs text-amber-800 font-bold">
                    {selectedStudentObj.participations.length} مشاركة مسجلة
                  </span>
                </div>

                <div className="divide-y divide-stone-100 max-h-[340px] overflow-y-auto">
                  {selectedStudentObj.participations.length === 0 ? (
                    <div className="p-8 text-center text-stone-400 font-bold">
                      لا توجد مشاركات إيجابية مسجلة بعد لهذا التلميذ(ة).
                    </div>
                  ) : (
                    selectedStudentObj.participations.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="p-3.5 hover:bg-amber-50/30 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-950 text-sm">
                                ⭐ {p.participationType}
                              </span>
                              <span className="bg-emerald-100 text-emerald-950 font-black px-2 py-0.5 rounded-md text-xs">
                                +{p.points || 1} نقطة
                              </span>
                            </div>
                            {p.note && (
                              <p className="text-stone-600 text-xs mt-1 bg-stone-50 p-2 rounded-lg border border-stone-100">
                                {p.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-left text-stone-400 font-mono text-xs shrink-0">
                          <div>{p.recordedDate || '—'} {p.recordedTime || ''}</div>
                          <div className="text-stone-600 font-sans font-bold">{p.teacherName || ''}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-stone-100 border-t border-stone-200 p-4 px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-500">
            💡 يتم استخراج وطباعة المستندات وفق التنسيق المغربي الرسمي A4 مع أطر المصادقة والتوقيع.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            {reportScope === 'section' ? (
              <button
                type="button"
                onClick={handlePrintSection}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة سجل ولوحة شرف القسم</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handlePrintStudent('report')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة بطاقة وسجل التلميذ</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
