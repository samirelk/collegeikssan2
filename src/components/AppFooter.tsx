import React from 'react';
import { Mail, Instagram, GraduationCap, ExternalLink } from 'lucide-react';

interface AppFooterProps {
  institutionName?: string;
  onNavigateAdmin?: () => void;
  onNavigateHome?: () => void;
  isAdminView?: boolean;
}

export const AppFooter: React.FC<AppFooterProps> = ({
  institutionName = 'الثانوية الإعدادية ايكسان',
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-10 pt-8 pb-6 border-t border-[#E5DFD4] bg-[#FAF8F5]/80 text-[#1F2926] transition-all" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between pb-6 border-b border-[#E5DFD4]/80">
          
          {/* Column 1: Institution Branding */}
          <div className="space-y-1.5 text-right">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E8F2F0] text-[#1A4E47] flex items-center justify-center font-bold shrink-0 border border-[#1A4E47]/20 shadow-xs">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#1F2926] font-['Amiri',serif]">
                {institutionName}
              </h3>
            </div>
            <p className="text-xs text-[#6C6356] pr-10">
              المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة
            </p>
          </div>

          {/* Column 2: Direct Contact (Email & Instagram) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
            {/* Email link */}
            <a
              href="mailto:mrsamiro69@gmail.com"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F2EFE9] border border-[#D5CDC0] text-[#1F2926] hover:text-[#1A4E47] transition-all shadow-xs group cursor-pointer"
              title="تواصل عبر البريد الإلكتروني"
            >
              <Mail className="w-4 h-4 text-[#1A4E47] group-hover:scale-110 transition-transform" />
              <span className="font-mono text-xs dir-ltr">mrsamiro69@gmail.com</span>
            </a>

            {/* Instagram link */}
            <a
              href="https://instagram.com/Samirkoraji"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F2EFE9] border border-[#D5CDC0] text-[#1F2926] hover:text-[#C98A3C] transition-all shadow-xs group cursor-pointer"
              title="حساب الأستاذ سمير القراشي على إنستغرام"
            >
              <Instagram className="w-4 h-4 text-pink-700 group-hover:scale-110 transition-transform" />
              <span className="font-mono text-xs dir-ltr">@Samirkoraji</span>
              <ExternalLink className="w-3 h-3 text-[#6C6356] opacity-70" />
            </a>
          </div>

        </div>

        {/* Bottom Sub-footer / Rights */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#6C6356]">
          <p>
            فكرة وتصميم الأستاذ <span className="font-bold text-[#1F2926]">سمير القراشي</span> • الثانوية الإعدادية ايكسان © {currentYear}
          </p>
          <div className="flex items-center gap-3">
            <span>المدرسة الإلكترونية v2.0</span>
            <span className="text-[#D5CDC0]">•</span>
            <span className="text-emerald-800 font-medium">البيانات مؤمنة ومحفوظة</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
