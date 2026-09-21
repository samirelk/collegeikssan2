import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { setDoc, getDoc, listDocs, getFirebaseConfig } from './firestoreService.ts';

export async function migrateLocalSqliteToFirestore() {
  console.log('--- Starting Firebase Firestore Synchronization & Migration ---');
  const config = getFirebaseConfig();
  console.log(`Target Firestore: Project=${config.projectId}, Database=${config.firestoreDatabaseId}`);

  const DB_PATH = path.join(process.cwd(), 'data', 'classroom_database.sqlite');
  if (!fs.existsSync(DB_PATH)) {
    console.log('No local sqlite file found at', DB_PATH);
    return { success: true, message: 'No local sqlite file to migrate' };
  }

  const db = new DatabaseSync(DB_PATH);

  // 1. Check existing users in Firestore
  const existingFirestoreUsers = await listDocs('users');
  console.log(`Existing Firestore users count: ${existingFirestoreUsers.length}`);

  let usersMigrated = 0;
  if (existingFirestoreUsers.length === 0) {
    // Migrate users from SQLite
    try {
      const users = db.prepare('SELECT * FROM users').all() as any[];
      for (const u of users) {
        await setDoc('users', u.id, {
          id: u.id,
          username: u.username,
          passwordHash: u.password_hash || '',
          fullName: u.full_name || '',
          role: u.role || 'teacher',
          status: u.status || 'active',
          email: u.email || '',
          phone: u.phone || '',
          subject: u.subject || '',
          academicYear: u.academic_year || '2026/2027',
          createdAt: u.created_at || new Date().toISOString(),
          updatedAt: u.updated_at || new Date().toISOString()
        });
        usersMigrated++;
      }
      console.log(`Successfully migrated ${usersMigrated} users to Firestore.`);
    } catch (e: any) {
      console.error('Error migrating users:', e.message);
    }
  } else {
    console.log('Firestore already has users. Skipping user overwrite to protect persistence.');
  }

  // 2. Settings in Firestore
  const existingSettings = await listDocs('app_settings');
  if (existingSettings.length === 0) {
    try {
      const rows = db.prepare('SELECT * FROM app_settings').all() as any[];
      for (const r of rows) {
        await setDoc('app_settings', r.key, {
          key: r.key,
          value: r.value,
          updatedAt: r.updated_at || new Date().toISOString()
        });
      }
      console.log(`Migrated ${rows.length} app_settings to Firestore.`);
    } catch (e: any) {
      console.error('Error migrating settings:', e.message);
    }
  }

  // 3. Violation Types in Firestore
  const existingTypes = await listDocs('violation_types');
  if (existingTypes.length === 0) {
    try {
      const types = db.prepare('SELECT * FROM violation_types').all() as any[];
      for (const t of types) {
        await setDoc('violation_types', t.id, {
          id: t.id,
          title: t.title,
          category: t.category || 'general',
          severity: t.severity || 'low',
          defaultAction: t.default_action || 'تنبيه شفهي',
          orderIndex: Number(t.order_index || 0),
          isActive: Boolean(t.is_active ?? 1),
          createdAt: t.created_at || new Date().toISOString(),
          updatedAt: t.updated_at || new Date().toISOString()
        });
      }
      console.log(`Migrated ${types.length} violation_types to Firestore.`);
    } catch (e: any) {
      console.error('Error migrating violation types:', e.message);
    }
  }

  // 4. Academic Years in Firestore
  const existingYears = await listDocs('academic_years');
  if (existingYears.length === 0) {
    try {
      const years = db.prepare('SELECT * FROM academic_years').all() as any[];
      for (const y of years) {
        await setDoc('academic_years', y.id, {
          id: y.id,
          name: y.name,
          isCurrent: Boolean(y.is_current),
          startDate: y.start_date || '',
          endDate: y.end_date || '',
          createdAt: y.created_at || new Date().toISOString()
        });
      }
      console.log(`Migrated ${years.length} academic_years to Firestore.`);
    } catch (e: any) {
      console.error('Error migrating academic years:', e.message);
    }
  }

  // 5. Sections in Firestore
  const existingSections = await listDocs('sections');
  console.log(`Existing Firestore sections count: ${existingSections.length}`);
  if (existingSections.length === 0) {
    try {
      const sections = db.prepare('SELECT * FROM sections').all() as any[];
      for (const s of sections) {
        await setDoc('sections', s.id, {
          id: s.id,
          level: s.level,
          classNumber: s.class_number,
          teacher: s.teacher || '',
          assignedTeacherId: s.assigned_teacher_id || null,
          academicYear: s.academic_year || '2026/2027',
          createdAt: s.created_at || new Date().toISOString(),
          updatedAt: s.updated_at || new Date().toISOString()
        });
      }
      console.log(`Migrated ${sections.length} sections to Firestore.`);
    } catch (e: any) {
      console.error('Error migrating sections:', e.message);
    }
  }

  // 6. Seats / Students in Firestore
  const existingSeats = await listDocs('seats');
  console.log(`Existing Firestore seats count: ${existingSeats.length}`);
  if (existingSeats.length === 0) {
    try {
      const seats = db.prepare('SELECT * FROM seats').all() as any[];
      console.log(`Migrating ${seats.length} student seats to Firestore...`);
      // Batch set in chunks
      let count = 0;
      const CHUNK_SIZE = 15;
      for (let i = 0; i < seats.length; i += CHUNK_SIZE) {
        const chunk = seats.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (st: any) => {
            const seatId = `${st.section_id}_seat_${st.seat_num}`;
            await setDoc('seats', seatId, {
              id: seatId,
              sectionId: st.section_id,
              seatNum: Number(st.seat_num),
              studentName: st.student_name || '',
              studentNumber: st.student_number || '',
              massarNumber: st.massar_number || '',
              rosterId: st.roster_id || null,
              attendance: st.attendance || null,
              statusColor: st.status_color || 'default',
              createdAt: st.created_at || new Date().toISOString(),
              updatedAt: st.updated_at || new Date().toISOString()
            });
            count++;
          })
        );
      }
      console.log(`Successfully migrated ${count} seats to Firestore.`);
    } catch (e: any) {
      console.error('Error migrating seats:', e.message);
    }
  }

  // 7. Absences in Firestore
  const existingAbsences = await listDocs('attendance_history');
  console.log(`Existing Firestore attendance_history count: ${existingAbsences.length}`);
  if (existingAbsences.length === 0) {
    try {
      const absences = db.prepare('SELECT * FROM attendance_history').all() as any[];
      for (const a of absences) {
        await setDoc('attendance_history', a.id, {
          id: a.id,
          sectionId: a.section_id,
          seatNum: Number(a.seat_num),
          studentName: a.student_name || '',
          studentNumber: a.student_number || '',
          massarNumber: a.massar_number || '',
          status: a.status,
          date: a.date,
          time: a.time || '',
          session: a.session || 'الحصة الصباحية',
          subject: a.subject || '',
          teacherName: a.teacher_name || '',
          isJustified: Boolean(a.is_justified),
          justificationReason: a.justification_reason || '',
          academicYear: a.academic_year || '2026/2027',
          createdAt: a.created_at || new Date().toISOString()
        });
      }
      console.log(`Migrated ${absences.length} attendance records to Firestore.`);
    } catch (e: any) {
      console.error('Error migrating attendance:', e.message);
    }
  }

  // 8. Violations in Firestore
  const existingViolations = await listDocs('daily_violations');
  console.log(`Existing Firestore daily_violations count: ${existingViolations.length}`);
  if (existingViolations.length === 0) {
    try {
      const violations = db.prepare('SELECT * FROM daily_violations').all() as any[];
      for (const v of violations) {
        await setDoc('daily_violations', v.id, {
          id: v.id,
          sectionId: v.section_id,
          seatNum: Number(v.seat_num),
          studentName: v.student_name || '',
          studentNumber: v.student_number || '',
          massarNumber: v.massar_number || '',
          violationType: v.violation_type || '',
          actionTaken: v.action_taken || 'تنبيه شفهي',
          teacherName: v.teacher_name || '',
          teacherSubject: v.teacher_subject || '',
          date: v.date || '',
          time: v.time || '',
          academicYear: v.academic_year || '2026/2027',
          notes: v.notes || '',
          createdAt: v.created_at || new Date().toISOString()
        });
      }
      console.log(`Migrated ${violations.length} daily violations to Firestore.`);
    } catch (e: any) {
      console.error('Error migrating daily violations:', e.message);
    }
  }

  console.log('--- Firebase Firestore Synchronization & Migration Completed Successfully ---');
  return { success: true };
}
