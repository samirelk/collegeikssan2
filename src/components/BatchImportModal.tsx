import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Shuffle,
  CheckCircle2,
  AlertTriangle,
  Download,
  Sparkles,
  Users,
  Layers,
  X,
  RefreshCw
} from 'lucide-react';

export interface BatchSectionData {
  level: string;
  classNumber: string;
  teacher?: string;
  students: Array<{ name: string; number?: string; massarNumber?: string }>;
  randomizeSeats?: boolean;
}

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  onToast: (msg: string) => void;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onToast
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [parsedSections, setParsedSections] = useState<BatchSectionData[]>([]);
  const [randomizeSeats, setRandomizeSeats] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [expandedSecIndex, setExpandedSecIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process uploaded Excel / CSV file
  const handleFile = (file: File) => {
    setParseError(null);
    setValidationWarnings([]);
    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const extractedSections: BatchSectionData[] = [];
        const warnings: string[] = [];

        // CASE 1: Iterate over all sheets in the workbook
        // Specification:
        // - Number of sections in institution = Number of sheets in file
        // - Each sheet = 1 section (اسم الورقة = اسم القسم)
        // - Data starts at Row 11 (skiprows=10)
        // - Col A (index 0) = Student Number (ابتداءً من 1)
        // - Col B (index 1) = رقم مسار (Massar)
        // - Col C (index 2) = النسب (Nom)
        // - Col D (index 3) = الاسم (Prénom)
        // - Rule: First student number in every section must be 1
        workbook.SheetNames.forEach((sheetName) => {
          const ws = workbook.Sheets[sheetName];
          if (!ws) return;
          const rawRows = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: '' });
          const students = extractStudentsFromRows(rawRows);

          if (students.length > 0) {
            // Validate Rule: First student in every section must be #1
            const firstNum = parseInt(students[0].number || '0', 10);
            if (firstNum !== 1) {
              warnings.push(
                `⚠️ تنبيه في الورقة "${sheetName}": أول رقم ترتيبي هو ${students[0].number} وليس 1 (يرجى التأكد من أن بيانات التلاميذ تبدأ من الصف 11 وأن العمود A مخصص للأرقام ابتداءً من 1).`
              );
            }

            const { level, classNumber } = parseSectionTitle(sheetName);
            extractedSections.push({
              level,
              classNumber,
              students,
              randomizeSeats: false
            });
          }
        });

        // CASE 2: Fallback if single sheet has a dedicated "Section" column
        if (extractedSections.length === 0 && workbook.SheetNames.length >= 1) {
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json<any>(firstSheet, { header: 1, defval: '' });

          if (rawRows.length > 1) {
            // Check for section column in rows 0..15
            let sectionCol = -1;
            let headerRowIndex = -1;
            for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
              const row = (rawRows[r] as any[]) || [];
              row.forEach((col, cIdx) => {
                const str = String(col || '').toLowerCase();
                if (
                  str.includes('قسم') ||
                  str.includes('القسم') ||
                  str.includes('مستوى') ||
                  str.includes('المستوى') ||
                  str.includes('class') ||
                  str.includes('section') ||
                  str.includes('group') ||
                  str.includes('groupe') ||
                  str.includes('فصل')
                ) {
                  sectionCol = cIdx;
                  headerRowIndex = r;
                }
              });
              if (sectionCol !== -1) break;
            }

            if (sectionCol !== -1) {
              const sectionMap: Record<string, Array<{ name: string; number?: string; massarNumber?: string }>> = {};
              const headerStudents = extractStudentsWithSectionCol(rawRows, sectionCol, headerRowIndex);

              headerStudents.forEach(({ sectionName, student }) => {
                if (!sectionMap[sectionName]) {
                  sectionMap[sectionName] = [];
                }
                sectionMap[sectionName].push(student);
              });

              Object.entries(sectionMap).forEach(([secName, students]) => {
                // Sort by student number starting from 1
                students.sort((a, b) => {
                  const numA = parseInt(a.number || '0', 10);
                  const numB = parseInt(b.number || '0', 10);
                  if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) return numA - numB;
                  return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
                });

                const { level, classNumber } = parseSectionTitle(secName);
                extractedSections.push({
                  level,
                  classNumber,
                  students,
                  randomizeSeats: false
                });
              });
            }
          }
        }

        setValidationWarnings(warnings);

        if (extractedSections.length === 0) {
          setParseError('لم يتم العثور على بيانات تلاميذ صالحة في الملف. يرجى التأكد من وجود عمود للأسماء أو استخدام النموذج المقترح.');
          setParsedSections([]);
        } else {
          setParsedSections(extractedSections);
          onToast(`تم التعرف على ${extractedSections.length} قسماً و ${extractedSections.reduce((acc, s) => acc + s.students.length, 0)} تلميذاً مع أرقام مسار!`);
        }
      } catch (err: any) {
        console.error('Error parsing file:', err);
        setParseError('حدث خطأ أثناء قراءة الملف. يرجى التأكد من أنه ملف Excel أو CSV صالح.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setParseError('فشل قراءة الملف.');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  // Extract student names, numbers & Massar numbers from 2D array
  // Follows exact institutional structure:
  // - skiprows=10: Rows 1-10 are institution headers & meta (ignored)
  // - Row 11+ (0-indexed 10+): Data rows
  // - Column A (idx 0): Student number (رقم التلميذ num) starting from 1
  // - Column B (idx 1): Massar code / رقم مسار
  // - Column C (idx 2): Family name / النسب (nasab)
  // - Column D (idx 3): First name / الاسم (ism)
  // - Full name: f"{ism} {nasab}".strip()
  function extractStudentsFromRows(rows: any[][]): Array<{ name: string; number?: string; massarNumber?: string }> {
    if (!rows || rows.length === 0) return [];

    // 1. Direct pandas-like skiprows=10 parsing for Moroccan institutional files
    if (rows.length > 10) {
      const candidates: Array<{ name: string; number?: string; massarNumber?: string }> = [];

      for (let r = 10; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row)) continue;

        const rawNum = row[0] !== undefined && row[0] !== null ? row[0] : '';
        const massar = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
        const nasab = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : '';
        const ism = row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '';

        // Check if header row happens to be at index 10
        if (
          massar.includes('مسار') || massar.includes('Massar') || massar.includes('massar') ||
          nasab.includes('النسب') || nasab.includes('Nom') || nasab.includes('nom') ||
          ism.includes('الاسم') || ism.includes('Prénom') || ism.includes('prenom') ||
          String(rawNum).includes('رقم') || String(rawNum).includes('N°')
        ) {
          continue;
        }

        // if pd.isna(num) or (pd.isna(nasab) and pd.isna(ism)): continue
        const numStr = String(rawNum).trim();
        if (!numStr || (!nasab && !ism)) {
          continue;
        }

        // Parse integer number (e.g. 1 from 1.0)
        let numParsed = numStr;
        const numVal = Number(rawNum);
        if (!isNaN(numVal) && isFinite(numVal)) {
          numParsed = String(Math.floor(numVal));
        }

        // full_name = f"{ism} {nasab}".strip()
        const fullName = [ism, nasab].filter(Boolean).join(' ').trim();
        if (fullName && fullName.length >= 2) {
          candidates.push({
            name: fullName,
            number: numParsed || String(candidates.length + 1),
            massarNumber: massar
          });
        }
      }

      if (candidates.length > 0) {
        // Default ordering by sequential student number starting from 1
        candidates.sort((a, b) => {
          const numA = parseInt(a.number || '0', 10);
          const numB = parseInt(b.number || '0', 10);
          if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) {
            return numA - numB;
          }
          return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
        });
        return candidates;
      }
    }

    // 2. Fallback: Dynamic column header detection for non-standard spreadsheets
    let headerRowIndex = -1;
    let nameCol = -1;
    let numCol = -1;
    let massarCol = 1; // Default to Column B
    let lastNameCol = -1;
    let firstNameCol = -1;

    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;

      let foundName = -1;
      let foundNum = -1;
      let foundMassar = -1;
      let foundLastName = -1;
      let foundFirstName = -1;

      row.forEach((h: any, idx: number) => {
        const val = String(h || '').toLowerCase().trim();
        if (val.includes('مسار') || val.includes('massar') || val.includes('cne')) {
          foundMassar = idx;
        } else if (val.includes('نسب') || val.includes('عائلي') || val.includes('nom')) {
          foundLastName = idx;
        } else if (val.includes('شخصي') || val.includes('prénom') || val.includes('prenom')) {
          foundFirstName = idx;
        } else if (
          val.includes('اسم') ||
          val.includes('الاسم') ||
          val.includes('name') ||
          val.includes('تلميذ') ||
          val.includes('eleve')
        ) {
          foundName = idx;
        }

        if (
          val.includes('رقم') ||
          val.includes('الرقم') ||
          val.includes('id') ||
          val.includes('number') ||
          val.includes('matricule') ||
          val.includes('code') ||
          val.includes('ترتيب') ||
          val.includes('n°')
        ) {
          foundNum = idx;
        }
      });

      if (foundLastName !== -1 && foundFirstName !== -1) {
        headerRowIndex = r;
        lastNameCol = foundLastName;
        firstNameCol = foundFirstName;
        numCol = foundNum !== -1 ? foundNum : 0;
        if (foundMassar !== -1) massarCol = foundMassar;
        break;
      } else if (foundName !== -1) {
        headerRowIndex = r;
        nameCol = foundName;
        numCol = foundNum !== -1 ? foundNum : (foundName === 0 ? 1 : 0);
        if (foundMassar !== -1) massarCol = foundMassar;
        break;
      }
    }

    const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
    const fallbackStudents: Array<{ name: string; number?: string; massarNumber?: string }> = [];

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;

      let fullName = '';
      if (lastNameCol !== -1 && firstNameCol !== -1) {
        const last = row[lastNameCol] ? String(row[lastNameCol]).trim() : '';
        const first = row[firstNameCol] ? String(row[firstNameCol]).trim() : '';
        fullName = [last, first].filter(Boolean).join(' ').trim();
      } else if (nameCol !== -1 && row[nameCol]) {
        fullName = String(row[nameCol]).trim();
      } else if (row[2] && row[3]) {
        // Direct fallback to C + D
        fullName = `${String(row[2]).trim()} ${String(row[3]).trim()}`.trim();
      } else if (row[0]) {
        fullName = String(row[0]).trim();
      }

      if (!fullName || fullName.length < 2) continue;

      const rawNum = numCol !== -1 && row[numCol] !== undefined && row[numCol] !== null
        ? String(row[numCol]).trim()
        : String(fallbackStudents.length + 1);

      const massarVal = massarCol !== -1 && row[massarCol] !== undefined && row[massarCol] !== null
        ? String(row[massarCol]).trim()
        : '';

      fallbackStudents.push({
        name: fullName,
        number: rawNum,
        massarNumber: massarVal
      });
    }

    // Default ordering by sequential student number starting from 1
    fallbackStudents.sort((a, b) => {
      const numA = parseInt(a.number || '0', 10);
      const numB = parseInt(b.number || '0', 10);
      if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) return numA - numB;
      return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
    });

    return fallbackStudents;
  }

  // Extract when section column is present
  function extractStudentsWithSectionCol(
    rows: any[][],
    sectionCol: number,
    detectedHeaderRow = -1
  ): Array<{ sectionName: string; student: { name: string; number?: string; massarNumber?: string } }> {
    const headerRowIdx = detectedHeaderRow !== -1 ? detectedHeaderRow : 0;
    const header = rows[headerRowIdx] || [];
    let nameCol = -1;
    let numCol = -1;
    let massarCol = 1; // Default to Column B
    let lastNameCol = -1;
    let firstNameCol = -1;

    header.forEach((h: any, idx: number) => {
      if (idx === sectionCol) return;
      const val = String(h || '').toLowerCase().trim();
      if (val.includes('مسار') || val.includes('massar') || val.includes('cne')) {
        massarCol = idx;
      } else if (val.includes('نسب') || val.includes('عائلي') || val.includes('nom')) {
        lastNameCol = idx;
      } else if (val.includes('شخصي') || val.includes('prénom') || val.includes('prenom')) {
        firstNameCol = idx;
      } else if (
        val.includes('اسم') ||
        val.includes('الاسم') ||
        val.includes('name') ||
        val.includes('تلميذ')
      ) {
        nameCol = idx;
      }
      if (
        val.includes('رقم') ||
        val.includes('الرقم') ||
        val.includes('id') ||
        val.includes('number') ||
        val.includes('matricule')
      ) {
        numCol = idx;
      }
    });

    if (lastNameCol === -1 && firstNameCol === -1 && nameCol === -1) {
      nameCol = sectionCol === 0 ? 1 : 0;
    }

    const list: Array<{ sectionName: string; student: { name: string; number?: string; massarNumber?: string } }> = [];
    const startIdx = headerRowIdx + 1;

    for (let r = startIdx; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const rawSec = row[sectionCol] ? String(row[sectionCol]).trim() : 'قسم عام';

      let rawName = '';
      if (lastNameCol !== -1 && firstNameCol !== -1) {
        const last = row[lastNameCol] ? String(row[lastNameCol]).trim() : '';
        const first = row[firstNameCol] ? String(row[firstNameCol]).trim() : '';
        rawName = [last, first].filter(Boolean).join(' ').trim();
      } else if (nameCol !== -1 && row[nameCol]) {
        rawName = String(row[nameCol]).trim();
      } else if (row[2] && row[3]) {
        rawName = `${String(row[2]).trim()} ${String(row[3]).trim()}`.trim();
      }

      if (!rawName || rawName.length < 2) continue;

      const rawNum = numCol !== -1 && row[numCol] !== undefined && row[numCol] !== null
        ? String(row[numCol]).trim()
        : String(r);

      const massarVal = massarCol !== -1 && row[massarCol] !== undefined && row[massarCol] !== null
        ? String(row[massarCol]).trim()
        : '';

      list.push({
        sectionName: rawSec,
        student: { name: rawName, number: rawNum, massarNumber: massarVal }
      });
    }

    return list;
  }

  // Parse title like "الأولى إعدادي 1" or "3/2" or "Section 4"
  function parseSectionTitle(str: string): { level: string; classNumber: string } {
    const clean = str.trim();
    // Check if it ends with a number
    const match = clean.match(/^(.*?)[-_\s/]+(\d+)$/);
    if (match) {
      return {
        level: match[1].trim() || 'القسم',
        classNumber: match[2].trim()
      };
    }

    // If pure number
    if (/^\d+$/.test(clean)) {
      return { level: 'القسم', classNumber: clean };
    }

    return { level: clean, classNumber: '1' };
  }

  // Submit parsed batch to backend
  const handleConfirmImport = async () => {
    if (parsedSections.length === 0) return;

    setIsProcessing(true);
    try {
      const payload = {
        replaceExisting,
        sections: parsedSections.map((sec) => ({
          ...sec,
          randomizeSeats
        }))
      };

      const res = await fetch('/api/sections/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        onToast(
          `تم بنجاح استيراد ${data.sectionsCount} قسماً وتوزيع ${data.totalStudents} تلميذاً على المقاعد!`
        );
        onImportSuccess();
        onClose();
      } else {
        setParseError(data.error || 'فشل الاستيراد في قاعدة البيانات');
      }
    } catch (err: any) {
      console.error(err);
      setParseError('حدث خطأ في الاتصال بالخادم أثناء حفظ الأقسام');
    } finally {
      setIsProcessing(false);
    }
  };

  // Instant Seed Demo 10 Sections
  const handleSeedDemo = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/sections/seed-10', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onToast('تم إنشاء وتوزيع 10 أقسام كاملة (أكثر من 320 تلميذاً) في قاعدة البيانات!');
        onImportSuccess();
        onClose();
      } else {
        onToast('فشل إنشاء البيانات التجريبية');
      }
    } catch (err) {
      console.error(err);
      onToast('خطأ أثناء إنشاء البيانات');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Sample 10-Sections Excel Template for Download
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const sampleClasses = [
      'الأولى إعدادي 1',
      'الأولى إعدادي 2',
      'الأولى إعدادي 3',
      'الثانية إعدادي 1',
      'الثانية إعدادي 2',
      'الثانية إعدادي 3',
      'الثالثة إعدادي 1',
      'الثالثة إعدادي 2',
      'الثالثة إعدادي 3',
      'الثالثة إعدادي 4'
    ];

    const sampleNames = [
      'محمد العلوي', 'أحمد الإدريسي', 'فاطمة التازي', 'يوسف بنسعيد', 'مريم الفاسي',
      'حمزة العماري', 'خديجة الشريف', 'عمر المنصوري', 'زينب الصالحي', 'إبراهيم الزروالي',
      'سارة أيت علي', 'ياسين بوشعيب', 'سلمى اليعقوبي', 'أيوب البركة', 'هبة الراجي',
      'علي الهلالي', 'نور الداودي', 'معاذ السباعي', 'دعاء الناصري', 'طارق الحداد',
      'ريان النجار', 'وئام المتوكل', 'خالد بنجلون', 'إكرام السلاوي', 'آية المرابط',
      'سليمان الصنهاجي', 'هاجر المرنيسي', 'هشام الشاوي', 'حفصة الصقلي', 'سعد الوردي'
    ];

    sampleClasses.forEach((className, cIdx) => {
      // Create Moroccan official structure:
      // Rows 1-10: Header & School info
      // Row 10: Column headers
      // Row 11+: Student data
      const sheetData: any[][] = [];

      // Rows 1-9: Administrative headings
      sheetData.push(['المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة']);
      sheetData.push(['الأكاديمية الجهوية للتربية والتكوين']);
      sheetData.push(['المديرية الإقليمية']);
      sheetData.push(['الثانوية الإعدادية']);
      sheetData.push([`لائحة تلاميذ القسم: ${className}`]);
      sheetData.push(['الموسم الدراسي: 2024 / 2025']);
      sheetData.push(['']);
      sheetData.push(['']);
      sheetData.push(['']);

      // Row 10 (index 9): Header row
      sheetData.push(['رقم التلميذ', 'رقم مسار (Massar)', 'النسب', 'الاسم']);

      // Row 11+ (index 10+): Student data
      const surnames = ['العلوي', 'الإدريسي', 'التازي', 'بنسعيد', 'الفاسي', 'العماري', 'الشريف', 'المنصوري', 'الصالحي', 'الزروالي', 'أيت علي', 'بوشعيب', 'اليعقوبي', 'البركة', 'الراجي', 'الهلالي', 'الداودي', 'السباعي', 'الناصري', 'الحداد', 'النجار', 'المتوكل', 'بنجلون', 'السلاوي', 'المرابط', 'الصنهاجي', 'المرنيسي', 'الشاوي', 'الصقلي', 'الوردي'];
      const firstnames = ['محمد', 'أحمد', 'فاطمة', 'يوسف', 'مريم', 'حمزة', 'خديجة', 'عمر', 'زينب', 'إبراهيم', 'سارة', 'ياسين', 'سلمى', 'أيوب', 'هبة', 'علي', 'نور', 'معاذ', 'دعاء', 'طارق', 'ريان', 'وئام', 'خالد', 'إكرام', 'آية', 'سليمان', 'هاجر', 'هشام', 'حفصة', 'سعد'];

      const count = 26 + (cIdx % 5);
      for (let i = 0; i < count; i++) {
        sheetData.push([
          i + 1,                                        // Column A: رقم التلميذ (يبدأ دائماً من 1)
          `G${130000000 + (cIdx + 1) * 1000 + i + 1}`,  // Column B: رقم مسار ابتداءً من السطر 11
          surnames[i % surnames.length],                // Column C: النسب
          firstnames[i % firstnames.length]             // Column D: الاسم
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      // set column widths
      ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws, className);
    });

    XLSX.writeFile(wb, 'نموذج_أقسام_المؤسسة_10_أقسام_مع_مسار.xlsx');
    onToast('تم تحميل نموذج Excel لـ 10 أقسام مع أرقام مسار بنجاح');
  };

  const totalStudentsCount = parsedSections.reduce((acc, s) => acc + s.students.length, 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal max-w-3xl w-full"
        style={{ maxWidth: '780px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-head flex items-center justify-between border-b border-white/15 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#F2EFE3] m-0">
                استيراد شامل للأقسام والتلاميذ (Excel / CSV)
              </h3>
              <p className="text-xs text-[#F2EFE3]/60 m-0">
                يدعم ملفات تحوي 10 أقسام أو أكثر مع التقسيم العشوائي التلقائي على المقاعد
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} title="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body py-4 max-h-[75vh] overflow-y-auto space-y-4">
          {/* Quick Actions Row */}
          <div className="flex items-center justify-between gap-2 p-3 bg-white/5 border border-white/10 rounded-xl flex-wrap">
            <div className="text-xs text-[#F2EFE3]/80">
              <span>💡 لديك ملف جاهز؟ اسحبه بالأسفل، أو حمّل نموذجنا المنسق أو جرّب 10 أقسام تجريبية فوراً:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="btn btn-ghost btn-sm text-xs text-amber-200 border-amber-500/40 hover:bg-amber-500/10 flex items-center gap-1.5"
                title="تحميل نموذج جاهز لـ 10 أقسام بصيغة Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل نموذج 10 أقسام (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={handleSeedDemo}
                disabled={isProcessing}
                className="btn btn-ghost btn-sm text-xs text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 flex items-center gap-1.5"
                title="توليد 10 أقسام تجريبية فوراً بأسماء تلاميذ مغربية وعربية حقيقية"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>توليد 10 أقسام فوراً</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-amber-400 bg-amber-500/15 scale-[0.99]'
                : 'border-white/20 bg-white/5 hover:border-amber-400/60 hover:bg-white/10'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-[#F2EFE3]">
                {fileName ? `الملف المحدد: ${fileName}` : 'انقر لاختيار ملف Excel أو اسحبه وأفلته هنا'}
              </div>
              <p className="text-xs text-[#F2EFE3]/60 max-w-md">
                متوافق تلقائياً مع جداول لوائح التلاميذ (تجاهل الصفوف 1-10، قراءة البيانات من الصف 11: رقم التلميذ عمود A، النسب عمود C، الاسم عمود D). كما يدعم ملفات الأقسام المتعددة.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {parseError && (
            <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-xl flex items-center gap-2 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Validation Warnings (Check Rule: First student must be #1) */}
          {validationWarnings.length > 0 && (
            <div className="p-3.5 bg-amber-950/60 border border-amber-500/60 rounded-xl space-y-1.5 text-xs text-amber-200">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>ملاحظات التحقق من صحة القراءة (رقم التلميذ الأول ≠ 1):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pr-2 text-amber-200/90 text-[11px]">
                {validationWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
              <p className="text-[10px] text-amber-300/80 pt-1 border-t border-amber-500/30">
                تنبيه: يجب أن يبدأ التلميذ الأول دائماً بالرقم 1 في الصف 11. يرجى التأكد من عدم وجود أسطر رأسية إضافية في تلك الأوراق.
              </p>
            </div>
          )}

          {validationWarnings.length === 0 && parsedSections.length > 0 && (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>تم التحقق بنجاح: أول تلميذ في جميع الأقسام رقمه = 1، وتوزيع الأوراق والأعمدة مطابق للمواصفات.</span>
            </div>
          )}

          {/* Parsing Results Preview */}
          {parsedSections.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm text-[#F2EFE3]">
                    تم العثور على {parsedSections.length} أقسام بإجمالي {totalStudentsCount} تلميذاً
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setParsedSections([]);
                    setFileName('');
                  }}
                  className="text-xs text-white/50 hover:text-white"
                >
                  إعادة الاختيار
                </button>
              </div>

              {/* Sections Badges List */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {parsedSections.map((sec, sIdx) => (
                  <div
                    key={sIdx}
                    onClick={() =>
                      setExpandedSecIndex(expandedSecIndex === sIdx ? null : sIdx)
                    }
                    className={`p-2.5 rounded-lg border text-right cursor-pointer transition-all ${
                      expandedSecIndex === sIdx
                        ? 'border-amber-400 bg-amber-500/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#F2EFE3] truncate">
                      {sec.level} - {sec.classNumber}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#F2EFE3]/70 mt-1">
                      <span>{sec.students.length} تلميذاً</span>
                      <span className="text-amber-300">
                        {sec.students.length <= 40 ? '✓ مناسب' : '⚠️ > 40'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded Student Preview */}
              {expandedSecIndex !== null && parsedSections[expandedSecIndex] && (
                <div className="p-3 bg-black/30 border border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-200">
                    <span>
                      معاينة تلاميذ: {parsedSections[expandedSecIndex].level} - القسم {parsedSections[expandedSecIndex].classNumber} ({parsedSections[expandedSecIndex].students.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedSecIndex(null)}
                      className="text-white/60 hover:text-white"
                    >
                      ✕ إغلاق
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-xs text-[#F2EFE3]/80">
                    {parsedSections[expandedSecIndex].students.map((st, i) => (
                      <div key={i} className="p-1.5 bg-white/5 rounded px-2 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-amber-400 font-mono font-bold text-[11px]">#{st.number || i + 1}</span>
                          <span className="truncate">{st.name}</span>
                        </div>
                        {st.massarNumber && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono shrink-0 border border-emerald-500/30" title={`رقم مسار: ${st.massarNumber}`}>
                            {st.massarNumber}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options Box */}
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 m-0">
                  <Shuffle className="w-4 h-4" />
                  <span>خيارات التوزيع والمقاعد</span>
                </h4>

                <label className="flex items-center gap-2 text-xs text-[#F2EFE3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomizeSeats}
                    onChange={(e) => setRandomizeSeats(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span>
                    <b>توزيع عشوائي على المقاعد</b> (الوضع الافتراضي غير مفعل: يتم توزيع التلاميذ ترتيبياً حسب أرقامهم ابتداءً من المقعد 1).
                  </span>
                </label>

                <div className="pt-2 border-t border-white/10 flex items-center gap-4 text-xs text-[#F2EFE3]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={replaceExisting}
                      onChange={() => setReplaceExisting(true)}
                      className="accent-amber-500"
                    />
                    <span>استبدال كافة الأقسام الحالية (تحديث شامل)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={!replaceExisting}
                      onChange={() => setReplaceExisting(false)}
                      className="accent-amber-500"
                    />
                    <span>إضافة كأقسام جديدة (مع الحفاظ على الأقسام الحالية)</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-foot flex items-center justify-between border-t border-white/15 pt-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isProcessing}
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={parsedSections.length === 0 || isProcessing}
            className="btn btn-primary flex items-center gap-2 px-5 py-2.5 font-bold"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ والتوزيع في قاعدة البيانات...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  تأكيد واستيراد {parsedSections.length > 0 ? `(${parsedSections.length} قسم)` : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
