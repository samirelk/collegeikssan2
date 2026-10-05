import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  UserX,
  Clock,
  Printer,
  X,
  AlertTriangle,
  FileText,
  Send,
  Copy,
  Check,
  Calendar,
  Building,
  ShieldAlert,
  Loader2,
  ExternalLink
} from 'lucide-react';
import {
  printStudentAttendanceCard,
  printParentAbsenceNotice
} from '../utils/printNotes';

interface StudentAttendanceCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  sectionId: string;
  sectionName: string;
  studentNumber?: string;
  massarNumber?: string;
  seatNum?: number;
  institutionName?: string;
  academicYear?: string;
}

export const StudentAttendanceCardModal: React.FC<StudentAttendanceCardModalProps> = ({
  isOpen,
  onClose,
  studentName,
  sectionId,
  sectionName,
  studentNumber,
  massarNumber,
  seatNum,
  institutionName = 'الثانوية الإعدادية ايكسان',
  academicYear = '2026/2027'
}) => {
  const [activeTab, setActiveTab] = useState<'card' | 'notice'>('card');
  const [isLoading, setIsLoading] = useState(false);
  const [historyData, setHistoryData] = useState<{
    absences: any[];
    absenceRecordCount: number;
    totalHours: number;
    totalDays: number;
    violations: any[];
  } | null>(null);

  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    if (!isOpen || !studentName || !sectionId) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams({
          sectionId,
          studentName,
          seatNum: String(seatNum || 1),
          studentNumber: studentNumber || ''
        });
        const res = await fetch(`/api/students/history?${query.toString()}`);
        const data = await res.json();
        if (data.success && data.history) {
          setHistoryData(data.history);
        }
      } catch (err) {
        console.error('Failed to load student history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, studentName, sectionId, seatNum, studentNumber]);

  if (!isOpen) return null;

  const absences = historyData?.absences || [];
  const totalAbsences = absences.filter((a) => a.status === 'absent').length;
  const totalLates = absences.filter((a) => a.status === 'late').length;
  const justifiedCount = absences.filter((a) => a.justified && a.justified !== 'unjustified').length;
  const unjustifiedCount = absences.filter((a) => !a.justified || a.justified === 'unjustified').length;
  const totalHours = historyData?.totalHours || totalAbsences;

  const latestAbsence = absences[0];
  const latestDate = latestAbsence?.recordedDate || new Date().toISOString().slice(0, 10);
  const latestPeriod = latestAbsence?.sessionPeriod || 'الحصة الدراسية';
  const latestTeacher = latestAbsence?.teacherName || '';
  const latestSubject = latestAbsence?.teacherSubject || '';

  // Risk Level calculation
  const riskLevel = totalAbsences >= 5 ? 'critical' : totalAbsences >= 3 ? 'warning' : 'normal';

  const noticeText = `المملكة المغربية
وزارة التربية الوطنية والتعليم الأولي والرياضة
المؤسسة: ${institutionName}
الموسم الدراسي: ${academicYear}

إشعار رسمي بتغيب التلميذ(ة) موجه لولي الأمر:

نخبركم بأن ابنكم(تكم): ${studentName}
المسجل(ة) بالقسم: ${sectionName} ${studentNumber ? `(رقم: ${studentNumber})` : ''}
قد تغيب(ت) عن الحصة: ${latestPeriod} ${latestSubject ? `(مادة ${latestSubject})` : ''}
بتاريخ: ${latestDate}

المرجو منكم التفضل بالحضور إلى إدارة المؤسسة (مصلحة الحراسة العامة) في أقرب الآجال لتسوية وضعية التلميذ وتقديم المبرر القانوني تجنباً للإجراءات التأديبية المنصوص عليها في النظام الداخلي.`;

  const handleCopyNotice = () => {
    navigator.clipboard.writeText(noticeText);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  const handleWhatsAppNotice = () => {
    const encoded = encodeURIComponent(noticeText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handlePrintCard = () => {
    printStudentAttendanceCard({
      institution: institutionName,
      academicYear,
      studentName,
      studentNumber,
      massarNumber,
      sectionName,
      seatNum,
      totalAbsences,
      totalLates,
      totalHours,
      justifiedCount,
      unjustifiedCount,
      records: absences
    });
  };

  const handlePrintNotice = () => {
    printParentAbsenceNotice({
      institution: institutionName,
      academicYear,
      studentName,
      studentNumber,
      massarNumber,
      sectionName,
      recordedDate: latestDate,
      sessionPeriod: latestPeriod,
      teacherName: latestTeacher,
      teacherSubject: latestSubject
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#FBF8EF] border-0 sm:border border-[#E4DBC0] rounded-none sm:rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto min-h-[100dvh] sm:min-h-0 sm:max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[#E4DBC0] bg-[#1A4E47] text-white shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="text-sm sm:text-base font-bold font-serif leading-tight">
                بطاقة المواظبة الفردية للتلميذ(ة)
              </h3>
              <p className="text-[11px] text-emerald-200">
                {studentName} — {sectionName} {seatNum ? `(مقعد #${seatNum})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#E4DBC0] bg-[#EFE9D5] px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'card'
                ? 'bg-[#FBF8EF] text-[#1A4E47] border-t border-x border-[#E4DBC0] shadow-xs'
                : 'text-[#5B5040] hover:text-[#1A4E47]'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <span>كشف المواظبة والغيابات</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-mono">
              {totalAbsences}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notice')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'notice'
                ? 'bg-[#FBF8EF] text-[#1A4E47] border-t border-x border-[#E4DBC0] shadow-xs'
                : 'text-[#5B5040] hover:text-[#1A4E47]'
            }`}
          >
            <Send className="w-4 h-4 text-amber-700" />
            <span>إشعار / استدعاء ولي الأمر</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-[#7A6B58] flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#1A4E47]" />
              <p className="text-xs font-bold">جاري تحميل سجل المواظبة...</p>
            </div>
          ) : (
            <>
              {/* Risk Level Badge */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  riskLevel === 'critical'
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : riskLevel === 'warning'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {riskLevel === 'critical' ? (
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  ) : riskLevel === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  ) : (
                    <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-xs sm:text-sm">
                      {riskLevel === 'critical'
                        ? 'تنبيه حرج: التلميذ في دائرة خطر الانقطاع الدراسي (5 غيابات فأكثر)'
                        : riskLevel === 'warning'
                        ? 'إنذار مبكر: التلميذ لديه غيابات متكررة (3 أو 4 حصص)'
                        : 'وضعية مواظبة سليمة ومنتظمة'}
                    </div>
                    <div className="text-[11px] opacity-80">
                      {riskLevel === 'critical'
                        ? 'يجب استدعاء ولي الأمر وتوجيه إشعار رسمي عاجل لتفادي الفصل الإداري.'
                        : riskLevel === 'warning'
                        ? 'يُنصح بتنبيه التلميذ والتواصل مع الأسرة قبل تفاقم الغيابات.'
                        : 'لا توجد مؤشرات مقلقة بشأن مواظبة هذا التلميذ.'}
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-sm bg-white/80 px-2.5 py-1 rounded-lg border border-black/10 shrink-0">
                  {totalAbsences} حصة غياب
                </div>
              </div>

              {/* Statistics Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-white rounded-xl border border-[#D9CEB0] text-center">
                  <div className="text-[10px] text-[#7A6B58] font-bold">إجمالي الغيابات</div>
                  <div className="text-lg font-bold font-mono text-rose-700">{totalAbsences}</div>
                  <div className="text-[10px] text-[#7A6B58]">حصة دراسية</div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#D9CEB0] text-center">
                  <div className="text-[10px] text-[#7A6B58] font-bold">غياب غير مبرر</div>
                  <div className="text-lg font-bold font-mono text-rose-900">{unjustifiedCount}</div>
                  <div className="text-[10px] text-rose-600">بدون عذر</div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#D9CEB0] text-center">
                  <div className="text-[10px] text-[#7A6B58] font-bold">غياب مبرر</div>
                  <div className="text-lg font-bold font-mono text-emerald-700">{justifiedCount}</div>
                  <div className="text-[10px] text-emerald-600">شهادة / إذن</div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#D9CEB0] text-center">
                  <div className="text-[10px] text-[#7A6B58] font-bold">حالات التأخر</div>
                  <div className="text-lg font-bold font-mono text-amber-700">{totalLates}</div>
                  <div className="text-[10px] text-amber-600">تأخر عن الحصة</div>
                </div>
              </div>

              {/* TAB 1: Attendance Card Timeline */}
              {activeTab === 'card' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#2A2118] flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#1A4E47]" />
                      <span>السجل الزمني لكافة الغيابات والتأخرات المسجلة:</span>
                    </h4>
                    <button
                      type="button"
                      onClick={handlePrintCard}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة كشف المواظبة الفردي</span>
                    </button>
                  </div>

                  {absences.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-xl border border-[#D9CEB0] text-[#7A6B58]">
                      <UserCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <div className="font-bold text-xs text-[#2A2118]">
                        سجل التلميذ ناصع تماماً وبدون أي غيابات مسجلة
                      </div>
                      <div className="text-[11px] text-[#7A6B58] mt-0.5">
                        التلميذ مواظب وملتزم بالحضور في جميع الحصص.
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[#D9CEB0] rounded-xl bg-white shadow-2xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[#EFE9D5] text-[#2A2118] font-bold border-b border-[#D9CEB0]">
                          <tr>
                            <th className="p-2.5">#</th>
                            <th className="p-2.5">التاريخ</th>
                            <th className="p-2.5">الحصة / الفترة</th>
                            <th className="p-2.5">الحالة</th>
                            <th className="p-2.5">المادة / الأستاذ</th>
                            <th className="p-2.5">التبرير</th>
                            <th className="p-2.5">الملاحظة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAE4D0]">
                          {absences.map((ab, idx) => (
                            <tr key={ab.id || idx} className="hover:bg-[#FAF8F2]">
                              <td className="p-2.5 font-bold text-[#7A6B58]">{idx + 1}</td>
                              <td className="p-2.5 font-mono font-bold text-[#2A2118]">
                                {ab.recordedDate}
                              </td>
                              <td className="p-2.5 text-[#5B5040]">
                                {ab.sessionPeriod || 'كامل اليوم'}
                              </td>
                              <td className="p-2.5">
                                {ab.status === 'absent' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                    <UserX className="w-3 h-3 text-rose-600" />
                                    غياب
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    تأخر
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-[#2A2118]">
                                {ab.teacherSubject || '—'}{' '}
                                {ab.teacherName && (
                                  <span className="text-[10px] text-[#7A6B58]">({ab.teacherName})</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {ab.justified && ab.justified !== 'unjustified' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    مبرر ✓
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    غير مبرر ✕
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-[11px] text-[#7A6B58] max-w-xs truncate">
                                {ab.justificationReason || ab.notes || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Parent Notice & Call Slip */}
              {activeTab === 'notice' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        إشعار رسمي جاهز للإرسال الفوري لولي الأمر عبر رسالة نصية، واتساب، أو طباعة ورقية رسمية.
                      </span>
                    </div>
                  </div>

                  {/* Ready-to-send Message Preview */}
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={9}
                      value={noticeText}
                      className="w-full p-3.5 bg-white border border-[#D9CEB0] rounded-xl text-xs font-serif leading-relaxed text-[#2A2118] focus:outline-hidden resize-none shadow-2xs"
                    />
                  </div>

                  {/* Action buttons for parent notification */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={handleCopyNotice}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        copiedNotice
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white hover:bg-[#F7F4EB] text-[#2A2118] border-[#D9CEB0]'
                      }`}
                    >
                      {copiedNotice ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedNotice ? 'تم نسخ الإشعار ✓' : 'نسخ نص الإشعار'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleWhatsAppNotice}
                      className="px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>إرسال عبر واتساب (WhatsApp)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintNotice}
                      className="px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-[#1A4E47] hover:bg-[#133E38] text-white shadow-sm transition-all cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طباعة استدعاء ورقي رسمي</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-t border-[#E4DBC0] bg-[#EFE9D5] shrink-0">
          <div className="text-[11px] text-[#7A6B58]">
            المؤسسة: <strong>{institutionName}</strong> | الموسم: <strong>{academicYear}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-[#5B5040] font-bold text-xs border border-[#D9CEB0] cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
