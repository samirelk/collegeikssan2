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
  cloudSavePositiveParticipation,
  cloudDeletePositiveParticipation,
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
import { commitBatchDocs } from './firestoreService.ts';

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
  positiveParticipations?: any[];
  positiveParticipationCount?: number;
  rosterId: string | null;
  statusColor?: SeatStatusColor;
  attendance?: SeatAttendance;
  previousSessionAbsence?: any;
}

export interface RosterItem {
  id: string;
  name: string;
  number: string;
  massarNumber?: string;
  positiveParticipationCount?: number;
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

  // Ensure attendance_history has extended columns for daily archive and duration tracking
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
    "ALTER TABLE attendance_history ADD COLUMN count_in_stats INTEGER DEFAULT 1;",
    "ALTER TABLE attendance_history ADD COLUMN absence_mode TEXT DEFAULT 'hours';",
    "ALTER TABLE attendance_history ADD COLUMN duration_hours INTEGER DEFAULT 0;",
    "ALTER TABLE attendance_history ADD COLUMN duration_days INTEGER DEFAULT 0;",
    "ALTER TABLE attendance_history ADD COLUMN duration_label TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN remover_name TEXT DEFAULT '';",
    "ALTER TABLE attendance_history ADD COLUMN remover_subject TEXT DEFAULT '';"
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

  // Ensure positive_participations table exists (سجل المشاركات الإيجابية والنقاط التشجيعية)
  db.exec(`
    CREATE TABLE IF NOT EXISTS positive_participations (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      seat_num INTEGER DEFAULT NULL,
      student_name TEXT NOT NULL,
      student_number TEXT DEFAULT '',
      massar_number TEXT DEFAULT '',
      participation_type TEXT NOT NULL DEFAULT 'مشاركة متميزة',
      points INTEGER DEFAULT 1,
      note TEXT DEFAULT '',
      teacher_name TEXT DEFAULT '',
      teacher_subject TEXT DEFAULT '',
      teacher_id TEXT DEFAULT '',
      recorded_date TEXT NOT NULL,
      recorded_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_pos_part_sec ON positive_participations(section_id);
    CREATE INDEX IF NOT EXISTS idx_pos_part_student ON positive_participations(section_id, student_name);
  `);

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

    CREATE TABLE IF NOT EXISTS deleted_tombstones (
      type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (type, item_id)
    );
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
  const dataResetCompleted = (db.prepare('SELECT value FROM app_settings WHERE key = ?').get('data_reset_completed') as { value?: string } | undefined)?.value === 'true';
  const settingsCount = (db.prepare('SELECT COUNT(*) as count FROM app_settings').get() as { count: number }).count;
  if (settingsCount === 0 && !dataResetCompleted) {
    seedInitialData();
  }

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
    // If director account exists, preserve user's custom password and profile without overwriting
    db.prepare(`
      UPDATE users SET
        role = 'director',
        status = 'active',
        email_verified = 1
      WHERE id = ?
    `).run(directorUser.id);
  }

  // Seed sample approved activities for the institution if empty
  try {
    const actCount = (db.prepare('SELECT COUNT(*) as count FROM school_activities').get() as { count: number }).count;
    if (actCount === 0 && !dataResetCompleted) {
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

  try {
    syncAssignedSectionsWithTimetableAndBackfill();
  } catch (syncErr) {
    console.error('Failed to syncAssignedSectionsWithTimetableAndBackfill:', syncErr);
  }
}

export function syncAssignedSectionsWithTimetableAndBackfill() {
  const now = new Date().toISOString();
  try {
    // 1. From teacher_timetable: Ensure each teacher who has a class in their timetable has an approved assignment
    const ttRows = db.prepare(`
      SELECT DISTINCT tt.teacher_id, tt.section_id, COALESCE(tt.subject, u.subject, 'عام') as subject, u.academic_year
      FROM teacher_timetable tt
      JOIN users u ON tt.teacher_id = u.id
      JOIN sections s ON tt.section_id = s.id
    `).all() as any[];

    for (const row of ttRows) {
      const existing = db.prepare(`
        SELECT id FROM section_assignments
        WHERE teacher_id = ? AND section_id = ?
      `).get(row.teacher_id, row.section_id) as any;

      const asgnId = existing ? existing.id : ('asgn_tt_' + row.teacher_id.replace(/^usr_/, '') + '_' + row.section_id.replace(/^sec_/, ''));

      if (existing) {
        db.prepare(`
          UPDATE section_assignments
          SET status = 'approved', reviewed_by = 'system', reviewed_at = COALESCE(reviewed_at, ?), subject = ?
          WHERE id = ?
        `).run(now, row.subject, existing.id);
      } else {
        db.prepare(`
          INSERT INTO section_assignments (id, teacher_id, section_id, status, request_note, requested_at, reviewed_at, reviewed_by, academic_year, subject)
          VALUES (?, ?, ?, 'approved', 'إسناد معتمد من استعمال الزمان', ?, ?, 'system', ?, ?)
        `).run(asgnId, row.teacher_id, row.section_id, now, now, row.academic_year || '2026/2027', row.subject);
      }

      // Update section primary teacher if not set
      db.prepare(`
        UPDATE sections
        SET assigned_teacher_id = COALESCE(assigned_teacher_id, ?), updated_at = ?
        WHERE id = ?
      `).run(row.teacher_id, now, row.section_id);

      try {
        cloudSaveAssignment({
          id: asgnId,
          teacherId: row.teacher_id,
          sectionId: row.section_id,
          status: 'approved',
          requestNote: 'إسناد معتمد من استعمال الزمان',
          requestedAt: now,
          reviewedAt: now,
          reviewedBy: 'system',
          academicYear: row.academic_year || '2026/2027',
          subject: row.subject
        });
        syncSectionToCloud(row.section_id);
      } catch {
        // Ignore
      }
    }

    // 2. From sections with assigned_teacher_id: Ensure section_assignments has an approved record
    const secRows = db.prepare(`
      SELECT s.id as section_id, s.assigned_teacher_id, u.subject, u.academic_year
      FROM sections s
      JOIN users u ON s.assigned_teacher_id = u.id
      WHERE s.assigned_teacher_id IS NOT NULL AND s.assigned_teacher_id != ''
    `).all() as any[];

    for (const sec of secRows) {
      const existing = db.prepare(`
        SELECT id FROM section_assignments
        WHERE teacher_id = ? AND section_id = ?
      `).get(sec.assigned_teacher_id, sec.section_id) as any;

      if (!existing) {
        const asgnId = 'asgn_sec_' + sec.assigned_teacher_id.replace(/^usr_/, '') + '_' + sec.section_id.replace(/^sec_/, '');
        db.prepare(`
          INSERT INTO section_assignments (id, teacher_id, section_id, status, request_note, requested_at, reviewed_at, reviewed_by, academic_year, subject)
          VALUES (?, ?, ?, 'approved', 'إسناد مباشر للقسم', ?, ?, 'admin', ?, ?)
        `).run(asgnId, sec.assigned_teacher_id, sec.section_id, now, now, sec.academic_year || '2026/2027', sec.subject || 'عام');

        try {
          cloudSaveAssignment({
            id: asgnId,
            teacherId: sec.assigned_teacher_id,
            sectionId: sec.section_id,
            status: 'approved',
            requestNote: 'إسناد مباشر للقسم',
            requestedAt: now,
            reviewedAt: now,
            reviewedBy: 'admin',
            academicYear: sec.academic_year || '2026/2027',
            subject: sec.subject || 'عام'
          });
        } catch {
          // Ignore
        }
      }
    }
  } catch (err: any) {
    console.warn('syncAssignedSectionsWithTimetableAndBackfill error:', err?.message || err);
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

export function normalizeArabic(str?: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/\u0640/g, '') // remove tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

export function matchStudent(
  targetName: string,
  targetNum?: string,
  targetMassar?: string,
  recordName?: string,
  recordNum?: string,
  recordMassar?: string
): boolean {
  const tName = normalizeArabic(targetName);
  const rName = normalizeArabic(recordName);

  if (!tName && !rName) return false;

  // 1. If Massar number matches, it's definitively the exact same student
  const tMassar = (targetMassar || '').trim().toUpperCase();
  const rMassar = (recordMassar || '').trim().toUpperCase();
  if (tMassar && rMassar && tMassar === rMassar) {
    return true;
  }

  // 2. If Arabic names match exactly after normalization
  if (tName && rName && tName === rName) {
    return true;
  }

  // 3. If one name contains the other (e.g. compound name or slight difference) AND numbers match if both present
  if (tName && rName && (tName.includes(rName) || rName.includes(tName))) {
    const tNum = String(targetNum || '').trim();
    const rNum = String(recordNum || '').trim();
    if (!tNum || !rNum || tNum === rNum) {
      return true;
    }
  }

  return false;
}

export function calculateHoursDifference(startIso?: string, endIso?: string): number {
  if (!startIso) return 1;
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    if (isNaN(start) || isNaN(end) || end <= start) return 1;
    const diffMs = end - start;
    const diffMinutes = Math.round(diffMs / (60 * 1000));
    // Display in full integer hours only (without minutes) as requested
    const hours = Math.max(1, Math.round(diffMinutes / 60));
    return hours;
  } catch {
    return 1;
  }
}

export function formatHoursInArabic(hours: number): string {
  if (hours <= 1) return '1 ساعة';
  if (hours === 2) return '2 ساعات';
  if (hours >= 3 && hours <= 10) return `${hours} ساعات`;
  return `${hours} ساعة`;
}

export function formatDaysInArabic(days: number): string {
  if (days <= 1) return '1 يوم';
  if (days === 2) return '2 يومان';
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يوم`;
}

export function getAllSections(teacherFilterId?: string, viewerId?: string, viewerRole?: string): SectionItem[] {
  let query = `
    SELECT s.*, u.full_name as assigned_teacher_name
    FROM sections s
    LEFT JOIN users u ON s.assigned_teacher_id = u.id
  `;
  const params: any[] = [];

  // Strict RBAC: If requester is a teacher, ONLY show sections assigned to this teacher in the database
  const effectiveTeacherId = viewerRole === 'teacher' ? (viewerId || teacherFilterId) : teacherFilterId;

  if (effectiveTeacherId) {
    query += `
      WHERE s.id IN (
        SELECT section_id FROM section_assignments WHERE teacher_id = ? AND status = 'approved'
        UNION
        SELECT id FROM sections WHERE assigned_teacher_id = ?
        UNION
        SELECT section_id FROM teacher_timetable WHERE teacher_id = ?
      )
    `;
    params.push(effectiveTeacherId, effectiveTeacherId, effectiveTeacherId);
  }
  query += ' ORDER BY s.created_at ASC';

  const sectionRows = db.prepare(query).all(...params) as any[];
  const result: SectionItem[] = [];

  for (const sec of sectionRows) {
    // Get canonical seats
    const seatRows = db.prepare('SELECT * FROM seats WHERE section_id = ? ORDER BY seat_num ASC').all(sec.id) as any[];
    let sectionRoster: RosterItem[] = [];
    try {
      sectionRoster = JSON.parse(sec.roster_json || '[]');
    } catch {
      sectionRoster = [];
    }

    // Teacher-specific private seating arrangement
    const teacherOverrides = viewerRole === 'teacher' && viewerId
      ? db.prepare('SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ?').all(viewerId, sec.id) as any[]
      : [];
    const overridesBySeat = new Map(teacherOverrides.map((override) => [override.seat_num, override]));
    const hasTeacherCustomSeating = teacherOverrides.some((o) => o.student_name && o.student_name.trim() !== '');

    // Today's attendance history for section-level session isolation
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAbsenceRows = db.prepare(`
      SELECT ah.seat_num, ah.student_name, ah.student_number, ah.massar_number, ah.status, 
             ah.created_by, ah.teacher_name, ah.session_period, ah.removed_at
      FROM attendance_history ah
      WHERE ah.section_id = ? AND ah.recorded_date = ? AND (ah.removed_at IS NULL OR ah.removed_at = '')
    `).all(sec.id, todayStr) as any[];

    let currentTeacherName = '';
    if (viewerRole === 'teacher' && viewerId) {
      const u = db.prepare('SELECT full_name FROM users WHERE id = ?').get(viewerId) as any;
      currentTeacherName = u?.full_name || '';
    }
    
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

    // Get positive participations for section
    const posRows = db.prepare(`
      SELECT id, section_id, seat_num, student_name, student_number, massar_number,
             participation_type, points, note, teacher_name, teacher_subject, teacher_id,
             recorded_date, recorded_time, created_at
      FROM positive_participations
      WHERE section_id = ? ${viewerRole === 'teacher' && viewerId ? 'AND teacher_id = ?' : ''}
      ORDER BY created_at DESC
    `).all(...(viewerRole === 'teacher' && viewerId ? [sec.id, viewerId] : [sec.id])) as any[];

    const seats: SeatItem[] = [];
    const maxSeatNum = Math.max(100, seatRows.length > 0 ? Math.max(...seatRows.map((s: any) => s.seat_num)) : 100);
    for (let i = 1; i <= maxSeatNum; i++) {
      const found = seatRows.find((s) => s.seat_num === i);
      const override = overridesBySeat.get(i);
      const hasSpecificOverride = overridesBySeat.has(i);

      // Student identity for this seat:
      // If teacher has a custom override specifically for this seat, use it.
      // Otherwise, use the canonical class arrangement so students NEVER disappear!

      const studentName = hasSpecificOverride
        ? (override?.student_name || '')
        : (found?.student_name || '');
      const studentNumber = hasSpecificOverride
        ? (override?.student_number || '')
        : (found?.student_number || '');
      const massarNumber = hasSpecificOverride
        ? (override?.massar_number || '')
        : (found?.massar_number || '');
      const rosterId = hasSpecificOverride
        ? (override?.roster_id || null)
        : (found?.roster_id || null);
      const statusColor = (hasSpecificOverride
        ? (override?.status_color || 'default')
        : (found?.status_color || 'default')) as SeatStatusColor;

      // Attendance is teacher/session aware!
      let resolvedAttendance: SeatAttendance = null;
      let previousSessionAbsence: any = null;

      if (viewerRole === 'teacher' && viewerId) {
        if (studentName && studentName.trim() !== '') {
          // 1. Did THIS teacher record attendance for this student today?
          const myRecord = todayAbsenceRows.find((a: any) =>
            (a.created_by === viewerId || (currentTeacherName && a.teacher_name === currentTeacherName)) &&
            matchStudent(studentName, studentNumber, massarNumber, a.student_name, a.student_number, a.massar_number)
          );
          if (myRecord) {
            resolvedAttendance = myRecord.status as SeatAttendance;
          }

          // 2. Did another teacher record absence for this student earlier today?
          const otherRecord = todayAbsenceRows.find((a: any) =>
            a.created_by !== viewerId &&
            (!currentTeacherName || a.teacher_name !== currentTeacherName) &&
            matchStudent(studentName, studentNumber, massarNumber, a.student_name, a.student_number, a.massar_number)
          );
          if (otherRecord) {
            previousSessionAbsence = {
              teacherName: otherRecord.teacher_name || '',
              sessionPeriod: otherRecord.session_period || '',
              status: otherRecord.status
            };
          }
        }
      } else {
        // Director / Admin view: canonical attendance from seats or any active absence today
        if (studentName && studentName.trim() !== '') {
          const cleanName = studentName.trim().toLowerCase();
          const cleanNum = String(studentNumber || '').trim();
          const cleanMassar = String(massarNumber || '').trim();
          const matched = seatRows.find((s: any) => {
            if (rosterId && s.roster_id && s.roster_id === rosterId) return true;
            if (cleanMassar && s.massar_number && s.massar_number.trim() === cleanMassar) return true;
            if (cleanNum && s.student_number && String(s.student_number).trim() === cleanNum) return true;
            if (cleanName && s.student_name && s.student_name.trim().toLowerCase() === cleanName) return true;
            return false;
          });
          resolvedAttendance = (matched?.attendance as any) || null;
        } else {
          resolvedAttendance = (found?.attendance as any) || null;
        }
      }

      // Match violations & positive participations strictly to the STUDENT occupying this seat (never to the chair)
      let seatViols: any[] = [];
      let seatPos: any[] = [];
      if (studentName && studentName.trim() !== '') {
        seatViols = violRows
          .filter((v: any) => matchStudent(studentName, studentNumber, massarNumber, v.student_name, v.student_number, v.massar_number))
          .map((v: any) => ({
            id: v.id,
            sectionId: v.section_id,
            seatNum: i,
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
          }));

        seatPos = posRows
          .filter((p: any) => matchStudent(studentName, studentNumber, massarNumber, p.student_name, p.student_number, p.massar_number))
          .map((p: any) => ({
            id: p.id,
            sectionId: p.section_id,
            seatNum: i,
            studentName: p.student_name,
            studentNumber: p.student_number,
            massarNumber: p.massar_number,
            participationType: p.participation_type,
            points: Number(p.points || 1),
            note: p.note || '',
            teacherName: p.teacher_name,
            teacherSubject: p.teacher_subject,
            recordedDate: p.recorded_date,
            recordedTime: p.recorded_time,
            createdAt: p.created_at
          }));
      }

      const positiveCount = seatPos.reduce((sum: number, p: any) => sum + (p.points || 1), 0);

      seats.push({
        seat: i,
        name: studentName,
        number: studentNumber,
        massarNumber: massarNumber,
        rosterId: rosterId,
        statusColor: statusColor,
        attendance: resolvedAttendance,
        previousSessionAbsence: previousSessionAbsence,
        violations: seatViols,
        positiveParticipations: seatPos,
        positiveParticipationCount: positiveCount,
        notes: notesBySeat[i] || []
      });
    }

    const roster = sectionRoster.map((r) => {
      const studentPos = posRows
        .filter((p: any) => matchStudent(r.name, r.number, r.massarNumber, p.student_name, p.student_number, p.massar_number))
        .map((p: any) => ({
          id: p.id,
          sectionId: p.section_id,
          seatNum: undefined,
          studentName: p.student_name,
          studentNumber: p.student_number,
          massarNumber: p.massar_number,
          participationType: p.participation_type,
          points: Number(p.points || 1),
          note: p.note || '',
          teacherName: p.teacher_name,
          teacherSubject: p.teacher_subject,
          recordedDate: p.recorded_date,
          recordedTime: p.recorded_time,
          createdAt: p.created_at
        }));
      const posCount = studentPos.reduce((sum: number, p: any) => sum + (p.points || 1), 0);
      return {
        ...r,
        positiveParticipationCount: posCount,
        positiveParticipations: studentPos
      };
    });

    // Get all approved assigned teachers for this section across all subjects
    const assignedTeachersRows = db.prepare(`
      SELECT sa.teacher_id, sa.subject, u.full_name as teacher_name, u.academic_year
      FROM section_assignments sa
      JOIN users u ON sa.teacher_id = u.id
      WHERE sa.section_id = ? AND sa.status = 'approved'
      UNION
      SELECT tt.teacher_id, tt.subject, u.full_name as teacher_name, u.academic_year
      FROM teacher_timetable tt
      JOIN users u ON tt.teacher_id = u.id
      WHERE tt.section_id = ?
    `).all(sec.id, sec.id) as any[];

    const assignedTeachers = assignedTeachersRows.map((r) => ({
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      subject: r.subject || 'عام',
      academicYear: r.academic_year
    }));

    if (sec.assigned_teacher_id && !assignedTeachers.some(t => t.teacherId === sec.assigned_teacher_id)) {
      const u = db.prepare('SELECT id, full_name, subject, academic_year FROM users WHERE id = ?').get(sec.assigned_teacher_id) as any;
      if (u) {
        assignedTeachers.push({
          teacherId: u.id,
          teacherName: u.full_name,
          subject: u.subject || 'عام',
          academicYear: u.academic_year
        });
      }
    }

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

  try {
    const createdSec = db.prepare('SELECT * FROM sections WHERE id = ?').get(id) as any;
    if (createdSec) cloudSaveSection(createdSec);
  } catch (syncErr: any) {
    console.warn('[createSection] Firestore sync warning:', syncErr?.message || syncErr);
  }

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

  try {
    const updatedSec = db.prepare('SELECT * FROM sections WHERE id = ?').get(id) as any;
    if (updatedSec) cloudSaveSection(updatedSec);
  } catch (syncErr: any) {
    console.warn('[updateSectionMeta] Firestore sync warning:', syncErr?.message || syncErr);
  }
}

export function deleteSection(id: string) {
  const sec = db.prepare('SELECT level, class_number FROM sections WHERE id = ?').get(id) as any;
  const title = sec ? `${sec.level} - القسم ${sec.class_number}` : id;

  db.prepare('DELETE FROM section_assignments WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM teacher_seat_overrides WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM teacher_timetable WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM attendance_history WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM daily_violations WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM notes WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM student_change_requests WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM seats WHERE section_id = ?').run(id);
  db.prepare('DELETE FROM sections WHERE id = ?').run(id);
  db.prepare("INSERT OR REPLACE INTO deleted_tombstones (type, item_id, created_at) VALUES ('section', ?, ?)").run(id, new Date().toISOString());

  try {
    cloudDeleteSection(id);
  } catch (cloudErr: any) {
    console.warn(`[deleteSection] cloudDeleteSection warning for ${id}:`, cloudErr?.message || cloudErr);
  }

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
  const allSections = db.prepare('SELECT id FROM sections').all() as Array<{ id: string }>;
  const count = allSections.length;

  db.prepare('DELETE FROM section_assignments').run();
  db.prepare('DELETE FROM teacher_seat_overrides').run();
  db.prepare('DELETE FROM teacher_timetable').run();
  db.prepare('DELETE FROM attendance_history').run();
  db.prepare('DELETE FROM daily_violations').run();
  db.prepare('DELETE FROM notes').run();
  db.prepare('DELETE FROM student_change_requests').run();
  db.prepare('DELETE FROM seats').run();
  db.prepare('DELETE FROM sections').run();

  for (const s of allSections) {
    try {
      cloudDeleteSection(s.id);
    } catch {
      // Ignore non-critical individual cleanup
    }
  }

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
    skipCloudSync?: boolean;
  }
) {
  const now = new Date().toISOString();
  const actorId = data.actorId || '';
  const actorRole = data.actorRole || 'teacher';

  const teacherOverride = actorRole === 'teacher' && actorId
    ? db.prepare('SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ? AND seat_num = ?').get(actorId, sectionId, seatNum) as any
    : null;

  const current = db.prepare('SELECT * FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, seatNum) as any;

  const name = data.name !== undefined ? data.name : (teacherOverride?.student_name !== undefined ? teacherOverride.student_name : (current?.student_name || ''));
  const number = data.number !== undefined ? data.number : (teacherOverride?.student_number !== undefined ? teacherOverride.student_number : (current?.student_number || ''));
  const massarNumber = data.massarNumber !== undefined ? data.massarNumber : (teacherOverride?.massar_number !== undefined ? teacherOverride.massar_number : (current?.massar_number || ''));
  const rosterId = data.rosterId !== undefined ? data.rosterId : (teacherOverride?.roster_id !== undefined ? teacherOverride.roster_id : (current?.roster_id || null));
  const statusColor = data.statusColor !== undefined ? data.statusColor : (teacherOverride?.status_color !== undefined ? teacherOverride.status_color : (current?.status_color || 'default'));
  const attendance = data.attendance !== undefined ? data.attendance : (current?.attendance || null);

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

    if (!data.skipCloudSync) {
      try {
        const savedOverride = db.prepare('SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ? AND seat_num = ?').get(actorId, sectionId, seatNum) as any;
        if (savedOverride) {
          cloudSaveTeacherSeatOverride(savedOverride);
        }
      } catch (err) {
        console.warn('Firestore cloudSaveTeacherSeatOverride error:', err);
      }
    }

    return { success: true };
  }

  // Determine canonical seat for this student so attendance is attached to the STUDENT, not the chair!
  let targetSeatNum = seatNum;
  if (name && name.trim()) {
    const cleanName = name.trim().toLowerCase();
    const cleanNum = String(number || '').trim();
    const cleanMassar = String(massarNumber || '').trim();

    const matchedCanonical = db.prepare(`
      SELECT * FROM seats
      WHERE section_id = ?
        AND (
          (roster_id IS NOT NULL AND roster_id != '' AND roster_id = ?)
          OR (massar_number IS NOT NULL AND massar_number != '' AND massar_number = ?)
          OR (student_number IS NOT NULL AND student_number != '' AND student_number = ?)
          OR (LOWER(TRIM(student_name)) = ?)
        )
      LIMIT 1
    `).get(sectionId, rosterId || '', cleanMassar, cleanNum, cleanName) as any;

    if (matchedCanonical) {
      targetSeatNum = matchedCanonical.seat_num;
    }
  }

  // If attendance is being updated:
  if (data.attendance !== undefined) {
    db.prepare(`
      UPDATE seats SET attendance = ?, updated_at = ? WHERE section_id = ? AND seat_num = ?
    `).run(attendance, now, sectionId, targetSeatNum);

    try {
      const updatedCanonical = db.prepare('SELECT * FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, targetSeatNum) as any;
      if (updatedCanonical) {
        cloudSaveSeat(sectionId, updatedCanonical);
      }
    } catch (err: any) {
      console.warn(`[updateSeat] cloudSaveSeat warning for sec=${sectionId}, seat=${targetSeatNum}:`, err?.message || err);
    }
  } else {
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

    if (!data.skipCloudSync) {
      try {
        cloudSaveSeat(sectionId, {
          seat: seatNum,
          name,
          number,
          massarNumber,
          rosterId,
          statusColor,
          attendance
        });
      } catch (err: any) {
        console.warn(`[updateSeat] cloudSaveSeat warning for sec=${sectionId}, seat=${seatNum}:`, err?.message || err);
      }
    }
  }

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

      let effectiveTeacherName = secInfo?.teacher_name || '';
      let effectiveTeacherSubject = secInfo?.teacher_subject || '';
      if (actorId) {
        const actorUser = db.prepare('SELECT full_name, subject FROM users WHERE id = ?').get(actorId) as any;
        if (actorUser) {
          effectiveTeacherName = actorUser.full_name || effectiveTeacherName;
          effectiveTeacherSubject = actorUser.subject || effectiveTeacherSubject;
        }
      }

      const existing = db.prepare(
        `SELECT * FROM attendance_history 
         WHERE section_id = ? AND (seat_num = ? OR student_name = ?) AND recorded_date = ?
         AND (created_by = ? OR (teacher_name = ? AND ? != ''))
         ORDER BY created_at DESC LIMIT 1`
      ).get(sectionId, targetSeatNum, name.trim(), today, actorId || '', effectiveTeacherName, effectiveTeacherName) as any;

      if (!existing) {
        const histResult = db.prepare(`
          INSERT INTO attendance_history (
            section_id, seat_num, student_name, student_number,
            status, recorded_date, session_period, teacher_name, teacher_subject,
            justified, created_at, created_by, removed_by, removed_at, count_in_stats,
            absence_mode, duration_hours, duration_days, duration_label
          ) VALUES (?, ?, ?, ?, ?, ?, 'غياب بالساعات', ?, ?, 'unjustified', ?, ?, '', '', 1, 'hours', 1, 0, '1 ساعة (جاري)')
        `).run(
          sectionId,
          targetSeatNum,
          name.trim(),
          number.trim(),
          attendance,
          today,
          effectiveTeacherName,
          effectiveTeacherSubject,
          now,
          actorId || ''
        );

        if (!data.skipCloudSync) {
          try {
            cloudSaveAttendance({
              id: String(histResult.lastInsertRowid),
              sectionId,
              seatNum: targetSeatNum,
              studentName: name.trim(),
              studentNumber: number.trim(),
              massarNumber: massarNumber.trim(),
              status: attendance,
              date: today,
              time: now.slice(11, 16),
              session: 'غياب بالساعات',
              subject: secInfo?.teacher_subject || '',
              teacherName: secInfo?.teacher_name || '',
              isJustified: false,
              justificationReason: '',
              absenceMode: 'hours',
              durationHours: 1,
              durationDays: 0,
              durationLabel: '1 ساعة (جاري)',
              createdAt: now
            });
          } catch {}
        }
      } else {
        db.prepare(`
          UPDATE attendance_history SET
            status = ?,
            seat_num = ?,
            student_name = ?,
            student_number = ?,
            created_by = COALESCE(NULLIF(?, ''), created_by),
            removed_by = '',
            removed_at = '',
            remover_name = '',
            remover_subject = '',
            duration_label = '1 ساعة (جاري)',
            count_in_stats = 1
          WHERE id = ?
        `).run(attendance, targetSeatNum, name.trim(), number.trim(), actorId || '', existing.id);

        if (!data.skipCloudSync) {
          try {
            cloudSaveAttendance({
              id: String(existing.id),
              sectionId,
              seatNum: targetSeatNum,
              studentName: name.trim(),
              studentNumber: number.trim(),
              massarNumber: massarNumber.trim(),
              status: attendance,
              date: today,
              time: now.slice(11, 16),
              session: existing.session_period || 'غياب بالساعات',
              subject: secInfo?.teacher_subject || '',
              teacherName: secInfo?.teacher_name || '',
              isJustified: false,
              justificationReason: '',
              absenceMode: existing.absence_mode || 'hours',
              durationLabel: '1 ساعة (جاري)',
              createdAt: existing.created_at || now
            });
          } catch {}
        }
      }
    } catch {
      // Non-critical logging
    }
  } else if ((attendance === 'present' || attendance === null) && name.trim()) {
    try {
      const today = now.slice(0, 10);
      const absenceRow = db.prepare(`
        SELECT * FROM attendance_history
        WHERE section_id = ? AND (seat_num = ? OR student_name = ?) AND recorded_date = ? AND (status = 'absent' OR status = 'late')
        ${actorId && actorRole === 'teacher' ? 'AND (created_by = ? OR created_by = "")' : ''}
        ORDER BY created_at DESC LIMIT 1
      `).get(sectionId, targetSeatNum, name.trim(), today, ...(actorId && actorRole === 'teacher' ? [actorId] : [])) as any;

      if (absenceRow) {
        const sameTeacher = actorId && absenceRow.created_by && actorId === absenceRow.created_by;
        const diffMs = !!absenceRow.created_at ? (Date.parse(now) - Date.parse(absenceRow.created_at)) : 0;
        // If the SAME teacher toggles back within the same session/period (within 60 minutes), it's an accidental misclick:
        // Do NOT keep in archive - delete completely!
        const isQuickUndo = sameTeacher && diffMs <= 60 * 60 * 1000;

        if (isQuickUndo) {
          db.prepare('DELETE FROM attendance_history WHERE id = ?').run(absenceRow.id);
          if (!data.skipCloudSync) {
            try {
              cloudDeleteAttendance(String(absenceRow.id));
            } catch {}
          }
        } else {
          // Legitimate removal by director / supervisor or after session:
          // Keep in archive as a resolved absence with remover info and duration
          let removerName = '';
          let removerSubject = '';
          if (actorId) {
            const removerUser = db.prepare('SELECT full_name, subject FROM users WHERE id = ?').get(actorId) as any;
            if (removerUser) {
              removerName = removerUser.full_name || '';
              removerSubject = removerUser.subject || '';
            }
          }

          const hours = calculateHoursDifference(absenceRow.created_at, now);
          const durationLabel = formatHoursInArabic(hours);

          db.prepare(`
            UPDATE attendance_history SET
              removed_by = ?,
              removed_at = ?,
              remover_name = ?,
              remover_subject = ?,
              duration_hours = ?,
              duration_label = ?,
              count_in_stats = 1
            WHERE id = ?
          `).run(actorId || '', now, removerName, removerSubject, hours, durationLabel, absenceRow.id);

          if (!data.skipCloudSync) {
            try {
              cloudSaveAttendance({
                ...absenceRow,
                removedBy: actorId || '',
                removedAt: now,
                removerName,
                removerSubject,
                durationHours: hours,
                durationLabel,
                countInStats: 1
              });
            } catch {}
          }
        }
      }
    } catch {
      // Non-critical
    }
  }

  return { success: true };
}

// 4b. Batch Update Seats (آلية التحديث المجمع لتقليل استهلاك حصة Firestore)
export function batchUpdateSeats(
  sectionId: string,
  updates: Array<{
    seatNum: number;
    name?: string;
    number?: string;
    massarNumber?: string;
    rosterId?: string | null;
    statusColor?: string;
    attendance?: string | null;
  }>,
  options?: { actorId?: string; actorRole?: string }
) {
  const actorId = options?.actorId || '';
  const actorRole = options?.actorRole || 'teacher';

  if (!Array.isArray(updates) || updates.length === 0) {
    return { success: true, count: 0 };
  }

  // 1. Execute all updates inside a single SQLite transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    for (const item of updates) {
      updateSeat(sectionId, item.seatNum, {
        ...item,
        actorId,
        actorRole,
        skipCloudSync: false
      });
    }
    db.exec('COMMIT;');
  } catch (txErr) {
    db.exec('ROLLBACK;');
    throw txErr;
  }

  // 2. Cloud sync all changed seats together in ONE batch!
  try {
    const seatNums = updates.map((u) => u.seatNum);
    const placeholders = seatNums.map(() => '?').join(',');

    if (actorRole === 'teacher' && actorId) {
      const overrides = db.prepare(`
        SELECT * FROM teacher_seat_overrides
        WHERE teacher_id = ? AND section_id = ? AND seat_num IN (${placeholders})
      `).all(actorId, sectionId, ...seatNums) as any[];

      const writes = overrides.map((o) => ({
        type: 'set' as const,
        collection: 'teacher_seat_overrides',
        id: `${o.teacher_id}_${o.section_id}_seat_${o.seat_num}`,
        data: {
          id: `${o.teacher_id}_${o.section_id}_seat_${o.seat_num}`,
          teacherId: o.teacher_id,
          sectionId: o.section_id,
          seatNum: Number(o.seat_num),
          studentName: o.student_name || '',
          studentNumber: o.student_number || '',
          massarNumber: o.massar_number || '',
          rosterId: o.roster_id || null,
          statusColor: o.status_color || 'default',
          updatedAt: o.updated_at || new Date().toISOString()
        }
      }));

      if (writes.length > 0) {
        commitBatchDocs(writes).catch((e) => console.warn('[batchUpdateSeats] teacher cloud batch warning:', e));
      }
    } else {
      // Sync canonical seats
      const seats = db.prepare(`
        SELECT * FROM seats WHERE section_id = ? AND seat_num IN (${placeholders})
      `).all(sectionId, ...seatNums) as any[];

      const writes = seats.map((st) => ({
        type: 'set' as const,
        collection: 'seats',
        id: `${sectionId}_seat_${st.seat_num}`,
        data: {
          id: `${sectionId}_seat_${st.seat_num}`,
          sectionId,
          seatNum: Number(st.seat_num),
          studentName: st.student_name || '',
          studentNumber: st.student_number || '',
          massarNumber: st.massar_number || '',
          rosterId: st.roster_id || null,
          statusColor: st.status_color || 'default',
          attendance: st.attendance || null,
          updatedAt: st.updated_at || new Date().toISOString()
        }
      }));

      if (writes.length > 0) {
        commitBatchDocs(writes).catch((e) => console.warn('[batchUpdateSeats] canonical cloud batch warning:', e));
      }
    }
  } catch (err: any) {
    console.warn('[batchUpdateSeats] Cloud sync error:', err?.message || err);
  }

  return { success: true, count: updates.length };
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
  const day = pad(d.getUTCDate());
  const month = pad(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear();
  const hour = pad(d.getUTCHours());
  const minute = pad(d.getUTCMinutes());
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

  try {
    const updatedSec = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
    if (updatedSec) {
      cloudSaveSection(updatedSec);
    }
  } catch (err: any) {
    console.warn(`[saveSectionRoster] cloudSaveSection warning for ${sectionId}:`, err?.message || err);
  }

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

  try {
    const updatedSec = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
    if (updatedSec) cloudSaveSection(updatedSec);
    cloudSaveSeat(sectionId, {
      seat: targetSeatNum,
      name: studentName,
      number: assignedNumber,
      massarNumber,
      rosterId: newRosterItem.id,
      statusColor: 'default',
      attendance: null
    });
  } catch (syncErr: any) {
    console.warn('[addStudentToSection] Firestore sync warning:', syncErr?.message || syncErr);
  }

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

  try {
    const updatedSec = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
    if (updatedSec) cloudSaveSection(updatedSec);
    cloudSaveSeat(sectionId, {
      seat: seatNum,
      name: '',
      number: '',
      massarNumber: '',
      rosterId: null,
      statusColor: 'default',
      attendance: null
    });
  } catch (syncErr: any) {
    console.warn('[removeStudentFromSection] Firestore sync warning:', syncErr?.message || syncErr);
  }

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
  const users = db.prepare('SELECT * FROM users').all();
  const sectionAssignments = db.prepare('SELECT * FROM section_assignments').all();
  const academicYears = db.prepare('SELECT * FROM academic_years').all();
  const teacherSeatOverrides = db.prepare('SELECT * FROM teacher_seat_overrides').all();
  const attendanceHistory = db.prepare('SELECT * FROM attendance_history').all();
  const dailyViolations = db.prepare('SELECT * FROM daily_violations').all();
  const teacherTimetable = db.prepare('SELECT * FROM teacher_timetable').all();

  return {
    version: '2.2.0',
    app: 'خرائط الأقسام',
    exportedAt: new Date().toISOString(),
    settings,
    sections,
    history,
    schoolActivities,
    users,
    sectionAssignments,
    academicYears,
    teacherSeatOverrides,
    attendanceHistory,
    dailyViolations,
    teacherTimetable
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

    // 2. Users (if present in backup, restore/upsert preserving credentials)
    if (Array.isArray(backupData.users) && backupData.users.length > 0) {
      const upsertUser = db.prepare(`
        INSERT INTO users (
          id, username, email, password, full_name, role, academic_year, status,
          subject, email_verified, must_change_profile, must_change_password, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          email = excluded.email,
          password = excluded.password,
          full_name = excluded.full_name,
          role = excluded.role,
          academic_year = excluded.academic_year,
          status = excluded.status,
          subject = excluded.subject,
          email_verified = excluded.email_verified,
          must_change_profile = excluded.must_change_profile,
          must_change_password = excluded.must_change_password,
          updated_at = excluded.updated_at
      `);
      for (const u of backupData.users) {
        if (!u.id || !u.username) continue;
        upsertUser.run(
          u.id,
          u.username,
          u.email,
          u.password,
          u.full_name || u.fullName,
          u.role,
          u.academic_year || u.academicYear || '2026/2027',
          u.status || 'active',
          u.subject || 'الرياضيات',
          u.email_verified ? 1 : 0,
          u.must_change_profile ? 1 : 0,
          u.must_change_password ? 1 : 0,
          u.created_at || new Date().toISOString(),
          u.updated_at || new Date().toISOString()
        );
      }
    }

    // 3. Sections
    db.prepare('DELETE FROM notes').run();
    db.prepare('DELETE FROM seats').run();
    db.prepare('DELETE FROM sections').run();

    const insertSec = db.prepare(`
      INSERT INTO sections (id, level, class_number, teacher, assigned_teacher_id, created_at, updated_at, roster_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSeat = db.prepare(`
      INSERT INTO seats (section_id, seat_num, student_name, student_number, massar_number, roster_id, attendance, status_color, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNote = db.prepare(`
      INSERT INTO notes (id, section_id, seat_num, note_text, note_date, note_time, created_at, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        sec.classNumber || sec.class_number,
        sec.teacher || '',
        sec.assignedTeacherId || sec.assigned_teacher_id || null,
        sec.createdAt || Date.now(),
        now,
        JSON.stringify(sec.roster || [])
      );

      if (Array.isArray(sec.seats)) {
        for (const st of sec.seats) {
          insertSeat.run(
            sec.id,
            st.seat || st.seat_num,
            st.name || st.student_name || '',
            st.number || st.student_number || '',
            st.massarNumber || st.massar_number || '',
            st.rosterId || st.roster_id || null,
            st.attendance || null,
            st.statusColor || st.status_color || 'default',
            now
          );

          if (Array.isArray(st.notes)) {
            for (const n of st.notes) {
              insertNote.run(
                n.id || ('n' + Math.random().toString(36).slice(2)),
                sec.id,
                st.seat || st.seat_num,
                n.text || n.note_text || '',
                n.date || n.note_date || '',
                n.time || n.note_time || '',
                now,
                n.teacherId || n.teacher_id || ''
              );
            }
          }
        }
      }
    }

    // 4. Section Assignments
    if (Array.isArray(backupData.sectionAssignments)) {
      const insertAsgn = db.prepare(`
        INSERT OR REPLACE INTO section_assignments (
          id, teacher_id, section_id, status, request_note, requested_at, reviewed_at, reviewed_by, academic_year, subject
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of backupData.sectionAssignments) {
        if (!a.id || !a.teacher_id || !a.section_id) continue;
        insertAsgn.run(
          a.id,
          a.teacher_id,
          a.section_id,
          a.status || 'approved',
          a.request_note || '',
          a.requested_at || now,
          a.reviewed_at || now,
          a.reviewed_by || 'admin',
          a.academic_year || '2026/2027',
          a.subject || 'عام'
        );
      }
    }

    // 5. Academic Years
    if (Array.isArray(backupData.academicYears)) {
      const insertYear = db.prepare(`
        INSERT OR REPLACE INTO academic_years (id, name, start_date, end_date, is_current, is_archived, notes, created_at, archived_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const y of backupData.academicYears) {
        if (!y.id || !y.name) continue;
        insertYear.run(
          y.id,
          y.name,
          y.start_date || '',
          y.end_date || '',
          y.is_current ? 1 : 0,
          y.is_archived ? 1 : 0,
          y.notes || '',
          y.created_at || now,
          y.archived_at || null
        );
      }
    }

    // 6. Teacher Seat Overrides
    if (Array.isArray(backupData.teacherSeatOverrides)) {
      const insertTso = db.prepare(`
        INSERT OR REPLACE INTO teacher_seat_overrides (
          teacher_id, section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of backupData.teacherSeatOverrides) {
        if (!t.teacher_id || !t.section_id) continue;
        insertTso.run(
          t.teacher_id,
          t.section_id,
          t.seat_num,
          t.student_name || '',
          t.student_number || '',
          t.massar_number || '',
          t.roster_id || null,
          t.status_color || 'default',
          t.updated_at || now
        );
      }
    }

    // 7. Attendance History
    if (Array.isArray(backupData.attendanceHistory)) {
      const insertAtt = db.prepare(`
        INSERT OR REPLACE INTO attendance_history (
          id, section_id, seat_num, student_name, student_number, status, recorded_date,
          session_period, teacher_name, teacher_subject, justified, justification_reason, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of backupData.attendanceHistory) {
        if (!a.id || !a.section_id) continue;
        insertAtt.run(
          a.id,
          a.section_id,
          a.seat_num || 0,
          a.student_name || '',
          a.student_number || '',
          a.status || 'absent',
          a.recorded_date || now.slice(0, 10),
          a.session_period || 'كامل اليوم',
          a.teacher_name || '',
          a.teacher_subject || '',
          a.justified || 'unjustified',
          a.justification_reason || '',
          a.notes || '',
          a.created_at || now
        );
      }
    }

    // 8. Daily Violations
    if (Array.isArray(backupData.dailyViolations)) {
      const insertVio = db.prepare(`
        INSERT OR REPLACE INTO daily_violations (
          id, section_id, seat_num, student_name, student_number, massar_number,
          violation_type, description, action_taken, teacher_name, teacher_subject,
          recorded_date, recorded_time, created_at, teacher_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const v of backupData.dailyViolations) {
        if (!v.id || !v.section_id) continue;
        insertVio.run(
          v.id,
          v.section_id,
          v.seat_num || 0,
          v.student_name || '',
          v.student_number || '',
          v.massar_number || '',
          v.violation_type || 'مخالفة سلوكية',
          v.description || '',
          v.action_taken || 'تنبيه شفهي',
          v.teacher_name || '',
          v.teacher_subject || '',
          v.recorded_date || now.slice(0, 10),
          v.recorded_time || '08:30',
          v.created_at || now,
          v.teacher_id || ''
        );
      }
    }

    // 9. Teacher Timetable
    if (Array.isArray(backupData.teacherTimetable)) {
      const insertTt = db.prepare(`
        INSERT OR REPLACE INTO teacher_timetable (
          id, teacher_id, day_of_week, slot_id, period_type, start_time, end_time, section_id, room, subject, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const tt of backupData.teacherTimetable) {
        if (!tt.id || !tt.teacher_id || !tt.section_id) continue;
        insertTt.run(
          tt.id,
          tt.teacher_id,
          tt.day_of_week,
          tt.slot_id,
          tt.period_type || 'morning',
          tt.start_time || '08:00',
          tt.end_time || '09:00',
          tt.section_id,
          tt.room || '',
          tt.subject || '',
          tt.notes || '',
          tt.created_at || now,
          tt.updated_at || now
        );
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

    try {
      const allSecSeats = db.prepare('SELECT * FROM seats WHERE section_id = ?').all(sectionId) as any[];
      for (const st of allSecSeats) {
        cloudSaveSeat(sectionId, {
          seat: st.seat_num,
          name: st.student_name || '',
          number: st.student_number || '',
          massarNumber: st.massar_number || '',
          rosterId: st.roster_id || null,
          statusColor: st.status_color || 'default',
          attendance: st.attendance || null
        });
      }
    } catch (syncErr: any) {
      console.warn('[orderSectionSeatsByNumber] Firestore seats sync warning:', syncErr?.message || syncErr);
    }

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

    try {
      const allSecSeats = db.prepare('SELECT * FROM seats WHERE section_id = ?').all(sectionId) as any[];
      for (const st of allSecSeats) {
        cloudSaveSeat(sectionId, {
          seat: st.seat_num,
          name: st.student_name || '',
          number: st.student_number || '',
          massarNumber: st.massar_number || '',
          rosterId: st.roster_id || null,
          statusColor: st.status_color || 'default',
          attendance: st.attendance || null
        });
      }
    } catch (syncErr: any) {
      console.warn('[shuffleSectionSeats] Firestore seats sync warning:', syncErr?.message || syncErr);
    }

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

    try {
      const allSections = getAllSections();
      for (const sec of allSections) {
        cloudSaveSection(sec);
        for (const st of (sec.seats || [])) {
          if (st.name && st.name.trim()) {
            cloudSaveSeat(sec.id, st);
          }
        }
      }
    } catch (syncErr: any) {
      console.warn('[batchImportSections] Firestore sync warning:', syncErr?.message || syncErr);
    }

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

export function syncUserToCloud(userId: string) {
  try {
    const raw = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (raw) {
      cloudSaveUser({
        id: raw.id,
        username: raw.username,
        email: raw.email,
        password: raw.password,
        fullName: raw.full_name,
        role: raw.role,
        status: raw.status,
        subject: raw.subject,
        academicYear: raw.academic_year || '2026/2027',
        emailVerified: Boolean(raw.email_verified),
        mustChangeProfile: Boolean(raw.must_change_profile),
        mustChangePassword: Boolean(raw.must_change_password),
        createdAt: raw.created_at,
        updatedAt: raw.updated_at
      });
    }
  } catch (err: any) {
    console.warn('[syncUserToCloud] error:', err?.message);
  }
}

export function syncSectionToCloud(sectionId: string) {
  try {
    const raw = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId) as any;
    if (raw) {
      cloudSaveSection({
        id: raw.id,
        level: raw.level,
        classNumber: raw.class_number,
        teacher: raw.teacher || '',
        assignedTeacherId: raw.assigned_teacher_id || null,
        academicYear: raw.academic_year || '2026/2027',
        createdAt: raw.created_at,
        updatedAt: raw.updated_at
      });
    }
  } catch (err: any) {
    console.warn('[syncSectionToCloud] error:', err?.message);
  }
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
  syncUserToCloud(id);

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

  syncUserToCloud(user.id);

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

  syncUserToCloud(userId);

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

  syncUserToCloud(id);

  return findUserById(id);
}

export function getAllTeachers() {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.academic_year, u.status, u.subject, u.email_verified, u.created_at,
           (
             SELECT COUNT(DISTINCT sec_id) FROM (
               SELECT s.id as sec_id FROM sections s WHERE s.assigned_teacher_id = u.id
               UNION
               SELECT sa.section_id as sec_id FROM section_assignments sa WHERE sa.teacher_id = u.id AND sa.status = 'approved'
               UNION
               SELECT tt.section_id as sec_id FROM teacher_timetable tt WHERE tt.teacher_id = u.id
             )
           ) as assigned_sections_count
    FROM users u
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

export function getTeachersWithCredentials() {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.email, u.password, u.full_name, u.role, u.academic_year, u.status, u.subject, u.email_verified, u.created_at,
           (
             SELECT COUNT(DISTINCT sec_id) FROM (
               SELECT s.id as sec_id FROM sections s WHERE s.assigned_teacher_id = u.id
               UNION
               SELECT sa.section_id as sec_id FROM section_assignments sa WHERE sa.teacher_id = u.id AND sa.status = 'approved'
               UNION
               SELECT tt.section_id as sec_id FROM teacher_timetable tt WHERE tt.teacher_id = u.id
             )
           ) as assigned_sections_count
    FROM users u
    WHERE u.role = 'teacher'
    GROUP BY u.id
    ORDER BY u.full_name ASC
  `).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    password: r.password || '',
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

  // Clean up teacher specific records
  db.prepare('DELETE FROM section_assignments WHERE teacher_id = ?').run(id);
  db.prepare('DELETE FROM teacher_seat_overrides WHERE teacher_id = ?').run(id);
  db.prepare('DELETE FROM teacher_timetable WHERE teacher_id = ?').run(id);
  db.prepare('DELETE FROM notes WHERE teacher_id = ?').run(id);
  db.prepare('DELETE FROM student_change_requests WHERE teacher_id = ?').run(id);

  // If this teacher was primary assigned_teacher_id on sections, replace with next approved teacher or NULL
  const affectedSections = db.prepare('SELECT id FROM sections WHERE assigned_teacher_id = ?').all(id) as Array<{ id: string }>;
  for (const s of affectedSections) {
    const nextApproved = db.prepare(`
      SELECT teacher_id FROM section_assignments
      WHERE section_id = ? AND status = 'approved'
      LIMIT 1
    `).get(s.id) as any;
    db.prepare('UPDATE sections SET assigned_teacher_id = ?, updated_at = ? WHERE id = ?')
      .run(nextApproved ? nextApproved.teacher_id : null, now, s.id);
  }

  // Delete user from SQLite and Cloud
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare("INSERT OR REPLACE INTO deleted_tombstones (type, item_id, created_at) VALUES ('user', ?, ?)").run(id, now);
  try {
    cloudDeleteUser(id);
  } catch (err: any) {
    console.warn(`[deleteTeacher] cloudDeleteUser warning for ${id}:`, err?.message || err);
  }

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

export function deleteAllTeachers(requesterRole?: string) {
  if (requesterRole && requesterRole !== 'admin' && requesterRole !== 'director') {
    throw new Error('غير مصرح لك بحذف حسابات الأساتذة');
  }

  // Get all users with role 'teacher'
  const teachers = db.prepare("SELECT id, full_name, email FROM users WHERE role = 'teacher'").all() as Array<{
    id: string;
    full_name: string;
    email: string;
  }>;

  if (teachers.length === 0) {
    return { success: true, count: 0, message: 'لا يوجد أي أساتذة مسجلين حالياً لحذفهم' };
  }

  const now = new Date().toISOString();

  // Clean up teacher specific records
  db.prepare("DELETE FROM section_assignments WHERE teacher_id IN (SELECT id FROM users WHERE role = 'teacher')").run();
  db.prepare("DELETE FROM teacher_seat_overrides WHERE teacher_id IN (SELECT id FROM users WHERE role = 'teacher')").run();
  db.prepare("DELETE FROM teacher_timetable WHERE teacher_id IN (SELECT id FROM users WHERE role = 'teacher')").run();
  db.prepare("DELETE FROM notes WHERE teacher_id IN (SELECT id FROM users WHERE role = 'teacher')").run();
  db.prepare("DELETE FROM student_change_requests WHERE teacher_id IN (SELECT id FROM users WHERE role = 'teacher')").run();

  // Reset assigned_teacher_id on sections
  db.prepare("UPDATE sections SET assigned_teacher_id = NULL, updated_at = ? WHERE assigned_teacher_id IN (SELECT id FROM users WHERE role = 'teacher')").run(now);

  // Delete all teachers from users table
  db.prepare("DELETE FROM users WHERE role = 'teacher'").run();

  // Sync deletion with Cloud Firestore for each teacher
  for (const t of teachers) {
    try {
      cloudDeleteUser(t.id);
    } catch (err: any) {
      console.warn(`[deleteAllTeachers] cloudDeleteUser warning for ${t.id}:`, err?.message || err);
    }
  }

  db.prepare(`
    INSERT INTO change_history (action, summary, details_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    'delete_all_teachers',
    `مسح جميع حسابات الأساتذة (${teachers.length} أستاذ)`,
    JSON.stringify({ count: teachers.length, teacherNames: teachers.map((t) => t.full_name) }),
    now
  );

  return { success: true, count: teachers.length, message: `تم مسح وحذف جميع حسابات الأساتذة (${teachers.length} أستاذ) بنجاح` };
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

      syncUserToCloud(id);

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

    try {
      cloudSaveAssignment({
        id: req.id,
        teacherId: req.teacher_id,
        sectionId: req.section_id,
        status: 'approved',
        requestNote: req.request_note || '',
        requestedAt: req.requested_at,
        reviewedAt: now,
        reviewedBy: reviewerId,
        academicYear: req.academic_year || '2026/2027',
        subject: req.teacher_subject || 'عام'
      });
      syncSectionToCloud(req.section_id);
    } catch {
      // Ignore
    }
  } else {
    try {
      cloudSaveAssignment({
        id: req.id,
        teacherId: req.teacher_id,
        sectionId: req.section_id,
        status: 'rejected',
        requestNote: req.request_note || '',
        requestedAt: req.requested_at,
        reviewedAt: now,
        reviewedBy: reviewerId,
        academicYear: req.academic_year || '2026/2027',
        subject: req.teacher_subject || 'عام'
      });
    } catch {
      // Ignore
    }
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

  let assignedRecordId = '';
  if (existing) {
    assignedRecordId = existing.id;
    db.prepare(`
      UPDATE section_assignments 
      SET status = 'approved', reviewed_at = ?, reviewed_by = 'admin', subject = ?
      WHERE id = ?
    `).run(now, teacher.subject || 'عام', existing.id);
  } else {
    assignedRecordId = 'req_direct_' + Date.now().toString(36);
    db.prepare(`
      INSERT INTO section_assignments (id, teacher_id, section_id, status, request_note, requested_at, reviewed_at, reviewed_by, academic_year, subject)
      VALUES (?, ?, ?, 'approved', 'إسناد مباشر من طرف المشرف/المدير', ?, ?, 'admin', ?, ?)
    `).run(assignedRecordId, teacherId, sectionId, now, now, teacher.academicYear || '2026/2027', teacher.subject || 'عام');
  }

  try {
    cloudSaveAssignment({
      id: assignedRecordId,
      teacherId,
      sectionId,
      status: 'approved',
      requestNote: 'إسناد مباشر من طرف المشرف/المدير',
      requestedAt: now,
      reviewedAt: now,
      reviewedBy: 'admin',
      academicYear: teacher.academicYear || '2026/2027',
      subject: teacher.subject || 'عام'
    });
    syncSectionToCloud(sectionId);
  } catch {
    // Ignore
  }

  // NOTE: Multi-teacher support: We do NOT reject other teachers assigned to this section!
  return { success: true };
}

export function unassignSection(sectionId: string, teacherId?: string) {
  const now = new Date().toISOString();

  if (teacherId) {
    // Find the assignment record ID for cloud deletion
    const existingAsgn = db.prepare(`
      SELECT id FROM section_assignments WHERE section_id = ? AND teacher_id = ?
    `).get(sectionId, teacherId) as any;

    // Unassign only this specific teacher from the section
    db.prepare(`
      DELETE FROM section_assignments
      WHERE section_id = ? AND teacher_id = ?
    `).run(sectionId, teacherId);

    if (existingAsgn) {
      try {
        cloudDeleteAssignment(existingAsgn.id);
      } catch {
        // Ignore
      }
    }

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

    try {
      syncSectionToCloud(sectionId);
    } catch {
      // Ignore
    }
  } else {
    // Unassign all teachers from this section
    const allAsgns = db.prepare(`
      SELECT id FROM section_assignments WHERE section_id = ?
    `).all(sectionId) as any[];

    db.prepare(`
      DELETE FROM section_assignments
      WHERE section_id = ?
    `).run(sectionId);

    for (const a of allAsgns) {
      try {
        cloudDeleteAssignment(a.id);
      } catch {
        // Ignore
      }
    }

    db.prepare(`
      UPDATE sections
      SET assigned_teacher_id = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, sectionId);

    try {
      syncSectionToCloud(sectionId);
    } catch {
      // Ignore
    }
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

  syncUserToCloud(user.id);

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

  syncUserToCloud(teacherId);

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
  syncUserToCloud(teacherId);
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

  syncUserToCloud(teacherId);

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
  const nowUtc = new Date();
  const todayIso = nowUtc.toISOString().split('T')[0];
  const todayFr = `${String(nowUtc.getUTCDate()).padStart(2, '0')}/${String(nowUtc.getUTCMonth() + 1).padStart(2, '0')}/${nowUtc.getUTCFullYear()}`;

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
  syncUserToCloud(id);

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

  syncUserToCloud(directorId);

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

  syncUserToCloud(directorId);

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

  syncUserToCloud(directorId);

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
  db.prepare("INSERT OR REPLACE INTO deleted_tombstones (type, item_id, created_at) VALUES ('user', ?, ?)").run(directorId, now);
  cloudDeleteUser(directorId);

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
           COALESCE(s.massar_number, '') as massar_number,
           ah.status, ah.recorded_date, ah.session_period, ah.teacher_name, ah.teacher_subject,
           ah.justified, ah.justification_reason, ah.notes, ah.created_at,
           ah.remover_name, ah.remover_subject, ah.removed_at,
           ah.absence_mode, ah.duration_hours, ah.duration_days, ah.duration_label,
           sec.level as section_level, sec.class_number as section_class,
           sec.roster_json
    FROM attendance_history ah
    JOIN sections sec ON ah.section_id = sec.id
    LEFT JOIN seats s ON ah.section_id = s.section_id AND ah.seat_num = s.seat_num
    WHERE ah.recorded_date IN (${datePlaceholders})
  `;
  const absenceParams: any[] = [...dateList];

  if (teacherId) {
    absenceQuery += ` AND (ah.created_by = ? OR ah.teacher_name = (SELECT full_name FROM users WHERE id = ?))`;
    absenceParams.push(teacherId, teacherId);
  }

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
    absences: absencesRows.map(r => {
      let massar = r.massar_number || '';
      if (!massar && r.roster_json) {
        try {
          const roster = JSON.parse(r.roster_json);
          const cleanName = (r.student_name || '').trim().toLowerCase();
          const cleanNum = String(r.student_number || '').trim();
          const match = roster.find((item: any) =>
            (cleanName && item.name && item.name.trim().toLowerCase() === cleanName) ||
            (cleanNum && item.number && String(item.number).trim() === cleanNum)
          );
          if (match?.massarNumber || match?.massar_number) {
            massar = match.massarNumber || match.massar_number;
          }
        } catch {}
      }

      let durationHours = Number(r.duration_hours || 0);
      let durationDays = Number(r.duration_days || 0);
      let durationLabel = r.duration_label || '';
      let isOngoing = false;

      const isDayAbsence = r.absence_mode === 'days' || r.session_period === 'كامل اليوم';

      if (isDayAbsence) {
        durationDays = 1;
        durationLabel = '1 يوم (يوم كامل)';
      } else {
        if (r.removed_at) {
          if (!durationHours) durationHours = calculateHoursDifference(r.created_at, r.removed_at);
          durationLabel = formatHoursInArabic(durationHours);
        } else {
          durationHours = calculateHoursDifference(r.created_at, new Date().toISOString());
          durationLabel = `${formatHoursInArabic(durationHours)} (جاري)`;
          isOngoing = true;
        }
      }

      return {
        id: r.id,
        sectionId: r.section_id,
        sectionLevel: r.section_level,
        sectionClass: r.section_class,
        seatNum: r.seat_num,
        studentName: r.student_name,
        studentNumber: r.student_number || '',
        massarNumber: massar,
        status: r.status || 'absent',
        recordedDate: r.recorded_date,
        sessionPeriod: isDayAbsence ? 'كامل اليوم' : durationLabel,
        teacherName: r.teacher_name || '',
        teacherSubject: r.teacher_subject || '',
        removerName: r.remover_name || '',
        removerSubject: r.remover_subject || '',
        removedAt: r.removed_at || null,
        absenceMode: isDayAbsence ? 'days' : 'hours',
        durationHours,
        durationDays,
        durationLabel,
        isOngoing,
        justified: r.justified || 'unjustified',
        justificationReason: r.justification_reason || '',
        notes: r.notes || '',
        createdAt: r.created_at
      };
    }),
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

export function getStudentHistory(sectionId: string, seatNum: number, studentName?: string, studentNumber?: string, viewerId?: string) {
  let targetName = (studentName || '').trim();
  let targetNumber = (studentNumber || '').trim();

  // If name and number are not provided, find who currently occupies seatNum
  if (!targetName && !targetNumber) {
    if (viewerId) {
      const override = db.prepare('SELECT student_name, student_number FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ? AND seat_num = ?').get(viewerId, sectionId, seatNum) as any;
      if (override && override.student_name && override.student_name.trim()) {
        targetName = override.student_name.trim();
        targetNumber = (override.student_number || '').trim();
      }
    }
    if (!targetName && !targetNumber) {
      const canonical = db.prepare('SELECT student_name, student_number FROM seats WHERE section_id = ? AND seat_num = ?').get(sectionId, seatNum) as any;
      if (canonical) {
        targetName = (canonical.student_name || '').trim();
        targetNumber = (canonical.student_number || '').trim();
      }
    }
  }

  let absences: any[] = [];
  let violations: any[] = [];

  if (targetName || targetNumber) {
    absences = db.prepare(`
      SELECT id, status, recorded_date, session_period, teacher_name, teacher_subject,
             justified, justification_reason, notes, created_at, created_by,
             removed_by, removed_at, remover_name, remover_subject,
             absence_mode, duration_hours, duration_days, duration_label
      FROM attendance_history
      WHERE section_id = ? AND (
        (student_number != '' AND student_number = ?)
        OR (student_name != '' AND LOWER(TRIM(student_name)) = LOWER(TRIM(?)))
        OR (seat_num = ? AND student_name = '')
      )
      ORDER BY recorded_date DESC, created_at DESC
    `).all(sectionId, targetNumber || '__none__', targetName || '__none__', seatNum) as any[];

    violations = db.prepare(`
      SELECT id, violation_type, description, action_taken, teacher_name,
             teacher_subject, recorded_date, recorded_time, created_at
      FROM daily_violations
      WHERE section_id = ? AND (
        (student_number != '' AND student_number = ?)
        OR (student_name != '' AND LOWER(TRIM(student_name)) = LOWER(TRIM(?)))
        OR (seat_num = ? AND student_name = '')
      )
      ORDER BY recorded_date DESC, recorded_time DESC, created_at DESC
    `).all(sectionId, targetNumber || '__none__', targetName || '__none__', seatNum) as any[];
  } else {
    absences = db.prepare(`
      SELECT id, status, recorded_date, session_period, teacher_name, teacher_subject,
             justified, justification_reason, notes, created_at, created_by,
             removed_by, removed_at, remover_name, remover_subject,
             absence_mode, duration_hours, duration_days, duration_label
      FROM attendance_history
      WHERE section_id = ? AND seat_num = ?
      ORDER BY recorded_date DESC, created_at DESC
    `).all(sectionId, seatNum) as any[];

    violations = db.prepare(`
      SELECT id, violation_type, description, action_taken, teacher_name,
             teacher_subject, recorded_date, recorded_time, created_at
      FROM daily_violations
      WHERE section_id = ? AND seat_num = ?
      ORDER BY recorded_date DESC, recorded_time DESC, created_at DESC
    `).all(sectionId, seatNum) as any[];
  }

  const days = Array.from(new Set(
    absences
      .filter((absence) => absence.status === 'absent')
      .map((absence) => absence.recorded_date)
      .filter(Boolean)
  ));

  let totalHours = 0;
  let totalDays = 0;

  const mappedAbsences = absences.map((absence) => {
    let durationHours = Number(absence.duration_hours || 0);
    let durationDays = Number(absence.duration_days || 0);
    let durationLabel = absence.duration_label || '';
    let isOngoing = false;

    const isDayAbsence = absence.absence_mode === 'days' || absence.session_period === 'كامل اليوم';

    if (isDayAbsence) {
      durationDays = 1;
      durationLabel = '1 يوم (يوم كامل)';
      if (absence.status === 'absent') totalDays += 1;
    } else {
      // Hours-based absence
      if (absence.removed_at) {
        if (!durationHours) durationHours = calculateHoursDifference(absence.created_at, absence.removed_at);
        durationLabel = formatHoursInArabic(durationHours);
      } else {
        // Still ongoing absence
        durationHours = calculateHoursDifference(absence.created_at, new Date().toISOString());
        durationLabel = `${formatHoursInArabic(durationHours)} (جاري)`;
        isOngoing = true;
      }
      if (absence.status === 'absent') totalHours += durationHours;
    }

    return {
      id: absence.id,
      status: absence.status,
      recordedDate: absence.recorded_date,
      sessionPeriod: isDayAbsence ? 'كامل اليوم' : durationLabel,
      teacherName: absence.teacher_name || '',
      teacherSubject: absence.teacher_subject || '',
      removerName: absence.remover_name || '',
      removerSubject: absence.remover_subject || '',
      removedAt: absence.removed_at || null,
      absenceMode: isDayAbsence ? 'days' : 'hours',
      durationHours,
      durationDays,
      durationLabel,
      isOngoing,
      justified: absence.justified || 'unjustified',
      justificationReason: absence.justification_reason || '',
      notes: absence.notes || '',
      createdAt: absence.created_at
    };
  });

  return {
    studentName: targetName,
    studentNumber: targetNumber,
    absences: mappedAbsences,
    absenceDays: days,
    absenceRecordCount: mappedAbsences.filter((absence) => absence.status === 'absent').length,
    totalHours,
    totalDays,
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
  absenceMode?: 'hours' | 'days';
  durationHours?: number;
  durationDays?: number;
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

  const isDay = data.absenceMode === 'days' || (data.sessionPeriod && data.sessionPeriod.includes('يوم'));
  const absenceMode = isDay ? 'days' : 'hours';
  const durationHours = isDay ? 0 : (data.durationHours || 1);
  const durationDays = isDay ? (data.durationDays || 1) : 0;
  const durationLabel = isDay ? formatDaysInArabic(durationDays) : formatHoursInArabic(durationHours);

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
      justified, justification_reason, notes, created_at,
      absence_mode, duration_hours, duration_days, duration_label
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.sectionId,
    seatNum,
    data.studentName.trim(),
    (data.studentNumber || '').trim(),
    status,
    date,
    data.sessionPeriod || (isDay ? 'كامل اليوم' : durationLabel),
    teacherName,
    teacherSubject,
    data.justified || 'unjustified',
    (data.justificationReason || '').trim(),
    (data.notes || '').trim(),
    now,
    absenceMode,
    durationHours,
    durationDays,
    durationLabel
  );

  const newId = Number(res.lastInsertRowid);

  // 1. Immediately persist to Firestore cloud
  try {
    cloudSaveAttendance({
      id: String(newId),
      sectionId: data.sectionId,
      seatNum,
      studentName: data.studentName.trim(),
      studentNumber: (data.studentNumber || '').trim(),
      status,
      date,
      time: now.slice(11, 16),
      session: data.sessionPeriod || (isDay ? 'كامل اليوم' : durationLabel),
      subject: teacherSubject,
      teacherName,
      isJustified: data.justified === 'justified',
      justificationReason: data.justificationReason || '',
      absenceMode,
      durationHours,
      durationDays,
      durationLabel,
      createdAt: now
    });
  } catch (cloudErr) {
    console.warn('[addDailyAbsence] cloudSaveAttendance warning:', cloudErr);
  }

  // 2. Also reflect in seats table if the recorded date is today
  try {
    const today = now.slice(0, 10);
    if (date === today) {
      if (seatNum > 0) {
        db.prepare('UPDATE seats SET attendance = ?, updated_at = ? WHERE section_id = ? AND seat_num = ?')
          .run(status, now, data.sectionId, seatNum);
      } else if (data.studentName) {
        db.prepare('UPDATE seats SET attendance = ?, updated_at = ? WHERE section_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))')
          .run(status, now, data.sectionId, data.studentName.trim());
      }
    }
  } catch {}

  return { success: true, id: newId };
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

  try {
    cloudSaveAttendance({
      ...existing,
      status,
      session: sessionPeriod,
      isJustified: justified === 'justified',
      justificationReason,
      notes
    });
  } catch {}

  return { success: true };
}

export function resolveDailyAbsence(id: number, actor: { id?: string; name?: string; role?: string; subject?: string }) {
  const existing = db.prepare('SELECT * FROM attendance_history WHERE id = ?').get(id) as any;
  if (!existing) throw new Error('سجل الغياب غير موجود');

  const now = new Date().toISOString();
  const removerName = actor.name || (actor.role === 'admin' ? 'المشرف العام' : (actor.role === 'director' ? 'إدارة المؤسسة' : 'الأستاذ'));
  const removerSubject = actor.subject || '';

  const hours = calculateHoursDifference(existing.created_at || now, now);
  const durationLabel = formatHoursInArabic(hours);

  db.prepare(`
    UPDATE attendance_history SET
      removed_by = ?,
      removed_at = ?,
      remover_name = ?,
      remover_subject = ?,
      duration_hours = ?,
      duration_label = ?,
      count_in_stats = 1
    WHERE id = ?
  `).run(actor.id || '', now, removerName, removerSubject, hours, durationLabel, id);

  // Also remove absence state from active seats in class map if today
  try {
    const today = now.slice(0, 10);
    if (existing.recorded_date === today) {
      if (existing.seat_num > 0) {
        db.prepare('UPDATE seats SET attendance = NULL WHERE section_id = ? AND seat_num = ? AND attendance = ?')
          .run(existing.section_id, existing.seat_num, existing.status);
      }
      if (existing.student_name) {
        db.prepare('UPDATE seats SET attendance = NULL WHERE section_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?)) AND attendance = ?')
          .run(existing.section_id, existing.student_name.trim(), existing.status);
      }
    }
  } catch {}

  try {
    cloudSaveAttendance({
      ...existing,
      removedBy: actor.id || '',
      removedAt: now,
      removerName,
      removerSubject,
      durationHours: hours,
      durationLabel,
      countInStats: 1
    });
  } catch {}

  return { success: true, message: 'تم إنهاء حالة الغياب الحالي وتوثيقها في الأرشيف كسجل مسوّى بنجاح' };
}

export function deleteDailyAbsence(id: number) {
  const existing = db.prepare('SELECT * FROM attendance_history WHERE id = ?').get(id) as any;
  db.prepare('DELETE FROM attendance_history WHERE id = ?').run(id);

  if (existing) {
    // 1. Delete from Firestore cloud so it NEVER resurrects!
    try {
      cloudDeleteAttendance(String(id));
    } catch (err) {
      console.warn('[deleteDailyAbsence] cloudDeleteAttendance warning:', err);
    }

    // 2. Also reset attendance in seats table if it was today's attendance
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (existing.recorded_date === today) {
        if (existing.seat_num > 0) {
          db.prepare('UPDATE seats SET attendance = NULL WHERE section_id = ? AND seat_num = ? AND attendance = ?')
            .run(existing.section_id, existing.seat_num, existing.status);
        }
        if (existing.student_name) {
          db.prepare('UPDATE seats SET attendance = NULL WHERE section_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?)) AND attendance = ?')
            .run(existing.section_id, existing.student_name.trim(), existing.status);
        }
      }
    } catch {}
  }

  return { success: true };
}

export function batchImportDailyAbsences(items: Array<{
  massarNumber?: string;
  studentName?: string;
  studentNumber?: string;
  sectionLevel?: string;
  sectionClass?: string;
  sectionId?: string;
  seatNum?: number;
  status?: 'absent' | 'late';
  recordedDate?: string;
  sessionPeriod?: string;
  teacherName?: string;
  teacherSubject?: string;
  justified?: string;
  justificationReason?: string;
  notes?: string;
}>) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  let importedCount = 0;
  let matchedStudentsCount = 0;

  // Cache sections, seats, and roster for rapid resolution
  const sectionsList = db.prepare('SELECT id, level, class_number, roster_json FROM sections').all() as any[];
  const allSeats = db.prepare('SELECT section_id, seat_num, student_name, student_number, massar_number FROM seats WHERE student_name != ""').all() as any[];
  const allRosters: Array<{ section_id: string; name: string; number: string; massar_number: string }> = [];
  for (const sec of sectionsList) {
    try {
      const list = JSON.parse(sec.roster_json || '[]');
      for (const r of list) {
        allRosters.push({
          section_id: sec.id,
          name: r.name || '',
          number: r.number || '',
          massar_number: r.massarNumber || r.massar_number || ''
        });
      }
    } catch {}
  }

  for (const item of items) {
    let resolvedSectionId = item.sectionId || '';
    let resolvedSeatNum = item.seatNum || 0;
    let resolvedStudentName = (item.studentName || '').trim();
    let resolvedStudentNumber = (item.studentNumber || '').trim();
    const massarClean = (item.massarNumber || '').trim();

    // 1. Match by massar_number
    if (massarClean) {
      const seatMatch = allSeats.find((s) => s.massar_number && s.massar_number.trim().toLowerCase() === massarClean.toLowerCase());
      if (seatMatch) {
        resolvedSectionId = seatMatch.section_id;
        resolvedSeatNum = seatMatch.seat_num;
        if (!resolvedStudentName) resolvedStudentName = seatMatch.student_name;
        if (!resolvedStudentNumber) resolvedStudentNumber = seatMatch.student_number;
        matchedStudentsCount++;
      } else {
        const rosterMatch = allRosters.find((r) => r.massar_number && r.massar_number.trim().toLowerCase() === massarClean.toLowerCase());
        if (rosterMatch) {
          resolvedSectionId = rosterMatch.section_id;
          if (!resolvedStudentName) resolvedStudentName = rosterMatch.name;
          if (!resolvedStudentNumber) resolvedStudentNumber = rosterMatch.number;
          const stSeat = allSeats.find((s) => s.section_id === resolvedSectionId && (s.student_name === resolvedStudentName || s.student_number === resolvedStudentNumber));
          if (stSeat) resolvedSeatNum = stSeat.seat_num;
          matchedStudentsCount++;
        }
      }
    }

    // 2. Match by section + studentName
    if (!resolvedSectionId && item.sectionLevel && item.sectionClass) {
      const secMatch = sectionsList.find((sec) =>
        sec.level.trim().toLowerCase() === item.sectionLevel!.trim().toLowerCase() &&
        String(sec.class_number).trim() === String(item.sectionClass).trim()
      );
      if (secMatch) {
        resolvedSectionId = secMatch.id;
        if (resolvedStudentName) {
          const stSeat = allSeats.find((s) => s.section_id === resolvedSectionId && s.student_name.toLowerCase().includes(resolvedStudentName.toLowerCase()));
          if (stSeat) {
            resolvedSeatNum = stSeat.seat_num;
            resolvedStudentName = stSeat.student_name;
            resolvedStudentNumber = stSeat.student_number;
            matchedStudentsCount++;
          }
        }
      }
    }

    // Fallback: assign to first section if unknown
    if (!resolvedSectionId) {
      if (sectionsList.length > 0) {
        resolvedSectionId = sectionsList[0].id;
      } else {
        continue;
      }
    }

    if (!resolvedStudentName && !massarClean) continue;
    if (!resolvedStudentName) resolvedStudentName = massarClean;

    const date = item.recordedDate && item.recordedDate.trim() ? item.recordedDate.trim() : today;
    const status = item.status === 'late' ? 'late' : 'absent';
    const period = item.sessionPeriod || 'كامل اليوم';

    db.prepare(`
      INSERT INTO attendance_history (
        section_id, seat_num, student_name, student_number,
        status, recorded_date, session_period, teacher_name, teacher_subject,
        justified, justification_reason, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      resolvedSectionId,
      resolvedSeatNum,
      resolvedStudentName,
      resolvedStudentNumber,
      status,
      date,
      period,
      item.teacherName || '',
      item.teacherSubject || '',
      item.justified || 'unjustified',
      item.justificationReason || '',
      item.notes || 'مستورد من مسار',
      now
    );

    // Update real-time seat attendance if absence is for today
    if (date === today && resolvedSeatNum > 0) {
      try {
        db.prepare(`
          UPDATE seats SET attendance = ?, updated_at = ?
          WHERE section_id = ? AND seat_num = ?
        `).run(status, now, resolvedSectionId, resolvedSeatNum);
      } catch {
        // Ignored
      }
    }

    importedCount++;
  }

  return { success: true, importedCount, matchedStudentsCount };
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
  const time = data.recordedTime || new Date().toLocaleTimeString('ar-MA', { timeZone: 'UTC', hour12: false, hour: '2-digit', minute: '2-digit' }) || '08:30';

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
  const usersToDelete = db.prepare("SELECT id FROM users WHERE role NOT IN ('admin', 'director') AND username NOT IN ('admin', 'directeur') AND email NOT LIKE '%samir%'").all() as { id: string }[];

  // 2. Clear transactional/operational tables in SQLite
  db.prepare('DELETE FROM seats').run();
  db.prepare('DELETE FROM notes').run();
  db.prepare('DELETE FROM daily_violations').run();
  db.prepare('DELETE FROM positive_participations').run();
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
  try {
    db.prepare('DELETE FROM deleted_tombstones').run();
  } catch {}

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
    const { listDocs, deleteDoc, setDoc, batchDeleteDocs } = await import('./firestoreService.ts');
    const { writeSnapshot } = await import('./cloudBackup.ts');
    const collectionsToClean = [
      'sections',
      'seats',
      'notes',
      'daily_violations',
      'positive_participations',
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
        if (Array.isArray(docs) && docs.length > 0) {
          const ids = docs.map((d) => d.id).filter(Boolean);
          if (ids.length > 0) {
            await batchDeleteDocs(col, ids);
          }
        }
      } catch (colErr: any) {
        console.warn(`[resetAllDataToZero] Note while cleaning collection ${col}:`, colErr?.message);
      }
    }

    // Clean non-admin, non-director users from Firestore
    try {
      const allUsers = await listDocs('users');
      if (Array.isArray(allUsers)) {
        const toDelete: string[] = [];
        for (const u of allUsers) {
          const isSuperAdminOrDirector = u.role === 'admin' || u.role === 'director' || u.username === 'admin' || u.username === 'directeur' || (u.email && u.email.includes('samir')) || u.id === 'usr_admin_samir';
          if (!isSuperAdminOrDirector && u.id) {
            toDelete.push(u.id);
          }
        }
        if (toDelete.length > 0) {
          await batchDeleteDocs('users', toDelete);
        }
      }

      // Re-save / guarantee super admin and directors in Firestore
      const preservedUsers = db.prepare("SELECT * FROM users WHERE role IN ('admin', 'director')").all() as any[];
      for (const pUser of preservedUsers) {
        await setDoc('users', pUser.id, {
          id: pUser.id,
          username: pUser.username,
          email: pUser.email,
          fullName: pUser.full_name,
          role: pUser.role,
          status: 'active',
          academicYear: pUser.academic_year || '2026/2027',
          emailVerified: true,
          createdAt: pUser.created_at,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (usersErr: any) {
      console.warn('[resetAllDataToZero] Error cleaning users from Firestore:', usersErr?.message);
    }

    // Save a clean cloud snapshot with 0 sections
    try {
      await writeSnapshot('reset');
    } catch (snapErr: any) {
      console.warn('[resetAllDataToZero] Error writing clean snapshot:', snapErr?.message);
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

  // Ensure the section assignment is also preserved and approved for this teacher and section
  if (data.sectionId) {
    try {
      const teacher = findUserById(teacherId);
      const subject = (data.subject || teacher?.subject || 'عام').trim();
      const existingAsgn = db.prepare(`
        SELECT id FROM section_assignments WHERE teacher_id = ? AND section_id = ?
      `).get(teacherId, data.sectionId) as any;

      const asgnId = existingAsgn?.id || ('asgn_tt_' + teacherId.replace(/^usr_/, '') + '_' + data.sectionId.replace(/^sec_/, ''));
      if (existingAsgn) {
        db.prepare(`
          UPDATE section_assignments
          SET status = 'approved', reviewed_by = 'system', reviewed_at = ?, subject = ?
          WHERE id = ?
        `).run(now, subject, existingAsgn.id);
      } else {
        db.prepare(`
          INSERT INTO section_assignments (id, teacher_id, section_id, status, request_note, requested_at, reviewed_at, reviewed_by, academic_year, subject)
          VALUES (?, ?, ?, 'approved', 'إسناد معتمد من استعمال الزمان', ?, ?, 'system', ?, ?)
        `).run(asgnId, teacherId, data.sectionId, now, now, teacher?.academicYear || '2026/2027', subject);
      }

      db.prepare(`
        UPDATE sections
        SET assigned_teacher_id = COALESCE(assigned_teacher_id, ?), updated_at = ?
        WHERE id = ?
      `).run(teacherId, now, data.sectionId);

      cloudSaveAssignment({
        id: asgnId,
        teacherId,
        sectionId: data.sectionId,
        status: 'approved',
        requestNote: 'إسناد معتمد من استعمال الزمان',
        requestedAt: now,
        reviewedAt: now,
        reviewedBy: 'system',
        academicYear: teacher?.academicYear || '2026/2027',
        subject
      });
      syncSectionToCloud(data.sectionId);
    } catch (asgnErr) {
      console.warn('Error linking timetable to section_assignment:', asgnErr);
    }
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

// ---------------- Wipe All Data Except Admin ----------------
export function wipeAllDataExceptAdmin() {
  const now = new Date().toISOString();
  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Wipe all academic and operational data safely
    const tablesToWipe = [
      'sections',
      'seats',
      'notes',
      'positive_participations',
      'daily_violations',
      'attendance_history',
      'section_assignments',
      'teacher_seat_overrides',
      'teacher_timetable',
      'student_change_requests',
      'school_activities',
      'change_history',
      'email_outbox',
      'password_resets',
      'verification_codes'
    ];
    for (const tbl of tablesToWipe) {
      try {
        db.prepare(`DELETE FROM ${tbl}`).run();
      } catch {
        // Table might not exist in some schema versions
      }
    }

    // 2. Wipe all users except the Admin (Super Supervisor)
    db.prepare("DELETE FROM users WHERE role != 'admin' AND id != 'usr_admin_samir' AND username != 'admin'").run();

    // 3. Ensure the Super Admin account is intact and active
    db.prepare(`
      INSERT INTO users (
        id, username, email, password, full_name, role, academic_year, status, email_verified,
        must_change_profile, must_change_password, created_at, updated_at
      ) VALUES (
        'usr_admin_samir', 'admin', 'mrsamiro69@gmail.com', 'Samir@0102.',
        'الأستاذ: سمير القراشي (المشرف العام على التطبيق)', 'admin', '2026/2027', 'active', 1,
        0, 0, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        username = 'admin',
        email = 'mrsamiro69@gmail.com',
        password = 'Samir@0102.',
        full_name = 'الأستاذ: سمير القراشي (المشرف العام على التطبيق)',
        role = 'admin',
        academic_year = '2026/2027',
        status = 'active',
        email_verified = 1,
        updated_at = excluded.updated_at
    `).run(now, now);

    // 4. Mark data reset as completed in app_settings so sample data is never re-seeded
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('data_reset_completed', 'true', ?)
      ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = ?
    `).run(now, now);

    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('institution', 'الثانوية الإعدادية ايكسان', ?)
      ON CONFLICT(key) DO UPDATE SET value = 'الثانوية الإعدادية ايكسان', updated_at = ?
    `).run(now, now);

    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('year', '2026/2027', ?)
      ON CONFLICT(key) DO UPDATE SET value = '2026/2027', updated_at = ?
    `).run(now, now);

    // 5. Insert fresh initial log
    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'wipe_all_data',
      'تم مسح جميع البيانات والبدء من جديد (تم الاحتفاظ فقط بحساب المشرف العام)',
      JSON.stringify({ preservedUser: 'admin (mrsamiro69@gmail.com)' }),
      now
    );

    db.exec('COMMIT;');
    return {
      success: true,
      message: 'تم مسح كافة البيانات بنجاح، وتم الاحتفاظ فقط بحساب المشرف العام (Admin).'
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function addPositiveParticipation(data: {
  sectionId: string;
  seatNum?: number;
  studentName?: string;
  studentNumber?: string;
  massarNumber?: string;
  participationType?: string;
  points?: number;
  note?: string;
  teacherId?: string;
  teacherName?: string;
  teacherSubject?: string;
  recordedDate?: string;
  recordedTime?: string;
}) {
  const id = `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const recordedDate = data.recordedDate || now.toISOString().slice(0, 10);
  const recordedTime = data.recordedTime || now.toTimeString().slice(0, 5);
  const createdAt = now.toISOString();
  const points = Math.max(1, Number(data.points || 1));
  const participationType = data.participationType || 'مشاركة متميزة';

  let studentName = (data.studentName || '').trim();
  let studentNumber = (data.studentNumber || '').trim();
  let massarNumber = (data.massarNumber || '').trim();

  // If student name not explicitly provided, find the student CURRENTLY occupying this seat
  if (!studentName && data.seatNum && data.sectionId) {
    let seat: any = null;
    if (data.teacherId) {
      seat = db.prepare('SELECT student_name, student_number, massar_number FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ? AND seat_num = ?').get(data.teacherId, data.sectionId, data.seatNum) as any;
    }
    if (!seat || !seat.student_name) {
      seat = db.prepare('SELECT student_name, student_number, massar_number FROM seats WHERE section_id = ? AND seat_num = ?').get(data.sectionId, data.seatNum) as any;
    }
    if (seat && seat.student_name) {
      studentName = seat.student_name.trim();
      if (!studentNumber && seat.student_number) studentNumber = String(seat.student_number).trim();
      if (!massarNumber && seat.massar_number) massarNumber = String(seat.massar_number).trim();
    }
  }

  // Resolve where the student is actually seated in this section
  let resolvedSeatNum = data.seatNum || null;
  if (studentName && data.sectionId) {
    if (data.teacherId) {
      const overrideSeat = db.prepare(`
        SELECT seat_num, student_number, massar_number FROM teacher_seat_overrides
        WHERE teacher_id = ? AND section_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))
        LIMIT 1
      `).get(data.teacherId, data.sectionId, studentName) as any;
      if (overrideSeat) {
        resolvedSeatNum = overrideSeat.seat_num;
        if (!studentNumber && overrideSeat.student_number) studentNumber = String(overrideSeat.student_number).trim();
        if (!massarNumber && overrideSeat.massar_number) massarNumber = String(overrideSeat.massar_number).trim();
      }
    }
    if (!resolvedSeatNum) {
      const canonicalSeat = db.prepare(`
        SELECT seat_num, student_number, massar_number FROM seats
        WHERE section_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))
        LIMIT 1
      `).get(data.sectionId, studentName) as any;
      if (canonicalSeat) {
        resolvedSeatNum = canonicalSeat.seat_num;
        if (!studentNumber && canonicalSeat.student_number) studentNumber = String(canonicalSeat.student_number).trim();
        if (!massarNumber && canonicalSeat.massar_number) massarNumber = String(canonicalSeat.massar_number).trim();
      }
    }
  }

  // Enrich with roster details if available to ensure student identity integrity
  if (studentName && data.sectionId) {
    const secInfo = db.prepare('SELECT roster_json FROM sections WHERE id = ?').get(data.sectionId) as any;
    if (secInfo && secInfo.roster_json) {
      try {
        const roster = JSON.parse(secInfo.roster_json);
        const matchedRoster = roster.find((r: any) =>
          matchStudent(r.name, r.number, r.massarNumber, studentName, studentNumber, massarNumber)
        );
        if (matchedRoster) {
          if (!studentNumber && matchedRoster.number) studentNumber = String(matchedRoster.number).trim();
          if (!massarNumber && matchedRoster.massarNumber) massarNumber = String(matchedRoster.massarNumber).trim();
        }
      } catch {}
    }
  }

  if (!studentName) {
    throw new Error('لا يمكن تسجيل مشاركة إيجابية لمقعد فارغ بدون تلميذ. يرجى تعيين تلميذ في المقعد أولاً.');
  }

  let teacherName = (data.teacherName || '').trim();
  let teacherSubject = (data.teacherSubject || '').trim();
  if (!teacherName && data.sectionId) {
    const secInfo = db.prepare(`
      SELECT sec.level, sec.class_number, u.full_name as teacher_name, u.subject as teacher_subject
      FROM sections sec
      LEFT JOIN users u ON sec.assigned_teacher_id = u.id
      WHERE sec.id = ?
    `).get(data.sectionId) as any;
    if (secInfo) {
      teacherName = secInfo.teacher_name || 'أستاذ المادة';
      teacherSubject = secInfo.teacher_subject || 'المادة';
    }
  }

  db.prepare(`
    INSERT INTO positive_participations (
      id, section_id, seat_num, student_name, student_number, massar_number,
      participation_type, points, note, teacher_id, teacher_name, teacher_subject,
      recorded_date, recorded_time, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.sectionId,
    resolvedSeatNum,
    studentName,
    studentNumber,
    massarNumber,
    participationType,
    points,
    data.note || '',
    data.teacherId || '',
    teacherName,
    teacherSubject,
    recordedDate,
    recordedTime,
    createdAt
  );

  cloudSavePositiveParticipation({
    id,
    sectionId: data.sectionId,
    seatNum: resolvedSeatNum,
    studentName,
    studentNumber,
    massarNumber,
    participationType,
    points,
    note: data.note,
    teacherId: data.teacherId,
    teacherName,
    teacherSubject,
    recordedDate,
    recordedTime,
    createdAt
  });

  return {
    id,
    sectionId: data.sectionId,
    seatNum: data.seatNum || null,
    studentName,
    studentNumber,
    massarNumber,
    participationType,
    points,
    note: data.note,
    teacherId: data.teacherId,
    teacherName,
    teacherSubject,
    recordedDate,
    recordedTime,
    createdAt
  };
}

export function deletePositiveParticipation(id: string) {
  db.prepare('DELETE FROM positive_participations WHERE id = ?').run(id);
  cloudDeletePositiveParticipation(id);
  return { success: true };
}

export function getPositiveParticipationsBySection(sectionId: string, teacherId?: string) {
  let query = `
    SELECT id, section_id as sectionId, seat_num as seatNum, student_name as studentName,
           student_number as studentNumber, massar_number as massarNumber,
           participation_type as participationType, points, note, teacher_id as teacherId,
           teacher_name as teacherName, teacher_subject as teacherSubject,
           recorded_date as recordedDate, recorded_time as recordedTime, created_at as createdAt
    FROM positive_participations
    WHERE section_id = ?
  `;
  const params: any[] = [sectionId];
  if (teacherId) {
    query += ' AND teacher_id = ?';
    params.push(teacherId);
  }
  query += ' ORDER BY created_at DESC';
  const participations = db.prepare(query).all(...params) as any[];

  // Dynamically resolve each participation's CURRENT seat based on where the student is currently sitting
  const currentSeats = teacherId
    ? db.prepare(`
        SELECT seat_num, student_name, student_number, massar_number
        FROM teacher_seat_overrides
        WHERE teacher_id = ? AND section_id = ? AND student_name != ''
        UNION
        SELECT seat_num, student_name, student_number, massar_number
        FROM seats
        WHERE section_id = ? AND student_name != '' AND seat_num NOT IN (
          SELECT seat_num FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ?
        )
      `).all(teacherId, sectionId, sectionId, teacherId, sectionId) as any[]
    : db.prepare(`
        SELECT seat_num, student_name, student_number, massar_number
        FROM seats
        WHERE section_id = ? AND student_name != ''
      `).all(sectionId) as any[];

  return participations.map((p) => {
    const matchedSeat = currentSeats.find((s) =>
      matchStudent(s.student_name, s.student_number, s.massar_number, p.studentName, p.studentNumber, p.massarNumber)
    );
    return {
      ...p,
      seatNum: matchedSeat ? matchedSeat.seat_num : null
    };
  });
}



