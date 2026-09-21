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
  const printDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const printTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <div id="print-area">
      <h1 className="print-sheet-title">
        {settings.institution || 'تقرير ملاحظات التلميذ'}
      </h1>

      <div className="print-sheet-sub">
        {settings.institution && 'تقرير متابعة وملاحظات التلميذ'}
        {settings.year && ` · الموسم الدراسي: ${settings.year}`}
        {` · طُبع بتاريخ ${printDate} — ${printTime}`}
      </div>

      <div className="print-info-grid">
        <div>
          <b>الاسم الكامل:</b> {seat.name || '—'}
        </div>
        <div>
          <b>رقم المقعد:</b> {seat.seat}
        </div>
        <div>
          <b>القسم والمستوى:</b> {sectionTitle}
        </div>
        <div>
          <b>الرقم التسلسلي:</b> {seat.number || '—'}
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
        خرائط الأقسام — نظام إدارة الفصول وقاعدة البيانات المدمجة
      </div>
    </div>
  );
};
