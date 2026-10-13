import React, { useState } from 'react';
import {
  GraduationCap,
  Calendar,
  Clock,
  Award,
  AlertTriangle,
  MailWarning,
  LogOut,
  QrCode,
  CheckCircle2,
  XCircle,
  FileText,
  School,
  User,
  ShieldCheck,
  Printer,
  Sparkles,
  TrendingUp,
  MapPin,
  BookOpen
} from 'lucide-react';
import { printReportHtml } from '../utils/printNotes';

export interface StudentData {
  student: {
    id: string;
    name: string;
    massarNumber: string;
    studentNumber: string;
    seatNumber: number | null;
    sectionId: string;
    sectionLevel: string;
    sectionClass: string;
  };
  metrics: {
    totalAbsences: number;
    justifiedAbsences: number;
    unjustifiedAbsences: number;
    totalTardies: number;
    totalViolations: number;
    positiveCount: number;
    positivePoints: number;
    activeSummonsCount: number;
  };
  attendance: Array<{
    id: number;
    status: string;
    recordedDate: string;
    sessionPeriod: string;
    durationLabel: string;
    isJustified: boolean;
    justificationReason: string;
    notes: string;
    teacherName: string;
    teacherSubject: string;
  }>;
  violations: Array<{
    id: string;
    violationType: string;
    description: string;
    actionTaken: string;
    recordedDate: string;
    recordedTime: string;
    teacherName: string;
  }>;
  positiveParticipations: Array<{
    id: string;
    type: string;
    points: number;
    notes: string;
    badgeIcon: string;
    recordedDate: string;
    teacherName: string;
    teacherSubject: string;
  }>;
  summons: Array<{
    id: string;
    reason: string;
    summonsDate: string;
    appointmentTime: string;
    status: string;
    guardianName: string;
    notes: string;
  }>;
  timetable: Array<{
    id: string;
    day_of_week: number;
    slot_id: string;
    period_type: string;
    start_time: string;
    end_time: string;
    room?: string;
    subject?: string;
    notes?: string;
    teacherName?: string;
  }>;
}

interface StudentPortalDashboardProps {
  data: StudentData;
  institutionName: string;
  academicYear: string;
  onLogout: () => void;
}

const WEEKDAYS = [
  { index: 1, name: 'الإثنين' },
  { index: 2, name: 'الثلاثاء' },
  { index: 3, name: 'الأربعاء' },
  { index: 4, name: 'الخميس' },
  { index: 5, name: 'الجمعة' },
  { index: 6, name: 'السبت' }
];

export const StudentPortalDashboard: React.FC<StudentPortalDashboardProps> = ({
  data,
  institutionName,
  academicYear,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'timetable' | 'conduct' | 'summons' | 'badge'>('attendance');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(new Date().getDay() || 1);

  const { student, metrics, attendance, violations, positiveParticipations, summons, timetable } = data;

  // Print Student Badge
  const handlePrintBadge = () => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>بطاقة التلميذ المدرسية - ${student.name}</title>
        <style>
          @page { size: 85mm 54mm; margin: 0; }
          body {
            font-family: 'Amiri', serif, system-ui;
            direction: rtl;
            margin: 0;
            padding: 8px;
            background: #fff;
            color: #1F2926;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            box-sizing: border-box;
          }
          .badge-card {
            width: 82mm;
            height: 50mm;
            border: 2px solid #1A4E47;
            border-radius: 8px;
            padding: 8px 10px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #FAF8F5;
            position: relative;
          }
          .header {
            text-align: center;
            border-bottom: 1.5px solid #C98A3C;
            padding-bottom: 4px;
          }
          .header h1 { font-size: 8pt; margin: 0; color: #1A4E47; }
          .header h2 { font-size: 9pt; margin: 2px 0 0 0; color: #1F2926; font-weight: bold; }
          .content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 4px 0;
          }
          .info { font-size: 8pt; line-height: 1.4; }
          .name { font-size: 11pt; font-weight: bold; color: #1A4E47; margin-bottom: 2px; }
          .qr-placeholder {
            width: 50px;
            height: 50px;
            border: 1px dashed #1A4E47;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 6pt;
            background: #fff;
            text-align: center;
          }
          .footer {
            font-size: 6.5pt;
            color: #666;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #ddd;
            padding-top: 3px;
          }
        </style>
      </head>
      <body>
        <div class="badge-card">
          <div class="header">
            <h1>المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة</h1>
            <h2>${institutionName}</h2>
          </div>
          <div class="content">
            <div class="info">
              <div class="name">${student.name}</div>
              <div><strong>القسم:</strong> ${student.sectionLevel} - ق ${student.sectionClass}</div>
              <div><strong>رقم مسار:</strong> <code>${student.massarNumber}</code></div>
              ${student.seatNumber ? `<div><strong>المقعد:</strong> رقم ${student.seatNumber}</div>` : ''}
            </div>
            <div class="qr-placeholder">
              <svg width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="#1A4E47" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
          </div>
          <div class="footer">
            <span>الموسم الدراسي: ${academicYear}</span>
            <span>بطاقة رسمية للتلميذ</span>
          </div>
        </div>
      </body>
      </html>
    `;
    printReportHtml(html);
  };

  return (
    <div className="min-h-screen bg-[#F4F0E8] flex flex-col justify-between" dir="rtl">
      {/* Top Navbar */}
      <header className="bg-[#1A4E47] text-white py-3.5 px-4 sm:px-8 border-b border-[#C98A3C]/40 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#133D37] border-2 border-[#C98A3C]/60 flex items-center justify-center text-[#C98A3C] shadow-md">
              <GraduationCap className="w-6 h-6 text-[#C98A3C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold font-serif tracking-wide text-white">
                  فضاء التلميذ • {student.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#C98A3C]/20 border border-[#C98A3C]/40 text-[#C98A3C] font-bold text-[10px]">
                  تلميذ متمدرس
                </span>
              </div>
              <div className="text-xs text-[#F2EFE3]/80 mt-0.5 flex items-center gap-2">
                <span>{student.sectionLevel} - القسم {student.sectionClass}</span>
                <span>•</span>
                <span className="font-mono text-[#C98A3C]">مسار: {student.massarNumber}</span>
                <span>•</span>
                <span>{institutionName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintBadge}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/20 shadow-xs"
              title="طباعة بطاقتي المدرسية"
            >
              <QrCode className="w-4 h-4 text-[#C98A3C]" />
              <span className="hidden sm:inline">بطاقتي المدرسية</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-900/30 hover:bg-rose-900/50 text-rose-200 text-xs font-bold transition-all cursor-pointer border border-rose-700/30"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Student Space Content */}
      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {/* Active Summons Warning Banner (If any) */}
        {metrics.activeSummonsCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-600/40 text-amber-950 text-xs flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <MailWarning className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <strong className="text-sm block text-amber-900">تنبيه إداري: يوجد استدعاء لولي أمرك</strong>
                <span>المرجو إبلاغ ولي أمرك بضرورة مراجعة الحراسة العامة بالمؤسسة.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('summons')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              عرض تفاصيل الاستدعاء
            </button>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Attendance Metric */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#6C6356]">
              <span>نسبة المواظبة</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1A4E47] mt-1">
              {metrics.totalAbsences === 0 ? '100%' : `${Math.max(10, 100 - metrics.unjustifiedAbsences * 5)}%`}
            </div>
            <div className="text-[10px] text-emerald-700 font-semibold mt-1">
              {metrics.totalAbsences === 0 ? 'مواظبة تامة ✓' : `${metrics.justifiedAbsences} مبرر من أصل ${metrics.totalAbsences}`}
            </div>
          </div>

          {/* Absences */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#6C6356]">
              <span>حالات الغياب</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1F2926] mt-1">
              {metrics.totalAbsences}
            </div>
            <div className="text-[10px] text-rose-700 font-semibold mt-1">
              {metrics.unjustifiedAbsences} غير مبرر
            </div>
          </div>

          {/* Tardies */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#6C6356]">
              <span>حالات التأخر</span>
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1F2926] mt-1">
              {metrics.totalTardies}
            </div>
            <div className="text-[10px] text-[#6C6356] mt-1">
              سجل الحصص الصباحية والمسائية
            </div>
          </div>

          {/* Positive Points */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#6C6356]">
              <span>نقاط التميز</span>
              <Award className="w-3.5 h-3.5 text-[#C98A3C]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#C98A3C] mt-1">
              +{metrics.positivePoints}
            </div>
            <div className="text-[10px] text-emerald-700 font-semibold mt-1">
              {metrics.positiveCount} تشجيع ومشاركة
            </div>
          </div>

          {/* Violations */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#6C6356]">
              <span>المخالفات السلوكية</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-700 mt-1">
              {metrics.totalViolations}
            </div>
            <div className="text-[10px] text-[#6C6356] mt-1">
              {metrics.totalViolations === 0 ? 'سلوك منضبط ممتاز' : 'مخالفات مسجلة'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white p-1.5 rounded-2xl border border-[#E5DFD4] shadow-xs flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>سجل الغيابات والمواظبة ({attendance.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timetable')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'timetable'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Calendar className="w-4 h-4 text-[#C98A3C]" />
            <span>جدول الحصص واستعمال الزمان</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conduct')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'conduct'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-600" />
            <span>لوحة التميز والسلوك ({positiveParticipations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summons')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'summons'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <MailWarning className="w-4 h-4 text-amber-600" />
            <span>استدعاءات ولي الأمر ({summons.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('badge')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'badge'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <QrCode className="w-4 h-4 text-[#C98A3C]" />
            <span>بطاقتي المدرسية الرقمية</span>
          </button>
        </div>

        {/* TAB 1: ATTENDANCE RECORDS */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div>
                <h3 className="font-bold text-base text-[#1F2926]">سجل الغيابات والتأخرات المسجلة</h3>
                <p className="text-xs text-[#6C6356]">بيانات دقيقة حول مواظبتك اليومية وتبريرات الشواهد الطبية</p>
              </div>
              <span className="text-xs text-[#1A4E47] font-bold">
                المجموع: {attendance.length} حالة
              </span>
            </div>

            {attendance.length === 0 ? (
              <div className="py-12 text-center text-xs text-emerald-700 font-bold bg-emerald-50 rounded-xl border border-emerald-200">
                ✓ هنيئاً لك! ليس لديك أي تسجيل للغياب أو التأخر في هذا الموسم الدراسي.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[#E5DFD4] text-[#6C6356]">
                      <th className="py-3 px-4">تاريخ الغياب</th>
                      <th className="py-3 px-4">الحصة / الفترة</th>
                      <th className="py-3 px-4">المدة المسجلة</th>
                      <th className="py-3 px-4">المادة والأستاذ</th>
                      <th className="py-3 px-4">نوع الوضعية</th>
                      <th className="py-3 px-4">التبرير القانوني</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DFD4]">
                    {attendance.map((att) => (
                      <tr key={att.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#1F2926]">
                          {att.recordedDate}
                        </td>
                        <td className="py-3 px-4 text-[#1A4E47] font-semibold">
                          {att.sessionPeriod || 'كامل اليوم'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#6C6356]">
                          {att.durationLabel}
                        </td>
                        <td className="py-3 px-4 text-[#555]">
                          {att.teacherSubject ? `${att.teacherSubject} (${att.teacherName || ''})` : att.teacherName || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              att.status === 'absent' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {att.status === 'absent' ? 'غياب' : 'تأخر'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {att.isJustified ? (
                            <div className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>مبرر: {att.justificationReason || 'شهادة طبية'}</span>
                            </div>
                          ) : (
                            <span className="text-rose-600 font-bold">غير مبرر</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEEKLY TIMETABLE */}
        {activeTab === 'timetable' && (
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div>
                <h3 className="font-bold text-base text-[#1F2926]">جدول الحصص واستعمال الزمان الأسبوعي</h3>
                <p className="text-xs text-[#6C6356]">
                  الحصص والمواد والقاعات المخصصة لقسمك ({student.sectionLevel} - ق {student.sectionClass})
                </p>
              </div>
            </div>

            {/* Days Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.index}
                  type="button"
                  onClick={() => setSelectedDayIndex(day.index)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedDayIndex === day.index
                      ? 'bg-[#1A4E47] text-white shadow-xs'
                      : 'bg-[#FAF8F5] text-[#6C6356] border border-[#E5DFD4] hover:bg-[#F2EFE9]'
                  }`}
                >
                  {day.name}
                </button>
              ))}
            </div>

            {/* Timetable slots for the selected day */}
            {(() => {
              const daySlots = timetable.filter(t => t.day_of_week === selectedDayIndex);
              if (daySlots.length === 0) {
                return (
                  <div className="py-12 text-center text-xs text-[#6C6356] bg-[#FAF8F5] rounded-xl border border-[#E5DFD4]">
                    لا توجد حصص دراسية مبرمجة ليوم {WEEKDAYS.find(d => d.index === selectedDayIndex)?.name || ''}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {daySlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD4] flex items-start justify-between gap-3 hover:border-[#C98A3C] transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#1A4E47] text-white font-bold text-[10px]">
                            {slot.period_type === 'morning' ? 'صباحاً' : 'مساءً'}
                          </span>
                          <span className="font-bold text-sm text-[#1F2926]">
                            {slot.subject || 'مادة دراسية'}
                          </span>
                        </div>
                        <div className="text-xs text-[#6C6356] flex items-center gap-2">
                          <span>الأستاذ: <strong>{slot.teacherName || '—'}</strong></span>
                          {slot.room && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#C98A3C]" />
                                <span>القاعة: {slot.room}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="font-mono text-xs font-bold text-[#1A4E47] bg-white px-3 py-1.5 rounded-lg border border-[#E5DFD4] shrink-0">
                        {slot.start_time} - {slot.end_time}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 3: CONDUCT & REWARDS */}
        {activeTab === 'conduct' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Positive Participations */}
            <div className="bg-white rounded-2xl border border-[#E5DFD4] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-base text-[#1F2926]">سجل التشجيعات والمشاركات الإيجابية</h3>
                </div>
                <span className="font-bold font-mono text-emerald-700 text-sm">
                  +{metrics.positivePoints} نقطة
                </span>
              </div>

              {positiveParticipations.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#6C6356]">
                  لم تسجل نقاط تشجيعية حتى الآن. شارك بنشاط في الفصل للحصول على أوسمة التميز!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {positiveParticipations.map((p) => (
                    <div key={p.id} className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>{p.type}</span>
                        </span>
                        <span className="font-bold font-mono text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-300">
                          +{p.points} نقطة
                        </span>
                      </div>
                      {p.notes && <p className="text-[#555]">{p.notes}</p>}
                      <div className="text-[10px] text-[#777] flex items-center justify-between pt-1">
                        <span>الأستاذ: {p.teacherName} ({p.teacherSubject})</span>
                        <span className="font-mono">{p.recordedDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Violations / Conduct Notes */}
            <div className="bg-white rounded-2xl border border-[#E5DFD4] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="font-bold text-base text-[#1F2926]">سجل الملاحظات والانضباط</h3>
                </div>
                <span className="font-bold font-mono text-rose-700 text-sm">
                  {violations.length} ملاحظة
                </span>
              </div>

              {violations.length === 0 ? (
                <div className="py-10 text-center text-xs text-emerald-700 font-bold bg-emerald-50 rounded-xl border border-emerald-200">
                  ✓ سجل سلوكي نظيف ومثالي! واصل الحفاظ على انضباطك التربوي.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {violations.map((v) => (
                    <div key={v.id} className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-900">{v.violationType}</span>
                        <span className="text-[10px] text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md font-bold">
                          {v.actionTaken || 'تنبيه'}
                        </span>
                      </div>
                      <p className="text-[#555]">{v.description}</p>
                      <div className="text-[10px] text-[#777] flex items-center justify-between pt-1">
                        <span>الأستاذ المسجل: {v.teacherName}</span>
                        <span className="font-mono">{v.recordedDate} {v.recordedTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PARENT SUMMONS */}
        {activeTab === 'summons' && (
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div>
                <h3 className="font-bold text-base text-[#1F2926]">استدعاءات ولي الأمر الرسمية</h3>
                <p className="text-xs text-[#6C6356]">المواعيد والمراسلات الإدارية الموجهة للأسرة</p>
              </div>
            </div>

            {summons.length === 0 ? (
              <div className="py-12 text-center text-xs text-emerald-700 font-bold bg-emerald-50 rounded-xl border border-emerald-200">
                ✓ لا يوجد أي استدعاء صادر لولي أمرك.
              </div>
            ) : (
              <div className="space-y-3">
                {summons.map((s) => (
                  <div key={s.id} className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-sm text-amber-950">
                        سبب الاستدعاء: {s.reason}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                          s.status === 'signed_commitment'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'attended'
                            ? 'bg-blue-100 text-blue-800'
                            : s.status === 'absent'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status === 'signed_commitment'
                          ? 'حضر وتم توقيع التزام خطي ✓'
                          : s.status === 'attended'
                          ? 'حضر الولي'
                          : s.status === 'absent'
                          ? 'لم يحضر'
                          : 'في انتظار الحضور ⏳'}
                      </span>
                    </div>

                    <div className="text-[#555] flex items-center gap-4 flex-wrap">
                      <span><strong>موعد الحضور:</strong> {s.summonsDate} على الساعة {s.appointmentTime}</span>
                      <span><strong>الموجه إليه:</strong> {s.guardianName || 'ولي الأمر'}</span>
                    </div>

                    {s.notes && (
                      <p className="text-[#6C6356] bg-white p-2 rounded-lg border border-[#E5DFD4]">
                        <strong>ملاحظة الإدارة:</strong> {s.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DIGITAL BADGE */}
        {activeTab === 'badge' && (
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-6 shadow-xs flex flex-col items-center justify-center space-y-6">
            <div className="text-center max-w-md">
              <h3 className="font-bold text-lg text-[#1F2926] font-serif">بطاقتك المدرسية الرقمية</h3>
              <p className="text-xs text-[#6C6356] mt-1">
                بطاقة إلكترونية رسمية تثبت هويتك المدرسية بثانوية ايكسان الإعدادية للموسم {academicYear}
              </p>
            </div>

            {/* Badge Visual */}
            <div className="w-full max-w-md bg-gradient-to-br from-[#1A4E47] via-[#133D37] to-[#0A201D] text-white p-6 rounded-3xl shadow-xl border-2 border-[#C98A3C] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#C98A3C]/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <School className="w-5 h-5 text-[#C98A3C]" />
                  <span className="font-bold text-xs tracking-wide">{institutionName}</span>
                </div>
                <span className="text-[10px] font-mono text-[#C98A3C] font-bold">
                  {academicYear}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="text-lg font-bold font-serif text-white">{student.name}</div>
                  <div className="text-xs text-[#F2EFE3]/80">
                    {student.sectionLevel} • القسم {student.sectionClass}
                  </div>
                  <div className="text-xs font-mono text-[#C98A3C] pt-1">
                    رقم مسار: <strong>{student.massarNumber}</strong>
                  </div>
                  {student.seatNumber && (
                    <div className="text-[11px] text-white/70">
                      رقم المقعد بالقسم: <strong>{student.seatNumber}</strong>
                    </div>
                  )}
                </div>

                <div className="w-20 h-20 bg-white p-1.5 rounded-2xl flex items-center justify-center text-[#1A4E47] shadow-lg shrink-0">
                  <QrCode className="w-16 h-16" />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-[10px] text-white/60">
                <span>وزارة التربية الوطنية والتعليم الأولي والرياضة</span>
                <span className="text-emerald-300 font-semibold">تلميذ مسجل رسمياً ✓</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrintBadge}
              className="px-6 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs transition-all cursor-pointer shadow-md flex items-center gap-2"
            >
              <Printer className="w-4 h-4 text-[#C98A3C]" />
              <span>طباعة بطاقتي المدرسية</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#1A4E47] text-white/70 text-center py-3 border-t border-[#C98A3C]/30 text-xs">
        {institutionName} • فضاء التلميذ الرقمي للمتابعة والانضباط التربوي
      </footer>
    </div>
  );
};
