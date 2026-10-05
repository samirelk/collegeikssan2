import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Calendar,
  FileText,
  Building,
  Check,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SectionItem } from '../types';

export interface AbsenceRecordItem {
  id: number;
  sectionId: string;
  seatNum: number;
  studentName: string;
  studentNumber?: string;
  massarNumber?: string;
  status: 'absent' | 'late';
  recordedDate: string;
  sessionPeriod?: string;
  teacherName?: string;
  teacherSubject?: string;
  justified?: string;
  justificationReason?: string;
  notes?: string;
  sectionLevel?: string;
  sectionClass?: string;
}

interface MassarAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  absences: AbsenceRecordItem[];
  sections: SectionItem[];
  selectedDate: string;
  onImportSuccess?: () => void;
  onToast: (msg: string) => void;
}

export const MassarAbsenceModal: React.FC<MassarAbsenceModalProps> = ({
  isOpen,
  onClose,
  absences,
  sections,
  selectedDate,
  onImportSuccess,
  onToast
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [importSummary, setImportSummary] = useState<{ total: number; matched: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Filter absences for export preview
  const exportList = absences.filter((ab) => {
    if (selectedSectionFilter !== 'all' && ab.sectionId !== selectedSectionFilter) {
      return false;
    }
    return true;
  });

  // ==========================================
  // EXPORT FUNCTIONS (تصدير إلى مسار)
  // ==========================================
  const handleExportMassarExcel = () => {
    if (exportList.length === 0) {
      onToast('لا توجد غيابات مسجلة للتصدير في هذا التاريخ أو القسم');
      return;
    }

    // Prepare Official Massar Sheet
    const sheetData: any[][] = [
      ['المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة'],
      ['سجل مسك الغياب المدرسي - متوافق مع منظومة مسار (Massar)'],
      [`تاريخ الاستخراج: ${selectedDate}`, `العدد الإجمالي: ${exportList.length} حالة`],
      [], // Empty row
      [
        'رقم مسار (Code Massar)',
        'الاسم والنسب الكامل',
        'المستوى الدراسي',
        'القسم / الفوج',
        'رقم التلميذ',
        'تاريخ الغياب (Date)',
        'الحصة / الفترة (Séance)',
        'نوع الوضعية (Statut)',
        'التبرير (Justification)',
        'سبب التبرير والملاحظات',
        'الأستاذ المسجل',
        'المادة'
      ]
    ];

    exportList.forEach((ab) => {
      sheetData.push([
        ab.massarNumber || '—',
        ab.studentName,
        ab.sectionLevel || '—',
        ab.sectionClass ? `القسم ${ab.sectionClass}` : '—',
        ab.studentNumber || (ab.seatNum ? `مقعد ${ab.seatNum}` : '—'),
        ab.recordedDate,
        ab.sessionPeriod || 'كامل اليوم',
        ab.status === 'absent' ? 'غياب' : 'تأخر',
        ab.justified === 'justified' ? 'مبرر' : 'غير مبرر',
        ab.justificationReason || ab.notes || '',
        ab.teacherName || '—',
        ab.teacherSubject || '—'
      ]);
    });

    // Create workbook & worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set Column Widths
    ws['!cols'] = [
      { wch: 22 }, // رقم مسار
      { wch: 28 }, // الاسم
      { wch: 18 }, // المستوى
      { wch: 14 }, // القسم
      { wch: 12 }, // الرقم
      { wch: 14 }, // التاريخ
      { wch: 18 }, // الحصة
      { wch: 14 }, // الوضعية
      { wch: 14 }, // التبرير
      { wch: 28 }, // سبب التبرير
      { wch: 22 }, // الأستاذ
      { wch: 16 }  // المادة
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'مسك_الغياب_مسار');

    // Also create a Direct Import Sheet matching standard Massar columns
    const directMassarData: any[][] = [
      ['Code_Massar', 'Nom_Prenom', 'Classe', 'Date_Absence', 'Seance', 'Type', 'Justifie'],
      ...exportList.map((ab) => [
        ab.massarNumber || '',
        ab.studentName,
        `${ab.sectionLevel || ''} - ${ab.sectionClass || ''}`.trim(),
        ab.recordedDate,
        ab.sessionPeriod || 'كامل اليوم',
        ab.status === 'absent' ? 'Absence' : 'Retard',
        ab.justified === 'justified' ? 'Oui' : 'Non'
      ])
    ];
    const wsDirect = XLSX.utils.aoa_to_sheet(directMassarData);
    XLSX.utils.book_append_sheet(wb, wsDirect, 'Import_Direct_Massar');

    const fileName = `غيابات_مسار_${selectedDate.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    onToast(`تم تصدير ${exportList.length} حالة غياب بنجاح بصيغة متوافقة مع مسار!`);
  };

  const handleExportMassarCSV = () => {
    if (exportList.length === 0) {
      onToast('لا توجد غيابات للتصدير');
      return;
    }

    const headers = ['Code_Massar', 'Nom_Prenom', 'Classe', 'Date', 'Seance', 'Statut', 'Justifie', 'Motif'];
    const rows = exportList.map((ab) => [
      `"${ab.massarNumber || ''}"`,
      `"${ab.studentName}"`,
      `"${ab.sectionLevel || ''} ${ab.sectionClass || ''}"`,
      `"${ab.recordedDate}"`,
      `"${ab.sessionPeriod || 'كامل اليوم'}"`,
      `"${ab.status === 'absent' ? 'غياب' : 'تأخر'}"`,
      `"${ab.justified === 'justified' ? 'مبرر' : 'غير مبرر'}"`,
      `"${ab.justificationReason || ab.notes || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `مسار_غيابات_${selectedDate.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast('تم تنزيل ملف CSV متوافق مع مسار والترميز العربي (UTF-8) بنجاح');
  };

  // Download official Template for absences import
  const handleDownloadTemplate = () => {
    const templateData: any[][] = [
      ['نموذج استيراد الغيابات للإدارة ومنظومة مسار (Massar)'],
      ['ملاحظة: يمكنك إدخال رقم مسار أو الاسم مع المستوى والقسم ليتم الربط التلقائي'],
      [],
      [
        'رقم مسار (Massar)',
        'اسم التلميذ',
        'المستوى الدراسي',
        'رقم القسم',
        'تاريخ الغياب (YYYY-MM-DD)',
        'الحصة / الفترة',
        'الوضعية (غياب / تأخر)',
        'التبرير (مبرر / غير مبرر)',
        'سبب التبرير / ملاحظات'
      ],
      [
        'G135089201',
        'العلمي فاطمة الزهراء',
        'المستوى الأول',
        '1',
        selectedDate.includes('-') ? selectedDate : '2026-09-25',
        'كامل اليوم',
        'غياب',
        'غير مبرر',
        'غياب بدون إشعار'
      ],
      [
        'G134012988',
        'المنصوري ياسين',
        'المستوى الأول',
        '1',
        selectedDate.includes('-') ? selectedDate : '2026-09-25',
        'الحصة 1 (الصباح)',
        'تأخر',
        'مبرر',
        'إذن من الحراسة العامة'
      ]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 22 },
      { wch: 25 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'نموذج_استيراد_الغيابات');
    XLSX.writeFile(wb, 'نموذج_استيراد_الغيابات_مسار.xlsx');
    onToast('تم تحميل نموذج Excel المخصص لاستيراد الغيابات');
  };

  // ==========================================
  // IMPORT FUNCTIONS (استيراد من مسار)
  // ==========================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileToImport(file);
    parseUploadedFile(file);
  };

  const parseUploadedFile = (file: File) => {
    setIsParsing(true);
    setParsedRows([]);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: '' });

        if (!rawData || rawData.length === 0) {
          onToast('الملف فارغ أو غير صالح');
          setIsParsing(false);
          return;
        }

        // Find header row (contains 'مسار' or 'Massar' or 'تاريخ' or 'Date' or 'Nom' or 'اسم')
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
          const rowStr = (rawData[i] || []).join(' ').toLowerCase();
          if (
            rowStr.includes('مسار') ||
            rowStr.includes('massar') ||
            rowStr.includes('code') ||
            rowStr.includes('nom') ||
            rowStr.includes('اسم') ||
            rowStr.includes('تاريخ') ||
            rowStr.includes('date')
          ) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
        }

        const headers = (rawData[headerRowIndex] || []).map((h: any) => String(h).trim().toLowerCase());

        // Locate columns
        let cMassar = -1;
        let cName = -1;
        let cLevel = -1;
        let cClass = -1;
        let cDate = -1;
        let cPeriod = -1;
        let cStatus = -1;
        let cJustified = -1;
        let cReason = -1;

        headers.forEach((h: string, idx: number) => {
          if (h.includes('مسار') || h.includes('massar') || h.includes('cne')) cMassar = idx;
          else if (h.includes('اسم') || h.includes('nom') || h.includes('prenom') || h.includes('تلميذ')) cName = idx;
          else if (h.includes('مستوى') || h.includes('niveau')) cLevel = idx;
          else if (h.includes('قسم') || h.includes('classe') || h.includes('فوج') || h.includes('groupe')) cClass = idx;
          else if (h.includes('تاريخ') || h.includes('date')) cDate = idx;
          else if (h.includes('حصة') || h.includes('فترة') || h.includes('seance') || h.includes('période')) cPeriod = idx;
          else if (h.includes('نوع') || h.includes('وضعية') || h.includes('statut') || h.includes('etat') || h.includes('type')) cStatus = idx;
          else if (h.includes('تبرير') || h.includes('مبرر') || h.includes('justifi')) cJustified = idx;
          else if (h.includes('سبب') || h.includes('ملاحظ') || h.includes('motif')) cReason = idx;
        });

        // Fallback default column order if headers could not be matched
        if (cMassar === -1 && headers.length >= 1) cMassar = 0;
        if (cName === -1 && headers.length >= 2) cName = 1;

        const parsed: any[] = [];

        for (let r = headerRowIndex + 1; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row || !Array.isArray(row)) continue;

          const massarVal = cMassar !== -1 ? String(row[cMassar] || '').trim() : '';
          const nameVal = cName !== -1 ? String(row[cName] || '').trim() : '';
          const levelVal = cLevel !== -1 ? String(row[cLevel] || '').trim() : '';
          const classVal = cClass !== -1 ? String(row[cClass] || '').trim() : '';
          const dateVal = cDate !== -1 ? String(row[cDate] || '').trim() : selectedDate;
          const periodVal = cPeriod !== -1 ? String(row[cPeriod] || '').trim() : 'كامل اليوم';
          const statusRaw = cStatus !== -1 ? String(row[cStatus] || '').trim().toLowerCase() : 'غياب';
          const justifiedRaw = cJustified !== -1 ? String(row[cJustified] || '').trim().toLowerCase() : 'غير مبرر';
          const reasonVal = cReason !== -1 ? String(row[cReason] || '').trim() : '';

          if (!massarVal && !nameVal) continue;

          const status = statusRaw.includes('تأخر') || statusRaw.includes('retard') || statusRaw.includes('late')
            ? 'late'
            : 'absent';

          const justified = justifiedRaw.includes('نعم') || justifiedRaw.includes('oui') || justifiedRaw.includes('yes') || (justifiedRaw.includes('مبرر') && !justifiedRaw.includes('غير'))
            ? 'justified'
            : 'unjustified';

          parsed.push({
            massarNumber: massarVal,
            studentName: nameVal,
            sectionLevel: levelVal,
            sectionClass: classVal,
            recordedDate: dateVal || selectedDate,
            sessionPeriod: periodVal || 'كامل اليوم',
            status,
            justified,
            justificationReason: reasonVal
          });
        }

        setParsedRows(parsed);
        if (parsed.length === 0) {
          onToast('لم يتم العثور على أسطر صالحة في الملف');
        } else {
          onToast(`تمت قراءة ${parsed.length} سجلاً بنجاح من الملف`);
        }
      } catch (err: any) {
        console.error(err);
        onToast('خطأ أثناء قراءة الملف، يرجى التأكد من الصيغة');
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      onToast('لا توجد بيانات للاستيراد');
      return;
    }

    try {
      setIsSubmittingImport(true);
      const res = await fetch('/api/daily-archive/absences/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absences: parsedRows })
      });
      const data = await res.json();
      if (data.success) {
        setImportSummary({
          total: data.importedCount,
          matched: data.matchedStudentsCount
        });
        onToast(data.message || `تم استيراد ${data.importedCount} حالة غياب بنجاح!`);
        onImportSuccess?.();
      } else {
        onToast(data.error || 'فشل استيراد الغيابات');
      }
    } catch (err) {
      console.error(err);
      onToast('خطأ في الاتصال بالخادم أثناء الاستيراد');
    } finally {
      setIsSubmittingImport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div
        className="bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-stone-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col min-h-[100dvh] sm:min-h-0 sm:max-h-[92vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-5 sm:p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold shadow-md shrink-0">
              <FileSpreadsheet className="w-7 h-7 text-emerald-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-bold font-serif text-white">
                  التكامل مع منظومة مسار (Massar)
                </h3>
                <span className="bg-amber-400 text-emerald-950 text-xs px-2.5 py-0.5 rounded-full font-black">
                  استيراد وتصدير الغيابات
                </span>
              </div>
              <p className="text-emerald-100 text-xs sm:text-sm mt-0.5">
                تصدير غيابات التلاميذ وفق المعايير الرسمية لمنظومة مسار، أو استيراد ملفات الحراسة العامة والإدارة
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-white/20">
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-white text-emerald-900 shadow-md font-black'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>تصدير الغيابات إلى مسار (Excel / CSV)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-white text-emerald-900 shadow-md font-black'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>استيراد غيابات من مسار / ملف خارجي</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-stone-50/60">
          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-stone-600 font-bold">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>تاريخ الغيابات:</span>
                    <span className="font-mono text-stone-900 bg-stone-100 px-2 py-0.5 rounded-lg border">
                      {selectedDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-stone-500" />
                    <select
                      value={selectedSectionFilter}
                      onChange={(e) => setSelectedSectionFilter(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-xl border border-stone-300 bg-white font-medium focus:outline-hidden focus:border-emerald-600"
                    >
                      <option value="all">جميع الأقسام ({sections.length})</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.level} - القسم {s.classNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Export Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportMassarExcel}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                    title="تصدير ملف Excel رسمي يتضمن ورقتين: ورقة تفصيلية وورقة مطابقة لمسك مسار المباشر"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-amber-300" />
                    <span>تصدير إلى مسار (Excel)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportMassarCSV}
                    className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
                    title="تصدير كملف CSV بالترميز العربي UTF-8"
                  >
                    <Download className="w-4 h-4 text-stone-300" />
                    <span>تصدير CSV</span>
                  </button>
                </div>
              </div>

              {/* Format features banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">خصائص ملف التصدير لمنظومة مسار:</p>
                  <p className="text-emerald-800 leading-relaxed">
                    يتضمن الملف تلقائياً <strong>رمز مسار (Code Massar)</strong> لكل تلميذ، نوع الحصة، تاريخ الغياب، ووضعية التبرير (مبرر / غير مبرر). تم إعداد الملف ليتوافق مع مسك الغيابات المباشر أو الأرشفة الإلكترونية للإدارة.
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="p-3 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between text-xs font-bold text-stone-700">
                  <span>معاينة حالات الغياب المرشحة للتصدير ({exportList.length}):</span>
                  {exportList.length > 0 && (
                    <span className="text-emerald-700">
                      جاهز للتنزيل الفوري
                    </span>
                  )}
                </div>

                {exportList.length === 0 ? (
                  <div className="text-center py-12 text-stone-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                    <p className="text-sm font-bold">لا توجد حالات غياب مسجلة لهذا التاريخ أو القسم المحدد</p>
                    <p className="text-xs text-stone-400 mt-1">تأكد من تسجيل الحضور في خريطة القسم أو الأرشيف اليومي أولاً</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold sticky top-0">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">رمز مسار (Massar)</th>
                          <th className="p-2.5">اسم التلميذ</th>
                          <th className="p-2.5">القسم</th>
                          <th className="p-2.5">الحصة</th>
                          <th className="p-2.5">الحالة</th>
                          <th className="p-2.5">التبرير</th>
                          <th className="p-2.5">الأستاذ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-medium">
                        {exportList.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-stone-50">
                            <td className="p-2.5 text-stone-400">{idx + 1}</td>
                            <td className="p-2.5">
                              {item.massarNumber ? (
                                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {item.massarNumber}
                                </span>
                              ) : (
                                <span className="text-stone-400 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="p-2.5 font-bold text-stone-800">{item.studentName}</td>
                            <td className="p-2.5 text-stone-600">
                              {item.sectionLevel} ({item.sectionClass ? `فوج ${item.sectionClass}` : '—'})
                            </td>
                            <td className="p-2.5 text-stone-600">{item.sessionPeriod || 'كامل اليوم'}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                item.status === 'absent' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {item.status === 'absent' ? 'غياب' : 'تأخر'}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium ${
                                item.justified === 'justified' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-stone-100 text-stone-600'
                              }`}>
                                {item.justified === 'justified' ? 'مبرر ✓' : 'غير مبرر'}
                              </span>
                            </td>
                            <td className="p-2.5 text-stone-500 text-[11px]">{item.teacherName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Instructions and Download Template */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>استيراد ملف غيابات من مسار أو من الحراسة العامة:</span>
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    يدعم ملفات Excel (.xlsx, .xls) و CSV. يتعرف النظام تلقائياً على التلميذ عبر رمز مسار أو الاسم والقسم.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-stone-200"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تحميل نموذج Excel المعتمد</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all rounded-3xl p-6 sm:p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
                  {isParsing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-7 h-7" />
                  )}
                </div>

                <div className="mt-1">
                  <span className="text-sm font-bold text-stone-800">
                    {fileToImport ? fileToImport.name : 'انقر لاختيار ملف الغيابات (Excel / CSV)'}
                  </span>
                  <p className="text-xs text-stone-500 mt-0.5">
                    يمكنك رفع ملف مسك الغياب الصادر من مسار أو لائحة الحراسة العامة اليومية
                  </p>
                </div>
              </div>

              {/* Success import summary if completed */}
              {importSummary && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">اكتمل الاستيراد بنجاح!</span>
                    <p className="text-emerald-800 text-xs mt-0.5">
                      تم تسجيل <strong>{importSummary.total}</strong> حالة غياب في الأرشيف اليومي، مع مطابقة{' '}
                      <strong>{importSummary.matched}</strong> تلميذاً في خريطة الأقسام والمقاعد.
                    </p>
                  </div>
                </div>
              )}

              {/* Parsed Rows Preview */}
              {parsedRows.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-3 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs font-bold text-stone-800 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>معاينة السجلات المقروءة من الملف ({parsedRows.length}):</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={isSubmittingImport}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingImport ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الاستيراد والتسجيل...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-amber-300" />
                          <span>تأكيد استيراد {parsedRows.length} حالة غياب</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-60 border rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold sticky top-0">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">رمز مسار</th>
                          <th className="p-2">اسم التلميذ</th>
                          <th className="p-2">القسم</th>
                          <th className="p-2">التاريخ</th>
                          <th className="p-2">الحصة</th>
                          <th className="p-2">الوضعية</th>
                          <th className="p-2">التبرير</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {parsedRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-stone-50">
                            <td className="p-2 text-stone-400">{i + 1}</td>
                            <td className="p-2 font-mono font-bold text-emerald-800">
                              {r.massarNumber || '—'}
                            </td>
                            <td className="p-2 font-bold text-stone-800">{r.studentName || '—'}</td>
                            <td className="p-2 text-stone-600">{r.sectionLevel} {r.sectionClass}</td>
                            <td className="p-2 font-mono text-stone-600">{r.recordedDate}</td>
                            <td className="p-2 text-stone-600">{r.sessionPeriod}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'absent' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {r.status === 'absent' ? 'غياب' : 'تأخر'}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                r.justified === 'justified' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-stone-100 text-stone-600'
                              }`}>
                                {r.justified === 'justified' ? 'مبرر' : 'غير مبرر'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedRows.length > 50 && (
                    <p className="text-[11px] text-stone-400 text-center">
                      يتم عرض أول 50 سجلاً من أصل {parsedRows.length}. جميع السجلات سيتم استيرادها عند التأكيد.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <div className="text-xs text-stone-500">
            منظومة مسار للتدبير المدرسي • المملكة المغربية
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
