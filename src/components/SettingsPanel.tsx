import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, Building, Calendar, User, Database } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => Promise<void>;
  isSaving: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSave, isSaving }) => {
  const [institution, setInstitution] = useState(settings.institution || '');
  const [academy, setAcademy] = useState(settings.academy || 'الأكاديمية الجهوية للتربية والتكوين - جهة الشرق');
  const [directorate, setDirectorate] = useState(settings.directorate || 'المديرية الإقليمية بالناظور');
  const [year, setYear] = useState(settings.year || '2026/2027');
  const [teacher, setTeacher] = useState(settings.teacher || '');
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setInstitution(settings.institution || 'الثانوية الإعدادية ايكسان');
    setAcademy(settings.academy || 'الأكاديمية الجهوية للتربية والتكوين - جهة الشرق');
    setDirectorate(settings.directorate || 'المديرية الإقليمية بالناظور');
    setYear(settings.year || '2026/2027');
    setTeacher(settings.teacher || '');
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      institution: institution.trim(),
      academy: academy.trim(),
      directorate: directorate.trim(),
      year: year.trim(),
      teacher: teacher.trim(),
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const isDirty =
    institution !== (settings.institution || '') ||
    academy !== (settings.academy || 'الأكاديمية الجهوية للتربية والتكوين - جهة الشرق') ||
    directorate !== (settings.directorate || 'المديرية الإقليمية بالناظور') ||
    year !== (settings.year || '') ||
    teacher !== (settings.teacher || '');

  return (
    <div className="bg-[#2A4F40] border border-[rgba(242,239,227,0.16)] rounded-2xl p-4 sm:p-5 mb-6 shadow-md">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[rgba(242,239,227,0.1)]">
        <div className="flex items-center gap-2 text-xs text-[rgba(242,239,227,0.75)] font-bold">
          <Database className="w-3.5 h-3.5 text-[#C98A3C]" />
          <span>الهوية الإدارية الرسمية لوزارة التربية الوطنية والتعليم الأولي والرياضة 2026</span>
        </div>
        {justSaved && (
          <span className="flex items-center gap-1 text-xs text-emerald-300 font-semibold animate-pulse">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تم حفظ الترويسة والإعدادات بنجاح!</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-3 sm:gap-4 flex-wrap">
        <div className="flex-1 min-w-[170px]">
          <label className="block text-[11.5px] font-bold text-[rgba(242,239,227,0.65)] mb-1.5 flex items-center gap-1">
            <Building className="w-3 h-3 text-[#C98A3C]" />
            <span>اسم المؤسسة التعليمية</span>
          </label>
          <input
            type="text"
            id="input-institution"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="مثال: الثانوية الإعدادية ايكسان"
            className="w-full bg-[rgba(0,0,0,0.22)] border border-[rgba(242,239,227,0.18)] rounded-xl px-3 py-2 text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.3)] focus:outline-hidden focus:border-[#C98A3C] transition-colors"
          />
        </div>

        <div className="flex-1 min-w-[170px]">
          <label className="block text-[11.5px] font-bold text-[rgba(242,239,227,0.65)] mb-1.5 flex items-center gap-1">
            <Building className="w-3 h-3 text-[#C98A3C]" />
            <span>الأكاديمية الجهوية (AREF)</span>
          </label>
          <input
            type="text"
            id="input-academy"
            value={academy}
            onChange={(e) => setAcademy(e.target.value)}
            placeholder="الأكاديمية الجهوية للتربية والتكوين - جهة الشرق"
            className="w-full bg-[rgba(0,0,0,0.22)] border border-[rgba(242,239,227,0.18)] rounded-xl px-3 py-2 text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.3)] focus:outline-hidden focus:border-[#C98A3C] transition-colors"
          />
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-[11.5px] font-bold text-[rgba(242,239,227,0.65)] mb-1.5 flex items-center gap-1">
            <Building className="w-3 h-3 text-[#C98A3C]" />
            <span>المديرية الإقليمية</span>
          </label>
          <input
            type="text"
            id="input-directorate"
            value={directorate}
            onChange={(e) => setDirectorate(e.target.value)}
            placeholder="المديرية الإقليمية بالناظور"
            className="w-full bg-[rgba(0,0,0,0.22)] border border-[rgba(242,239,227,0.18)] rounded-xl px-3 py-2 text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.3)] focus:outline-hidden focus:border-[#C98A3C] transition-colors"
          />
        </div>

        <div className="flex-1 min-w-[120px]">
          <label className="block text-[11.5px] font-bold text-[rgba(242,239,227,0.65)] mb-1.5 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#C98A3C]" />
            <span>الموسم الدراسي</span>
          </label>
          <input
            type="text"
            id="input-year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="مثال: 2026/2027"
            className="w-full bg-[rgba(0,0,0,0.22)] border border-[rgba(242,239,227,0.18)] rounded-xl px-3 py-2 text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.3)] focus:outline-hidden focus:border-[#C98A3C] transition-colors"
          />
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11.5px] font-bold text-[rgba(242,239,227,0.65)] mb-1.5 flex items-center gap-1">
            <User className="w-3 h-3 text-[#C98A3C]" />
            <span>اسم الأستاذ(ة)</span>
          </label>
          <input
            type="text"
            id="input-teacher"
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            placeholder="اسم الأستاذ(ة) الافتراضي"
            className="w-full bg-[rgba(0,0,0,0.22)] border border-[rgba(242,239,227,0.18)] rounded-xl px-3 py-2 text-sm text-[#F2EFE3] placeholder-[rgba(242,239,227,0.3)] focus:outline-hidden focus:border-[#C98A3C] transition-colors"
          />
        </div>

        <button
          type="submit"
          id="btn-save-settings"
          disabled={isSaving || (!isDirty && !justSaved)}
          className={`shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all shadow-sm ${
            isDirty
              ? 'bg-[#C98A3C] hover:bg-[#D8994A] text-[#2A1B06] cursor-pointer shadow-[#A96E28]'
              : 'bg-[rgba(242,239,227,0.12)] text-[rgba(242,239,227,0.4)] cursor-default'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'جارِ الحفظ...' : 'حفظ الإعدادات والترويسة'}</span>
        </button>
      </form>
    </div>
  );
};
