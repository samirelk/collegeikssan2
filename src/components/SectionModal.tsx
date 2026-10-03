import React, { useState, useEffect } from 'react';
import { X, Layers, Hash, User, Check, Loader2 } from 'lucide-react';
import { SectionItem } from '../types';

interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionToEdit: SectionItem | null;
  defaultTeacher: string;
  onSave: (data: { level: string; classNumber: string; teacher: string }) => Promise<void>;
}

export const SectionModal: React.FC<SectionModalProps> = ({
  isOpen,
  onClose,
  sectionToEdit,
  defaultTeacher,
  onSave,
}) => {
  const levels = [
    'المستوى الأول',
    'المستوى الثاني',
    'المستوى الثالث',
    'المستوى الرابع',
    'المستوى الخامس',
    'المستوى السادس',
    'الأولى إعدادي',
    'الثانية إعدادي',
    'الثالثة إعدادي',
    'الجذع المشترك',
    'الأولى باكالوريا',
    'الثانية باكالوريا',
  ];

  const classNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  const [level, setLevel] = useState(sectionToEdit?.level || levels[0]);
  const [classNumber, setClassNumber] = useState(sectionToEdit?.classNumber || '1');
  const [teacher, setTeacher] = useState(sectionToEdit?.teacher || defaultTeacher || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sectionToEdit) {
      setLevel(sectionToEdit.level || levels[0]);
      setClassNumber(sectionToEdit.classNumber || '1');
      setTeacher(sectionToEdit.teacher || defaultTeacher || '');
    } else {
      setLevel(levels[0]);
      setClassNumber('1');
      setTeacher(defaultTeacher || '');
    }
  }, [sectionToEdit, defaultTeacher, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!level || !classNumber) return;

    try {
      setIsSubmitting(true);
      await onSave({
        level,
        classNumber,
        teacher: teacher.trim(),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#F4EFDE] text-[#2A2118] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-[#E4DBC0] animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-[#E4DBC0] flex items-center justify-between bg-[#EFE9D5] shrink-0">
          <h3 className="text-base sm:text-lg font-bold font-serif text-[#2A2118] m-0">
            {sectionToEdit ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5B5040] hover:text-[#A8443A] hover:bg-[rgba(168,68,58,0.1)] transition-colors cursor-pointer text-lg font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5B5040] mb-1.5 flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#C98A3C]" />
                <span>المستوى الدراسي</span>
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-white border border-[#E4DBC0] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2A2118] focus:border-[#A96E28] focus:outline-hidden"
              >
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5B5040] mb-1.5 flex items-center gap-1">
                <Hash className="w-3 h-3 text-[#C98A3C]" />
                <span>رقم القسم</span>
              </label>
              <select
                value={classNumber}
                onChange={(e) => setClassNumber(e.target.value)}
                className="w-full bg-white border border-[#E4DBC0] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2A2118] focus:border-[#A96E28] focus:outline-hidden"
              >
                {classNumbers.map((num) => (
                  <option key={num} value={num}>
                    القسم {num}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5B5040] mb-1.5 flex items-center gap-1">
              <User className="w-3 h-3 text-[#C98A3C]" />
              <span>اسم الأستاذ(ة)</span>
            </label>
            <input
              type="text"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="اسم الأستاذ(ة) المسؤول عن القسم"
              className="w-full bg-white border border-[#E4DBC0] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2A2118] focus:border-[#A96E28] focus:outline-hidden placeholder:text-[rgba(42,33,24,0.35)]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-[#C98A3C] hover:bg-[#D8994A] text-[#2A1B06] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{sectionToEdit ? 'حفظ التعديلات في قاعدة البيانات' : 'إضافة القسم وتوليد 40 مقعداً'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
