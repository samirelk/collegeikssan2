import React from 'react';
import { Users, FileSpreadsheet, Trash2, ChevronLeft } from 'lucide-react';
import { SectionItem } from '../types';

interface SectionsGridProps {
  sections: SectionItem[];
  onSelectSection: (id: string) => void;
  onDeleteSection: (id: string, name: string) => void;
  onAddSection: () => void;
}

export const SectionsGrid: React.FC<SectionsGridProps> = ({
  sections,
  onSelectSection,
  onDeleteSection,
  onAddSection,
}) => {
  const getSectionTitle = (sec: SectionItem) => {
    const lvl = sec.level || 'بدون مستوى';
    const cls = sec.classNumber ? `القسم ${sec.classNumber}` : 'بدون قسم';
    return `${lvl} - ${cls}`;
  };

  if (sections.length === 0) {
    return (
      <div className="text-center py-16 px-4 text-[rgba(242,239,227,0.65)] space-y-4 bg-[#2A4F40]/40 rounded-3xl border border-[rgba(242,239,227,0.12)]">
        <div className="text-5xl">📋</div>
        <h3 className="text-lg font-bold text-[#F2EFE3]">لا يوجد أي قسم دراسي بعد</h3>
        <p className="text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          ابدأ بإضافة قسمك الدراسي الأول لتنظيم خريطة مقاعد التلاميذ (40 مقعداً موزعة على 4 صفوف) وحفظ بياناتهم في قاعدة البيانات.
        </p>
        <button
          type="button"
          onClick={onAddSection}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-[#C98A3C] hover:bg-[#D8994A] text-[#2A1B06] shadow-sm shadow-[#A96E28] transition-all cursor-pointer"
        >
          <span>＋ إضافة قسم جديد الآن</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
      {sections.map((sec) => {
        const title = getSectionTitle(sec);
        const filledSeats = sec.seats.filter((s) => s.name && s.name.trim()).length;
        const totalNotes = sec.seats.reduce((acc, s) => acc + (s.notes?.length || 0), 0);

        return (
          <div
            key={sec.id}
            id={`section-card-${sec.id}`}
            onClick={() => onSelectSection(sec.id)}
            className="group relative bg-[#2A4F40] border border-[rgba(242,239,227,0.16)] hover:border-[#C98A3C] rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-md hover:shadow-lg flex flex-col justify-between"
          >
            {/* Delete button */}
            <button
              type="button"
              id={`btn-del-section-${sec.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSection(sec.id, title);
              }}
              title="حذف هذا القسم"
              className="absolute top-3.5 left-3.5 w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(242,239,227,0.35)] hover:text-[#A8443A] hover:bg-[rgba(168,68,58,0.15)] transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-xl font-bold text-[#F2EFE3] mb-2 font-serif group-hover:text-[#C98A3C] transition-colors pr-1">
                {title}
              </h3>

              <div className="space-y-1 text-xs text-[rgba(242,239,227,0.6)] mb-4">
                {sec.teacher && (
                  <div>
                    <span className="text-[rgba(242,239,227,0.4)]">الأستاذ(ة):</span>{' '}
                    <span className="text-[#F2EFE3] font-medium">{sec.teacher}</span>
                  </div>
                )}
                {sec.roster && sec.roster.length > 0 && (
                  <div className="flex items-center gap-1 text-[#C98A3C]">
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>لائحة مستوردة: {sec.roster.length} تلميذاً</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[rgba(242,239,227,0.1)] flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-[rgba(201,138,60,0.16)] text-[#C98A3C] text-xs font-bold px-2.5 py-1 rounded-full">
                <Users className="w-3 h-3" />
                <span>{filledSeats} / 40 تلميذاً</span>
              </div>

              {totalNotes > 0 && (
                <span className="text-[11px] text-[rgba(242,239,227,0.6)] font-mono">
                  📝 {totalNotes} ملاحظة
                </span>
              )}

              <div className="text-[rgba(242,239,227,0.4)] group-hover:text-[#C98A3C] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
