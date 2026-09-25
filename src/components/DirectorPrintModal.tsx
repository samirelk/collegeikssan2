import React, { useState, useMemo } from 'react';
import {
  Printer,
  X,
  AlertTriangle,
  UserX,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
  FileText
} from 'lucide-react';
import { SectionItem, AppSettings } from '../types';
import { printAllViolationsReport, printAbsencesReport } from '../utils/printNotes';

export interface DirectorPrintModalProps {
  mode: 'violations' | 'absences';
  sections: SectionItem[];
  settings: AppSettings;
  violationsData?: Array<{
    id?: string;
    sectionId?: string;
    sectionName?: string;
    level?: string;
    classNumber?: string;
    studentName: string;
    studentNumber?: string;
    massarNumber?: string;
    violationType: string;
    recordedDate?: string;
    date?: string;
    recordedTime?: string;
    time?: string;
    teacherName?: string;
    teacherSubject?: string;
    actionTaken?: string;
    notes?: string;
  }>;
  absencesData?: Array<{
    id?: string | number;
    sectionId?: string;
    sectionName?: string;
    level?: string;
    classNumber?: string;
    studentName: string;
    studentNumber?: string;
    massarNumber?: string;
    status?: string;
    date?: string;
    time?: string;
    session?: string;
    teacherName?: string;
    subject?: string;
    isJustified?: boolean;
    justificationReason?: string;
  }>;
  onClose: () => void;
}

export const DirectorPrintModal: React.FC<DirectorPrintModalProps> = ({
  mode,
  sections,
  settings,
  violationsData = [],
  absencesData = [],
  onClose
}) => {
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unjustified' | 'justified'>('all');

  const distinctLevels = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((s) => {
      if (s.level && s.level.trim()) set.add(s.level.trim());
    });
    if (set.size === 0) return ['الأولى إعدادي', 'الثانية إعدادي', 'الثالثة إعدادي'];
    return Array.from(set);
  }, [sections]);

  const availableSectionsForLevel = useMemo(() => {
    if (selectedLevel === 'all') return sections;
    return sections.filter((s) => s.level === selectedLevel || s.level.includes(selectedLevel) || selectedLevel.includes(s.level));
  }, [sections, selectedLevel]);

  const handleLevelChange = (lvl: string) => {
    setSelectedLevel(lvl);
    if (lvl !== 'all' && selectedSectionId !== 'all') {
      const currentSec = sections.find((s) => s.id === selectedSectionId);
      if (currentSec && !currentSec.level.includes(lvl) && !lvl.includes(currentSec.level)) {
        setSelectedSectionId('all');
      }
    }
  };

  const todayStr = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }, []);

  // Filter violations
  const filteredViolations = useMemo(() => {
    if (mode !== 'violations') return [];
    return violationsData.filter((v) => {
      // Level filter
      if (selectedLevel !== 'all') {
        const vLevel = v.level || '';
        const vSecName = v.sectionName || '';
        if (!vLevel.includes(selectedLevel) && !vSecName.includes(selectedLevel) && !selectedLevel.includes(vLevel)) {
          return false;
        }
      }

      // Section filter
      if (selectedSectionId !== 'all') {
        if (v.sectionId !== selectedSectionId) {
          const targetSec = sections.find((s) => s.id === selectedSectionId);
          const secName = targetSec ? `${targetSec.level} (${targetSec.classNumber})` : '';
          if (v.sectionName !== secName && !(v.level === targetSec?.level && v.classNumber === targetSec?.classNumber)) {
            return false;
          }
        }
      }

      // Time filter
      const vDate = v.recordedDate || v.date || '';
      if (timeFilter === 'today' && vDate && !vDate.includes(todayStr) && !todayStr.includes(vDate)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (v.studentName || '').toLowerCase().includes(q);
        const matchesMassar = (v.massarNumber || '').toLowerCase().includes(q);
        const matchesType = (v.violationType || '').toLowerCase().includes(q);
        if (!matchesName && !matchesMassar && !matchesType) return false;
      }

      return true;
    });
  }, [mode, violationsData, selectedSectionId, sections, timeFilter, todayStr, searchQuery]);

  // Filter absences
  const filteredAbsences = useMemo(() => {
    if (mode !== 'absences') return [];
    return absencesData.filter((a) => {
      // Level filter
      if (selectedLevel !== 'all') {
        const aLevel = a.level || '';
        const aSecName = a.sectionName || '';
        if (!aLevel.includes(selectedLevel) && !aSecName.includes(selectedLevel) && !selectedLevel.includes(aLevel)) {
          return false;
        }
      }

      // Section filter
      if (selectedSectionId !== 'all') {
        if (a.sectionId !== selectedSectionId) {
          const targetSec = sections.find((s) => s.id === selectedSectionId);
          const secName = targetSec ? `${targetSec.level} (${targetSec.classNumber})` : '';
          if (a.sectionName !== secName && !(a.level === targetSec?.level && a.classNumber === targetSec?.classNumber)) {
            return false;
          }
        }
      }

      // Justification filter
      if (statusFilter === 'unjustified' && a.isJustified) return false;
      if (statusFilter === 'justified' && !a.isJustified) return false;

      // Time filter
      const aDate = a.date || '';
      if (timeFilter === 'today' && aDate && !aDate.includes(todayStr) && !todayStr.includes(aDate)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (a.studentName || '').toLowerCase().includes(q);
        const matchesMassar = (a.massarNumber || '').toLowerCase().includes(q);
        if (!matchesName && !matchesMassar) return false;
      }

      return true;
    });
  }, [mode, absencesData, selectedSectionId, sections, statusFilter, timeFilter, todayStr, searchQuery]);

  const selectedSectionTitle = useMemo(() => {
    if (selectedSectionId === 'all') return 'جميع الأقسام بالمؤسسة';
    const s = sections.find((sec) => sec.id === selectedSectionId);
    return s ? `${s.level} (${s.classNumber})` : 'قسم محدد';
  }, [selectedSectionId, sections]);

  const dateFilterLabel = useMemo(() => {
    switch (timeFilter) {
      case 'today':
        return `اليوم (${todayStr})`;
      case 'week':
        return 'هذا الأسبوع';
      case 'month':
        return 'هذا الشهر';
      default:
        return 'كامل الموسم الدراسي';
    }
  }, [timeFilter, todayStr]);

  const handleExecutePrint = () => {
    if (mode === 'violations') {
      printAllViolationsReport({
        institution: settings.institution || 'الثانوية الإعدادية ايكسان',
        academicYear: settings.year || '2026/2027',
        sectionTitle: selectedSectionTitle,
        dateFilterText: dateFilterLabel,
        violations: filteredViolations
      });
    } else {
      printAbsencesReport({
        institution: settings.institution || 'الثانوية الإعدادية ايكسان',
        academicYear: settings.year || '2026/2027',
        sectionTitle: selectedSectionTitle,
        dateFilterText: dateFilterLabel,
        absences: filteredAbsences
      });
    }
  };

  const isViolations = mode === 'violations';
  const recordCount = isViolations ? filteredViolations.length : filteredAbsences.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#FAF8F5] text-[#1F2926] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-[#D5CDC0] animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 border-b border-[#E5DFD5] flex items-center justify-between gap-3 ${
          isViolations
            ? 'bg-gradient-to-r from-[#FEF2F2] to-[#FAF8F5]'
            : 'bg-gradient-to-r from-[#FEFCE8] to-[#FAF8F5]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
              isViolations
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}>
              {isViolations ? <AlertTriangle className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-[#1F2926] m-0 flex items-center gap-2">
                <span>{isViolations ? 'طباعة لائحة وسجل المخالفات الرسمية' : 'طباعة لائحة وسجل الغياب والمواظبة'}</span>
                <span className="text-xs font-sans px-2 py-0.5 rounded-full font-bold bg-[#1A4E47] text-white">
                  خاص بالإدارة
                </span>
              </h2>
              <div className="text-xs text-[#5E6D66] mt-1 flex items-center gap-2 flex-wrap">
                <span>المؤسسة: <strong className="text-[#1F2926]">{settings.institution || 'الثانوية الإعدادية ايكسان'}</strong></span>
                <span>•</span>
                <span>الموسم الدراسي: <strong className="font-mono text-[#1F2926]">{settings.year || '2026/2027'}</strong></span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#5E6D66] hover:text-[#1F2926] hover:bg-black/5 rounded-xl transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Panel */}
        <div className="p-4 sm:p-5 border-b border-[#E5DFD5] bg-[#F4EFDE]/50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Level Selector */}
            <div>
              <label className="block text-xs font-bold text-[#5E6D66] mb-1.5 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#1A4E47]" />
                <span>تحديد المستوى الدراسي:</span>
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => handleLevelChange(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-[#1A4E47]"
              >
                <option value="all">كافة المستويات الدراسية</option>
                {distinctLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* 1. Section Selector */}
            <div>
              <label className="block text-xs font-bold text-[#5E6D66] mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#1A4E47]" />
                <span>تحديد القسم:</span>
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-[#1A4E47]"
              >
                <option value="all">
                  {selectedLevel === 'all'
                    ? '🌟 جميع الأقسام بالمؤسسة (تقرير شامل)'
                    : `جميع أقسام ${selectedLevel}`}
                </option>
                {availableSectionsForLevel.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    قسم: {sec.level} ({sec.classNumber}) {sec.teacher ? `— ${sec.teacher}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Time Filter */}
            <div>
              <label className="block text-xs font-bold text-[#5E6D66] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#854d0e]" />
                <span>الفترة الزمنية:</span>
              </label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-[#1A4E47]"
              >
                <option value="all">كامل الموسم الدراسي الحالي</option>
                <option value="today">اليوم فقط ({todayStr})</option>
                <option value="week">هذا الأسبوع</option>
                <option value="month">هذا الشهر</option>
              </select>
            </div>

            {/* 3. Conditional Status Filter (for absences) or Search */}
            {!isViolations ? (
              <div>
                <label className="block text-xs font-bold text-[#5E6D66] mb-1.5 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#A8443A]" />
                  <span>حالة التبرير:</span>
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-[#1A4E47]"
                >
                  <option value="all">جميع الحالات (مبرر وغير مبرر)</option>
                  <option value="unjustified">غير مبرر فقط ⚠️</option>
                  <option value="justified">مبرر فقط ✓</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#5E6D66] mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[#5E6D66]" />
                  <span>بحث سريع بالاسم أو مسار:</span>
                </label>
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو رقم مسار..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D5CDC0] bg-white text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-[#1A4E47]"
                />
              </div>
            )}
          </div>

          {/* Target Info Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs bg-white/70 p-2.5 rounded-xl border border-[#E4DBC0]">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-[#5E6D66]">
                النطاق المحدد: <strong className="text-[#1A4E47]">{selectedSectionTitle}</strong>
              </span>
              <span>•</span>
              <span className="font-semibold text-[#5E6D66]">
                الفترة: <strong className="text-[#1F2926]">{dateFilterLabel}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-[#EFE9D5] text-[#2A2118] border border-[#D9CEB0]">
                عدد السجلات المطابقة: <strong className="text-base font-mono">{recordCount}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Records Preview Table */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
          {recordCount === 0 ? (
            <div className="py-16 text-center text-sm text-[#7A6B58] bg-[#F4EFDE]/40 rounded-xl border border-dashed border-[#D9CEB0]">
              <FileText className="w-10 h-10 mx-auto text-[#7A6B58]/40 mb-2" />
              <p className="font-bold text-[#2A2118]">لا توجد أي سجلات مطابقة لمعايير الفلترة المحددة</p>
              <p className="text-xs text-[#7A6B58] mt-1">جرب تغيير القسم أو الفترة الزمنية لعرض سجلات أخرى</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#D9CEB0]">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EFE9D5] text-[#2A2118] border-b border-[#D9CEB0]">
                    <th className="p-2.5 font-bold text-center w-10">#</th>
                    <th className="p-2.5 font-bold">اسم التلميذ(ة)</th>
                    <th className="p-2.5 font-bold text-center">رقم مسار</th>
                    <th className="p-2.5 font-bold text-center">القسم</th>
                    {isViolations ? (
                      <>
                        <th className="p-2.5 font-bold">نوع المخالفة</th>
                        <th className="p-2.5 font-bold text-center">التاريخ</th>
                        <th className="p-2.5 font-bold">الأستاذ / المادة</th>
                        <th className="p-2.5 font-bold text-center">الإجراء</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2.5 font-bold text-center">تاريخ وحصة الغياب</th>
                        <th className="p-2.5 font-bold text-center">الحالة</th>
                        <th className="p-2.5 font-bold text-center">التبرير</th>
                        <th className="p-2.5 font-bold">الأستاذ / المادة</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DBC0] bg-white">
                  {isViolations
                    ? filteredViolations.slice(0, 50).map((v, idx) => (
                        <tr key={v.id || idx} className="hover:bg-[#FBF8EF]">
                          <td className="p-2.5 text-center font-mono text-[#7A6B58]">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-[#2A2118]">{v.studentName}</td>
                          <td className="p-2.5 text-center font-mono text-blue-900 font-bold">{v.massarNumber || '—'}</td>
                          <td className="p-2.5 text-center text-emerald-800 font-semibold">
                            {v.sectionName || (v.level && v.classNumber ? `${v.level} (${v.classNumber})` : '—')}
                          </td>
                          <td className="p-2.5 font-bold text-red-700">{v.violationType}</td>
                          <td className="p-2.5 text-center font-mono text-xs text-[#5E6D66]">{v.recordedDate || v.date || '—'}</td>
                          <td className="p-2.5 text-[#5E6D66]">{v.teacherName || '—'}</td>
                          <td className="p-2.5 text-center font-semibold text-amber-800">{v.actionTaken || 'تنبيه شفهي'}</td>
                        </tr>
                      ))
                    : filteredAbsences.slice(0, 50).map((a, idx) => (
                        <tr key={a.id || idx} className="hover:bg-[#FBF8EF]">
                          <td className="p-2.5 text-center font-mono text-[#7A6B58]">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-[#2A2118]">{a.studentName}</td>
                          <td className="p-2.5 text-center font-mono text-blue-900 font-bold">{a.massarNumber || '—'}</td>
                          <td className="p-2.5 text-center text-emerald-800 font-semibold">
                            {a.sectionName || (a.level && a.classNumber ? `${a.level} (${a.classNumber})` : '—')}
                          </td>
                          <td className="p-2.5 text-center font-mono text-xs text-[#5E6D66]">
                            {a.date || '—'} <span className="text-[10px] text-[#7A6B58]">({a.session || 'حصة'})</span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              a.status === 'late' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {a.status === 'late' ? 'تأخر' : 'غياب'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              a.isJustified ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-red-700'
                            }`}>
                              {a.isJustified ? `مبرر ${a.justificationReason ? `(${a.justificationReason})` : ''}` : 'غير مبرر'}
                            </span>
                          </td>
                          <td className="p-2.5 text-[#5E6D66]">{a.teacherName ? `${a.teacherName} (${a.subject || 'عام'})` : '—'}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {recordCount > 50 && (
                <div className="p-2 bg-[#F4EFDE] text-center text-xs text-[#7A6B58] font-bold">
                  يتم عرض أول 50 سجلاً بالمعاينة، وسيتم تضمين جميع السجلات ({recordCount}) في وثيقة الطباعة الرسمية.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#E5DFD5] bg-[#FAF8F5] flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-[#D5CDC0] text-[#5E6D66] hover:bg-black/5 transition-colors cursor-pointer"
          >
            إلغاء وإغلاق
          </button>

          <button
            type="button"
            onClick={handleExecutePrint}
            disabled={recordCount === 0}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer ${
              recordCount === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                : isViolations
                ? 'bg-[#991b1b] hover:bg-[#7f1d1d] text-white border border-red-800'
                : 'bg-[#854d0e] hover:bg-[#713f12] text-white border border-amber-900'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير الرسمي الآن ({recordCount} سجل)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
