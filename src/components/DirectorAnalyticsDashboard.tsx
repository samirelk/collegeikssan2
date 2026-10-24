import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart3,
  FileCheck2,
  MailWarning,
  Users,
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Stethoscope,
  ChevronDown,
  RefreshCw,
  Building,
  School,
  FileText,
  UserCheck,
  ShieldAlert,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { User, Section, AppSettings } from '../types';

interface DirectorAnalyticsDashboardProps {
  currentUser: User;
  sections: Section[];
  settings: AppSettings;
  onRefresh?: () => void;
}

interface AnalyticsData {
  overview: {
    totalStudents: number;
    totalSections: number;
    totalAbsenceCases: number;
    totalTardyCases: number;
    totalJustifiedAbsences: number;
    totalUnjustifiedAbsences: number;
    justifiedPercentage: number;
    totalAbsenceHours: number;
    totalViolations: number;
    totalPositiveParticipations: number;
    totalPositivePoints: number;
    attendanceRate: number;
    summonsStats: {
      total: number;
      pending: number;
      attended: number;
      signedCommitment: number;
      absent: number;
    };
  };
  levelBreakdown: Array<{
    level: string;
    sectionsCount: number;
    studentsCount: number;
    absencesCount: number;
    justifiedCount: number;
    absencePerStudent: number;
  }>;
  weekdayBreakdown: Array<{
    dayIndex: number;
    name: string;
    count: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    absences: number;
    tardies: number;
    justified: number;
  }>;
  violationsBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  topAbsentSections: Array<{
    sectionId: string;
    label: string;
    count: number;
    hours: number;
  }>;
}

interface SummonsItem {
  id: string;
  sectionId: string;
  sectionLevel?: string;
  sectionClass?: string;
  studentName: string;
  studentNumber?: string;
  massarNumber?: string;
  reason: string;
  summonsDate: string;
  appointmentTime: string;
  status: 'pending' | 'attended' | 'signed_commitment' | 'absent';
  guardianName?: string;
  notes?: string;
  createdAt: string;
}

interface RepeatedStudent {
  studentName: string;
  studentNumber: string;
  massarNumber?: string;
  sectionId: string;
  sectionName: string;
  absencesCount: number;
  latesCount: number;
  unjustifiedCount: number;
  justifiedCount: number;
  totalHours: number;
  lastAbsenceDate: string;
  riskLevel: 'critical' | 'warning';
}

export const DirectorAnalyticsDashboard: React.FC<DirectorAnalyticsDashboardProps> = ({
  currentUser,
  sections,
  settings,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'charts' | 'justifications' | 'summons'>('charts');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [summonsList, setSummonsList] = useState<SummonsItem[]>([]);
  const [repeatedStudents, setRepeatedStudents] = useState<RepeatedStudent[]>([]);
  const [rawAbsences, setRawAbsences] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Justification Modal State
  const [justifyingAbsence, setJustifyingAbsence] = useState<any | null>(null);
  const [justificationReason, setJustificationReason] = useState('شهادة طبية');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [justifiedDays, setJustifiedDays] = useState('1');
  const [justificationNotes, setJustificationNotes] = useState('');
  const [isSubmittingJustification, setIsSubmittingJustification] = useState(false);

  // New Summons Modal State
  const [isNewSummonsOpen, setIsNewSummonsOpen] = useState(false);
  const [summonsSectionId, setSummonsSectionId] = useState('');
  const [summonsStudentName, setSummonsStudentName] = useState('');
  const [summonsMassar, setSummonsMassar] = useState('');
  const [summonsReason, setSummonsReason] = useState('تكرار الغياب غير المبرر وتجاوز العتبة المسموح بها');
  const [summonsDate, setSummonsDate] = useState(new Date().toISOString().slice(0, 10));
  const [summonsTime, setSummonsTime] = useState('09:30');
  const [summonsGuardian, setSummonsGuardian] = useState('');
  const [summonsNotes, setSummonsNotes] = useState('');
  const [isCreatingSummons, setIsCreatingSummons] = useState(false);

  // Printable Summons Target
  const [printSummonsTarget, setPrintSummonsTarget] = useState<SummonsItem | null>(null);

  // Filters for Justifications table
  const [justFilterSection, setJustFilterSection] = useState('all');
  const [justFilterStatus, setJustFilterStatus] = useState<'all' | 'unjustified' | 'justified'>('unjustified');
  const [justSearchText, setJustSearchText] = useState('');

  // Load all initial data
  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [analyticsRes, summonsRes, repeatedRes, archiveRes] = await Promise.all([
        fetch('/api/analytics/institutional'),
        fetch('/api/parent-summons'),
        fetch('/api/attendance/repeated-absences?threshold=3'),
        fetch('/api/daily-archive')
      ]);

      const [analyticsJson, summonsJson, repeatedJson, archiveJson] = await Promise.all([
        analyticsRes.json(),
        summonsRes.json(),
        repeatedRes.json(),
        archiveRes.json()
      ]);

      if (analyticsJson.success) {
        setAnalytics(analyticsJson);
      }
      if (summonsJson.success) {
        setSummonsList(summonsJson.summons || []);
      }
      if (repeatedJson.success) {
        setRepeatedStudents(repeatedJson.students || []);
      }
      if (archiveJson.success && Array.isArray(archiveJson.absences)) {
        setRawAbsences(archiveJson.absences);
      }
    } catch (err: any) {
      console.error('Failed to load institutional analytics:', err);
      setFeedback({ message: 'تعذر تحميل بيانات الإحصائيات الشاملة', type: 'error' });
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save Justification
  const handleSaveJustification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justifyingAbsence) return;

    try {
      setIsSubmittingJustification(true);
      const combinedReason = `${justificationReason}${certificateNumber ? ` - شهادة رقم: ${certificateNumber}` : ''}${doctorName ? ` (د. ${doctorName})` : ''} [${justifiedDays} يوم]`;
      const combinedNotes = `${justifyingAbsence.notes ? `${justifyingAbsence.notes} | ` : ''}${justificationNotes}`.trim();

      const res = await fetch(`/api/daily-archive/absences/${justifyingAbsence.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: justifyingAbsence.status,
          sessionPeriod: justifyingAbsence.sessionPeriod,
          justified: 'justified',
          justificationReason: combinedReason,
          notes: combinedNotes
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر حفظ التبرير');

      setFeedback({
        message: `تم توثيق تبرير الغياب للتلميذ (${justifyingAbsence.studentName}) بنجاح`,
        type: 'success'
      });
      setJustifyingAbsence(null);
      setCertificateNumber('');
      setDoctorName('');
      setJustificationNotes('');
      fetchData(true);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setIsSubmittingJustification(false);
    }
  };

  // Create Parent Summons
  const handleCreateSummons = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summonsSectionId || !summonsStudentName.trim() || !summonsReason.trim()) {
      alert('المرجو ملء جميع الحقول الإلزامية');
      return;
    }

    try {
      setIsCreatingSummons(true);
      const res = await fetch('/api/parent-summons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          sectionId: summonsSectionId,
          studentName: summonsStudentName.trim(),
          massarNumber: summonsMassar.trim(),
          reason: summonsReason.trim(),
          summonsDate,
          appointmentTime: summonsTime,
          guardianName: summonsGuardian.trim(),
          notes: summonsNotes.trim()
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر إنشاء الاستدعاء');

      setFeedback({ message: `تم إنشاء استدعاء ولي أمر التلميذ (${summonsStudentName}) بنجاح`, type: 'success' });
      setIsNewSummonsOpen(false);
      setSummonsStudentName('');
      setSummonsMassar('');
      setSummonsGuardian('');
      setSummonsNotes('');
      fetchData(true);
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setIsCreatingSummons(false);
    }
  };

  // Update Summons Status
  const handleUpdateSummonsStatus = async (id: string, nextStatus: 'pending' | 'attended' | 'signed_commitment' | 'absent') => {
    try {
      const res = await fetch(`/api/parent-summons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (json.success) {
        setSummonsList(prev => prev.map(item => item.id === id ? { ...item, status: nextStatus } : item));
        setFeedback({ message: 'تم تحديث حالة الاستدعاء بنجاح', type: 'success' });
      }
    } catch (err: any) {
      setFeedback({ message: 'تعذر تحديث حالة الاستدعاء', type: 'error' });
    }
  };

  // Delete Summons
  const handleDeleteSummons = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف استدعاء التلميذ "${name}"؟`)) return;
    try {
      const res = await fetch(`/api/parent-summons/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setSummonsList(prev => prev.filter(item => item.id !== id));
        setFeedback({ message: 'تم حذف الاستدعاء بنجاح', type: 'success' });
      }
    } catch (err: any) {
      setFeedback({ message: 'تعذر حذف الاستدعاء', type: 'error' });
    }
  };

  // Print Official Summons Document
  const handlePrintSummonsModal = (item: SummonsItem) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>استدعاء ولي أمر التلميذ - ${item.studentName}</title>
        <style>
          @page { size: A5 landscape; margin: 12mm; }
          body {
            font-family: 'Amiri', 'Traditional Arabic', serif, system-ui;
            direction: rtl;
            color: #1F2926;
            background: #fff;
            padding: 10px;
            font-size: 13pt;
            line-height: 1.6;
          }
          .border-box {
            border: 2px double #1A4E47;
            padding: 20px;
            border-radius: 8px;
            height: 94%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            text-align: center;
            border-bottom: 1.5px solid #C98A3C;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .header h2 { margin: 0 0 4px 0; font-size: 15pt; color: #1A4E47; }
          .header h3 { margin: 0; font-size: 12pt; font-weight: normal; color: #555; }
          .title {
            text-align: center;
            margin: 10px 0;
            padding: 6px 14px;
            background: #F4EFDE;
            border: 1px solid #C98A3C;
            border-radius: 6px;
            font-weight: bold;
            font-size: 16pt;
            color: #1A4E47;
            display: inline-block;
          }
          .title-wrap { text-align: center; margin-bottom: 10px; }
          .content { margin: 15px 0; }
          .data-line { margin-bottom: 8px; }
          .data-label { font-weight: bold; color: #1A4E47; }
          .highlight { font-weight: bold; font-size: 14pt; }
          .footer {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px dashed #aaa;
          }
          .signature-box { text-align: center; width: 45%; }
          .cut-line {
            border-top: 1px dashed #999;
            margin-top: 25px;
            padding-top: 8px;
            font-size: 10pt;
            color: #777;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="border-box">
          <div>
            <div class="header">
              <h2>المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة</h2>
              <h3>الأكاديمية الجهوية للتربية والتكوين • المديرية الإقليمية بالناظور</h3>
              <div style="font-weight: bold; color: #1A4E47; margin-top: 4px;">
                ${settings.institution || 'الثانوية الإعدادية إيكسان'}
              </div>
            </div>

            <div class="title-wrap">
              <div class="title">استدعاء ولي أمر التلميذ(ة)</div>
            </div>

            <div class="content">
              <p>
                يشرف إدارة المؤسسة دعوة السيد(ة): <strong>${item.guardianName || 'ولي(ة) أمر التلميذ(ة)'}</strong>
              </p>
              <div class="data-line">
                <span class="data-label">ولي أمر التلميذ(ة):</span>
                <span class="highlight">${item.studentName}</span>
                ${item.massarNumber ? `&nbsp; (رقم مسار: <code>${item.massarNumber}</code>)` : ''}
              </div>
              <div class="data-line">
                <span class="data-label">القسم والمستوى:</span>
                <span>${item.sectionLevel || ''} - القسم ${item.sectionClass || ''}</span>
              </div>
              <div class="data-line">
                <span class="data-label">سبب الاستدعاء:</span>
                <span style="color: #991b1b; font-weight: bold;">${item.reason}</span>
              </div>
              <p style="margin-top: 12px; line-height: 1.8;">
                نرجو منكم الحضور شخصياً لمكتب الحراسة العامة / إدارة المؤسسة يوم: 
                <strong>${item.summonsDate}</strong> على الساعة: <strong>${item.appointmentTime}</strong> 
                لأمر يهم المسار الدراسي والانضباط التربوي لابنكم(تكم).
              </p>
            </div>
          </div>

          <div>
            <div class="footer">
              <div class="signature-box">
                <div>توقيع ولي الأمر</div>
                <div style="height: 45px;"></div>
                <div style="font-size: 11pt; color: #666;">(الاطلاع وتأكيد الحضور)</div>
              </div>
              <div class="signature-box">
                <div>إدارة المؤسسة / الحراسة العامة</div>
                <div style="height: 45px;"></div>
                <div style="font-size: 11pt; font-weight: bold; color: #1A4E47;">خاتم وتأشيرة الإدارة</div>
              </div>
            </div>

            <div class="cut-line">
              تنبيه: يعتبر حضور ولي الأمر واجباً تربوياً وأساسياً لضمان السير العادي للدراسة وحماية مصلحة التلميذ.
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Print Full Institutional Analytics Report
  const handlePrintAnalyticsReport = () => {
    if (!analytics) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>التقرير الإحصائي والتحليلي السنوي - ${settings.institution}</title>
        <style>
          @page { size: A4 portrait; margin: 14mm; }
          body {
            font-family: 'Amiri', 'Traditional Arabic', serif, system-ui;
            direction: rtl;
            color: #1F2926;
            background: #fff;
            padding: 10px;
            font-size: 12pt;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1A4E47;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            color: #1A4E47;
            margin: 15px 0;
            text-decoration: underline;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .card {
            border: 1px solid #C98A3C;
            background: #FAF8F5;
            padding: 10px;
            border-radius: 6px;
            text-align: center;
          }
          .card-value { font-size: 18pt; font-weight: bold; color: #1A4E47; }
          .card-label { font-size: 10pt; color: #555; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 11pt;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 8px 10px;
            text-align: center;
          }
          th { background: #1A4E47; color: #fff; }
          tr:nth-child(even) { background: #F4EFDE; }
          .section-title {
            font-size: 14pt;
            font-weight: bold;
            color: #1A4E47;
            margin-top: 25px;
            border-bottom: 1.5px solid #C98A3C;
            padding-bottom: 4px;
          }
          .footer {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة</h2>
          <div style="font-size: 13px; color: #44403c; margin: 3px 0;">${settings.academy || 'الأكاديمية الجهوية للتربية والتكوين - جهة الشرق'} • ${settings.directorate || 'المديرية الإقليمية بالناظور'}</div>
          <h3>${settings.institution || 'الثانوية الإعدادية ايكسان'} • الموسم الدراسي: ${settings.year || '2026/2027'}</h3>
        </div>

        <div class="title">تقرير تحليلي شامل لمؤشرات الانضباط والمواظبة التربوية</div>

        <div class="grid">
          <div class="card">
            <div class="card-value">${analytics.overview.attendanceRate}%</div>
            <div class="card-label">نسبة المواظبة العامة</div>
          </div>
          <div class="card">
            <div class="card-value">${analytics.overview.totalAbsenceCases}</div>
            <div class="card-label">إجمالي حالات الغياب</div>
          </div>
          <div class="card">
            <div class="card-value">${analytics.overview.justifiedPercentage}%</div>
            <div class="card-label">نسبة الغياب المبرر</div>
          </div>
          <div class="card">
            <div class="card-value">${analytics.overview.totalViolations}</div>
            <div class="card-label">إجمالي المخالفات المسجلة</div>
          </div>
          <div class="card">
            <div class="card-value">${analytics.overview.totalPositivePoints}</div>
            <div class="card-label">نقاط التميز والمشاركات الإيجابية</div>
          </div>
          <div class="card">
            <div class="card-value">${analytics.overview.summonsStats.total}</div>
            <div class="card-label">استدعاءات أولياء الأمور</div>
          </div>
        </div>

        <div class="section-title">1. التوزيع حسب المستويات الدراسية</div>
        <table>
          <thead>
            <tr>
              <th>المستوى الدراسي</th>
              <th>عدد الأقسام</th>
              <th>عدد التلاميذ</th>
              <th>حالات الغياب</th>
              <th>الغياب المبرر</th>
              <th>معدل الغياب لكل تلميذ</th>
            </tr>
          </thead>
          <tbody>
            ${analytics.levelBreakdown.map(l => `
              <tr>
                <td><strong>${l.level}</strong></td>
                <td>${l.sectionsCount}</td>
                <td>${l.studentsCount}</td>
                <td>${l.absencesCount}</td>
                <td>${l.justifiedCount}</td>
                <td>${l.absencePerStudent} حالة/تلميذ</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">2. أكثر أيام الأسبوع تسجيلاً لحالات الغياب</div>
        <table>
          <thead>
            <tr>
              ${analytics.weekdayBreakdown.map(w => `<th>${w.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${analytics.weekdayBreakdown.map(w => `<td><strong>${w.count}</strong> حالة</td>`).join('')}
            </tr>
          </tbody>
        </table>

        <div class="section-title">3. توزيع المخالفات السلوكية</div>
        <table>
          <thead>
            <tr>
              <th>نوع المخالفة</th>
              <th>العدد</th>
              <th>النسبة المئوية</th>
            </tr>
          </thead>
          <tbody>
            ${analytics.violationsBreakdown.map(v => `
              <tr>
                <td style="text-align: right; padding-right: 15px;">${v.type}</td>
                <td><strong>${v.count}</strong></td>
                <td>${v.percentage}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>تاريخ إصدار التقرير: ${new Date().toLocaleDateString('ar-MA')}</div>
          <div><strong>خاتم وتأشيرة رئيس المؤسسة</strong></div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Filtered Absences for Justifications Tab
  const filteredAbsences = rawAbsences.filter(abs => {
    if (justFilterSection !== 'all' && abs.sectionId !== justFilterSection) return false;
    if (justFilterStatus === 'unjustified' && abs.justified === 'justified') return false;
    if (justFilterStatus === 'justified' && abs.justified !== 'justified') return false;
    if (justSearchText.trim()) {
      const q = justSearchText.trim().toLowerCase();
      const matchName = (abs.studentName || '').toLowerCase().includes(q);
      const matchMassar = (abs.massarNumber || '').toLowerCase().includes(q);
      if (!matchName && !matchMassar) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5" dir="rtl">
      {/* Top Banner & Tab Controls */}
      <div className="p-5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#1A4E47] text-white font-bold text-[11px]">
              المقترح رقم 5: وحدة التحليلات المتقدمة وتبرير الغيابات
            </span>
            <span className="text-xs text-[#6C6356] font-medium">
              لوحة قيادة تربوية ومؤشرات أداء متكاملة
            </span>
          </div>
          <h2 className="text-xl font-bold font-serif text-[#1F2926]">
            الإحصائيات والتحليلات البيانية، تبرير الغيابات واستدعاءات الأولياء
          </h2>
          <p className="text-xs text-[#6C6356] mt-1 max-w-2xl leading-relaxed">
            متابعة نسب المواظبة، منحنيات تطور الغياب، توثيق الشواهد الطبية والتبريرات الإدارية، وإصدار وطباعة استدعاءات أولياء الأمور الرسمية.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handlePrintAnalyticsReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#D5CDC0] font-bold text-xs transition-all cursor-pointer shadow-xs"
            title="طباعة التقرير التحليلي الإحصائي الشامل"
          >
            <Printer className="w-4 h-4 text-[#C98A3C]" />
            <span>طباعة التقرير الإحصائي</span>
          </button>

          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold hover:underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Sub-Tabs Selector */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FAF8F5] border border-[#E5DFD4] rounded-2xl flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('charts')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'charts'
              ? 'bg-[#1A4E47] text-white shadow-xs'
              : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>المؤشرات والرسوم البيانية (Analytics & Charts)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('justifications')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'justifications'
              ? 'bg-[#1A4E47] text-white shadow-xs'
              : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-white'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-[#C98A3C]" />
          <span>سجل تبريرات الغياب والشهادات الطبية</span>
          {analytics && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-mono font-bold">
              {analytics.overview.totalUnjustifiedAbsences} غير مبرر
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('summons')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'summons'
              ? 'bg-[#1A4E47] text-white shadow-xs'
              : 'text-[#6C6356] hover:text-[#1F2926] hover:bg-white'
          }`}
        >
          <MailWarning className="w-4 h-4 text-amber-600" />
          <span>سجل استدعاءات أولياء الأمور</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-mono font-bold">
            {summonsList.length}
          </span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="p-12 text-center bg-white rounded-3xl border border-[#E5DFD4]">
          <RefreshCw className="w-8 h-8 text-[#1A4E47] animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-[#1F2926]">جاري تحميل الرسوم البيانية ومؤشرات المؤسسة...</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: CHARTS & STATISTICAL INDICATORS                   */}
      {/* ======================================================== */}
      {!isLoading && activeTab === 'charts' && analytics && (
        <div className="space-y-6">
          {/* 1. KPI Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>المواظبة العامة</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-[#1A4E47] mt-1 font-mono">
                {analytics.overview.attendanceRate}%
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                {analytics.overview.attendanceRate >= 90 ? 'مستوى انضباط ممتاز' : 'يحتاج متابعة تربوية'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>حالات الغياب</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-[#1F2926] mt-1 font-mono">
                {analytics.overview.totalAbsenceCases}
              </div>
              <div className="text-[10px] text-[#6C6356] mt-1">
                إجمالي {analytics.overview.totalAbsenceHours} ساعة
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>الغياب المبرر</span>
                <FileCheck2 className="w-3.5 h-3.5 text-[#C98A3C]" />
              </div>
              <div className="text-2xl font-bold text-[#C98A3C] mt-1 font-mono">
                {analytics.overview.justifiedPercentage}%
              </div>
              <div className="text-[10px] text-[#6C6356] mt-1">
                {analytics.overview.totalJustifiedAbsences} من أصل {analytics.overview.totalAbsenceCases}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>المخالفات</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-700 mt-1 font-mono">
                {analytics.overview.totalViolations}
              </div>
              <div className="text-[10px] text-rose-600 font-semibold mt-1">
                إجراءات تأديبية
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>نقاط التميز</span>
                <Award className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
                +{analytics.overview.totalPositivePoints}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                {analytics.overview.totalPositiveParticipations} مشاركة إيجابية
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#6C6356]">
                <span>استدعاءات الأولياء</span>
                <MailWarning className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-800 mt-1 font-mono">
                {analytics.overview.summonsStats.total}
              </div>
              <div className="text-[10px] text-purple-600 font-semibold mt-1">
                {analytics.overview.summonsStats.signedCommitment} التزام موقع
              </div>
            </div>
          </div>

          {/* 2. Visual Graphs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart A: Monthly Trend (SVG Bars) */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#1F2926]">
                      منحنى تطور الغياب الشهري (Monthly Attendance Trend)
                    </h3>
                    <p className="text-[11px] text-[#6C6356] mt-0.5">
                      تطور حالات الغياب والغياب المبرر على مدار الأشهر
                    </p>
                  </div>
                  <BarChart3 className="w-4 h-4 text-[#1A4E47]" />
                </div>

                {analytics.monthlyTrends.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#6C6356]">
                    لا توجد بيانات غياب شهرية كافية للرسم البياني حتى الآن
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Visual Bar representation */}
                    <div className="h-48 flex items-end justify-between gap-2 pt-6 border-b border-[#E5DFD4]">
                      {(() => {
                        const maxAbs = Math.max(...analytics.monthlyTrends.map(m => m.absences), 10);
                        return analytics.monthlyTrends.map((item, idx) => {
                          const heightPct = Math.round((item.absences / maxAbs) * 100);
                          const justifiedPct = item.absences > 0 ? Math.round((item.justified / item.absences) * 100) : 0;
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                              {/* Hover Tooltip */}
                              <div className="absolute -top-10 bg-[#1A4E47] text-white text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-md">
                                {item.absences} غياب ({justifiedPct}% مبرر)
                              </div>
                              <div className="w-full flex items-end justify-center h-36">
                                <div
                                  className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-[#1A4E47] to-[#2D5A27] transition-all relative overflow-hidden group-hover:brightness-110"
                                  style={{ height: `${Math.max(heightPct, 6)}%` }}
                                >
                                  {item.justified > 0 && (
                                    <div
                                      className="absolute bottom-0 inset-x-0 bg-[#C98A3C]"
                                      style={{ height: `${justifiedPct}%` }}
                                      title={`مبرر: ${item.justified}`}
                                    />
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-[#6C6356] font-mono rotate-[-25deg] origin-top-left mt-1">
                                {item.month.slice(5)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    <div className="flex items-center justify-center gap-4 text-xs pt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-[#1A4E47]"></span>
                        <span className="text-[#6C6356]">غياب غير مبرر</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-[#C98A3C]"></span>
                        <span className="text-[#6C6356]">غياب مبرر بشهادة</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart B: Level-by-Level Comparison */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#1F2926]">
                      مقارنة المستويات الدراسية (Levels Comparison)
                    </h3>
                    <p className="text-[11px] text-[#6C6356] mt-0.5">
                      معدل الغياب لكل تلميذ ونسبة التبرير حسب كل مستوى
                    </p>
                  </div>
                  <School className="w-4 h-4 text-[#C98A3C]" />
                </div>

                <div className="space-y-4">
                  {analytics.levelBreakdown.map((lvl, idx) => {
                    const maxVal = Math.max(...analytics.levelBreakdown.map(l => l.absencePerStudent), 1);
                    const widthPct = Math.min(Math.round((lvl.absencePerStudent / maxVal) * 100), 100);

                    return (
                      <div key={idx} className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD4] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#1F2926]">{lvl.level}</span>
                          <span className="font-mono text-[#1A4E47] font-semibold">
                            {lvl.absencePerStudent} غياب/تلميذ ({lvl.absencesCount} حالة إجمالاً)
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-[#E5DFD4] overflow-hidden flex">
                          <div
                            className="h-full bg-[#1A4E47] rounded-full transition-all"
                            style={{ width: `${Math.max(widthPct, 5)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#6C6356]">
                          <span>{lvl.sectionsCount} أقسام • {lvl.studentsCount} تلميذاً</span>
                          <span className="text-emerald-700 font-semibold">
                            {lvl.justifiedCount} مبرر ({lvl.absencesCount > 0 ? Math.round((lvl.justifiedCount / lvl.absencesCount) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart C: Weekday Absence Heatmap */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-[#1F2926]">
                    أكثر أيام الأسبوع تسجيلاً للغياب (Weekday Distribution)
                  </h3>
                  <p className="text-[11px] text-[#6C6356] mt-0.5">
                    تحديد أيام الذروة الأسبوعية للتدخل الاستباقي ومتابعة الحراسة العامة
                  </p>
                </div>
                <Calendar className="w-4 h-4 text-[#1A4E47]" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {analytics.weekdayBreakdown.map((day, idx) => {
                  const maxDayCount = Math.max(...analytics.weekdayBreakdown.map(d => d.count), 1);
                  const isPeak = day.count === maxDayCount && day.count > 0;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isPeak
                          ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30'
                          : 'bg-[#FAF8F5] border-[#E5DFD4]'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#1F2926]">{day.name}</div>
                      <div className="text-xl font-bold font-mono text-[#1A4E47] mt-1.5">
                        {day.count}
                      </div>
                      <div className="text-[10px] mt-1 font-semibold text-[#6C6356]">
                        {isPeak ? 'يوم الذروة 🔥' : 'حالة غياب'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart D: Violations Breakdown */}
            <div className="p-5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-[#1F2926]">
                    توزيع المخالفات السلوكية (Violations Breakdown)
                  </h3>
                  <p className="text-[11px] text-[#6C6356] mt-0.5">
                    الأنواع الأكثر شيوعاً للمخالفات للتوجيه والإرشاد التربوي
                  </p>
                </div>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>

              {analytics.violationsBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6C6356]">
                  لم يتم تسجيل مخالفات سلوكية حتى الآن
                </div>
              ) : (
                <div className="space-y-3">
                  {analytics.violationsBreakdown.slice(0, 5).map((v, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#1F2926]">{v.type}</span>
                        <span className="font-mono text-rose-700 font-bold">
                          {v.count} حالة ({v.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E5DFD4] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-l from-rose-500 to-amber-600 rounded-full"
                          style={{ width: `${v.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. Early Warning Table: Repeat Absence Students */}
          <div className="p-5 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1F2926]">
                    قائمة الإنذار المبكر للتلاميذ ذوي الغيابات المتكررة (Early Warning System)
                  </h3>
                  <p className="text-[11px] text-[#6C6356]">
                    تلاميذ تجاوزوا 3 غيابات أو أكثر يستوجبون استدعاء ولي الأمر والتدخل الإداري
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                {repeatedStudents.length} تلميذ
              </span>
            </div>

            {repeatedStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-700 font-bold bg-emerald-50 rounded-xl border border-emerald-200">
                ✓ لا يوجد أي تلميذ يتجاوز عتبة الغياب المتكرر حالياً. انضباط ممتاز!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[#E5DFD4] text-[#6C6356]">
                      <th className="py-2.5 px-3">التلميذ</th>
                      <th className="py-2.5 px-3">القسم</th>
                      <th className="py-2.5 px-3">الغيابات الكلية</th>
                      <th className="py-2.5 px-3">غير مبرر</th>
                      <th className="py-2.5 px-3">ساعات الغياب</th>
                      <th className="py-2.5 px-3">مستوى الخطر</th>
                      <th className="py-2.5 px-3 text-center">إجراء فوري</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DFD4]">
                    {repeatedStudents.map((st, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#1F2926]">
                          {st.studentName}
                          {st.massarNumber && (
                            <span className="text-[10px] text-[#6C6356] font-mono block">
                              مسار: {st.massarNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#1A4E47] font-semibold">
                          {st.sectionName}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                          {st.absencesCount} غياب
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-700">
                          {st.unjustifiedCount} غير مبرر
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#6C6356]">
                          {st.totalHours} س
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              st.riskLevel === 'critical'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {st.riskLevel === 'critical' ? 'حرج جداً' : 'تنبيه'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSummonsSectionId(st.sectionId);
                              setSummonsStudentName(st.studentName);
                              setSummonsMassar(st.massarNumber || '');
                              setSummonsReason(`تكرار الغياب (${st.absencesCount} حالات، منها ${st.unjustifiedCount} غير مبررة)`);
                              setIsNewSummonsOpen(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1 mx-auto"
                          >
                            <MailWarning className="w-3 h-3" />
                            <span>استدعاء الولي</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: JUSTIFICATIONS & MEDICAL CERTIFICATES             */}
      {/* ======================================================== */}
      {!isLoading && activeTab === 'justifications' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <input
                  type="text"
                  value={justSearchText}
                  onChange={(e) => setJustSearchText(e.target.value)}
                  placeholder="بحث باسم التلميذ أو رقم مسار..."
                  className="w-full pr-8 pl-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
                <Search className="w-3.5 h-3.5 text-[#6C6356] absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Status Filter */}
              <select
                value={justFilterStatus}
                onChange={(e) => setJustFilterStatus(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-semibold text-[#1F2926]"
              >
                <option value="unjustified">غيابات غير مبررة فقط</option>
                <option value="justified">غيابات مبررة بشواهد</option>
                <option value="all">كافة الغيابات</option>
              </select>

              {/* Section Filter */}
              <select
                value={justFilterSection}
                onChange={(e) => setJustFilterSection(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
              >
                <option value="all">كافة الأقسام والمستويات</option>
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.level} - القسم {sec.classNumber}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[#6C6356] font-bold">
              النتائج المعروضة: {filteredAbsences.length} سجل
            </span>
          </div>

          {/* Absences Table */}
          <div className="bg-white rounded-2xl border border-[#E5DFD4] overflow-hidden shadow-xs">
            {filteredAbsences.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6C6356]">
                لا توجد حالات غياب مطابقة لشروط التصفية الحالية
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[#E5DFD4] text-[#6C6356]">
                      <th className="py-3 px-4">التلميذ ورقم مسار</th>
                      <th className="py-3 px-4">القسم</th>
                      <th className="py-3 px-4">تاريخ الغياب</th>
                      <th className="py-3 px-4">المدة / الفترة</th>
                      <th className="py-3 px-4">الأستاذ المسجل</th>
                      <th className="py-3 px-4">حالة التبرير</th>
                      <th className="py-3 px-4">المبرر / الشهادة الطبية</th>
                      <th className="py-3 px-4 text-center">إجراء التبرير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DFD4]">
                    {filteredAbsences.map((abs, idx) => {
                      const isJust = abs.justified === 'justified';
                      return (
                        <tr key={idx} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1F2926]">{abs.studentName}</div>
                            {abs.massarNumber && (
                              <div className="text-[10px] text-[#6C6356] font-mono">
                                مسار: {abs.massarNumber}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#1A4E47]">
                            {abs.sectionLevel || ''} {abs.sectionClass ? `- ق ${abs.sectionClass}` : ''}
                          </td>
                          <td className="py-3 px-4 font-mono">{abs.recordedDate}</td>
                          <td className="py-3 px-4 text-[#6C6356] font-mono">
                            {abs.durationLabel || abs.sessionPeriod || 'ساعة واحدة'}
                          </td>
                          <td className="py-3 px-4 text-[#6C6356]">
                            {abs.teacherName || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isJust
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isJust ? 'مبرر ✓' : 'غير مبرر ✕'}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-[#555]">
                            {abs.justificationReason || '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setJustifyingAbsence(abs);
                                setJustificationReason('شهادة طبية');
                                setCertificateNumber('');
                                setDoctorName('');
                                setJustifiedDays('1');
                                setJustificationNotes('');
                              }}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1 mx-auto ${
                                isJust
                                  ? 'bg-[#FAF8F5] text-[#1A4E47] border border-[#D5CDC0] hover:bg-[#F2EFE9]'
                                  : 'bg-[#C98A3C] text-white hover:bg-[#B37930]'
                              }`}
                            >
                              <Stethoscope className="w-3.5 h-3.5" />
                              <span>{isJust ? 'تعديل التبرير' : 'تبرير بشهادة'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: OFFICIAL PARENT SUMMONS                           */}
      {/* ======================================================== */}
      {!isLoading && activeTab === 'summons' && (
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DFD4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#1F2926]">سجل استدعاءات أولياء الأمور الرسمية</h3>
              <p className="text-[11px] text-[#6C6356]">
                طباعة وتتبع استدعاءات أولياء الأمور وحالات توقيع التزامات المواظبة والانضباط
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSummonsSectionId(sections[0]?.id || '');
                setSummonsStudentName('');
                setSummonsMassar('');
                setSummonsGuardian('');
                setSummonsReason('تكرار الغياب غير المبرر وتجاوز العتبة المسموح بها');
                setIsNewSummonsOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs transition-all cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء استدعاء ولي أمر جديد</span>
            </button>
          </div>

          {/* Summons List Table */}
          <div className="bg-white rounded-2xl border border-[#E5DFD4] overflow-hidden shadow-xs">
            {summonsList.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6C6356]">
                لم يتم إصدار أي استدعاء لولي أمر حتى الآن. انقر على الزر أعلاه لإنشاء استدعاء رسمي.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[#E5DFD4] text-[#6C6356]">
                      <th className="py-3 px-4">التلميذ</th>
                      <th className="py-3 px-4">القسم</th>
                      <th className="py-3 px-4">ولي الأمر</th>
                      <th className="py-3 px-4">سبب الاستدعاء</th>
                      <th className="py-3 px-4">موعد الحضور</th>
                      <th className="py-3 px-4">حالة الاستدعاء</th>
                      <th className="py-3 px-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DFD4]">
                    {summonsList.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1F2926]">{item.studentName}</div>
                          {item.massarNumber && (
                            <div className="text-[10px] text-[#6C6356] font-mono">مسار: {item.massarNumber}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#1A4E47]">
                          {item.sectionLevel || ''} - ق {item.sectionClass || ''}
                        </td>
                        <td className="py-3 px-4 text-[#555]">
                          {item.guardianName || 'ولي(ة) الأمر'}
                        </td>
                        <td className="py-3 px-4 max-w-xs text-[11px] text-rose-800 font-medium">
                          {item.reason}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <div>{item.summonsDate}</div>
                          <div className="text-[10px] text-[#6C6356]">{item.appointmentTime}</div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={item.status}
                            onChange={(e) => handleUpdateSummonsStatus(item.id, e.target.value as any)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border focus:outline-none cursor-pointer ${
                              item.status === 'signed_commitment'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : item.status === 'attended'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : item.status === 'absent'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            <option value="pending">قيد الانتظار</option>
                            <option value="attended">حضر الولي</option>
                            <option value="signed_commitment">وقع التزاماً رسمياً ✓</option>
                            <option value="absent">لم يحضر (غياب الولي)</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintSummonsModal(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#D5CDC0] font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                              title="طباعة الاستدعاء الرسمي"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#C98A3C]" />
                              <span>طباعة</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSummons(item.id, item.studentName)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                              title="حذف الاستدعاء"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD MEDICAL CERTIFICATE / JUSTIFICATION        */}
      {/* ======================================================== */}
      {justifyingAbsence && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E5DFD4] animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-[#C98A3C]" />
                <h3 className="font-bold text-base text-[#1F2926] font-serif">
                  توثيق تبرير غياب / شهادة طبية
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setJustifyingAbsence(null)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJustification} className="space-y-3.5 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD4]">
                <div className="font-bold text-sm text-[#1A4E47]">{justifyingAbsence.studentName}</div>
                <div className="text-[11px] text-[#6C6356] mt-0.5">
                  القسم: {justifyingAbsence.sectionLevel || ''} - ق {justifyingAbsence.sectionClass || ''} • التاريخ: {justifyingAbsence.recordedDate}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">نوع المبرر القانوني</label>
                <select
                  value={justificationReason}
                  onChange={(e) => setJustificationReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-semibold"
                >
                  <option value="شهادة طبية رسمية">شهادة طبية رسمية</option>
                  <option value="إذن مسبق مسلم من الحراسة العامة">إذن مسبق مسلم من الحراسة العامة</option>
                  <option value="عذر عائلي قاهر مبرر">عذر عائلي قاهر مبرر</option>
                  <option value="مشاركة في تظاهرة مدرسية / رياضية">مشاركة في تظاهرة مدرسية / رياضية</option>
                  <option value="مبرر إداري آخر">مبرر إداري آخر</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">رقم الشهادة الطبية</label>
                  <input
                    type="text"
                    value={certificateNumber}
                    onChange={(e) => setCertificateNumber(e.target.value)}
                    placeholder="مثال: 458/2026"
                    className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">اسم الطبيب / المصحة</label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="مثال: د. الوردي"
                    className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">عدد الأيام المبررة</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={justifiedDays}
                  onChange={(e) => setJustifiedDays(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">ملاحظات وقرار الحراسة العامة</label>
                <textarea
                  rows={2}
                  value={justificationNotes}
                  onChange={(e) => setJustificationNotes(e.target.value)}
                  placeholder="تم إيداع الشهادة في الآجال القانونية وتبرير الغياب..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setJustifyingAbsence(null)}
                  className="px-3.5 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingJustification}
                  className="px-5 py-2 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-1.5"
                >
                  <FileCheck2 className="w-4 h-4 text-[#C98A3C]" />
                  <span>{isSubmittingJustification ? 'جاري الحفظ...' : 'تأكيد وحفظ التبرير'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CREATE OFFICIAL PARENT SUMMONS                  */}
      {/* ======================================================== */}
      {isNewSummonsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E5DFD4] animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD4]">
              <div className="flex items-center gap-2">
                <MailWarning className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-[#1F2926] font-serif">
                  إنشاء استدعاء ولي أمر رسمي
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSummonsOpen(false)}
                className="text-[#6C6356] hover:text-[#1F2926] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSummons} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">القسم والمستوى</label>
                <select
                  required
                  value={summonsSectionId}
                  onChange={(e) => setSummonsSectionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                >
                  <option value="">اختر القسم...</option>
                  {sections.map(sec => (
                    <option key={sec.id} value={sec.id}>
                      {sec.level} - القسم {sec.classNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">اسم التلميذ(ة)</label>
                <input
                  type="text"
                  required
                  value={summonsStudentName}
                  onChange={(e) => setSummonsStudentName(e.target.value)}
                  placeholder="الاسم الكامل للتلميذ"
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">رقم مسار (اختياري)</label>
                  <input
                    type="text"
                    value={summonsMassar}
                    onChange={(e) => setSummonsMassar(e.target.value)}
                    placeholder="Code Massar"
                    className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">اسم ولي الأمر</label>
                  <input
                    type="text"
                    value={summonsGuardian}
                    onChange={(e) => setSummonsGuardian(e.target.value)}
                    placeholder="مثال: الأب / الأم"
                    className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">سبب الاستدعاء</label>
                <textarea
                  rows={2}
                  required
                  value={summonsReason}
                  onChange={(e) => setSummonsReason(e.target.value)}
                  placeholder="سبب الاستدعاء الرسمي..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">تاريخ الحضور</label>
                  <input
                    type="date"
                    required
                    value={summonsDate}
                    onChange={(e) => setSummonsDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2926] mb-1">ساعة الحضور</label>
                  <input
                    type="time"
                    required
                    value={summonsTime}
                    onChange={(e) => setSummonsTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">ملاحظات إدارية إضافية</label>
                <input
                  type="text"
                  value={summonsNotes}
                  onChange={(e) => setSummonsNotes(e.target.value)}
                  placeholder="ملاحظات سرية أو توجيهية..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-[#FAF8F5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setIsNewSummonsOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#6C6356] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSummons}
                  className="px-5 py-2 bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-1.5"
                >
                  <MailWarning className="w-4 h-4 text-amber-300" />
                  <span>{isCreatingSummons ? 'جاري الإنشاء...' : 'حفظ وإصدار الاستدعاء'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
