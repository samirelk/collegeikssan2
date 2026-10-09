import React, { useState } from 'react';
import {
  X,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Hash,
  ListOrdered,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
  Check
} from 'lucide-react';
import { SectionItem, User as UserType } from '../types';

interface RosterReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: SectionItem;
  currentUser: UserType | null;
  onRefresh: () => Promise<void> | void;
  onToast: (msg: string) => void;
}

export const RosterReorderModal: React.FC<RosterReorderModalProps> = ({
  isOpen,
  onClose,
  section,
  currentUser,
  onRefresh,
  onToast
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [reorderSeatsToo, setReorderSeatsToo] = useState<boolean>(true);

  // Jump to specific rank dialog state
  const [movingStudent, setMovingStudent] = useState<{
    name: string;
    currentRank: number;
    total: number;
  } | null>(null);
  const [jumpRankInput, setJumpRankInput] = useState<string>('');

  if (!isOpen) return null;

  // Extract active students sorted strictly ascending by student number
  const activeStudents = [...section.seats.filter((s) => s.name && s.name.trim())].sort((a, b) => {
    const numA = parseInt(String(a.number || a.seat || '0'), 10);
    const numB = parseInt(String(b.number || b.seat || '0'), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0 && numA !== numB) {
      return numA - numB;
    }
    return (a.name || '').localeCompare(b.name || '', 'ar');
  });

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (currentUser) {
      headers['x-user-id'] = currentUser.id;
      headers['x-user-role'] = currentUser.role;
    }
    return headers;
  };

  const handleReorder = async (sourceIndex: number, targetIndex: number, pos: 'before' | 'after') => {
    try {
      setIsSaving(true);
      let finalTarget = pos === 'after' ? targetIndex + 1 : targetIndex;
      if (sourceIndex < targetIndex && pos === 'after') {
        finalTarget = targetIndex;
      } else if (sourceIndex < targetIndex && pos === 'before') {
        finalTarget = Math.max(0, targetIndex - 1);
      }
      finalTarget = Math.max(0, finalTarget);

      const res = await fetch(`/api/sections/${section.id}/reorder-students`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          sourceIndex,
          targetIndex: finalTarget,
          reorderSeatsToo
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر إعادة ترتيب التلميذ');

      onToast(data.message || `تم تحيين ترتيب التلميذ وأرقام تلاميذ القسم تصاعدياً بنجاح!`);
      await onRefresh();
    } catch (err: any) {
      onToast(err.message || 'حدث خطأ أثناء إعادة ترتيب التلميذ');
    } finally {
      setIsSaving(false);
      setDraggedIdx(null);
      setDragOverIdx(null);
      setDropPosition(null);
    }
  };

  const handleMoveEarlier = (idx: number) => {
    if (idx <= 0 || isSaving) return;
    handleReorder(idx, idx - 1, 'before');
  };

  const handleMoveLater = (idx: number) => {
    if (idx >= activeStudents.length - 1 || isSaving) return;
    handleReorder(idx, idx + 1, 'after');
  };

  const handleJumpRankSubmit = async () => {
    if (!movingStudent) return;
    const target = parseInt(jumpRankInput, 10);
    if (isNaN(target) || target < 1 || target > movingStudent.total) return;

    try {
      setIsSaving(true);
      const res = await fetch(`/api/sections/${section.id}/reorder-students`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          studentName: movingStudent.name,
          newPosition: target,
          reorderSeatsToo
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر تغيير رتبة التلميذ');

      onToast(data.message || `تم نقل التلميذ (${movingStudent.name}) إلى الرتبة #${target} وتحيين الأرقام تصاعدياً!`);
      setMovingStudent(null);
      setJumpRankInput('');
      await onRefresh();
    } catch (err: any) {
      onToast(err.message || 'حدث خطأ أثناء تغيير رتبة التلميذ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStrictSequentialRenumber = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/sections/${section.id}/renumber`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'تعذر إعادة ترتيب الأرقام');

      onToast(`تمت إعادة ترقيم تلاميذ القسم تصاعدياً (من 1 إلى ${data.totalStudents}) وسد الفراغات بنجاح!`);
      await onRefresh();
    } catch (err: any) {
      onToast(err.message || 'حدث خطأ أثناء تحيين الأرقام');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="bg-[#F4EFDE] text-[#2A2118] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-[#E4DBC0] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E4DBC0] flex items-center justify-between bg-[#EFE9D5] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1A4E47] text-white flex items-center justify-center shadow-xs">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-serif text-[#2A2118] m-0">
                ترتيب لائحة التلاميذ وتحيين الأرقام تصاعدياً
              </h3>
              <p className="text-xs text-[#5B5040] m-0 mt-0.5">
                القسم: <strong>{section.level} — {section.classNumber}</strong> ({activeStudents.length} تلميذاً مسجلاً)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5B5040] hover:text-[#A8443A] hover:bg-[rgba(168,68,58,0.1)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info & Options Ribbon */}
        <div className="p-3.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">💡</span>
            <span>
              <strong>طريقة الترتيب:</strong> اسحب التلميذ بمقبض السحب <span className="px-1 bg-amber-200 rounded font-mono font-bold">⠿</span> وقم بإفلاته سابقاً أو لاحقاً، أو استعن بأزرار <span className="px-1 bg-amber-200 rounded font-bold">⬆️ سابقاً</span> و <span className="px-1 bg-amber-200 rounded font-bold">⬇️ لاحقاً</span>، وسيتم تحيين أرقام القسم تسلسلياً (من 1 إلى {activeStudents.length}) فوراً!
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-[#2A2118] bg-white px-2.5 py-1 rounded-lg border border-[#D9CEB0]">
              <input
                type="checkbox"
                checked={reorderSeatsToo}
                onChange={(e) => setReorderSeatsToo(e.target.checked)}
                className="rounded accent-[#1A4E47]"
              />
              <span>تحيين مقاعد القاعة أيضاً</span>
            </label>

            <button
              type="button"
              onClick={handleStrictSequentialRenumber}
              disabled={isSaving}
              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] border border-amber-300 shadow-2xs cursor-pointer flex items-center gap-1"
              title="إعادة الترتيب التصاعدي وسد كافة الأرقام الفارغة"
            >
              <ListOrdered className="w-3.5 h-3.5 text-amber-800" />
              <span>ترتيب تصاعدي (1..N)</span>
            </button>
          </div>
        </div>

        {/* Students List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2">
          {activeStudents.length === 0 ? (
            <div className="text-center py-12 text-[#7A6B58]">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-bold text-sm">لا يوجد تلاميذ مسجلين في هذا القسم حتى الآن.</p>
            </div>
          ) : (
            activeStudents.map((st, idx) => {
              const isBeingDragged = draggedIdx === idx;
              const isOverThis = dragOverIdx === idx;
              const rankNum = idx + 1;

              return (
                <div key={st.seat + '_' + st.name} className="relative">
                  {/* Drop Indicator Above */}
                  {isOverThis && dropPosition === 'before' && (
                    <div className="mb-1.5 bg-emerald-600 text-white text-center py-1 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm animate-pulse">
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>إفلات هنا لوضع التلميذ سابقاً (قبل: {st.name}) وتحيين الأرقام ⬆️</span>
                    </div>
                  )}

                  <div
                    draggable={!isSaving}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                      setDraggedIdx(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedIdx === null || draggedIdx === idx) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const isTop = (e.clientY - rect.top) < rect.height / 2;
                      setDragOverIdx(idx);
                      setDropPosition(isTop ? 'before' : 'after');
                    }}
                    onDragLeave={() => {
                      if (dragOverIdx === idx) {
                        setDragOverIdx(null);
                        setDropPosition(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIdx === null || draggedIdx === idx) return;
                      handleReorder(draggedIdx, idx, dropPosition || 'before');
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                      setDropPosition(null);
                    }}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                      isBeingDragged
                        ? 'opacity-40 bg-amber-100 border-dashed border-2 border-amber-600'
                        : isOverThis
                        ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                        : 'bg-[#FFFDF9] border-[#E4DBC0] hover:border-[#C98A3C] shadow-2xs'
                    }`}
                  >
                    {/* Left: Drag Handle, Number badge & Student Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 text-[#7A6B58] hover:text-[#1A4E47] hover:bg-amber-100 rounded transition-colors"
                        title="اسحب لوضع التلميذ سابقاً أو لاحقاً"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-[#E8DEC0] font-mono font-bold text-xs flex items-center justify-center text-[#2A2118] shrink-0 border border-[#D9CEB0]">
                        #{st.number || rankNum}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-sm text-[#2A2118] truncate">
                          {st.name}
                        </div>
                        <div className="text-[11px] text-[#7A6B58] flex items-center gap-2">
                          <span>المقعد: {st.seat}</span>
                          {st.massarNumber && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[#1A4E47] font-semibold">
                                مسار: {st.massarNumber}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Reorder Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveEarlier(idx)}
                        disabled={idx === 0 || isSaving}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                          idx === 0
                            ? 'text-[#A09886] opacity-35 cursor-not-allowed'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs cursor-pointer'
                        }`}
                        title="وضع سابقاً (تقديم التلميذ خطوة للأعلى مع تحيين الأرقام)"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">سابقاً</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveLater(idx)}
                        disabled={idx === activeStudents.length - 1 || isSaving}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                          idx === activeStudents.length - 1
                            ? 'text-[#A09886] opacity-35 cursor-not-allowed'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs cursor-pointer'
                        }`}
                        title="وضع لاحقاً (تأخير التلميذ خطوة للأسفل مع تحيين الأرقام)"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">لاحقاً</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMovingStudent({
                            name: st.name,
                            currentRank: rankNum,
                            total: activeStudents.length
                          });
                          setJumpRankInput(String(rankNum));
                        }}
                        disabled={isSaving}
                        className="p-1.5 rounded-lg text-[#5B5040] hover:text-[#1A4E47] hover:bg-amber-100 border border-[#D9CEB0] transition-colors cursor-pointer"
                        title="تحديد الرتبة بالرقم مباشرة (مثال: الانتقال للرقم 1)"
                      >
                        <Hash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Drop Indicator Below */}
                  {isOverThis && dropPosition === 'after' && (
                    <div className="mt-1.5 bg-amber-600 text-white text-center py-1 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm animate-pulse">
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>إفلات هنا لوضع التلميذ لاحقاً (بعد: {st.name}) وتحيين الأرقام ⬇️</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E4DBC0] flex items-center justify-between bg-[#EFE9D5] shrink-0">
          <div className="text-xs text-[#7A6B58]">
            {isSaving ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-[#8A5A18] animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري حفظ وتحيين الأرقام في قاعدة البيانات...</span>
              </span>
            ) : (
              <span>✓ كافة التغييرات تُحفظ فورياً وتُحدّث في السجلات والطباعة</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold cursor-pointer shadow-xs"
          >
            إغلاق
          </button>
        </div>

        {/* Jump to Rank Dialog */}
        {movingStudent && (
          <div className="fixed inset-0 z-60 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#F4EFDE] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#E4DBC0] text-[#2A2118]">
              <h3 className="font-bold text-base mb-2 font-serif flex items-center gap-2">
                <Hash className="w-5 h-5 text-[#8A5A18]" />
                <span>تحديد الرتبة بالرقم مباشرة</span>
              </h3>
              <p className="text-xs text-[#5B5040] mb-4 leading-relaxed">
                التلميذ(ة): <strong className="text-[#2A2118]">{movingStudent.name}</strong>
                <br />
                الرتبة الحالية: <strong>#{movingStudent.currentRank}</strong> (من أصل {movingStudent.total})
              </p>
              <div className="mb-4">
                <label className="block text-xs font-bold text-[#5B5040] mb-1.5">
                  الرتبة الجديدة (من 1 إلى {movingStudent.total}):
                </label>
                <input
                  type="number"
                  min={1}
                  max={movingStudent.total}
                  value={jumpRankInput}
                  onChange={(e) => setJumpRankInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CEB0] bg-[#FFFDF9] text-center font-mono font-bold text-lg focus:outline-none focus:border-[#8A5A18]"
                  placeholder="1"
                  autoFocus
                />
                <p className="text-[11px] text-[#7A6B58] mt-1.5">
                  💡 سيتم وضع التلميذ في هذه الرتبة وتحيين أرقام كافة التلاميذ تسلسلياً وتصاعدياً.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovingStudent(null)}
                  className="px-3.5 py-2 rounded-xl bg-[#E8DEC0] hover:bg-[#D9CEB0] text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleJumpRankSubmit}
                  disabled={!jumpRankInput || isNaN(parseInt(jumpRankInput, 10)) || isSaving}
                  className="px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'جاري التحيين...' : 'تأكيد وتحيين'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
