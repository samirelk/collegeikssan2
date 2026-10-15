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
  BookOpen,
  RefreshCw,
  LayoutGrid,
  List,
  Video,
  Link as LinkIcon,
  ExternalLink,
  Copy,
  Check,
  Megaphone,
  ShieldAlert,
  BookMarked
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
    homeworkCount?: number;
    activeLeavesCount?: number;
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
  homeworks?: Array<{
    id: string;
    teacherId: string;
    teacherName: string;
    subject: string;
    sectionId: string;
    postType: 'homework' | 'video' | 'lesson';
    title: string;
    description: string;
    urlLink: string;
    dueDate: string;
    createdAt: string;
  }>;
  teacherLeaves?: Array<{
    id: string;
    teacherId: string;
    teacherName: string;
    subject: string;
    sectionId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    slotIds: string;
    instructions: string;
    createdAt: string;
  }>;
  timetable: Array<{
    id: string;
    day_of_week?: number | string;
    dayOfWeek?: number | string;
    day_key?: string;
    dayKey?: string;
    day_name?: string;
    dayName?: string;
    slot_id?: string;
    slotId?: string;
    period_type?: string;
    periodType?: string;
    start_time?: string;
    startTime?: string;
    end_time?: string;
    endTime?: string;
    room?: string;
    subject?: string;
    notes?: string;
    teacherName?: string;
    isTeacherOnLeave?: boolean;
    leaveNotice?: {
      leaveType: string;
      instructions: string;
      startDate: string;
      endDate: string;
    } | null;
  }>;
}

interface StudentPortalDashboardProps {
  data: StudentData;
  institutionName: string;
  academicYear: string;
  onLogout: () => void;
  onUpdateData?: (newData: StudentData) => void;
}

const WEEKDAYS = [
  { index: 1, key: 'monday', name: 'الإثنين' },
  { index: 2, key: 'tuesday', name: 'الثلاثاء' },
  { index: 3, key: 'wednesday', name: 'الأربعاء' },
  { index: 4, key: 'thursday', name: 'الخميس' },
  { index: 5, key: 'friday', name: 'الجمعة' },
  { index: 6, key: 'saturday', name: 'السبت' }
];

export const TIMETABLE_PERIODS = [
  { id: 'm1', label: '08:00 - 09:00', short: 'ح1', period: 'morning', periodName: 'صباحاً' },
  { id: 'm2', label: '09:00 - 10:00', short: 'ح2', period: 'morning', periodName: 'صباحاً' },
  { id: 'm3', label: '10:00 - 11:00', short: 'ح3', period: 'morning', periodName: 'صباحاً' },
  { id: 'm4', label: '11:00 - 12:00', short: 'ح4', period: 'morning', periodName: 'صباحاً' },
  { id: 'e1', label: '14:00 - 15:00', short: 'ح5', period: 'evening', periodName: 'مساءً' },
  { id: 'e2', label: '15:00 - 16:00', short: 'ح6', period: 'evening', periodName: 'مساءً' },
  { id: 'e3', label: '16:00 - 17:00', short: 'ح7', period: 'evening', periodName: 'مساءً' },
  { id: 'e4', label: '17:00 - 18:00', short: 'ح8', period: 'evening', periodName: 'مساءً' }
];

export const StudentPortalDashboard: React.FC<StudentPortalDashboardProps> = ({
  data,
  institutionName,
  academicYear,
  onLogout,
  onUpdateData
}) => {
  const [activeTab, setActiveTab] = useState<'timetable' | 'homeworks' | 'leaves' | 'attendance' | 'conduct' | 'summons' | 'badge'>('timetable');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const today = new Date().getDay();
    return today >= 1 && today <= 6 ? today : 1;
  });
  const [timetableMode, setTimetableMode] = useState<'grid' | 'day'>('grid');
  const [isRefreshingTimetable, setIsRefreshingTimetable] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [homeworkFilter, setHomeworkFilter] = useState<'all' | 'homework' | 'video' | 'lesson'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { student, metrics, attendance, violations, positiveParticipations, summons, timetable } = data;
  const homeworks = data.homeworks || [];
  const teacherLeaves = data.teacherLeaves || [];

  const handleCopyLink = (url: string, id: string) => {
    try {
      navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {}
  };

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

  // Helper to match a timetable slot with a day of week (1..6)
  const matchDaySlot = (t: any, dayIdx: number) => {
    const dVal = t.day_of_week ?? t.dayOfWeek;
    if (Number(dVal) === dayIdx) return true;
    const str = String(t.day_key || t.dayKey || dVal || '').toLowerCase().trim();
    const map: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      'الإثنين': 1,
      'الثلاثاء': 2,
      'الأربعاء': 3,
      'الخميس': 4,
      'الجمعة': 5,
      'السبت': 6
    };
    return map[str] === dayIdx;
  };

  // Helper to find slot in full grid
  const findGridSlot = (dayIdx: number, slotId: string) => {
    return timetable.find(t => {
      if (!matchDaySlot(t, dayIdx)) return false;
      const sId = (t.slot_id || t.slotId || '').toLowerCase();
      if (sId === slotId.toLowerCase()) return true;
      const startTime = t.start_time || t.startTime || '';
      if (slotId === 'm1' && startTime.startsWith('08')) return true;
      if (slotId === 'm2' && startTime.startsWith('09')) return true;
      if (slotId === 'm3' && startTime.startsWith('10')) return true;
      if (slotId === 'm4' && startTime.startsWith('11')) return true;
      if (slotId === 'e1' && startTime.startsWith('14')) return true;
      if (slotId === 'e2' && startTime.startsWith('15')) return true;
      if (slotId === 'e3' && startTime.startsWith('16')) return true;
      if (slotId === 'e4' && startTime.startsWith('17')) return true;
      return false;
    });
  };

  // Refresh student data in real-time
  const handleRefreshTimetable = async () => {
    setIsRefreshingTimetable(true);
    setRefreshSuccess(false);
    try {
      const res = await fetch(`/api/student/refresh/${encodeURIComponent(student.massarNumber)}`);
      const json = await res.json();
      if (json.success && onUpdateData) {
        onUpdateData(json);
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to refresh student timetable:', err);
    } finally {
      setIsRefreshingTimetable(false);
    }
  };

  // Print weekly timetable cleanly
  const handlePrintTimetable = () => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>جدول الحصص واستعمال الزمان - ${student.name}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body {
            font-family: 'Amiri', serif, system-ui;
            direction: rtl;
            background: #fff;
            color: #1F2926;
            margin: 0;
            padding: 8px;
          }
          .title-header {
            text-align: center;
            border-bottom: 2px solid #1A4E47;
            padding-bottom: 6px;
            margin-bottom: 10px;
          }
          .title-header h2 { margin: 0; font-size: 13pt; color: #1A4E47; }
          .title-header h3 { margin: 2px 0 0 0; font-size: 11pt; color: #555; }
          .student-meta {
            display: flex;
            justify-content: space-between;
            background: #FAF8F5;
            border: 1px solid #E5DFD4;
            border-radius: 6px;
            padding: 8px 14px;
            margin-bottom: 12px;
            font-size: 10pt;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
            text-align: center;
          }
          th, td {
            border: 1px solid #1A4E47;
            padding: 6px 4px;
          }
          th {
            background: #1A4E47;
            color: #fff;
            font-weight: bold;
          }
          .period-head {
            background: #EFE9D5;
            color: #1A4E47;
            font-weight: bold;
            width: 95px;
          }
          .slot-card {
            background: #F4F8F7;
            border: 1px solid #C98A3C;
            border-radius: 4px;
            padding: 4px;
            min-height: 42px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .subj { font-weight: bold; color: #1A4E47; font-size: 10pt; }
          .teacher { font-size: 8pt; color: #444; margin-top: 1px; }
          .room { font-size: 7.5pt; color: #777; }
          .empty { color: #ccc; }
          .footer {
            margin-top: 12px;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #666;
            border-top: 1px dotted #ccc;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="title-header">
          <h2>المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة</h2>
          <h3>استعمال الزمان الأسبوعي للتلميذ • ${institutionName} (${academicYear})</h3>
        </div>
        <div class="student-meta">
          <div><strong>الاسم الكامل:</strong> ${student.name}</div>
          <div><strong>القسم:</strong> ${student.sectionLevel} - ق ${student.sectionClass}</div>
          <div><strong>رقم مسار:</strong> <code>${student.massarNumber}</code></div>
          ${student.seatNumber ? `<div><strong>المقعد:</strong> ${student.seatNumber}</div>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th class="period-head">التوقيت / الحصة</th>
              ${WEEKDAYS.map(d => `<th>${d.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${TIMETABLE_PERIODS.map(p => `
              <tr>
                <td class="period-head"><strong>${p.short}</strong><br><span style="font-size: 7.5pt; color: #666;">${p.label}</span></td>
                ${WEEKDAYS.map(d => {
                  const sl = findGridSlot(d.index, p.id);
                  if (!sl) return `<td class="empty">—</td>`;
                  return `
                    <td>
                      <div class="slot-card">
                        <div class="subj">${sl.subject || 'مادة دراسية'}</div>
                        <div class="teacher">${sl.teacherName || ''}</div>
                        ${sl.room ? `<div class="room">القاعة: ${sl.room}</div>` : ''}
                      </div>
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-MA')}</span>
          <span>المدرسة الرقمية • فضاء التلميذ وتتبع المواظبة</span>
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
        {/* Active Teacher Leaves Alert Banner */}
        {teacherLeaves.length > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 text-amber-950 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <Megaphone className="w-5 h-5 text-amber-700 shrink-0 animate-bounce" />
              <div>
                <strong className="text-sm block text-amber-950">إشعار للقسم: تصريح برخصة غياب أستاذ(ة)</strong>
                <span className="text-amber-900">
                  {teacherLeaves.map(l => `${l.teacherName} (${l.subject})`).join(' • ')} — يرجى مراجعة التوجيهات والواجبات الموكولة إليكم أثناء فترة الرخصة.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('leaves')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              عرض التوجيهات والرخصة
            </button>
          </div>
        )}

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

          {/* Homeworks Metric */}
          <div
            onClick={() => setActiveTab('homeworks')}
            className="p-4 rounded-2xl bg-white border border-[#E5DFD4] hover:border-[#1A4E47] shadow-xs cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-[#6C6356]">
              <span>الواجبات والدروس</span>
              <BookOpen className="w-3.5 h-3.5 text-[#1A4E47]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1A4E47] mt-1">
              {homeworks.length}
            </div>
            <div className="text-[10px] text-[#1A4E47] font-semibold mt-1">
              {homeworks.length === 0 ? 'لا توجد واجبات معلقة' : `${homeworks.length} منشورات من أساتذتك`}
            </div>
          </div>

          {/* Teacher Leaves Metric */}
          <div
            onClick={() => setActiveTab('leaves')}
            className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-colors ${
              teacherLeaves.length > 0 ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-[#E5DFD4]'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-[#6C6356]">
              <span>رخص وغياب الأساتذة</span>
              <Megaphone className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#8A5A18] mt-1">
              {teacherLeaves.length}
            </div>
            <div className="text-[10px] text-[#8A5A18] font-semibold mt-1">
              {teacherLeaves.length === 0 ? 'الأساتذة حاضرون بانتظام' : `${teacherLeaves.length} إشعار رخصة نشط`}
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
            onClick={() => setActiveTab('timetable')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'timetable'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Calendar className="w-4 h-4 text-[#C98A3C]" />
            <span>جدول الحصص واستعمال الزمان ({timetable.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('homeworks')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'homeworks'
                ? 'bg-[#1A4E47] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>الواجبات والدروس الرقمية ({homeworks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaves')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'leaves'
                ? 'bg-[#8A5A18] text-white shadow-sm'
                : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-[#FAF8F5]'
            }`}
          >
            <Megaphone className="w-4 h-4 text-amber-500" />
            <span>رخص وغياب الأساتذة ({teacherLeaves.length})</span>
          </button>

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
            <span>سجل المواظبة والغياب ({attendance.length})</span>
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

        {/* TAB: HOMEWORKS & DIGITAL LESSONS */}
        {activeTab === 'homeworks' && (
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5DFD4]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-[#1F2926]">
                    الواجبات المدرسية والدروس الرقمية
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#1A4E47]/10 text-[#1A4E47] font-bold text-xs">
                    {homeworks.length} منشور
                  </span>
                </div>
                <p className="text-xs text-[#6C6356] mt-0.5">
                  الواجبات، مقاطع الفيديو التعليمية، وروابط الدروس المنشورة خصيصاً لقسمك ({student.sectionLevel} - ق {student.sectionClass})
                </p>
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD4] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setHomeworkFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    homeworkFilter === 'all'
                      ? 'bg-[#1A4E47] text-white shadow-xs'
                      : 'text-[#6C6356] hover:text-[#1F2926]'
                  }`}
                >
                  الكل ({homeworks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHomeworkFilter('homework')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    homeworkFilter === 'homework'
                      ? 'bg-[#1A4E47] text-white shadow-xs'
                      : 'text-[#6C6356] hover:text-[#1F2926]'
                  }`}
                >
                  واجبات منزلية ({homeworks.filter((h) => h.postType === 'homework').length})
                </button>
                <button
                  type="button"
                  onClick={() => setHomeworkFilter('video')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    homeworkFilter === 'video'
                      ? 'bg-[#8A5A18] text-white shadow-xs'
                      : 'text-[#6C6356] hover:text-[#1F2926]'
                  }`}
                >
                  فيديوهات وروابط ({homeworks.filter((h) => h.postType === 'video').length})
                </button>
                <button
                  type="button"
                  onClick={() => setHomeworkFilter('lesson')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    homeworkFilter === 'lesson'
                      ? 'bg-[#1F2926] text-white shadow-xs'
                      : 'text-[#6C6356] hover:text-[#1F2926]'
                  }`}
                >
                  دروس وملخصات ({homeworks.filter((h) => h.postType === 'lesson').length})
                </button>
              </div>
            </div>

            {/* List */}
            {(() => {
              const filteredHomeworks =
                homeworkFilter === 'all'
                  ? homeworks
                  : homeworks.filter((h) => h.postType === homeworkFilter);

              if (filteredHomeworks.length === 0) {
                return (
                  <div className="py-14 text-center text-xs text-[#6C6356] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#D5CDC0] space-y-2">
                    <BookOpen className="w-10 h-10 text-[#C5BCAD] mx-auto" />
                    <div className="font-bold text-sm text-[#1F2926]">
                      {homeworkFilter === 'all'
                        ? 'لا توجد واجبات أو دروس منشورة حالياً لقسمك'
                        : 'لا توجد منشورات من هذا النوع حالياً'}
                    </div>
                    <p className="text-[11px] text-[#8C8275] max-w-sm mx-auto">
                      عندما يقوم أساتذة قسمك بنشر واجبات منزلية أو روابط فيديوهات توضيحية، ستظهر لك هنا مباشرة.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredHomeworks.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-[#FAF8F5] border-2 border-[#E5DFD4] hover:border-[#C98A3C] transition-all flex flex-col justify-between shadow-2xs space-y-3"
                    >
                      <div className="space-y-2.5">
                        {/* Header: Type & Teacher */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
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
                                <span>فيديو تعليمي / رابط مختصر</span>
                              </>
                            ) : item.postType === 'lesson' ? (
                              <>
                                <FileText className="w-3 h-3" />
                                <span>درس / ملخص مكتوب</span>
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-3 h-3" />
                                <span>واجب منزلي</span>
                              </>
                            )}
                          </span>

                          <div className="text-xs text-[#554C3F] font-semibold flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#C98A3C]" />
                            <span>الأستاذ: {item.teacherName}</span>
                            <span className="text-[#C5BCAD]">({item.subject})</span>
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="font-bold text-sm sm:text-base text-[#1F2926] leading-snug">
                          {item.title}
                        </h4>

                        {/* Description */}
                        {item.description && (
                          <div className="text-xs text-[#4A4235] whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-xl border border-[#E5DFD4]">
                            {item.description}
                          </div>
                        )}

                        {/* URL Link Box */}
                        {item.urlLink && (
                          <div className="p-3 rounded-xl bg-white border border-[#D5CDC0] flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-[200px]">
                              {item.postType === 'video' ? (
                                <Video className="w-4 h-4 text-rose-600 shrink-0" />
                              ) : (
                                <LinkIcon className="w-4 h-4 text-[#C98A3C] shrink-0" />
                              )}
                              <span className="text-xs font-mono text-[#1A4E47] truncate dir-ltr">
                                {item.urlLink}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(item.urlLink, item.id)}
                                className="px-2.5 py-1.5 rounded-lg border border-[#D5CDC0] hover:bg-[#FAF8F5] text-xs font-bold text-[#6C6356] flex items-center gap-1 transition-all cursor-pointer"
                                title="نسخ الرابط"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700">تم النسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>نسخ</span>
                                  </>
                                )}
                              </button>

                              <a
                                href={item.urlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold flex items-center gap-1 transition-all shadow-2xs"
                              >
                                <span>فتح الرابط</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Dates */}
                      <div className="flex items-center justify-between text-[11px] text-[#6C6356] pt-3 border-t border-[#E5DFD4] mt-2">
                        {item.dueDate ? (
                          <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            آخر أجل للتسليم: {item.dueDate}
                          </span>
                        ) : (
                          <span className="text-[#8C8275]">واجب مفتوح للمراجعة</span>
                        )}
                        <span>تاريخ النشر: {new Date(item.createdAt).toLocaleDateString('ar-MA')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB: TEACHER LEAVES & ABSENCE NOTICES */}
        {activeTab === 'leaves' && (
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5DFD4] flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-[#1F2926]">
                    إشعارات رخص وغياب الأساتذة
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-xs">
                    {teacherLeaves.length} إشعار
                  </span>
                </div>
                <p className="text-xs text-[#6C6356] mt-0.5">
                  بيان رسمي بالرخص القانونية لأساتذة قسمك وتوجيهاتهم للعمل الذاتي أثناء فترة الغياب
                </p>
              </div>
            </div>

            {teacherLeaves.length === 0 ? (
              <div className="py-14 text-center text-xs text-emerald-800 font-bold bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <div className="text-sm">✓ جميع أساتذة قسمك حاضرون بانتظام</div>
                <p className="text-[11px] font-normal text-emerald-700 max-w-sm mx-auto">
                  لا توجد أي رخصة غياب مصرح بها حالياً. الحصص الدراسية تسير وفق جدول الحصص العادي.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {teacherLeaves.map((leave) => {
                  const typeLabel =
                    leave.leaveType === 'sick'
                      ? 'رخصة مرضية قصيرة'
                      : leave.leaveType === 'admin'
                      ? 'رخصة إدارية استثنائية'
                      : leave.leaveType === 'training'
                      ? 'تكوين مستمر / تأطير تربوي'
                      : leave.leaveType === 'mission'
                      ? 'مهمة رسمية'
                      : 'رخصة قانونية';

                  return (
                    <div
                      key={leave.id}
                      className="p-5 rounded-2xl bg-gradient-to-r from-[#FFFDF8] to-[#FFF9EE] border-2 border-amber-300 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-lg bg-amber-200/90 text-amber-950 font-bold text-xs border border-amber-400">
                            {typeLabel}
                          </span>
                          <span className="font-bold text-sm sm:text-base text-[#1F2926]">
                            الأستاذ(ة): {leave.teacherName}
                          </span>
                          <span className="text-xs text-[#6C6356]">
                            ({leave.subject})
                          </span>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          إشعار رسمي معتمد ✓
                        </span>
                      </div>

                      {/* Period & Slots */}
                      <div className="flex items-center gap-4 text-xs text-[#554C3F] flex-wrap bg-white p-3 rounded-xl border border-amber-200">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[#8A5A18]" />
                          <span>
                            <strong>فترة الرخصة:</strong> من <strong className="font-mono">{leave.startDate}</strong> إلى <strong className="font-mono">{leave.endDate}</strong>
                          </span>
                        </div>
                        <span className="text-[#D5CDC0]">•</span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-[#8A5A18]" />
                          <span>
                            <strong>الحصص المعنية:</strong> {leave.slotIds === 'all' ? 'كامل اليوم (جميع الحصص)' : leave.slotIds}
                          </span>
                        </div>
                      </div>

                      {/* Instructions */}
                      {leave.instructions && (
                        <div className="p-3.5 rounded-xl bg-white border border-amber-300/80 text-xs text-[#4A4235] space-y-1">
                          <strong className="text-amber-900 block font-bold">
                            توجيهات ومهام الأستاذ للتلاميذ أثناء فترة الرخصة:
                          </strong>
                          <p className="whitespace-pre-wrap leading-relaxed text-[#1F2926]">
                            {leave.instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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

        {/* TAB 2: WEEKLY TIMETABLE (استعمال الزمان التلقائي) */}
        {activeTab === 'timetable' && (
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-4 sm:p-6 shadow-xs space-y-5">
            {/* Header with Title and Quick Actions */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5DFD4] flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-[#1F2926]">
                    جدول الحصص واستعمال الزمان الأسبوعي
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#1A4E47]/10 text-[#1A4E47] font-bold text-xs">
                    {timetable.length} حصة مبرمجة
                  </span>
                </div>
                <p className="text-xs text-[#6C6356] mt-0.5">
                  تحديث أوتوماتيكي مباشر بمجرد إدراج الأساتذة لحصص قسمك ({student.sectionLevel} - ق {student.sectionClass})
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* View Switcher: Grid vs Day */}
                <div className="bg-[#FAF8F5] border border-[#E5DFD4] rounded-xl p-1 flex items-center">
                  <button
                    type="button"
                    onClick={() => setTimetableMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timetableMode === 'grid'
                        ? 'bg-[#1A4E47] text-white shadow-xs'
                        : 'text-[#6C6356] hover:text-[#1F2926]'
                    }`}
                    title="الجدول الأسبوعي الكامل"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">الجدول الكامل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimetableMode('day')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timetableMode === 'day'
                        ? 'bg-[#1A4E47] text-white shadow-xs'
                        : 'text-[#6C6356] hover:text-[#1F2926]'
                    }`}
                    title="عرض حسب اليوم"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">عرض اليوم</span>
                  </button>
                </div>

                {/* Live Refresh Button */}
                <button
                  type="button"
                  onClick={handleRefreshTimetable}
                  disabled={isRefreshingTimetable}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF8F5] hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#D5CDC0] transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  title="تحديث جدول الحصص الآن لجلب أي حصص جديدة أضافها الأساتذة"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingTimetable ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingTimetable ? 'جاري التحديث...' : refreshSuccess ? 'تم التحديث ✓' : 'تحديث الحصص'}</span>
                </button>

                {/* Print Timetable Button */}
                <button
                  type="button"
                  onClick={handlePrintTimetable}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1A4E47] hover:bg-[#133D37] text-white transition-all cursor-pointer shadow-xs"
                  title="طباعة جدول الحصص الأسبوعي الرسمي للتلميذ"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الجدول</span>
                </button>
              </div>
            </div>

            {/* Today's Classes Alert Banner */}
            {(() => {
              const currentJsDay = new Date().getDay();
              const todayIndex = currentJsDay >= 1 && currentJsDay <= 6 ? currentJsDay : 1;
              const todayName = WEEKDAYS.find(d => d.index === todayIndex)?.name || '';
              const todaySlots = timetable.filter(t => matchDaySlot(t, todayIndex));

              return (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#FAF8F5] via-[#FFFDF8] to-[#FAF8F5] border border-[#C98A3C]/40 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1A4E47] text-[#C98A3C] flex items-center justify-center font-bold shrink-0 shadow-xs">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1F2926] flex items-center gap-2">
                        <span>حصص اليوم ({todayName}):</span>
                        {todaySlots.length > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                            {todaySlots.length} حصة مقررة اليوم
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px]">
                            لا توجد حصص دراسية مبرمجة لقسمك اليوم
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6C6356] mt-0.5">
                        {todaySlots.length > 0
                          ? todaySlots.map((s, i) => `${s.subject || 'مادة'} (${s.start_time || s.startTime} - ${s.end_time || s.endTime}) مع الأستاذ ${s.teacherName || ''}`).join(' • ')
                          : 'يمكنك مراجعة دروسك أو تصفح الحصص المبرمجة لباقي أيام الأسبوع أدناه.'}
                      </div>
                    </div>
                  </div>

                  {todaySlots.length > 0 && timetableMode === 'day' && (
                    <button
                      type="button"
                      onClick={() => setSelectedDayIndex(todayIndex)}
                      className="px-3 py-1.5 rounded-xl bg-[#1A4E47] text-white text-xs font-bold hover:bg-[#133D37] cursor-pointer shrink-0 transition-all shadow-2xs"
                    >
                      عرض حصص اليوم
                    </button>
                  )}
                </div>
              );
            })()}

            {/* VIEW MODE 1: FULL WEEKLY GRID TABLE (الجدول الأسبوعي الكامل) */}
            {timetableMode === 'grid' && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-2xl border border-[#E5DFD4] bg-[#FAF8F5]/50 shadow-2xs">
                  <table className="w-full text-center border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-[#1A4E47] text-white text-xs">
                        <th className="py-3 px-3 w-32 border-b border-[#C98A3C]/40 font-bold">
                          الحصة / التوقيت
                        </th>
                        {WEEKDAYS.map((day) => {
                          const isToday = new Date().getDay() === day.index;
                          const dayCount = timetable.filter(t => matchDaySlot(t, day.index)).length;
                          return (
                            <th
                              key={day.index}
                              className={`py-3 px-2 border-b border-[#C98A3C]/40 font-bold transition-colors ${
                                isToday ? 'bg-[#133D37] text-[#C98A3C]' : ''
                              }`}
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <span>{day.name}</span>
                                {isToday && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-[#C98A3C] text-[#133D37] font-bold rounded-sm">
                                    اليوم
                                  </span>
                                )}
                                <span className="text-[10px] font-normal text-white/70">
                                  ({dayCount} حصة)
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-[#E5DFD4]">
                      {TIMETABLE_PERIODS.map((period, pIdx) => {
                        const isFirstEvening = period.id === 'e1';

                        return (
                          <React.Fragment key={period.id}>
                            {/* Lunch Break Separator */}
                            {isFirstEvening && (
                              <tr className="bg-[#FAF0DC] text-[#8A5A18] font-bold text-[11px]">
                                <td colSpan={7} className="py-2 px-3 border-y border-[#E5DFD4] text-center">
                                  ☕ فترة الظهيرة والاستراحة (12:00 - 14:00)
                                </td>
                              </tr>
                            )}

                            <tr className={pIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAF8F5]'}>
                              {/* Period Header */}
                              <td className="py-2.5 px-3 font-mono font-bold text-[#1A4E47] bg-[#F4EFE6]/60 border-l border-[#E5DFD4] text-right whitespace-nowrap">
                                <div className="font-bold text-[11px] text-[#1F2926]">{period.short} ({period.periodName})</div>
                                <div className="text-[10px] text-[#6C6356] font-mono">{period.label}</div>
                              </td>

                              {/* Days Columns */}
                              {WEEKDAYS.map((day) => {
                                const slot = findGridSlot(day.index, period.id);

                                if (!slot) {
                                  return (
                                    <td key={day.index} className="py-2 px-2 text-[#C5BCAD] text-xs">
                                      —
                                    </td>
                                  );
                                }

                                return (
                                  <td key={day.index} className="p-1.5">
                                    <div className={`p-2.5 rounded-xl border-2 transition-all text-right shadow-2xs group ${
                                      slot.isTeacherOnLeave
                                        ? 'bg-amber-50/90 border-amber-400'
                                        : 'bg-gradient-to-br from-white to-[#F9F7F2] border-[#1A4E47]/30 hover:border-[#1A4E47]'
                                    }`}>
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <span className="font-bold text-xs text-[#1A4E47] truncate">
                                          {slot.subject || 'مادة دراسية'}
                                        </span>
                                        {slot.room && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#C98A3C]/20 text-[#8A5A18] font-bold font-mono">
                                            ق {slot.room}
                                          </span>
                                        )}
                                      </div>

                                      <div className="text-[10px] text-[#4A4235] font-semibold flex items-center gap-1 truncate">
                                        <User className="w-2.5 h-2.5 text-[#C98A3C] shrink-0" />
                                        <span className="truncate">{slot.teacherName || '—'}</span>
                                      </div>

                                      {slot.isTeacherOnLeave && (
                                        <div
                                          className="mt-1 px-1.5 py-0.5 rounded-md bg-amber-200/90 text-amber-950 font-bold text-[9px] flex items-center gap-1 border border-amber-300"
                                          title={slot.leaveNotice?.instructions || 'الأستاذ في رخصة غياب مبررة'}
                                        >
                                          <AlertTriangle className="w-2.5 h-2.5 text-amber-800 shrink-0" />
                                          <span className="truncate">رخصة غياب للأستاذ</span>
                                        </div>
                                      )}

                                      {slot.notes && (
                                        <div className="text-[9px] text-[#6C6356] mt-1 italic truncate">
                                          {slot.notes}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#6C6356] pt-1 px-1">
                  <span>
                    💡 الحصص تظهر آلياً وتحدث فور قيام أي أستاذ بإسناد قسمك لحصته في استعمال زمانه.
                  </span>
                  <span>الموسم الدراسي: {academicYear}</span>
                </div>
              </div>
            )}

            {/* VIEW MODE 2: DAY-BY-DAY VIEW (عرض اليوم المحدد) */}
            {timetableMode === 'day' && (
              <div className="space-y-4">
                {/* Days Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {WEEKDAYS.map((day) => {
                    const count = timetable.filter(t => matchDaySlot(t, day.index)).length;
                    const isToday = new Date().getDay() === day.index;

                    return (
                      <button
                        key={day.index}
                        type="button"
                        onClick={() => setSelectedDayIndex(day.index)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          selectedDayIndex === day.index
                            ? 'bg-[#1A4E47] text-white shadow-xs'
                            : 'bg-[#FAF8F5] text-[#6C6356] border border-[#E5DFD4] hover:bg-[#F2EFE9]'
                        }`}
                      >
                        <span>{day.name}</span>
                        {isToday && (
                          <span className={`text-[9px] px-1 rounded-sm font-bold ${
                            selectedDayIndex === day.index ? 'bg-[#C98A3C] text-[#133D37]' : 'bg-[#1A4E47] text-white'
                          }`}>
                            اليوم
                          </span>
                        )}
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          selectedDayIndex === day.index ? 'bg-white/20 text-white' : 'bg-[#E5DFD4] text-[#1F2926]'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Day Slots List */}
                {(() => {
                  const daySlots = timetable
                    .filter(t => matchDaySlot(t, selectedDayIndex))
                    .sort((a, b) => (a.start_time || a.startTime || '').localeCompare(b.start_time || b.startTime || ''));

                  if (daySlots.length === 0) {
                    return (
                      <div className="py-14 text-center text-xs text-[#6C6356] bg-[#FAF8F5] rounded-2xl border border-[#E5DFD4] space-y-2">
                        <Calendar className="w-8 h-8 text-[#D5CDC0] mx-auto" />
                        <div className="font-bold text-[#1F2926]">
                          لا توجد حصص دراسية مبرمجة ليوم {WEEKDAYS.find(d => d.index === selectedDayIndex)?.name || ''}
                        </div>
                        <p className="text-[11px] text-[#6C6356] max-w-sm mx-auto">
                          عندما يقوم أساتذة قسمك بإضافة حصص لهذا اليوم في استعمال زمانهم، ستظهر هنا فوراً.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {daySlots.map((slot, idx) => (
                        <div
                          key={slot.id || idx}
                          className={`p-4 rounded-2xl border-2 flex items-start justify-between gap-3 transition-all shadow-2xs ${
                            slot.isTeacherOnLeave
                              ? 'bg-[#FFFDF8] border-amber-400'
                              : 'bg-[#FAF8F5] border-[#E5DFD4] hover:border-[#C98A3C]'
                          }`}
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-lg bg-[#1A4E47] text-white font-bold text-[10px]">
                                {(slot.period_type || slot.periodType) === 'morning' ? 'فترة صباحية' : 'فترة مسائية'}
                              </span>
                              <span className="font-bold text-sm text-[#1F2926]">
                                {slot.subject || 'مادة دراسية'}
                              </span>
                              {slot.isTeacherOnLeave && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                                  <span>رخصة غياب للأستاذ</span>
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-[#4A4235] flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1 font-semibold">
                                <User className="w-3.5 h-3.5 text-[#C98A3C]" />
                                <span>الأستاذ: {slot.teacherName || '—'}</span>
                              </span>
                              {slot.room && (
                                <>
                                  <span className="text-[#D5CDC0]">•</span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-[#C98A3C]" />
                                    <span>القاعة: {slot.room}</span>
                                  </span>
                                </>
                              )}
                            </div>

                            {slot.isTeacherOnLeave && (
                              <div className="mt-1 p-2 rounded-xl bg-amber-100/70 border border-amber-300 text-amber-950 text-xs space-y-1">
                                <div className="font-bold text-[11px] text-amber-900 flex items-center gap-1">
                                  <span>⚠️ رخصة غياب قانونية</span>
                                  {slot.leaveNotice?.startDate && (
                                    <span className="font-normal font-mono">
                                      ({slot.leaveNotice.startDate} إلى {slot.leaveNotice.endDate})
                                    </span>
                                  )}
                                </div>
                                {slot.leaveNotice?.instructions && (
                                  <div className="text-[11px] text-amber-950 font-medium">
                                    <strong>توجيهات الأستاذ للقسم:</strong> {slot.leaveNotice.instructions}
                                  </div>
                                )}
                              </div>
                            )}

                            {slot.notes && (
                              <div className="text-[11px] text-[#6C6356] pt-1">
                                ملاحظة: {slot.notes}
                              </div>
                            )}
                          </div>

                          <div className="font-mono text-xs font-bold text-[#1A4E47] bg-white px-3 py-1.5 rounded-xl border border-[#D5CDC0] shrink-0 text-center shadow-2xs">
                            {slot.start_time || slot.startTime} - {slot.end_time || slot.endTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
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
