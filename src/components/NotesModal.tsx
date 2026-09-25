import React, { useState } from 'react';
import { Printer, Trash2, Plus, Clock, X, Loader2 } from 'lucide-react';
import { SeatItem, SectionItem, AppSettings } from '../types';

interface NotesModalProps {
  section: SectionItem;
  seat: SeatItem;
  settings: AppSettings;
  onClose: () => void;
  onAddNote: (text: string, date: string, time: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onPrint: () => void;
}

export const NotesModal: React.FC<NotesModalProps> = ({
  section,
  seat,
  settings,
  onClose,
  onAddNote,
  onDeleteNote,
  onPrint,
}) => {
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const getStamp = () => {
    const d = new Date();
    return {
      date: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
      time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    };
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    try {
      setIsSubmitting(true);
      const stamp = getStamp();
      await onAddNote(noteText.trim(), stamp.date, stamp.time);
      setNoteText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      setDeletingId(noteId);
      await onDeleteNote(noteId);
    } finally {
      setDeletingId(null);
    }
  };

  const studentDisplayName = seat.name ? seat.name : `المقعد ${seat.seat}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#F4EFDE] text-[#2A2118] rounded-2xl w-full max-w-md max-h-[96vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#E4DBC0] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-3 sm:p-5 border-b border-[#E4DBC0] flex items-start justify-between gap-2.5 sm:gap-3 bg-[#EFE9D5] relative pr-3 pl-10 sm:px-5">
          <div className="min-w-0">
            <h3 className="text-base sm:text-xl font-bold font-serif text-[#2A2118] m-0 truncate">
              ملاحظات — {studentDisplayName}
            </h3>
            <div className="text-[11px] sm:text-xs text-[#5B5040] mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span>المقعد #{seat.seat}</span>
              {seat.number && <span>· الرقم: {seat.number}</span>}
              <span>· {section.level} ({section.classNumber})</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onPrint}
              className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold rounded-lg bg-[rgba(42,33,24,0.06)] hover:bg-[rgba(201,138,60,0.2)] border border-[#E4DBC0] text-[#2A2118] transition-colors cursor-pointer"
              title="طباعة بطاقة ملاحظات التلميذ"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="absolute left-2.5 top-2.5 sm:relative sm:left-auto sm:top-auto w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[#5B5040] hover:text-[#A8443A] hover:bg-[rgba(168,68,58,0.1)] transition-colors cursor-pointer text-base font-bold"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Notes Timeline */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {seat.notes.length === 0 ? (
            <div className="text-center py-10 text-[#5B5040] space-y-1">
              <Clock className="w-8 h-8 mx-auto text-[#E4DBC0] mb-2" />
              <p className="text-xs font-bold">لا توجد ملاحظات مسجلة بعد لهذا التلميذ.</p>
              <p className="text-[11px] text-[#5B5040]/70">
                أضف ملاحظة بالأسفل ليتم حفظها وتأريخها في قاعدة البيانات تلقائياً.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {seat.notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#E4DBC0] shadow-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#A96E28] font-bold font-mono text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{note.date} — {note.time}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      disabled={deletingId === note.id}
                      className="text-[rgba(42,33,24,0.35)] hover:text-[#A8443A] transition-colors p-1 rounded-md hover:bg-red-50 cursor-pointer"
                      title="حذف الملاحظة"
                    >
                      {deletingId === note.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-[#2A2118] whitespace-pre-wrap leading-relaxed m-0">
                    {note.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer: Add Note Form */}
        <div className="p-4 border-t border-[#E4DBC0] bg-[#EFE9D5]">
          <form onSubmit={handleAddSubmit} className="space-y-2">
            <textarea
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="اكتب ملاحظة صفية أو تربوية عن التلميذ..."
              className="w-full bg-white border border-[#E4DBC0] rounded-xl p-2.5 text-xs sm:text-sm text-[#2A2118] focus:border-[#A96E28] focus:outline-hidden resize-none placeholder:text-[rgba(42,33,24,0.4)]"
            />

            <button
              type="submit"
              disabled={isSubmitting || !noteText.trim()}
              className={`w-full py-2 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                noteText.trim()
                  ? 'bg-[#C98A3C] hover:bg-[#D8994A] text-[#2A1B06] cursor-pointer'
                  : 'bg-[rgba(42,33,24,0.1)] text-[#5B5040] cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>+ إضافة الملاحظة (بالتاريخ والساعة في SQLite)</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
