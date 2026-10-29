import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Printer,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  MapPin,
  RefreshCw,
  Sun,
  Moon,
  Coffee,
  Info,
  FileText
} from 'lucide-react';
import { SectionItem, User as UserType, AppSettings, TimetableDay, TeacherTimetableEntry } from '../types';
import { buildOfficialMoroccanHeaderHtml, printReportHtml, escapeHtml } from '../utils/printNotes';

export interface TimetableSlotConfig {
  id: string;
  period: 'morning' | 'evening';
  index: number;
  label: string; // '08:00 - 09:00'
  shortLabel: string; // 'ح1'
  startTime: string; // '08:00'
  endTime: string; // '09:00'
  startMinutes: number; // 480
  endMinutes: number; // 540
}

export const MORNING_SLOTS: TimetableSlotConfig[] = [
  { id: 'm1', period: 'morning', index: 1, label: '08:00 - 09:00', shortLabel: '08:00 - 09:00', startTime: '08:00', endTime: '09:00', startMinutes: 8 * 60, endMinutes: 9 * 60 },
  { id: 'm2', period: 'morning', index: 2, label: '09:00 - 10:00', shortLabel: '09:00 - 10:00', startTime: '09:00', endTime: '10:00', startMinutes: 9 * 60, endMinutes: 10 * 60 },
  { id: 'm3', period: 'morning', index: 3, label: '10:00 - 11:00', shortLabel: '10:00 - 11:00', startTime: '10:00', endTime: '11:00', startMinutes: 10 * 60, endMinutes: 11 * 60 },
  { id: 'm4', period: 'morning', index: 4, label: '11:00 - 12:00', shortLabel: '11:00 - 12:00', startTime: '11:00', endTime: '12:00', startMinutes: 11 * 60, endMinutes: 12 * 60 }
];

export const EVENING_SLOTS: TimetableSlotConfig[] = [
  { id: 'e1', period: 'evening', index: 1, label: '14:00 - 15:00', shortLabel: '14:00 - 15:00', startTime: '14:00', endTime: '15:00', startMinutes: 14 * 60, endMinutes: 15 * 60 },
  { id: 'e2', period: 'evening', index: 2, label: '15:00 - 16:00', shortLabel: '15:00 - 16:00', startTime: '15:00', endTime: '16:00', startMinutes: 15 * 60, endMinutes: 16 * 60 },
  { id: 'e3', period: 'evening', index: 3, label: '16:00 - 17:00', shortLabel: '16:00 - 17:00', startTime: '16:00', endTime: '17:00', startMinutes: 16 * 60, endMinutes: 17 * 60 },
  { id: 'e4', period: 'evening', index: 4, label: '17:00 - 18:00', shortLabel: '17:00 - 18:00', startTime: '17:00', endTime: '18:00', startMinutes: 17 * 60, endMinutes: 18 * 60 }
];

export const ALL_SLOTS = [...MORNING_SLOTS, ...EVENING_SLOTS];

export const DAYS_OF_WEEK: { key: TimetableDay; label: string; jsDay: number }[] = [
  { key: 'monday', label: 'الإثنين', jsDay: 1 },
  { key: 'tuesday', label: 'الثلاثاء', jsDay: 2 },
  { key: 'wednesday', label: 'الأربعاء', jsDay: 3 },
  { key: 'thursday', label: 'الخميس', jsDay: 4 },
  { key: 'friday', label: 'الجمعة', jsDay: 5 },
  { key: 'saturday', label: 'السبت', jsDay: 6 }
];

interface TeacherTimetableProps {
  currentUser: UserType;
  sections: SectionItem[];
  settings: AppSettings;
  onSelectSection: (sectionId: string) => void;
  onOpenHomeworkModal?: () => void;
  onOpenLeaveModal?: () => void;
  onClose?: () => void;
}

export const TeacherTimetable: React.FC<TeacherTimetableProps> = ({
  currentUser,
  sections,
  settings,
  onSelectSection,
  onOpenHomeworkModal,
  onOpenLeaveModal,
  onClose
}) => {
  const [entries, setEntries] = useState<TeacherTimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // View modes: default to 'day' (tabbed daily cards) so the teacher sees today's timetable directly by default!
  const [viewMode, setViewMode] = useState<'day' | 'grid'>('day');

  // Teacher selection for Administration (Admin / Director)
  const [teachersList, setTeachersList] = useState<Array<{ id: string; fullName: string; subject?: string }>>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'director') {
      const saved = localStorage.getItem('echsa_timetable_selected_teacher');
      return saved || 'usr_mus3qsxfuxy3'; // Default to Teacher Samir El Korachi
    }
    return currentUser.id;
  });

  const effectiveTeacherId = (currentUser.role === 'admin' || currentUser.role === 'director')
    ? (selectedTeacherId || 'usr_mus3qsxfuxy3')
    : currentUser.id;

  const activeTeacherObj = useMemo(() => {
    return teachersList.find((t) => t.id === effectiveTeacherId);
  }, [teachersList, effectiveTeacherId]);

  const activeTeacherName = activeTeacherObj?.fullName || (currentUser.role === 'admin' ? 'سمير القراشي' : currentUser.fullName) || 'أستاذ المادة';
  const activeTeacherSubject = activeTeacherObj?.subject || currentUser.subject || 'الرياضيات';

  // Fetch teachers list if administrator or director
  useEffect(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'director') {
      fetch('/api/auth/teachers')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.teachers)) {
            setTeachersList(d.teachers);
          }
        })
        .catch(() => {});
    }
  }, [currentUser.role]);

  // Currently selected day for day view (enforcing GMT / UTC, defaulting to Monday if weekend)
  const [selectedDay, setSelectedDay] = useState<TimetableDay>(() => {
    const todayNum = new Date().getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat (GMT)
    if (todayNum === 0) return 'monday';
    const found = DAYS_OF_WEEK.find((d) => d.jsDay === todayNum);
    return found ? found.key : 'monday';
  });

  // Slot editor modal state
  const [editingSlot, setEditingSlot] = useState<{
    dayOfWeek: TimetableDay;
    slot: TimetableSlotConfig;
    existingEntry?: TeacherTimetableEntry;
  } | null>(null);

  const [formSectionId, setFormSectionId] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formSubject, setFormSubject] = useState(currentUser.subject || '');
  const [formNotes, setFormNotes] = useState('');

  // Clock state for highlighting the current slot (in GMT)
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Determine current active slot based on GMT real time
  const currentSlotInfo = useMemo(() => {
    const jsDay = currentTime.getUTCDay(); // GMT day
    const currentDayConfig = DAYS_OF_WEEK.find((d) => d.jsDay === jsDay);
    if (!currentDayConfig) return null;

    // Use getUTCHours and getUTCMinutes to strictly adhere to GMT
    const currentMinutes = currentTime.getUTCHours() * 60 + currentTime.getUTCMinutes();
    const activeSlot = ALL_SLOTS.find(
      (s) => currentMinutes >= s.startMinutes && currentMinutes < s.endMinutes
    );

    if (!activeSlot) return null;

    const activeEntry = entries.find(
      (e) => e.dayOfWeek === currentDayConfig.key && e.slotId === activeSlot.id
    );

    return {
      day: currentDayConfig.key,
      dayLabel: currentDayConfig.label,
      slot: activeSlot,
      entry: activeEntry,
      section: activeEntry ? sections.find((s) => s.id === activeEntry.sectionId) : null
    };
  }, [currentTime, entries, sections]);

  // Check if current real-time is within midday break (12:00 - 14:00) on school days in GMT
  const isBreakTime = useMemo(() => {
    const jsDay = currentTime.getUTCDay();
    if (jsDay === 0) return false; // Sunday
    const currentMinutes = currentTime.getUTCHours() * 60 + currentTime.getUTCMinutes();
    return currentMinutes >= 12 * 60 && currentMinutes < 14 * 60;
  }, [currentTime]);

  // Fetch timetable entries
  const fetchTimetable = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/teacher/timetable?teacherId=${effectiveTeacherId}`, {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
      } else {
        setErrorMsg(data.error || 'تعذر تحميل استعمال الزمان');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [effectiveTeacherId, currentUser.id]);

  // Open slot editor
  const handleOpenEdit = (dayOfWeek: TimetableDay, slot: TimetableSlotConfig) => {
    const existing = entries.find((e) => e.dayOfWeek === dayOfWeek && e.slotId === slot.id);
    setEditingSlot({ dayOfWeek, slot, existingEntry: existing });
    if (existing) {
      setFormSectionId(existing.sectionId);
      setFormRoom(existing.room || '');
      setFormSubject(existing.subject || activeTeacherSubject || '');
      setFormNotes(existing.notes || '');
    } else {
      // Default to first assigned section if available
      const teacherSections = sections.filter(
        (s) => s.assignedTeacherId === effectiveTeacherId || s.assignedTeachers?.some((t) => t.teacherId === effectiveTeacherId)
      );
      setFormSectionId(teacherSections[0]?.id || sections[0]?.id || '');
      setFormRoom('');
      setFormSubject(activeTeacherSubject || '');
      setFormNotes('');
    }
  };

  // Save slot
  const handleSaveSlot = async () => {
    if (!editingSlot || !formSectionId) {
      setErrorMsg('يرجى اختيار القسم المسند أو تحديد الحصة كحصة فارغة');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const isEmpty = formSectionId === 'empty';

      const payload = {
        teacherId: effectiveTeacherId,
        dayOfWeek: editingSlot.dayOfWeek,
        slotId: editingSlot.slot.id,
        periodType: isEmpty ? 'empty' : editingSlot.slot.period,
        startTime: editingSlot.slot.startTime,
        endTime: editingSlot.slot.endTime,
        sectionId: formSectionId,
        room: formRoom.trim(),
        subject: isEmpty ? (formSubject.trim() || 'ساعة فراغ') : (formSubject.trim() || activeTeacherSubject || ''),
        notes: formNotes.trim()
      };

      const res = await fetch('/api/teacher/timetable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.entry) {
        const secObj = sections.find((s) => s.id === formSectionId);
        const resolvedEntry: TeacherTimetableEntry = {
          ...data.entry,
          periodType: data.entry.periodType || data.entry.period || editingSlot.slot.period,
          sectionName: data.entry.sectionName || (secObj ? `${secObj.level}/${secObj.classNumber}` : (formSectionId !== 'empty' ? formSectionId : ''))
        };
        setEntries((prev) => {
          const filtered = prev.filter(
            (e) => !(e.dayOfWeek === editingSlot.dayOfWeek && e.slotId === editingSlot.slot.id)
          );
          return [...filtered, resolvedEntry];
        });
        setSelectedDay(editingSlot.dayOfWeek);
        setEditingSlot(null);
        setSuccessMsg('تم حفظ وتثبيت الحصة بنجاح في استعمال الزمان');
        setTimeout(() => setSuccessMsg(null), 3500);
        fetchTimetable();
      } else {
        setErrorMsg(data.error || 'تعذر حفظ الحصة');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete slot
  const handleDeleteSlot = async (dayOfWeek: TimetableDay, slotId: string) => {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/teacher/timetable/slot/${dayOfWeek}/${slotId}?teacherId=${effectiveTeacherId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success) {
        setEntries((prev) => prev.filter((e) => !(e.dayOfWeek === dayOfWeek && e.slotId === slotId)));
        setEditingSlot(null);
        setSuccessMsg('تم تفريغ الحصة بنجاح');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(data.error || 'تعذر حذف الحصة');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ أثناء الحذف');
    } finally {
      setIsSaving(false);
    }
  };

  // Print Timetable
  const handlePrintTimetable = () => {
    const teacherName = activeTeacherName || currentUser.fullName || 'أستاذ المادة';
    const institution = settings.institution || 'الثانوية الإعدادية ايكسان';
    const academicYear = currentUser.academicYear || settings.year || '2026/2027';
    const subject = activeTeacherSubject || currentUser.subject || '';

    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    const printDate = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
    const printTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

    const renderSlotCell = (dayKey: TimetableDay, slotId: string) => {
      const entry = entries.find((e) => e.dayOfWeek === dayKey && e.slotId === slotId);
      if (!entry) return '<div class="empty-slot">—</div>';
      if (entry.sectionId === 'empty' || entry.periodType === 'empty') {
        return `
          <div class="empty-period-slot" style="background:#fef3c7; border:1px dashed #d97706; border-radius:4px; padding:3px; color:#92400e;">
            <div style="font-weight:bold; font-size:11px;">⏱️ ساعة فراغ</div>
            ${entry.room ? `<div class="room-tag" style="font-size:9.5px; color:#78350f;">قاعة: ${escapeHtml(entry.room)}</div>` : ''}
            ${entry.notes ? `<div class="subj-tag" style="font-size:9.5px; color:#78350f;">${escapeHtml(entry.notes)}</div>` : ''}
          </div>
        `;
      }
      const sec = sections.find((s) => s.id === entry.sectionId);
      const secName = sec ? `${sec.level}/${sec.classNumber}` : entry.sectionName || 'قسم';
      return `
        <div class="filled-slot">
          <div class="sec-name">${escapeHtml(secName)}</div>
          ${entry.room ? `<div class="room-tag">قاعة: ${escapeHtml(entry.room)}</div>` : ''}
          ${entry.subject ? `<div class="subj-tag">${escapeHtml(entry.subject)}</div>` : ''}
        </div>
      `;
    };

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>استعمال الزمان - ${escapeHtml(teacherName)}</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { font-family: 'Tajawal', 'Traditional Arabic', serif, Arial; direction: rtl; padding: 10px; color: #1f2926; background: #fff; }
          .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #854d0e; padding-bottom: 12px; margin-bottom: 14px; }
          .header-table td { vertical-align: middle; border: none; }
          .official-head { font-size: 12px; line-height: 1.6; color: #333; }
          .official-head b { font-size: 13px; color: #854d0e; }
          .doc-title-box { text-align: center; margin: 10px 0 14px 0; }
          .doc-title { display: inline-block; font-size: 20px; font-weight: bold; color: #1a4e47; background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 30px; padding: 5px 32px; margin: 0 0 4px 0; }
          .doc-sub { font-size: 12.5px; color: #555; }
          table.main-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11.5px; }
          table.main-table th, table.main-table td { border: 1px solid #94a3b8; text-align: center; padding: 6px 4px; }
          table.main-table th { background: #e8f2f0; color: #1a4e47; font-weight: bold; }
          .period-header { background: #d0e4e0; font-weight: bold; font-size: 12px; }
          .day-col { font-weight: bold; background: #faf8f5; width: 85px; font-size: 12px; }
          .filled-slot { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 4px; }
          .sec-name { font-weight: bold; font-size: 13px; color: #166534; }
          .room-tag { font-size: 10px; color: #475569; }
          .subj-tag { font-size: 10px; color: #64748b; }
          .empty-slot { color: #ccc; }
          .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 12px; page-break-inside: avoid; }
          .sign-box { text-align: center; width: 220px; padding-top: 35px; border-top: 1px dashed #64748b; font-weight: bold; }
        </style>
      </head>
      <body>
        ${buildOfficialMoroccanHeaderHtml({
          institution,
          academicYear,
          date: printDate,
          time: printTime,
          dateLabel: 'تاريخ الاستخراج'
        })}

        <div class="doc-title-box">
          <div class="doc-title">استعمال زمان الأستاذ(ة)</div>
          <div class="doc-sub">الأستاذ(ة): <b>${escapeHtml(teacherName)}</b> ${subject ? `• المادة: <b>${escapeHtml(subject)}</b>` : ''}</div>
        </div>

        <table class="main-table">
          <thead>
            <tr>
              <th rowspan="2" class="day-col">اليوم / الحصة</th>
              <th colspan="4" class="period-header">الفترة الصباحية (08:00 - 12:00)</th>
              <th rowspan="2" class="period-header" style="background:#fef3c7;color:#92400e;width:65px;border:1px solid #cbd5e1;">فترة راحة للجميع<br/>(12:00 - 14:00)</th>
              <th colspan="4" class="period-header">الفترة المسائية (14:00 - 18:00)</th>
            </tr>
            <tr>
              ${MORNING_SLOTS.map((s) => `<th>${s.label}</th>`).join('')}
              ${EVENING_SLOTS.map((s) => `<th>${s.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${DAYS_OF_WEEK.map((d) => `
              <tr>
                <td class="day-col">${d.label}</td>
                ${MORNING_SLOTS.map((s) => `<td>${renderSlotCell(d.key, s.id)}</td>`).join('')}
                <td style="background:#fffbeb;font-size:10px;font-weight:bold;color:#b45309;text-align:center;border:1px solid #cbd5e1;">استراحة</td>
                ${EVENING_SLOTS.map((s) => `<td>${renderSlotCell(d.key, s.id)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div class="sign-box">توقيع وتأشيرة الأستاذ(ة)</div>
          <div class="sign-box">تأشيرة رئيس المؤسسة (المدير)</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    const printed = printReportHtml(html);
    if (!printed) {
      window.print();
    }
  };

  // Sections assigned to this teacher
  const teacherAssignedSections = useMemo(() => {
    return sections.filter(
      (s) =>
        s.assignedTeacherId === currentUser.id ||
        s.assignedTeachers?.some((t) => t.teacherId === currentUser.id)
    );
  }, [sections, currentUser.id]);

  const displayedSectionsForPick = teacherAssignedSections.length > 0 ? teacherAssignedSections : sections;

  return (
    <div className="bg-[#FAF8F5] min-h-[500px] rounded-2xl border border-[#E5DFD4] p-4 sm:p-6 mb-6 shadow-xs" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5DFD4]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#1A4E47] text-white flex items-center justify-center shadow-sm">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-[#1F2926] font-['Amiri',serif]">
                استعمال زمان الأستاذ(ة)
              </h2>
              <span className="px-3 py-1 rounded-full bg-[#E8F2F0] text-[#1A4E47] text-xs font-bold border border-[#1A4E47]/20">
                {activeTeacherName}
              </span>
              {activeTeacherSubject && (
                <span className="px-2.5 py-1 rounded-full bg-white text-[#6C6356] text-xs font-semibold border border-[#D5CDC0]">
                  {activeTeacherSubject}
                </span>
              )}
              {entries.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                  {entries.length} حصة مبرمجة
                </span>
              )}
            </div>
            <p className="text-xs text-[#6C6356] mt-1">
              جدول الحصص الأسبوعي • الفترة الصباحية (8:00 - 12:00) والمسائية (14:00 - 18:00). اضغط على أي قسم للانتقال فوراً لتسجيل الغيابات والمخالفات.
            </p>
          </div>
        </div>

        {/* View toggles & actions */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
          {/* View switcher */}
          <div className="flex items-center bg-white rounded-xl border border-[#D5CDC0] p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'day'
                  ? 'bg-[#1A4E47] text-white shadow-xs'
                  : 'text-[#6C6356] hover:bg-[#FAF8F5]'
              }`}
            >
              عرض الأيام (بطاقات)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#1A4E47] text-white shadow-xs'
                  : 'text-[#6C6356] hover:bg-[#FAF8F5]'
              }`}
            >
              الجدول الكامل (أسبوعي)
            </button>
          </div>

          {onOpenHomeworkModal && (
            <button
              type="button"
              onClick={onOpenHomeworkModal}
              className="px-3 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#1A4E47] font-bold text-xs border border-[#B9D8D2] flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="نشر واجبات منزلية وروابط فيديوهات وملخصات للتلاميذ"
            >
              <BookOpen className="w-4 h-4 text-[#1A4E47]" />
              <span className="hidden sm:inline">الواجبات والدروس</span>
            </button>
          )}

          {onOpenLeaveModal && (
            <button
              type="button"
              onClick={onOpenLeaveModal}
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs border border-amber-300 flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="التصريح برخصة أو غياب في حصة مع إشعار التلاميذ بالتوجيهات"
            >
              <FileText className="w-4 h-4 text-amber-700" />
              <span className="hidden sm:inline">إشعار برخصة غياب</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintTimetable}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#1F2926] font-semibold text-xs border border-[#D5CDC0] flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="طباعة استعمال الزمان الرسمي"
          >
            <Printer className="w-4 h-4 text-[#1A4E47]" />
            <span>طباعة</span>
          </button>

          <button
            type="button"
            onClick={fetchTimetable}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#6C6356] border border-[#D5CDC0] shadow-xs cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1A4E47]' : ''}`} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 cursor-pointer"
            >
              إغلاق
            </button>
          )}
        </div>
      </div>

      {/* Administration Teacher Selector Bar */}
      {(currentUser.role === 'admin' || currentUser.role === 'director') && (
        <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-[#E8F2F0] border-2 border-[#1A4E47]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#1A4E47] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Calendar className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#1A4E47] flex items-center gap-2">
                <span>تدبير استعمال زمان الأساتذة (خاص بالإدارة)</span>
                <span className="px-2 py-0.2 rounded-full bg-[#1A4E47] text-white text-[10px] font-bold">
                  {currentUser.role === 'admin' ? 'مشرف التطبيق' : 'مدير المؤسسة'}
                </span>
              </div>
              <div className="text-[11px] text-[#5C746F] mt-0.5">
                اختر أي أستاذ لعرض أو تعديل جدول حصصه الأسبوعي، أو للتأكد من مواعيد أقسامه
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#1A4E47]">عرض جدول:</span>
            <select
              value={effectiveTeacherId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTeacherId(val);
                localStorage.setItem('echsa_timetable_selected_teacher', val);
              }}
              className="bg-white border-2 border-[#1A4E47] text-xs font-bold text-[#1F2926] px-3.5 py-2 rounded-xl shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1A4E47]"
            >
              {teachersList.length > 0 ? (
                teachersList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.subject || 'عام'})
                  </option>
                ))
              ) : (
                <option value="usr_mus3qsxfuxy3">الأستاذ: سمير القراشي (الرياضيات)</option>
              )}
            </select>
          </div>
        </div>
      )}

      {/* Messages */}
      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Current Real-Time Slot Highlight Card */}
      {currentSlotInfo && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-600"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-emerald-950 text-sm">
                  الحصة الحالية الآن:
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white font-bold text-xs">
                  {currentSlotInfo.dayLabel} • {currentSlotInfo.slot.label}
                </span>
                <span className="text-xs text-emerald-800 font-medium">
                  ({currentSlotInfo.slot.period === 'morning' ? 'الفترة الصباحية' : 'الفترة المسائية'})
                </span>
              </div>
              <div className="text-xs text-emerald-900 mt-0.5">
                {currentSlotInfo.entry && currentSlotInfo.section ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>
                      القسم المجدول الآن: <strong className="text-emerald-950 font-bold text-sm underline">{currentSlotInfo.section.level}/{currentSlotInfo.section.classNumber}</strong>
                      {currentSlotInfo.entry.room ? ` (القاعة: ${currentSlotInfo.entry.room})` : ''}
                    </span>
                    {(() => {
                      const curAbs = currentSlotInfo.section.seats.filter((s) => s.attendance === 'absent').length;
                      if (curAbs > 0) {
                        return (
                          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold text-xs shadow-2xs">
                            ✕ {curAbs} غياب بحصتك الآن
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <span className="text-emerald-800 italic">
                    لم يتم تعيين قسم لهذه الحصة بعد في استعمال الزمان.
                  </span>
                )}
              </div>
            </div>
          </div>

          {currentSlotInfo.entry && currentSlotInfo.section ? (
            <button
              type="button"
              onClick={() => onSelectSection(currentSlotInfo.entry!.sectionId)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all hover:scale-102"
            >
              <ExternalLink className="w-4 h-4" />
              <span>الذهاب فوراً لتسجيل الغيابات والمخالفات</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenEdit(currentSlotInfo.day, currentSlotInfo.slot)}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تحديد قسم هذه الحصة الآن</span>
            </button>
          )}
        </div>
      )}

      {/* Real-time Midday Break Banner (Active 12:00 - 14:00 on school days) */}
      {!currentSlotInfo && isBreakTime && (
        <div className="mt-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-xs flex items-center justify-between gap-3 animate-fade-in" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-950 text-sm">
                  فترة استراحة الزوال الحالية (12:00 - 14:00):
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-xs">
                  فترة راحة للجميع ☕
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                فترة راحة وتناول وجبة الغداء لكافة أطر المؤسسة والتلاميذ. تستأنف الحصص المسائية على الساعة 14:00.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Day Selector (Tabs for responsive day view) */}
      <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
        {DAYS_OF_WEEK.map((day) => {
          const dayEntries = entries.filter((e) => e.dayOfWeek === day.key);
          const isToday = currentSlotInfo?.day === day.key;
          const isSelected = selectedDay === day.key;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelectedDay(day.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#1A4E47] text-white shadow-sm'
                  : isToday
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                  : 'bg-white text-[#6C6356] border border-[#D5CDC0] hover:bg-[#FAF8F5]'
              }`}
            >
              <span>{day.label}</span>
              {isToday && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-300"></span>
              )}
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#FAF8F5] text-[#7A6B58]'
                }`}
              >
                {dayEntries.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {viewMode === 'day' ? (
        /* DAY VIEW: Clear, mobile-friendly cards separated into Morning (8-12), Midday Break (12-14), and Evening (14-18) */
        <div className="mt-5 space-y-5">
          {/* 1. Morning Period: 08:00 - 12:00 (4 sessions) */}
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5DFD4] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1F2926]">
                    الفترة الصباحية (من 08:00 إلى 12:00)
                  </h3>
                  <p className="text-[11px] text-[#7A6B58]">
                    4 حصص صباحية فقط • 08:00 إلى 12:00
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                صباحاً (4 حصص)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {MORNING_SLOTS.map((slot) => {
                const entry = entries.find(
                  (e) => e.dayOfWeek === selectedDay && e.slotId === slot.id
                );
                const isCurrentSlot =
                  currentSlotInfo?.day === selectedDay && currentSlotInfo?.slot.id === slot.id;
                const section = entry ? sections.find((s) => s.id === entry.sectionId) : null;

                return (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    dayOfWeek={selectedDay}
                    entry={entry}
                    section={section}
                    isCurrentSlot={isCurrentSlot}
                    onOpenEdit={() => handleOpenEdit(selectedDay, slot)}
                    onSelectSection={(secId) => onSelectSection(secId)}
                    onDelete={() => handleDeleteSlot(selectedDay, slot.id)}
                  />
                );
              })}
            </div>
          </div>

          {/* 2. Midday Break: 12:00 - 14:00 (فترة راحة للجميع) */}
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300/80 text-amber-800 flex items-center justify-center shrink-0 shadow-xs">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-amber-950">فترة راحة للجميع (استراحة الزوال)</h4>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300">
                    من 12:00 إلى 14:00
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  فترة راحة وتناول وجبة الغداء لكافة الأطر الإدارية والتربوية والتلاميذ (ساعتان كاملتان). لا توجد حصص في هذه الفترة.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-900 bg-white/95 px-3 py-1.5 rounded-xl border border-amber-200 shrink-0 shadow-xs">
              ☕ استراحة الجميع (12h - 14h)
            </span>
          </div>

          {/* 3. Evening Period: 14:00 - 18:00 (4 sessions) */}
          <div className="bg-white rounded-2xl border border-[#E5DFD4] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5DFD4] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1F2926]">
                    الفترة المسائية (من 14:00 إلى 18:00)
                  </h3>
                  <p className="text-[11px] text-[#7A6B58]">
                    4 حصص مسائية • 14:00 إلى 18:00
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                مساءً (4 حصص)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {EVENING_SLOTS.map((slot) => {
                const entry = entries.find(
                  (e) => e.dayOfWeek === selectedDay && e.slotId === slot.id
                );
                const isCurrentSlot =
                  currentSlotInfo?.day === selectedDay && currentSlotInfo?.slot.id === slot.id;
                const section = entry ? sections.find((s) => s.id === entry.sectionId) : null;

                return (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    dayOfWeek={selectedDay}
                    entry={entry}
                    section={section}
                    isCurrentSlot={isCurrentSlot}
                    onOpenEdit={() => handleOpenEdit(selectedDay, slot)}
                    onSelectSection={(secId) => onSelectSection(secId)}
                    onDelete={() => handleDeleteSlot(selectedDay, slot.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* GRID VIEW: Full weekly timetable table with horizontal scrolling */
        <div className="mt-5 bg-white rounded-2xl border border-[#E5DFD4] p-4 shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[950px] border-collapse text-right text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E5DFD4]">
                  <th className="p-2.5 font-bold text-[#1F2926] border-l border-[#E5DFD4] text-center w-24">
                    اليوم / الحصة
                  </th>
                  <th colSpan={4} className="p-2.5 font-bold text-[#1A4E47] bg-[#E8F2F0] text-center border-l border-[#E5DFD4]">
                    ☀️ الفترة الصباحية (08:00 - 12:00)
                  </th>
                  <th className="p-2.5 font-bold text-amber-900 bg-amber-50 text-center border-l border-[#E5DFD4] w-28">
                    ☕ استراحة للجميع (12:00 - 14:00)
                  </th>
                  <th colSpan={4} className="p-2.5 font-bold text-indigo-900 bg-indigo-50 text-center">
                    🌙 الفترة المسائية (14:00 - 18:00)
                  </th>
                </tr>
                <tr className="bg-[#FAF8F5] border-b border-[#E5DFD4] text-[11px] text-[#7A6B58]">
                  <th className="p-2 border-l border-[#E5DFD4] text-center font-medium">—</th>
                  {MORNING_SLOTS.map((s) => (
                    <th key={s.id} className="p-2 border-l border-[#E5DFD4] text-center font-medium">
                      {s.label}
                    </th>
                  ))}
                  <th className="p-2 border-l border-[#E5DFD4] text-center font-bold text-amber-800 bg-amber-100/50">
                    راحة (ساعتان)
                  </th>
                  {EVENING_SLOTS.map((s) => (
                    <th key={s.id} className="p-2 border-l border-[#E5DFD4] text-center font-medium last:border-l-0">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD4]">
                {DAYS_OF_WEEK.map((day) => {
                  const isCurrentDay = currentSlotInfo?.day === day.key;

                  return (
                    <tr key={day.key} className={isCurrentDay ? 'bg-emerald-50/40' : 'hover:bg-[#FAF8F5]'}>
                      <td className="p-2.5 font-bold text-[#1F2926] border-l border-[#E5DFD4] text-center bg-[#FAF8F5]/80">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{day.label}</span>
                          {isCurrentDay && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          )}
                        </div>
                      </td>

                      {/* Morning slots (4 sessions: 08:00 - 12:00) */}
                      {MORNING_SLOTS.map((slot) => {
                        const entry = entries.find(
                          (e) => e.dayOfWeek === day.key && e.slotId === slot.id
                        );
                        const isCurrent =
                          currentSlotInfo?.day === day.key && currentSlotInfo?.slot.id === slot.id;
                        const sec = entry ? sections.find((s) => s.id === entry.sectionId) : null;

                        return (
                          <td
                            key={slot.id}
                            className={`p-1.5 border-l border-[#E5DFD4] align-top text-center transition-all ${
                              isCurrent
                                ? 'bg-emerald-100/70 ring-2 ring-emerald-500'
                                : ''
                            }`}
                          >
                            <GridCellSlot
                              slot={slot}
                              dayOfWeek={day.key}
                              entry={entry}
                              section={sec}
                              isCurrentSlot={isCurrent}
                              onOpenEdit={() => handleOpenEdit(day.key, slot)}
                              onSelectSection={(secId) => onSelectSection(secId)}
                            />
                          </td>
                        );
                      })}

                      {/* Midday Rest Break Column (12:00 - 14:00) */}
                      <td className="p-2 border-l border-[#E5DFD4] text-center bg-amber-50/50 text-[11px] text-amber-800 font-bold align-middle">
                        استراحة الزوال
                      </td>

                      {/* Evening slots (4 sessions: 14:00 - 18:00) */}
                      {EVENING_SLOTS.map((slot) => {
                        const entry = entries.find(
                          (e) => e.dayOfWeek === day.key && e.slotId === slot.id
                        );
                        const isCurrent =
                          currentSlotInfo?.day === day.key && currentSlotInfo?.slot.id === slot.id;
                        const sec = entry ? sections.find((s) => s.id === entry.sectionId) : null;

                        return (
                          <td
                            key={slot.id}
                            className={`p-1.5 border-l border-[#E5DFD4] last:border-l-0 align-top text-center transition-all ${
                              isCurrent
                                ? 'bg-emerald-100/70 ring-2 ring-emerald-500'
                                : ''
                            }`}
                          >
                            <GridCellSlot
                              slot={slot}
                              dayOfWeek={day.key}
                              entry={entry}
                              section={sec}
                              isCurrentSlot={isCurrent}
                              onOpenEdit={() => handleOpenEdit(day.key, slot)}
                              onSelectSection={(secId) => onSelectSection(secId)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 border border-[#E5DFD4] animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#1A4E47] text-white flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1F2926]">
                    {editingSlot.existingEntry ? 'تعديل الحصة' : 'إسناد قسم للحصة'}
                  </h3>
                  <div className="text-xs text-[#7A6B58]">
                    {DAYS_OF_WEEK.find((d) => d.key === editingSlot.dayOfWeek)?.label} • {editingSlot.slot.label} ({editingSlot.slot.period === 'morning' ? 'الفترة الصباحية' : 'الفترة المسائية'})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="w-8 h-8 rounded-full bg-[#FAF8F5] text-[#6C6356] hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Section selector */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1.5">
                  القسم المسند لهذه الحصة: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formSectionId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormSectionId(val);
                    if (val === 'empty') {
                      if (!formSubject) setFormSubject('ساعة فراغ');
                      if (!formRoom) setFormRoom('قاعة الأساتذة');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#D5CDC0] text-[#1F2926] text-xs font-bold focus:outline-hidden focus:border-[#1A4E47]"
                >
                  <option value="">-- اختر القسم أو نوع الحصة --</option>
                  <option value="empty" className="font-bold text-amber-900 bg-amber-50">
                    ⏱️ حصة فارغة (ساعة فراغ / استراحة / تحضير)
                  </option>
                  {displayedSectionsForPick.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.level} / {sec.classNumber}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#7A6B58] mt-1">
                  يمكنك إسناد قسم للحصة، أو تحديدها كـ "حصة فارغة / ساعة فراغ" مع إمكانية تعديلها لاحقاً في أي وقت.
                </p>
              </div>

              {/* Room (القاعة) */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1.5">
                  القاعة (اختياري):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    placeholder="مثال: قاعة 14 أو مختبر العلوم"
                    className="w-full px-3 py-2 pl-8 rounded-xl bg-[#FAF8F5] border border-[#D5CDC0] text-[#1F2926] text-xs focus:outline-hidden focus:border-[#1A4E47]"
                  />
                  <MapPin className="w-4 h-4 text-[#7A6B58] absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1.5">
                  المادة:
                </label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="مثال: الرياضيات"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#D5CDC0] text-[#1F2926] text-xs focus:outline-hidden focus:border-[#1A4E47]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1.5">
                  ملاحظات أو توصيف الحصة (اختياري):
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="ملاحظات حول الحصة (أنشطة، مراجعة، دعم...)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#D5CDC0] text-[#1F2926] text-xs focus:outline-hidden focus:border-[#1A4E47]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-[#E5DFD4] flex items-center justify-between gap-2">
              {editingSlot.existingEntry ? (
                <button
                  type="button"
                  onClick={() => handleDeleteSlot(editingSlot.dayOfWeek, editingSlot.slot.id)}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تفريغ الحصة</span>
                </button>
              ) : (
                <div></div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#6C6356] text-xs font-semibold border border-[#D5CDC0] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveSlot}
                  disabled={isSaving || !formSectionId}
                  className="px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>حفظ الحصة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: Tactile card for daily view
interface SlotCardProps {
  slot: TimetableSlotConfig;
  dayOfWeek: TimetableDay;
  entry?: TeacherTimetableEntry;
  section?: SectionItem | null;
  isCurrentSlot?: boolean;
  onOpenEdit: () => void;
  onSelectSection: (sectionId: string) => void;
  onDelete: () => void;
}

const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  entry,
  section,
  isCurrentSlot,
  onOpenEdit,
  onSelectSection,
  onDelete
}) => {
  const isEmptySlot = Boolean(entry && (entry.sectionId === 'empty' || entry.periodType === 'empty'));
  const isFilled = Boolean(entry && !isEmptySlot && (section || entry.sectionName || entry.sectionId));
  const sectionDisplayName = section ? `${section.level} / ${section.classNumber}` : (entry?.sectionName || 'قسم مسند');

  return (
    <div
      className={`rounded-xl border p-3 transition-all relative flex flex-col justify-between min-h-[115px] ${
        isCurrentSlot
          ? 'bg-emerald-50 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-300 ring-offset-1'
          : isEmptySlot
          ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
          : isFilled
          ? 'bg-[#F4F9F8] border-[#B9D8D2] hover:border-[#1A4E47]'
          : 'bg-[#FAF8F5]/60 border-dashed border-[#D5CDC0] hover:bg-white'
      }`}
    >
      {/* Header of card: Time label & Current Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F2926]">
          <Clock className="w-3.5 h-3.5 text-[#7A6B58]" />
          <span>{slot.label}</span>
        </div>

        {isCurrentSlot && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs animate-pulse">
            <span>🟢</span>
            <span>الآن</span>
          </span>
        )}
      </div>

      {/* Body of card */}
      {isEmptySlot ? (
        <div className="my-1">
          <button
            type="button"
            onClick={onOpenEdit}
            className="w-full text-right p-2.5 rounded-lg bg-amber-100/60 border border-amber-300/80 hover:bg-amber-100 hover:border-amber-400 transition-colors cursor-pointer group shadow-2xs"
            title="حصة فارغة محددة - انقر لتعديلها أو إسناد قسم لها"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>⏱️ حصة فارغة (ساعة فراغ)</span>
              </div>
              <span className="text-[10px] text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md font-bold group-hover:bg-amber-300">
                تعديل ✎
              </span>
            </div>
            {entry?.notes && (
              <p className="text-[11px] text-amber-800 mt-1 line-clamp-1">
                {entry.notes}
              </p>
            )}
            {entry?.room && (
              <div className="text-[10px] text-amber-700 mt-0.5 font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-600" />
                <span>{entry.room}</span>
              </div>
            )}
          </button>
        </div>
      ) : isFilled ? (
        <div className="my-1">
          {/* Main button to navigate to section for recording attendance & violations */}
          <button
            type="button"
            onClick={() => {
              if (section) {
                onSelectSection(section.id);
              } else if (entry?.sectionId && entry.sectionId !== 'empty') {
                onSelectSection(entry.sectionId);
              } else {
                onOpenEdit();
              }
            }}
            className="w-full text-right p-2 rounded-lg bg-white border border-[#B9D8D2] hover:bg-[#E8F2F0] hover:border-[#1A4E47] transition-colors cursor-pointer group shadow-2xs"
            title="انقر لفتح هذا القسم وتسجيل الغيابات والمخالفات مباشرة"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-[#1A4E47] group-hover:underline flex items-center gap-1">
                <span>{sectionDisplayName}</span>
                {section && <ExternalLink className="w-3 h-3 text-[#1A4E47] opacity-60 group-hover:opacity-100" />}
              </div>
              {(() => {
                const absentCount = section?.seats?.filter((s) => s.attendance === 'absent')?.length || 0;
                return absentCount > 0 ? (
                  <span className="text-[10px] text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full font-bold border border-rose-300 shadow-2xs">
                    ✕ {absentCount} غياب
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-bold">
                    تسجيل الغياب 📝
                  </span>
                );
              })()}
            </div>
            {(entry?.room || entry?.subject) && (
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[#7A6B58] flex-wrap">
                {entry.room && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3 text-[#7A6B58]" />
                    <span>ق: {entry.room}</span>
                  </span>
                )}
                {entry.subject && <span>• {entry.subject}</span>}
              </div>
            )}
          </button>
        </div>
      ) : (
        <div className="my-auto py-2 text-center">
          <button
            type="button"
            onClick={onOpenEdit}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1A4E47] hover:text-[#133D37] hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة قسم لهذه الحصة</span>
          </button>
        </div>
      )}

      {/* Footer / actions */}
      <div className="mt-2 pt-1.5 border-t border-[#E5DFD4]/60 flex items-center justify-between text-[10px]">
        <span className="text-[#7A6B58] font-mono">
          {slot.period === 'morning' ? 'صباحاً' : 'مساءً'}
        </span>

        <div className="flex items-center gap-1">
          {isFilled && (
            <button
              type="button"
              onClick={onOpenEdit}
              className="p-1 rounded-md text-[#6C6356] hover:bg-white hover:text-[#1A4E47] cursor-pointer"
              title="تعديل الحصة"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-component: Slot cell for full weekly grid table view
interface GridCellSlotProps {
  slot: TimetableSlotConfig;
  dayOfWeek: TimetableDay;
  entry?: TeacherTimetableEntry;
  section?: SectionItem | null;
  isCurrentSlot?: boolean;
  onOpenEdit: () => void;
  onSelectSection: (sectionId: string) => void;
}

const GridCellSlot: React.FC<GridCellSlotProps> = ({
  slot,
  entry,
  section,
  isCurrentSlot,
  onOpenEdit,
  onSelectSection
}) => {
  const isEmptySlot = Boolean(entry && (entry.sectionId === 'empty' || entry.periodType === 'empty'));
  const isFilled = Boolean(entry && !isEmptySlot && (section || entry.sectionName || entry.sectionId));
  const sectionDisplayName = section ? `${section.level}/${section.classNumber}` : (entry?.sectionName || 'قسم مسند');

  if (isEmptySlot) {
    return (
      <div className="w-full h-20 rounded-lg p-1.5 border border-amber-300 bg-amber-50/80 text-right relative flex flex-col justify-between">
        <button
          type="button"
          onClick={onOpenEdit}
          className="text-right cursor-pointer group"
          title="حصة فارغة محددة في استعمال الزمان - انقر للتعديل"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] text-amber-900 group-hover:underline">
              ⏱️ ساعة فراغ
            </span>
            <span className="text-[9px] text-amber-800 bg-amber-200/60 px-1 py-0.2 rounded font-bold">تعديل</span>
          </div>
          {entry?.room && (
            <div className="text-[9px] text-amber-700 mt-0.5 truncate">
              📍 {entry.room}
            </div>
          )}
          {entry?.notes && (
            <div className="text-[9px] text-amber-800 line-clamp-1 mt-0.5 font-medium">
              {entry.notes}
            </div>
          )}
        </button>

        <div className="flex items-center justify-between pt-1 border-t border-amber-200 text-[9px]">
          <span className="text-amber-800 font-semibold">حصة فارغة</span>
          <button
            type="button"
            onClick={onOpenEdit}
            className="text-amber-800 hover:text-amber-950 p-0.5 font-bold cursor-pointer"
            title="تعديل الحصة الفارغة"
          >
            <Edit2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    );
  }

  if (!isFilled) {
    return (
      <button
        type="button"
        onClick={onOpenEdit}
        className="w-full h-16 rounded-lg border border-dashed border-[#D5CDC0] bg-white/40 hover:bg-[#FAF8F5] hover:border-[#1A4E47] flex flex-col items-center justify-center text-[#7A6B58] hover:text-[#1A4E47] transition-colors cursor-pointer group p-1"
        title="انقر لتعيين قسم لهذه الحصة أو تحديدها كحصة فارغة"
      >
        <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100" />
        <span className="text-[10px] mt-0.5 opacity-60 group-hover:opacity-100">فارغ</span>
      </button>
    );
  }

  return (
    <div
      className={`rounded-lg p-1.5 border transition-all text-right relative flex flex-col justify-between h-20 ${
        isCurrentSlot
          ? 'bg-emerald-50 border-2 border-emerald-500 shadow-sm'
          : 'bg-[#F4F9F8] border-[#B9D8D2] hover:border-[#1A4E47]'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (section) {
            onSelectSection(section.id);
          } else if (entry?.sectionId && entry.sectionId !== 'empty') {
            onSelectSection(entry.sectionId);
          } else {
            onOpenEdit();
          }
        }}
        className="text-right cursor-pointer group"
        title="انقر لفتح القسم أو تعديل الحصة"
      >
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-[#1A4E47] group-hover:underline">
            {sectionDisplayName}
          </span>
          {section && <ExternalLink className="w-3 h-3 text-[#1A4E47] opacity-60 group-hover:opacity-100" />}
        </div>
        {entry?.room && (
          <div className="text-[10px] text-[#7A6B58] mt-0.5">
            قاعة: {entry.room}
          </div>
        )}
      </button>

      <div className="flex items-center justify-between pt-1 border-t border-[#B9D8D2]/40 text-[9px]">
        {isCurrentSlot ? (
          <span className="font-bold text-emerald-700">🟢 جارٍ الآن</span>
        ) : (
          <span className="text-[#7A6B58] truncate max-w-[50px]">{entry?.subject || 'حصة'}</span>
        )}
        <button
          type="button"
          onClick={onOpenEdit}
          className="text-[#6C6356] hover:text-[#1A4E47] p-0.5"
          title="تعديل الحصة"
        >
          <Edit2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};
