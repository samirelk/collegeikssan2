import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Check,
  X,
  Loader2,
  ShieldAlert,
  ListChecks,
  CheckCircle2,
  Search
} from 'lucide-react';
import { ViolationTypeItem, User } from '../types';

interface ViolationTypesManagementProps {
  currentUser?: User;
  onToast?: (msg: string) => void;
}

export const ViolationTypesManagement: React.FC<ViolationTypesManagementProps> = ({
  currentUser,
  onToast = () => {}
}) => {
  const [types, setTypes] = useState<ViolationTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add state
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<'normal' | 'warning' | 'severe'>('normal');
  const [isAdding, setIsAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSeverity, setEditSeverity] = useState<'normal' | 'warning' | 'severe'>('normal');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchViolationTypes();
  }, []);

  const fetchViolationTypes = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/violation-types');
      const data = await res.json();
      if (data.success && Array.isArray(data.types)) {
        setTypes(data.types);
      }
    } catch (err) {
      console.error('Error fetching violation types:', err);
      onToast('تعذر تحميل لائحة المخالفات المعتمدة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newTitle.trim();
    if (!cleanTitle) {
      onToast('يرجى كتابة نص المخالفة');
      return;
    }

    try {
      setIsAdding(true);
      const res = await fetch('/api/violation-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'admin'
        },
        body: JSON.stringify({ title: cleanTitle, severity: newSeverity })
      });
      const data = await res.json();
      if (data.success) {
        onToast(`تمت إضافة مخالفة: "${cleanTitle}" بنجاح`);
        setNewTitle('');
        fetchViolationTypes();
      } else {
        onToast(data.error || 'تعذر إضافة المخالفة');
      }
    } catch (err) {
      console.error('Error adding violation type:', err);
      onToast('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (item: ViolationTypeItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditSeverity((item.severity as 'normal' | 'warning' | 'severe') || 'normal');
  };

  const handleSaveEdit = async (id: string) => {
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) {
      onToast('يرجى كتابة نص المخالفة');
      return;
    }

    try {
      setIsUpdating(true);
      const res = await fetch(`/api/violation-types/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'admin'
        },
        body: JSON.stringify({ title: cleanTitle, severity: editSeverity })
      });
      const data = await res.json();
      if (data.success) {
        onToast('تم تحديث بيانات المخالفة بنجاح');
        setEditingId(null);
        fetchViolationTypes();
      } else {
        onToast(data.error || 'تعذر تحديث المخالفة');
      }
    } catch (err) {
      console.error('Error updating violation type:', err);
      onToast('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف المخالفة "${title}" من القائمة المعتمدة للأساتذة؟`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/violation-types/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'admin'
        }
      });
      const data = await res.json();
      if (data.success) {
        onToast(`تم حذف المخالفة "${title}" من القائمة`);
        fetchViolationTypes();
      } else {
        onToast(data.error || 'تعذر حذف المخالفة');
      }
    } catch (err) {
      console.error('Error deleting violation type:', err);
      onToast('حدث خطأ أثناء حذف المخالفة');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetDefaults = async () => {
    if (
      !window.confirm(
        'هل أنت متأكد من استعادة القائمة الافتراضية الرسمية للمخالفات (10 مخالفات مدرسية معتمدة)؟ سيتم إعادة ضبط القائمة.'
      )
    ) {
      return;
    }

    try {
      setIsResetting(true);
      const res = await fetch('/api/violation-types/reset', {
        method: 'POST',
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'admin'
        }
      });
      const data = await res.json();
      if (data.success) {
        onToast('تم استعادة قائمة المخالفات الافتراضية بنجاح (10 مخالفات معتمدة)');
        fetchViolationTypes();
      } else {
        onToast(data.error || 'تعذر استعادة القائمة الافتراضية');
      }
    } catch (err) {
      console.error('Error resetting violation types:', err);
      onToast('حدث خطأ أثناء استعادة القائمة');
    } finally {
      setIsResetting(false);
    }
  };

  const filteredTypes = types.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="bg-[#FAF8F5] border border-[#D5CDC0] rounded-2xl p-4 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5DFD5] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 mb-1.5 border border-red-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>خاص بالإدارة والمدير</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#1F2926] m-0">
            إدارة قائمة المخالفات المعتمدة داخل المؤسسة
          </h2>
          <p className="text-xs sm:text-sm text-[#5E6D66] mt-1 max-w-2xl">
            هذه هي القائمة المحددة مسبقاً التي تظهر في قائمة الاختيار لجميع الأساتذة عند تسجيل أي مخالفة لأي تلميذ. يمكن للإدارة إضافة مخالفات جديدة، تعديلها، أو حذفها.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={isResetting}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 text-red-800 border border-red-200 text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto"
          title="استعادة المخالفات الـ 10 الافتراضية"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>استعادة القائمة الافتراضية (10 مخالفات)</span>
        </button>
      </div>

      {/* Add New Violation Form */}
      <div className="bg-white border border-[#E5DFD5] rounded-xl p-4 shadow-2xs">
        <h3 className="text-sm font-bold text-[#1F2926] mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#1A4E47]" />
          <span>إضافة مخالفة جديدة إلى القائمة المعتمدة</span>
        </h3>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="اكتب عنوان المخالفة بدقة (مثال: استخدام الأجهزة الإلكترونية دون إذن، إثارة الفوضى...)"
                className="w-full bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-[#1A4E47]/20 focus:border-[#1A4E47]"
                required
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isAdding}
                className="w-full h-full min-h-[42px] px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الإضافة...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>إضافة للقائمة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-[#5E6D66] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في لائحة المخالفات..."
            className="w-full bg-white border border-[#D5CDC0] rounded-xl pr-9 pl-4 py-2 text-xs text-[#1F2926] focus:outline-hidden focus:ring-2 focus:ring-[#1A4E47]/20 focus:border-[#1A4E47]"
          />
        </div>

        <div className="text-xs font-bold text-[#5E6D66] flex items-center gap-2">
          <span>العدد الإجمالي للمخالفات المعتمدة:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#E8F2F0] text-[#1A4E47] font-mono">
            {types.length} مخالفة
          </span>
        </div>
      </div>

      {/* Violation Types Table */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-[#5E6D66] flex flex-col items-center justify-center gap-2 bg-white rounded-xl border border-[#E5DFD5]">
          <Loader2 className="w-6 h-6 animate-spin text-[#1A4E47]" />
          <span>جاري تحميل لائحة المخالفات...</span>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#5E6D66] bg-white rounded-xl border border-dashed border-[#D5CDC0] space-y-2">
          <p className="font-bold">لم يتم العثور على أي مخالفات تطابق البحث.</p>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-[#1A4E47] underline font-bold cursor-pointer"
          >
            استعادة القائمة الافتراضية
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD5] rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-[#F5F0E6] text-[#1F2926] border-b border-[#E5DFD5]">
                <th className="p-3 font-bold text-center w-12">#</th>
                <th className="p-3 font-bold">عنوان المخالفة المعتمدة</th>
                <th className="p-3 font-bold text-center w-28">الحالة</th>
                <th className="p-3 font-bold text-center w-36">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD5]">
              {filteredTypes.map((item, idx) => {
                const isEditing = editingId === item.id;

                return (
                  <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="p-3 text-center font-mono font-bold text-[#5E6D66]">
                      {idx + 1}
                    </td>

                    <td className="p-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-white border border-[#1A4E47] rounded-lg px-3 py-1.5 text-xs font-bold text-[#1F2926] focus:outline-hidden"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="font-bold text-[#1F2926] text-xs sm:text-sm">
                          {item.title}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>معتمدة</span>
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={isUpdating}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                            title="حفظ التعديل"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer"
                            title="إلغاء"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#E8F2F0] text-[#1A4E47] border border-[#D5CDC0] cursor-pointer transition-colors"
                            title="تعديل نص المخالفة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.title)}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer transition-colors"
                            title="حذف المخالفة"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
