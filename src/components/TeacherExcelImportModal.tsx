import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  RefreshCw,
  Copy,
  Printer,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { TeacherItem, TEACHER_SUBJECTS } from '../types';

interface ParsedTeacherRow {
  id: string;
  selected: boolean;
  rowNumber: number;
  fullName: string;
  subject: string;
  username: string;
  email: string;
  isExisting: boolean;
  existingSubject?: string;
  status: 'valid' | 'warning' | 'error';
  errorMsg?: string;
}

interface TeacherExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingTeachers: TeacherItem[];
  academicYear: string;
}

export const TeacherExcelImportModal: React.FC<TeacherExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingTeachers,
  academicYear
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTeacherRow[]>([]);
  const [defaultPassword, setDefaultPassword] = useState('123456');
  const [updateExistingSubject, setUpdateExistingSubject] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    total: number;
    results: any[];
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Transliterate Arabic name to clean Latin username slug
  const generateSlug = (arabicName: string): string => {
    let clean = arabicName
      .replace(/^(ذ\.|أ\.|الأستاذ|الأستاذة|السيد|السيدة|prof\.|mr\.|mme\.)\s*/i, '')
      .trim();

    const map: Record<string, string> = {
      'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
      'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
      'س': 's', 'ش': 'ch', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
      'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
      'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a', 'ء': '', 'ئ': 'y', 'ؤ': 'o'
    };

    let res = '';
    for (const char of clean) {
      if (map[char] !== undefined) {
        res += map[char];
      } else if (/[a-zA-Z0-9]/.test(char)) {
        res += char.toLowerCase();
      } else if (char === ' ' || char === '-' || char === '_') {
        res += '_';
      }
    }
    res = res.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return res || 'prof_' + Math.floor(Math.random() * 900 + 100);
  };

  // Normalize subject to match Moroccan school subject names
  const normalizeSubject = (raw: string): string => {
    if (!raw || !raw.trim()) return 'الرياضيات';
    const s = raw.trim();
    if (/رياض|math/i.test(s)) return 'الرياضيات';
    if (/فرنس|fran/i.test(s)) return 'الفرنسية';
    if (/عرب|arab/i.test(s)) return 'العربية';
    if (/حياة|أرض|svt|طبيع/i.test(s)) return 'علوم الحياة والأرض';
    if (/فيزيا|كيميا|phys|pc/i.test(s)) return 'علوم الفيزياء';
    if (/اجتماع|تاريخ|جغرافيا|hg/i.test(s)) return 'الاجتماعيات';
    if (/إسلام|اسلام|تربية إسلامية|تربية اسلامية|دين/i.test(s)) return 'التربية الإسلامية';
    if (/رياضة|بدني|تربية بدنية|eps/i.test(s)) return 'الرياضة';
    if (/معلوم|حاسوب|برمج|info/i.test(s)) return 'المعلوميات';
    if (/إنجليز|انجليز|eng/i.test(s)) return 'الإنجليزية';
    if (/تكنولوج|techno/i.test(s)) return 'التكنولوجيا';
    return s;
  };

  // Download official ready-to-fill Excel template
  const handleDownloadTemplate = () => {
    const headers = ['اسم الأستاذ', 'تخصص الأستاذ (المادة)'];
    const sampleRows = [
      ['ذ. محمد الإدريسي', 'الرياضيات'],
      ['أ. فاطمة الزهراء المنصوري', 'الفرنسية'],
      ['ذ. سعيد التازي', 'علوم الحياة والأرض'],
      ['ذ. عبد الله بنسعيد', 'علوم الفيزياء'],
      ['أ. مريم العلمي', 'العربية'],
      ['ذ. رشيد العماري', 'الاجتماعيات'],
      ['أ. نادية الصالحي', 'التربية الإسلامية'],
      ['ذ. كريم الفاسي', 'الرياضة'],
      ['أ. إيمان الداودي', 'المعلوميات'],
      ['ذ. طارق بن جلون', 'الإنجليزية']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    // Set nice column widths
    worksheet['!cols'] = [{ wch: 32 }, { wch: 28 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'أساتذة المادة');

    XLSX.writeFile(workbook, 'نموذج_استيراد_أساتذة_المادة.xlsx');
  };

  // Export current list of registered teachers
  const handleExportCurrentTeachers = () => {
    if (!existingTeachers || existingTeachers.length === 0) {
      alert('لا يوجد أي أساتذة مسجلين حالياً للتصدير');
      return;
    }

    const headers = [
      'اسم الأستاذ',
      'تخصص الأستاذ (المادة)',
      'اسم المستخدم (Login)',
      'البريد الإلكتروني',
      'الحالة',
      'الأقسام المسندة'
    ];

    const rows = existingTeachers.map((t) => [
      t.fullName,
      t.subject || 'الرياضيات',
      t.username,
      t.email,
      t.status === 'active' ? 'مفعل' : 'معلق',
      t.assignedSectionsCount || 0
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 18 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'لائحة الأساتذة');

    XLSX.writeFile(workbook, `لائحة_أساتذة_المؤسسة_${academicYear.replace('/', '-')}.xlsx`);
  };

  // Parse Excel file
  const processExcelFile = (file: File) => {
    setErrorMessage(null);
    setFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('الملف فارغ أو لا يحتوي على صفحات عمل');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Read sheet as an array of arrays (AOA)
        // Row index 0 = Line 1 (Headers)
        // Row index 1 = Line 2 (Start of data, exactly as user requested)
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawData || rawData.length < 2) {
          throw new Error('الملف لا يحتوي على بيانات ابتداءً من السطر 2. يرجى التأكد من محتوى الملف.');
        }

        const parsed: ParsedTeacherRow[] = [];
        const usedUsernames = new Set<string>();

        // Start processing from Row 2 (index 1)
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          // Column A (index 0) = Teacher Name
          const colA = String(row[0] || '').trim();
          // Column B (index 1) = Subject / Specialization
          const colB = String(row[1] || '').trim();

          // Skip completely empty lines
          if (!colA && !colB) continue;

          if (!colA) {
            continue; // Must have teacher name
          }

          const fullName = colA;
          const subject = normalizeSubject(colB);

          // Check if teacher already exists in system
          const existingTeacher = existingTeachers.find(
            (t) => t.fullName.trim().toLowerCase() === fullName.toLowerCase()
          );

          // Generate candidate username
          let baseSlug = generateSlug(fullName);
          let uniqueSlug = baseSlug;
          let counter = 1;
          while (usedUsernames.has(uniqueSlug)) {
            uniqueSlug = `${baseSlug}_${counter++}`;
          }
          usedUsernames.add(uniqueSlug);

          const candidateEmail = `${uniqueSlug}@iksan.ma`;

          parsed.push({
            id: `row_${i}_${Date.now()}`,
            selected: true,
            rowNumber: i + 1, // 1-based line number for user reference (Row 2, 3...)
            fullName,
            subject,
            username: existingTeacher ? existingTeacher.username : uniqueSlug,
            email: existingTeacher ? existingTeacher.email : candidateEmail,
            isExisting: Boolean(existingTeacher),
            existingSubject: existingTeacher?.subject,
            status: 'valid'
          });
        }

        if (parsed.length === 0) {
          throw new Error('لم يتم العثور على أي أساتذة صالحين في العمود A ابتداءً من السطر 2.');
        }

        setParsedRows(parsed);
      } catch (err: any) {
        setErrorMessage(err.message || 'حدث خطأ أثناء قراءة ملف Excel.');
        setParsedRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('تعذر قراءة الملف المحدد.');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processExcelFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleRowChange = (id: string, field: keyof ParsedTeacherRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const selectedRows = parsedRows.filter((r) => r.selected);
  const newTeachersCount = selectedRows.filter((r) => !r.isExisting).length;
  const existingTeachersCount = selectedRows.filter((r) => r.isExisting).length;

  // Submit batch import to backend
  const handleConfirmImport = async () => {
    if (selectedRows.length === 0) {
      setErrorMessage('يرجى تحديد أستاذ واحد على الأقل للاستيراد.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = {
        teachers: selectedRows.map((r) => ({
          fullName: r.fullName,
          subject: r.subject,
          username: r.username,
          email: r.email,
          password: defaultPassword
        })),
        defaultPassword,
        updateExistingSubject
      };

      const res = await fetch('/api/auth/admin-batch-create-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'تعذر استيراد الأساتذة');
      }

      setImportResult({
        success: true,
        createdCount: data.createdCount || 0,
        updatedCount: data.updatedCount || 0,
        skippedCount: data.skippedCount || 0,
        total: data.totalProcessed || selectedRows.length,
        results: data.results || []
      });

      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الأساتذة.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyTeacherCredentials = (row: any, index: number) => {
    const text = `بيانات الدخول:\nالأستاذ(ة): ${row.fullName}\nالمادة: ${row.subject}\nاسم المستخدم: ${row.username}\nكلمة المرور: ${defaultPassword}\nالرابط: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="bg-[#FBF8EF] text-[#2A2118] rounded-2xl w-full max-w-4xl my-auto max-h-[96vh] sm:max-h-[92vh] flex flex-col shadow-2xl border border-[#E4DBC0] overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-3.5 sm:p-5 border-b border-[#E4DBC0] bg-[#EFE9D5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#2D5A27] text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-xl font-bold font-serif text-[#2A2118] truncate">
                إضافة واستصدار أساتذة المادة عبر ملف Excel
              </h3>
              <p className="text-[11px] sm:text-xs text-[#7A6B58] truncate">
                العمود A: اسم الأستاذ • العمود B: تخصص الأستاذ / المادة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5B5040] hover:bg-[rgba(42,33,24,0.1)] cursor-pointer text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-right">
          {/* QUICK TEMPLATE EXPORT & INSTRUCTIONS BAR */}
          <div className="bg-[#FAF6EC] border border-[#E0D5B8] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2D5A27]">
                <BookOpen className="w-4 h-4" />
                <span>هيكلة ملف Excel المعتمدة بالنظام:</span>
              </div>
              <ul className="text-[11px] text-[#5B5040] space-y-0.5 list-disc list-inside">
                <li><strong className="text-[#2A2118]">العمود A:</strong> اسم الأستاذ الكامل ابتداءً من السطر 2.</li>
                <li><strong className="text-[#2A2118]">العمود B:</strong> تخصص الأستاذ أو مادته (الرياضيات، الفرنسية، العربية...) ابتداءً من السطر 2.</li>
                <li>السطر 1 مخصص كترويسة للأعمدة (العنوان).</li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D5A27] hover:bg-[#23471E] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="تحميل نموذج جاهز ومنسق لتعبئته في Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>استصدار نموذج Excel جاهز (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleExportCurrentTeachers}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F2ECE0] text-[#2A2118] border border-[#D0C4A4] text-xs font-bold transition-all cursor-pointer"
                title="استصدار لائحة أساتذة المؤسسة الحالية مع تخصصاتهم"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#2D5A27]" />
                <span>تصدير لائحة الأساتذة الحالية</span>
              </button>
            </div>
          </div>

          {/* SUCCESS RESULT VIEW */}
          {importResult ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-emerald-900">
                    اكتملت عملية استيراد وتفعيل الأساتذة بنجاح!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    تمت معالجة {importResult.total} أستاذ: تم إنشاء {importResult.createdCount} حساب جديد، وتحديث تخصص {importResult.updatedCount}، وتجاوز {importResult.skippedCount}.
                  </p>
                </div>
              </div>

              {/* CREDENTIALS SUMMARY TABLE FOR DIRECTOR */}
              <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
                <div className="p-3 bg-emerald-100/60 border-b border-emerald-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">
                    بيانات حسابات الأساتذة المسجلين (كلمة المرور الافتراضية: <code className="bg-white px-2 py-0.5 rounded text-emerald-800 font-mono">{defaultPassword}</code>)
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    يمكن للأستاذ تغيير كلمة المرور فور تسجيل دخوله الأول
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-[#FAF8F5] text-[#5B5040] border-b border-emerald-100 sticky top-0">
                      <tr>
                        <th className="p-2.5 font-bold">الأستاذ(ة)</th>
                        <th className="p-2.5 font-bold">المادة / التخصص</th>
                        <th className="p-2.5 font-bold">اسم المستخدم (Login)</th>
                        <th className="p-2.5 font-bold">النتيجة</th>
                        <th className="p-2.5 font-bold text-center">نسخ البيانات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {importResult.results.map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-emerald-50/50">
                          <td className="p-2.5 font-bold text-[#2A2118]">{r.fullName}</td>
                          <td className="p-2.5 text-[#5B5040]">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                              {r.subject}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-emerald-800">{r.username}</td>
                          <td className="p-2.5">
                            {r.status === 'created' ? (
                              <span className="text-emerald-700 font-bold text-[11px]">✓ حساب مفعل جديد</span>
                            ) : r.status === 'updated' ? (
                              <span className="text-blue-700 font-bold text-[11px]">✎ تحديث التخصص</span>
                            ) : (
                              <span className="text-amber-700 font-bold text-[11px]">مسجل مسبقاً</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => copyTeacherCredentials(r, idx)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              {copiedIndex === idx ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>تم النسخ</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>نسخ بطاقة الدخول</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportResult(null);
                    setParsedRows([]);
                    setFileName(null);
                    onClose();
                  }}
                  className="px-5 py-2 rounded-xl bg-[#2D5A27] hover:bg-[#23471E] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  إغلاق والعودة للوحة التحكم
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* FILE UPLOAD DROPZONE */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[#2D5A27] bg-[#2D5A27]/5 scale-[0.99]'
                    : 'border-[#D9CEB0] hover:border-[#2D5A27] bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-[#EFE9D5] text-[#2D5A27] flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-[#2A2118]">
                    {fileName ? `الملف المحدد: ${fileName}` : 'اسحب وأفلت ملف Excel هنا، أو انقر للاختيار'}
                  </h4>
                  <p className="text-xs text-[#7A6B58]">
                    يدعم ملفات Microsoft Excel بصيغ (.xlsx, .xls) أو ملفات (.csv)
                  </p>
                  <span className="inline-block mt-1 px-3 py-1 rounded-full bg-[#EFE9D5] text-[#2A2118] text-[11px] font-bold">
                    العمود A: اسم الأستاذ • العمود B: تخصص الأستاذ (ابتداءً من السطر 2)
                  </span>
                </div>
              </div>

              {/* ERROR ALERT */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* PREVIEW & EDITING TABLE */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  {/* SUMMARY & GLOBAL SETTINGS */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#EFE9D5] p-3 rounded-xl border border-[#D9CEB0]">
                    <div className="flex items-center gap-4 text-xs font-bold text-[#2A2118]">
                      <span>إجمالي المقروء: {parsedRows.length}</span>
                      <span className="text-emerald-800">محدد للاستيراد: {selectedRows.length}</span>
                      {existingTeachersCount > 0 && (
                        <span className="text-blue-800">موجود مسبقاً: {existingTeachersCount}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 font-bold text-[#2A2118]">
                        <span>كلمة المرور الافتراضية:</span>
                        <input
                          type="text"
                          value={defaultPassword}
                          onChange={(e) => setDefaultPassword(e.target.value)}
                          className="w-24 px-2 py-1 rounded-lg bg-white border border-[#D9CEB0] text-xs font-mono text-center"
                        />
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-[#5B5040] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={updateExistingSubject}
                          onChange={(e) => setUpdateExistingSubject(e.target.checked)}
                          className="rounded text-[#2D5A27]"
                        />
                        <span>تحديث التخصص للمسجلين مسبقاً</span>
                      </label>
                    </div>
                  </div>

                  {/* TABLE */}
                  <div className="border border-[#E4DBC0] rounded-xl overflow-hidden bg-white shadow-xs max-h-96 overflow-y-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-[#FAF8F5] text-[#2A2118] border-b border-[#E4DBC0] sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 text-center w-10">
                            <input
                              type="checkbox"
                              checked={parsedRows.length > 0 && selectedRows.length === parsedRows.length}
                              onChange={(e) => toggleSelectAll(e.target.checked)}
                              className="rounded"
                            />
                          </th>
                          <th className="p-2.5 font-bold w-16 text-center">السطر</th>
                          <th className="p-2.5 font-bold">اسم الأستاذ (العمود A)</th>
                          <th className="p-2.5 font-bold">تخصص الأستاذ / المادة (العمود B)</th>
                          <th className="p-2.5 font-bold">اسم المستخدم المقترح</th>
                          <th className="p-2.5 font-bold">الحالة الحالية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE9D5]">
                        {parsedRows.map((row) => (
                          <tr key={row.id} className={`hover:bg-[#FAF8F5] ${!row.selected ? 'opacity-40 bg-gray-50' : ''}`}>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={(e) => handleRowChange(row.id, 'selected', e.target.checked)}
                                className="rounded"
                              />
                            </td>
                            <td className="p-2.5 text-center font-mono text-[#7A6B58] text-[11px]">
                              #{row.rowNumber}
                            </td>
                            <td className="p-2.5 font-bold">
                              <input
                                type="text"
                                value={row.fullName}
                                onChange={(e) => handleRowChange(row.id, 'fullName', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-[#D9CEB0] bg-white text-xs"
                              />
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={row.subject}
                                  onChange={(e) => handleRowChange(row.id, 'subject', e.target.value)}
                                  className="px-2 py-1 rounded border border-[#D9CEB0] bg-white text-xs font-bold"
                                >
                                  {TEACHER_SUBJECTS.map((subj) => (
                                    <option key={subj} value={subj}>
                                      {subj}
                                    </option>
                                  ))}
                                  {!TEACHER_SUBJECTS.includes(row.subject as any) && (
                                    <option value={row.subject}>{row.subject} (تخصص مخصص)</option>
                                  )}
                                </select>
                              </div>
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-[#5B5040]">
                              <input
                                type="text"
                                value={row.username}
                                onChange={(e) => handleRowChange(row.id, 'username', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-[#D9CEB0] bg-white font-mono text-[11px]"
                              />
                            </td>
                            <td className="p-2.5">
                              {row.isExisting ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold text-[10px]" title={`مسجل مسبقاً بمادة: ${row.existingSubject}`}>
                                  <span>مسجل مسبقاً</span>
                                  {row.existingSubject !== row.subject && (
                                    <span className="text-blue-700">(سيتم تحديث المادة)</span>
                                  )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                                  <UserCheck className="w-3 h-3 text-emerald-700" />
                                  <span>أستاذ جديد</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        {!importResult && (
          <div className="p-4 border-t border-[#E4DBC0] bg-[#EFE9D5] flex items-center justify-between gap-3">
            <div className="text-xs text-[#7A6B58]">
              {parsedRows.length > 0 && (
                <span>
                  جاهز لإضافة <strong>{newTeachersCount}</strong> أستاذ جديد وتحديث <strong>{existingTeachersCount}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#2A2118] border border-[#D9CEB0] font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isLoading || selectedRows.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#2D5A27] hover:bg-[#23471E] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الاستيراد والتفعيل...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>
                      تأكيد استيراد الأساتذة ({selectedRows.length})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
