import { NoteItem, StudentViolationRecord, PositiveParticipationItem } from '../types';

export interface PrintViolationsOptions {
  institution: string;
  academicYear: string;
  level: string;
  classNumber: string;
  teacherName?: string;
  subject?: string;
  studentName: string;
  seatNum: number;
  studentNumber?: string;
  massarNumber?: string;
  violations?: (StudentViolationRecord | NoteItem)[];
  notes?: NoteItem[];
}

/**
 * Standard Official Moroccan Header for all printable documents across the system.
 */
export function buildOfficialMoroccanHeaderHtml(options: {
  institution?: string;
  academicYear?: string;
  date?: string;
  time?: string;
  dateLabel?: string;
  middleIcon?: string;
}): string {
  const inst = options.institution || 'الثانوية الإعدادية ايكسان';
  const year = options.academicYear || '2026/2027';
  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const dStr = options.date || `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const tStr = options.time || `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  const dLabel = options.dateLabel || 'تاريخ الاستخراج';
  const icon = options.middleIcon || '🏛️';

  return `
    <table class="header-table">
      <tr>
        <td style="width: 38%; text-align: right;" class="official-head">
          المملكة المغربية<br>
          وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
          <b>${escapeHtml(inst)}</b>
        </td>
        <td style="width: 24%; text-align: center;">
          <div style="font-size: 24px; color: #854d0e;">${icon}</div>
          <div style="font-size: 11px; font-weight: bold; color: #1E3B2C; direction: ltr; font-family: monospace; margin-top: 3px;">www.lyceecom.com</div>
        </td>
        <td style="width: 38%; text-align: left;" class="official-head">
          الموسم الدراسي: <b>${escapeHtml(year)}</b><br>
          ${escapeHtml(dLabel)}: <b>${escapeHtml(dStr)}</b><br>
          الساعة: <b>${escapeHtml(tStr)} (GMT)</b>
        </td>
      </tr>
    </table>
  `;
}

export const OFFICIAL_HEADER_CSS = `
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #854d0e;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .header-table td {
      vertical-align: middle;
      border: none;
    }
    .official-head {
      font-size: 12px;
      line-height: 1.6;
      color: #333;
    }
    .official-head b {
      font-size: 13px;
      color: #854d0e;
    }
    .doc-title-box {
      text-align: center;
      margin: 15px 0 20px 0;
    }
    .doc-title {
      display: inline-block;
      font-size: 20px;
      font-weight: bold;
      color: #991b1b;
      background: #fef2f2;
      border: 1.5px solid #dc2626;
      border-radius: 30px;
      padding: 6px 32px;
      margin: 0 0 6px 0;
    }
    .doc-sub {
      font-size: 12px;
      color: #666;
    }
`;

export function printViolationsReport(options: PrintViolationsOptions): boolean {
  const {
    institution,
    academicYear,
    level,
    classNumber,
    teacherName,
    subject,
    studentName,
    seatNum,
    studentNumber,
    massarNumber,
    violations,
    notes
  } = options;

  const actualViolations = (violations && violations.length > 0) ? violations : (notes || []);

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const printDate = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const printTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  const violationsHtml =
    actualViolations.length === 0
      ? `<tr><td colspan="7" style="text-align:center; padding: 24px; color: #15803d; font-weight: bold; background: #f0fdf4;">✓ لا توجد أي مخالفات مسجلة في ملف هذا التلميذ(ة) حتى تاريخ إصدار هذه الوثيقة (انضباط تام وسلوك حسن).</td></tr>`
      : actualViolations
          .map((v: any, idx) => {
            const vType = v.violationType || v.text || 'مخالفة تربوية';
            const vDate = v.recordedDate || v.date || printDate;
            const vTime = v.recordedTime || v.time || printTime;
            const vTeacher = v.teacherName || teacherName || 'أستاذ المادة';
            const vSubject = v.teacherSubject || subject || 'عام';
            const vAction = v.actionTaken || 'تنبيه شفهي';

            return `
          <tr>
            <td style="text-align: center; font-weight: bold; width: 35px; font-family: monospace;">${idx + 1}</td>
            <td style="padding: 10px 12px; font-size: 13.5px; font-weight: bold; color: #991b1b; text-align: right;">${escapeHtml(vType)}</td>
            <td style="text-align: center; width: 105px; font-family: monospace; font-size: 13px; font-weight: bold;">${vDate}</td>
            <td style="text-align: center; width: 75px; font-family: monospace; font-size: 13px;">${vTime}</td>
            <td style="text-align: center; width: 130px; font-size: 12.5px; font-weight: 600;">${escapeHtml(vTeacher)}</td>
            <td style="text-align: center; width: 100px; font-size: 12px; color: #4b5563;">${escapeHtml(vSubject)}</td>
            <td style="text-align: center; width: 110px; font-size: 12px; font-weight: bold; color: #1e3a8a;">${escapeHtml(vAction)}</td>
          </tr>
        `;
          })
          .join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>بطاقة تسجيل المخالفات والانضباط — ${escapeHtml(studentName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Tajawal', 'Traditional Arabic', Arial, sans-serif;
      color: #1a1a1a;
      background: #fff;
      margin: 0;
      padding: 0;
      direction: rtl;
      font-size: 13px;
    }
    .print-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 10px;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #854d0e;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .header-table td {
      vertical-align: middle;
    }
    .official-head {
      font-size: 12px;
      line-height: 1.6;
      color: #333;
    }
    .official-head b {
      font-size: 13px;
      color: #854d0e;
    }
    .doc-title-box {
      text-align: center;
      margin: 15px 0 20px 0;
    }
    .doc-title {
      display: inline-block;
      font-size: 20px;
      font-weight: bold;
      color: #991b1b;
      background: #fef2f2;
      border: 1.5px solid #dc2626;
      border-radius: 30px;
      padding: 6px 32px;
      margin: 0 0 6px 0;
    }
    .doc-sub {
      font-size: 12px;
      color: #666;
    }
    .info-card {
      background: #FAF8F5;
      border: 1.5px solid #D5CDC0;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 22px;
    }
    .info-grid {
      width: 100%;
      border-collapse: collapse;
    }
    .info-grid td {
      padding: 6px 8px;
      font-size: 13.5px;
      vertical-align: middle;
    }
    .info-label {
      color: #555;
      font-weight: 600;
      width: 15%;
    }
    .info-val {
      color: #111;
      font-weight: bold;
      width: 35%;
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      background: #854d0e;
      color: #fff;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    .massar-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #1e3a8a;
      color: #fff;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      font-weight: bold;
    }
    .notes-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 30px;
    }
    .notes-table th {
      background: #991b1b;
      color: #fff;
      padding: 9px 10px;
      font-size: 12.5px;
      border: 1px solid #7f1d1d;
      text-align: center;
    }
    .notes-table td {
      border: 1px solid #D5CDC0;
      padding: 8px 10px;
      vertical-align: middle;
    }
    .notes-table tr:nth-child(even) td {
      background: #FAF8F5;
    }
    .signatures-table {
      width: 100%;
      margin-top: 40px;
      border-collapse: collapse;
    }
    .signatures-table td {
      width: 50%;
      text-align: center;
      vertical-align: top;
      padding: 10px;
    }
    .sig-title {
      font-weight: bold;
      font-size: 13px;
      color: #1f2937;
      margin-bottom: 60px;
    }
    .footer-bar {
      margin-top: 35px;
      padding-top: 12px;
      border-top: 1px dashed #ccc;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${buildOfficialMoroccanHeaderHtml({
      institution,
      academicYear,
      date: printDate,
      time: printTime,
      dateLabel: 'تاريخ الاستخراج'
    })}

    <div class="doc-title-box">
      <div class="doc-title">بطاقة تتبع المخالفات والانضباط المدرسي</div>
      <div class="doc-sub">سجل رسمي لمتابعة سلوك وانضباط التلميذ(ة) داخل الحصص الدراسية</div>
    </div>

    <div class="info-card">
      <table class="info-grid">
        <tr>
          <td class="info-label">اسم التلميذ(ة):</td>
          <td class="info-val" style="font-size: 16px; color: #991b1b;">${escapeHtml(studentName || 'غير مسجل')}</td>
          <td class="info-label">مكان الجلوس (المقعد):</td>
          <td class="info-val"><span class="badge">مقعد #${seatNum}</span></td>
        </tr>
        <tr>
          <td class="info-label">المستوى والقسم:</td>
          <td class="info-val">${escapeHtml(level || '')} (${escapeHtml(classNumber || '')})</td>
          <td class="info-label">رقم التلميذ في القسم:</td>
          <td class="info-val" style="font-family: monospace; font-size: 14px;">${escapeHtml(studentNumber || '—')}</td>
        </tr>
        <tr>
          <td class="info-label">رقم مسار / البطاقة:</td>
          <td class="info-val"><span class="massar-badge">${escapeHtml(massarNumber || '—')}</span></td>
          <td class="info-label">إجمالي المخالفات:</td>
          <td class="info-val" style="color: #b91c1c; font-size: 15px;">${actualViolations.length} مخالفة</td>
        </tr>
      </table>
    </div>

    <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #991b1b;">
      ⚠️ سجل المخالفات السلوكية المسجلة (${actualViolations.length}):
    </div>

    <table class="notes-table">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>نوع المخالفة المرتكبة</th>
          <th style="width: 105px;">التاريخ</th>
          <th style="width: 75px;">التوقيت</th>
          <th style="width: 130px;">الأستاذ المسجل</th>
          <th style="width: 100px;">المادة</th>
          <th style="width: 110px;">الإجراء المتخذ</th>
        </tr>
      </thead>
      <tbody>
        ${violationsHtml}
      </tbody>
    </table>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="sig-title">توقيع الأستاذ(ة) المسجل(ة)</div>
          <div style="color: #666; font-size: 12px;">${escapeHtml(teacherName || 'أستاذ المادة')}</div>
        </td>
        <td>
          <div class="sig-title">خاتم وتأشيرة الإدارة التربوية</div>
          <div style="color: #666; font-size: 12px;">مدير المؤسسة / الحراسة العامة</div>
        </td>
      </tr>
    </table>

    <div class="footer-bar">
      <span>منظومة خرائط الأقسام • ${escapeHtml(institution || 'الثانوية الإعدادية ايكسان')} • الموقع الرسمي: www.lyceecom.com</span>
      <span>التواريخ والأوقات مسجلة رسمياً بالأرقام الفرنسية</span>
    </div>
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
</html>`;

  return printReportHtml(html);
}

// Keep printNotesReport as alias for backwards compatibility
export const printNotesReport = printViolationsReport;

export interface PrintBatchViolationsOptions {
  institution: string;
  academicYear: string;
  sectionTitle: string; // e.g. "جميع الأقسام" or "الثانية إعدادي 3"
  dateFilterText?: string;
  violations: Array<{
    id?: string;
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
}

export function printAllViolationsReport(options: PrintBatchViolationsOptions): boolean {
  const { institution, academicYear, sectionTitle, dateFilterText, violations } = options;

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const printDate = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const printTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  const rowsHtml = violations.length === 0
    ? `<tr><td colspan="8" style="text-align:center; padding: 24px; color: #15803d; font-weight: bold; background: #f0fdf4;">✓ لا توجد أي مخالفات مسجلة مطابقة لمعايير البحث المحددة (السجل سليم تماماً).</td></tr>`
    : violations.map((v, idx) => {
        const sec = v.sectionName || (v.level && v.classNumber ? `${v.level} (${v.classNumber})` : '—');
        const vDate = v.recordedDate || v.date || printDate;
        const vTime = v.recordedTime || v.time || '—';
        const teacher = v.teacherName ? `${v.teacherName} ${v.teacherSubject ? `(${v.teacherSubject})` : ''}` : 'أستاذ المادة';
        const action = v.actionTaken || 'تنبيه شفهي';

        return `
          <tr>
            <td style="text-align: center; font-weight: bold; width: 35px; font-family: monospace;">${idx + 1}</td>
            <td style="padding: 8px 10px; font-size: 13px; font-weight: bold; color: #111;">${escapeHtml(v.studentName)}</td>
            <td style="text-align: center; font-family: monospace; font-size: 12.5px; font-weight: bold; color: #1e3a8a;">${escapeHtml(v.massarNumber || '—')}</td>
            <td style="text-align: center; font-size: 12.5px; font-weight: 600; color: #047857;">${escapeHtml(sec)}</td>
            <td style="padding: 8px 10px; font-size: 13px; font-weight: bold; color: #991b1b;">${escapeHtml(v.violationType)}</td>
            <td style="text-align: center; font-family: monospace; font-size: 12px;">${vDate} ${vTime !== '—' ? `<span style="color:#666">(${vTime})</span>` : ''}</td>
            <td style="text-align: center; font-size: 12px; color: #374151;">${escapeHtml(teacher)}</td>
            <td style="text-align: center; font-size: 12px; font-weight: bold; color: #b45309;">${escapeHtml(action)}</td>
          </tr>
        `;
      }).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>لائحة المخالفات والانضباط المدرسي — ${escapeHtml(sectionTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Tajawal', 'Traditional Arabic', Arial, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 0; direction: rtl; font-size: 12.5px; }
    .print-container { max-width: 100%; margin: 0 auto; padding: 8px; }
    .header-table { width: 100%; border-bottom: 2px solid #854d0e; padding-bottom: 10px; margin-bottom: 14px; }
    .official-head { font-size: 12px; line-height: 1.5; color: #333; }
    .official-head b { font-size: 13px; color: #854d0e; }
    .doc-title-box { text-align: center; margin: 10px 0 16px 0; }
    .doc-title { display: inline-block; font-size: 19px; font-weight: bold; color: #991b1b; background: #fef2f2; border: 1.5px solid #dc2626; border-radius: 25px; padding: 5px 30px; margin: 0 0 4px 0; }
    .doc-sub { font-size: 12px; color: #555; }
    .summary-cards { display: flex; gap: 12px; margin-bottom: 16px; justify-content: center; }
    .scard { background: #FAF8F5; border: 1px solid #D5CDC0; border-radius: 8px; padding: 8px 16px; text-align: center; }
    .scard-num { font-size: 18px; font-weight: bold; color: #991b1b; font-family: monospace; }
    .scard-label { font-size: 11px; color: #666; font-weight: 600; }
    .table-main { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 25px; }
    .table-main th { background: #991b1b; color: #fff; padding: 8px; font-size: 12px; border: 1px solid #7f1d1d; text-align: center; }
    .table-main td { border: 1px solid #D5CDC0; padding: 6px 8px; vertical-align: middle; }
    .table-main tr:nth-child(even) td { background: #FAF8F5; }
    .signatures-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
    .signatures-table td { width: 50%; text-align: center; vertical-align: top; padding: 8px; }
    .sig-title { font-weight: bold; font-size: 12.5px; color: #1f2937; margin-bottom: 50px; }
    .footer-bar { margin-top: 25px; padding-top: 10px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 10.5px; color: #777; }
  </style>
</head>
<body>
  <div class="print-container">
    ${buildOfficialMoroccanHeaderHtml({
      institution,
      academicYear,
      date: printDate,
      time: printTime,
      dateLabel: 'تاريخ الاستخراج'
    })}

    <div class="doc-title-box">
      <div class="doc-title">سجل ولائحة المخالفات السلوكية الرسمية</div>
      <div class="doc-sub">نطاق التقرير: <strong>${escapeHtml(sectionTitle)}</strong> ${dateFilterText ? `• الفترة: <strong>${escapeHtml(dateFilterText)}</strong>` : ''}</div>
    </div>

    <div class="summary-cards">
      <div class="scard">
        <div class="scard-num">${violations.length}</div>
        <div class="scard-label">إجمالي المخالفات المسجلة</div>
      </div>
      <div class="scard">
        <div class="scard-num">${new Set(violations.map(v => v.studentName)).size}</div>
        <div class="scard-label">عدد التلاميذ المعنيين</div>
      </div>
      <div class="scard">
        <div class="scard-num" style="color:#047857;">${sectionTitle}</div>
        <div class="scard-label">القسم المستهدف</div>
      </div>
    </div>

    <table class="table-main">
      <thead>
        <tr>
          <th style="width: 35px;">#</th>
          <th>اسم التلميذ(ة)</th>
          <th style="width: 100px;">رقم مسار</th>
          <th style="width: 110px;">القسم والمستوى</th>
          <th>نوع المخالفة</th>
          <th style="width: 125px;">التاريخ والتوقيت</th>
          <th style="width: 130px;">الأستاذ / المادة</th>
          <th style="width: 105px;">الإجراء المتخذ</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="sig-title">توقيع الحراسة العامة للخارجية</div>
        </td>
        <td>
          <div class="sig-title">تأشيرة وخاتم السيد مدير المؤسسة</div>
        </td>
      </tr>
    </table>

    <div class="footer-bar">
      <span>منظومة خرائط الأقسام وإدارة المؤسسة • ${escapeHtml(institution || 'الثانوية الإعدادية ايكسان')} • الموقع الرسمي: www.lyceecom.com</span>
      <span>وثيقة إدارية رسمية مستخرجة آلياً</span>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 300);
    };
  </script>
</body>
</html>`;

  return deliverPrintHtml(html);
}

export interface PrintAbsencesOptions {
  institution: string;
  academicYear: string;
  sectionTitle: string; // e.g. "جميع الأقسام" or "الثالثة إعدادي 1"
  dateFilterText?: string;
  absences: Array<{
    id?: string | number;
    sectionName?: string;
    level?: string;
    classNumber?: string;
    studentName: string;
    studentNumber?: string;
    massarNumber?: string;
    status?: string; // 'absent' | 'late'
    date?: string;
    time?: string;
    session?: string;
    teacherName?: string;
    subject?: string;
    isJustified?: boolean;
    justificationReason?: string;
  }>;
}

export function printAbsencesReport(options: PrintAbsencesOptions): boolean {
  const { institution, academicYear, sectionTitle, dateFilterText, absences } = options;

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const printDate = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const printTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  const rowsHtml = absences.length === 0
    ? `<tr><td colspan="8" style="text-align:center; padding: 24px; color: #15803d; font-weight: bold; background: #f0fdf4;">✓ لا توجد أي حالات غياب مسجلة مطابقة لمعايير البحث المحددة (المواظبة تامة والحضور كامل).</td></tr>`
    : absences.map((a, idx) => {
        const sec = a.sectionName || (a.level && a.classNumber ? `${a.level} (${a.classNumber})` : '—');
        const aDate = a.date || printDate;
        const session = a.session || 'الحصة الدراسية';
        const isLate = a.status === 'late';
        const statusBadge = isLate
          ? `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:6px; font-weight:bold;">تأخر</span>`
          : `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-weight:bold;">غياب</span>`;

        const justificationBadge = a.isJustified
          ? `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:6px; font-weight:bold;">مبرر ${a.justificationReason ? `(${escapeHtml(a.justificationReason)})` : ''}</span>`
          : `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:6px; font-weight:bold;">غير مبرر</span>`;

        const teacherInfo = a.teacherName ? `${escapeHtml(a.teacherName)} ${a.subject ? `(${escapeHtml(a.subject)})` : ''}` : '—';

        return `
          <tr>
            <td style="text-align: center; font-weight: bold; width: 35px; font-family: monospace;">${idx + 1}</td>
            <td style="padding: 8px 10px; font-size: 13px; font-weight: bold; color: #111;">${escapeHtml(a.studentName)}</td>
            <td style="text-align: center; font-family: monospace; font-size: 12.5px; font-weight: bold; color: #1e3a8a;">${escapeHtml(a.massarNumber || '—')}</td>
            <td style="text-align: center; font-size: 12.5px; font-weight: 600; color: #047857;">${escapeHtml(sec)}</td>
            <td style="text-align: center; font-family: monospace; font-size: 12px;">${aDate} <div style="color:#666; font-size:11px;">${escapeHtml(session)}</div></td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="text-align: center; font-size: 12px;">${justificationBadge}</td>
            <td style="text-align: center; font-size: 12px; color: #374151;">${teacherInfo}</td>
          </tr>
        `;
      }).join('');

  const totalAbsencesCount = absences.filter(a => a.status !== 'late').length;
  const totalLatesCount = absences.filter(a => a.status === 'late').length;
  const unjustifiedCount = absences.filter(a => !a.isJustified).length;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>لائحة الغياب والمواظبة الرسمية — ${escapeHtml(sectionTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Tajawal', 'Traditional Arabic', Arial, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 0; direction: rtl; font-size: 12.5px; }
    .print-container { max-width: 100%; margin: 0 auto; padding: 8px; }
    .header-table { width: 100%; border-bottom: 2px solid #854d0e; padding-bottom: 10px; margin-bottom: 14px; }
    .official-head { font-size: 12px; line-height: 1.5; color: #333; }
    .official-head b { font-size: 13px; color: #854d0e; }
    .doc-title-box { text-align: center; margin: 10px 0 16px 0; }
    .doc-title { display: inline-block; font-size: 19px; font-weight: bold; color: #854d0e; background: #fefce8; border: 1.5px solid #ca8a04; border-radius: 25px; padding: 5px 30px; margin: 0 0 4px 0; }
    .doc-sub { font-size: 12px; color: #555; }
    .summary-cards { display: flex; gap: 12px; margin-bottom: 16px; justify-content: center; }
    .scard { background: #FAF8F5; border: 1px solid #D5CDC0; border-radius: 8px; padding: 8px 16px; text-align: center; }
    .scard-num { font-size: 18px; font-weight: bold; color: #854d0e; font-family: monospace; }
    .scard-label { font-size: 11px; color: #666; font-weight: 600; }
    .table-main { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 25px; }
    .table-main th { background: #854d0e; color: #fff; padding: 8px; font-size: 12px; border: 1px solid #713f12; text-align: center; }
    .table-main td { border: 1px solid #D5CDC0; padding: 6px 8px; vertical-align: middle; }
    .table-main tr:nth-child(even) td { background: #FAF8F5; }
    .signatures-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
    .signatures-table td { width: 50%; text-align: center; vertical-align: top; padding: 8px; }
    .sig-title { font-weight: bold; font-size: 12.5px; color: #1f2937; margin-bottom: 50px; }
    .footer-bar { margin-top: 25px; padding-top: 10px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 10.5px; color: #777; }
  </style>
</head>
<body>
  <div class="print-container">
    ${buildOfficialMoroccanHeaderHtml({
      institution,
      academicYear,
      date: printDate,
      time: printTime,
      dateLabel: 'تاريخ الاستخراج'
    })}

    <div class="doc-title-box">
      <div class="doc-title">سجل ولائحة تتبع الغياب والمواظبة اليومية</div>
      <div class="doc-sub">نطاق التقرير: <strong>${escapeHtml(sectionTitle)}</strong> ${dateFilterText ? `• الفترة: <strong>${escapeHtml(dateFilterText)}</strong>` : ''}</div>
    </div>

    <div class="summary-cards">
      <div class="scard">
        <div class="scard-num">${totalAbsencesCount}</div>
        <div class="scard-label">إجمالي حالات الغياب</div>
      </div>
      <div class="scard">
        <div class="scard-num" style="color:#b45309;">${totalLatesCount}</div>
        <div class="scard-label">حالات التأخر</div>
      </div>
      <div class="scard">
        <div class="scard-num" style="color:#dc2626;">${unjustifiedCount}</div>
        <div class="scard-label">غير مبرر</div>
      </div>
      <div class="scard">
        <div class="scard-num" style="color:#047857;">${sectionTitle}</div>
        <div class="scard-label">القسم المستهدف</div>
      </div>
    </div>

    <table class="table-main">
      <thead>
        <tr>
          <th style="width: 35px;">#</th>
          <th>اسم التلميذ(ة)</th>
          <th style="width: 100px;">رقم مسار</th>
          <th style="width: 110px;">القسم والمستوى</th>
          <th style="width: 125px;">تاريخ وحصة الغياب</th>
          <th style="width: 80px;">نوع الحالة</th>
          <th style="width: 120px;">التبرير القانوني</th>
          <th style="width: 130px;">الأستاذ / المادة</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="sig-title">توقيع الحراسة العامة للخارجية</div>
        </td>
        <td>
          <div class="sig-title">تأشيرة وخاتم السيد مدير المؤسسة</div>
        </td>
      </tr>
    </table>

    <div class="footer-bar">
      <span>منظومة خرائط الأقسام وإدارة المؤسسة • ${escapeHtml(institution || 'الثانوية الإعدادية ايكسان')} • الموقع الرسمي: www.lyceecom.com</span>
      <span>وثيقة إدارية رسمية مستخرجة آلياً</span>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 300);
    };
  </script>
</body>
</html>`;

  return deliverPrintHtml(html);
}

// Print single violation notice / summons
export interface PrintSingleViolationOptions {
  institution: string;
  academicYear: string;
  level: string;
  classNumber: string;
  teacherName?: string;
  subject?: string;
  studentName: string;
  studentNumber?: string;
  massarNumber?: string;
  violationType: string;
  actionTaken?: string;
  date?: string;
  time?: string;
  notes?: string;
}

export function printSingleViolationNotice(options: PrintSingleViolationOptions): boolean {
  const {
    institution,
    academicYear,
    level,
    classNumber,
    teacherName,
    subject,
    studentName,
    studentNumber,
    massarNumber,
    violationType,
    actionTaken,
    date,
    time,
    notes
  } = options;

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const printDate = date || `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const printTime = time || `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>إشعار بمخالفة انضباطية — ${escapeHtml(studentName)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Tajawal', 'Traditional Arabic', Arial, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 0; direction: rtl; font-size: 13.5px; }
    .print-container { max-width: 100%; margin: 0 auto; border: 2px solid #991b1b; border-radius: 12px; padding: 20px; }
    .header-table { width: 100%; border-bottom: 2px solid #854d0e; padding-bottom: 12px; margin-bottom: 20px; }
    .doc-title-box { text-align: center; margin: 15px 0 25px 0; }
    .doc-title { display: inline-block; font-size: 20px; font-weight: bold; color: #991b1b; background: #fef2f2; border: 2px solid #dc2626; border-radius: 25px; padding: 6px 36px; }
    .notice-card { background: #fafaf9; border: 1.5px solid #e7e5e4; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
    .notice-grid { width: 100%; border-collapse: collapse; }
    .notice-grid td { padding: 8px 10px; font-size: 14px; }
    .label { color: #57534e; font-weight: 600; width: 22%; }
    .val { color: #1c1917; font-weight: bold; }
    .val-highlight { color: #991b1b; font-size: 16px; }
    .warning-box { background: #fff1f2; border: 1.5px dashed #f43f5e; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13px; line-height: 1.7; color: #881337; }
    .signatures-table { width: 100%; margin-top: 40px; border-collapse: collapse; }
    .signatures-table td { width: 33.3%; text-align: center; vertical-align: top; }
    .sig-title { font-weight: bold; font-size: 13px; margin-bottom: 60px; }
    .official-head { font-size: 12px; line-height: 1.6; color: #333; }
    .official-head b { font-size: 13px; color: #854d0e; }
  </style>
</head>
<body>
  <div class="print-container">
    ${buildOfficialMoroccanHeaderHtml({
      institution,
      academicYear,
      date: printDate,
      time: printTime,
      dateLabel: 'تاريخ التحرير',
      middleIcon: '🏛️'
    })}

    <div class="doc-title-box">
      <div class="doc-title">إشعار بارتكاب مخالفة انضباطية واستدعاء ولي الأمر</div>
    </div>

    <div class="notice-card">
      <table class="notice-grid">
        <tr>
          <td class="label">اسم التلميذ(ة):</td>
          <td class="val val-highlight">${escapeHtml(studentName)}</td>
          <td class="label">القسم والمستوى:</td>
          <td class="val">${escapeHtml(level)} (${escapeHtml(classNumber)})</td>
        </tr>
        <tr>
          <td class="label">رقم مسار:</td>
          <td class="val" style="font-family:monospace;">${escapeHtml(massarNumber || '—')}</td>
          <td class="label">رقم التلميذ في القسم:</td>
          <td class="val" style="font-family:monospace;">${escapeHtml(studentNumber || '—')}</td>
        </tr>
        <tr>
          <td class="label">المخالفة المرتكبة:</td>
          <td class="val" style="color: #991b1b; font-size: 15px;">${escapeHtml(violationType)}</td>
          <td class="label">تاريخ وتوقيت المخالفة:</td>
          <td class="val" style="font-family:monospace;">${printDate} — ${printTime}</td>
        </tr>
        <tr>
          <td class="label">الأستاذ(ة) المحرر(ة):</td>
          <td class="val">${escapeHtml(teacherName || 'أستاذ المادة')} ${subject ? `(${escapeHtml(subject)})` : ''}</td>
          <td class="label">الإجراء المتخذ:</td>
          <td class="val" style="color: #b45309;">${escapeHtml(actionTaken || 'تنبيه شفهي')}</td>
        </tr>
        ${notes ? `
        <tr>
          <td class="label">ملاحظات إضافية:</td>
          <td class="val" colspan="3" style="color:#555; font-weight:normal;">${escapeHtml(notes)}</td>
        </tr>` : ''}
      </table>
    </div>

    <div class="warning-box">
      <strong>تنبيه تربوي لولي الأمر الكريم:</strong><br>
      يشهد الطاقم التربوي والإداري للمؤسسة بأن التلميذ(ة) المذكور(ة) أعلاه قد ارتكب(ت) المخالفة الموضحة أعلاه والتي تمس بالسير العادي للدراسة وبالنظام الداخلي للمؤسسة. نرجو منكم الحضور إلى إدارة المؤسسة أو توجيه ابنكم/ابنتكم للالتزام والانضباط وحسن الخلق، صوناً لمصلحته التربوية والتعليمية.
    </div>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="sig-title">توقيع الأستاذ(ة)</div>
          <div style="font-size:12px; color:#666;">${escapeHtml(teacherName || 'أستاذ المادة')}</div>
        </td>
        <td>
          <div class="sig-title">تأشيرة وخاتم إدارة المؤسسة</div>
          <div style="font-size:12px; color:#666;">مدير المؤسسة / الحراسة العامة</div>
        </td>
        <td>
          <div class="sig-title">توقيع ولي الأمر بالعلم والالتزام</div>
          <div style="font-size:12px; color:#666;">(الاسم والتوقيع وتاريخ الاستلام)</div>
        </td>
      </tr>
    </table>

    <div class="footer-bar" style="margin-top: 25px; padding-top: 10px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 10.5px; color: #777;">
      <span>منظومة خرائط الأقسام • ${escapeHtml(institution || 'الثانوية الإعدادية ايكسان')} • الموقع الرسمي: www.lyceecom.com</span>
      <span>وثيقة إدارية رسمية للتتبع السلوكي والتربوي</span>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 300);
    };
  </script>
</body>
</html>`;

  return deliverPrintHtml(html);
}

// Generate formatted WhatsApp text and trigger WhatsApp
export function shareViolationViaWhatsApp(data: {
  institution: string;
  studentName: string;
  level: string;
  classNumber: string;
  massarNumber?: string;
  violationType: string;
  date?: string;
  time?: string;
  teacherName?: string;
  subject?: string;
  actionTaken?: string;
  phoneNumber?: string;
}) {
  const {
    institution,
    studentName,
    level,
    classNumber,
    massarNumber,
    violationType,
    date,
    time,
    teacherName,
    subject,
    actionTaken,
    phoneNumber
  } = data;

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const dStr = date || `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const tStr = time || `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  const message = `*المملكة المغربية — وزارة التربية الوطنية*
🏛️ *المؤسسة:* ${institution || 'الثانوية الإعدادية ايكسان'}

⚠️ *إشعار بارتكاب مخالفة انضباطية*
━━━━━━━━━━━━━━━━━
👤 *اسم التلميذ(ة):* ${studentName}
🏫 *القسم والمستوى:* ${level} (${classNumber})
${massarNumber ? `🔢 *رقم مسار:* ${massarNumber}\n` : ''}📌 *نوع المخالفة:* ${violationType}
⏱️ *التاريخ والتوقيت:* ${dStr} — ${tStr}
⚖️ *الإجراء المتخذ:* ${actionTaken || 'تنبيه شفهي'}
👨‍🏫 *الأستاذ المسجل:* ${teacherName || 'أستاذ المادة'} ${subject ? `(${subject})` : ''}
━━━━━━━━━━━━━━━━━
*رسالة لولي الأمر:*
نحيطكم علماً بارتكاب التلميذ(ة) للمخالفة المذكورة أعلاه أثناء الحصة الدراسية، ونلتمس منكم حثّه(ا) على الانضباط وحسن الخلق واحترام النظام الداخلي للمؤسسة لضمان متابعة دراسية ناجحة.`;

  const cleanPhone = (phoneNumber || '').replace(/[^0-9]/g, '');
  let waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  if (cleanPhone) {
    waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  }

  window.open(waUrl, '_blank');
}

// Deliver HTML to printer via unified print runner
function deliverPrintHtml(html: string): boolean {
  return printReportHtml(html);
}

export interface PrintStudentRosterOptions {
  institution?: string;
  academicYear?: string;
  title?: string;
  filterLabel?: string;
  students: Array<{
    name: string;
    number?: string;
    massarNumber?: string;
    level?: string;
    classNumber?: string;
    sectionName?: string;
    seatNum?: number;
    statusColor?: string;
  }>;
}

export function printStudentRosterReport(options: PrintStudentRosterOptions): boolean {
  const {
    institution = 'الثانوية الإعدادية ايكسان',
    academicYear = '2026/2027',
    title = 'لائحة التلاميذ الرسمية الشاملة',
    filterLabel = 'كافة الأقسام والمستويات',
    students = []
  } = options;

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const printDate = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const printTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  const rowsHtml = students.length === 0
    ? `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #64748b; font-weight: bold;">لا يوجد أي تلميذ مسجل في هذه اللائحة.</td></tr>`
    : students.map((s, idx) => {
        const sec = s.sectionName || (s.level && s.classNumber ? `${s.level} (${s.classNumber})` : '—');
        return `
          <tr>
            <td style="text-align: center; font-weight: bold; width: 40px; font-family: monospace;">${idx + 1}</td>
            <td style="padding: 7px 10px; font-size: 13px; font-weight: bold; color: #111; text-align: right;">${escapeHtml(s.name)}</td>
            <td style="text-align: center; width: 115px; font-family: monospace; font-size: 12.5px; font-weight: bold; color: #1e3a8a;">${escapeHtml(s.massarNumber || '—')}</td>
            <td style="text-align: center; width: 60px; font-family: monospace; font-size: 13px; font-weight: bold;">${escapeHtml(s.number || '—')}</td>
            <td style="text-align: center; width: 130px; font-size: 12px; font-weight: 600; color: #047857;">${escapeHtml(sec)}</td>
            <td style="text-align: center; width: 70px; font-size: 12px;">${s.seatNum ? `مقعد #${s.seatNum}` : '—'}</td>
          </tr>
        `;
      }).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Tajawal', 'Traditional Arabic', Arial, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 0; direction: rtl; font-size: 12.5px; }
    .print-container { max-width: 100%; margin: 0 auto; padding: 8px; }
    .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #854d0e; padding-bottom: 12px; margin-bottom: 16px; }
    .header-table td { vertical-align: middle; border: none !important; }
    .official-head { font-size: 12px; line-height: 1.6; color: #333; }
    .official-head b { font-size: 13px; color: #854d0e; }
    .doc-title-box { text-align: center; margin: 10px 0 16px 0; }
    .doc-title { display: inline-block; font-size: 19px; font-weight: bold; color: #1e3a8a; background: #eff6ff; border: 1.5px solid #2563eb; border-radius: 25px; padding: 5px 30px; margin: 0 0 4px 0; }
    .doc-sub { font-size: 12px; color: #555; }
    .table-main { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 25px; }
    .table-main th { background: #1e3a8a; color: #fff; padding: 8px; font-size: 12px; border: 1px solid #1e3a8a; text-align: center; }
    .table-main td { border: 1px solid #D5CDC0; padding: 6px 8px; vertical-align: middle; }
    .table-main tr:nth-child(even) td { background: #FAF8F5; }
    .signatures-table { width: 100%; margin-top: 30px; border-collapse: collapse; page-break-inside: avoid; }
    .signatures-table td { width: 50%; text-align: center; vertical-align: top; padding: 8px; }
    .sig-title { font-weight: bold; font-size: 12.5px; color: #1f2937; margin-bottom: 50px; }
    .footer-bar { margin-top: 25px; padding-top: 10px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 10.5px; color: #777; }
  </style>
</head>
<body>
  <div class="print-container">
    ${buildOfficialMoroccanHeaderHtml({
      institution,
      academicYear,
      date: printDate,
      time: printTime,
      dateLabel: 'تاريخ الاستخراج'
    })}

    <div class="doc-title-box">
      <div class="doc-title">${escapeHtml(title)}</div>
      <div class="doc-sub">نطاق اللائحة: <strong>${escapeHtml(filterLabel)}</strong> • العدد الإجمالي: <strong>${students.length} تلميذ(ة)</strong></div>
    </div>

    <table class="table-main">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>الاسم الكامل للتلميذ(ة)</th>
          <th style="width: 115px;">رقم مسار</th>
          <th style="width: 80px;" title="الرقم الترتيبي للتلميذ في القسم">رقم التلميذ</th>
          <th style="width: 130px;">المستوى والقسم</th>
          <th style="width: 80px;" title="مكان الجلوس بالقاعة">رقم المقعد</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="sig-title">توقيع الحراسة العامة للخارجية</div>
        </td>
        <td>
          <div class="sig-title">تأشيرة وخاتم السيد مدير المؤسسة</div>
        </td>
      </tr>
    </table>

    <div class="footer-bar">
      <span>منظومة خرائط الأقسام • ${escapeHtml(institution)} • الموقع الرسمي: www.lyceecom.com</span>
      <span>وثيقة إدارية رسمية مستخرجة آلياً</span>
    </div>
  </div>
</body>
</html>`;

  return printReportHtml(html);
}

export function printSectionRosterReport(options: {
  institution?: string;
  academicYear?: string;
  section: {
    level: string;
    classNumber: string;
    teacher?: string;
  };
  students: Array<{
    name: string;
    number?: string;
    massarNumber?: string;
    seat?: number;
    statusColor?: string;
  }>;
}): boolean {
  const { institution, academicYear, section, students } = options;
  return printStudentRosterReport({
    institution,
    academicYear,
    title: `لائحة تلاميذ القسم: ${section.level} (${section.classNumber})`,
    filterLabel: `${section.level} - القسم ${section.classNumber} • الأستاذ: ${section.teacher || 'أستاذ المادة'}`,
    students: students.map(s => ({
      name: s.name,
      number: s.number,
      massarNumber: s.massarNumber,
      level: section.level,
      classNumber: section.classNumber,
      seatNum: s.seat
    }))
  });
}

export interface PrintClassroomSeatingPlanOptions {
  institution?: string;
  academicYear?: string;
  section: {
    id: string;
    level: string;
    classNumber: string;
    teacher?: string;
  };
  teacherName?: string;
  subject?: string;
  seats: Array<{
    seat: number;
    name: string;
    number?: string;
    massarNumber?: string;
    statusColor?: string;
  }>;
}

export function printClassroomSeatingPlan(options: PrintClassroomSeatingPlanOptions): boolean {
  const {
    institution = 'الثانوية الإعدادية ايكسان',
    academicYear = '2026/2027',
    section,
    teacherName,
    subject,
    seats = []
  } = options;

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const printDate = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const printTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  const teacherDisplay = teacherName || section.teacher || 'أستاذ المادة';
  const registeredCount = seats.filter(s => s.name && s.name.trim()).length;

  // Build rows (4 rows, each has 5 double desks = 10 seats)
  const rowsHtml = [1, 2, 3, 4].map(rowNum => {
    const startSeat = (rowNum - 1) * 10 + 1;
    const desksHtml = [0, 1, 2, 3, 4].map(deskIdx => {
      const s1Num = startSeat + deskIdx * 2;
      const s2Num = s1Num + 1;
      const s1 = seats.find(s => s.seat === s1Num) || { seat: s1Num, name: '', number: '', massarNumber: '' };
      const s2 = seats.find(s => s.seat === s2Num) || { seat: s2Num, name: '', number: '', massarNumber: '' };

      const renderSeat = (s: any) => {
        const isFilled = s.name && s.name.trim();
        return `
          <div class="seat-box ${isFilled ? 'seat-filled' : 'seat-empty'}">
            <div class="seat-head">
              <span class="seat-num" title="رقم المقعد">مقعد #${s.seat}</span>
              ${s.number ? `<span class="student-num" title="رقم التلميذ في القسم">تلميذ #${escapeHtml(s.number)}</span>` : ''}
            </div>
            <div class="student-name">${isFilled ? escapeHtml(s.name) : '<span class="empty-txt">— شاغر —</span>'}</div>
            ${s.massarNumber ? `<div class="massar-tag">${escapeHtml(s.massarNumber)}</div>` : ''}
          </div>
        `;
      };

      return `
        <div class="double-desk">
          <div class="desk-label">طاولة ${deskIdx + 1}</div>
          <div class="seats-row">
            ${renderSeat(s1)}
            ${renderSeat(s2)}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="plan-row">
        <div class="row-badge">الصف ${rowNum}</div>
        <div class="row-desks">
          ${desksHtml}
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>مخطط مقاعد القسم — ${escapeHtml(section.level)} (${escapeHtml(section.classNumber)})</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Tajawal', 'Traditional Arabic', Arial, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 0; direction: rtl; font-size: 11px; }
    .print-container { width: 100%; margin: 0 auto; }
    .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #854d0e; padding-bottom: 8px; margin-bottom: 10px; }
    .header-table td { vertical-align: middle; border: none !important; }
    .official-head { font-size: 11px; line-height: 1.5; color: #333; }
    .official-head b { font-size: 12px; color: #854d0e; }
    .doc-title-box { text-align: center; margin: 4px 0 10px 0; }
    .doc-title { display: inline-block; font-size: 17px; font-weight: bold; color: #166534; background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 20px; padding: 3px 25px; }
    .doc-sub { font-size: 11px; color: #475569; margin-top: 3px; }
    
    .board-indicator {
      text-align: center;
      background: #1e293b;
      color: #fff;
      font-weight: bold;
      padding: 3px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 11px;
      letter-spacing: 1px;
    }

    .plan-grid { display: flex; flex-direction: column; gap: 6px; }
    .plan-row { display: flex; align-items: stretch; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; padding: 4px; gap: 6px; }
    .row-badge { writing-mode: vertical-rl; transform: rotate(180deg); background: #0f172a; color: #fff; font-weight: bold; font-size: 11px; padding: 6px 3px; border-radius: 4px; text-align: center; }
    .row-desks { display: flex; flex: 1; gap: 6px; justify-content: space-between; }
    .double-desk { flex: 1; background: #fff; border: 1px solid #94a3b8; border-radius: 6px; padding: 3px; }
    .desk-label { font-size: 9px; color: #64748b; font-weight: bold; text-align: center; border-bottom: 1px dashed #e2e8f0; padding-bottom: 2px; margin-bottom: 2px; }
    .seats-row { display: flex; gap: 3px; }
    .seat-box { flex: 1; border-radius: 4px; padding: 3px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: space-between; min-height: 48px; }
    .seat-filled { background: #f0fdf4; border-color: #86efac; }
    .seat-empty { background: #f8fafc; border-color: #e2e8f0; opacity: 0.7; }
    .seat-head { display: flex; justify-content: space-between; font-size: 9px; color: #475569; font-weight: bold; }
    .seat-num { background: #dcfce7; color: #166534; padding: 1px 4px; border-radius: 3px; font-size: 9px; }
    .student-num { color: #0369a1; font-family: monospace; font-size: 9px; }
    .student-name { font-weight: bold; font-size: 10px; color: #0f172a; text-align: center; line-height: 1.2; margin: 2px 0; }
    .empty-txt { color: #94a3b8; font-weight: normal; font-size: 9px; }
    .massar-tag { font-family: monospace; font-size: 8px; color: #64748b; text-align: center; }

    .signatures-table { width: 100%; margin-top: 10px; border-collapse: collapse; page-break-inside: avoid; }
    .signatures-table td { width: 50%; text-align: center; vertical-align: top; padding: 4px; }
    .sig-title { font-weight: bold; font-size: 11px; color: #1f2937; margin-bottom: 28px; }
    .footer-bar { margin-top: 8px; padding-top: 4px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 9px; color: #64748b; }
  </style>
</head>
<body>
  <div class="print-container">
    ${buildOfficialMoroccanHeaderHtml({
      institution,
      academicYear,
      date: printDate,
      time: printTime,
      dateLabel: 'تاريخ الاستخراج'
    })}

    <div class="doc-title-box">
      <div class="doc-title">مخطط مقاعد القسم وخريطة جلوس التلاميذ</div>
      <div class="doc-sub">
        المستوى والقسم: <strong>${escapeHtml(section.level)} (${escapeHtml(section.classNumber)})</strong> • 
        الأستاذ(ة): <strong>${escapeHtml(teacherDisplay)}</strong> 
        ${subject ? `• المادة: <strong>${escapeHtml(subject)}</strong>` : ''} • 
        عدد التلاميذ المسجلين: <strong>${registeredCount} / 40</strong>
      </div>
    </div>

    <div class="board-indicator">▲ اتجاه السبورة والمنصة ▲</div>

    <div class="plan-grid">
      ${rowsHtml}
    </div>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="sig-title">توقيع وتأشيرة الأستاذ(ة) المشرف(ة)</div>
          <div style="font-size: 10px; color: #64748b;">${escapeHtml(teacherDisplay)}</div>
        </td>
        <td>
          <div class="sig-title">تأشيرة وخاتم السيد رئيس المؤسسة (المدير)</div>
          <div style="font-size: 10px; color: #64748b;">الحراسة العامة / إدارة المؤسسة</div>
        </td>
      </tr>
    </table>

    <div class="footer-bar">
      <span>منظومة خرائط الأقسام • ${escapeHtml(institution)} • الموقع الرسمي: www.lyceecom.com</span>
      <span>مخطط هندسي رسمي لتنظيم وتوزيع المقاعد داخل الحجرة الدراسية</span>
    </div>
  </div>
</body>
</html>`;

  return printReportHtml(html);
}

export interface PrintDailyArchiveOptions {
  institution?: string;
  academicYear?: string;
  dateStr: string;
  formattedArabicDate: string;
  sectionFilterName?: string;
  absences: Array<{
    id?: number | string;
    studentName: string;
    studentNumber?: string;
    sectionLevel?: string;
    sectionClass?: string;
    seatNum?: number;
    status: string;
    sessionPeriod?: string;
    teacherName?: string;
    justified?: string;
    justificationReason?: string;
    notes?: string;
  }>;
  violations: Array<{
    id?: string;
    studentName: string;
    studentNumber?: string;
    sectionLevel?: string;
    sectionClass?: string;
    violationType: string;
    description?: string;
    actionTaken?: string;
    teacherName?: string;
    teacherSubject?: string;
    recordedTime?: string;
  }>;
  stats?: {
    totalAbsences: number;
    totalLates: number;
    totalViolations: number;
    justifiedCount: number;
    unjustifiedCount: number;
  };
}

export function printDailyArchiveReport(options: PrintDailyArchiveOptions): boolean {
  const {
    institution = 'الثانوية الإعدادية ايكسان',
    academicYear = '2025/2026',
    dateStr,
    formattedArabicDate,
    sectionFilterName = 'كافة الأقسام',
    absences = [],
    violations = [],
    stats = {
      totalAbsences: absences.filter(a => a.status === 'absent').length,
      totalLates: absences.filter(a => a.status === 'late').length,
      totalViolations: violations.length,
      justifiedCount: absences.filter(a => a.justified && a.justified !== 'unjustified').length,
      unjustifiedCount: absences.filter(a => !a.justified || a.justified === 'unjustified').length
    }
  } = options;

  const absencesRows =
    absences.length === 0
      ? `<tr><td colspan="9" style="text-align:center; padding: 16px; color: #15803d; font-weight: bold; background: #f0fdf4;">✓ لا يوجد أي غياب أو تأخر مسجل في هذا اليوم (حضور تام وانضباط كامل).</td></tr>`
      : absences
          .map((a, i) => {
            const isLate = a.status === 'late';
            const statusLabel = isLate ? 'تأخر' : 'غياب';
            const statusColor = isLate ? '#b45309' : '#b91c1c';
            const justifiedLabel =
              a.justified === 'justified'
                ? 'مبرر ✓'
                : a.justified === 'medical'
                ? 'شهادة طبية 🩺'
                : a.justified === 'permission'
                ? 'إذن رسمي'
                : 'غير مبرر ✕';
            const justColor = a.justified && a.justified !== 'unjustified' ? '#15803d' : '#991b1b';

            return `
        <tr>
          <td style="text-align: center; font-weight: bold; width: 30px;">${i + 1}</td>
          <td style="font-weight: bold; text-align: right; padding: 6px 8px;">${escapeHtml(a.studentName)}</td>
          <td style="text-align: center; width: 110px;">${escapeHtml(a.sectionLevel || '')} (${escapeHtml(a.sectionClass || '')})</td>
          <td style="text-align: center; width: 50px;">${a.seatNum || '—'}</td>
          <td style="text-align: center; width: 65px; font-weight: bold; color: ${statusColor};">${statusLabel}</td>
          <td style="text-align: center; width: 85px;">${escapeHtml(a.sessionPeriod || 'كامل اليوم')}</td>
          <td style="text-align: center; width: 110px;">${escapeHtml(a.teacherName || '—')}</td>
          <td style="text-align: center; width: 90px; font-weight: bold; color: ${justColor};">${justifiedLabel}</td>
          <td style="text-align: right; padding: 6px 8px; color: #475569;">${escapeHtml(a.justificationReason || a.notes || '—')}</td>
        </tr>`;
          })
          .join('');

  const violationsRows =
    violations.length === 0
      ? `<tr><td colspan="7" style="text-align:center; padding: 16px; color: #15803d; font-weight: bold; background: #f0fdf4;">✓ لا توجد أي مخالفات أو ملاحظات سلوكية مسجلة في هذا اليوم.</td></tr>`
      : violations
          .map((v, i) => {
            return `
        <tr>
          <td style="text-align: center; font-weight: bold; width: 30px;">${i + 1}</td>
          <td style="font-weight: bold; text-align: right; padding: 6px 8px;">${escapeHtml(v.studentName)}</td>
          <td style="text-align: center; width: 110px;">${escapeHtml(v.sectionLevel || '')} (${escapeHtml(v.sectionClass || '')})</td>
          <td style="font-weight: bold; color: #991b1b; text-align: right; padding: 6px 8px;">${escapeHtml(v.violationType)}</td>
          <td style="text-align: right; padding: 6px 8px; color: #334155;">${escapeHtml(v.description || v.violationType)}</td>
          <td style="text-align: center; width: 110px; font-weight: bold; color: #1e3a8a;">${escapeHtml(v.actionTaken || 'تنبيه شفهي')}</td>
          <td style="text-align: center; width: 70px; font-family: monospace;">${escapeHtml(v.recordedTime || '—')}</td>
        </tr>`;
          })
          .join('');

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const printDate = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const printTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>ورقة المراقبة اليومية للغيابات والمخالفات — ${escapeHtml(dateStr)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Tajawal', 'Traditional Arabic', Arial, sans-serif;
      color: #0f172a;
      background: #fff;
      margin: 0;
      padding: 0;
      direction: rtl;
      font-size: 12px;
      line-height: 1.4;
    }
    .print-container {
      width: 100%;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #854d0e;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-table td {
      vertical-align: middle;
      border: none;
    }
    .official-head {
      font-size: 12px;
      line-height: 1.6;
      color: #333;
    }
    .official-head b {
      font-size: 13px;
      color: #854d0e;
    }
    .doc-title-box {
      text-align: center;
      margin: 12px 0 16px 0;
    }
    .doc-title {
      display: inline-block;
      font-size: 19px;
      font-weight: bold;
      color: #991b1b;
      background: #fef2f2;
      border: 1.5px solid #dc2626;
      border-radius: 30px;
      padding: 5px 30px;
      margin: 0 0 4px 0;
    }
    .doc-sub {
      font-size: 12px;
      color: #555;
    }
    .stats-bar {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 14px;
      font-size: 11.5px;
    }
    .stats-item {
      display: inline-block;
      margin-left: 14px;
    }
    .stats-num {
      font-weight: bold;
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11px;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      border: 1px solid #94a3b8;
      padding: 6px;
      font-weight: bold;
      text-align: center;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      margin: 10px 0 6px 0;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #64748b;
      color: #1e293b;
    }
    .signatures {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      text-align: center;
      page-break-inside: avoid;
    }
    .sig-block {
      width: 45%;
      border-top: 1px dashed #64748b;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${buildOfficialMoroccanHeaderHtml({
      institution,
      academicYear,
      date: printDate,
      time: printTime,
      dateLabel: 'تاريخ الاستخراج'
    })}

    <div class="doc-title-box">
      <div class="doc-title">ورقة المراقبة اليومية للغيابات والمخالفات السلوكية</div>
      <div class="doc-sub">
        <strong>تاريخ اليوم:</strong> ${escapeHtml(formattedArabicDate)} (${escapeHtml(dateStr)}) | 
        <strong>نطاق التقرير:</strong> ${escapeHtml(sectionFilterName)}
      </div>
    </div>

    <div class="stats-bar">
      <div class="stats-item">مجموع الغيابات: <span class="stats-num" style="color: #b91c1c;">${stats.totalAbsences}</span></div>
      <div class="stats-item">التأخرات: <span class="stats-num" style="color: #b45309;">${stats.totalLates}</span></div>
      <div class="stats-item">الغيابات المبررة: <span class="stats-num" style="color: #15803d;">${stats.justifiedCount}</span></div>
      <div class="stats-item">الغيابات غير المبررة: <span class="stats-num" style="color: #991b1b;">${stats.unjustifiedCount}</span></div>
      <div class="stats-item">المخالفات والملاحظات: <span class="stats-num" style="color: #7c2d12;">${stats.totalViolations}</span></div>
    </div>

    <div class="section-title">
      أولاً: سجل الغيابات والتأخرات اليومية (${absences.length} حالة مسجلة)
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>اسم التلميذ(ة)</th>
          <th style="width: 110px;">القسم</th>
          <th style="width: 65px;">رقم المقعد</th>
          <th style="width: 65px;">الحالة</th>
          <th style="width: 85px;">الفترة</th>
          <th style="width: 110px;">الأستاذ(ة)</th>
          <th style="width: 90px;">التبرير</th>
          <th>ملاحظات وتفاصيل التبرير</th>
        </tr>
      </thead>
      <tbody>
        ${absencesRows}
      </tbody>
    </table>

    <div class="section-title">
      ثانياً: سجل المخالفات والملاحظات السلوكية (${violations.length} مخالفة مسجلة)
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>اسم التلميذ(ة)</th>
          <th style="width: 110px;">القسم</th>
          <th style="width: 140px;">نوع المخالفة</th>
          <th>وصف المخالفة</th>
          <th style="width: 110px;">الإجراء المتخذ</th>
          <th style="width: 70px;">التوقيت</th>
        </tr>
      </thead>
      <tbody>
        ${violationsRows}
      </tbody>
    </table>

    <div class="signatures">
      <div class="sig-block">
        <strong>توقيع الحراسة العامة للخارجية</strong>
        <div style="height: 48px;"></div>
      </div>
      <div class="sig-block">
        <strong>توقيع وخاتم السيد رئيس المؤسسة</strong>
        <div style="height: 48px;"></div>
      </div>
    </div>

    <div class="footer-bar" style="margin-top: 25px; padding-top: 10px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 10px; color: #777;">
      <span>منظومة خرائط الأقسام • ${escapeHtml(institution || 'الثانوية الإعدادية ايكسان')} • الموقع الرسمي: www.lyceecom.com</span>
      <span>وثيقة الأرشيف اليومي الرسمية للإدارة والتربية</span>
    </div>
  </div>
</body>
</html>`;

  return printReportHtml(html);
}

export interface PrintStudentPositiveParticipationsOptions {
  institution?: string;
  academicYear?: string;
  level: string;
  classNumber: string;
  studentName: string;
  studentNumber?: string;
  massarNumber?: string;
  seatNum?: number;
  teacherName?: string;
  subject?: string;
  participations: PositiveParticipationItem[];
  totalPoints?: number;
  mode?: 'certificate' | 'report';
}

export function printStudentPositiveParticipationsReport(options: PrintStudentPositiveParticipationsOptions): boolean {
  const {
    institution = 'الثانوية الإعدادية ايكسان',
    academicYear = '2025/2026',
    level,
    classNumber,
    studentName,
    studentNumber,
    massarNumber,
    seatNum,
    teacherName,
    subject,
    participations = [],
    totalPoints,
    mode = 'report'
  } = options;

  const points = totalPoints !== undefined
    ? totalPoints
    : participations.reduce((sum, p) => sum + (p.points || 1), 0);

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const headerHtml = buildOfficialMoroccanHeaderHtml({
    institution,
    academicYear,
    date: dateStr,
    time: timeStr,
    dateLabel: 'تاريخ التحرير',
    middleIcon: '⭐'
  });

  const participationsRows = participations.length === 0
    ? `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #64748b; font-weight: bold; background: #f8fafc;">لا توجد مشاركات إيجابية مسجلة بعد لهذا التلميذ(ة).</td></tr>`
    : participations.map((p, i) => {
        return `
          <tr>
            <td style="text-align: center; font-weight: bold; width: 35px;">${i + 1}</td>
            <td style="text-align: center; width: 110px; font-size: 11px;">
              <b>${escapeHtml(p.recordedDate || '—')}</b><br>
              <span style="color: #64748b;">${escapeHtml(p.recordedTime || '')}</span>
            </td>
            <td style="font-weight: bold; text-align: right; padding: 8px 10px; color: #1e3a8a;">
              ⭐ ${escapeHtml(p.participationType)}
            </td>
            <td style="text-align: center; width: 70px;">
              <span style="display: inline-block; background: #fef3c7; color: #92400e; font-weight: bold; padding: 3px 8px; border-radius: 12px; border: 1px solid #fde68a;">
                +${p.points || 1}
              </span>
            </td>
            <td style="text-align: center; width: 120px; font-size: 11px;">
              <b>${escapeHtml(p.teacherName || teacherName || '—')}</b>
              ${(p.teacherSubject || subject) ? `<br><span style="color: #475569;">(${escapeHtml(p.teacherSubject || subject || '')})</span>` : ''}
            </td>
            <td style="text-align: right; padding: 8px 10px; color: #334155; font-size: 11px;">
              ${escapeHtml(p.note || 'تعزيز تشجيعي متميز')}
            </td>
          </tr>
        `;
      }).join('');

  const isCertificate = mode === 'certificate';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>شهادة تقدير وسجل المشاركات الإيجابية - ${escapeHtml(studentName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      background: #fff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .print-card {
      border: 3px double #d97706;
      border-radius: 12px;
      padding: 16px 20px;
      background: #ffffff;
      position: relative;
    }
    ${OFFICIAL_HEADER_CSS}
    .cert-title-wrap {
      text-align: center;
      margin: 12px 0 16px 0;
    }
    .cert-title {
      display: inline-block;
      font-size: 22px;
      font-weight: 800;
      color: #92400e;
      background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%);
      border: 2px solid #f59e0b;
      border-radius: 30px;
      padding: 6px 36px;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 4px rgba(217, 119, 6, 0.15);
    }
    .cert-subtitle {
      font-size: 12px;
      color: #b45309;
      margin-top: 4px;
      font-weight: bold;
    }
    .student-badge-grid {
      width: 100%;
      border-collapse: separate;
      border-spacing: 10px;
      margin-bottom: 14px;
    }
    .student-badge-grid td {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px 14px;
      vertical-align: top;
    }
    .badge-label {
      font-size: 11px;
      color: #78350f;
      display: block;
      margin-bottom: 3px;
    }
    .badge-val {
      font-size: 14px;
      font-weight: bold;
      color: #1e293b;
    }
    .score-banner {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 1.5px dashed #d97706;
      border-radius: 10px;
      padding: 10px 18px;
      text-align: center;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-around;
    }
    .score-title {
      font-size: 13px;
      font-weight: bold;
      color: #92400e;
    }
    .score-number {
      font-size: 24px;
      font-weight: 900;
      color: #b45309;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 16px;
    }
    .table-custom th {
      background: #fef3c7;
      color: #78350f;
      border: 1px solid #d97706;
      padding: 8px 6px;
      font-size: 11.5px;
      font-weight: bold;
      text-align: center;
    }
    .table-custom td {
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      vertical-align: middle;
    }
    .table-custom tr:nth-child(even) {
      background-color: #fafaf9;
    }
    .commendation-box {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 8px;
      padding: 12px 18px;
      margin: 16px 0;
      text-align: center;
      color: #166534;
      font-size: 12px;
      line-height: 1.6;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 10px;
      page-break-inside: avoid;
    }
    .signature-col {
      width: 30%;
      text-align: center;
      font-size: 11.5px;
      color: #1e293b;
    }
    .sig-space {
      height: 55px;
    }
  </style>
</head>
<body>
  <div class="print-card">
    ${headerHtml}

    <div class="cert-title-wrap">
      <div class="cert-title">⭐ شهادة تشجيع وتنويه - سجل المشاركات الإيجابية ⭐</div>
      <div class="cert-subtitle">تعزيز التميز والسلوك الإيجابي والمشاركة الصفية الفعالة</div>
    </div>

    <table class="student-badge-grid">
      <tr>
        <td style="width: 30%;">
          <span class="badge-label">اسم التلميذ(ة) الكامل:</span>
          <span class="badge-val" style="color: #92400e; font-size: 15px;">${escapeHtml(studentName)}</span>
        </td>
        <td style="width: 20%;">
          <span class="badge-label">القسم والمستوى:</span>
          <span class="badge-val">${escapeHtml(level)} (${escapeHtml(classNumber)})</span>
        </td>
        <td style="width: 15%;">
          <span class="badge-label">رقم التلميذ:</span>
          <span class="badge-val">${studentNumber || '—'}</span>
        </td>
        <td style="width: 15%;">
          <span class="badge-label">مكان الجلوس:</span>
          <span class="badge-val">${seatNum ? `مقعد #${seatNum}` : '—'}</span>
        </td>
        <td style="width: 20%;">
          <span class="badge-label">رقم مسار:</span>
          <span class="badge-val" style="font-family: monospace;">${escapeHtml(massarNumber || '—')}</span>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <span class="badge-label">الأستاذ(ة) المؤطر(ة):</span>
          <span class="badge-val">${escapeHtml(teacherName || 'الإدارة التربوية وهيئة التدريس')}</span>
        </td>
        <td colspan="3">
          <span class="badge-label">المادة الدراسية:</span>
          <span class="badge-val">${escapeHtml(subject || 'جميع المواد / الحياة المدرسية')}</span>
        </td>
      </tr>
    </table>

    <div class="score-banner">
      <div>
        <div class="score-title">🏆 إجمالي رصيد نقاط التميز والتعزيز:</div>
        <div style="font-size: 11px; color: #78350f;">مجموع النقاط الإيجابية المكتسبة خلال الموسم الدراسي</div>
      </div>
      <div>
        <span class="score-number">${points}</span>
        <span style="font-size: 14px; font-weight: bold; color: #b45309; margin-right: 4px;">نقطة تميز ⭐</span>
      </div>
      <div>
        <span style="font-size: 12px; font-weight: bold; color: #166534; background: #dcfce7; padding: 4px 10px; border-radius: 12px; border: 1px solid #bbf7d0;">
          ${points >= 5 ? '🌟 وسام الامتياز والريادة' : points >= 3 ? '🏅 وسام التميز والمواظبة' : '👍 وسام النشاط والاجتهاد'}
        </span>
      </div>
    </div>

    ${!isCertificate ? `
      <div style="font-weight: bold; font-size: 13px; color: #78350f; margin-bottom: 6px;">
        📋 السجل التفصيلي للمشاركات الإيجابية والسلوكيات المتميزة:
      </div>
      <table class="table-custom">
        <thead>
          <tr>
            <th>#</th>
            <th>التاريخ والساعة</th>
            <th>نوع المشاركة والتميز</th>
            <th>النقاط</th>
            <th>الأستاذ(ة) / المادة</th>
            <th>ملاحظات الأستاذ وتشجيعه</th>
          </tr>
        </thead>
        <tbody>
          ${participationsRows}
        </tbody>
      </table>
    ` : ''}

    <div class="commendation-box">
      <b>تنويه وتشجيع تربوي:</b><br>
      تشهد إدارة المؤسسة وهيئة التدريس بأن التلميذ(ة) <b>${escapeHtml(studentName)}</b> قد أبان(ت) عن انضباط وحرص واجتهاد ملحوظ ومشاركة صفية فاعلة،
      وتقدم له(ا) هذه البطاقة اعترافاً بجهوده(ا) وتحفيزاً على الاستمرار في مسار التميز والنجاح.
    </div>

    <div class="signatures-row">
      <div class="signature-col">
        <strong>توقيع الأستاذ(ة) المشرف(ة)</strong>
        <div class="sig-space"></div>
      </div>
      <div class="signature-col">
        <strong>توقيع الحراسة العامة للخارجية</strong>
        <div class="sig-space"></div>
      </div>
      <div class="signature-col">
        <strong>توقيع وخاتم السيد رئيس المؤسسة</strong>
        <div class="sig-space"></div>
      </div>
    </div>

    <div class="footer-bar" style="margin-top: 25px; padding-top: 10px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 10px; color: #777;">
      <span>منظومة خرائط الأقسام • ${escapeHtml(institution || 'الثانوية الإعدادية ايكسان')} • الموقع الرسمي: www.lyceecom.com</span>
      <span>بطاقة تعزيز وتشجيع رسمية مستخرجة آلياً</span>
    </div>
  </div>
</body>
</html>`;

  return printReportHtml(html);
}

export interface PrintSectionPositiveParticipationsOptions {
  institution?: string;
  academicYear?: string;
  level: string;
  classNumber: string;
  teacherName?: string;
  subject?: string;
  dateStr?: string;
  students: Array<{
    name: string;
    number?: string;
    massarNumber?: string;
    seatNum?: number;
    points: number;
    participationsCount: number;
    participations?: PositiveParticipationItem[];
  }>;
  allParticipations?: PositiveParticipationItem[];
}

export function printSectionPositiveParticipationsReport(options: PrintSectionPositiveParticipationsOptions): boolean {
  const {
    institution = 'الثانوية الإعدادية ايكسان',
    academicYear = '2025/2026',
    level,
    classNumber,
    teacherName,
    subject,
    students = [],
    allParticipations = []
  } = options;

  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const dateStr = options.dateStr || `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const headerHtml = buildOfficialMoroccanHeaderHtml({
    institution,
    academicYear,
    date: dateStr,
    time: timeStr,
    dateLabel: 'تاريخ الاستخراج',
    middleIcon: '🏆'
  });

  // Sort students by points descending
  const sortedStudents = [...students].sort((a, b) => b.points - a.points);
  const activeStudents = sortedStudents.filter(s => s.points > 0);
  const totalPoints = students.reduce((sum, s) => sum + (s.points || 0), 0);
  const totalParticipationsCount = students.reduce((sum, s) => sum + (s.participationsCount || 0), 0);
  const topStudent = activeStudents.length > 0 ? activeStudents[0] : null;

  const rankBadges = ['🥇', '🥈', '🥉'];

  const honorRollRows = activeStudents.length === 0
    ? `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #64748b; font-weight: bold; background: #f8fafc;">لم يتم تسجيل أي مشاركات إيجابية في هذا القسم حتى الآن.</td></tr>`
    : activeStudents.map((st, i) => {
        const medal = i < 3 ? rankBadges[i] : `${i + 1}`;
        const medalBg = i === 0 ? '#fef3c7' : i === 1 ? '#f1f5f9' : i === 2 ? '#ffedd5' : '#ffffff';
        const medalColor = i === 0 ? '#92400e' : i === 1 ? '#475569' : i === 2 ? '#9a3412' : '#334155';
        const badge = st.points >= 5 ? '🌟 وسام الامتياز' : st.points >= 3 ? '🏅 وسام التميز' : '👍 وسام الاجتهاد';
        const badgeColor = st.points >= 5 ? '#b45309' : st.points >= 3 ? '#15803d' : '#0369a1';

        return `
          <tr style="background: ${medalBg};">
            <td style="text-align: center; font-weight: 800; font-size: 14px; color: ${medalColor}; width: 45px;">${medal}</td>
            <td style="font-weight: bold; font-size: 13px; text-align: right; padding: 7px 10px;">${escapeHtml(st.name)}</td>
            <td style="text-align: center; width: 60px; font-weight: bold;">${escapeHtml(st.number || '')}</td>
            <td style="text-align: center; width: 105px; font-family: monospace; font-size: 11px;">${escapeHtml(st.massarNumber || '—')}</td>
            <td style="text-align: center; width: 85px;">
              <span style="display: inline-block; background: #fde68a; color: #78350f; font-weight: 900; font-size: 13px; padding: 3px 10px; border-radius: 12px; border: 1px solid #f59e0b;">
                ⭐ ${st.points}
              </span>
            </td>
            <td style="text-align: center; width: 75px; font-weight: bold; color: #475569;">${st.participationsCount}</td>
            <td style="text-align: center; width: 130px; font-weight: bold; color: ${badgeColor}; font-size: 11.5px;">${badge}</td>
          </tr>
        `;
      }).join('');

  // Detailed participations log if provided
  const participationsList = allParticipations.length > 0
    ? allParticipations
    : students.flatMap(s => s.participations || []);

  const detailedRows = participationsList.length === 0
    ? `<tr><td colspan="7" style="text-align:center; padding: 14px; color: #64748b;">لا توجد مشاركات إضافية في السجل التفصيلي.</td></tr>`
    : participationsList.slice(0, 50).map((p, i) => {
        return `
          <tr>
            <td style="text-align: center; font-weight: bold; width: 30px;">${i + 1}</td>
            <td style="text-align: center; width: 95px; font-size: 11px;">${escapeHtml(p.recordedDate || '—')}</td>
            <td style="font-weight: bold; text-align: right; padding: 5px 8px;">${escapeHtml(p.studentName || '—')}</td>
            <td style="text-align: right; padding: 5px 8px; color: #1e3a8a; font-weight: bold;">⭐ ${escapeHtml(p.participationType)}</td>
            <td style="text-align: center; width: 60px; font-weight: bold; color: #b45309;">+${p.points || 1}</td>
            <td style="text-align: center; width: 110px; font-size: 11px;">${escapeHtml(p.teacherName || teacherName || '—')}</td>
            <td style="text-align: right; padding: 5px 8px; color: #475569; font-size: 11px;">${escapeHtml(p.note || '—')}</td>
          </tr>
        `;
      }).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>لوحة شرف وسجل المشاركات الإيجابية - ${escapeHtml(level)} (${escapeHtml(classNumber)})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      background: #fff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 11.5px;
      line-height: 1.5;
    }
    .print-card {
      border: 2.5px solid #d97706;
      border-radius: 10px;
      padding: 14px 16px;
      background: #ffffff;
    }
    ${OFFICIAL_HEADER_CSS}
    .doc-title-box {
      text-align: center;
      margin: 10px 0 14px 0;
    }
    .doc-title {
      display: inline-block;
      font-size: 20px;
      font-weight: 800;
      color: #92400e;
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 30px;
      padding: 5px 30px;
    }
    .meta-bar {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 8px 14px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #78350f;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .stat-card {
      background: #fff;
      border: 1.5px solid #fed7aa;
      border-radius: 8px;
      padding: 8px 10px;
      text-align: center;
    }
    .stat-card-title {
      font-size: 11px;
      color: #9a3412;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .stat-card-val {
      font-size: 18px;
      font-weight: 900;
      color: #c2410c;
    }
    .section-headline {
      font-size: 13px;
      font-weight: bold;
      color: #92400e;
      margin: 14px 0 6px 0;
      border-bottom: 1.5px solid #fde68a;
      padding-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .table-custom th {
      background: #fef3c7;
      color: #78350f;
      border: 1px solid #d97706;
      padding: 7px 5px;
      font-size: 11.5px;
      font-weight: bold;
      text-align: center;
    }
    .table-custom td {
      border: 1px solid #e2e8f0;
      padding: 5px 6px;
      vertical-align: middle;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
      padding-top: 10px;
      page-break-inside: avoid;
    }
    .signature-col {
      width: 30%;
      text-align: center;
      font-size: 11.5px;
      color: #1e293b;
    }
    .sig-space {
      height: 48px;
    }
  </style>
</head>
<body>
  <div class="print-card">
    ${headerHtml}

    <div class="doc-title-box">
      <div class="doc-title">🏆 لوحة شرف وسجل المشاركات الإيجابية والتحفيز المدرسي 🏆</div>
    </div>

    <div class="meta-bar">
      <div>القسم والمستوى: <b>${escapeHtml(level)} (${escapeHtml(classNumber)})</b></div>
      <div>الأستاذ(ة) المشرف(ة): <b>${escapeHtml(teacherName || 'الإدارة وهيئة التدريس')}</b></div>
      <div>الموسم الدراسي: <b>${escapeHtml(academicYear)}</b></div>
      <div>تاريخ الاستخراج: <b>${escapeHtml(dateStr)}</b></div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-title">إجمالي نقاط القسم</div>
        <div class="stat-card-val">⭐ ${totalPoints}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">المشاركات المسجلة</div>
        <div class="stat-card-val">${totalParticipationsCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">التلاميذ المتميزون</div>
        <div class="stat-card-val">${activeStudents.length} / ${students.length}</div>
      </div>
      <div class="stat-card" style="background: #fffbeb; border-color: #f59e0b;">
        <div class="stat-card-title">متصدر القسم 🥇</div>
        <div class="stat-card-val" style="font-size: 13px; color: #92400e;">
          ${topStudent ? escapeHtml(topStudent.name) : '—'}
          ${topStudent ? `<br><span style="font-size: 11px; font-weight: normal;">(${topStudent.points} نقطة)</span>` : ''}
        </div>
      </div>
    </div>

    <div class="section-headline">
      <span>🏅 أولاً: لوحة الشرف وتصنيف التلاميذ حسب نقاط التميز والمشاركة:</span>
      <span style="font-size: 11px; font-weight: normal; color: #78350f;">مرتبة تنازلياً حسب رصيد النقاط</span>
    </div>

    <table class="table-custom">
      <thead>
        <tr>
          <th>الرتبة</th>
          <th>الاسم الكامل للتلميذ(ة)</th>
          <th title="الرقم الترتيبي للتلميذ في القسم">رقم التلميذ</th>
          <th>رقم مسار</th>
          <th>رصيد النقاط</th>
          <th>المشاركات</th>
          <th>وسام التقدير</th>
        </tr>
      </thead>
      <tbody>
        ${honorRollRows}
      </tbody>
    </table>

    ${participationsList.length > 0 ? `
      <div class="section-headline">
        <span>📋 ثانياً: السجل التفصيلي لآخر المشاركات الإيجابية المسجلة:</span>
        <span style="font-size: 11px; font-weight: normal; color: #78350f;">تفاصيل السلوكيات الإيجابية والتعزيز</span>
      </div>

      <table class="table-custom">
        <thead>
          <tr>
            <th>#</th>
            <th>التاريخ</th>
            <th>التلميذ(ة)</th>
            <th>نوع المشاركة والتميز</th>
            <th>النقاط</th>
            <th>الأستاذ(ة) / المادة</th>
            <th>الملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${detailedRows}
        </tbody>
      </table>
    ` : ''}

    <div class="signatures-row">
      <div class="signature-col">
        <strong>توقيع أستاذ(ة) القسم</strong>
        <div class="sig-space"></div>
      </div>
      <div class="signature-col">
        <strong>توقيع الحراسة العامة للخارجية</strong>
        <div class="sig-space"></div>
      </div>
      <div class="signature-col">
        <strong>توقيع وخاتم السيد رئيس المؤسسة</strong>
        <div class="sig-space"></div>
      </div>
    </div>

    <div class="footer-bar" style="margin-top: 25px; padding-top: 10px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 10px; color: #777;">
      <span>منظومة خرائط الأقسام • ${escapeHtml(institution || 'الثانوية الإعدادية ايكسان')} • الموقع الرسمي: www.lyceecom.com</span>
      <span>لوحة التميز والمشاركات الإيجابية الرسمية</span>
    </div>
  </div>
</body>
</html>`;

  return printReportHtml(html);
}

export function printReportHtml(html: string): boolean {
  // Method 1: Try using a hidden iframe to trigger printing seamlessly
  try {
    let printIframe = document.getElementById('notes-print-iframe') as HTMLIFrameElement | null;
    if (printIframe && printIframe.parentNode) {
      printIframe.parentNode.removeChild(printIframe);
    }
    printIframe = document.createElement('iframe');
    printIframe.id = 'notes-print-iframe';
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    printIframe.style.opacity = '0';
    printIframe.style.pointerEvents = 'none';
    document.body.appendChild(printIframe);

    const doc = printIframe.contentDocument || printIframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          if (printIframe?.contentWindow) {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
          }
        } catch (e) {
          console.warn('Iframe print execution notice:', e);
          fallbackDirectPrint(html);
        }
      }, 400);

      return true;
    }
  } catch (e) {
    console.warn('Iframe print failed, falling back to direct print', e);
  }

  return fallbackDirectPrint(html);
}

function fallbackDirectPrint(html: string): boolean {
  try {
    let container = document.getElementById('direct-report-print-container');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = document.createElement('div');
    container.id = 'direct-report-print-container';

    // Parse the html content
    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(html, 'text/html');
    const styles = parsedDoc.querySelectorAll('style, link[rel="stylesheet"]');
    const bodyContent = parsedDoc.body ? parsedDoc.body.innerHTML : html;

    let styleHtml = `
      <style id="direct-print-styles">
        @media screen {
          #direct-report-print-container {
            display: none !important;
          }
        }
        @media print {
          body > *:not(#direct-report-print-container) {
            display: none !important;
            visibility: hidden !important;
          }
          #direct-report-print-container {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 5mm !important;
            background: white !important;
            color: black !important;
            direction: rtl !important;
          }
          #direct-report-print-container * {
            visibility: visible !important;
          }
        }
      </style>
    `;

    styles.forEach((s) => {
      styleHtml += s.outerHTML;
    });

    container.innerHTML = styleHtml + bodyContent;
    document.body.appendChild(container);

    setTimeout(() => {
      window.print();
      const cleanup = () => {
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 12000);
    }, 250);

    return true;
  } catch (err) {
    console.error('Direct print fallback failed:', err);
    return false;
  }
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface PrintStudentAttendanceCardOptions {
  institution?: string;
  academicYear?: string;
  studentName: string;
  studentNumber?: string;
  massarNumber?: string;
  sectionName: string;
  seatNum?: number;
  totalAbsences: number;
  totalLates: number;
  totalHours: number;
  justifiedCount: number;
  unjustifiedCount: number;
  records: Array<{
    status: 'absent' | 'late';
    recordedDate: string;
    sessionPeriod?: string;
    teacherName?: string;
    teacherSubject?: string;
    justified?: string;
    justificationReason?: string;
    durationLabel?: string;
    notes?: string;
  }>;
}

export function printStudentAttendanceCard(options: PrintStudentAttendanceCardOptions): boolean {
  const headerHtml = buildOfficialMoroccanHeaderHtml({
    institution: options.institution,
    academicYear: options.academicYear,
    dateLabel: 'تاريخ استخراج الكشف',
    middleIcon: '📋'
  });

  const rowsHtml = options.records.length === 0
    ? `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">لا توجد أي غيابات أو تأخرات مسجلة بحق التلميذ (سجل انضباط نموذجي)</td></tr>`
    : options.records.map((r, i) => `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="text-align: center; font-weight: bold;">${i + 1}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold;">${escapeHtml(r.recordedDate)}</td>
          <td style="text-align: center;">${escapeHtml(r.sessionPeriod || 'كامل اليوم')}</td>
          <td style="text-align: center; font-weight: bold; color: ${r.status === 'absent' ? '#b91c1c' : '#b45309'};">
            ${r.status === 'absent' ? '✕ غياب' : '⏳ تأخر'}
          </td>
          <td>${escapeHtml(r.teacherSubject || '—')} ${r.teacherName ? `(${escapeHtml(r.teacherName)})` : ''}</td>
          <td style="text-align: center; font-weight: bold; color: ${r.justified && r.justified !== 'unjustified' ? '#15803d' : '#b91c1c'};">
            ${r.justified && r.justified !== 'unjustified' ? 'مبرر ✓' : 'غير مبرر ✕'}
          </td>
          <td style="font-size: 11px; color: #475569;">${escapeHtml(r.justificationReason || r.notes || '—')}</td>
        </tr>
      `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>كشف المواظبة والغياب الفردي - ${escapeHtml(options.studentName)}</title>
      <style>
        ${OFFICIAL_HEADER_CSS}
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 15mm; color: #1e293b; background: #fff; }
        .doc-title { text-align: center; font-size: 18px; font-weight: bold; margin: 15px 0; color: #0f172a; text-decoration: underline; }
        .student-box { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 15px; background: #f8fafc; }
        .student-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
        .stat-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; text-align: center; font-size: 11px; }
        .stat-card strong { display: block; font-size: 16px; margin-top: 4px; }
        .records-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        .records-table th, .records-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
        .records-table th { background: #f1f5f9; font-weight: bold; }
        .signatures { display: flex; justify-content: space-between; margin-top: 35px; font-size: 12px; font-weight: bold; }
        .sig-box { width: 30%; text-align: center; min-height: 80px; }
      </style>
    </head>
    <body>
      ${headerHtml}
      <div class="doc-title">كشف المواظبة والغياب الفردي للتلميذ(ة)</div>

      <div class="student-box">
        <div class="student-grid">
          <div>اسم التلميذ: <b>${escapeHtml(options.studentName)}</b></div>
          <div>القسم: <b>${escapeHtml(options.sectionName)}</b></div>
          <div>رقم التلميذ في القسم: <b>${escapeHtml(options.studentNumber || '—')}</b></div>
          <div>رقم مسار: <b>${escapeHtml(options.massarNumber || '—')}</b></div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card" style="background: #fef2f2; border-color: #fecaca; color: #991b1b;">
          إجمالي الغيابات: <strong>${options.totalAbsences} حصة</strong>
        </div>
        <div class="stat-card" style="background: #fffbeb; border-color: #fde68a; color: #92400e;">
          إجمالي التأخرات: <strong>${options.totalLates} حالة</strong>
        </div>
        <div class="stat-card" style="background: #f0fdf4; border-color: #bbf7d0; color: #166534;">
          الغيابات المبررة: <strong>${options.justifiedCount} حصة</strong>
        </div>
        <div class="stat-card" style="background: #fff1f2; border-color: #ffe4e6; color: #be123c;">
          الغيابات غير المبررة: <strong>${options.unjustifiedCount} حصة</strong>
        </div>
      </div>

      <table class="records-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="width: 85px; text-align: center;">التاريخ</th>
            <th style="width: 130px; text-align: center;">الحصة / الفترة</th>
            <th style="width: 70px; text-align: center;">الحالة</th>
            <th>المادة / الأستاذ</th>
            <th style="width: 80px; text-align: center;">وضعية التبرير</th>
            <th>الملاحظات والمبرر</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">توقيع ولي الأمر بالعلم:<br><br>......................................</div>
        <div class="sig-box">توقيع الحارس(ة) العام(ة):<br><br>......................................</div>
        <div class="sig-box">توقيع وخاتم رئيس المؤسسة:<br><br>......................................</div>
      </div>

      <div style="margin-top: 25px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
        <span>منظومة خرائط الأقسام • ${escapeHtml(options.institution || 'الثانوية الإعدادية ايكسان')} • الموقع الرسمي: www.lyceecom.com</span>
        <span>كشف المواظبة والغياب الفردي الرسمي</span>
      </div>
    </body>
    </html>
  `;

  return printReportHtml(html);
}

export interface PrintParentAbsenceNoticeOptions {
  institution?: string;
  academicYear?: string;
  studentName: string;
  studentNumber?: string;
  massarNumber?: string;
  sectionName: string;
  recordedDate: string;
  sessionPeriod?: string;
  teacherName?: string;
  teacherSubject?: string;
}

export function printParentAbsenceNotice(options: PrintParentAbsenceNoticeOptions): boolean {
  const headerHtml = buildOfficialMoroccanHeaderHtml({
    institution: options.institution,
    academicYear: options.academicYear,
    dateLabel: 'تاريخ الإشعار',
    middleIcon: '✉️'
  });

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>إشعار بالغياب موجه لولي الأمر - ${escapeHtml(options.studentName)}</title>
      <style>
        ${OFFICIAL_HEADER_CSS}
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 15mm; color: #1e293b; background: #fff; }
        .doc-title { text-align: center; font-size: 18px; font-weight: bold; margin: 15px 0 20px; color: #0f172a; text-decoration: underline; }
        .notice-card { border: 2px solid #0f172a; border-radius: 10px; padding: 20px; background: #ffffff; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-table td { padding: 8px 12px; border: 1px solid #cbd5e1; font-size: 13px; }
        .info-table td.label { background: #f8fafc; font-weight: bold; width: 25%; }
        .message-p { font-size: 13.5px; line-height: 1.9; margin: 20px 0; text-align: justify; }
        .signatures { display: flex; justify-content: space-between; margin-top: 35px; font-size: 13px; font-weight: bold; }
        .tear-slip { margin-top: 40px; border-top: 2px dashed #94a3b8; padding-top: 20px; font-size: 12px; }
      </style>
    </head>
    <body>
      ${headerHtml}
      <div class="doc-title">إشعار رسمي بتغيب تلميذ(ة) موجه لولي الأمر</div>

      <div class="notice-card">
        <p style="font-size: 14px; font-weight: bold; margin-bottom: 15px;">
          إلى السيد(ة) ولي أمر التلميذ(ة): <u>${escapeHtml(options.studentName)}</u> المحترم(ة)
        </p>

        <table class="info-table">
          <tr>
            <td class="label">اسم التلميذ(ة):</td>
            <td><b>${escapeHtml(options.studentName)}</b></td>
            <td class="label">القسم:</td>
            <td><b>${escapeHtml(options.sectionName)}</b></td>
          </tr>
          <tr>
            <td class="label">تاريخ الغياب:</td>
            <td><b>${escapeHtml(options.recordedDate)}</b></td>
            <td class="label">الحصة / الفترة:</td>
            <td><b>${escapeHtml(options.sessionPeriod || 'كامل اليوم')}</b></td>
          </tr>
          <tr>
            <td class="label">المادة:</td>
            <td><b>${escapeHtml(options.teacherSubject || '—')}</b></td>
            <td class="label">الأستاذ(ة):</td>
            <td><b>${escapeHtml(options.teacherName || '—')}</b></td>
          </tr>
        </table>

        <p class="message-p">
          سلام تام بوجود مولانا الإمام المؤيد بالله،<br>
          وبعد، يُؤسف إدارة المؤسسة إخباركم بأن ابنكم(تكم) المذكور(ة) أعلاه قد تغيب(ت) عن الحصة المحددة دون سابق إشعار أو مبرر مقبول.
          لذا نرجو منكم الحضور إلى مصلحة الحراسة العامة في أقرب وقت لتسوية وضعية التلميذ والإدلاء بالمبرر القانوني، حفاظاً على تمدرسه وتجنباً للعقوبات التأديبية المنصوص عليها في النظام الداخلي للمؤسسة.
        </p>

        <div class="signatures">
          <div>حرر بـ: الثانوية الإعدادية ايكسان<br>بتاريخ: ${escapeHtml(options.recordedDate)}</div>
          <div>توقيع وخاتم إدارة المؤسسة:<br><br><br>...........................................</div>
        </div>
      </div>

      <div class="tear-slip">
        <div style="text-align: center; font-weight: bold; margin-bottom: 10px;">✂️ وصل التوصل بإشعار الغياب (يُرجع بعد التوقيع للحراسة العامة)</div>
        <p>أنا الموقع أسفله ولي أمر التلميذ(ة): <b>${escapeHtml(options.studentName)}</b> بالقسم: <b>${escapeHtml(options.sectionName)}</b>، أشهد بأنني توصلت بالإشعار بتغيبه بتاريخ: <b>${escapeHtml(options.recordedDate)}</b>.</p>
        <div style="display: flex; justify-content: space-between; margin-top: 15px;">
          <div>تاريخ التوصل: ..... / ..... / 2026</div>
          <div>توقيع ولي الأمر: .......................................</div>
        </div>
      </div>
    </body>
    </html>
  `;

  return printReportHtml(html);
}

export interface PrintTeacherCredentialsOptions {
  institution?: string;
  academicYear?: string;
  directorName?: string;
  viewMode?: 'cards' | 'table';
  teachers: Array<{
    id?: string;
    fullName: string;
    username: string;
    email: string;
    password?: string;
    subject?: string;
    status?: string;
  }>;
}

/**
 * Robust Moroccan Official Printout for Teacher Accounts & Initial Passwords
 * Dispatches cleanly via hidden iframe, avoiding modal clipping or scroll-cutoffs.
 */
export function printTeacherCredentialsReport(options: PrintTeacherCredentialsOptions): boolean {
  const inst = options.institution || 'الثانوية الإعدادية ايكسان';
  const year = options.academicYear || '2026/2027';
  const director = options.directorName || 'السيد مدير المؤسسة';
  const viewMode = options.viewMode || 'cards';
  const list = options.teachers || [];

  const headerHtml = buildOfficialMoroccanHeaderHtml({
    institution: inst,
    academicYear: year,
    dateLabel: 'تاريخ الاستخراج',
    middleIcon: '🔐'
  });

  let bodyContent = '';

  if (viewMode === 'cards') {
    const cardsHtml = list.map((t, idx) => {
      const pwd = t.password && t.password.trim() ? t.password.trim() : '123456';
      const subj = t.subject && t.subject.trim() ? t.subject.trim() : 'هيئة التدريس';

      return `
        <div class="teacher-card">
          <div class="cut-indicator">✂️ قـص من هـنـا (بطاقة رقم ${idx + 1})</div>
          
          <div class="card-top">
            <div>
              <span class="inst-tag">${escapeHtml(inst)} • ${escapeHtml(year)}</span>
              <span class="card-title">وصل تسليم الحساب الشخصي (منظومة الفصول)</span>
            </div>
            <span class="subj-badge">${escapeHtml(subj)}</span>
          </div>

          <div class="cred-box">
            <div class="cred-row">
              <span class="lbl">الأستاذ(ة):</span>
              <span class="val-name">${escapeHtml(t.fullName)}</span>
            </div>
            <div class="cred-row">
              <span class="lbl">المادة الدراسية:</span>
              <span class="val">${escapeHtml(subj)}</span>
            </div>
            <div class="cred-row highlight-user">
              <span class="lbl">اسم المستخدم (Login):</span>
              <span class="val-mono">${escapeHtml(t.username)}</span>
            </div>
            <div class="cred-row">
              <span class="lbl">البريد الإلكتروني:</span>
              <span class="val-mono-sm">${escapeHtml(t.email)}</span>
            </div>
            <div class="pwd-box">
              <span class="pwd-lbl">🔒 كلمة المرور الأولية:</span>
              <span class="pwd-val">${escapeHtml(pwd)}</span>
            </div>
          </div>

          <p class="sec-note">
            ⚠️ <b>توجيه أمني:</b> هذا الوصل شخصي وسري. يرجى تسجيل الدخول وتغيير كلمة المرور فوراً من خانة "الملف الشخصي" لضمان أمان حسابكم.
          </p>

          <div class="receipt-row">
            <span>تاريخ التسليم: .... / .... / 202..</span>
            <span>توقيع الأستاذ بالاستلام: ....................</span>
          </div>
        </div>
      `;
    }).join('');

    bodyContent = `
      <div class="cards-grid">
        ${cardsHtml}
      </div>
    `;
  } else {
    // Master Table View
    const rowsHtml = list.map((t, idx) => {
      const pwd = t.password && t.password.trim() ? t.password.trim() : '123456';
      const subj = t.subject && t.subject.trim() ? t.subject.trim() : '—';
      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-weight: bold; color: #1E3B2C;">${escapeHtml(t.fullName)}</td>
          <td style="text-align: center;">${escapeHtml(subj)}</td>
          <td style="font-family: monospace; font-weight: bold;">${escapeHtml(t.username)}</td>
          <td style="font-family: monospace; font-size: 11px;">${escapeHtml(t.email)}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold; font-size: 13px; color: #92400e; background: #fffbeb;">${escapeHtml(pwd)}</td>
          <td style="text-align: center; font-size: 10px; color: #666;">..... / ..... / 202..</td>
          <td style="text-align: center;"><div style="height: 22px; border-bottom: 1px dotted #999;"></div></td>
        </tr>
      `;
    }).join('');

    bodyContent = `
      <table class="master-table">
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>الأستاذ(ة)</th>
            <th style="text-align: center;">المادة</th>
            <th>اسم المستخدم</th>
            <th>البريد الإلكتروني</th>
            <th style="text-align: center; width: 110px;">كلمة المرور الأولية</th>
            <th style="text-align: center; width: 90px;">تاريخ التسليم</th>
            <th style="text-align: center; width: 130px;">توقيع الأستاذ بالاستلام</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="table-signatures">
        <div>
          <b>ملاحظة إدارية:</b>
          <p style="margin: 4px 0 0 0; color: #555; font-size: 11px;">
            تُحفظ هذه اللائحة الموقعة لدى إدارة المؤسسة كأرشيف رسمي يثبت تسليم حسابات الولوج لكافة أطر هيئة التدريس.
          </p>
        </div>
        <div style="text-align: center;">
          <b>توقيع وخاتم السيد مدير المؤسسة</b>
          <p style="margin: 30px 0 0 0; font-size: 11px; color: #333;">${escapeHtml(director)}</p>
        </div>
      </div>
    `;
  }

  const docTitle = viewMode === 'cards'
    ? 'بطاقات تسليم بيانات الولوج للحسابات الشخصية لهيئة التدريس'
    : 'لائحة تسليم بيانات الولوج للحسابات الشخصية مع التوقيع بالاستلام';

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(docTitle)} - ${escapeHtml(inst)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Amiri', 'Traditional Arabic', 'Segoe UI', Tahoma, sans-serif;
          margin: 0;
          padding: 5mm;
          color: #111;
          background: #fff;
          direction: rtl;
        }
        ${OFFICIAL_HEADER_CSS}

        .title-container {
          text-align: center;
          margin: 10px 0 16px 0;
        }
        .main-title {
          display: inline-block;
          font-size: 17px;
          font-weight: bold;
          color: #1E3B2C;
          background: #f0fdf4;
          border: 1.5px solid #1E3B2C;
          border-radius: 20px;
          padding: 5px 24px;
          margin: 0 0 4px 0;
        }
        .sub-title {
          font-size: 11px;
          color: #666;
        }

        /* CARDS GRID */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .teacher-card {
          position: relative;
          border: 1.5px dashed #78716c;
          border-radius: 8px;
          padding: 10px 12px;
          background: #fff;
          page-break-inside: avoid;
          break-inside: avoid;
          display: flex;
          flex-col;
          justify-content: space-between;
        }
        .cut-indicator {
          font-size: 9px;
          font-family: monospace;
          color: #78716c;
          margin-bottom: 4px;
          padding-bottom: 3px;
          border-bottom: 1px dotted #e7e5e4;
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
        }
        .inst-tag {
          display: block;
          font-size: 9px;
          color: #1E3B2C;
          font-weight: bold;
        }
        .card-title {
          display: block;
          font-size: 11px;
          font-weight: bold;
          color: #1c1917;
        }
        .subj-badge {
          font-size: 10px;
          font-weight: bold;
          background: #f5f5f4;
          border: 1px solid #d6d3d1;
          color: #44403c;
          padding: 2px 7px;
          border-radius: 12px;
        }

        .cred-box {
          background: #fafaf9;
          border: 1px solid #e7e5e4;
          border-radius: 6px;
          padding: 6px 8px;
          margin-bottom: 6px;
          font-size: 11px;
        }
        .cred-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
        }
        .cred-row.highlight-user {
          border-top: 1px solid #f0edea;
          padding-top: 3px;
        }
        .lbl {
          color: #57534e;
          font-size: 10px;
        }
        .val-name {
          font-weight: bold;
          font-size: 12px;
          color: #1E3B2C;
        }
        .val {
          font-weight: 600;
          color: #292524;
        }
        .val-mono {
          font-family: monospace;
          font-weight: bold;
          font-size: 12px;
          background: #fff;
          padding: 1px 6px;
          border: 1px solid #d6d3d1;
          border-radius: 4px;
          color: #1E3B2C;
        }
        .val-mono-sm {
          font-family: monospace;
          font-size: 10px;
          color: #44403c;
        }

        .pwd-box {
          background: #fffbeb;
          border: 1.5px solid #d97706;
          border-radius: 5px;
          padding: 4px 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 5px;
        }
        .pwd-lbl {
          font-size: 10px;
          font-weight: bold;
          color: #92400e;
        }
        .pwd-val {
          font-family: monospace;
          font-weight: bold;
          font-size: 14px;
          letter-spacing: 2px;
          color: #78350f;
        }

        .sec-note {
          font-size: 8.5px;
          color: #78716c;
          line-height: 1.3;
          margin: 4px 0 6px 0;
        }
        .receipt-row {
          border-top: 1px dotted #a8a29e;
          padding-top: 5px;
          display: flex;
          justify-content: space-between;
          font-size: 9.5px;
          color: #44403c;
        }

        /* MASTER TABLE */
        .master-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-bottom: 15px;
        }
        .master-table th {
          background: #1E3B2C;
          color: #fff;
          padding: 6px 8px;
          border: 1px solid #1E3B2C;
          font-size: 11px;
        }
        .master-table td {
          padding: 5px 8px;
          border: 1px solid #d6d3d1;
        }
        .master-table tr:nth-child(even) {
          background: #fafaf9;
        }
        .table-signatures {
          border: 1px solid #1E3B2C;
          border-radius: 6px;
          background: #fafaf9;
          padding: 10px 14px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          font-size: 11px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
      </style>
    </head>
    <body>
      ${headerHtml}

      <div class="title-container">
        <div class="main-title">${escapeHtml(docTitle)}</div>
        <div class="sub-title">منظومة تدبير الفصول الدراسية وتتبع الغياب • إجمالي الأساتذة: ${list.length}</div>
      </div>

      ${bodyContent}
    </body>
    </html>
  `;

  return printReportHtml(html);
}
