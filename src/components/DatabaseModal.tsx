import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Database, 
  Download, 
  Upload, 
  History,
  CloudUpload,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DbStats, ChangeLogItem } from '../types';

interface CloudSnapshot {
  id: string;
  createdAt: string;
  sectionsCount: number;
  sizeKb: number;
  reason: string;
}

interface CloudBackupStatus {
  active: boolean;
  lastSnapshotAt: string | null;
  lastSnapshotError: string | null;
  pendingChanges: boolean;
}

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: DbStats | null;
  historyLogs: ChangeLogItem[];
  onImportBackup: (backupData: any) => Promise<void>;
  onToast: (msg: string) => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  isOpen,
  onClose,
  stats,
  historyLogs,
  onImportBackup,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'cloud' | 'history'>('status');
  const [isImporting, setIsImporting] = useState(false);

  const [cloudStatus, setCloudStatus] = useState<CloudBackupStatus | null>(null);
  const [snapshots, setSnapshots] = useState<CloudSnapshot[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);

  const loadCloudBackups = useCallback(async () => {
    setCloudLoading(true);
    try {
      const res = await fetch('/api/cloud-backup/status');
      const data = await res.json();
      if (data.success) {
        setCloudStatus(data.status);
        setSnapshots(data.snapshots || []);
      }
    } catch {
      onToast('تعذّر تحميل حالة النسخ السحابي');
    } finally {
      setCloudLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (isOpen && activeTab === 'cloud') {
      void loadCloudBackups();
    }
  }, [isOpen, activeTab, loadCloudBackups]);

  const handleBackupNow = async () => {
    setCloudBusy(true);
    try {
      const res = await fetch('/api/cloud-backup/snapshot', { method: 'POST' });
      const data = await res.json();
      onToast(data.message || (data.success ? 'تم الحفظ السحابي' : 'فشل الحفظ السحابي'));
      await loadCloudBackups();
    } catch {
      onToast('فشل الحفظ السحابي');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    const ok = window.confirm(
      `سيتم استرجاع نسخة يوم ${snapshotId} واستبدال كل الأقسام ومقاعد التلاميذ والإعدادات الحالية بها. هل تريد المتابعة؟`
    );
    if (!ok) return;
    setCloudBusy(true);
    try {
      const res = await fetch('/api/cloud-backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId }),
      });
      const data = await res.json();
      if (data.success) {
        onToast(data.message || 'تم الاسترجاع بنجاح');
        setTimeout(() => window.location.reload(), 900);
      } else {
        onToast(data.error || 'فشل الاسترجاع');
      }
    } catch {
      onToast('فشل الاسترجاع');
    } finally {
      setCloudBusy(false);
    }
  };

  const formatWhen = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-MA', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      const res = await fetch('/api/db/export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `classroom-seating-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      onToast('تم تحميل نسخة احتياطية من قاعدة البيانات بنجاح');
    } catch {
      onToast('فشل تصدير النسخة الاحتياطية');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsImporting(true);
        const json = JSON.parse(event.target?.result as string);
        await onImportBackup(json);
        onToast('تمت استعادة النسخة الاحتياطية بنجاح في قاعدة البيانات');
        onClose();
      } catch (err: any) {
        onToast(err.message || 'ملف غير صالح أو حدث خطأ أثناء الاستيراد');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#F4EFDE] text-[#2A2118] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-[#E4DBC0] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E4DBC0] flex items-center justify-between bg-[#EFE9D5]">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#A96E28]" />
            <h3 className="text-lg font-bold font-serif text-[#2A2118] m-0">
              قاعدة البيانات والنسخ الاحتياطي (SQLite)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5B5040] hover:text-[#A8443A] hover:bg-[rgba(168,68,58,0.1)] transition-colors cursor-pointer text-lg font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E4DBC0] bg-[#EFE9D5]/60 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-colors cursor-pointer ${
              activeTab === 'status'
                ? 'bg-[#F4EFDE] text-[#2A2118] border-t border-x border-[#E4DBC0]'
                : 'text-[#5B5040] hover:text-[#2A2118]'
            }`}
          >
            حالة الخادم والتخزين
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cloud'
                ? 'bg-[#F4EFDE] text-[#2A2118] border-t border-x border-[#E4DBC0]'
                : 'text-[#5B5040] hover:text-[#2A2118]'
            }`}
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>النسخ السحابي التلقائي</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#F4EFDE] text-[#2A2118] border-t border-x border-[#E4DBC0]'
                : 'text-[#5B5040] hover:text-[#2A2118]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>سجل التغييرات ({historyLogs.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'cloud' ? (
            <div className="space-y-4">
              {/* Status banner */}
              <div className="bg-white p-4 rounded-xl border border-[#E4DBC0] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CloudUpload className="w-4 h-4 text-[#A96E28]" />
                    <span className="text-xs font-bold text-[#2A2118]">النسخ الاحتياطي السحابي التلقائي</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadCloudBackups()}
                    disabled={cloudLoading}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#5B5040] hover:text-[#2A2118] hover:bg-[rgba(42,33,24,0.08)] transition-colors cursor-pointer disabled:opacity-50"
                    title="تحديث"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cloudLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  {cloudStatus?.active ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>مُفعّل — يتم الحفظ تلقائياً بعد كل تعديل وكل 5 دقائق</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#5B5040] font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>غير مُفعّل</span>
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-[#5B5040]">
                  آخر نسخة محفوظة:{' '}
                  <span className="font-bold text-[#2A2118]">{formatWhen(cloudStatus?.lastSnapshotAt || null)}</span>
                  {cloudStatus?.pendingChanges && (
                    <span className="text-[#A96E28] font-semibold"> • توجد تعديلات بانتظار الحفظ</span>
                  )}
                </div>

                {cloudStatus?.lastSnapshotError && (
                  <div className="text-[11px] text-[#A8443A] font-semibold">
                    خطأ في آخر محاولة حفظ: {cloudStatus.lastSnapshotError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={cloudBusy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#C98A3C] hover:bg-[#D8994A] text-[#2A1B06] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{cloudBusy ? 'جارٍ الحفظ...' : 'حفظ نسخة الآن'}</span>
                </button>

                <p className="text-[11px] text-[#5B5040] leading-relaxed m-0">
                  يتم استرجاع أحدث نسخة تلقائياً عند إعادة تشغيل الخادم، فلا حاجة لاستعادة أي شيء يدوياً. النقاط المحفوظة أدناه (نسخة لكل يوم) متاحة للرجوع إلى نسخة يوم سابق عند الحاجة.
                </p>
              </div>

              {/* Restore points */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#2A2118] block">نقاط الاسترجاع اليومية ({snapshots.length})</span>
                {cloudLoading ? (
                  <div className="text-center py-6 text-[#5B5040] text-xs">جارٍ التحميل...</div>
                ) : snapshots.length === 0 ? (
                  <div className="text-center py-6 text-[#5B5040] text-xs">
                    لا توجد نسخ سحابية بعد. سيتم إنشاء أول نسخة تلقائياً بعد أول تعديل.
                  </div>
                ) : (
                  snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="bg-white p-3 rounded-xl border border-[#E4DBC0] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#2A2118] font-mono">{snap.id}</div>
                        <div className="text-[10px] text-[#5B5040]">
                          {formatWhen(snap.createdAt)} • {snap.sectionsCount} قسم • {snap.sizeKb} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreSnapshot(snap.id)}
                        disabled={cloudBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[rgba(42,33,24,0.06)] hover:bg-[rgba(201,138,60,0.18)] border border-[#E4DBC0] text-[#2A2118] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#A96E28]" />
                        <span>استرجاع</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeTab === 'status' ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-[#E4DBC0] space-y-1">
                  <span className="text-[11px] text-[#5B5040] font-bold block">محرك التخزين</span>
                  <div className="text-xs font-bold text-[#2A2118]">Node.js 22 SQLite</div>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>محمي بنسخ سحابي تلقائي</span>
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-[#E4DBC0] space-y-1">
                  <span className="text-[11px] text-[#5B5040] font-bold block">ملف قاعدة البيانات</span>
                  <div className="text-xs font-mono text-[#2A2118] truncate" title="data/classroom_database.sqlite">
                    data/classroom_database.sqlite
                  </div>
                  <span className="text-[10px] text-[#5B5040]">
                    الحجم: {stats?.fileSizeKb || 0} KB
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-[#E4DBC0] space-y-1">
                  <span className="text-[11px] text-[#5B5040] font-bold block">إجمالي الأقسام</span>
                  <div className="text-lg font-black text-[#C98A3C] font-serif">
                    {stats?.sectionsCount || 0}
                  </div>
                  <span className="text-[10px] text-[#5B5040]">أقسام مسجلة</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-[#E4DBC0] space-y-1">
                  <span className="text-[11px] text-[#5B5040] font-bold block">الملاحظات المسجلة</span>
                  <div className="text-lg font-black text-[#A96E28] font-serif">
                    {stats?.notesCount || 0}
                  </div>
                  <span className="text-[10px] text-[#5B5040]">ملاحظات مؤرخة</span>
                </div>
              </div>

              {/* Actions Section */}
              <div className="bg-white p-4 rounded-xl border border-[#E4DBC0] space-y-3">
                <span className="text-xs font-bold text-[#2A2118] block">
                  النسخ الاحتياطي والاسترجاع
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Export JSON */}
                  <button
                    type="button"
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#C98A3C] hover:bg-[#D8994A] text-[#2A1B06] transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير نسخة كاملة (JSON)</span>
                  </button>

                  {/* Import JSON */}
                  <label
                    htmlFor="upload-db-backup"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[rgba(42,33,24,0.06)] hover:bg-[rgba(42,33,24,0.12)] border border-[#E4DBC0] text-[#2A2118] transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#5B5040]" />
                    <span>{isImporting ? 'جارِ الاستيراد...' : 'استيراد نسخة احتياطية'}</span>
                    <input
                      type="file"
                      id="upload-db-backup"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <p className="text-[11px] text-[#5B5040] leading-relaxed">
                  النسخة الاحتياطية تحتوي على كل إعدادات المؤسسة، الأقسام، مقاعد التلاميذ، والملاحظات الصفية.
                </p>
              </div>
            </>
          ) : (
            /* Change History List */
            <div className="space-y-2">
              {historyLogs.length === 0 ? (
                <div className="text-center py-8 text-[#5B5040] text-xs">
                  لا توجد سجلات تعديل بعد.
                </div>
              ) : (
                historyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white p-3 rounded-xl border border-[#E4DBC0] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#5B5040]">
                      <span className="font-bold text-[#A96E28]">#{log.id} • {log.action}</span>
                      <span className="font-mono">{new Date(log.created_at).toLocaleString('ar-SA')}</span>
                    </div>
                    <p className="text-[#2A2118] font-medium m-0">{log.summary}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
