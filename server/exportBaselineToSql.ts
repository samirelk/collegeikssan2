import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const dbPath = path.join(process.cwd(), 'data', 'classroom_database.sqlite');
const db = new DatabaseSync(dbPath);

const violations: any[] = db.prepare('SELECT * FROM daily_violations ORDER BY id').all();
const participations: any[] = db.prepare('SELECT * FROM positive_participations ORDER BY id').all();

console.log(`Found ${violations.length} daily violations in SQLite.`);
console.log(`Found ${participations.length} positive participations in SQLite.`);

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return "'" + String(val).replace(/[\0\x08\x09\x1a\n\r"'\\\x25]/g, (char) => {
    switch (char) {
      case '\0': return '\\0';
      case '\x08': return '\\b';
      case '\x09': return '\\t';
      case '\x1a': return '\\z';
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '"':
      case "'":
      case '\\':
      case '\x25':
        return '\\' + char;
      default:
        return char;
    }
  }) + "'";
}

let violationLines = '\n-- =========================================================================\n';
violationLines += `-- Daily Violations (${violations.length} Authentic Protected Records)\n`;
violationLines += '-- =========================================================================\n';

for (const v of violations) {
  const line = `INSERT INTO daily_violations (id, section_id, seat_num, student_name, student_number, massar_number, violation_type, description, action_taken, teacher_name, teacher_subject, recorded_date, recorded_time, created_at, teacher_id) VALUES (${escapeSql(v.id)}, ${escapeSql(v.section_id)}, ${v.seat_num !== null && v.seat_num !== undefined ? v.seat_num : 'NULL'}, ${escapeSql(v.student_name)}, ${escapeSql(v.student_number || '')}, ${escapeSql(v.massar_number || '')}, ${escapeSql(v.violation_type || 'مخالفة سلوكية')}, ${escapeSql(v.description || '')}, ${escapeSql(v.action_taken || 'تنبيه شفهي')}, ${escapeSql(v.teacher_name || '')}, ${escapeSql(v.teacher_subject || '')}, ${escapeSql(v.recorded_date)}, ${escapeSql(v.recorded_time)}, ${escapeSql(v.created_at)}, ${escapeSql(v.teacher_id || '')}) ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), violation_type=VALUES(violation_type), description=VALUES(description), action_taken=VALUES(action_taken);\n`;
  violationLines += line;
}

let participationLines = '\n-- =========================================================================\n';
participationLines += `-- Baseline Positive Participations (${participations.length} Protected Records)\n`;
participationLines += '-- =========================================================================\n';

for (const p of participations) {
  const line = `INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, teacher_id, recorded_date, recorded_time, created_at) VALUES (${escapeSql(p.id)}, ${escapeSql(p.section_id)}, ${p.seat_num !== null && p.seat_num !== undefined ? p.seat_num : 'NULL'}, ${escapeSql(p.student_name)}, ${escapeSql(p.student_number || '')}, ${escapeSql(p.massar_number || '')}, ${escapeSql(p.participation_type || 'مشاركة متميزة')}, ${p.points || 1}, ${escapeSql(p.note || '')}, ${escapeSql(p.teacher_name || '')}, ${escapeSql(p.teacher_subject || '')}, ${escapeSql(p.teacher_id || '')}, ${escapeSql(p.recorded_date)}, ${escapeSql(p.recorded_time)}, ${escapeSql(p.created_at)}) ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), points=VALUES(points), note=VALUES(note);\n`;
  participationLines += line;
}

const sqlFile = path.join(process.cwd(), 'php-deployment-ready', 'database.sql');
let existingSql = fs.readFileSync(sqlFile, 'utf8');

// Cut off starting from "-- Daily Violations" or "-- Baseline Positive Participations"
const violationMarker = '-- Daily Violations';
if (existingSql.includes(violationMarker)) {
  existingSql = existingSql.split(violationMarker)[0].trimEnd() + '\n';
}
const partMarker = '-- Baseline Positive Participations';
if (existingSql.includes(partMarker)) {
  existingSql = existingSql.split(partMarker)[0].trimEnd() + '\n';
}

fs.writeFileSync(sqlFile, existingSql + violationLines + participationLines, 'utf8');
console.log(`Updated php-deployment-ready/database.sql with ${violations.length} violations and ${participations.length} participations.`);

// Now rebuild zip archives using python3 standard library zipfile
console.log('Re-creating zip archive using python3...');
try {
  const pyScript = `
import os, zipfile
base_dir = "php-deployment-ready"
zip_path = os.path.join(base_dir, "echsa_school_system_php_mysql.zip")
if os.path.exists(zip_path):
    os.remove(zip_path)
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(base_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, base_dir)
            if f == "echsa_school_system_php_mysql.zip":
                continue
            zf.write(full_path, rel_path)
print("Zip archive created successfully:", zip_path)
`;
  execSync(`python3 -c '${pyScript}'`, { stdio: 'inherit' });
  if (fs.existsSync('public')) {
    execSync('cp php-deployment-ready/echsa_school_system_php_mysql.zip public/echsa_school_system_php_mysql.zip', { stdio: 'inherit' });
    console.log('Zip package updated in php-deployment-ready and public directories.');
  }
} catch (e) {
  console.error('Zip creation error:', e);
}
