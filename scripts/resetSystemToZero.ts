import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { 
  getDoc, 
  setDoc, 
  deleteDoc, 
  listDocs, 
  deleteDocumentByPath, 
  queryAllDocPaths 
} from '../server/firestoreService.ts';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'classroom_database.sqlite');

async function main() {
  console.log('🚀 Starting system data reset to ZERO (Preserving General Supervisor ONLY)...');

  if (!fs.existsSync(DB_PATH)) {
    console.log('⚠️ Local SQLite file does not exist yet at:', DB_PATH);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = OFF;');

  // 1. Get current SQLite stats
  try {
    const secCount = (db.prepare('SELECT COUNT(*) as c FROM sections').get() as any)?.c || 0;
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
    const violCount = (db.prepare('SELECT COUNT(*) as c FROM daily_violations').get() as any)?.c || 0;
    const noteCount = (db.prepare('SELECT COUNT(*) as c FROM notes').get() as any)?.c || 0;
    const actCount = (db.prepare('SELECT COUNT(*) as c FROM school_activities').get() as any)?.c || 0;
    console.log(`📊 Current SQLite Data Counts: Sections=${secCount}, Users=${userCount}, Violations=${violCount}, Notes=${noteCount}, Activities=${actCount}`);
  } catch (e: any) {
    console.log('SQLite read error:', e.message);
  }

  // 2. Wipe Firestore data
  console.log('\n🔥 Cleaning Firestore collections...');

  const collectionsToClearDescendants = [
    'sections',
    'seats',
    'notes',
    'violations',
    'daily_violations',
    'teacher_seat_overrides',
    'attendance_history',
    'section_assignments',
    'student_change_requests',
    'school_activities',
    'db_snapshots',
    'db_snapshot_chunks'
  ];

  for (const col of collectionsToClearDescendants) {
    try {
      console.log(`Querying all doc paths for collection: "${col}"...`);
      const paths = await queryAllDocPaths(col);
      console.log(`Found ${paths.length} docs in "${col}" (including descendants). Deleting...`);
      for (const p of paths) {
        await deleteDocumentByPath(p);
      }
    } catch (err: any) {
      console.error(`Error clearing collection "${col}":`, err?.message || err);
    }
  }

  // Also query root docs directly in case runQuery with descendants missed any root-only collections
  for (const col of ['sections', 'seats', 'notes', 'daily_violations', 'teacher_seat_overrides', 'attendance_history', 'section_assignments', 'student_change_requests', 'school_activities', 'db_snapshots', 'db_snapshot_chunks']) {
    try {
      const docs = await listDocs(col);
      if (docs && docs.length > 0) {
        console.log(`Direct listDocs found ${docs.length} docs in "${col}". Deleting...`);
        for (const d of docs) {
          if (d.id) {
            await deleteDoc(col, d.id);
          }
        }
      }
    } catch (e: any) {
      console.warn(`Direct listDocs cleanup for ${col}:`, e.message);
    }
  }

  // Clean users collection in Firestore, keeping ONLY the General Supervisor
  try {
    const firestoreUsers = await listDocs('users');
    console.log(`Found ${firestoreUsers.length} users in Firestore.`);
    for (const u of firestoreUsers) {
      const isSuperAdmin = (
        u.id === 'usr_admin_samir' ||
        u.username === 'admin' ||
        u.role === 'admin' ||
        (u.email && u.email.toLowerCase().includes('samir'))
      );
      if (!isSuperAdmin && u.id) {
        console.log(`Deleting non-admin user from Firestore: ${u.username || u.id} (${u.email})`);
        await deleteDoc('users', u.id);
      }
    }
  } catch (err: any) {
    console.error('Error cleaning Firestore users:', err?.message || err);
  }

  // Ensure Admin user in Firestore
  const now = new Date().toISOString();
  await setDoc('users', 'usr_admin_samir', {
    id: 'usr_admin_samir',
    username: 'admin',
    email: 'mrsamir069@gmail.com',
    fullName: 'الأستاذ: سمير القراشي (المشرف العام على التطبيق)',
    role: 'admin',
    academicYear: '2026/2027',
    status: 'active',
    emailVerified: true,
    createdAt: now,
    updatedAt: now
  });
  console.log('✅ General Supervisor account confirmed in Firestore.');

  // Ensure clean app settings in Firestore
  await setDoc('app_settings', 'institution', {
    key: 'institution',
    value: 'الثانوية الإعدادية ايكسان',
    updatedAt: now
  });
  await setDoc('app_settings', 'year', {
    key: 'year',
    value: '2026/2027',
    updatedAt: now
  });

  // Ensure 2026/2027 in Firestore
  await setDoc('academic_years', 'ay_2026_2027', {
    id: 'ay_2026_2027',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-07-30',
    isCurrent: true,
    isArchived: false,
    notes: 'الموسم الدراسي الحالي المعتمد بالثانوية الإعدادية ايكسان',
    createdAt: now
  });

  // 3. Wipe SQLite tables
  console.log('\n🧹 Cleaning local SQLite tables...');
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM notes').run();
    db.prepare('DELETE FROM seats').run();
    db.prepare('DELETE FROM teacher_seat_overrides').run();
    db.prepare('DELETE FROM sections').run();
    db.prepare('DELETE FROM daily_violations').run();
    db.prepare('DELETE FROM attendance_history').run();
    db.prepare('DELETE FROM section_assignments').run();
    db.prepare('DELETE FROM student_change_requests').run();
    db.prepare('DELETE FROM school_activities').run();
    db.prepare('DELETE FROM change_history').run();
    db.prepare('DELETE FROM email_outbox').run();
    db.prepare('DELETE FROM password_resets').run();

    // Clean academic years
    db.prepare("DELETE FROM academic_years WHERE name != '2026/2027'").run();

    // Ensure 2026/2027 exists
    const hasCurrentYear = db.prepare("SELECT id FROM academic_years WHERE name = '2026/2027'").get();
    if (!hasCurrentYear) {
      db.prepare(`
        INSERT INTO academic_years (id, name, start_date, end_date, is_current, is_archived, notes, created_at)
        VALUES ('ay_2026_2027', '2026/2027', '2026-09-01', '2027-07-30', 1, 0, 'الموسم الدراسي الحالي المعتمد بالثانوية الإعدادية ايكسان', ?)
      `).run(now);
    } else {
      db.prepare("UPDATE academic_years SET is_current = 1, is_archived = 0, start_date = '2026-09-01', end_date = '2027-07-30' WHERE name = '2026/2027'").run();
    }

    // Clean app settings
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('institution', 'الثانوية الإعدادية ايكسان', ?)
      ON CONFLICT(key) DO UPDATE SET value = 'الثانوية الإعدادية ايكسان', updated_at = ?
    `).run(now, now);
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('year', '2026/2027', ?)
      ON CONFLICT(key) DO UPDATE SET value = '2026/2027', updated_at = ?
    `).run(now, now);

    // Delete all users EXCEPT the General Supervisor
    db.prepare(`
      DELETE FROM users 
      WHERE id != 'usr_admin_samir' 
        AND username != 'admin' 
        AND role != 'admin' 
        AND email NOT LIKE '%samir%'
    `).run();

    // Ensure the General Supervisor user is present and configured
    const adminUser = db.prepare(`
      SELECT id FROM users 
      WHERE id = 'usr_admin_samir' OR username = 'admin' OR email LIKE '%samir%'
    `).get() as any;

    if (!adminUser) {
      db.prepare(`
        INSERT INTO users (id, username, email, password, full_name, role, academic_year, status, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'admin', '2026/2027', 'active', 1, ?, ?)
      `).run(
        'usr_admin_samir',
        'admin',
        'mrsamir069@gmail.com',
        'Samir@0102.',
        'الأستاذ: سمير القراشي (المشرف العام على التطبيق)',
        now,
        now
      );
    } else {
      db.prepare(`
        UPDATE users SET
          id = 'usr_admin_samir',
          username = 'admin',
          email = 'mrsamir069@gmail.com',
          password = 'Samir@0102.',
          full_name = 'الأستاذ: سمير القراشي (المشرف العام على التطبيق)',
          role = 'admin',
          academic_year = '2026/2027',
          status = 'active',
          email_verified = 1,
          updated_at = ?
        WHERE id = ?
      `).run(now, adminUser.id);
    }

    // Record audit event
    db.prepare(`
      INSERT INTO change_history (action, summary, details_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'system_reset_to_zero',
      'إعادة تعيين كافة المعطيات إلى الصفر مع الحفاظ على حساب المشرف العام',
      JSON.stringify({ preservedUser: 'admin (الأستاذ سمير القراشي)', timestamp: now }),
      now
    );

    db.exec('COMMIT;');
    console.log('✅ SQLite tables wiped and reset successfully.');
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('❌ SQLite transaction failed:', err);
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }

  // 4. Create a clean zero-state cloud backup snapshot
  const day = now.slice(0, 10);
  const cleanManifest = {
    id: day,
    createdAt: now,
    chunkCount: 1,
    length: 100,
    sectionsCount: 0,
    reason: 'reset_to_zero'
  };
  await setDoc('db_snapshots', day, cleanManifest);
  await setDoc('db_snapshot_chunks', `${day}__0`, {
    data: JSON.stringify({
      version: '2.2.0',
      app: 'خرائط الأقسام',
      exportedAt: now,
      settings: {
        institution: 'الثانوية الإعدادية ايكسان',
        year: '2026/2027',
        seatNumbers: 'default',
        updatedAt: now
      },
      sections: [],
      history: [],
      schoolActivities: [],
      users: [
        {
          id: 'usr_admin_samir',
          username: 'admin',
          email: 'mrsamir069@gmail.com',
          password: 'Samir@0102.',
          full_name: 'الأستاذ: سمير القراشي (المشرف العام على التطبيق)',
          role: 'admin',
          academic_year: '2026/2027',
          status: 'active',
          email_verified: 1,
          created_at: now,
          updated_at: now
        }
      ],
      attendanceHistory: [],
      dailyViolations: [],
      teacherSeatOverrides: [],
      sectionAssignments: [],
      academicYears: [
        {
          id: 'ay_2026_2027',
          name: '2026/2027',
          startDate: '2026-09-01',
          endDate: '2027-07-30',
          isCurrent: true,
          isArchived: false,
          notes: 'الموسم الدراسي الحالي المعتمد بالثانوية الإعدادية ايكسان',
          createdAt: now
        }
      ]
    })
  });
  console.log(`✅ Clean zero-state snapshot saved to Firestore with id "${day}".`);

  // 5. Final verification of remaining records
  const remainingUsers = db.prepare('SELECT id, username, email, role, full_name FROM users').all();
  const remainingSections = (db.prepare('SELECT COUNT(*) as c FROM sections').get() as any)?.c || 0;
  const remainingSeats = (db.prepare('SELECT COUNT(*) as c FROM seats').get() as any)?.c || 0;
  const remainingNotes = (db.prepare('SELECT COUNT(*) as c FROM notes').get() as any)?.c || 0;
  const remainingViolations = (db.prepare('SELECT COUNT(*) as c FROM daily_violations').get() as any)?.c || 0;

  console.log('\n=======================================');
  console.log('🎉 Reset to ZERO completed successfully:');
  console.log(`- Sections: ${remainingSections}`);
  console.log(`- Seats: ${remainingSeats}`);
  console.log(`- Notes: ${remainingNotes}`);
  console.log(`- Violations: ${remainingViolations}`);
  console.log('- Remaining Users:');
  console.log(JSON.stringify(remainingUsers, null, 2));
  console.log('=======================================');
}

main().catch((e) => {
  console.error('Fatal error during reset:', e);
  process.exit(1);
});
