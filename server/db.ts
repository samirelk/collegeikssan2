import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  cloudSaveUser,
  cloudDeleteUser,
  cloudSaveSection,
  cloudDeleteSection,
  cloudSaveSeat,
  cloudSaveAttendance,
  cloudDeleteAttendance,
  cloudSaveViolation,
  cloudDeleteViolation,
  cloudSaveNote,
  cloudDeleteNote,
  cloudSaveTeacherSeatOverride,
  cloudDeleteTeacherSeatOverride,
  cloudSaveSetting,
  cloudSaveAssignment,
  cloudDeleteAssignment,
  cloudSaveTimetableEntry,
  cloudDeleteTimetableEntry
} from './firestoreSync.ts';

// Ensure data directory exists for durable SQLite file persistence
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'classroom_database.sqlite');
export const db = new DatabaseSync(DB_PATH);

export interface AppSettings {
  institution: string;
  year: string;
  teacher: string;
}

export interface NoteItem {
  id: string;
  text: string;
  date: string;
  time: string;
}

export type SeatStatusColor = 'default' | 'needs_help' | 'excellent' | 'reserved' | 'special_case';
export type SeatAttendance = 'present' | 'absent' | 'late' | null;

export interface SeatItem {
  seat: number;
  name: string;
  number: string;
  massarNumber?: string;
  notes: NoteItem[];
  violations?: any[];
  rosterId: string | null;
  statusColor?: SeatStatusColor;
  attendance?: SeatAttendance;
}

export interface RosterItem {
  id: string;
  name: string;
  number: string;
  massarNumber?: string;
}

export interface AssignedTeacherSummary {
  teacherId: number;
  teacherName: string;
  subject: string;
  academicYear?: string;
}

export interface SectionItem {
  id: string;
  level: string;
  classNumber: string;
  teacher: string;
  createdAt: number;
  seats: SeatItem[];
  roster: RosterItem[];
  assignedTeacherId?: number | null;
  assignedTeacherName?: string | null;
  assignmentStatus?: string;
  assignedTeachers?: AssignedTeacherSummary[];
}

export function initDatabase() {
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. App Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Sections Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      class_number TEXT NOT NULL,
      teacher TEXT,
      created_at INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      roster_json TEXT DEFAULT '[]'
    );
  `);

  // 3. Seats Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id TEXT NOT NULL,
      seat_num INTEGER NOT NULL,
      student_name TEXT DEFAULT '',
      student_number TEXT DEFAULT '',
      massar_number TEXT DEFAULT '',
      roster_id TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(section_id, seat_num),
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_seat_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      seat_num INTEGER NOT NULL,
      student_name TEXT DEFAULT '',
      student_number TEXT DEFAULT '',
      massar_number TEXT DEFAULT '',
      roster_id TEXT DEFAULT NULL,
      status_color TEXT DEFAULT 'default',
      updated_at TEXT NOT NULL,
      UNIQUE(teacher_id, section_id, seat_num),
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );
  `);

  // 4. Notes Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      seat_num INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      note_date TEXT NOT NULL,
      note_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );
  `);
  try {
    db.prepare('ALTER TABLE notes ADD COLUMN teacher_id TEXT DEFAULT ""').run();
  } catch {
    // Column already exists
  }

  // 5. Change History / Audit Log
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 6. Users Table (Admin and Teachers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      academic_year TEXT DEFAULT '2025/2026',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 7. Section Assignments & Requests Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS section_assignments (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      request_note TEXT,
      requested_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      academic_year TEXT,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );
  `);

  // 8. Email Outbox (Simulated delivery and audit for password resets & notifications)
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_outbox (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      token TEXT,
      sent_at TEXT NOT NULL
    );
  `);

  // 9. Password Resets Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      temp_password TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );
  `);

  // 10. Student Change Requests Table (Add / Remove student requests from teachers awaiting Director approval)
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_change_requests (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      teacher_name TEXT NOT NULL,
      teacher_subject TEXT NOT NULL,
      request_type TEXT NOT NULL,
      student_name TEXT NOT NULL,
      student_number TEXT DEFAULT '',
      seat_num INTEGER DEFAULT NULL,
      reason TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      review_note TEXT,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 11. Attendance History / Absences Log
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id TEXT NOT NULL,
      seat_num INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      student_number TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'absent',
      recorded_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 12. School Activities & Photos Table (Teachers & Director publish; Director approves)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_activities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'أنشطة عامة',
      activity_date TEXT DEFAULT NULL,
      activity_time TEXT DEFAULT NULL,
      image_url TEXT DEFAULT '',
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL DEFAULT 'teacher',
      author_subject TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      likes_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Backward compatibility: older restored databases may still be missing the
  // activity date/time columns used by some earlier versions of the app.
  try {
    db.exec('ALTER TABLE school_activities ADD COLUMN activity_date TEXT DEFAULT NULL;');
  } catch {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE school_activities ADD COLUMN activity_time TEXT DEFAULT NULL;');
  } catch {
    // Column already exists
  }

  // 13. Academic Years Table (Managed by School Director)
  db.exec(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      archived_at TEXT DEFAULT NULL
    );
  `);

  // Ensure sections has assigned_teacher_id column
  try {
    db.exec('ALTER TABLE sections ADD COLUMN assigned_teacher_id TEXT DEFAULT NULL;');
  } catch {
    // Column already exists
  }

  // Ensure users has subject column
  try {
    db.exec("ALTER TABLE users ADD COLUMN subject TEXT DEFAULT 'الرياضيات';");
  } catch {
    // Column already exists
  }

  // Ensure section_assignments has subject column
  try {
    db.exec("ALTER TABLE section_assignments ADD COLUMN subject TEXT DEFAULT '';");
  } catch {
    // Column already exists
  }

  // Ensure seats has status_color and attendance columns
  try {
    db.exec("ALTER TABLE seats ADD COLUMN status_color TEXT DEFAULT 'default';");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE seats ADD COLUMN attendance TEXT DEFAULT NULL;");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE seats ADD COLUMN massar_number TEXT DEFAULT '';");
  } catch {
    // Column already exists
  }

  // Ensure users has email verification columns
  try {
    db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN verification_code TEXT DEFAULT NULL;");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN verification_expires_at TEXT DEFAULT NULL;");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN must_change_profile INTEGER DEFAULT 0;");
  } catch {
    // Column already exists
  }

  // Ensure attendance_history has extended columns for daily archive
  const attendanceCols = [
    "ALTER TABLE attendance_history ADD COLUMN session_period TEXT DEFAULT 'كامل اليوم';",
    "ALTER TABLE attendance_history ADD COLUMN teacher_name TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN teacher_subject TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN justified TEXT DEFAULT 'unjustified';",
    "ALTER TABLE attendance_history ADD COLUMN justification_reason TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN notes TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN created_by TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN removed_by TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN removed_at TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN count_in_stats INTEGER DEFAULT 1;"
  ];
  for (const sql of attendanceCols) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists
    }
  }

  // Ensure daily_violations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_violations (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      seat_num INTEGER DEFAULT NULL,
      student_name TEXT NOT NULL,
      student_number TEXT DEFAULT '',
      violation_type TEXT NOT NULL DEFAULT 'مخالفة تربوية أخرى',
      description TEXT NOT NULL,
      action_taken TEXT DEFAULT 'تنبيه شفهي',
      teacher_name TEXT DEFAULT '',
      teacher_subject TEXT DEFAULT '',
      recorded_date TEXT NOT NULL,
      recorded_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS violation_types (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL UNIQUE,
      severity TEXT DEFAULT 'normal',
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Ensure massar_number column in daily_violations
  try {
    db.prepare('ALTER TABLE daily_violations ADD COLUMN massar_number TEXT DEFAULT ""').run();
  } catch {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE daily_violations ADD COLUMN teacher_id TEXT DEFAULT ""').run();
  } catch {
    // Column already exists
  }

  // Ensure teacher_timetable table exists (استعمال زمان الأساتذة)
  db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_timetable (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      period_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      section_id TEXT NOT NULL,
      room TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tt_teacher ON teacher_timetable(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_tt_day ON teacher_timetable(teacher_id, day_of_week);
  `);

  // Seed default predefined violation types if table is empty
  try {
    const vtCount = (db.prepare('SELECT COUNT(*) as count FROM violation_types').get() as any).count;
    if (vtCount === 0) {
      const defaultTypes = [
        'عدم إحضار الأدوات المدرسية',
        'عدم إنجاز الواجبات المنزلية',
        'التشويش داخل القسم',
        'عدم احترام الأستاذ',
        'عدم احترام زملاء القسم',
        'استعمال الهاتف أثناء الحصة',
        'مغادرة القسم دون إذن',
        'عدم الانضباط',
        'إتلاف ممتلكات المؤسسة',
        'مخالفة النظام الداخلي'
      ];
      const insertVt = db.prepare('INSERT INTO violation_types (id, title, severity, order_index, created_at) VALUES (?, ?, ?, ?, ?)');
      const now = new Date().toISOString();
      defaultTypes.forEach((title, idx) => {
        insertVt.run(`vt_${idx + 1}`, title, 'normal', idx + 1, now);
      });
    }
  } catch (err) {
    console.error('Error seeding violation_types:', err);
  }

  // Note: Notes and daily_violations are completely independent entities.
  // Violations log counter tracks ONLY actual violations from daily_violations table.

  // Ensure admin, directors, and default teacher have email_verified = 1
  try {
    db.prepare("UPDATE users SET email_verified = 1 WHERE role IN ('admin', 'director') OR id = 'usr_teacher_alami' OR email LIKE '%samir%'").run();
  } catch {
    // Ignore
  }

  // Seed default settings if not exists
  const settingsCount = (db.prepare('SELECT COUNT(*) as count FROM app_settings').get() as { count: number }).count;
  if (settingsCount === 0) {
    seedInitialData();
  }
  const dataResetCompleted = (db.prepare('SELECT value FROM app_settings WHERE key = ?').get('data_reset_completed') as { value?: string } | undefined)?.value === 'true';

  // Ensure default institution is "الثانوية الإعدادية ايكسان"
  const now = new Date().toISOString();
  const instRow = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('institution') as { value: string } | undefined;
  if (!instRow || instRow.value.includes('النجاح') || instRow.value.includes('الأمل') || !instRow.value.trim()) {
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('institution', 'الثانوية الإعدادية ايكسان', ?)
      ON CONFLICT(key) DO UPDATE SET value = 'الثانوية الإعدادية ايكسان', updated_at = ?
    `).run(now, now);
  }

  // Ensure default academic year is 2026/2027 (starts 1 Sep 2026, ends 3 Jul 2027)
  const yearRow = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('year') as { value: string } | undefined;
  if (!yearRow || yearRow.value === '2025/2026' || !yearRow.value.trim()) {
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('year', '2026/2027', ?)
      ON CONFLICT(key) DO UPDATE SET value = '2026/2027', updated_at = ?
    `).run(now, now);
  }

  // Ensure 2026/2027 exists in academic_years table (ends July 30th)
  const defaultYearInDb = db.prepare('SELECT id FROM academic_years WHERE name = ?').get('2026/2027') as { id: string } | undefined;
  if (!defaultYearInDb) {
    db.prepare(`
      INSERT INTO academic_years (id, name, start_date, end_date, is_current, is_archived, notes, created_at)
      VALUES (?, ?, ?, ?, 1, 0, ?, ?)
    `).run(
      'ay_2026_2027',
      '2026/2027',
      '2026-09-01',
      '2027-07-30',
      'الموسم الدراسي الحالي المعتمد بالثانوية الإعدادية ايكسان (1 شتنبر إلى 30 يوليوز)',
      now
    );
  } else {
    // Update existing 2026/2027 end date to 2027-07-30 as requested
    try {
      db.prepare("UPDATE academic_years SET end_date = '2027-07-30' WHERE name = '2026/2027' AND (end_date = '2027-07-03' OR end_date LIKE '%-07-03')").run();
    } catch {
      // Ignore
    }
  }

  // Update any existing users with 2025/2026 to 2026/2027
  try {
    db.prepare("UPDATE users SET academic_year = '2026/2027' WHERE academic_year = '2025/2026'").run();
  } catch {
    // Ignore
  }

  // Seed / Upsert the App Super-Admin Account (mrsamiro69@gmail.com / admin / Samir@0102.)
  // المشرف العام على التطبيق (يضيف ويزيل المدراء، يضيف ويزيل الأساتذة، يدير النظام)
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ? OR email = ?').get('admin', 'mrsamiro69@gmail.com', 'mrsamir069@gmail.com') as { id: string } | undefined;
  if (!adminUser) {
    db.prepare(`
      INSERT INTO users (id, username, email, password, full_name, role, academic_year, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'usr_admin_samir',
      'admin',
      'mrsamiro69@gmail.com',
      'Samir@0102.',
      'الأستاذ: سمير القراشي (المشرف العام على التطبيق)',
      'admin',
      '2026/2027',
      'active',
      now,
      now
    );
  } else {
    // Update credentials and role to guarantee they match user request exactly
    db.prepare(`
      UPDATE users SET
        username = 'admin',
        email = 'mrsamiro69@gmail.com',
        password = 'Samir@0102.',
        full_name = 'الأستاذ: سمير القراشي (المشرف العام على التطبيق)',
        role = 'admin',
        academic_year = '2026/2027',
        status = 'active',
        updated_at = ?
      WHERE id = ?
    `).run(now, adminUser.id);
  }

  // Seed / ensure director account (السيد المدير: محمد الشريف)
  // مدير المؤسسة (يدير الأقسام، طلبات الأساتذة، الأرشيف اليومي، والمواسم الدراسية)
  // الايميل الافتراضي: directeur.iksan@gmail.com / كلمة المرور الافتراضية: Director@2026
  // يتم تغييرها عند تسجيل الدخول الأول
  if (!dataResetCompleted) {
  const directorUser = db.prepare("SELECT id, full_name, must_change_profile FROM users WHERE username = 'directeur' OR email = 'directeur.iksan@gmail.com' OR role = 'director'").get() as { id: string; full_name?: string; must_change_profile?: number } | undefined;
  if (!directorUser) {
    db.prepare(`
      INSERT INTO users (id, username, email, password, full_name, role, academic_year, status, must_change_profile, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'director', '2026/2027', 'active', 1, 1, ?, ?)
    `).run(
      'usr_director_iksan',
      'directeur',
      'directeur.iksan@gmail.com',
      'Director@2026',
      'السيد المدير: محمد الشريف (مدير المؤسسة)',
      now,
      now
    );
  } else {
    const isOldName = !directorUser.full_name || directorUser.full_name.includes('العمراني') || directorUser.full_name.includes('عبد الله');
    db.prepare(`
      UPDATE users SET
        role = 'director',
        full_name = CASE WHEN ? THEN 'السيد المدير: محمد الشريف (مدير المؤسسة)' ELSE full_name END,
        username = CASE WHEN ? THEN 'directeur' ELSE username END,
        email = CASE WHEN ? THEN 'directeur.iksan@gmail.com' ELSE email END,
        password = CASE WHEN ? THEN 'Director@2026' ELSE password END,
        must_change_profile = CASE WHEN ? THEN 1 ELSE must_change_profile END,
        academic_year = '2026/2027',
        status = 'active',
        email_verified = 1,
        updated_at = ?
      WHERE id = ?
    `).run(isOldName ? 1 : 0, isOldName ? 1 : 0, isOldName ? 1 : 0, isOldName ? 1 : 0, isOldName ? 1 : 0, now, directorUser.id);
  }

  // Seed / ensure teacher account (prof.alami@gmail.com / Teacher@2025)
  const teacherUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get('prof_alami', 'prof.alami@gmail.com') as { id: string } | undefined;
  if (!teacherUser) {
    db.prepare(`
      INSERT INTO users (id, username, email, password, full_name, role, academic_year, status, subject, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'usr_teacher_alami',
      'prof_alami',
      'prof.alami@gmail.com',
      'Teacher@2025',
      'ذ. محمد العلمي',
      'teacher',
      '2025/2026',
      'active',
      'الرياضيات',
      now,
      now
    );
  }

  // Ensure at least one section is assigned to teacher if unassigned
  try {
    const unassignedSection = db.prepare('SELECT id FROM sections WHERE assigned_teacher_id IS NULL LIMIT 1').get() as { id: string } | undefined;
    if (unassignedSection) {
      db.prepare('UPDATE sections SET assigned_teacher_id = ? WHERE id = ?').run('usr_teacher_alami', unassignedSection.id);
    }
  } catch (err) {
    // Ignore if table not yet populated
  }

  // Seed sample approved activities for the institution if empty
  try {
    const actCount = (db.prepare('SELECT COUNT(*) as count FROM school_activities').get() as { count: number }).count;
    if (actCount === 0) {
      const sampleActivities = [
        {
          id: 'act_seed_1',
          title: 'أسبوع العلوم والتجارب الفيزيائية بالمختبر المدرسي',
          description: 'تنظيم ورشات علمية تطبيقية تفاعلية لتلاميذ السنة الثالثة إعدادي حول الظواهر الكهربائية والميكانيكية بإشراف أساتذة العلوم والفيزياء.',
          category: 'أنشطة علمية',
          image_url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
          author_id: 'usr_admin_samir',
          author_name: 'الأستاذ: سمير القراشي (المشرف العام)',
          author_role: 'admin',
          author_subject: 'الإدارة التربوية',
          status: 'approved',
          likes_count: 24,
          created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
          updated_at: new Date(Date.now() - 3 * 86400000).toISOString()
        },
        {
          id: 'act_seed_2',
          title: 'دوري التضامن الرياضي في كرة القدم المصغرة',
          description: 'انطلاق فعاليات دوري كرة القدم المصغرة لتلاميذ المؤسسة بملاعب التربية البدنية، تكريساً لقيم الروح الرياضية والتعاون الجماعي.',
          category: 'أنشطة رياضية',
          image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
          author_id: 'usr_teacher_alami',
          author_name: 'ذ. محمد العلمي',
          author_role: 'teacher',
          author_subject: 'الرياضيات',
          status: 'approved',
          likes_count: 38,
          created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
          updated_at: new Date(Date.now() - 5 * 86400000).toISOString()
        },
        {
          id: 'act_seed_3',
          title: 'ورشة القراءة والإبداع الأدبي بفضاء الخزانة المدرسية',
          description: 'جلسة قراءة مفتوحة وتلخيص مؤلفات قصصية مع مسابقة في التعبير الأدبي وتكريم التلميذات والتلاميذ الأكثر استعارة للكتب.',
          category: 'ورشات تربوية',
          image_url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
          author_id: 'usr_admin_samir',
          author_name: 'الأستاذ: سمير القراشي (المشرف العام)',
          author_role: 'admin',
          author_subject: 'الإدارة التربوية',
          status: 'approved',
          likes_count: 19,
          created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
          updated_at: new Date(Date.now() - 8 * 86400000).toISOString()
        }
      ];

      const insertStmt = db.prepare(`
        INSERT INTO school_activities (
          id, title, description, category, image_url,
          author_id, author_name, author_role, author_subject,
          status, likes_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const act of sampleActivities) {
        insertStmt.run(
          act.id, act.title, act.description, act.category, act.image_url,
          act.author_id, act.author_name, act.author_role, act.author_subject,
          act.status, act.likes_count, act.created_at, act.updated_at
        );
      }
    }
  } catch (err) {
    console.error('Failed to seed school activities:', err);
  }
  }
}

function seedInitialData() {
  const now = new Date().toISOString();
  const insertSetting = db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)');
  insertSetting.run('institution', 'الثانوية الإعدادية ايكسان', now);
  insertSetting.run('year', '2025/2026', now);
  insertSetting.run('teacher', 'أستاذ المادة', now);

  // Insert a sample first section
  const sectionId = 's' + Date.now().toString(36);
  db.prepare(`
    INSERT INTO sections (id, level, class_number, teacher, created_at, updated_at, roster_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sectionId, 'المستوى الأول', '1', 'أستاذ المادة', Date.now(), now, '[]');

  // Insert 40 seats for this section
  const insertSeat = db.prepare(`
    INSERT INTO seats (section_id, seat_num, student_name, student_number, roster_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 1; i <= 100; i++) {
    insertSeat.run(sectionId, i, '', '', null, now);
  }

  // Prepopulate couple of sample students in desk 1
  db.prepare('UPDATE seats SET student_name = ?, student_number = ? WHERE section_id = ? AND seat_num = ?')
    .run('أحمد محمد الزهراني', '101', sectionId, 1);
  db.prepare('UPDATE seats SET student_name = ?, student_number = ? WHERE section_id = ? AND seat_num = ?')
    .run('فاطمة علي القحطاني', '102', sectionId, 2);

  // Add a sample note
  db.prepare(`
    INSERT INTO notes (id, section_id, seat_num, note_text, note_date, note_time, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'n_sample_1',
    sectionId,
    1,
    'تلميذ متميز ومشارك بانتظام في الأنشطة الصفية',
    new Date().toLocaleDateString('ar-SA'),
    '08:30',
    now
  );

  // Record in change history
  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'init',
    'تهيئة قاعدة بيانات خرائط الأقسام بالإعدادات وقسم تجريبي أولي',
    JSON.stringify({ initialized: true }),
    now
  );
}

// ---------------- Settings Functions ----------------

export function getAppSettings(): AppSettings {
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = { institution: '', year: '', teacher: '' };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return {
    institution: map.institution || '',
    year: map.year || '',
    teacher: map.teacher || ''
  };
}

export function saveAppSettings(settings: Partial<AppSettings>): AppSettings {
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  if (settings.institution !== undefined) upsert.run('institution', settings.institution, now);
  if (settings.year !== undefined && settings.year.trim()) {
    const cleanYear = settings.year.trim();
    upsert.run('year', cleanYear, now);
    // Apply academic year to ALL teachers and accounts in database
    db.prepare(`UPDATE users SET academic_year = ?, updated_at = ?`).run(cleanYear, now);
  }
  if (settings.teacher !== undefined) upsert.run('teacher', settings.teacher, now);

  // Record history
  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'update_settings',
    `تحديث إعدادات المؤسسة: ${settings.institution || ''} (الموسم: ${settings.year || ''}) وتطبيقه على كافة الأساتذة`,
    JSON.stringify(settings),
    now
  );

  return getAppSettings();
}

// ---------------- Sections Functions ----------------

export function getAllSections(teacherFilterId?: string, viewerId?: string, viewerRole?: string): SectionItem[] {
  let query = `
    SELECT s.*, u.full_name as assigned_teacher_name
    FROM sections s
    LEFT JOIN users u ON s.assigned_teacher_id = u.id
  `;
  const params: any[] = [];
  if (teacherFilterId) {
    query += ' WHERE s.assigned_teacher_id = ? ';
    params.push(teacherFilterId);
  }
  query += ' ORDER BY s.created_at ASC';

  const sectionRows = db.prepare(query).all(...params) as any[];
  const result: SectionItem[] = [];

  for (const sec of sectionRows) {
    // Get seats
    const seatRows = db.prepare('SELECT * FROM seats WHERE section_id = ? ORDER BY seat_num ASC').all(sec.id) as any[];
    let sectionRoster: RosterItem[] = [];
    try {
      sectionRoster = JSON.parse(sec.roster_json || '[]');
    } catch {
      sectionRoster = [];
    }

    // Materialize a complete private layout before reading it. This prevents a
    // teacher who has not edited the section yet from inheriting another
    // teacher's shared seat arrangement.
    if (viewerRole === 'teacher' && viewerId) {
      const existingOverrides = db.prepare(
        'SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ?'
      ).all(viewerId, sec.id) as any[];
      const baseBySeat = new Map(seatRows.map((seat) => [seat.seat_num, seat]));
      const overrideBySeat = new Map(existingOverrides.map((seat) => [seat.seat_num, seat]));
      const canonicalDiffersFromShared = sectionRoster.length > 0 && sectionRoster.some((student, index) => {
        const shared = baseBySeat.get(index + 1);
        return (shared?.roster_id || '') !== (student.id || '') ||
          (shared?.student_number || '') !== (student.number || '');
      });
      const overrideMirrorsShared = existingOverrides.length >= 100 && Array.from({ length: 100 }, (_, index) => {
        const shared = baseBySeat.get(index + 1);
        const override = overrideBySeat.get(index + 1);
        return Boolean(override) &&
          (override.student_name || '') === (shared?.student_name || '') &&
          (override.student_number || '') === (shared?.student_number || '') &&
          (override.roster_id || '') === (shared?.roster_id || '');
      }).every(Boolean);

      // Older versions copied the shared layout into a teacher override. If it
      // still mirrors that layout while the roster has a different order, it
      // is stale and must be rebuilt from the canonical roster.
      if (overrideMirrorsShared && canonicalDiffersFromShared) {
        db.prepare('DELETE FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ?').run(viewerId, sec.id);
      }

      const ensureOverride = db.prepare(`
        INSERT OR IGNORE INTO teacher_seat_overrides
          (teacher_id, section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      db.exec('BEGIN TRANSACTION;');
      try {
        for (let seatNum = 1; seatNum <= 100; seatNum++) {
          const rosterItem = sectionRoster[seatNum - 1];
          const base = seatRows.find((seat) => seat.seat_num === seatNum);
          ensureOverride.run(
            viewerId,
            sec.id,
            seatNum,
            rosterItem?.name || base?.student_name || '',
            rosterItem?.number || base?.student_number || '',
            rosterItem?.massarNumber || base?.massar_number || '',
            rosterItem?.id || base?.roster_id || null,
            base?.status_color || 'default',
            now
          );
        }
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    }
    const teacherOverrides = viewerRole === 'teacher' && viewerId
      ? db.prepare('SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ?').all(viewerId, sec.id) as any[]
      : [];
    const overridesBySeat = new Map(teacherOverrides.map((override) => [override.seat_num, override]));
    
    // Get notes for section
    const noteRows = viewerRole === 'teacher' && viewerId
      ? db.prepare(`
          SELECT n.* FROM notes n
          WHERE n.section_id = ? AND n.teacher_id = ?
          ORDER BY n.created_at DESC
        `).all(sec.id, viewerId) as any[]
      : db.prepare('SELECT * FROM notes WHERE section_id = ? ORDER BY created_at DESC').all(sec.id) as any[];
    const notesBySeat: Record<number, NoteItem[]> = {};
    for (const n of noteRows) {
      if (!notesBySeat[n.seat_num]) notesBySeat[n.seat_num] = [];
      notesBySeat[n.seat_num].push({
        id: n.id,
        text: n.note_text,
        date: n.note_date,
        time: n.note_time
      });
    }

    // Get violations for section with teacher and date/time info
    const violRows = db.prepare(`
      SELECT id, section_id, seat_num, student_name, student_number, massar_number,
             violation_type, description, action_taken, teacher_name, teacher_subject, teacher_id,
             recorded_date, recorded_time, created_at
      FROM daily_violations
      WHERE section_id = ? ${viewerRole === 'teacher' && viewerId ? 'AND teacher_id = ?' : ''}
      ORDER BY created_at DESC
    `).all(...(viewerRole === 'teacher' && viewerId ? [sec.id, viewerId] : [sec.id])) as any[];

    const violationsBySeat: Record<number, any[]> = {};
    for (const v of violRows) {
      if (!violationsBySeat[v.seat_num]) violationsBySeat[v.seat_num] = [];
      violationsBySeat[v.seat_num].push({
        id: v.id,
        sectionId: v.section_id,
        seatNum: v.seat_num,
        studentName: v.student_name,
        studentNumber: v.student_number,
        massarNumber: v.massar_number,
        violationType: v.violation_type,
        actionTaken: v.action_taken,
        teacherName: v.teacher_name,
        teacherSubject: v.teacher_subject,
        recordedDate: v.recorded_date,
        recordedTime: v.recorded_time,
        createdAt: v.created_at
      });
    }

    const seats: SeatItem[] = [];
    const maxSeatNum = Math.max(100, seatRows.length > 0 ? Math.max(...seatRows.map((s: any) => s.seat_num)) : 100);
    for (let i = 1; i <= maxSeatNum; i++) {
      const found = seatRows.find((s) => s.seat_num === i);
      const override = overridesBySeat.get(i);
      const seatViols = violationsBySeat[i] || [];
      seats.push({
        seat: i,
        name: override?.student_name ?? found?.student_name ?? '',
        number: override?.student_number ?? found?.student_number ?? '',
        massarNumber: override?.massar_number ?? found?.massar_number ?? '',
        rosterId: override?.roster_id ?? found?.roster_id ?? null,
        statusColor: (override?.status_color ?? found?.status_color ?? 'default') as any,
        attendance: (found?.attendance as any) || null,
        violations: seatViols,
        notes: notesBySeat[i] || []
      });
    }

    const roster = sectionRoster;

    // Get all approved assigned teachers for this section across all subjects
    const assignedTeachersRows = db.prepare(`
      SELECT sa.teacher_id, sa.subject, u.full_name as teacher_name, u.academic_year
      FROM section_assignments sa
      JOIN users u ON sa.teacher_id = u.id
      WHERE sa.section_id = ? AND sa.status = 'approved'
      ORDER BY sa.reviewed_at ASC
    `).all(sec.id) as any[];

    const assignedTeachers = assignedTeachersRows.map((r) => ({
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      subject: r.subject || 'عام',
      academicYear: r.academic_year
    }));

    // Check if the filtered teacher or any teacher is approved
    const isApprovedForTeacher = teacherFilterId
      ? (sec.assigned_teacher_id === teacherFilterId || assignedTeachers.some(t => t.teacherId === teacherFilterId))
      : (sec.assigned_teacher_id !== null || assignedTeachers.length > 0);

    result.push({
      id: sec.id,
      level: sec.level,
      classNumber: sec.class_number,
      teacher: sec.teacher || sec.assigned_teacher_name || (assignedTeachers[0]?.teacherName) || '',
      createdAt: sec.created_at,
      seats,
      roster,
      assignedTeacherId: sec.assigned_teacher_id || (assignedTeachers[0]?.teacherId || null),
      assignedTeacherName: sec.assigned_teacher_name || (assignedTeachers[0]?.teacherName || null),
      assignmentStatus: isApprovedForTeacher ? 'approved' : 'none',
      assignedTeachers
    });
  }

  return result;
}

export function createSection(data: { level: string; classNumber: string; teacher?: string }): SectionItem {
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = new Date().toISOString();
  const createdAt = Date.now();

  db.prepare(`
    INSERT INTO sections (id, level, class_number, teacher, created_at, updated_at, roster_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.level, data.classNumber, data.teacher || '', createdAt, now, '[]');

  // Insert 100 seats
  const insertSeat = db.prepare(`
    INSERT INTO seats (section_id, seat_num, student_name, student_number, roster_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const emptySeats: SeatItem[] = [];
  for (let i = 1; i <= 100; i++) {
    insertSeat.run(id, i, '', '', null, now);
    emptySeats.push({ seat: i, name: '', number: '', notes: [], rosterId: null });
  }

  // Record change
  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'add_section',
    `إضافة قسم جديد: ${data.level} - القسم ${data.classNumber}`,
    JSON.stringify({ id, level: data.level, classNumber: data.classNumber }),
    now
  );

  return {
    id,
    level: data.level,
    classNumber: data.classNumber,
    teacher: data.teacher || '',
    createdAt,
    seats: emptySeats,
    roster: []
  };
}

export function updateSectionMeta(id: string, data: { level: string; classNumber: string; teacher?: string }) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sections
    SET level = ?, class_number = ?, teacher = ?, updated_at = ?
    WHERE id = ?
  `).run(data.level, data.classNumber, data.teacher || '', now, id);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'update_section',
    `تعديل بيانات القسم: ${data.level} - القسم ${data.classNumber}`,
    JSON.stringify({ id, ...data }),
    now
  );
}

export function deleteSection(id: string) {
  const sec = db.prepare('SELECT level, class_number FROM sections WHERE id = ?').get(id) as any;
  const title = sec ? `${sec.level} - القسم ${sec.class_number}` : id;

  db.prepare('DELETE FROM section_assignments WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM notes WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM seats WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM sections WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'delete_section',
    `حذف القسم: ${title}`,
    JSON.stringify({ id }),
    new Date().toISOString()
  );
}

export function deleteAllSections() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM sections').get() as any;
  const count = countRow ? countRow.count : 0;

  db.prepare('DELETE FROM section_assignments').run();
  db.prepare('DELETE FROM notes').run();
  db.prepare('DELETE FROM seats').run();
  db.prepare('DELETE FROM sections').run();

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'delete_all_sections',
    `حذف جميع الأقسام (${count} قسم) من طرف إدارة المؤسسة`,
    JSON.stringify({ count }),
    new Date().toISOString()
  );

  return { count };
}

function clearSeatAbsenceHistory(sectionId: string, seatNum: number) {
  try {
    db.prepare(`DELETE FROM attendance_history WHERE section_id = ? AND seat_num = ?`).run(sectionId, seatNum);
  } catch {
    // Non-critical cleanup
  }
}

export function updateSeat(
  sectionId: string,
  seatNum: number,
  data: {
    name?: string;
    number?: string;
    massarNumber?: string;
    rosterId?: string | null;
    statusColor?: string;
    attendance?: string | null;
    actorId?: string;
    actorRole?: string;
  }
) {
  const now = new Date().toISOString();
  const current = db.prepare('SELECT * FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, seatNum) as any;

  const name = data.name !== undefined ? data.name : (current?.student_name || '');
  const number = data.number !== undefined ? data.number : (current?.student_number || '');
  const massarNumber = data.massarNumber !== undefined ? data.massarNumber : (current?.massar_number || '');
  const rosterId = data.rosterId !== undefined ? data.rosterId : (current?.roster_id || null);
  const statusColor = data.statusColor !== undefined ? data.statusColor : (current?.status_color || 'default');
  const attendance = data.attendance !== undefined ? data.attendance : (current?.attendance || null);
  const actorId = data.actorId || '';
  const actorRole = data.actorRole || 'teacher';

  if (actorRole === 'teacher' && actorId && data.attendance === undefined) {
    const base = db.prepare('SELECT * FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, seatNum) as any;
    db.prepare(`
      INSERT OR IGNORE INTO teacher_seat_overrides
        (teacher_id, section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actorId,
      sectionId,
      seatNum,
      base?.student_name || '',
      base?.student_number || '',
      base?.massar_number || '',
      base?.roster_id || null,
      base?.status_color || 'default',
      now
    );

    const fieldUpdates: Array<[string, any]> = [
      ['student_name', data.name],
      ['student_number', data.number],
      ['massar_number', data.massarNumber],
      ['roster_id', data.rosterId],
      ['status_color', data.statusColor]
    ];
    const update = fieldUpdates.find(([, value]) => value !== undefined);
    if (update) {
      db.prepare(`UPDATE teacher_seat_overrides SET ${update[0]} = ?, updated_at = ? WHERE teacher_id = ? AND section_id = ? AND seat_num = ?`)
        .run(update[1], now, actorId, sectionId, seatNum);
    }

    try {
      const savedOverride = db.prepare('SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ? AND seat_num = ?').get(actorId, sectionId, seatNum) as any;
      if (savedOverride) {
        cloudSaveTeacherSeatOverride(savedOverride);
      }
    } catch (err) {
      console.warn('Firestore cloudSaveTeacherSeatOverride error:', err);
    }

    return { success: true };
  }

  // If the seat is being emptied or the card is fully cleared, remove stale absence history.
  if ((!name || !name.trim()) && (attendance === null || attendance === undefined || attendance === 'present')) {
    clearSeatAbsenceHistory(sectionId, seatNum);
  }

  db.prepare(`
    INSERT INTO seats (section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, attendance, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(section_id, seat_num) DO UPDATE SET
      student_name = excluded.student_name,
      student_number = excluded.student_number,
      massar_number = excluded.massar_number,
      roster_id = excluded.roster_id,
      status_color = excluded.status_color,
      attendance = excluded.attendance,
      updated_at = excluded.updated_at
  `).run(sectionId, seatNum, name, number, massarNumber, rosterId, statusColor, attendance, now);

  // If marked absent or late, log into attendance history
  if ((attendance === 'absent' || attendance === 'late') && name.trim()) {
    try {
      const today = now.slice(0, 10);
      const secInfo = db.prepare(`
        SELECT u.full_name as teacher_name, u.subject as teacher_subject
        FROM sections sec
        LEFT JOIN users u ON sec.assigned_teacher_id = u.id
        WHERE sec.id = ?
      `).get(sectionId) as any;

      const existing = db.prepare(
        `SELECT * FROM attendance_history WHERE section_id = ? AND seat_num = ? AND recorded_date = ? ORDER BY created_at DESC LIMIT 1`
      ).get(sectionId, seatNum, today) as any;

      if (!existing) {
        db.prepare(`
          INSERT INTO attendance_history (
            section_id, seat_num, student_name, student_number,
            status, recorded_date, session_period, teacher_name, teacher_subject,
            justified, created_at, created_by, removed_by, removed_at, count_in_stats
          ) VALUES (?, ?, ?, ?, ?, ?, 'كامل اليوم', ?, ?, 'unjustified', ?, ?, '', '', 1)
        `).run(
          sectionId,
          seatNum,
          name.trim(),
          number.trim(),
          attendance,
          today,
          secInfo?.teacher_name || '',
          secInfo?.teacher_subject || '',
          now,
          actorId || ''
        );
      } else {
        db.prepare(`
          UPDATE attendance_history SET
            status = ?,
            student_name = ?,
            student_number = ?,
            created_by = COALESCE(NULLIF(?, ''), created_by),
            removed_by = '',
            removed_at = '',
            count_in_stats = 1
          WHERE id = ?
        `).run(attendance, name.trim(), number.trim(), actorId || '', existing.id);
      }
    } catch {
      // Non-critical logging
    }
  } else if ((attendance === 'present' || attendance === null) && name.trim()) {
    // Teacher/Admin removal: if same teacher clears an absence within 4 hours, it is excluded from absence counters.
    try {
      const today = now.slice(0, 10);
      const absenceRow = db.prepare(`
        SELECT * FROM attendance_history
        WHERE section_id = ? AND seat_num = ? AND recorded_date = ? AND status = 'absent'
        ORDER BY created_at DESC LIMIT 1
      `).get(sectionId, seatNum, today) as any;

      if (absenceRow) {
        const sameTeacher = actorId && absenceRow.created_by && actorId === absenceRow.created_by;
        const withinFourHours = !!absenceRow.created_at && (Date.parse(now) - Date.parse(absenceRow.created_at)) <= 4 * 60 * 60 * 1000;
        const shouldIgnoreFromStats = sameTeacher && withinFourHours;

        db.prepare(`
          UPDATE attendance_history SET
            removed_by = ?,
            removed_at = ?,
            count_in_stats = ?
          WHERE id = ?
        `).run(actorId || '', now, shouldIgnoreFromStats ? 0 : 1, absenceRow.id);
      }
    } catch {
      // Non-critical
    }
  }

  return { success: true };
}

export function addSeatNote(sectionId: string, seatNum: number, note: { id?: string; text: string; date: string; time: string; violationType?: string; actionTaken?: string; teacherId?: string }) {
  const id = note.id || 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notes (id, section_id, seat_num, note_text, note_date, note_time, created_at, teacher_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sectionId, seatNum, note.text, note.date, note.time, now, note.teacherId || '');

  // Notes are strictly pedagogical notes, separate from disciplinary violations.
  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'add_note',
    `إضافة ملاحظة للتلميذ في المقعد #${seatNum}`,
    JSON.stringify({ sectionId, seatNum, noteId: id }),
    now
  );

  try {
    cloudSaveNote({
      id,
      sectionId,
      seatNum,
      noteText: note.text,
      noteDate: note.date,
      noteTime: note.time,
      createdAt: now,
      teacherId: note.teacherId || ''
    });
  } catch (err) {
    console.warn('Firestore cloudSaveNote error:', err);
  }

  return { id, text: note.text, date: note.date, time: note.time };
}

export function deleteSeatNote(sectionId: string, seatNum: number, noteId: string) {
  db.prepare('DELETE FROM notes WHERE id = ? AND section_id = ? AND seat_num = ?').run(noteId, sectionId, seatNum);

  try {
    cloudDeleteNote(noteId);
  } catch (err) {
    console.warn('Firestore cloudDeleteNote error:', err);
  }

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'delete_note',
    `حذف ملاحظة من المقعد #${seatNum}`,
    JSON.stringify({ sectionId, seatNum, noteId }),
    new Date().toISOString()
  );

  return { success: true };
}

// ---------------- Violation Types & Student Violations ----------------

export function getViolationTypes() {
  return db.prepare('SELECT * FROM violation_types ORDER BY order_index ASC, created_at ASC').all();
}

export function addViolationType(data: { title: string; severity?: string }) {
  const cleanTitle = (data.title || '').trim();
  if (!cleanTitle) throw new Error('عنوان المخالفة مطلوب');

  const existing = db.prepare('SELECT id FROM violation_types WHERE title = ?').get(cleanTitle) as any;
  if (existing) {
    throw new Error('هذه المخالفة موجودة مسبقاً في القائمة');
  }

  const id = 'vt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const maxOrder = ((db.prepare('SELECT MAX(order_index) as maxOrder FROM violation_types').get() as any)?.maxOrder ?? 0);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO violation_types (id, title, severity, order_index, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, cleanTitle, data.severity || 'normal', maxOrder + 1, now);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'add_violation_type',
    `إضافة مخالفة معتمدة جديدة للنظام: "${cleanTitle}" من طرف الإدارة`,
    JSON.stringify({ id, title: cleanTitle, severity: data.severity }),
    now
  );

  return { id, title: cleanTitle, severity: data.severity || 'normal', order_index: maxOrder + 1, created_at: now };
}

export function updateViolationType(id: string, data: { title: string; severity?: string }) {
  const cleanTitle = (data.title || '').trim();
  if (!cleanTitle) throw new Error('عنوان المخالفة مطلوب');

  const existing = db.prepare('SELECT id FROM violation_types WHERE title = ? AND id != ?').get(cleanTitle, id) as any;
  if (existing) {
    throw new Error('هذه المخالفة موجودة مسبقاً في القائمة');
  }

  db.prepare('UPDATE violation_types SET title = ?, severity = COALESCE(?, severity) WHERE id = ?')
    .run(cleanTitle, data.severity || null, id);

  return db.prepare('SELECT * FROM violation_types WHERE id = ?').get(id);
}

export function deleteViolationType(id: string) {
  const item = db.prepare('SELECT title FROM violation_types WHERE id = ?').get(id) as any;
  db.prepare('DELETE FROM violation_types WHERE id = ?').run(id);

  if (item) {
    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'delete_violation_type',
      `حذف المخالفة المعتمدة: "${item.title}" من القائمة من طرف الإدارة`,
      JSON.stringify({ id, title: item.title }),
      new Date().toISOString()
    );
  }

  return { success: true };
}

export function resetViolationTypes() {
  db.prepare('DELETE FROM violation_types').run();
  const defaultTypes = [
    'عدم إحضار الأدوات المدرسية',
    'عدم إنجاز الواجبات المنزلية',
    'التشويش داخل القسم',
    'عدم احترام الأستاذ',
    'عدم احترام زملاء القسم',
    'استعمال الهاتف أثناء الحصة',
    'مغادرة القسم دون إذن',
    'عدم الانضباط',
    'إتلاف ممتلكات المؤسسة',
    'مخالفة النظام الداخلي'
  ];
  const insertVt = db.prepare('INSERT INTO violation_types (id, title, severity, order_index, created_at) VALUES (?, ?, ?, ?, ?)');
  const now = new Date().toISOString();
  defaultTypes.forEach((title, idx) => {
    insertVt.run(`vt_${idx + 1}`, title, 'normal', idx + 1, now);
  });

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'reset_violation_types',
    'استعادة قائمة المخالفات الافتراضية المعتمدة (10 مخالفات)',
    JSON.stringify({ count: defaultTypes.length }),
    now
  );

  return getViolationTypes();
}

export function formatDateTimeFrench(d: Date = new Date()) {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  return {
    date: `${day}/${month}/${year}`,
    time: `${hour}:${minute}`,
    isoDate: `${year}-${month}-${day}`
  };
}

export function addStudentViolation(
  sectionId: string,
  seatNum: number,
  data: {
    violationType: string;
    actionTaken?: string;
    teacherName?: string;
    teacherSubject?: string;
    date?: string;
    time?: string;
    teacherId?: string;
  }
) {
  const cleanType = (data.violationType || '').trim();
  if (!cleanType) throw new Error('يرجى اختيار نوع المخالفة من القائمة المحددة');

  const dt = formatDateTimeFrench();
  const rawDate = data.date && data.date.trim() ? data.date.trim() : dt.isoDate;
  let recordedDate = rawDate;
  if (rawDate.includes('/')) {
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      recordedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  const recordedTime = data.time && data.time.trim() ? data.time.trim() : dt.time;
  const id = 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  const seat = db.prepare('SELECT student_name, student_number, massar_number FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, seatNum) as any;
  const secInfo = db.prepare(`
    SELECT sec.level, sec.class_number, u.full_name as teacher_name, u.subject as teacher_subject
    FROM sections sec
    LEFT JOIN users u ON sec.assigned_teacher_id = u.id
    WHERE sec.id = ?
  `).get(sectionId) as any;

  const teacherName = (data.teacherName && data.teacherName.trim()) 
    ? data.teacherName.trim() 
    : (secInfo?.teacher_name || 'أستاذ المادة');
  const teacherSubject = (data.teacherSubject && data.teacherSubject.trim()) 
    ? data.teacherSubject.trim() 
    : (secInfo?.teacher_subject || 'المادة');

  const studentName = seat?.student_name || `المقعد #${seatNum}`;
  const studentNumber = seat?.student_number || '';
  const massarNumber = seat?.massar_number || '';
  const actionTaken = data.actionTaken || 'تنبيه شفهي';

  db.prepare(`
    INSERT INTO daily_violations (
      id, section_id, seat_num, student_name, student_number, massar_number,
      violation_type, description, action_taken, teacher_name, teacher_subject,
      recorded_date, recorded_time, created_at, teacher_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, sectionId, seatNum, studentName, studentNumber, massarNumber,
    cleanType, cleanType, actionTaken, teacherName, teacherSubject,
    recordedDate, recordedTime, now, data.teacherId || ''
  );

  // Sync to legacy notes table
  try {
    db.prepare(`
      INSERT INTO notes (id, section_id, seat_num, note_text, note_date, note_time, created_at, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sectionId, seatNum, cleanType, recordedDate, recordedTime, now, data.teacherId || '');
  } catch {}

  // Sync to Firestore Cloud
  try {
    cloudSaveViolation({
      id,
      sectionId,
      seatNum,
      studentName,
      studentNumber,
      massarNumber,
      violationType: cleanType,
      description: cleanType,
      actionTaken,
      teacherName,
      teacherSubject,
      date: recordedDate,
      time: recordedTime,
      academicYear: '2025/2026',
      notes: cleanType,
      teacherId: data.teacherId || ''
    });
  } catch (err) {
    console.warn('Firestore cloudSaveViolation failed:', err);
  }

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'add_violation',
    `تسجيل مخالفة [${cleanType}] للتلميذ ${studentName} في المقعد #${seatNum} (المادة: ${teacherSubject} - الأستاذ: ${teacherName})`,
    JSON.stringify({ sectionId, seatNum, studentName, violationType: cleanType, actionTaken, recordedDate, recordedTime }),
    now
  );

  return {
    id,
    sectionId,
    seatNum,
    studentName,
    studentNumber,
    massarNumber,
    violationType: cleanType,
    description: cleanType,
    actionTaken,
    teacherName,
    teacherSubject,
    recordedDate,
    recordedTime,
    createdAt: now
  };
}

export function deleteStudentViolation(sectionId: string, seatNum: number, violationId: string) {
  db.prepare('DELETE FROM daily_violations WHERE id = ? AND section_id = ? AND seat_num = ?').run(violationId, sectionId, seatNum);
  try {
    db.prepare('DELETE FROM notes WHERE id = ?').run(violationId);
  } catch {}

  try {
    cloudDeleteViolation(violationId);
  } catch (err) {
    console.warn('Firestore cloudDeleteViolation failed:', err);
  }

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'delete_violation',
    `حذف مخالفة من المقعد #${seatNum}`,
    JSON.stringify({ sectionId, seatNum, violationId }),
    new Date().toISOString()
  );

  return { success: true };
}

export function saveSectionRoster(sectionId: string, roster: RosterItem[]) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sections
    SET roster_json = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(roster), now, sectionId);

  // Clear existing rosterId assignments
  db.prepare('UPDATE seats SET roster_id = NULL WHERE section_id = ?').run(sectionId);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'import_roster',
    `استيراد لائحة بـ ${roster.length} تلميذاً في القسم`,
    JSON.stringify({ sectionId, count: roster.length }),
    now
  );

  return { success: true, count: roster.length };
}

export function addStudentToSection(
  sectionId: string,
  student: { name: string; number?: string; massarNumber?: string; customSeatNum?: number }
) {
  const now = new Date().toISOString();
  const sec = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
  if (!sec) {
    throw new Error('القسم غير موجود');
  }

  let roster: RosterItem[] = [];
  try {
    roster = JSON.parse(sec.roster_json || '[]');
  } catch {
    roster = [];
  }

  // Calculate next sequential student number if not explicitly specified
  let nextNum = 1;
  if (roster.length > 0) {
    const existingNums = roster
      .map((r) => parseInt(r.number, 10))
      .filter((n) => !isNaN(n));
    if (existingNums.length > 0) {
      nextNum = Math.max(...existingNums) + 1;
    } else {
      nextNum = roster.length + 1;
    }
  }

  const assignedNumber = student.number && student.number.trim() ? student.number.trim() : String(nextNum);
  const massarNumber = student.massarNumber && student.massarNumber.trim() ? student.massarNumber.trim() : '';
  const studentName = student.name.trim();

  if (!studentName) {
    throw new Error('اسم التلميذ مطلوب');
  }

  const newRosterItem: RosterItem = {
    id: 'r_' + sectionId + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: studentName,
    number: assignedNumber,
    massarNumber
  };

  // Append student to the END of roster (في آخر ترتيب القسم)
  roster.push(newRosterItem);

  // Update section roster
  db.prepare('UPDATE sections SET roster_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(roster), now, sectionId);

  // Find an empty seat or determine seat number
  let targetSeatNum = student.customSeatNum;
  if (!targetSeatNum) {
    // Find first empty seat from 1 to 40
    const occupiedSeats = db.prepare(`
      SELECT seat_num FROM seats
      WHERE section_id = ? AND student_name IS NOT NULL AND TRIM(student_name) != ''
    `).all(sectionId) as any[];

    const occupiedSet = new Set(occupiedSeats.map((s) => s.seat_num));
    for (let s = 1; s <= 40; s++) {
      if (!occupiedSet.has(s)) {
        targetSeatNum = s;
        break;
      }
    }
    if (!targetSeatNum) {
      targetSeatNum = 41; // overflow seat
    }
  }

  // Assign to seat
  db.prepare(`
    INSERT INTO seats (section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, attendance, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'default', NULL, ?)
    ON CONFLICT(section_id, seat_num) DO UPDATE SET
      student_name = excluded.student_name,
      student_number = excluded.student_number,
      massar_number = excluded.massar_number,
      roster_id = excluded.roster_id,
      status_color = 'default',
      attendance = NULL,
      updated_at = excluded.updated_at
  `).run(sectionId, targetSeatNum, studentName, assignedNumber, massarNumber, newRosterItem.id, now);

  // Audit log
  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'add_student',
    `إضافة التلميذ "${studentName}" (رقم: ${assignedNumber}) في آخر ترتيب القسم (المقعد #${targetSeatNum}) من طرف الإدارة`,
    JSON.stringify({ sectionId, studentName, number: assignedNumber, seatNum: targetSeatNum }),
    now
  );

  return {
    success: true,
    student: newRosterItem,
    seatNum: targetSeatNum,
    totalStudents: roster.length
  };
}

export function removeStudentFromSection(
  sectionId: string,
  seatNum: number,
  reason: 'انتقال' | 'انقطاع' | string = 'انتقال'
) {
  const now = new Date().toISOString();
  const sec = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
  if (!sec) {
    throw new Error('القسم غير موجود');
  }

  const seat = db.prepare('SELECT * FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, seatNum) as any;
  const removedName = seat?.student_name || '';
  const removedNumber = seat?.student_number || '';
  const rosterId = seat?.roster_id;

  // 1. Vacate the seat and clear any stale absence history linked to this seat.
  clearSeatAbsenceHistory(sectionId, seatNum);
  db.prepare(`
    UPDATE seats SET
      student_name = '',
      student_number = '',
      roster_id = NULL,
      attendance = NULL,
      status_color = 'default',
      updated_at = ?
    WHERE section_id = ? AND seat_num = ?
  `).run(now, sectionId, seatNum);

  // 2. Remove from roster_json if present
  let roster: RosterItem[] = [];
  try {
    roster = JSON.parse(sec.roster_json || '[]');
  } catch {
    roster = [];
  }

  const initialCount = roster.length;
  roster = roster.filter((r) => {
    if (rosterId && r.id === rosterId) return false;
    if (removedName && r.name.trim() === removedName.trim()) return false;
    return true;
  });

  if (roster.length !== initialCount) {
    db.prepare('UPDATE sections SET roster_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(roster), now, sectionId);
  }

  // 3. Record in audit history
  const reasonText = reason === 'انقطاع' ? 'انقطاع عن الدراسة' : 'انتقال إلى مؤسسة أخرى';
  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'remove_student',
    `إزالة التلميذ "${removedName || `#${seatNum}`}" من القسم بسبب: ${reasonText}`,
    JSON.stringify({ sectionId, seatNum, studentName: removedName, number: removedNumber, reason: reasonText }),
    now
  );

  return {
    success: true,
    removedStudentName: removedName,
    seatNum,
    reason: reasonText,
    remainingRosterCount: roster.length
  };
}

export function getChangeLogs(limit: number = 50) {
  return db.prepare('SELECT * FROM change_history ORDER BY id DESC LIMIT ?').all(limit);
}

export function getDatabaseStats() {
  let fileSizeKb = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      fileSizeKb = Math.round(fs.statSync(DB_PATH).size / 1024);
    }
  } catch {
    fileSizeKb = 0;
  }

  const sectionsCount = (db.prepare('SELECT COUNT(*) as count FROM sections').get() as any).count;
  const seatsCount = (db.prepare("SELECT COUNT(*) as count FROM seats WHERE student_name != ''").get() as any).count;
  const notesCount = (db.prepare('SELECT COUNT(*) as count FROM notes').get() as any).count;
  const historyCount = (db.prepare('SELECT COUNT(*) as count FROM change_history').get() as any).count;
  const teachersCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'").get() as any).count;
  const pendingRequestsCount = (db.prepare("SELECT COUNT(*) as count FROM section_assignments WHERE status = 'pending'").get() as any).count;

  return {
    engine: 'SQLite (Node.js 22 DatabaseSync)',
    dbPath: 'data/classroom_database.sqlite',
    fileSizeKb,
    sectionsCount,
    assignedSeatsCount: seatsCount,
    notesCount,
    historyCount,
    teachersCount,
    pendingRequestsCount,
    status: 'connected'
  };
}

export function exportFullBackup() {
  const settings = getAppSettings();
  const sections = getAllSections();
  const history = getChangeLogs(200);
  const schoolActivities = db.prepare('SELECT * FROM school_activities ORDER BY created_at DESC').all();

  return {
    version: '2.1.0',
    app: 'خرائط الأقسام',
    exportedAt: new Date().toISOString(),
    settings,
    sections,
    history,
    schoolActivities
  };
}

export function importFullBackup(backupData: any) {
  if (!backupData || !backupData.settings || !Array.isArray(backupData.sections)) {
    throw new Error('صيغة ملف النسخة الاحتياطية غير صالحة');
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Settings
    saveAppSettings(backupData.settings);

    // 2. Sections
    db.prepare('DELETE FROM notes').run();
    db.prepare('DELETE FROM seats').run();
    db.prepare('DELETE FROM sections').run();

    const insertSec = db.prepare(`
      INSERT INTO sections (id, level, class_number, teacher, created_at, updated_at, roster_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSeat = db.prepare(`
      INSERT INTO seats (section_id, seat_num, student_name, student_number, massar_number, roster_id, attendance, status_color, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNote = db.prepare(`
      INSERT INTO notes (id, section_id, seat_num, note_text, note_date, note_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertActivity = db.prepare(`
      INSERT INTO school_activities (
        id, title, description, category, activity_date, activity_time, image_url,
        author_id, author_name, author_role, author_subject, status, likes_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    for (const sec of backupData.sections) {
      insertSec.run(
        sec.id,
        sec.level,
        sec.classNumber,
        sec.teacher || '',
        sec.createdAt || Date.now(),
        now,
        JSON.stringify(sec.roster || [])
      );

      if (Array.isArray(sec.seats)) {
        for (const st of sec.seats) {
          insertSeat.run(
            sec.id,
            st.seat,
            st.name || '',
            st.number || '',
            st.massarNumber || '',
            st.rosterId || null,
            st.attendance || null,
            st.statusColor || 'default',
            now
          );

          if (Array.isArray(st.notes)) {
            for (const n of st.notes) {
              insertNote.run(n.id || ('n' + Math.random().toString(36).slice(2)), sec.id, st.seat, n.text, n.date, n.time, now);
            }
          }
        }
      }
    }

    if (Array.isArray(backupData.schoolActivities)) {
      db.prepare('DELETE FROM school_activities').run();
      for (const activity of backupData.schoolActivities) {
        insertActivity.run(
          activity.id,
          activity.title || '',
          activity.description || '',
          activity.category || 'أنشطة عامة',
          activity.activity_date || activity.activityDate || null,
          activity.activity_time || activity.activityTime || null,
          activity.image_url || activity.imageUrl || '',
          activity.author_id || activity.authorId || '',
          activity.author_name || activity.authorName || '',
          activity.author_role || activity.authorRole || 'teacher',
          activity.author_subject || activity.authorSubject || '',
          activity.status || 'pending',
          Number(activity.likes_count ?? activity.likesCount ?? 0),
          activity.created_at || activity.createdAt || now,
          activity.updated_at || activity.updatedAt || now
        );
      }
    }

    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'import_backup',
      `استرجاع نسخة احتياطية كاملة (${backupData.sections.length} قسم)`,
      JSON.stringify({ restoredSections: backupData.sections.length }),
      now
    );

    db.exec('COMMIT;');
    return { success: true, count: backupData.sections.length };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// ---------------- Seat Swap & Drag/Drop Functions ----------------

export function swapSeats(sectionId: string, seatANum: number, seatBNum: number, teacherId?: string, teacherRole?: string) {
  if (seatANum === seatBNum || seatANum < 1 || seatANum > 100 || seatBNum < 1 || seatBNum > 100) {
    return { success: false, message: 'أرقام المقاعد غير صالحة' };
  }

  if (teacherRole === 'teacher' && teacherId) {
    const now = new Date().toISOString();
    const baseSeats = db.prepare(
      'SELECT * FROM seats WHERE section_id = ? AND seat_num IN (?, ?) ORDER BY seat_num'
    ).all(sectionId, seatANum, seatBNum) as any[];
    const overrides = db.prepare(
      'SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ? AND seat_num IN (?, ?) ORDER BY seat_num'
    ).all(teacherId, sectionId, seatANum, seatBNum) as any[];
    const bySeat = new Map<number, any>();
    for (const seat of baseSeats) bySeat.set(seat.seat_num, seat);
    for (const seat of overrides) bySeat.set(seat.seat_num, seat);
    const seatA = bySeat.get(seatANum) || {};
    const seatB = bySeat.get(seatBNum) || {};
    const saveOverride = db.prepare(`
      INSERT INTO teacher_seat_overrides
        (teacher_id, section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(teacher_id, section_id, seat_num) DO UPDATE SET
        student_name = excluded.student_name,
        student_number = excluded.student_number,
        massar_number = excluded.massar_number,
        roster_id = excluded.roster_id,
        status_color = excluded.status_color,
        updated_at = excluded.updated_at
    `);
    const write = (seatNum: number, source: any) => saveOverride.run(
      teacherId,
      sectionId,
      seatNum,
      source.student_name || '',
      source.student_number || '',
      source.massar_number || '',
      source.roster_id || null,
      source.status_color || 'default',
      now
    );
    db.exec('BEGIN TRANSACTION;');
    try {
      write(seatANum, seatB);
      write(seatBNum, seatA);
      db.exec('COMMIT;');

      try {
        const oA = db.prepare('SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ? AND seat_num = ?').get(teacherId, sectionId, seatANum) as any;
        const oB = db.prepare('SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ? AND seat_num = ?').get(teacherId, sectionId, seatBNum) as any;
        if (oA) cloudSaveTeacherSeatOverride(oA);
        if (oB) cloudSaveTeacherSeatOverride(oB);
      } catch (err) {
        console.warn('Firestore cloudSaveTeacherSeatOverride in swapSeats error:', err);
      }

      return { success: true, message: 'تم تبديل مقاعدك الخاصة بنجاح' };
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    let seatA = db.prepare('SELECT * FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, seatANum) as any;
    let seatB = db.prepare('SELECT * FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, seatBNum) as any;

    const now = new Date().toISOString();

    if (!seatA) {
      db.prepare(`INSERT INTO seats (section_id, seat_num, student_name, student_number, updated_at) VALUES (?, ?, '', '', ?)`).run(sectionId, seatANum, now);
      seatA = { student_name: '', student_number: '', roster_id: null, status_color: 'default', attendance: null };
    }
    if (!seatB) {
      db.prepare(`INSERT INTO seats (section_id, seat_num, student_name, student_number, updated_at) VALUES (?, ?, '', '', ?)`).run(sectionId, seatBNum, now);
      seatB = { student_name: '', student_number: '', roster_id: null, status_color: 'default', attendance: null };
    }

    // 1. Swap seat student details
    db.prepare(`
      UPDATE seats
      SET student_name = ?, student_number = ?, massar_number = ?, roster_id = ?, status_color = ?, attendance = ?, updated_at = ?
      WHERE section_id = ? AND seat_num = ?
    `).run(
      seatB.student_name || '',
      seatB.student_number || '',
      seatB.massar_number || '',
      seatB.roster_id || null,
      seatB.status_color || 'default',
      seatB.attendance || null,
      now,
      sectionId,
      seatANum
    );

    db.prepare(`
      UPDATE seats
      SET student_name = ?, student_number = ?, massar_number = ?, roster_id = ?, status_color = ?, attendance = ?, updated_at = ?
      WHERE section_id = ? AND seat_num = ?
    `).run(
      seatA.student_name || '',
      seatA.student_number || '',
      seatA.massar_number || '',
      seatA.roster_id || null,
      seatA.status_color || 'default',
      seatA.attendance || null,
      now,
      sectionId,
      seatBNum
    );

    // 2. Move student notes along with the student
    // Step A: temp move seatA notes to -999
    db.prepare('UPDATE notes SET seat_num = -999 WHERE section_id = ? AND seat_num = ?').run(sectionId, seatANum);
    // Step B: move seatB notes to seatA
    db.prepare('UPDATE notes SET seat_num = ? WHERE section_id = ? AND seat_num = ?').run(seatANum, sectionId, seatBNum);
    // Step C: move -999 notes to seatB
    db.prepare('UPDATE notes SET seat_num = ? WHERE section_id = ? AND seat_num = -999').run(seatBNum, sectionId);

    // Move absence and violation history with the student, not with the chair.
    db.prepare('UPDATE attendance_history SET seat_num = -999 WHERE section_id = ? AND seat_num = ?').run(sectionId, seatANum);
    db.prepare('UPDATE attendance_history SET seat_num = ? WHERE section_id = ? AND seat_num = ?').run(seatANum, sectionId, seatBNum);
    db.prepare('UPDATE attendance_history SET seat_num = ? WHERE section_id = ? AND seat_num = -999').run(seatBNum, sectionId);
    db.prepare('UPDATE daily_violations SET seat_num = -999 WHERE section_id = ? AND seat_num = ?').run(sectionId, seatANum);
    db.prepare('UPDATE daily_violations SET seat_num = ? WHERE section_id = ? AND seat_num = ?').run(seatANum, sectionId, seatBNum);
    db.prepare('UPDATE daily_violations SET seat_num = ? WHERE section_id = ? AND seat_num = -999').run(seatBNum, sectionId);

    // 3. Log action
    const nameA = seatA.student_name ? seatA.student_name : `المقعد ${seatANum}`;
    const nameB = seatB.student_name ? seatB.student_name : `المقعد ${seatBNum}`;
    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'swap_seats',
      `تبديل أماكن: [${nameA} - مقعد ${seatANum}] مع [${nameB} - مقعد ${seatBNum}]`,
      JSON.stringify({ sectionId, seatA: seatANum, seatB: seatBNum }),
      now
    );

    db.exec('COMMIT;');
    return { success: true, message: 'تم التبديل بنجاح' };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// ---------------- Seat Shuffle & Random Distribution ----------------

export function orderSectionSeatsByNumber(sectionId: string, actorId?: string, actorRole?: string) {
  db.exec('BEGIN TRANSACTION;');
  try {
    const sec = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
    if (!sec) throw new Error('القسم غير موجود');

    // Get current occupied seats
    const currentSeats = db.prepare('SELECT * FROM seats WHERE section_id = ? ORDER BY seat_num ASC').all(sectionId) as any[];
    
    // Find all active students from seats or roster
    let studentsToSeat: Array<{
      name: string;
      number: string;
      massarNumber: string;
      rosterId: string | null;
      statusColor?: string;
      attendance?: string | null;
      notes: any[];
    }> = [];

    const filledSeats = currentSeats.filter((s) => s.student_name && s.student_name.trim());
    if (filledSeats.length > 0) {
      for (const s of filledSeats) {
        const notes = db.prepare('SELECT * FROM notes WHERE section_id = ? AND seat_num = ?').all(sectionId, s.seat_num);
        studentsToSeat.push({
          name: s.student_name,
          number: s.student_number || '',
          massarNumber: s.massar_number || '',
          rosterId: s.roster_id || null,
          statusColor: s.status_color || 'default',
          attendance: s.attendance || null,
          notes: notes || []
        });
      }
    } else {
      let roster: RosterItem[] = [];
      try {
        roster = JSON.parse(sec.roster_json || '[]');
      } catch {
        roster = [];
      }
      studentsToSeat = roster.map((r) => ({
        name: r.name,
        number: r.number || '',
        massarNumber: r.massarNumber || '',
        rosterId: r.id,
        statusColor: 'default',
        attendance: null,
        notes: []
      }));
    }

    if (studentsToSeat.length === 0) {
      db.exec('COMMIT;');
      return { success: false, message: 'لا توجد بيانات تلاميذ لترتيبهم في هذا القسم' };
    }

    // Sort strictly by student sequence number starting from 1 (1, 2, 3...)
    studentsToSeat.sort((a, b) => {
      const numA = parseInt(a.number || '0', 10);
      const numB = parseInt(b.number || '0', 10);
      if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) {
        return numA - numB;
      }
      return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
    });

    const now = new Date().toISOString();

    // Clear all seats and notes for this section
    db.prepare('DELETE FROM notes WHERE section_id = ?').run(sectionId);
    db.prepare(`
      UPDATE seats
      SET student_name = '', student_number = '', massar_number = '', roster_id = NULL, status_color = 'default', attendance = NULL, updated_at = ?
      WHERE section_id = ?
    `).run(now, sectionId);

    const updateSeatStmt = db.prepare(`
      INSERT INTO seats (section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, attendance, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(section_id, seat_num) DO UPDATE SET
        student_name = excluded.student_name,
        student_number = excluded.student_number,
        massar_number = excluded.massar_number,
        roster_id = excluded.roster_id,
        status_color = excluded.status_color,
        attendance = excluded.attendance,
        updated_at = excluded.updated_at
    `);

    const insertNoteStmt = db.prepare(`
      INSERT INTO notes (id, section_id, seat_num, note_text, note_date, note_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const assignedCount = Math.min(studentsToSeat.length, 100);
    for (let i = 0; i < assignedCount; i++) {
      const targetSeat = i + 1;
      const student = studentsToSeat[i];

      updateSeatStmt.run(
        sectionId,
        targetSeat,
        student.name,
        student.number,
        student.massarNumber || '',
        student.rosterId,
        student.statusColor || 'default',
        student.attendance || null,
        now
      );

      // Re-attach notes to seat
      for (const n of student.notes) {
        insertNoteStmt.run(
          n.id || ('n' + Math.random().toString(36).slice(2)),
          sectionId,
          targetSeat,
          n.note_text || n.text,
          n.note_date || n.date,
          n.note_time || n.time,
          now
        );
      }
    }

    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'order_seats_by_number',
      `ترتيب مقاعد القسم (${sec.level} - ${sec.class_number}) حسب رقم التلميذ ابتداءً من المقعد 1 (${assignedCount} تلميذاً)`,
      JSON.stringify({ sectionId, assignedCount }),
      now
    );

    db.exec('COMMIT;');
    return { success: true, assignedCount };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function shuffleSectionSeats(sectionId: string, actorId?: string, actorRole?: string) {
  db.exec('BEGIN TRANSACTION;');
  try {
    const sec = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
    if (!sec) throw new Error('القسم غير موجود');

    // Get current occupied seats
    const currentSeats = db.prepare('SELECT * FROM seats WHERE section_id = ? ORDER BY seat_num ASC').all(sectionId) as any[];
    
    // Find all active students from seats or roster
    let studentsToSeat: Array<{
      name: string;
      number: string;
      massarNumber: string;
      rosterId: string | null;
      statusColor?: string;
      attendance?: string | null;
      notes: any[];
    }> = [];

    // Check if seats currently have names
    const filledSeats = currentSeats.filter((s) => s.student_name && s.student_name.trim());
    if (filledSeats.length > 0) {
      for (const s of filledSeats) {
        const notes = db.prepare('SELECT * FROM notes WHERE section_id = ? AND seat_num = ?').all(sectionId, s.seat_num);
        studentsToSeat.push({
          name: s.student_name,
          number: s.student_number || '',
          massarNumber: s.massar_number || '',
          rosterId: s.roster_id || null,
          statusColor: s.status_color || 'default',
          attendance: s.attendance || null,
          notes: notes || []
        });
      }
    } else {
      // If seats are empty, pull from roster
      let roster: RosterItem[] = [];
      try {
        roster = JSON.parse(sec.roster_json || '[]');
      } catch {
        roster = [];
      }
      studentsToSeat = roster.map((r) => ({
        name: r.name,
        number: r.number || '',
        massarNumber: r.massarNumber || '',
        rosterId: r.id,
        statusColor: 'default',
        attendance: null,
        notes: []
      }));
    }

    if (studentsToSeat.length === 0) {
      db.exec('COMMIT;');
      return { success: false, message: 'لا توجد بيانات تلاميذ لتوزيعهم في هذا القسم' };
    }

    // Generate random permutation of seat numbers 1..100
    const seatPool = Array.from({ length: 100 }, (_, i) => i + 1);
    for (let i = seatPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seatPool[i], seatPool[j]] = [seatPool[j], seatPool[i]];
    }

    const now = new Date().toISOString();

    // Clear all seats and notes for this section
    db.prepare('DELETE FROM notes WHERE section_id = ?').run(sectionId);
    db.prepare(`
      UPDATE seats
      SET student_name = '', student_number = '', massar_number = '', roster_id = NULL, status_color = 'default', attendance = NULL, updated_at = ?
      WHERE section_id = ?
    `).run(now, sectionId);

    const updateSeatStmt = db.prepare(`
      INSERT INTO seats (section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, attendance, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(section_id, seat_num) DO UPDATE SET
        student_name = excluded.student_name,
        student_number = excluded.student_number,
        massar_number = excluded.massar_number,
        roster_id = excluded.roster_id,
        status_color = excluded.status_color,
        attendance = excluded.attendance,
        updated_at = excluded.updated_at
    `);

    const insertNoteStmt = db.prepare(`
      INSERT INTO notes (id, section_id, seat_num, note_text, note_date, note_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const assignedCount = Math.min(studentsToSeat.length, 100);
    for (let i = 0; i < assignedCount; i++) {
      const targetSeat = seatPool[i];
      const student = studentsToSeat[i];

      updateSeatStmt.run(
        sectionId,
        targetSeat,
        student.name,
        student.number,
        student.massarNumber || '',
        student.rosterId,
        student.statusColor || 'default',
        student.attendance || null,
        now
      );

      // Re-attach notes to new seat
      for (const n of student.notes) {
        insertNoteStmt.run(
          n.id || ('n' + Math.random().toString(36).slice(2)),
          sectionId,
          targetSeat,
          n.note_text || n.text,
          n.note_date || n.date,
          n.note_time || n.time,
          now
        );
      }
    }

    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'shuffle_seats',
      `توزيع عشوائي للمقاعد في القسم: ${sec.level} - ${sec.class_number} (${assignedCount} تلميذاً)`,
      JSON.stringify({ sectionId, assignedCount }),
      now
    );

    db.exec('COMMIT;');
    return { success: true, assignedCount };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// ---------------- Multi-Section Batch Import ----------------

export interface BatchSectionImportItem {
  level: string;
  classNumber: string;
  teacher?: string;
  students: Array<{ name: string; number?: string; massarNumber?: string }>;
  randomizeSeats?: boolean;
}

export function batchImportSections(
  sectionsData: BatchSectionImportItem[],
  replaceExisting: boolean = false
) {
  if (!Array.isArray(sectionsData) || sectionsData.length === 0) {
    throw new Error('لم يتم تقديم أي أقسام صالحة للاستيراد');
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    if (replaceExisting) {
      db.prepare('DELETE FROM notes').run();
      db.prepare('DELETE FROM seats').run();
      db.prepare('DELETE FROM sections').run();
    }

    const insertSec = db.prepare(`
      INSERT INTO sections (id, level, class_number, teacher, created_at, updated_at, roster_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSeat = db.prepare(`
      INSERT INTO seats (section_id, seat_num, student_name, student_number, massar_number, roster_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let totalStudentsImported = 0;

    for (let idx = 0; idx < sectionsData.length; idx++) {
      const secInput = sectionsData[idx];
      const sectionId = 'sec_' + Date.now().toString(36) + '_' + idx + '_' + Math.random().toString(36).slice(2, 6);
      const createdAt = Date.now() + idx;

      // 1. Sort students by sequence number starting from 1 (الترتيب الافتراضي للتلاميذ حسب الرقم ابتداءً من الرقم 1)
      const sortedStudents = [...(secInput.students || [])].sort((a, b) => {
        const numA = parseInt(a.number || '0', 10);
        const numB = parseInt(b.number || '0', 10);
        if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) {
          return numA - numB;
        }
        return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
      });

      // 2. Build roster with sequential numbers and massar codes
      const roster: RosterItem[] = sortedStudents.map((st, sIdx) => ({
        id: `r_${sectionId}_${sIdx + 1}`,
        name: st.name.trim(),
        number: st.number ? String(st.number).trim() : String(sIdx + 1),
        massarNumber: st.massarNumber ? String(st.massarNumber).trim() : ''
      }));

      insertSec.run(
        sectionId,
        secInput.level.trim(),
        secInput.classNumber.trim(),
        secInput.teacher ? secInput.teacher.trim() : '',
        createdAt,
        now,
        JSON.stringify(roster)
      );

      // 3. Seat allocation: Default is sequential by student number starting from 1
      // Student with number 1 -> Seat 1, Student with number 2 -> Seat 2, ...
      const randomize = secInput.randomizeSeats === true;
      const seatOrder = Array.from({ length: 40 }, (_, i) => i + 1);

      if (randomize) {
        // Shuffle seat indices ONLY if explicitly requested by user
        for (let i = seatOrder.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [seatOrder[i], seatOrder[j]] = [seatOrder[j], seatOrder[i]];
        }
      }

      // Populate 40 seats
      const seatMap: Record<number, { name: string; number: string; massarNumber: string; rosterId: string | null }> = {};
      const studentsToPlace = roster.slice(0, 40);
      studentsToPlace.forEach((st, sIdx) => {
        const assignedSeat = seatOrder[sIdx];
        seatMap[assignedSeat] = {
          name: st.name,
          number: st.number,
          massarNumber: st.massarNumber || '',
          rosterId: st.id
        };
      });

      for (let s = 1; s <= 40; s++) {
        const assigned = seatMap[s];
        insertSeat.run(
          sectionId,
          s,
          assigned ? assigned.name : '',
          assigned ? assigned.number : '',
          assigned ? assigned.massarNumber : '',
          assigned ? assigned.rosterId : null,
          now
        );
      }

      totalStudentsImported += roster.length;
    }

    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'batch_import_sections',
      `استيراد شامل لـ ${sectionsData.length} قسماً دراسياً و ${totalStudentsImported} تلميذاً بتنظيم مقاعد افتراضي حسب الرقم ابتداءً من 1`,
      JSON.stringify({ sectionsCount: sectionsData.length, totalStudents: totalStudentsImported }),
      now
    );

    db.exec('COMMIT;');
    return {
      success: true,
      sectionsCount: sectionsData.length,
      totalStudents: totalStudentsImported,
      message: `تم بنجاح استيراد ${sectionsData.length} قسماً و ${totalStudentsImported} تلميذاً مع الترتيب الافتراضي حسب الأرقام ابتداءً من 1`,
      sections: getAllSections()
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// ---------------- Pre-generate 10 Sample Sections ----------------

export function seedTenSections() {
  const sampleFirstNames = [
    'أحمد', 'محمد', 'يوسف', 'حمزة', 'عمر', 'إبراهيم', 'أنس', 'ياسين', 'معاذ', 'ريان',
    'أيوب', 'علي', 'عبد الرحمن', 'سليمان', 'خالد', 'طارق', 'زياد', 'هشام', 'سعد', 'آدم',
    'فاطمة', 'مريم', 'خديجة', 'زينب', 'آية', 'سارة', 'سلمى', 'هبة', 'نور', 'ياسمين',
    'دعاء', 'وئام', 'إكرام', 'هاجر', 'سمية', 'حفصة', 'إيمان', 'أميمة', 'بسمة', 'سناء'
  ];

  const sampleLastNames = [
    'العلوي', 'الإدريسي', 'المرابط', 'بنسعيد', 'التازي', 'الفاسي', 'العماري', 'الشريف',
    'المنصوري', 'الصالحي', 'الزروالي', 'أيت علي', 'بوشعيب', 'اليعقوبي', 'البركة',
    'الراجي', 'الهلالي', 'الداودي', 'السباعي', 'الناصري', 'الحداد', 'النجار', 'المتوكل'
  ];

  const sectionDefs = [
    { level: 'الأولى إعدادي', classNumber: '1', teacher: 'الأستاذ أحمد المنصوري', studentCount: 32 },
    { level: 'الأولى إعدادي', classNumber: '2', teacher: 'الأستاذة فاطمة الزهراء', studentCount: 30 },
    { level: 'الأولى إعدادي', classNumber: '3', teacher: 'الأستاذ خالد العماري', studentCount: 34 },
    { level: 'الثانية إعدادي', classNumber: '1', teacher: 'الأستاذ يوسف بنسعيد', studentCount: 31 },
    { level: 'الثانية إعدادي', classNumber: '2', teacher: 'الأستاذة مريم التازي', studentCount: 33 },
    { level: 'الثانية إعدادي', classNumber: '3', teacher: 'الأستاذ حسن العلمي', studentCount: 29 },
    { level: 'الثالثة إعدادي', classNumber: '1', teacher: 'الأستاذة سناء الشريف', studentCount: 35 },
    { level: 'الثالثة إعدادي', classNumber: '2', teacher: 'الأستاذ طارق الفاسي', studentCount: 32 },
    { level: 'الثالثة إعدادي', classNumber: '3', teacher: 'الأستاذ هشام المرابط', studentCount: 36 },
    { level: 'الثالثة إعدادي', classNumber: '4', teacher: 'الأستاذة نادية السباعي', studentCount: 30 },
  ];

  const batchData: BatchSectionImportItem[] = sectionDefs.map((def, secIdx) => {
    const students: Array<{ name: string; number: string }> = [];
    for (let s = 1; s <= def.studentCount; s++) {
      const fn = sampleFirstNames[(secIdx * 7 + s * 3) % sampleFirstNames.length];
      const ln = sampleLastNames[(secIdx * 5 + s * 2) % sampleLastNames.length];
      students.push({
        name: `${fn} ${ln}`,
        number: `${(secIdx + 1) * 100 + s}`
      });
    }

    return {
      level: def.level,
      classNumber: def.classNumber,
      teacher: def.teacher,
      students,
      randomizeSeats: true
    };
  });

  return batchImportSections(batchData, true);
}

// ---------------- User & Authentication Functions ----------------

export function findUserByUsernameOrEmail(identifier: string) {
  const clean = identifier.trim().toLowerCase();
  const row = db.prepare(`
    SELECT * FROM users
    WHERE LOWER(username) = ? OR LOWER(email) = ?
  `).get(clean, clean) as any;

  return row || null;
}

export function findUserById(id: string) {
  const row = db.prepare(`
    SELECT id, username, email, full_name, role, academic_year, status, subject, email_verified, must_change_profile, must_change_password, created_at, updated_at
    FROM users WHERE id = ?
  `).get(id) as any;

  if (!row) return null;
  const mustChange = Boolean(row.must_change_profile || row.must_change_password);
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role as 'admin' | 'director' | 'teacher',
    academicYear: row.academic_year || '2026/2027',
    status: row.status as 'active' | 'pending' | 'inactive',
    subject: row.subject || 'الرياضيات',
    emailVerified: Boolean(row.email_verified),
    mustChangeProfile: mustChange,
    mustChangePassword: mustChange,
    createdAt: row.created_at
  };
}

export function createUser(data: {
  username: string;
  email: string;
  password: string;
  fullName: string;
  academicYear?: string;
  subject?: string;
  status?: 'active' | 'pending' | 'inactive';
  autoVerifyEmail?: boolean;
}) {
  const username = data.username.trim().toLowerCase();
  const email = data.email.trim().toLowerCase();
  const fullName = data.fullName.trim();
  // Centralized Academic Year: Prioritize the official year set by the Director
  const settings = getAppSettings();
  const academicYear = (settings.year || data.academicYear || '2025/2026').trim();
  const subject = (data.subject || 'الرياضيات').trim();
  const status = data.status || 'pending'; // Default: accounts require director approval

  if (!username || !email || !data.password || !fullName) {
    throw new Error('جميع الحقول مطلوبة لتسجيل الحساب');
  }

  // Check unique
  const existing = db.prepare(`
    SELECT id, username, email FROM users
    WHERE LOWER(username) = ? OR LOWER(email) = ?
  `).get(username, email) as any;

  if (existing) {
    if (existing.username.toLowerCase() === username) {
      throw new Error('اسم المستخدم مستعمل بالفعل، يرجى اختيار اسم آخر');
    }
    if (existing.email.toLowerCase() === email) {
      throw new Error('البريد الإلكتروني مسجل مسبقاً، يمكنك تسجيل الدخول أو استعادة كلمة المرور');
    }
  }

  const id = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  // Email verification logic
  const isPreVerified = Boolean(data.autoVerifyEmail || status === 'active');
  const verificationCode = isPreVerified ? null : Math.floor(100000 + Math.random() * 900000).toString();
  const verificationExpiresAt = isPreVerified ? null : new Date(Date.now() + 30 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO users (
      id, username, email, password, full_name, role, academic_year, status, subject,
      email_verified, verification_code, verification_expires_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'teacher', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, username, email, data.password, fullName, academicYear, status, subject,
    isPreVerified ? 1 : 0,
    verificationCode,
    verificationExpiresAt,
    now, now
  );

  // Cloud Firestore Persistence Hook
  cloudSaveUser({
    id, username, email, fullName, role: 'teacher', academicYear, status, subject,
    emailVerified: isPreVerified, createdAt: now, updatedAt: now
  });

  // If not pre-verified, record in email_outbox
  if (!isPreVerified && verificationCode) {
    const emailId = 'em_v_' + Date.now().toString(36);
    db.prepare(`
      INSERT INTO email_outbox (id, to_email, subject, body, type, token, sent_at)
      VALUES (?, ?, ?, ?, 'email_verification', ?, ?)
    `).run(
      emailId,
      email,
      `رمز تأكيد البريد الإلكتروني - الثانوية الإعدادية ايكسان: ${verificationCode}`,
      `مرحباً بك أستاذ(ة) ${fullName} في فضاء الثانوية الإعدادية ايكسان.\n\nلتأكيد بريدك الإلكتروني والتحقق من حسابك لضمان استلام الإشعارات والتنبيهات، يرجى استخدام رمز التحقق التالي:\n\n【 ${verificationCode} 】\n\nصلاحية هذا الرمز 30 دقيقة.\n\nمع تحيات إدارة المؤسسة.`,
      verificationCode,
      now
    );
  }

  // Record audit
  const auditSummary = status === 'pending'
    ? `طلب تسجيل أستاذ جديد بانتظار موافقة السيد المدير وتأكيد البريد: ${fullName} (${email}) - مادة ${subject}`
    : `تسجيل أستاذ جديد ومفعل: ${fullName} (${email}) - مادة ${subject}`;

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'register_teacher',
    auditSummary,
    JSON.stringify({ id, username, email, fullName, academicYear, subject, status, isPreVerified }),
    now
  );

  return findUserById(id);
}

export function sendVerificationCode(identifier: string) {
  const clean = identifier.trim().toLowerCase();
  const user = db.prepare(`
    SELECT * FROM users
    WHERE id = ? OR LOWER(username) = ? OR LOWER(email) = ?
  `).get(clean, clean, clean) as any;

  if (!user) {
    throw new Error('لم يتم العثور على الحساب المطلوب');
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users 
    SET verification_code = ?, verification_expires_at = ?, updated_at = ?
    WHERE id = ?
  `).run(code, expiresAt, now, user.id);

  // Send to email_outbox
  const emailId = 'em_v_' + Date.now().toString(36);
  db.prepare(`
    INSERT INTO email_outbox (id, to_email, subject, body, type, token, sent_at)
    VALUES (?, ?, ?, ?, 'email_verification', ?, ?)
  `).run(
    emailId,
    user.email,
    `رمز تأكيد البريد الإلكتروني الجديد: ${code}`,
    `مرحباً بك أستاذ(ة) ${user.full_name}،\n\nلقد طلبت إعادة إرسال رمز تأكيد البريد الإلكتروني. رمز التحقق الجديد الخاص بك هو:\n\n【 ${code} 】\n\nصلاحية هذا الرمز 30 دقيقة.\n\nإدارة الثانوية الإعدادية ايكسان.`,
    code,
    now
  );

  return {
    success: true,
    email: user.email,
    code,
    message: `تم إرسال رمز تأكيد جديد إلى ${user.email}`
  };
}

export function verifyEmailCode(identifier: string, code: string) {
  const clean = identifier.trim().toLowerCase();
  const user = db.prepare(`
    SELECT * FROM users
    WHERE id = ? OR LOWER(username) = ? OR LOWER(email) = ?
  `).get(clean, clean, clean) as any;

  if (!user) {
    throw new Error('لم يتم العثور على الحساب');
  }

  if (user.email_verified) {
    return {
      success: true,
      alreadyVerified: true,
      message: 'البريد الإلكتروني مؤكد بالفعل!',
      user: findUserById(user.id)
    };
  }

  const trimmedCode = code.trim();
  if (!user.verification_code || user.verification_code !== trimmedCode) {
    throw new Error('رمز التأكيد غير صحيح، يرجى التأكد من الرمز المدخل أو طلب رمز جديد');
  }

  if (user.verification_expires_at && new Date(user.verification_expires_at).getTime() < Date.now()) {
    throw new Error('انتهت صلاحية رمز التأكيد (30 دقيقة). يرجى الضغط على "إعادة إرسال الرمز"');
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE users
    SET email_verified = 1, verification_code = NULL, verification_expires_at = NULL, updated_at = ?
    WHERE id = ?
  `).run(now, user.id);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'verify_email',
    `تأكيد البريد الإلكتروني بنجاح للأستاذ: ${user.full_name} (${user.email})`,
    JSON.stringify({ userId: user.id, email: user.email }),
    now
  );

  return {
    success: true,
    message: 'تم تأكيد بريدك الإلكتروني بنجاح!',
    user: findUserById(user.id)
  };
}

export function manualVerifyEmail(userId: string) {
  const user = findUserById(userId);
  if (!user) throw new Error('المستخدم غير موجود');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE users
    SET email_verified = 1, verification_code = NULL, verification_expires_at = NULL, updated_at = ?
    WHERE id = ?
  `).run(now, userId);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'manual_verify_email',
    `تأكيد البريد الإلكتروني يدوياً للأستاذ: ${user.fullName} (${user.email}) من طرف الإدارة`,
    JSON.stringify({ userId, email: user.email }),
    now
  );

  return {
    success: true,
    message: `تم تأكيد البريد الإلكتروني للأستاذ (${user.fullName}) بنجاح`,
    user: findUserById(userId)
  };
}

export function updateUserProfile(
  id: string,
  updates: {
    fullName?: string;
    username?: string;
    email?: string;
    academicYear?: string;
    password?: string;
    mustChangeProfile?: boolean;
  },
  requester?: { userId?: string; role?: string }
) {
  const user = findUserById(id);
  if (!user) throw new Error('المستخدم غير موجود');

  // Strict RBAC Enforcement:
  // 1. If target is admin: ONLY the admin themselves can update their profile.
  if (user.role === 'admin') {
    if (requester && (requester.role !== 'admin' || (requester.userId && requester.userId !== id))) {
      throw new Error('غير مصرح: حساب المشرف العام (Admin) محمي ومحصن تماماً ولا يمكن تعديله إلا من طرف المشرف نفسه.');
    }
  }

  // 2. If target is director: Only the director themselves or the app admin can update.
  if (user.role === 'director') {
    if (requester && requester.role !== 'admin' && requester.userId && requester.userId !== id) {
      throw new Error('غير مصرح: لا يمكن تعديل بيانات مدير المؤسسة إلا من طرف المشرف العام أو المدير نفسه.');
    }
  }

  const now = new Date().toISOString();

  if (updates.fullName !== undefined && updates.fullName.trim()) {
    db.prepare('UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?')
      .run(updates.fullName.trim(), now, id);

    // Update teacher name in sections assigned to this user
    db.prepare('UPDATE sections SET teacher = ?, updated_at = ? WHERE assigned_teacher_id = ?')
      .run(updates.fullName.trim(), now, id);
  }

  if (updates.username !== undefined && updates.username.trim()) {
    const cleanUsername = updates.username.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?').get(cleanUsername, id);
    if (existing) {
      throw new Error('اسم المستخدم هذا مستعمل بالفعل، يرجى اختيار اسم مستخدم آخر');
    }
    db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
      .run(cleanUsername, now, id);
  }

  if (updates.email !== undefined && updates.email.trim()) {
    const cleanEmail = updates.email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(cleanEmail, id);
    if (existing) {
      throw new Error('هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
    }
    db.prepare('UPDATE users SET email = ?, updated_at = ? WHERE id = ?')
      .run(cleanEmail, now, id);
  }

  if (updates.academicYear !== undefined && updates.academicYear.trim()) {
    const newYear = updates.academicYear.trim();
    if (user.role === 'admin' || user.role === 'director') {
      // Update for all users across the institution
      db.prepare('UPDATE users SET academic_year = ?, updated_at = ?').run(newYear, now);
      // Sync into app_settings
      db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('year', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(newYear, now);

      db.prepare(`
        INSERT INTO change_history (action, summary, details_json, created_at)
        VALUES (?, ?, ?, ?)
      `).run(
        'update_academic_year',
        `تحديث الموسم الدراسي العام من طرف إدارة المؤسسة: ${newYear}`,
        JSON.stringify({ updatedBy: user.username, academicYear: newYear }),
        now
      );
    } else {
      db.prepare('UPDATE users SET academic_year = ?, updated_at = ? WHERE id = ?').run(newYear, now, id);
    }
  }

  if (updates.password !== undefined && updates.password.trim()) {
    db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
      .run(updates.password.trim(), now, id);
  }

  if (updates.mustChangeProfile !== undefined) {
    const val = updates.mustChangeProfile ? 1 : 0;
    try {
      db.prepare('UPDATE users SET must_change_profile = ?, must_change_password = ?, updated_at = ? WHERE id = ?')
        .run(val, val, now, id);
    } catch {
      db.prepare('UPDATE users SET must_change_profile = ?, updated_at = ? WHERE id = ?')
        .run(val, now, id);
    }
  }

  return findUserById(id);
}

export function getAllTeachers() {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.academic_year, u.status, u.subject, u.email_verified, u.created_at,
           COUNT(s.id) as assigned_sections_count
    FROM users u
    LEFT JOIN sections s ON s.assigned_teacher_id = u.id
    WHERE u.role = 'teacher'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    academicYear: r.academic_year,
    status: r.status,
    subject: r.subject || 'الرياضيات',
    emailVerified: Boolean(r.email_verified),
    createdAt: r.created_at,
    assignedSectionsCount: Number(r.assigned_sections_count || 0)
  }));
}

export function deleteTeacher(id: string, requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin' && requesterRole !== 'director') {
    throw new Error('غير مصرح لك بحذف حسابات الأساتذة');
  }

  const user = findUserById(id);
  if (!user) {
    throw new Error('المستخدم غير موجود');
  }

  // Strict RBAC: No one can delete Admin through here
  if (user.role === 'admin') {
    throw new Error('حساب المشرف العام (Admin) محمي ومحصن تماماً ولا يمكن حذفه أبداً');
  }

  // Strict RBAC: Director cannot delete another Director (only Admin can via deleteDirector)
  if (user.role === 'director') {
    throw new Error('لا يمكن حذف حساب مدير المؤسسة من هنا. إدارة واستبدال مديري المؤسسة صلاحية حصرية لمشرف التطبيق (Admin)');
  }

  // Target must be a teacher
  if (user.role !== 'teacher') {
    throw new Error('يمكن فقط حذف حسابات الأساتذة من خلال هذا المسار');
  }

  const now = new Date().toISOString();

  // Unassign sections
  db.prepare('UPDATE sections SET assigned_teacher_id = NULL, updated_at = ? WHERE assigned_teacher_id = ?')
    .run(now, id);

  // Delete assignment requests
  db.prepare('DELETE FROM section_assignments WHERE teacher_id = ?').run(id);

  // Delete user
  db.prepare('DELETE FROM users WHERE id = ?').run(id);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'delete_teacher',
    `حذف حساب الأستاذ: ${user.fullName} (${user.email})`,
    JSON.stringify({ id, email: user.email }),
    now
  );

  return { success: true, message: `تم حذف حساب الأستاذ (${user.fullName}) بنجاح` };
}

// ---------------- Batch Import Teachers from Excel ----------------

export function normalizeTeacherSubject(rawSubject: string): string {
  if (!rawSubject || !rawSubject.trim()) return 'الرياضيات';
  const s = rawSubject.trim();

  // Moroccan educational subject mappings
  if (/رياض|math/i.test(s)) return 'الرياضيات';
  if (/فرنس|fran/i.test(s)) return 'الفرنسية';
  if (/عرب|arab/i.test(s)) return 'العربية';
  if (/حياة|أرض|svt|علوم الطبيعية|طبيع/i.test(s)) return 'علوم الحياة والأرض';
  if (/فيزيا|كيميا|phys|pc|علوم الفيزياء/i.test(s)) return 'علوم الفيزياء';
  if (/اجتماع|تاريخ|جغرافيا|hg/i.test(s)) return 'الاجتماعيات';
  if (/إسلام|اسلام|تربية إسلامية|تربية اسلامية|دين/i.test(s)) return 'التربية الإسلامية';
  if (/رياضة|بدني|تربية بدنية|eps/i.test(s)) return 'الرياضة';
  if (/معلوم|حاسوب|برمج|info/i.test(s)) return 'المعلوميات';
  if (/إنجليز|انجليز|eng/i.test(s)) return 'الإنجليزية';
  if (/تكنولوج|techno/i.test(s)) return 'التكنولوجيا';

  return s;
}

export function transliterateArabicToLatin(text: string): string {
  if (!text) return 'prof';
  let clean = text
    .replace(/^(ذ\.|أ\.|الأستاذ|الأستاذة|السيد|السيدة|prof\.|mr\.|mme\.)\s*/i, '')
    .trim();

  const map: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'ch', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a', 'ء': '', 'ئ': 'y', 'ؤ': 'o'
  };

  let res = '';
  for (const char of clean) {
    if (map[char] !== undefined) {
      res += map[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      res += char.toLowerCase();
    } else if (char === ' ' || char === '-' || char === '_') {
      res += '_';
    }
  }
  res = res.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return res || 'prof';
}

export function batchCreateTeachers(
  items: Array<{
    fullName: string;
    subject: string;
    username?: string;
    email?: string;
    password?: string;
  }>,
  options?: {
    defaultPassword?: string;
    updateExistingSubject?: boolean;
    academicYear?: string;
  }
) {
  const settings = getAppSettings();
  const academicYear = (options?.academicYear || settings.year || '2025/2026').trim();
  const defaultPassword = options?.defaultPassword || '123456';
  const updateExisting = options?.updateExistingSubject ?? true;

  const results: Array<{
    fullName: string;
    subject: string;
    username: string;
    email: string;
    status: 'created' | 'updated' | 'skipped' | 'error';
    reason?: string;
    id?: string;
  }> = [];

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const rawFullName = (item.fullName || '').trim();
    if (!rawFullName) continue;

    const normalizedSubject = normalizeTeacherSubject(item.subject);

    // Check if user with same full name already exists
    const existingByName = db.prepare(`
      SELECT id, username, email, full_name, subject, status FROM users
      WHERE LOWER(TRIM(full_name)) = LOWER(?) AND role = 'teacher'
    `).get(rawFullName) as any;

    if (existingByName) {
      if (updateExisting && existingByName.subject !== normalizedSubject) {
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE users SET subject = ?, updated_at = ? WHERE id = ?
        `).run(normalizedSubject, now, existingByName.id);

        updatedCount++;
        results.push({
          id: existingByName.id,
          fullName: rawFullName,
          subject: normalizedSubject,
          username: existingByName.username,
          email: existingByName.email,
          status: 'updated',
          reason: `تم تحديث التخصص من (${existingByName.subject}) إلى (${normalizedSubject})`
        });
      } else {
        skippedCount++;
        results.push({
          id: existingByName.id,
          fullName: rawFullName,
          subject: existingByName.subject,
          username: existingByName.username,
          email: existingByName.email,
          status: 'skipped',
          reason: 'مسجل مسبقاً بنفس الاسم والتخصص'
        });
      }
      continue;
    }

    // Generate unique username
    let baseUsername = (item.username || '').trim().toLowerCase();
    if (!baseUsername) {
      baseUsername = transliterateArabicToLatin(rawFullName);
    }
    if (!baseUsername || baseUsername.length < 2) {
      baseUsername = 'prof_' + Math.random().toString(36).slice(2, 6);
    }

    let candidateUsername = baseUsername;
    let uCounter = 1;
    while (true) {
      const uExists = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(candidateUsername);
      if (!uExists) break;
      candidateUsername = `${baseUsername}_${uCounter++}`;
    }

    // Generate unique email
    let baseEmail = (item.email || '').trim().toLowerCase();
    if (!baseEmail || !baseEmail.includes('@')) {
      baseEmail = `${candidateUsername}@iksan.ma`;
    }

    let candidateEmail = baseEmail;
    let eCounter = 1;
    while (true) {
      const eExists = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(candidateEmail);
      if (!eExists) break;
      const parts = baseEmail.split('@');
      candidateEmail = `${parts[0]}_${eCounter++}@${parts[1] || 'iksan.ma'}`;
    }

    const password = item.password || defaultPassword;
    const id = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO users (
          id, username, email, password, full_name, role, academic_year, status, subject,
          email_verified, verification_code, verification_expires_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'teacher', ?, 'active', ?, 1, NULL, NULL, ?, ?)
      `).run(
        id, candidateUsername, candidateEmail, password, rawFullName, academicYear, normalizedSubject,
        now, now
      );

      createdCount++;
      results.push({
        id,
        fullName: rawFullName,
        subject: normalizedSubject,
        username: candidateUsername,
        email: candidateEmail,
        status: 'created',
        reason: 'تم إنشاء الحساب وتفعيله مباشرة'
      });
    } catch (err: any) {
      results.push({
        fullName: rawFullName,
        subject: normalizedSubject,
        username: candidateUsername,
        email: candidateEmail,
        status: 'error',
        reason: err.message
      });
    }
  }

  // Record audit
  const nowStr = new Date().toISOString();
  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'batch_import_teachers',
    `استيراد أساتذة عبر ملف إكسيل: تمت إضافة ${createdCount} أستاذ جديد، وتحديث ${updatedCount}، وتجاوز ${skippedCount}`,
    JSON.stringify({ createdCount, updatedCount, skippedCount, total: items.length }),
    nowStr
  );

  return {
    success: true,
    createdCount,
    updatedCount,
    skippedCount,
    totalProcessed: items.length,
    results
  };
}

// ---------------- Section Assignment & Approval Workflow ----------------

export function getApprovedSectionTeachers(sectionId: string): Array<{ teacherId: string; teacherName: string; subject: string }> {
  const list: Array<{ teacherId: string; teacherName: string; subject: string }> = [];
  const rows = db.prepare(`
    SELECT sa.teacher_id, COALESCE(sa.subject, u.subject, 'عام') as subject, u.full_name as teacher_name
    FROM section_assignments sa
    JOIN users u ON sa.teacher_id = u.id
    WHERE sa.section_id = ? AND sa.status = 'approved'
  `).all(sectionId) as any[];

  for (const r of rows) {
    list.push({
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      subject: (r.subject || 'عام').trim()
    });
  }

  // Also check section primary teacher if not in list
  const sec = db.prepare('SELECT assigned_teacher_id FROM sections WHERE id = ?').get(sectionId) as any;
  if (sec && sec.assigned_teacher_id && !list.some(t => t.teacherId === sec.assigned_teacher_id)) {
    const u = db.prepare('SELECT id, full_name, subject FROM users WHERE id = ?').get(sec.assigned_teacher_id) as any;
    if (u) {
      list.push({
        teacherId: u.id,
        teacherName: u.full_name,
        subject: (u.subject || 'عام').trim()
      });
    }
  }

  return list;
}

export function createAssignmentRequest(teacherId: string, sectionId: string, requestNote: string = '') {
  const teacher = findUserById(teacherId);
  if (!teacher) throw new Error('الأستاذ غير موجود');

  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
  if (!section) throw new Error('القسم غير موجود');

  const teacherSubject = (teacher.subject || 'عام').trim();
  const existingApproved = getApprovedSectionTeachers(sectionId);

  // Check if this teacher is already approved for this section
  const alreadyMe = existingApproved.find(t => t.teacherId === teacherId);
  if (alreadyMe || section.assigned_teacher_id === teacherId) {
    throw new Error(`هذا القسم مسند إليك بالفعل وموافق عليه لمادة (${alreadyMe ? alreadyMe.subject : teacherSubject})`);
  }

  // A section may have multiple teachers; only the same subject may not be
  // assigned to two different teachers in the same assignment set.
  const sectionTeacherConflict = existingApproved.find((t) =>
    t.teacherId !== teacherId && t.subject.trim().toLowerCase() === teacherSubject.toLowerCase()
  );

  if (sectionTeacherConflict) {
    throw new Error(
      `لا يمكن إسناد مادة (${teacherSubject}) لهذا القسم لأن المادة نفسها مسندة مسبقاً للأستاذ (${sectionTeacherConflict.teacherName}). يمكن إسناد القسم لأساتذة مواد مختلفة.`
    );
  }

  // Check if there is already a pending request from this teacher
  const existingPending = db.prepare(`
    SELECT * FROM section_assignments
    WHERE teacher_id = ? AND section_id = ? AND status = 'pending'
  `).get(teacherId, sectionId) as any;

  if (existingPending) {
    throw new Error('لديك طلب سابق قيد المراجعة بانتظار موافقة المشرف (المدير)');
  }

  const reqId = 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO section_assignments (id, teacher_id, section_id, status, request_note, requested_at, academic_year, subject)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
  `).run(reqId, teacherId, sectionId, requestNote, now, teacher.academicYear, teacher.subject || 'عام');

  // Log email notification to admin
  const emailId = 'em_' + Date.now().toString(36);
  db.prepare(`
    INSERT INTO email_outbox (id, to_email, subject, body, type, token, sent_at)
    VALUES (?, ?, ?, ?, 'new_assignment_request', NULL, ?)
  `).run(
    emailId,
    'mrsamir069@gmail.com',
    `طلب إسناد قسم جديد: ${section.level} - القسم ${section.class_number} (مادة ${teacher.subject || 'عام'})`,
    `تلقى المشرف طلباً جديداً من الأستاذ ${teacher.fullName} (${teacher.email} - مادة: ${teacher.subject || 'عام'}) لإسناد القسم: ${section.level} - القسم ${section.class_number}.\nالملاحظات: ${requestNote || 'بدون ملاحظات'}\nيرجى الدخول إلى لوحة الإدارة للموافقة أو الرفض.`,
    now
  );

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'create_assignment_request',
    `طلب إسناد قسم: ${teacher.fullName} (${teacher.subject || 'عام'}) يطلب ${section.level} - القسم ${section.class_number}`,
    JSON.stringify({ teacherId, sectionId, reqId, subject: teacher.subject || 'عام' }),
    now
  );

  return { success: true, requestId: reqId };
}

export function getAssignmentRequests(filter?: { teacherId?: string; status?: string }) {
  let query = `
    SELECT sa.*, 
           u.full_name as teacher_name, u.email as teacher_email, COALESCE(sa.subject, u.subject, 'عام') as teacher_subject,
           s.level as section_level, s.class_number as section_class_number,
           s.assigned_teacher_id
    FROM section_assignments sa
    JOIN users u ON sa.teacher_id = u.id
    JOIN sections s ON sa.section_id = s.id
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter?.teacherId) {
    conditions.push('sa.teacher_id = ?');
    params.push(filter.teacherId);
  }

  if (filter?.status) {
    conditions.push('sa.status = ?');
    params.push(filter.status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY sa.requested_at DESC';

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    teacherEmail: r.teacher_email,
    teacherSubject: r.teacher_subject || 'عام',
    sectionId: r.section_id,
    level: r.section_level,
    classNumber: r.section_class_number,
    status: r.status as 'pending' | 'approved' | 'rejected',
    requestNote: r.request_note || '',
    requestedAt: r.requested_at,
    reviewedAt: r.reviewed_at || undefined,
    reviewedBy: r.reviewed_by || undefined
  }));
}

export function reviewAssignmentRequest(requestId: string, decision: 'approved' | 'rejected', reviewerId: string = 'admin') {
  const req = db.prepare(`
    SELECT sa.*, u.full_name as teacher_name, u.email as teacher_email, COALESCE(sa.subject, u.subject, 'عام') as teacher_subject,
           s.level, s.class_number
    FROM section_assignments sa
    JOIN users u ON sa.teacher_id = u.id
    JOIN sections s ON sa.section_id = s.id
    WHERE sa.id = ?
  `).get(requestId) as any;

  if (!req) throw new Error('طلب الإسناد غير موجود');

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE section_assignments
    SET status = ?, reviewed_at = ?, reviewed_by = ?, subject = COALESCE(subject, ?)
    WHERE id = ?
  `).run(decision, now, reviewerId, req.teacher_subject || 'عام', requestId);

  if (decision === 'approved') {
    const existingApproved = getApprovedSectionTeachers(req.section_id);
    const sectionTeacherConflict = existingApproved.find((t) =>
      t.teacherId !== req.teacher_id &&
      t.subject.trim().toLowerCase() === (req.teacher_subject || 'عام').trim().toLowerCase()
    );

    if (sectionTeacherConflict) {
      throw new Error(
        `تعذر الموافقة: مادة (${req.teacher_subject || 'عام'}) مسندة مسبقاً للأستاذ (${sectionTeacherConflict.teacherName}). يمكن إسناد القسم لأساتذة مواد مختلفة.`
      );
    }

    // If primary assigned_teacher_id on section is not set, set it.
    db.prepare(`
      UPDATE sections
      SET assigned_teacher_id = COALESCE(assigned_teacher_id, ?), updated_at = ?
      WHERE id = ?
    `).run(req.teacher_id, now, req.section_id);

    // NOTE: Multi-teacher support: We deliberately DO NOT reject other teachers' pending requests for this section!
    // Multiple teachers teaching different subjects can all be assigned simultaneously.
  }

  // Send simulated notification email to teacher
  const emailId = 'em_' + Date.now().toString(36);
  const subject = decision === 'approved' 
    ? `تمت الموافقة على طلب إسناد القسم: ${req.level} - القسم ${req.class_number} (مادة ${req.teacher_subject || 'عام'})`
    : `بشأن طلب إسناد القسم: ${req.level} - القسم ${req.class_number}`;

  const body = decision === 'approved'
    ? `مرحباً أستاذ ${req.teacher_name},\n\nيسرنا إبلاغك بأن المشرف (المدير) قد وافق على طلب إسناد القسم (${req.level} - القسم ${req.class_number}) إليك لمادة (${req.teacher_subject || 'عام'}).\nيمكنك الآن تسجيل الدخول للاطلاع على أسماء التلاميذ، توزيع المقاعد، وإضافة الملاحظات بحرية.`
    : `مرحباً أستاذ ${req.teacher_name},\n\nنود إبلاغك بأن طلب إسناد القسم (${req.level} - القسم ${req.class_number}) لم تتم الموافقة عليه في الوقت الحالي.\nيرجى مراجعة إدارة المؤسسة لمزيد من التفاصيل.`;

  db.prepare(`
    INSERT INTO email_outbox (id, to_email, subject, body, type, token, sent_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?)
  `).run(
    emailId,
    req.teacher_email,
    subject,
    body,
    decision === 'approved' ? 'request_approved' : 'request_rejected',
    now
  );

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    decision === 'approved' ? 'approve_section_assignment' : 'reject_section_assignment',
    `${decision === 'approved' ? 'الموافقة على' : 'رفض'} إسناد القسم ${req.level} - ${req.class_number} للأستاذ ${req.teacher_name} (مادة ${req.teacher_subject || 'عام'})`,
    JSON.stringify({ requestId, teacherId: req.teacher_id, sectionId: req.section_id, decision, subject: req.teacher_subject || 'عام' }),
    now
  );

  return { success: true, decision };
}

export function assignSectionDirectly(teacherId: string, sectionId: string) {
  const teacher = findUserById(teacherId);
  if (!teacher) throw new Error('الأستاذ غير موجود');

  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
  if (!section) throw new Error('القسم غير موجود');

  const existingApproved = getApprovedSectionTeachers(sectionId);

  // Check if already assigned to this teacher
  const alreadyMe = existingApproved.find(t => t.teacherId === teacherId);
  if (alreadyMe) {
    throw new Error(`هذا القسم مسند بالفعل للأستاذ (${teacher.fullName}) في نفس الفترة الزمنية.`);
  }

  const teacherSubject = (teacher.subject || 'عام').trim();
  const sectionTeacherConflict = existingApproved.find((t) =>
    t.teacherId !== teacherId && t.subject.trim().toLowerCase() === teacherSubject.toLowerCase()
  );

  if (sectionTeacherConflict) {
    throw new Error(
      `لا يمكن إسناد مادة (${teacherSubject}) لهذا القسم لأن المادة نفسها مسندة مسبقاً للأستاذ (${sectionTeacherConflict.teacherName}). يمكن إسناد القسم لأساتذة مواد مختلفة.`
    );
  }

  const now = new Date().toISOString();

  // Update section default assigned teacher if empty
  db.prepare(`
    UPDATE sections
    SET assigned_teacher_id = COALESCE(assigned_teacher_id, ?), updated_at = ?
    WHERE id = ?
  `).run(teacherId, now, sectionId);

  // Close or create approved record in section_assignments for this teacher & subject
  const existing = db.prepare(`
    SELECT id FROM section_assignments WHERE teacher_id = ? AND section_id = ?
  `).get(teacherId, sectionId) as any;

  if (existing) {
    db.prepare(`
      UPDATE section_assignments 
      SET status = 'approved', reviewed_at = ?, reviewed_by = 'admin', subject = ?
      WHERE id = ?
    `).run(now, teacher.subject || 'عام', existing.id);
  } else {
    const reqId = 'req_direct_' + Date.now().toString(36);
    db.prepare(`
      INSERT INTO section_assignments (id, teacher_id, section_id, status, request_note, requested_at, reviewed_at, reviewed_by, academic_year, subject)
      VALUES (?, ?, ?, 'approved', 'إسناد مباشر من طرف المشرف/المدير', ?, ?, 'admin', ?, ?)
    `).run(reqId, teacherId, sectionId, now, now, teacher.academicYear, teacher.subject || 'عام');
  }

  // NOTE: Multi-teacher support: We do NOT reject other teachers assigned to this section!
  return { success: true };
}

export function unassignSection(sectionId: string, teacherId?: string) {
  const now = new Date().toISOString();

  if (teacherId) {
    // Unassign only this specific teacher from the section
    db.prepare(`
      DELETE FROM section_assignments
      WHERE section_id = ? AND teacher_id = ?
    `).run(sectionId, teacherId);

    // If this teacher was the primary assigned_teacher_id, replace with another approved teacher if exists
    const nextApproved = db.prepare(`
      SELECT teacher_id FROM section_assignments
      WHERE section_id = ? AND status = 'approved'
      LIMIT 1
    `).get(sectionId) as any;

    db.prepare(`
      UPDATE sections
      SET assigned_teacher_id = ?, updated_at = ?
      WHERE id = ?
    `).run(nextApproved ? nextApproved.teacher_id : null, now, sectionId);
  } else {
    // Unassign all teachers from this section
    db.prepare(`
      DELETE FROM section_assignments
      WHERE section_id = ?
    `).run(sectionId);

    db.prepare(`
      UPDATE sections
      SET assigned_teacher_id = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, sectionId);
  }

  return { success: true };
}

export function getAvailableSectionsForRequest(teacherId: string) {
  const myTeacher = findUserById(teacherId);
  const mySubject = (myTeacher?.subject || 'عام').trim().toLowerCase();

  const allSections = db.prepare(`
    SELECT s.id, s.level, s.class_number, s.teacher, s.assigned_teacher_id,
           u.full_name as assigned_teacher_name,
           (SELECT COUNT(*) FROM seats st WHERE st.section_id = s.id AND st.student_name != '') as student_count
    FROM sections s
    LEFT JOIN users u ON s.assigned_teacher_id = u.id
    ORDER BY s.created_at ASC
  `).all() as any[];

  // Get all approved assignments across sections to display multi-teacher assignments
  const approvedRows = db.prepare(`
    SELECT sa.section_id, sa.teacher_id, COALESCE(sa.subject, u.subject, 'عام') as subject, u.full_name as teacher_name
    FROM section_assignments sa
    JOIN users u ON sa.teacher_id = u.id
    WHERE sa.status = 'approved'
  `).all() as any[];

  const assignedTeachersMap = new Map<string, Array<{ teacherId: string; teacherName: string; subject: string }>>();
  for (const row of approvedRows) {
    if (!assignedTeachersMap.has(row.section_id)) {
      assignedTeachersMap.set(row.section_id, []);
    }
    assignedTeachersMap.get(row.section_id)!.push({
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      subject: (row.subject || 'عام').trim()
    });
  }

  // Get this teacher's requests
  const myRequests = db.prepare(`
    SELECT section_id, status, requested_at
    FROM section_assignments
    WHERE teacher_id = ?
  `).all(teacherId) as any[];

  const requestMap = new Map<string, any>();
  for (const r of myRequests) {
    requestMap.set(r.section_id, r);
  }

  return allSections.map((sec) => {
    const assignedTeachers = assignedTeachersMap.get(sec.id) || [];
    
    // Check if this teacher is already approved
    const isApprovedForMe = assignedTeachers.some(t => t.teacherId === teacherId) || sec.assigned_teacher_id === teacherId;
    const myReq = requestMap.get(sec.id);
    const isPendingForMe = myReq && myReq.status === 'pending';

    // Check if another teacher with the SAME subject is already assigned!
    const conflictTeacher = assignedTeachers.find(
      (t) => t.teacherId !== teacherId && t.subject.trim().toLowerCase() === mySubject
    );

    let status: 'none' | 'pending' | 'approved' | 'assigned_to_other' | 'same_subject_conflict' = 'none';

    if (isApprovedForMe) {
      status = 'approved';
    } else if (isPendingForMe) {
      status = 'pending';
    } else if (conflictTeacher) {
      status = 'same_subject_conflict';
    } else {
      // Available for this teacher's subject!
      status = 'none';
    }

    return {
      id: sec.id,
      level: sec.level,
      classNumber: sec.class_number,
      teacher: sec.teacher || sec.assigned_teacher_name || 'غير مسند',
      studentCount: Number(sec.student_count || 0),
      assignedTeacherId: sec.assigned_teacher_id || null,
      assignedTeacherName: sec.assigned_teacher_name || null,
      assignmentStatus: status,
      sameSubjectConflict: !!conflictTeacher,
      conflictTeacherName: conflictTeacher ? conflictTeacher.teacherName : null,
      conflictSubject: conflictTeacher ? conflictTeacher.subject : null,
      assignedTeachers,
      assignedSubjects: assignedTeachers.map(t => ({
        subject: t.subject,
        teacherName: t.teacherName,
        teacherId: t.teacherId
      }))
    };
  });
}

// ---------------- Password Reset & Email Simulation ----------------

export function requestPasswordReset(identifier: string) {
  const clean = identifier.trim().toLowerCase();
  const user = db.prepare(`
    SELECT * FROM users
    WHERE LOWER(username) = ? OR LOWER(email) = ?
  `).get(clean, clean) as any;

  if (!user) {
    throw new Error('لم يتم العثور على حساب مرتبط بهذا البريد الإلكتروني أو اسم المستخدم');
  }

  // Generate a clear temporary password & reset code
  const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
  const tempPassword = `Iksan@${tempPin}`;
  const now = new Date().toISOString();
  const resetId = 'rst_' + Date.now().toString(36);

  // Update password directly so the user can immediately log in with the new credentials
  db.prepare(`
    UPDATE users SET password = ?, updated_at = ?
    WHERE id = ?
  `).run(tempPassword, now, user.id);

  // Record reset record
  db.prepare(`
    INSERT INTO password_resets (id, user_id, email, token, temp_password, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run(resetId, user.id, user.email, tempPin, tempPassword, now);

  // Send email to outbox
  const emailId = 'em_' + Date.now().toString(36);
  const emailBody = `مرحباً ${user.full_name}،\n\nلقد تم تقديم طلب لاستعادة معلومات الدخول إلى نظام خرائط الأقسام (الثانوية الإعدادية ايكسان).\n\nمعلومات الدخول الجديدة:\n- اسم المستخدم: ${user.username}\n- البريد الإلكتروني: ${user.email}\n- كلمة المرور الجديدة المؤقتة: ${tempPassword}\n\nيمكنك تسجيل الدخول الآن وتغيير كلمة المرور من إعدادات حسابك في أي وقت.`;

  db.prepare(`
    INSERT INTO email_outbox (id, to_email, subject, body, type, token, sent_at)
    VALUES (?, ?, ?, ?, 'password_reset', ?, ?)
  `).run(
    emailId,
    user.email,
    'استعادة كلمة المرور - الثانوية الإعدادية ايكسان',
    emailBody,
    tempPassword,
    now
  );

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'password_reset',
    `طلب استعادة كلمة المرور للحساب: ${user.email}`,
    JSON.stringify({ userId: user.id, email: user.email }),
    now
  );

  return {
    success: true,
    email: user.email,
    username: user.username,
    tempPassword,
    message: `تم إرسال معلومات الدخول وكلمة المرور الجديدة إلى بريدك الإلكتروني (${user.email}).`
  };
}

export function getOutboxEmails(limit: number = 30) {
  const rows = db.prepare(`
    SELECT * FROM email_outbox
    ORDER BY sent_at DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    to: r.to_email,
    subject: r.subject,
    body: r.body,
    type: r.type,
    token: r.token,
    sentAt: r.sent_at
  }));
}

export function updateTeacherStatus(teacherId: string, status: 'active' | 'pending' | 'inactive', requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin' && requesterRole !== 'director') {
    throw new Error('غير مصرح لك بتعديل حالة حسابات الأساتذة');
  }

  const user = findUserById(teacherId);
  if (!user) throw new Error('الأستاذ غير موجود');
  if (user.role === 'admin') {
    throw new Error('لا يمكن تغيير حالة حساب المشرف العام');
  }
  if (user.role === 'director') {
    throw new Error('لا يمكن تغيير حالة مدير المؤسسة من هنا');
  }
  if (user.role !== 'teacher') {
    throw new Error('هذه الوظيفة مخصصة لتحديث حالة حسابات الأساتذة فقط');
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, now, teacherId);

  // If approved and activated by director or admin, generate simulated approval notification and audit entry
  if (status === 'active') {
    const emailId = 'mail_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare(`
      INSERT INTO email_outbox (id, to_email, subject, body, type, token, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      emailId,
      user.email,
      'تهانينا! تمت الموافقة على حسابك وتفعيله في الثانوية الإعدادية ايكسان',
      `مرحباً بك أستاذ(ة) ${user.fullName}،\nيسر إدارة المؤسسة إعلامك بأنه قد تمت مراجعة حسابك والموافقة عليه وتفعيله بنجاح من طرف إدارة المؤسسة.\nيمكنك الآن تسجيل الدخول لمنظومة خرائط الأقسام وطلب إسناد أقسامك.`,
      'account_activated',
      null,
      now
    );

    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'activate_teacher',
      `تفعيل وقبول حساب الأستاذ: ${user.fullName} (${user.email}) من طرف الإدارة`,
      JSON.stringify({ teacherId, teacherName: user.fullName, email: user.email, status: 'active' }),
      now
    );
  } else if (status === 'inactive') {
    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'deactivate_teacher',
      `تعطيل وتوقيف حساب الأستاذ: ${user.fullName} (${user.email}) من طرف الإدارة`,
      JSON.stringify({ teacherId, teacherName: user.fullName, email: user.email, status: 'inactive' }),
      now
    );
  }

  return findUserById(teacherId);
}

export function adminResetTeacherPassword(teacherId: string, newPass: string, requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin' && requesterRole !== 'director') {
    throw new Error('غير مصرح لك بإعادة تعيين كلمة مرور الأساتذة');
  }

  const user = findUserById(teacherId);
  if (!user) throw new Error('الأستاذ غير موجود');
  if (user.role === 'admin') {
    throw new Error('لا يمكن تغيير كلمة مرور حساب المشرف العام من هنا');
  }
  if (user.role === 'director') {
    throw new Error('لا يمكن تغيير كلمة مرور مدير المؤسسة من هنا');
  }
  if (user.role !== 'teacher') {
    throw new Error('يمكن فقط إعادة تعيين كلمة المرور لحسابات الأساتذة');
  }

  if (!newPass || newPass.trim().length < 4) {
    throw new Error('كلمة المرور يجب أن لا تقل عن 4 خانات');
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').run(newPass.trim(), now, teacherId);
  return { success: true, message: `تم تحديث كلمة المرور للأستاذ (${user.fullName}) بنجاح` };
}

export function updateTeacherData(
  teacherId: string,
  data: {
    fullName?: string;
    subject?: string;
    username?: string;
    email?: string;
    academicYear?: string;
    password?: string;
    status?: 'active' | 'pending' | 'inactive';
  },
  requesterRole?: string
) {
  if (requesterRole && requesterRole !== 'admin' && requesterRole !== 'director') {
    throw new Error('غير مصرح لك بتعديل بيانات الأساتذة');
  }

  const user = findUserById(teacherId);
  if (!user) {
    throw new Error('الأستاذ غير موجود');
  }
  if (user.role === 'admin') {
    throw new Error('لا يمكن تعديل بيانات المشرف العام من هنا');
  }
  if (user.role === 'director') {
    throw new Error('لا يمكن تعديل بيانات مدير المؤسسة من مسار الأساتذة');
  }
  if (user.role !== 'teacher') {
    throw new Error('هذه الوظيفة مخصصة لتعديل بيانات الأساتذة فقط');
  }

  const now = new Date().toISOString();

  if (data.fullName !== undefined && data.fullName.trim()) {
    db.prepare('UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?').run(data.fullName.trim(), now, teacherId);
    db.prepare('UPDATE sections SET teacher = ?, updated_at = ? WHERE assigned_teacher_id = ?').run(data.fullName.trim(), now, teacherId);
  }

  if (data.subject !== undefined && data.subject.trim()) {
    db.prepare('UPDATE users SET subject = ?, updated_at = ? WHERE id = ?').run(data.subject.trim(), now, teacherId);
  }

  if (data.username !== undefined && data.username.trim()) {
    const cleanUsername = data.username.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?').get(cleanUsername, teacherId);
    if (existing) {
      throw new Error('اسم المستخدم هذا مستعمل بالفعل، يرجى اختيار اسم مستخدم آخر');
    }
    db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?').run(cleanUsername, now, teacherId);
  }

  if (data.email !== undefined && data.email.trim()) {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(cleanEmail, teacherId);
    if (existing) {
      throw new Error('هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
    }
    db.prepare('UPDATE users SET email = ?, updated_at = ? WHERE id = ?').run(cleanEmail, now, teacherId);
  }

  if (data.academicYear !== undefined && data.academicYear.trim()) {
    db.prepare('UPDATE users SET academic_year = ?, updated_at = ? WHERE id = ?').run(data.academicYear.trim(), now, teacherId);
  }

  if (data.password !== undefined && data.password.trim()) {
    if (data.password.trim().length < 4) {
      throw new Error('كلمة المرور يجب أن لا تقل عن 4 خانات');
    }
    db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').run(data.password.trim(), now, teacherId);
  }

  if (data.status !== undefined && ['active', 'pending', 'inactive'].includes(data.status)) {
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(data.status, now, teacherId);
  }

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'update_teacher_data',
    `تعديل بيانات الأستاذ: ${data.fullName || user.fullName} (${user.email})`,
    JSON.stringify({ teacherId, updates: data }),
    now
  );

  return findUserById(teacherId);
}

export function getDirectorAnalytics() {
  // 1. Top 10 Violations
  const violationRows = db.prepare(`
    WITH AllViolationsCombined AS (
      SELECT 
        dv.section_id, 
        dv.seat_num, 
        dv.id as viol_id, 
        dv.violation_type as viol_text, 
        dv.recorded_date as viol_date, 
        dv.created_at
      FROM daily_violations dv
    )
    SELECT 
      s.section_id,
      s.seat_num,
      s.student_name,
      s.student_number,
      s.massar_number,
      sec.level as section_level,
      sec.class_number as section_class,
      u.full_name as teacher_name,
      u.subject as teacher_subject,
      COUNT(v.viol_id) as violations_count,
      (
        SELECT v2.viol_text 
        FROM AllViolationsCombined v2 
        WHERE v2.section_id = s.section_id AND v2.seat_num = s.seat_num 
        ORDER BY v2.created_at DESC LIMIT 1
      ) as last_note_text,
      (
        SELECT v2.viol_date 
        FROM AllViolationsCombined v2 
        WHERE v2.section_id = s.section_id AND v2.seat_num = s.seat_num 
        ORDER BY v2.created_at DESC LIMIT 1
      ) as last_note_date
    FROM AllViolationsCombined v
    JOIN seats s ON v.section_id = s.section_id AND v.seat_num = s.seat_num
    JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN users u ON sec.assigned_teacher_id = u.id
    WHERE s.student_name IS NOT NULL AND TRIM(s.student_name) != ''
    GROUP BY s.section_id, s.seat_num, s.student_name, s.student_number, s.massar_number, sec.level, sec.class_number, u.full_name, u.subject
    HAVING violations_count > 0
    ORDER BY violations_count DESC, s.student_name ASC
    LIMIT 10
  `).all() as any[];

  // 2. Top 10 Absences (Accurate calculation without double counting)
  const todayIso = new Date().toISOString().split('T')[0];
  const todayFr = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`;

  const absenceRows = db.prepare(`
    WITH CombinedAbsences AS (
      SELECT 
        s.section_id,
        s.seat_num,
        s.student_name,
        s.student_number,
        s.massar_number,
        sec.level as section_level,
        sec.class_number as section_class,
        u.full_name as teacher_name,
        u.subject as teacher_subject,
        COALESCE(ah.hist_count, 0) + CASE 
          WHEN s.attendance = 'absent' AND NOT EXISTS (
            SELECT 1 FROM attendance_history ah2 
            WHERE ah2.section_id = s.section_id AND ah2.seat_num = s.seat_num 
            AND (ah2.recorded_date = '${todayIso}' OR ah2.recorded_date = '${todayFr}') AND ah2.status = 'absent' AND COALESCE(ah2.count_in_stats, 1) = 1
          ) THEN 1 
          ELSE 0 
        END as total_absences,
        s.attendance as current_attendance
      FROM seats s
      JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN users u ON sec.assigned_teacher_id = u.id
      LEFT JOIN (
        SELECT section_id, seat_num, COUNT(*) as hist_count
        FROM attendance_history
        WHERE status = 'absent' AND COALESCE(count_in_stats, 1) = 1
        GROUP BY section_id, seat_num
      ) ah ON ah.section_id = s.section_id AND ah.seat_num = s.seat_num
      WHERE s.student_name IS NOT NULL AND TRIM(s.student_name) != ''
    )
    SELECT *
    FROM CombinedAbsences
    WHERE total_absences > 0
    ORDER BY total_absences DESC, student_name ASC
    LIMIT 10
  `).all() as any[];

  // 3. All Students Directory
  const allStudentsRows = db.prepare(`
    SELECT 
      s.section_id,
      s.seat_num,
      s.student_name,
      s.student_number,
      s.massar_number,
      s.attendance as current_attendance,
      s.status_color,
      sec.level as section_level,
      sec.class_number as section_class,
      u.full_name as teacher_name,
      u.subject as teacher_subject,
      COALESCE(nc.viols_count, 0) as violations_count,
      COALESCE(ah.hist_count, 0) + CASE 
        WHEN s.attendance = 'absent' AND NOT EXISTS (
          SELECT 1 FROM attendance_history ah2 
          WHERE ah2.section_id = s.section_id AND ah2.seat_num = s.seat_num 
          AND (ah2.recorded_date = '${todayIso}' OR ah2.recorded_date = '${todayFr}') AND ah2.status = 'absent'
        ) THEN 1 
        ELSE 0 
      END as absences_count
    FROM seats s
    JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN users u ON sec.assigned_teacher_id = u.id
    LEFT JOIN (
      SELECT section_id, seat_num, COUNT(*) as viols_count
      FROM daily_violations
      GROUP BY section_id, seat_num
    ) nc ON nc.section_id = s.section_id AND nc.seat_num = s.seat_num
    LEFT JOIN (
      SELECT section_id, seat_num, COUNT(*) as hist_count
      FROM attendance_history
      WHERE status = 'absent' AND COALESCE(count_in_stats, 1) = 1
      GROUP BY section_id, seat_num
    ) ah ON ah.section_id = s.section_id AND ah.seat_num = s.seat_num
    WHERE s.student_name IS NOT NULL AND TRIM(s.student_name) != ''
    ORDER BY sec.level ASC, sec.class_number ASC, CAST(s.student_number AS INTEGER) ASC, s.seat_num ASC
  `).all() as any[];

  // 4. All violations detailed list for comprehensive printing & filtering
  const allViolations = db.prepare(`
    SELECT 
      dv.id,
      dv.section_id as sectionId,
      sec.level as level,
      sec.class_number as classNumber,
      sec.level || ' (' || sec.class_number || ')' as sectionName,
      dv.student_name as studentName,
      dv.student_number as studentNumber,
      dv.massar_number as massarNumber,
      dv.violation_type as violationType,
      dv.recorded_date as date,
      dv.recorded_time as time,
      dv.teacher_name as teacherName,
      dv.teacher_subject as teacherSubject,
      dv.action_taken as actionTaken,
      dv.description as notes
    FROM daily_violations dv
    LEFT JOIN sections sec ON dv.section_id = sec.id
    ORDER BY date DESC, time DESC
  `).all() as any[];

  // 5. All absences detailed list for comprehensive printing & filtering
  const allAbsences = db.prepare(`
    SELECT
      ah.id,
      ah.section_id as sectionId,
      sec.level as level,
      sec.class_number as classNumber,
      sec.level || ' (' || sec.class_number || ')' as sectionName,
      ah.student_name as studentName,
      ah.student_number as studentNumber,
      COALESCE(s.massar_number, '') as massarNumber,
      ah.status as status,
      ah.recorded_date as date,
      '' as time,
      ah.session_period as session,
      ah.teacher_name as teacherName,
      ah.teacher_subject as subject,
      CASE WHEN ah.justified = 'justified' THEN 1 ELSE 0 END as isJustified,
      ah.justification_reason as justificationReason
    FROM attendance_history ah
    LEFT JOIN sections sec ON ah.section_id = sec.id
    LEFT JOIN seats s ON ah.section_id = s.section_id AND ah.seat_num = s.seat_num
    ORDER BY ah.recorded_date DESC, ah.created_at DESC
  `).all() as any[];

  // Summary
  const totalStudents = allStudentsRows.length;
  const totalTeachers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'").get() as any).count;
  const totalSections = (db.prepare('SELECT COUNT(*) as count FROM sections').get() as any).count;
  const notesCount = (db.prepare('SELECT COUNT(*) as count FROM notes').get() as any).count;
  const dailyViolationsCount = (db.prepare('SELECT COUNT(*) as count FROM daily_violations').get() as any).count;
  const totalViolations = dailyViolationsCount;
  
  // Accurately count absences without double counting
  const historyAbsences = (db.prepare("SELECT COUNT(*) as count FROM attendance_history WHERE status = 'absent' AND COALESCE(count_in_stats, 1) = 1").get() as any).count;
  const unrecordedSeatAbsences = (db.prepare(`
    SELECT COUNT(*) as count FROM seats s
    WHERE s.attendance = 'absent'
    AND s.student_name IS NOT NULL AND TRIM(s.student_name) != ''
    AND NOT EXISTS (
      SELECT 1 FROM attendance_history ah 
      WHERE ah.section_id = s.section_id AND ah.seat_num = s.seat_num 
      AND (ah.recorded_date = ? OR ah.recorded_date = ?) AND ah.status = 'absent' AND COALESCE(ah.count_in_stats, 1) = 1
    )
  `).get(todayIso, todayFr) as any).count;

  const totalAbsences = historyAbsences + unrecordedSeatAbsences;

  return {
    topViolations: violationRows.map((r) => ({
      sectionId: r.section_id,
      seatNum: r.seat_num,
      studentName: r.student_name,
      studentNumber: r.student_number || '',
      massarNumber: r.massar_number || '',
      sectionLevel: r.section_level,
      sectionClass: r.section_class,
      teacherName: r.teacher_name || 'غير محدد',
      teacherSubject: r.teacher_subject || 'عام',
      violationsCount: Number(r.violations_count || 0),
      lastViolationText: r.last_note_text || '',
      lastViolationDate: r.last_note_date || ''
    })),
    topAbsences: absenceRows.map((r) => ({
      sectionId: r.section_id,
      seatNum: r.seat_num,
      studentName: r.student_name,
      studentNumber: r.student_number || '',
      massarNumber: r.massar_number || '',
      sectionLevel: r.section_level,
      sectionClass: r.section_class,
      teacherName: r.teacher_name || 'غير محدد',
      teacherSubject: r.teacher_subject || 'عام',
      absencesCount: Number(r.total_absences || 0),
      currentAttendance: r.current_attendance || null
    })),
    allStudents: allStudentsRows.map((r) => ({
      sectionId: r.section_id,
      seatNum: r.seat_num,
      studentName: r.student_name,
      studentNumber: r.student_number || '',
      massarNumber: r.massar_number || '',
      sectionLevel: r.section_level,
      sectionClass: r.section_class,
      teacherName: r.teacher_name || 'غير محدد',
      teacherSubject: r.teacher_subject || 'عام',
      violationsCount: Number(r.violations_count || 0),
      absencesCount: Number(r.absences_count || 0),
      currentAttendance: r.current_attendance || null,
      statusColor: r.status_color || 'default'
    })),
    allViolations,
    allAbsences,
    summary: {
      totalStudents,
      totalTeachers,
      totalSections,
      totalViolations,
      totalAbsences
    }
  };
}

export function getSchoolActivities(userId?: string, userRole?: string) {
  let rows: any[] = [];
  if (userRole === 'admin') {
    // Director/Admin sees all activities including pending ones
    rows = db.prepare(`SELECT * FROM school_activities ORDER BY created_at DESC`).all();
  } else if (userId) {
    // Teacher sees all approved activities + their own pending/rejected ones
    rows = db.prepare(`
      SELECT * FROM school_activities 
      WHERE status = 'approved' OR author_id = ? 
      ORDER BY created_at DESC
    `).all(userId);
  } else {
    // Public visitor sees only approved activities
    rows = db.prepare(`
      SELECT * FROM school_activities 
      WHERE status = 'approved' 
      ORDER BY created_at DESC
    `).all();
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description || '',
    category: r.category || 'أنشطة عامة',
    imageUrl: r.image_url || '',
    authorId: r.author_id,
    authorName: r.author_name,
    authorRole: r.author_role,
    authorSubject: r.author_subject || '',
    status: r.status,
    likesCount: Number(r.likes_count || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export function createSchoolActivity(data: {
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  authorRole: 'admin' | 'director' | 'teacher';
  authorSubject?: string;
}) {
  const id = 'act_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  
  // Rule: Posts submitted by Director or Admin are automatically approved.
  // Posts submitted by Teachers are pending until approved by the Director!
  const status = (data.authorRole === 'admin' || data.authorRole === 'director') ? 'approved' : 'pending';

  db.prepare(`
    INSERT INTO school_activities (
      id, title, description, category, image_url,
      author_id, author_name, author_role, author_subject,
      status, likes_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id,
    data.title,
    data.description || '',
    data.category || 'أنشطة عامة',
    data.imageUrl || '',
    data.authorId,
    data.authorName,
    data.authorRole,
    data.authorSubject || '',
    status,
    now,
    now
  );

  const row = db.prepare(`SELECT * FROM school_activities WHERE id = ?`).get(id) as any;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    imageUrl: row.image_url,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    authorSubject: row.author_subject,
    status: row.status,
    likesCount: Number(row.likes_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function updateSchoolActivityStatus(id: string, status: 'approved' | 'rejected') {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE school_activities 
    SET status = ?, updated_at = ? 
    WHERE id = ?
  `).run(status, now, id);

  const row = db.prepare(`SELECT * FROM school_activities WHERE id = ?`).get(id) as any;
  if (!row) return null;

  // Send email notification to teacher if they have an email
  if (row.author_id && row.author_role === 'teacher') {
    const author = db.prepare('SELECT email, full_name FROM users WHERE id = ?').get(row.author_id) as any;
    if (author && author.email) {
      const emailId = 'em_act_' + Date.now().toString(36);
      const emailSubj = status === 'approved'
        ? `تمت الموافقة على نشر نشاطكم المدرسي: "${row.title}"`
        : `بشأن مقترح النشاط المدرسي: "${row.title}"`;
      const emailBody = status === 'approved'
        ? `مرحباً أستاذ(ة) ${author.full_name}،\n\nيسر إدارة المؤسسة إعلامك بأنه قد تمت مراجعة نشاطكم المدرسي المعنون بـ "${row.title}" والموافقة على نشره في جدار أنشطة المؤسسة ليطلع عليه الجميع.\n\nشكراً لمبادرتكم وإسهامكم في إشعاع المؤسسة.`
        : `مرحباً أستاذ(ة) ${author.full_name}،\n\nنود إعلامك بأن مقترح النشاط المدرسي "${row.title}" لم تتم الموافقة على نشره في الوقت الحالي.\nيرجى التواصل مع إدارة المؤسسة لمزيد من التفاصيل.`;

      db.prepare(`
        INSERT INTO email_outbox (id, to_email, subject, body, type, token, sent_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?)
      `).run(
        emailId,
        author.email,
        emailSubj,
        emailBody,
        status === 'approved' ? 'activity_approved' : 'activity_rejected',
        now
      );
    }
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    imageUrl: row.image_url,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    authorSubject: row.author_subject,
    status: row.status,
    likesCount: Number(row.likes_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function deleteSchoolActivity(id: string, userId?: string, userRole?: string) {
  if (userRole === 'admin' || userRole === 'director') {
    db.prepare(`DELETE FROM school_activities WHERE id = ?`).run(id);
    return true;
  } else if (userId) {
    db.prepare(`DELETE FROM school_activities WHERE id = ? AND author_id = ?`).run(id, userId);
    return true;
  }
  return false;
}

export function likeSchoolActivity(id: string) {
  db.prepare(`
    UPDATE school_activities 
    SET likes_count = likes_count + 1 
    WHERE id = ?
  `).run(id);

  const row = db.prepare(`SELECT * FROM school_activities WHERE id = ?`).get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    likesCount: Number(row.likes_count || 0)
  };
}

// -------------------------------------------------------------
// Director Management Functions (General Supervisor Only)
// -------------------------------------------------------------

export function getAllDirectors(requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin') {
    throw new Error('صلاحية مرفوضة: المشرف العام (Admin) فقط هو المخول بالاطلاع على قائمة مديري المؤسسة');
  }

  const rows = db.prepare(`
    SELECT id, username, email, full_name, role, academic_year, status, email_verified, must_change_profile, must_change_password, created_at
    FROM users
    WHERE role = 'director'
    ORDER BY created_at DESC
  `).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    academicYear: r.academic_year,
    status: r.status,
    emailVerified: Boolean(r.email_verified),
    mustChangePassword: Boolean(r.must_change_profile || r.must_change_password),
    mustChangeProfile: Boolean(r.must_change_profile || r.must_change_password),
    createdAt: r.created_at
  }));
}

export function createDirector(data: {
  username: string;
  email: string;
  password?: string;
  fullName: string;
  academicYear?: string;
  status?: 'active' | 'inactive';
}, requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin') {
    throw new Error('صلاحية مرفوضة: المشرف العام (Admin) فقط هو المخول بإضافة مدير مؤسسة جديد');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(data.username.trim(), data.email.trim().toLowerCase());
  if (existing) {
    throw new Error('اسم المستخدم أو البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
  }

  const id = 'usr_dir_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  const rawPassword = data.password || 'Director@2026';
  const status = data.status || 'active';

  db.prepare(`
    INSERT INTO users (id, username, email, password, full_name, role, academic_year, status, email_verified, must_change_profile, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'director', ?, ?, 1, 1, 1, ?, ?)
  `).run(
    id,
    data.username.trim(),
    data.email.trim().toLowerCase(),
    rawPassword,
    data.fullName.trim(),
    data.academicYear || '2026/2027',
    status,
    now,
    now
  );

  // Cloud Firestore Persistence Hook
  cloudSaveUser({
    id,
    username: data.username.trim(),
    email: data.email.trim().toLowerCase(),
    fullName: data.fullName.trim(),
    role: 'director',
    academicYear: data.academicYear || '2026/2027',
    status,
    emailVerified: true,
    createdAt: now,
    updatedAt: now
  });

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'create_director',
    `إضافة حساب مدير جديد: ${data.fullName} (${data.email}) من طرف المشرف العام`,
    JSON.stringify({ id, fullName: data.fullName, email: data.email, status }),
    now
  );

  return findUserById(id);
}

export function updateDirectorData(directorId: string, data: {
  fullName?: string;
  username?: string;
  email?: string;
  academicYear?: string;
  password?: string;
  status?: 'active' | 'inactive';
}, requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin') {
    throw new Error('صلاحية مرفوضة: المشرف العام (Admin) فقط هو المخول بتعديل بيانات أو استبدال مدير المؤسسة');
  }

  const user = findUserById(directorId);
  if (!user || user.role !== 'director') {
    throw new Error('حساب المدير غير موجود');
  }

  const now = new Date().toISOString();

  if (data.fullName !== undefined && data.fullName.trim()) {
    db.prepare('UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?').run(data.fullName.trim(), now, directorId);
  }

  if (data.username !== undefined && data.username.trim()) {
    const cleanUsername = data.username.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?').get(cleanUsername, directorId);
    if (existing) {
      throw new Error('اسم المستخدم هذا مستعمل بالفعل، يرجى اختيار اسم آخر');
    }
    db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?').run(cleanUsername, now, directorId);
  }

  if (data.email !== undefined && data.email.trim()) {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(cleanEmail, directorId);
    if (existing) {
      throw new Error('البريد الإلكتروني هذا مستعمل بالفعل لمستخدم آخر');
    }
    db.prepare('UPDATE users SET email = ?, updated_at = ? WHERE id = ?').run(cleanEmail, now, directorId);
  }

  if (data.academicYear !== undefined && data.academicYear.trim()) {
    db.prepare('UPDATE users SET academic_year = ?, updated_at = ? WHERE id = ?').run(data.academicYear.trim(), now, directorId);
  }

  if (data.password !== undefined && data.password.trim()) {
    if (data.password.trim().length < 4) {
      throw new Error('كلمة المرور يجب أن لا تقل عن 4 خانات');
    }
    db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').run(data.password.trim(), now, directorId);
  }

  if (data.status !== undefined && (data.status === 'active' || data.status === 'inactive')) {
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(data.status, now, directorId);
  }

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'update_director',
    `تعديل بيانات المدير: ${data.fullName || user.fullName} (${user.email}) من طرف المشرف العام`,
    JSON.stringify({ directorId, updates: data }),
    now
  );

  return findUserById(directorId);
}

export function updateDirectorStatus(directorId: string, status: 'active' | 'inactive', requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin') {
    throw new Error('صلاحية مرفوضة: المشرف العام (Admin) فقط هو المخول بتعديل حالة مدير المؤسسة');
  }

  const user = findUserById(directorId);
  if (!user || user.role !== 'director') {
    throw new Error('حساب المدير غير موجود');
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, now, directorId);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    status === 'active' ? 'activate_director' : 'deactivate_director',
    `${status === 'active' ? 'تفعيل' : 'تعطيل'} حساب المدير: ${user.fullName} (${user.email}) من طرف المشرف العام`,
    JSON.stringify({ directorId, fullName: user.fullName, email: user.email, status }),
    now
  );

  return findUserById(directorId);
}

export function adminResetDirectorPassword(directorId: string, newPass: string, requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin') {
    throw new Error('صلاحية مرفوضة: المشرف العام (Admin) فقط هو المخول بإعادة تعيين كلمة مرور مدير المؤسسة');
  }

  const user = findUserById(directorId);
  if (!user || user.role !== 'director') {
    throw new Error('حساب المدير غير موجود');
  }
  if (!newPass || newPass.trim().length < 4) {
    throw new Error('كلمة المرور يجب أن لا تقل عن 4 خانات');
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').run(newPass.trim(), now, directorId);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'reset_director_password',
    `إعادة تعيين كلمة مرور المدير: ${user.fullName} من طرف المشرف العام`,
    JSON.stringify({ directorId, fullName: user.fullName }),
    now
  );

  return { success: true, message: `تم تحديث كلمة المرور للمدير (${user.fullName}) بنجاح` };
}

export function deleteDirector(directorId: string, requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin') {
    throw new Error('صلاحية مرفوضة: المشرف العام (Admin) فقط هو المخول بحذف أو استبدال مدير المؤسسة');
  }

  const user = findUserById(directorId);
  if (!user) {
    throw new Error('المستخدم غير موجود');
  }
  if (user.role === 'admin') {
    throw new Error('حساب المشرف العام محمي ومحصن ولا يمكن حذفه أبداً');
  }
  if (user.role !== 'director') {
    throw new Error('هذا الحساب ليس حساب مدير مؤسسة');
  }

  const now = new Date().toISOString();
  db.prepare('DELETE FROM users WHERE id = ?').run(directorId);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'delete_director',
    `حذف حساب المدير: ${user.fullName} (${user.email}) من طرف المشرف العام`,
    JSON.stringify({ directorId, fullName: user.fullName, email: user.email }),
    now
  );

  return { success: true, message: `تم حذف حساب المدير (${user.fullName}) بنجاح` };
}

// ==========================================
// 15. DAILY ARCHIVE (أرشيف الغيابات والمخالفات اليومي)
// ==========================================

export function getDailyArchive(dateStr?: string, sectionId?: string, teacherId?: string) {
  const targetDate = dateStr && dateStr.trim() ? dateStr.trim() : new Date().toISOString().slice(0, 10);
  const sectionIds = sectionId && sectionId !== 'all'
    ? sectionId.split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  
  // Calculate date variants (both ISO YYYY-MM-DD and French DD/MM/YYYY)
  const dateSet = new Set<string>();
  dateSet.add(targetDate);
  if (targetDate.includes('-')) {
    const parts = targetDate.split('-');
    if (parts.length === 3) {
      dateSet.add(`${parts[2]}/${parts[1]}/${parts[0]}`);
    }
  } else if (targetDate.includes('/')) {
    const parts = targetDate.split('/');
    if (parts.length === 3) {
      dateSet.add(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    }
  }
  const dateList = Array.from(dateSet);
  const datePlaceholders = dateList.map(() => '?').join(', ');

  // 1. Absences Query for targetDate
  let absenceQuery = `
    SELECT ah.id, ah.section_id, ah.seat_num, ah.student_name, ah.student_number,
           s.massar_number,
           ah.status, ah.recorded_date, ah.session_period, ah.teacher_name, ah.teacher_subject,
           ah.justified, ah.justification_reason, ah.notes, ah.created_at,
           sec.level as section_level, sec.class_number as section_class
    FROM attendance_history ah
    JOIN sections sec ON ah.section_id = sec.id
    LEFT JOIN seats s ON ah.section_id = s.section_id AND ah.seat_num = s.seat_num
    WHERE ah.recorded_date IN (${datePlaceholders})
  `;
  const absenceParams: any[] = [...dateList];

  if (sectionIds.length > 0) {
    absenceQuery += ` AND ah.section_id IN (${sectionIds.map(() => '?').join(', ')})`;
    absenceParams.push(...sectionIds);
  }
  absenceQuery += ' ORDER BY sec.level ASC, sec.class_number ASC, ah.seat_num ASC';

  const absencesRows = db.prepare(absenceQuery).all(...absenceParams) as any[];

  // 2. Violations Query for targetDate (Only actual violations from daily_violations)
  let violWhere = `v.recorded_date IN (${datePlaceholders})`;
  const violParams: any[] = [...dateList];

  if (teacherId) {
    violWhere += ' AND v.teacher_id = ?';
    violParams.push(teacherId);
  }

  if (sectionIds.length > 0) {
    violWhere += ` AND v.section_id IN (${sectionIds.map(() => '?').join(', ')})`;
    violParams.push(...sectionIds);
  }

  const violQuery = `
    SELECT v.id, v.section_id, v.seat_num, v.student_name, v.student_number,
           COALESCE(s.massar_number, v.massar_number, '') as massar_number,
           v.violation_type, v.description, v.action_taken, v.teacher_name, v.teacher_subject,
           v.recorded_date, v.recorded_time, v.created_at,
           sec.level as section_level, sec.class_number as section_class
    FROM daily_violations v
    JOIN sections sec ON v.section_id = sec.id
    LEFT JOIN seats s ON v.section_id = s.section_id AND v.seat_num = s.seat_num
    WHERE ${violWhere}
    ORDER BY v.recorded_time DESC, v.created_at DESC
  `;

  const violationsRows = db.prepare(violQuery).all(...violParams) as any[];

  // 3. Available Dates in History (past 120 days that contain records)
  const dateRows = db.prepare(`
    SELECT DISTINCT recorded_date FROM attendance_history
    UNION
    SELECT DISTINCT recorded_date FROM daily_violations
    ORDER BY recorded_date DESC
    LIMIT 120
  `).all() as { recorded_date: string }[];

  const availableDatesSet = new Set<string>();
  availableDatesSet.add(targetDate);
  for (const r of dateRows) {
    if (r.recorded_date) availableDatesSet.add(r.recorded_date);
  }
  const availableDates = Array.from(availableDatesSet).filter(Boolean).sort().reverse();

  // 4. Statistics Calculation
  const totalAbsences = absencesRows.filter(a => a.status === 'absent').length;
  const totalLates = absencesRows.filter(a => a.status === 'late').length;
  const totalViolations = violationsRows.length;
  const justifiedCount = absencesRows.filter(a => a.justified && a.justified !== 'unjustified').length;
  const unjustifiedCount = absencesRows.filter(a => !a.justified || a.justified === 'unjustified').length;

  const sectionIdsSet = new Set<string>();
  absencesRows.forEach(a => sectionIdsSet.add(a.section_id));
  violationsRows.forEach(v => sectionIdsSet.add(v.section_id));

  const sectionAbsenceCounts: Record<string, number> = {};
  absencesRows.forEach(a => {
    const key = `${a.section_level || ''} (${a.section_class || ''})`;
    sectionAbsenceCounts[key] = (sectionAbsenceCounts[key] || 0) + 1;
  });

  let topSectionAbsences = 'لا يوجد';
  let maxAbsences = 0;
  for (const [secName, count] of Object.entries(sectionAbsenceCounts)) {
    if (count > maxAbsences) {
      maxAbsences = count;
      topSectionAbsences = `${secName} (${count} غيابات)`;
    }
  }

  return {
    date: targetDate,
    absences: absencesRows.map(r => ({
      id: r.id,
      sectionId: r.section_id,
      sectionLevel: r.section_level,
      sectionClass: r.section_class,
      seatNum: r.seat_num,
      studentName: r.student_name,
      studentNumber: r.student_number || '',
      massarNumber: r.massar_number || '',
      status: r.status || 'absent',
      recordedDate: r.recorded_date,
      sessionPeriod: r.session_period || 'كامل اليوم',
      teacherName: r.teacher_name || '',
      teacherSubject: r.teacher_subject || '',
      justified: r.justified || 'unjustified',
      justificationReason: r.justification_reason || '',
      notes: r.notes || '',
      createdAt: r.created_at
    })),
    violations: violationsRows.map(r => ({
      id: r.id,
      sectionId: r.section_id,
      sectionLevel: r.section_level,
      sectionClass: r.section_class,
      seatNum: r.seat_num,
      studentName: r.student_name,
      studentNumber: r.student_number || '',
      massarNumber: r.massar_number || '',
      violationType: r.violation_type,
      description: r.description,
      actionTaken: r.action_taken || 'تنبيه شفهي',
      teacherName: r.teacher_name || '',
      teacherSubject: r.teacher_subject || '',
      recordedDate: r.recorded_date,
      recordedTime: r.recorded_time,
      createdAt: r.created_at
    })),
    stats: {
      totalAbsences,
      totalLates,
      totalViolations,
      justifiedCount,
      unjustifiedCount,
      sectionsAffected: sectionIdsSet.size,
      topSectionAbsences
    },
    availableDates
  };
}

export function getStudentHistory(sectionId: string, seatNum: number) {
  const absences = db.prepare(`
    SELECT id, status, recorded_date, session_period, teacher_name, teacher_subject,
           justified, justification_reason, notes, created_at
    FROM attendance_history
    WHERE section_id = ? AND seat_num = ?
    ORDER BY recorded_date DESC, created_at DESC
  `).all(sectionId, seatNum) as any[];

  const violations = db.prepare(`
    SELECT id, violation_type, description, action_taken, teacher_name,
           teacher_subject, recorded_date, recorded_time, created_at
    FROM daily_violations
    WHERE section_id = ? AND seat_num = ?
    ORDER BY recorded_date DESC, recorded_time DESC, created_at DESC
  `).all(sectionId, seatNum) as any[];

  const days = Array.from(new Set(
    absences
      .filter((absence) => absence.status === 'absent')
      .map((absence) => absence.recorded_date)
      .filter(Boolean)
  ));

  return {
    absences: absences.map((absence) => ({
      id: absence.id,
      status: absence.status,
      recordedDate: absence.recorded_date,
      sessionPeriod: absence.session_period || 'كامل اليوم',
      teacherName: absence.teacher_name || '',
      teacherSubject: absence.teacher_subject || '',
      justified: absence.justified || 'unjustified',
      justificationReason: absence.justification_reason || '',
      notes: absence.notes || '',
      createdAt: absence.created_at
    })),
    absenceDays: days,
    absenceRecordCount: absences.filter((absence) => absence.status === 'absent').length,
    violations: violations.map((violation) => ({
      id: violation.id,
      violationType: violation.violation_type,
      description: violation.description,
      actionTaken: violation.action_taken || 'تنبيه شفهي',
      teacherName: violation.teacher_name || '',
      teacherSubject: violation.teacher_subject || '',
      recordedDate: violation.recorded_date,
      recordedTime: violation.recorded_time || '',
      createdAt: violation.created_at
    }))
  };
}

export function addDailyAbsence(data: {
  sectionId: string;
  seatNum?: number;
  studentName: string;
  studentNumber?: string;
  status?: 'absent' | 'late';
  recordedDate?: string;
  sessionPeriod?: string;
  teacherName?: string;
  teacherSubject?: string;
  justified?: string;
  justificationReason?: string;
  notes?: string;
}) {
  const now = new Date().toISOString();
  const date = data.recordedDate && data.recordedDate.trim() ? data.recordedDate.trim() : now.slice(0, 10);
  const status = data.status || 'absent';
  const seatNum = data.seatNum || 0;

  let teacherName = data.teacherName || '';
  let teacherSubject = data.teacherSubject || '';
  if (!teacherName) {
    const sec = db.prepare(`
      SELECT sec.assigned_teacher_id, u.full_name, u.subject
      FROM sections sec
      LEFT JOIN users u ON sec.assigned_teacher_id = u.id
      WHERE sec.id = ?
    `).get(data.sectionId) as any;
    if (sec) {
      teacherName = sec.full_name || '';
      teacherSubject = sec.subject || '';
    }
  }

  const res = db.prepare(`
    INSERT INTO attendance_history (
      section_id, seat_num, student_name, student_number,
      status, recorded_date, session_period, teacher_name, teacher_subject,
      justified, justification_reason, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.sectionId,
    seatNum,
    data.studentName.trim(),
    (data.studentNumber || '').trim(),
    status,
    date,
    data.sessionPeriod || 'كامل اليوم',
    teacherName,
    teacherSubject,
    data.justified || 'unjustified',
    (data.justificationReason || '').trim(),
    (data.notes || '').trim(),
    now
  );

  return { success: true, id: res.lastInsertRowid };
}

export function updateDailyAbsence(id: number, data: {
  status?: 'absent' | 'late';
  sessionPeriod?: string;
  justified?: string;
  justificationReason?: string;
  notes?: string;
}) {
  const existing = db.prepare('SELECT * FROM attendance_history WHERE id = ?').get(id) as any;
  if (!existing) throw new Error('سجل الغياب غير موجود');

  const status = data.status || existing.status;
  const sessionPeriod = data.sessionPeriod !== undefined ? data.sessionPeriod : existing.session_period;
  const justified = data.justified !== undefined ? data.justified : existing.justified;
  const justificationReason = data.justificationReason !== undefined ? data.justificationReason : existing.justification_reason;
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  db.prepare(`
    UPDATE attendance_history SET
      status = ?,
      session_period = ?,
      justified = ?,
      justification_reason = ?,
      notes = ?
    WHERE id = ?
  `).run(status, sessionPeriod, justified, justificationReason, notes, id);

  return { success: true };
}

export function deleteDailyAbsence(id: number) {
  db.prepare('DELETE FROM attendance_history WHERE id = ?').run(id);
  return { success: true };
}

export function addDailyViolation(data: {
  sectionId: string;
  seatNum?: number;
  studentName: string;
  studentNumber?: string;
  violationType: string;
  description: string;
  actionTaken?: string;
  teacherName?: string;
  teacherSubject?: string;
  recordedDate?: string;
  recordedTime?: string;
  teacherId?: string;
}) {
  const id = 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  const date = data.recordedDate && data.recordedDate.trim() ? data.recordedDate.trim() : now.slice(0, 10);
  const time = data.recordedTime || new Date().toLocaleTimeString('ar-MA', { hour12: false, hour: '2-digit', minute: '2-digit' }) || '08:30';

  let teacherName = data.teacherName || '';
  let teacherSubject = data.teacherSubject || '';
  if (!teacherName) {
    const sec = db.prepare(`
      SELECT sec.assigned_teacher_id, u.full_name, u.subject
      FROM sections sec
      LEFT JOIN users u ON sec.assigned_teacher_id = u.id
      WHERE sec.id = ?
    `).get(data.sectionId) as any;
    if (sec) {
      teacherName = sec.full_name || '';
      teacherSubject = sec.subject || '';
    }
  }

  db.prepare(`
    INSERT INTO daily_violations (
      id, section_id, seat_num, student_name, student_number,
      violation_type, description, action_taken, teacher_name, teacher_subject,
      recorded_date, recorded_time, created_at, teacher_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.sectionId,
    data.seatNum || null,
    data.studentName.trim(),
    (data.studentNumber || '').trim(),
    data.violationType || 'مخالفة تربوية أخرى',
    data.description.trim(),
    data.actionTaken || 'تنبيه شفهي',
    teacherName,
    teacherSubject,
    date,
    time,
    now,
    data.teacherId || ''
  );

  return { success: true, id };
}

export function updateDailyViolation(id: string, data: {
  violationType?: string;
  description?: string;
  actionTaken?: string;
  recordedDate?: string;
  recordedTime?: string;
}) {
  const existing = db.prepare('SELECT * FROM daily_violations WHERE id = ?').get(id) as any;
  if (!existing) throw new Error('سجل المخالفة غير موجود');

  const violationType = data.violationType || existing.violation_type;
  const description = data.description !== undefined ? data.description : existing.description;
  const actionTaken = data.actionTaken !== undefined ? data.actionTaken : existing.action_taken;
  const recordedDate = data.recordedDate || existing.recorded_date;
  const recordedTime = data.recordedTime || existing.recorded_time;

  db.prepare(`
    UPDATE daily_violations SET
      violation_type = ?,
      description = ?,
      action_taken = ?,
      recorded_date = ?,
      recorded_time = ?
    WHERE id = ?
  `).run(violationType, description, actionTaken, recordedDate, recordedTime, id);

  return { success: true };
}

export function deleteDailyViolation(id: string) {
  db.prepare('DELETE FROM daily_violations WHERE id = ?').run(id);
  return { success: true };
}

// ==========================================
// 13. ACADEMIC YEARS MANAGEMENT (تدبير المواسم الدراسية)
// ==========================================

export function getAllAcademicYears() {
  const rows = db.prepare(`
    SELECT * FROM academic_years
    ORDER BY start_date DESC
  `).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    isCurrent: Boolean(r.is_current),
    isArchived: Boolean(r.is_archived),
    notes: r.notes || '',
    createdAt: r.created_at,
    archivedAt: r.archived_at || null
  }));
}

export function createAcademicYear(data: {
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  notes?: string;
}) {
  const cleanName = (data.name || '').trim();
  if (!cleanName) {
    throw new Error('اسم الموسم الدراسي مطلوب (مثال: 2026/2027)');
  }

  const existing = db.prepare('SELECT id FROM academic_years WHERE name = ?').get(cleanName);
  if (existing) {
    throw new Error(`الموسم الدراسي (${cleanName}) مسجل بالفعل`);
  }

  // Calculate default dates: 1 September of start year, 30 July of next year
  // (الموسم الدراسي يبدأ يوم 1 شتنبر وينتهي يوم 30 يوليوز من العام الموالي)
  let computedStart = data.startDate?.trim();
  let computedEnd = data.endDate?.trim();

  if (!computedStart || !computedEnd) {
    const parts = cleanName.split(/[\/\-_]/);
    const startYear = parseInt(parts[0], 10);
    if (!isNaN(startYear) && startYear >= 2000 && startYear <= 2100) {
      if (!computedStart) computedStart = `${startYear}-09-01`;
      if (!computedEnd) computedEnd = `${startYear + 1}-07-30`;
    } else {
      if (!computedStart) computedStart = '2026-09-01';
      if (!computedEnd) computedEnd = '2027-07-30';
    }
  }

  const id = 'ay_' + Date.now().toString(36);
  const now = new Date().toISOString();
  const isCurrent = data.isCurrent ? 1 : 0;

  if (isCurrent === 1) {
    db.prepare('UPDATE academic_years SET is_current = 0').run();
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('year', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `).run(cleanName, now, cleanName, now);

    // Also update users
    try {
      db.prepare('UPDATE users SET academic_year = ?').run(cleanName);
    } catch {
      // Ignore
    }
  }

  db.prepare(`
    INSERT INTO academic_years (id, name, start_date, end_date, is_current, is_archived, notes, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, cleanName, computedStart, computedEnd, isCurrent, data.notes || '', now);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'create_academic_year',
    `إضافة موسم دراسي جديد: ${cleanName} (يبدأ في 1 شتنبر وينتهي في 30 يوليوز)`,
    JSON.stringify({ id, name: cleanName, startDate: computedStart, endDate: computedEnd, isCurrent }),
    now
  );

  return getAllAcademicYears();
}

export function setCurrentAcademicYear(yearId: string) {
  const row = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(yearId) as any;
  if (!row) {
    throw new Error('الموسم الدراسي غير موجود');
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE academic_years SET is_current = 0').run();
  db.prepare('UPDATE academic_years SET is_current = 1 WHERE id = ?').run(yearId);

  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES ('year', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
  `).run(row.name, now, row.name, now);

  // Update default academic year for users
  try {
    db.prepare('UPDATE users SET academic_year = ?').run(row.name);
  } catch {
    // Ignore
  }

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'set_current_academic_year',
    `تحديد الموسم الدراسي النشط: ${row.name}`,
    JSON.stringify({ id: yearId, name: row.name }),
    now
  );

  return getAllAcademicYears();
}

export function archiveAcademicYear(yearId: string) {
  const row = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(yearId) as any;
  if (!row) {
    throw new Error('الموسم الدراسي غير موجود');
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE academic_years SET is_archived = 1, archived_at = ? WHERE id = ?').run(now, yearId);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'archive_academic_year',
    `أرشفة الموسم الدراسي: ${row.name} عند انتهائه`,
    JSON.stringify({ id: yearId, name: row.name }),
    now
  );

  return getAllAcademicYears();
}

export function unarchiveAcademicYear(yearId: string) {
  const row = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(yearId) as any;
  if (!row) {
    throw new Error('الموسم الدراسي غير موجود');
  }

  db.prepare('UPDATE academic_years SET is_archived = 0, archived_at = NULL WHERE id = ?').run(yearId);

  return getAllAcademicYears();
}

export function deleteAcademicYear(yearId: string) {
  const row = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(yearId) as any;
  if (!row) {
    throw new Error('الموسم الدراسي غير موجود');
  }
  if (row.is_current) {
    throw new Error('لا يمكن حذف الموسم الدراسي الجاري حالياً. يرجى تعيين موسم آخر أولاً.');
  }

  const now = new Date().toISOString();
  db.prepare('DELETE FROM academic_years WHERE id = ?').run(yearId);

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'delete_academic_year',
    `حذف الموسم الدراسي: ${row.name}`,
    JSON.stringify({ id: yearId, name: row.name }),
    now
  );

  return getAllAcademicYears();
}

export async function resetAllDataToZero(requesterRole: string = 'admin') {
  if (requesterRole !== 'admin') {
    throw new Error('غير مصرح لك بتصفير البيانات، هذه الصلاحية حصراً للمشرف العام على التطبيق.');
  }

  // 1. Collect IDs for Cloud sync
  const sectionsToDelete = db.prepare('SELECT id FROM sections').all() as { id: string }[];
  const usersToDelete = db.prepare("SELECT id FROM users WHERE role != 'admin' AND username != 'admin' AND email NOT LIKE '%samir%'").all() as { id: string }[];

  // 2. Clear transactional/operational tables in SQLite
  db.prepare('DELETE FROM seats').run();
  db.prepare('DELETE FROM notes').run();
  db.prepare('DELETE FROM daily_violations').run();
  db.prepare('DELETE FROM attendance_history').run();
  db.prepare('DELETE FROM teacher_seat_overrides').run();
  db.prepare('DELETE FROM section_assignments').run();
  db.prepare('DELETE FROM student_change_requests').run();
  db.prepare('DELETE FROM school_activities').run();
  db.prepare('DELETE FROM teacher_timetable').run();
  db.prepare('DELETE FROM sections').run();
  db.prepare('DELETE FROM change_history').run();
  db.prepare('DELETE FROM password_resets').run();
  db.prepare('DELETE FROM email_outbox').run();

  // 3. Remove non-admin users
  for (const u of usersToDelete) {
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    try {
      cloudDeleteUser(u.id);
    } catch {
      // ignore
    }
  }

  for (const s of sectionsToDelete) {
    try {
      cloudDeleteSection(s.id);
    } catch {
      // ignore
    }
  }

  // 4. Mark data reset completed in app_settings
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('data_reset_completed', 'true', ?)
    ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = ?
  `).run(now, now);

  try {
    cloudSaveSetting('data_reset_completed', 'true');
  } catch {
    // ignore
  }

  // 5. Cloud Firestore direct cleanup
  try {
    const { listDocs, deleteDoc, setDoc } = await import('./firestoreService.ts');
    const collectionsToClean = [
      'sections',
      'seats',
      'notes',
      'daily_violations',
      'teacher_seat_overrides',
      'attendance_history',
      'section_assignments',
      'student_change_requests',
      'school_activities',
      'teacher_timetable',
      'db_snapshots',
      'db_snapshot_chunks'
    ];
    for (const col of collectionsToClean) {
      try {
        const docs = await listDocs(col);
        if (Array.isArray(docs)) {
          for (const d of docs) {
            if (d.id) {
              await deleteDoc(col, d.id);
            }
          }
        }
      } catch (colErr: any) {
        console.warn(`[resetAllDataToZero] Note while cleaning collection ${col}:`, colErr?.message);
      }
    }

    // Clean non-admin users from Firestore
    try {
      const allUsers = await listDocs('users');
      if (Array.isArray(allUsers)) {
        for (const u of allUsers) {
          const isSuperAdmin = u.role === 'admin' || u.username === 'admin' || (u.email && u.email.includes('samir')) || u.id === 'usr_admin_samir';
          if (!isSuperAdmin && u.id) {
            await deleteDoc('users', u.id);
          }
        }
      }
    } catch (usersErr: any) {
      console.warn('[resetAllDataToZero] Error cleaning non-admin users from Firestore:', usersErr?.message);
    }
  } catch (cleanErr: any) {
    console.warn('[resetAllDataToZero] Cloud cleanup warning:', cleanErr?.message);
  }

  // 6. Record change log
  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'reset_all_data_to_zero',
    'إرجاع كل معطيات النظام إلى الصفر مع الإبقاء على حساب المشرف العام',
    JSON.stringify({
      clearedSections: sectionsToDelete.length,
      clearedUsers: usersToDelete.length,
      timestamp: now
    }),
    now
  );

  return {
    success: true,
    message: 'تم تصفير جميع البيانات بنجاح مع الحفاظ على حساب المشرف العام',
    clearedSections: sectionsToDelete.length,
    clearedUsers: usersToDelete.length
  };
}

// ==========================================
// Teacher Timetable Functions (استعمال زمان الأساتذة)
// ==========================================

export function getTeacherTimetable(teacherId: string) {
  const rows = db.prepare(`
    SELECT tt.*, sec.level, sec.class_number
    FROM teacher_timetable tt
    LEFT JOIN sections sec ON tt.section_id = sec.id
    WHERE tt.teacher_id = ?
    ORDER BY tt.slot_id ASC
  `).all(teacherId) as any[];

  return rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    dayOfWeek: r.day_of_week,
    slotId: r.slot_id,
    periodType: r.period_type,
    startTime: r.start_time,
    endTime: r.end_time,
    sectionId: r.section_id,
    sectionName: r.level && r.class_number ? `${r.level}/${r.class_number}` : '',
    room: r.room || '',
    subject: r.subject || '',
    notes: r.notes || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export function upsertTimetableSlot(teacherId: string, data: {
  dayOfWeek: string;
  slotId: string;
  periodType: string;
  startTime: string;
  endTime: string;
  sectionId: string;
  room?: string;
  subject?: string;
  notes?: string;
}) {
  const now = new Date().toISOString();
  // Check if an entry already exists for this teacher on this day and slot
  const existing = db.prepare(`
    SELECT id FROM teacher_timetable
    WHERE teacher_id = ? AND day_of_week = ? AND slot_id = ?
  `).get(teacherId, data.dayOfWeek, data.slotId) as any;

  const id = existing?.id || ('tt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

  db.prepare(`
    INSERT INTO teacher_timetable (
      id, teacher_id, day_of_week, slot_id, period_type,
      start_time, end_time, section_id, room, subject, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      period_type = excluded.period_type,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      section_id = excluded.section_id,
      room = excluded.room,
      subject = excluded.subject,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(
    id,
    teacherId,
    data.dayOfWeek,
    data.slotId,
    data.periodType,
    data.startTime,
    data.endTime,
    data.sectionId,
    data.room || '',
    data.subject || '',
    data.notes || '',
    now,
    now
  );

  const savedRecord = {
    id,
    teacherId,
    dayOfWeek: data.dayOfWeek,
    slotId: data.slotId,
    periodType: data.periodType,
    startTime: data.startTime,
    endTime: data.endTime,
    sectionId: data.sectionId,
    room: data.room || '',
    subject: data.subject || '',
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now
  };

  try {
    cloudSaveTimetableEntry(savedRecord);
  } catch (err) {
    console.warn('Firestore cloudSaveTimetableEntry error:', err);
  }

  return savedRecord;
}

export function deleteTimetableSlot(teacherId: string, slotId: string, dayOfWeek: string) {
  const existing = db.prepare(`
    SELECT id FROM teacher_timetable
    WHERE teacher_id = ? AND day_of_week = ? AND slot_id = ?
  `).get(teacherId, dayOfWeek, slotId) as any;

  if (existing) {
    db.prepare('DELETE FROM teacher_timetable WHERE id = ?').run(existing.id);
    try {
      cloudDeleteTimetableEntry(existing.id);
    } catch (err) {
      console.warn('Firestore cloudDeleteTimetableEntry error:', err);
    }
  }

  return { success: true };
}

export function deleteTimetableEntryById(id: string, teacherId?: string) {
  if (teacherId) {
    db.prepare('DELETE FROM teacher_timetable WHERE id = ? AND teacher_id = ?').run(id, teacherId);
  } else {
    db.prepare('DELETE FROM teacher_timetable WHERE id = ?').run(id);
  }
  try {
    cloudDeleteTimetableEntry(id);
  } catch (err) {
    console.warn('Firestore cloudDeleteTimetableEntry error:', err);
  }
  return { success: true };
}

