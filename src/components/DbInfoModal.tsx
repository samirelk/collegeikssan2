import React from 'react';
import {
  Database,
  Download,
  Upload,
  Clock,
  CheckCircle2,
  HardDrive,
  FileText,
  Users,
  Layers,
  X,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { DbStats, ChangeLogItem } from '../types';

interface DbInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbStats: DbStats | null;
  historyLogs: ChangeLogItem[];
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  backupInputRef: React.RefObject<HTMLInputElement | null>;
  onRefresh?: () => void;
}

export const DbInfoModal: React.FC<DbInfoModalProps> = ({
  isOpen,
  onClose,
  dbStats,
  historyLogs,
  onExportBackup,
  onImportBackup,
  backupInputRef,
  onRefresh
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-[#E5DFD4] my-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD4]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F2F0] text-[#1A4E47] flex items-center justify-center border border-[#1A4E47]/20">
              <Database className="w-6 h-6 text-[#1A4E47]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1F2926] font-['Amiri',serif]">
                قاعدة بيانات النظام وسجل النسخ الاحتياطي
              </h3>
              <p className="text-xs text-[#6C6356]">
                إدارة قاعدة بيانات SQLite المدمجة وتصدير واسترجاع نسخ النظام
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="تحديث البيانات"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#6C6356] hover:text-[#1A4E47] hover:bg-[#F4F0E8] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#6C6356] hover:text-[#1F2926] hover:bg-[#F4F0E8] font-bold text-sm transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Database Status & Health Cards */}
        {dbStats ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4] space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E5DFD4]/70">
                <span className="text-[#6C6356] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#1A4E47]" />
                  حالة الاتصال والحفظ:
                </span>
                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  متصلة ونشطة (SQLite Durable)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2 rounded-xl bg-white border border-[#E5DFD4]">
                  <div className="text-[11px] text-[#6C6356]">حجم الملف</div>
                  <div className="text-sm font-bold font-mono text-[#1F2926] mt-0.5">
                    {dbStats.fileSizeKb} KB
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white border border-[#E5DFD4]">
                  <div className="text-[11px] text-[#6C6356]">الأقسام الدراسية</div>
                  <div className="text-sm font-bold font-mono text-[#1A4E47] mt-0.5">
                    {dbStats.sectionsCount}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white border border-[#E5DFD4]">
                  <div className="text-[11px] text-[#6C6356]">التلاميذ بالمقاعد</div>
                  <div className="text-sm font-bold font-mono text-[#C98A3C] mt-0.5">
                    {dbStats.assignedSeatsCount}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white border border-[#E5DFD4]">
                  <div className="text-[11px] text-[#6C6356]">الملاحظات</div>
                  <div className="text-sm font-bold font-mono text-[#1F2926] mt-0.5">
                    {dbStats.notesCount}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-[#8C8275] pt-1 flex items-center justify-between">
                <span>مسار الملف: <code className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded-md border border-[#E5DFD4] text-[#1F2926]">{dbStats.dbPath}</code></span>
                <span>المحرك: <strong className="font-mono text-[#1F2926]">{dbStats.engine}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD4] text-center text-xs text-[#6C6356]">
            جاري تحميل تفاصيل قاعدة البيانات...
          </div>
        )}

        {/* Backup Actions */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#1F2926]">
            عمليات النسخ الاحتياطي والاسترجاع:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onExportBackup}
              className="p-3 rounded-2xl border-2 border-dashed border-[#1A4E47]/40 bg-[#E8F2F0]/50 hover:bg-[#E8F2F0] hover:border-[#1A4E47] transition-all flex items-center gap-3 text-right cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#1A4E47] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Download className="w-4 h-4 text-[#C98A3C]" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#1A4E47]">تصدير نسخة احتياطية (JSON)</div>
                <div className="text-[11px] text-[#6C6356]">حفظ الأقسام والمقاعد والبيانات كملف</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="p-3 rounded-2xl border-2 border-dashed border-[#C98A3C]/40 bg-[#FAF6EE] hover:bg-[#F5EEDC] hover:border-[#C98A3C] transition-all flex items-center gap-3 text-right cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#C98A3C] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Upload className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#8A5A18]">استرجاع نسخة احتياطية</div>
                <div className="text-[11px] text-[#6C6356]">تحميل ملف JSON واستعادة البيانات السابقة</div>
              </div>
            </button>

            <input
              type="file"
              ref={backupInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={onImportBackup}
            />
          </div>
        </div>

        {/* Audit Log / History */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#1F2926] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#1A4E47]" />
              سجل آخر العمليات والتعديلات (Audit Log):
            </label>
            <span className="text-[11px] text-[#6C6356]">
              {historyLogs.length} عملية مسجلة
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto border border-[#E5DFD4] rounded-2xl text-xs bg-[#FAF8F5]">
            {historyLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#6C6356]">
                لا توجد سجلات تعديل مسجلة حالياً
              </div>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead className="bg-[#EFEAE1] border-b border-[#E5DFD4] text-[#1F2926] sticky top-0">
                  <tr>
                    <th className="p-2 text-[11px] font-bold">العملية</th>
                    <th className="p-2 text-[11px] font-bold">التفاصيل</th>
                    <th className="p-2 text-[11px] font-bold w-24">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD4]">
                  {historyLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/80 transition-colors">
                      <td className="p-2 font-mono font-bold text-[10px] text-[#1A4E47]">
                        {log.action}
                      </td>
                      <td className="p-2 text-[#4A4036] text-[11px]">
                        {log.summary}
                      </td>
                      <td className="p-2 text-[#8C8275] whitespace-nowrap text-[10px] font-mono">
                        {new Date(log.created_at).toLocaleTimeString('ar-MA', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E5DFD4] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#E5DFD4] hover:bg-[#D5CDC0] text-[#1F2926] text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
