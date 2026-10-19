import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  KeyRound,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  Lock,
  Download,
  Users,
  Phone
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Section, AppSettings } from '../types';
import { printReportHtml } from '../utils/printNotes';

interface StudentAccountItem {
  id: string;
  massarNumber: string;
  studentName: string;
  sectionId: string;
  sectionLevel?: string;
  sectionClass?: string;
  studentNumber: string;
  accessCode: string;
  photoUrl?: string;
  guardianPhone?: string;
  guardianPhoneVerified?: boolean;
  profileCompleted?: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StudentAccountsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  settings: AppSettings;
}

export const StudentAccountsManagementModal: React.FC<StudentAccountsManagementModalProps> = ({
  isOpen,
  onClose,
  sections,
  settings
}) => {
  const [accounts, setAccounts] = useState<StudentAccountItem[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionAccountId, setActionAccountId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const url = selectedSectionId !== 'all' ? `/api/student/accounts?sectionId=${selectedSectionId}` : '/api/student/accounts';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setAccounts(json.accounts || []);
      }
    } catch (err: any) {
      setFeedback({ message: 'تعذر تحميل حسابات وأكواد التلاميذ', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen, selectedSectionId]);

  if (!isOpen) return null;

  // Regenerate single student access code
  const handleRegenerateCode = async (id: string, name: string) => {
    setActionAccountId(id);
    try {
      const res = await fetch(`/api/student/accounts/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر توليد كود جديد');

      setAccounts(prev => prev.map(a => a.id === id ? { ...a, accessCode: json.newCode } : a));
      setFeedback({ message: `تم توليد كود جديد للتلميذ (${name}): ${json.newCode}`, type: 'success' });
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setActionAccountId(null);
    }
  };

  // Administration set custom student password
  const handleCustomCodePrompt = async (id: string, name: string, currentCode: string) => {
    const newCode = prompt(`أدخل كلمة المرور (PIN) الجديدة للتلميذ (${name}):`, currentCode);
    if (!newCode || !newCode.trim() || newCode.trim() === currentCode) return;
    try {
      setActionAccountId(id);
      const res = await fetch(`/api/student/accounts/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customCode: newCode.trim() })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر تعديل الكود');
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, accessCode: newCode.trim() } : a));
      setFeedback({ message: `تم تعديل كلمة مرور التلميذ (${name}) بنجاح إلى: ${newCode.trim()} وحفظها في قاعدة البيانات ✓`, type: 'success' });
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
    } finally {
      setActionAccountId(null);
    }
  };

  // Regenerate section access codes
  const handleRegenerateSectionCodes = async () => {
    if (selectedSectionId === 'all') {
      setFeedback({ message: 'يرجى تحديد قسم معين لتوليد أكواد تلاميذه', type: 'error' });
      return;
    }
    const secName = sections.find(s => s.id === selectedSectionId)?.classNumber || '';
    if (!confirm(`هل أنت متأكد من إعادة توليد أكواد سرية جديدة لجميع تلاميذ هذا القسم؟ ستتغير الأكواد القديمة.`)) {
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/student/accounts/section/${selectedSectionId}/regenerate`, {
        method: 'POST'
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'تعذر توليد الأكواد');

      setFeedback({ message: json.message || 'تم تحديث الأكواد بنجاح', type: 'success' });
      fetchAccounts();
    } catch (err: any) {
      setFeedback({ message: err.message, type: 'error' });
      setIsLoading(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) {
      setFeedback({ message: 'لا توجد حسابات للتصدير', type: 'error' });
      return;
    }

    const rows = filteredAccounts.map((a, idx) => ({
      'الرقم الترتيبي': idx + 1,
      'الاسم الكامل للتلميذ': a.studentName,
      'المستوى': a.sectionLevel || '—',
      'القسم': a.sectionClass || '—',
      'رقم مسار (Code Massar)': a.massarNumber,
      'هاتف ولي الأمر': a.guardianPhone || 'غير مسجل',
      'تأكيد الهاتف': a.guardianPhoneVerified ? 'مؤكد ✓' : 'غير مؤكد',
      'الكود السري للدخول': a.accessCode,
      'آخر تاريخ تسجيل دخول': a.lastLogin ? a.lastLogin.slice(0, 16).replace('T', ' ') : 'لم يدخل بعد'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'أكواد_فضاء_التلميذ');

    const fileName = `أكواد_فضاء_التلميذ_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    setFeedback({ message: 'تم تصدير ملف الإكسيل بنجاح', type: 'success' });
  };

  // Print Student Login Slips (بطاقات ولوج التلاميذ القابلة للقص)
  const handlePrintSlips = () => {
    if (filteredAccounts.length === 0) {
      setFeedback({ message: 'لا توجد حسابات للطباعة', type: 'error' });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>بطاقات ولوج فضاء التلميذ - ${settings.institution}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body {
            font-family: 'Amiri', serif, system-ui;
            direction: rtl;
            background: #fff;
            color: #1F2926;
            margin: 0;
            padding: 5px;
          }
          .title-header {
            text-align: center;
            border-bottom: 2px solid #1A4E47;
            padding-bottom: 8px;
            margin-bottom: 15px;
          }
          .title-header h2 { margin: 0; font-size: 14pt; color: #1A4E47; }
          .title-header h3 { margin: 2px 0 0 0; font-size: 11pt; color: #555; }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .slip {
            border: 1.5px dashed #1A4E47;
            border-radius: 6px;
            padding: 10px 14px;
            background: #FAF8F5;
            page-break-inside: avoid;
            box-sizing: border-box;
          }
          .slip-head {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #C98A3C;
            padding-bottom: 4px;
            margin-bottom: 6px;
            font-size: 8pt;
            color: #1A4E47;
            font-weight: bold;
          }
          .slip-name {
            font-size: 12pt;
            font-weight: bold;
            color: #1A4E47;
            margin-bottom: 4px;
          }
          .slip-row {
            display: flex;
            justify-content: space-between;
            font-size: 9.5pt;
            margin-bottom: 3px;
          }
          .slip-code-box {
            background: #EFE9D5;
            border: 1px solid #C98A3C;
            padding: 4px 10px;
            border-radius: 4px;
            font-family: monospace;
            font-weight: bold;
            font-size: 12pt;
            letter-spacing: 2px;
            color: #1A4E47;
            display: inline-block;
          }
          .slip-footer {
            font-size: 7.5pt;
            color: #777;
            margin-top: 6px;
            border-top: 1px dotted #ccc;
            padding-top: 3px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="title-header">
          <h2>المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة</h2>
          <h3>بطاقات ولوج فضاء التلميذ • ${settings.institution} (${settings.year})</h3>
        </div>

        <div class="grid">
          ${filteredAccounts.map(a => `
            <div class="slip">
              <div class="slip-head">
                <span>${settings.institution}</span>
                <span>فضاء التلميذ الرقمي</span>
              </div>
              <div class="slip-name">${a.studentName}</div>
              <div class="slip-row">
                <span><strong>القسم:</strong> ${a.sectionLevel || ''} - ق ${a.sectionClass || ''}</span>
                <span><strong>رقم الترتيب:</strong> ${a.studentNumber || '—'}</span>
              </div>
              <div class="slip-row">
                <span><strong>رقم مسار:</strong> <code style="font-size: 10pt; font-weight: bold;">${a.massarNumber}</code></span>
              </div>
              <div class="slip-row" style="margin-top: 4px; align-items: center;">
                <span><strong>الكود السري (PIN):</strong></span>
                <span class="slip-code-box">${a.accessCode}</span>
              </div>
              <div class="slip-footer">
                احتفظ بهذا الكود سرياً لولوج حسابك ومتابعة غياباتك وحصصك الدراسية
              </div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    printReportHtml(html);
  };

  const filteredAccounts = accounts.filter(a => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = a.studentName.toLowerCase().includes(q);
      const matchMassar = a.massarNumber.toLowerCase().includes(q);
      const matchCode = a.accessCode.includes(q);
      const matchPhone = (a.guardianPhone || '').toLowerCase().includes(q);
      if (!matchName && !matchMassar && !matchCode && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-[#E5DFD4] overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E5DFD4] bg-[#1A4E47] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#133D37] border-2 border-[#C98A3C]/60 flex items-center justify-center text-[#C98A3C]">
              <GraduationCap className="w-6 h-6 text-[#C98A3C]" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-serif text-white">
                إدارة حسابات وأكواد فضاء التلميذ
              </h2>
              <p className="text-xs text-[#F2EFE3]/80">
                أكواد الدخول السرية المولدة تلقائياً لتلاميذ المؤسسة للدخول عبر رقم مسار
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white font-bold text-lg p-1 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`px-5 py-3 text-xs flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="font-bold hover:underline cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {/* Filters and Actions Bar */}
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E5DFD4] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم التلميذ أو رقم مسار..."
                className="w-full pr-8 pl-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-white"
              />
              <Search className="w-3.5 h-3.5 text-[#6C6356] absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Section Filter */}
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#D5CDC0] focus:outline-none focus:border-[#1A4E47] bg-white font-semibold text-[#1F2926]"
            >
              <option value="all">كافة أقسام المؤسسة ({accounts.length} تلميذ)</option>
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.level} - القسم {sec.classNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedSectionId !== 'all' && (
              <button
                type="button"
                onClick={handleRegenerateSectionCodes}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                title="توليد أكواد جديدة لجميع تلاميذ هذا القسم"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تجديد أكواد القسم</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintSlips}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#D5CDC0] font-bold text-xs transition-all cursor-pointer shadow-xs"
              title="طباعة بطاقات ولوج التلاميذ الورقية للقص والتوزيع"
            >
              <Printer className="w-3.5 h-3.5 text-[#C98A3C]" />
              <span>طباعة بطاقات الولوج (Slips)</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
              title="تصدير الأكواد إلى ملف Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        {/* Accounts Table Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#6C6356]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1A4E47] mb-2" />
              <span>جاري تحميل حسابات التلاميذ...</span>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#6C6356]">
              لا توجد حسابات تلاميذ مطابقة لمعايير البحث الحالية
            </div>
          ) : (
            <div className="border border-[#E5DFD4] rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E5DFD4] text-[#6C6356]">
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-3 text-center">الصورة</th>
                    <th className="py-3 px-4">اسم التلميذ</th>
                    <th className="py-3 px-4">القسم والمستوى</th>
                    <th className="py-3 px-4">رقم مسار (اسم الدخول)</th>
                    <th className="py-3 px-4">هاتف ولي الأمر (واتساب)</th>
                    <th className="py-3 px-4">الكود السري (PIN)</th>
                    <th className="py-3 px-4">آخر دخول</th>
                    <th className="py-3 px-4 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD4]">
                  {filteredAccounts.map((a, idx) => (
                    <tr key={a.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-[#6C6356]">{idx + 1}</td>
                      <td className="py-3 px-3 text-center">
                        {a.photoUrl ? (
                          <img
                            src={a.photoUrl}
                            alt={a.studentName}
                            className="w-9 h-9 rounded-full object-cover border border-[#C98A3C]/60 mx-auto shadow-2xs"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center text-xs font-bold mx-auto">
                            {a.studentName.trim()[0] || 'ت'}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1F2926]">
                        <div>{a.studentName}</div>
                        {a.profileCompleted && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                            ملف مكتمل ✓
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1A4E47]">
                        {a.sectionLevel || ''} - ق {a.sectionClass || ''}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm font-bold text-[#1A4E47]">
                        <code>{a.massarNumber}</code>
                      </td>
                      <td className="py-3 px-4">
                        {a.guardianPhone ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <a
                              href={`https://wa.me/${a.guardianPhone.replace(/\D/g, '').startsWith('0') ? '212' + a.guardianPhone.replace(/\D/g, '').slice(1) : a.guardianPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-mono text-xs font-bold border border-emerald-300 transition-colors"
                              title="انقر للمراسلة عبر واتساب"
                            >
                              <Phone className="w-3 h-3 text-emerald-700" />
                              <span>{a.guardianPhone}</span>
                            </a>
                            {a.guardianPhoneVerified ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-md" title="تم التحقق من الرقم عبر كود الواتساب">
                                مؤكد ✓
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                                قيد التأكيد
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#A39989] italic">غير مسجل</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm font-bold px-3 py-1 rounded-lg bg-[#EFE9D5] border border-[#C98A3C]/40 text-[#1A4E47] tracking-widest inline-block">
                          {a.accessCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#6C6356]">
                        {a.lastLogin ? a.lastLogin.slice(0, 16).replace('T', ' ') : 'لم يدخل بعد'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCustomCodePrompt(a.id, a.studentName, a.accessCode)}
                            disabled={actionAccountId === a.id}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1 disabled:opacity-50"
                            title="تعديل كلمة مرور هذا التلميذ يدوياً وحفظها"
                          >
                            <span>تعديل ✎</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenerateCode(a.id, a.studentName)}
                            disabled={actionAccountId === a.id}
                            className="px-2 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#D5CDC0] text-[11px] font-bold transition-all cursor-pointer shadow-xs inline-flex items-center gap-1 disabled:opacity-50"
                            title="توليد كود سري جديد لهذا التلميذ"
                          >
                            <RefreshCw className={`w-3 h-3 ${actionAccountId === a.id ? 'animate-spin' : ''}`} />
                            <span>تجديد</span>
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

        {/* Footer */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#E5DFD4] flex items-center justify-between text-xs text-[#6C6356] shrink-0">
          <span>إجمالي التلاميذ المعروضين: <strong>{filteredAccounts.length}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
