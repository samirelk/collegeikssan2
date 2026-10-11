import React, { useState, useRef } from 'react';
import { 
  ArrowRight, 
  FileSpreadsheet, 
  Edit3, 
  Trash2, 
  ListOrdered, 
  FileText, 
  AlertTriangle,
  Check, 
  Loader2,
  AlertCircle,
  Shuffle,
  GripVertical,
  ArrowLeftRight,
  Star,
  Sparkles,
  Award,
  Trophy,
  ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SectionItem, SeatItem } from '../types';
import { RosterReorderModal } from './RosterReorderModal';

interface ClassroomMapProps {
  section: SectionItem;
  onBack: () => void;
  onUpdateSeat: (seatNum: number, data: { name?: string; number?: string; massarNumber?: string; rosterId?: string | null }) => void;
  onOpenNotes: (seatNum: number) => void;
  onOpenPositiveParticipation?: (seatNum: number) => void;
  onOpenPositiveParticipationReport?: () => void;
  onEditSection: () => void;
  onDeleteSection: () => void;
  onImportRoster: (roster: { id: string; name: string; number: string; massarNumber?: string }[]) => Promise<void>;
  onToast: (msg: string) => void;
  onSwapSeats?: (seatA: number, seatB: number) => void;
  onShuffleSeats?: () => void;
  onOrderByNumber?: () => void;
  onRefreshSection?: () => Promise<void> | void;
}

export const ClassroomMap: React.FC<ClassroomMapProps> = ({
  section,
  onBack,
  onUpdateSeat,
  onOpenNotes,
  onOpenPositiveParticipation,
  onOpenPositiveParticipationReport,
  onEditSection,
  onDeleteSection,
  onImportRoster,
  onToast,
  onSwapSeats,
  onShuffleSeats,
  onOrderByNumber,
  onRefreshSection
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [draggingSeat, setDraggingSeat] = useState<number | null>(null);
  const [dropTargetSeat, setDropTargetSeat] = useState<number | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<number | null>(null);
  const [showReorderModal, setShowReorderModal] = useState<boolean>(false);

  const sectionTitle = `${section.level || 'بدون مستوى'} - ${section.classNumber ? `القسم ${section.classNumber}` : 'بدون قسم'}`;
  const hasRoster = section.roster && section.roster.length > 0;

  // Track assigned roster IDs to prevent duplicates in dropdowns
  const assignedRosterIds = new Set<string>();
  section.seats.forEach((s) => {
    if (s.rosterId) assignedRosterIds.add(s.rosterId);
  });

  // Handle Excel/CSV Roster File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const ext = file.name.split('.').pop()?.toLowerCase();
      let wb: XLSX.WorkBook;

      if (ext === 'csv') {
        const text = await file.text();
        wb = XLSX.read(text, { type: 'string' });
      } else {
        const buffer = await file.arrayBuffer();
        wb = XLSX.read(buffer, { type: 'array' });
      }

      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rows || rows.length === 0) {
        onToast('لم يتم العثور على بيانات صالحة في الملف');
        return;
      }

      const roster: { id: string; name: string; number: string; massarNumber?: string }[] = [];

      // Check for Moroccan school Excel format:
      // Rows 1-10 are ignored (skiprows=10), data starts at row 11 (index 10)
      // Col A (0): Student Number (num) starting from 1
      // Col B (1): Massar Number / رقم مسار
      // Col C (2): Family Name / النسب (nasab)
      // Col D (3): First Name / الاسم (ism)
      if (rows.length > 10) {
        for (let r = 10; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !Array.isArray(row)) continue;

          const rawNum = row[0] !== undefined && row[0] !== null ? row[0] : '';
          const colB = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
          const colC = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : '';
          const colD = row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '';

          // Skip header row if at row 10 or 11
          if (
            colB.includes('مسار') || colB.includes('Massar') || colB.includes('massar') ||
            colC.includes('النسب') || colC.includes('Nom') || colC.includes('nom') ||
            colD.includes('الاسم') || colD.includes('Prénom') || colD.includes('prenom') ||
            String(rawNum).includes('رقم') || String(rawNum).includes('N°')
          ) {
            continue;
          }

          const numStr = String(rawNum).trim();
          if (!numStr || (!colC && !colD)) continue;

          let numParsed = numStr;
          const numVal = Number(rawNum);
          if (!isNaN(numVal) && isFinite(numVal)) {
            numParsed = String(Math.floor(numVal));
          }

          // f"{ism} {nasab}".strip()
          const fullName = [colD, colC].filter(Boolean).join(' ').trim();
          if (fullName && fullName.length >= 2) {
            roster.push({
              id: 'r_' + r + '_' + Date.now().toString(36),
              name: fullName,
              number: numParsed || String(roster.length + 1),
              massarNumber: colB
            });
          }
        }
      }

      // Fallback to dynamic header detection if no students found at row 11+
      if (roster.length === 0) {
        // Filter empty rows
        const validRows = rows.filter((r) => r && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ''));
        if (validRows.length === 0) {
          onToast('الملف فارغ');
          return;
        }

        let lastNameIdx = -1;
        let firstNameIdx = -1;
        let nameIdx = -1;
        let numIdx = -1;
        let massarIdx = 1;
        let headerRowIndex = -1;

        for (let r = 0; r < Math.min(validRows.length, 15); r++) {
          const row = validRows[r];
          let fLast = -1, fFirst = -1, fName = -1, fNum = -1;

          row.forEach((c: any, idx: number) => {
            const h = String(c || '').trim().toLowerCase();
            if (h.includes('مسار') || h.includes('massar') || h.includes('cne')) massarIdx = idx;
            else if (h.includes('نسب') || h.includes('عائلي') || h.includes('nom')) fLast = idx;
            else if (h.includes('شخصي') || h.includes('prénom') || h.includes('prenom')) fFirst = idx;
            else if (h.includes('اسم') || h.includes('name') || h.includes('student')) fName = idx;

            if (h.includes('رقم') || h.includes('number') || h.includes('code') || h.includes('id') || h.includes('n°')) fNum = idx;
          });

          if (fLast !== -1 && fFirst !== -1) {
            headerRowIndex = r;
            lastNameIdx = fLast;
            firstNameIdx = fFirst;
            numIdx = fNum !== -1 ? fNum : 0;
            break;
          } else if (fName !== -1) {
            headerRowIndex = r;
            nameIdx = fName;
            numIdx = fNum !== -1 ? fNum : (fName === 0 ? 1 : 0);
            break;
          }
        }

        const startIdx = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
        for (let i = startIdx; i < validRows.length; i++) {
          const row = validRows[i];
          let fullName = '';
          if (lastNameIdx !== -1 && firstNameIdx !== -1) {
            const l = row[lastNameIdx] ? String(row[lastNameIdx]).trim() : '';
            const f = row[firstNameIdx] ? String(row[firstNameIdx]).trim() : '';
            fullName = [l, f].filter(Boolean).join(' ').trim();
          } else if (nameIdx !== -1 && row[nameIdx]) {
            fullName = String(row[nameIdx]).trim();
          } else if (row[2] && row[3]) {
            fullName = `${String(row[2]).trim()} ${String(row[3]).trim()}`.trim();
          } else if (row[0]) {
            fullName = String(row[0]).trim();
          }

          if (fullName && fullName.length >= 2) {
            const num = numIdx !== -1 && row[numIdx] !== undefined ? String(row[numIdx]).trim() : String(roster.length + 1);
            const massarVal = massarIdx !== -1 && row[massarIdx] !== undefined ? String(row[massarIdx]).trim() : '';
            roster.push({
              id: 'r_' + i + '_' + Date.now().toString(36),
              name: fullName,
              number: num,
              massarNumber: massarVal
            });
          }
        }
      }

      if (roster.length === 0) {
        onToast('لم يتم العثور على أسماء صالحة في ملف الإكسل');
        return;
      }

      // Default ordering: Sort sequentially by student number starting from 1
      roster.sort((a, b) => {
        const numA = parseInt(a.number || '0', 10);
        const numB = parseInt(b.number || '0', 10);
        if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) return numA - numB;
        return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
      });

      await onImportRoster(roster);
      onToast(`تم استيراد ${roster.length} تلميذاً مع أرقام مسار وترتيبهم تصاعدياً من الرقم 1`);
    } catch (err) {
      console.error(err);
      onToast('تعذّرت قراءة الملف، تأكد من صيغة Excel (.xlsx, .xls) أو CSV');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Seat renderer
  const renderSeat = (seat: SeatItem) => {
    const availableRoster = section.roster.filter(
      (r) => !assignedRosterIds.has(r.id) || r.id === seat.rosterId
    );
    const hasStudent = Boolean(seat.name && seat.name.trim());
    const isDragging = draggingSeat === seat.seat;
    const isDropTarget = dropTargetSeat === seat.seat;
    const isSelectedForSwap = swapSourceSeat === seat.seat;

    return (
      <div
        key={seat.seat}
        className={`flex-1 bg-[#F4EFDE] rounded-xl p-3 sm:p-3.5 relative border border-[#E4DBC0] text-[#2A2118] shadow-xs min-w-0 transition-all ${isDragging ? 'opacity-40 border-dashed border-amber-600' : ''} ${isDropTarget ? 'bg-[#FFF9E6] border-2 border-amber-500 scale-105 shadow-lg' : ''} ${isSelectedForSwap ? 'bg-blue-50 border-2 border-blue-600 ring-2 ring-blue-300' : ''}`}
        draggable={hasStudent}
        onDragStart={(e) => {
          if (!hasStudent) return;
          e.dataTransfer.setData('text/plain', String(seat.seat));
          setDraggingSeat(seat.seat);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDropTargetSeat(seat.seat);
        }}
        onDragLeave={() => {
          setDropTargetSeat((curr) => (curr === seat.seat ? null : curr));
        }}
        onDrop={(e) => {
          e.preventDefault();
          const sourceNum = Number(e.dataTransfer.getData('text/plain'));
          if (sourceNum && sourceNum !== seat.seat) {
            onSwapSeats?.(sourceNum, seat.seat);
          }
          setDraggingSeat(null);
          setDropTargetSeat(null);
        }}
        onDragEnd={() => {
          setDraggingSeat(null);
          setDropTargetSeat(null);
        }}
      >
        {/* Seat Number Badge */}
        <div
          className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-[#1F3E32] text-[#F2EFE3] border-2 border-[#C98A3C] flex items-center justify-center text-xs font-black shadow-xs z-10"
          title={`المقعد رقم ${seat.seat}`}
        >
          {seat.seat}
        </div>

        {/* Top Mini Drag & Swap Bar */}
        <div className="flex items-center justify-between pb-1 mb-2 border-b border-amber-900/10 text-[10px]">
          {hasStudent ? (
            <div className="flex items-center gap-1 text-amber-900/70 cursor-grab font-medium" title="اسحب للإفلات في مقعد آخر">
              <GripVertical className="w-3 h-3 text-amber-700" />
              <span>اسحب</span>
            </div>
          ) : (
            <span className="text-amber-900/40">فارغ</span>
          )}

        </div>

        {/* Student Name Field */}
        <div className="mb-2">
          <label className="block text-[10.5px] font-bold text-[#5B5040] mb-0.5">
            الاسم الكامل
          </label>

          <input
            type="text"
            value={seat.name}
            placeholder="اكتب اسم التلميذ"
            onChange={(e) => onUpdateSeat(seat.seat, { name: e.target.value })}
            className="w-full bg-transparent border-b border-[#E4DBC0] focus:border-[#A96E28] text-xs sm:text-sm text-[#2A2118] py-0.5 outline-hidden placeholder:text-[rgba(42,33,24,0.35)]"
          />
        </div>

        {/* Student Number field */}
        <div className="mb-2">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-[10px] font-bold text-[#5B5040] mb-0.5">
              رقم
            </label>
            <button
              type="button"
              onClick={() => {
                if (swapSourceSeat === null) {
                  setSwapSourceSeat(seat.seat);
                  onToast(`تم تحديد المقعد ${seat.seat}. انقر على أي مقعد آخر للتبديل.`);
                } else if (swapSourceSeat === seat.seat) {
                  setSwapSourceSeat(null);
                } else {
                  onSwapSeats?.(swapSourceSeat, seat.seat);
                  setSwapSourceSeat(null);
                }
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${isSelectedForSwap ? 'bg-blue-600 text-white font-bold' : 'text-blue-700 hover:bg-blue-100'}`}
              title={isSelectedForSwap ? 'إلغاء التحديد' : 'تحديد المقعد ثم النقر على مقعد آخر للتبديل'}
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              <span>{isSelectedForSwap ? 'محدد' : 'تبديل'}</span>
            </button>
          </div>
          <div>
            {hasRoster ? (
              <select
                value={seat.number}
                onChange={(e) => {
                  const match = availableRoster.find((item) => item.number === e.target.value);
                  if (match) {
                    onUpdateSeat(seat.seat, { name: match.name, number: match.number, massarNumber: match.massarNumber || '', rosterId: match.id });
                  } else {
                    onUpdateSeat(seat.seat, { number: e.target.value });
                  }
                }}
                className="w-full bg-transparent border-b border-[#E4DBC0] focus:border-[#A96E28] text-xs font-mono text-[#2A2118] py-0.5 outline-hidden"
              >
                <option value="">— اختر الرقم —</option>
                {availableRoster.map((r) => (
                  <option key={r.id} value={r.number}>{r.number}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                value={seat.number}
                placeholder="1"
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                  onUpdateSeat(seat.seat, { number: digitsOnly });
                }}
                className="w-full bg-transparent border-b border-[#E4DBC0] focus:border-[#A96E28] text-xs font-mono text-[#2A2118] py-0.5 outline-hidden placeholder:text-[rgba(42,33,24,0.35)]"
              />
            )}
          </div>
        </div>

        {/* Actions: Positive Participation & Violations */}
        {(() => {
          const positivePoints = seat.positiveParticipationCount !== undefined
            ? seat.positiveParticipationCount
            : (seat.positiveParticipations ? seat.positiveParticipations.reduce((sum, p) => sum + (p.points || 1), 0) : 0);

          const violationsCount = (seat.violations && seat.violations.length > 0)
            ? seat.violations.length
            : (seat.notes ? seat.notes.length : 0);

          return (
            <div className="grid grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-[rgba(42,33,24,0.1)]">
              {/* Positive Participation Button */}
              <button
                type="button"
                onClick={() => onOpenPositiveParticipation ? onOpenPositiveParticipation(seat.seat) : onOpenNotes(seat.seat)}
                className={`flex items-center justify-center gap-1 border rounded-lg py-1.5 px-1 text-[10.5px] font-bold transition-all cursor-pointer ${
                  positivePoints > 0
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
                    : 'bg-emerald-50/40 hover:bg-emerald-50 text-emerald-700/80 border-dashed border-emerald-300/60'
                }`}
                title="تسجيل مشاركة إيجابية ونقاط تميز للتلميذ"
              >
                <Star className={`w-3 h-3 ${positivePoints > 0 ? 'text-amber-500 fill-amber-500' : 'text-emerald-600'}`} />
                <span>مشاركة</span>
                {positivePoints > 0 && (
                  <span className="bg-emerald-600 text-white rounded-full text-[9.5px] min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center font-black">
                    +{positivePoints}
                  </span>
                )}
              </button>

              {/* Violations Button */}
              <button
                type="button"
                onClick={() => onOpenNotes(seat.seat)}
                className={`flex items-center justify-center gap-1 border rounded-lg py-1.5 px-1 text-[10.5px] font-bold transition-colors cursor-pointer ${
                  violationsCount > 0
                    ? 'bg-[#FDE8E8]/70 hover:bg-[#FDE8E8] text-[#9B1C1C] border-[#F05252]/40 shadow-2xs'
                    : 'bg-[rgba(42,33,24,0.06)] hover:bg-[rgba(201,138,60,0.18)] hover:border-[#A96E28] border-dashed border-[rgba(42,33,24,0.25)] text-[#5B5040] hover:text-[#2A2118]'
                }`}
                title="تسجيل وإدارة مخالفات التلميذ"
              >
                <AlertTriangle className={`w-3 h-3 ${violationsCount > 0 ? 'text-[#9B1C1C]' : 'text-[#A96E28]'}`} />
                <span>مخالفة</span>
                {violationsCount > 0 && (
                  <span className="bg-[#9B1C1C] text-white rounded-full text-[9.5px] min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center font-black">
                    {violationsCount}
                  </span>
                )}
              </button>
            </div>
          );
        })()}
      </div>
    );
  };

  const desksPerRow = 5;
  const numRows = 4; // 4 rows * 5 desks * 2 seats = 40 seats

  return (
    <div className="space-y-6">
      
      {/* Hidden File Input for Excel Roster */}
      <input
        ref={fileInputRef}
        type="file"
        id="roster-excel-input"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Back Button */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[rgba(242,239,227,0.7)] hover:text-[#C98A3C] transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>رجوع إلى قائمة الأقسام</span>
        </button>
      </div>

      {/* Section Header */}
      <div className="bg-[#2A4F40] border border-[rgba(242,239,227,0.16)] rounded-2xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F2EFE3] font-serif mb-1.5">
            {sectionTitle}
          </h2>

          <div className="flex items-center gap-3 text-xs text-[rgba(242,239,227,0.7)] flex-wrap">
            {hasRoster && (
              <span className="bg-[rgba(201,138,60,0.18)] text-[#C98A3C] font-bold px-2 py-0.5 rounded-full border border-[rgba(201,138,60,0.3)]">
                لائحة مستوردة: {section.roster.length} تلميذاً
              </span>
            )}
            <span className="text-emerald-300 font-medium">
              ✓ الحفظ فوري في قاعدة البيانات
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Positive Participations & Honor Roll Print Button */}
          {onOpenPositiveParticipationReport && (
            <button
              type="button"
              onClick={onOpenPositiveParticipationReport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-amber-200 bg-amber-950/70 hover:bg-amber-900/90 border border-amber-400/60 shadow-md transition-all cursor-pointer"
              title="سجل ولوحة شرف المشاركات الإيجابية والتعزيز (طباعة للقسم أو التلميذ)"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>المشاركات الإيجابية والتحفيز ⭐</span>
            </button>
          )}

          {/* Order by Number Button */}
          {onOrderByNumber && (
            <button
              type="button"
              onClick={onOrderByNumber}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 transition-all cursor-pointer"
              title="الترتيب الافتراضي للتلاميذ حسب الرقم ابتداءً من الرقم 1"
            >
              <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
              <span>ترتيب حسب الرقم (1..40)</span>
            </button>
          )}

          {/* Manage Roster Order & Numbers Button */}
          <button
            type="button"
            onClick={() => setShowReorderModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-cyan-200 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 transition-all cursor-pointer shadow-xs"
            title="سحب وترتيب لائحة التلاميذ سابقاً أو لاحقاً مع تحيين الأرقام تلقائياً"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>ترتيب التلاميذ وتحيين الأرقام ⇅</span>
          </button>

          {/* Shuffle Seats Button */}
          {onShuffleSeats && (
            <button
              type="button"
              onClick={onShuffleSeats}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-amber-200 bg-[rgba(201,138,60,0.2)] hover:bg-[rgba(201,138,60,0.35)] border border-amber-500/40 transition-all cursor-pointer"
              title="توزيع عشوائي للتلاميذ على المقاعد الـ 40"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#C98A3C]" />
              <span>تقسيم عشوائي على المقاعد</span>
            </button>
          )}

          {/* Import Excel Roster Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-[#F2EFE3] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(242,239,227,0.18)] transition-all cursor-pointer"
          >
            {isImporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C98A3C]" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#C98A3C]" />
            )}
            <span>{hasRoster ? 'تحديث لائحة Excel' : 'استيراد لائحة Excel'}</span>
          </button>

          {/* Edit Section Button */}
          <button
            type="button"
            onClick={onEditSection}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-[#F2EFE3] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(242,239,227,0.18)] transition-all cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>تعديل بيانات القسم</span>
          </button>

          {/* Delete Section Button */}
          <button
            type="button"
            onClick={onDeleteSection}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-[#F2EFE3] bg-[#A8443A] hover:bg-[#BC5145] shadow-xs shadow-[#8B3830] transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف القسم</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Hint */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 mb-4 text-xs text-amber-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span>💡</span>
          <span><b>خاصية السحب والإفلات (Drag & Drop):</b> يمكنك سحب بطاقة أي تلميذ وإفلاتها في مقعد آخر لتبديل المكان، أو النقر على «تبديل» للنقل السريع.</span>
        </div>
      </div>

      {/* Classroom Desk Grid: 4 Row Frames */}
      <div className="space-y-7">
        {Array.from({ length: numRows }).map((_, r) => {
          return (
            <div
              key={r}
              className="relative border-2 border-[#7C5133] rounded-3xl p-5 sm:p-6 pt-7 sm:pt-8 bg-[rgba(124,81,51,0.08)] shadow-md"
            >
              {/* Row Label Ribbon */}
              <div className="absolute -top-4 right-5 bg-[#7C5133] text-[#F2EFE3] font-serif font-bold text-sm sm:text-base px-4 py-1 rounded-full shadow-md shadow-[#5E3D26] border border-[#96693F]">
                صف {r + 1}
              </div>

              {/* 5 Desks per row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Array.from({ length: desksPerRow }).map((_, d) => {
                  const deskIndex = r * desksPerRow + d;
                  const seat1Num = deskIndex * 2 + 1;
                  const seat2Num = deskIndex * 2 + 2;

                  const s1 = section.seats.find((s) => s.seat === seat1Num) || {
                    seat: seat1Num,
                    name: '',
                    number: '',
                    notes: [],
                    rosterId: null,
                  };
                  const s2 = section.seats.find((s) => s.seat === seat2Num) || {
                    seat: seat2Num,
                    name: '',
                    number: '',
                    notes: [],
                    rosterId: null,
                  };

                  return (
                    <div
                      key={deskIndex}
                      className="bg-gradient-to-b from-[#96693F] to-[#7C5133] rounded-2xl p-2.5 flex gap-2.5 shadow-md shadow-[#5E3D26]/40 border border-[#96693F]"
                    >
                      {renderSeat(s1)}
                      {renderSeat(s2)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Roster Reorder & Renumber Modal */}
      {showReorderModal && (
        <RosterReorderModal
          isOpen={showReorderModal}
          onClose={() => setShowReorderModal(false)}
          section={section}
          currentUser={null}
          onRefresh={async () => {
            if (onRefreshSection) await onRefreshSection();
          }}
          onToast={onToast}
        />
      )}

    </div>
  );
};
