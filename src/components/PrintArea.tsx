import React from 'react';
import { AppSettings, SeatItem, SectionItem } from '../types';

interface PrintAreaProps {
  settings: AppSettings;
  section: SectionItem | null;
  seat: SeatItem | null;
}

export const PrintArea: React.FC<PrintAreaProps> = ({ settings, section, seat }) => {
  if (!section || !seat) return <div id="print-area" style={{ display: 'none' }} />;

  const sectionTitle = `${section.level || 'بدون مستوى'} - ${section.classNumber ? `القسم ${section.classNumber}` : 'بدون قسم'}`;
  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const printDate = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const printTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  return (
    <div id="print-area">
      <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '2px solid #854d0e', paddingBottom: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1E3B2C' }}>المملكة المغربية • ROYAUME DU MAROC</div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#854d0e' }}>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
        <div style={{ fontSize: '11px', color: '#4b5563' }}>
          {settings.academy || 'الأكاديمية الجهوية للتربية والتكوين - جهة الشرق'} • {settings.directorate || 'المديرية الإقليمية بالناظور'}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#991b1b', marginTop: '2px' }}>
          {settings.institution || 'الثانوية الإعدادية ايكسان'}
        </div>
        <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '2px' }}>
          الموسم الدراسي: <b>{settings.year || '2026/2027'}</b> • تاريخ الطباعة: <b>{printDate} — {printTime} (GMT)</b>
        </div>
      </div>

      <h1 className="print-sheet-title" style={{ marginTop: '8px' }}>
        بطاقة ملاحظات وسلوك التلميذ(ة)
      </h1>

      <div className="print-info-grid">
        <div>
          <b>الاسم الكامل:</b> {seat.name || '—'}
        </div>
        <div>
          <b>رقم المقعد (مكان الجلوس):</b> مقعد #{seat.seat}
        </div>
        <div>
          <b>القسم والمستوى:</b> {sectionTitle}
        </div>
        <div>
          <b>رقم التلميذ في القسم:</b> {seat.number || '—'}
        </div>
        <div>
          <b>الأستاذ(ة):</b> {section.teacher || settings.teacher || '—'}
        </div>
      </div>

      <table className="print-notes-table">
        <thead>
          <tr>
            <th style={{ width: '110px' }}>التاريخ</th>
            <th style={{ width: '80px' }}>الوقت</th>
            <th>الملاحظة المسجلة</th>
          </tr>
        </thead>
        <tbody>
          {seat.notes.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', color: '#777', padding: '16px' }}>
                لا توجد ملاحظات مسجلة لهذا التلميذ.
              </td>
            </tr>
          ) : (
            seat.notes.map((note) => (
              <tr key={note.id}>
                <td className="p-date">{note.date}</td>
                <td className="p-date">{note.time}</td>
                <td>{note.text}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="print-footer">
        منظومة تدبير الفصول والأقسام • الموقع الرسمي: www.lyceecom.com
      </div>
    </div>
  );
};
