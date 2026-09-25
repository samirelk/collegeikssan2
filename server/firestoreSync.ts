import { getDoc, setDoc, deleteDoc, listDocs, getFirebaseConfig, batchSetDocs } from './firestoreService.ts';
import path from 'node:path';
import fs from 'node:fs';

let sqliteDb: any = null;

export function setSqliteDbInstance(db: any) {
  sqliteDb = db;
}

// 1. Initial boot synchronization: Pull from Firestore into SQLite, and push missing to Firestore
export async function syncDatabaseWithFirestore(db: any) {
  sqliteDb = db;
  console.log('🔄 [FirestoreSync] Initiating cloud persistence synchronization...');

  try {
    const config = getFirebaseConfig();
    console.log(`📡 [FirestoreSync] Connected to Firestore: ${config.projectId} (${config.firestoreDatabaseId})`);

    // A. Sync Users (Admins, Directors, Teachers)
    await syncUsersFromFirestore(db);

    // B. Sync Settings
    await syncSettingsFromFirestore(db);

    // C. Sync Academic Years
    await syncAcademicYearsFromFirestore(db);

    // D. Sync Sections & Seats
    await syncSectionsFromFirestore(db);

    // E. Sync Attendance History
    await syncAttendanceFromFirestore(db);

    // F. Sync Daily Violations
    await syncViolationsFromFirestore(db);

    // G. Sync Notes
    await syncNotesFromFirestore(db);

    // H. Sync Teacher Seat Overrides
    await syncTeacherSeatOverridesFromFirestore(db);

    // I. Sync Section Assignments
    await syncAssignmentsFromFirestore(db);

    // J. Sync Teacher Timetable
    await syncTimetableFromFirestore(db);

    // K. Push any local records that Firestore doesn't have yet
    await pushMissingLocalDataToFirestore(db);

    console.log('✅ [FirestoreSync] Full Cloud Firestore synchronization complete!');
  } catch (err: any) {
    console.error('❌ [FirestoreSync] Error during Firestore synchronization:', err?.message || err);
    throw err;
  }
}

async function syncUsersFromFirestore(db: any) {
  try {
    const firestoreUsers = await listDocs('users');
    if (!firestoreUsers || firestoreUsers.length === 0) return;

    console.log(`📥 [FirestoreSync] Found ${firestoreUsers.length} users in Firestore. Syncing to local SQLite...`);

    const selectStmt = db.prepare('SELECT id, password, email_verified, status FROM users WHERE id = ?');
    const updateStmt = db.prepare(`
      UPDATE users 
      SET username = ?, email = ?, password = ?, full_name = ?, role = ?, academic_year = ?, 
          status = ?, subject = ?, email_verified = ?, updated_at = ?
      WHERE id = ?
    `);
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO users (
        id, username, email, password, full_name, role, academic_year, 
        status, subject, email_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const u of firestoreUsers) {
      if (!u.id || !u.username) continue;
      const existing = selectStmt.get(u.id) as any;
      const pwd = (existing?.password && existing.password !== 'password123')
        ? existing.password
        : (u.password || existing?.password || u.passwordHash || 'password123');
      const now = new Date().toISOString();
      const isEmailVerified = Boolean(u.emailVerified || u.email_verified || existing?.email_verified);
      const userStatus = (existing?.status === 'active' || u.status === 'active') ? 'active' : (u.status || existing?.status || 'active');

      if (existing) {
        updateStmt.run(
          u.username,
          u.email || `${u.username}@school.local`,
          pwd,
          u.fullName || u.full_name || u.username,
          u.role || 'teacher',
          u.academicYear || u.academic_year || '2026/2027',
          userStatus,
          u.subject || 'الرياضيات',
          isEmailVerified ? 1 : 0,
          u.updatedAt || now,
          u.id
        );
      } else {
        insertStmt.run(
          u.id,
          u.username,
          u.email || `${u.username}@school.local`,
          pwd,
          u.fullName || u.full_name || u.username,
          u.role || 'teacher',
          u.academicYear || u.academic_year || '2026/2027',
          userStatus,
          u.subject || 'الرياضيات',
          isEmailVerified ? 1 : 0,
          u.createdAt || now,
          u.updatedAt || now
        );
      }

      // If local state has updated verification or password that Firestore lacked, sync back to Firestore
      if ((isEmailVerified && !u.emailVerified) || (pwd && pwd !== u.password) || (userStatus === 'active' && u.status !== 'active')) {
        setDoc('users', u.id, {
          id: u.id,
          username: u.username,
          email: u.email || `${u.username}@school.local`,
          password: pwd,
          fullName: u.fullName || u.full_name || u.username,
          role: u.role || 'teacher',
          status: userStatus,
          subject: u.subject || 'الرياضيات',
          academicYear: u.academicYear || u.academic_year || '2026/2027',
          emailVerified: isEmailVerified,
          mustChangeProfile: Boolean(u.mustChangeProfile ?? u.must_change_profile),
          mustChangePassword: Boolean(u.mustChangePassword ?? u.must_change_password),
          createdAt: u.createdAt || now,
          updatedAt: now
        }).catch(err => console.warn('[syncUsersFromFirestore] cloud back-sync warning:', err.message));
      }
    }
  } catch (e: any) {
    console.error('Error in syncUsersFromFirestore:', e.message);
  }
}

async function syncSettingsFromFirestore(db: any) {
  try {
    const settings = await listDocs('app_settings');
    if (!settings || settings.length === 0) return;

    const upsertStmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `);

    for (const s of settings) {
      if (s.key && s.value !== undefined) {
        upsertStmt.run(s.key, String(s.value), s.updatedAt || new Date().toISOString());
      }
    }
  } catch (e: any) {
    console.error('Error in syncSettingsFromFirestore:', e.message);
  }
}

async function syncAcademicYearsFromFirestore(db: any) {
  try {
    const years = await listDocs('academic_years');
    if (!years || years.length === 0) return;

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO academic_years (id, name, is_current, start_date, end_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const y of years) {
      if (!y.id || !y.name) continue;
      insertStmt.run(
        y.id,
        y.name,
        y.isCurrent ? 1 : 0,
        y.startDate || '',
        y.endDate || '',
        y.createdAt || new Date().toISOString()
      );
    }
  } catch (e: any) {
    console.error('Error in syncAcademicYearsFromFirestore:', e.message);
  }
}

async function syncSectionsFromFirestore(db: any) {
  try {
    const sections = await listDocs('sections');
    if (!sections || sections.length === 0) return;

    console.log(`📥 [FirestoreSync] Found ${sections.length} sections in Firestore. Syncing to local SQLite...`);

    const insertSec = db.prepare(`
      INSERT INTO sections (id, level, class_number, teacher, assigned_teacher_id, created_at, updated_at, roster_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        level = excluded.level,
        class_number = excluded.class_number,
        teacher = excluded.teacher,
        assigned_teacher_id = excluded.assigned_teacher_id,
        updated_at = excluded.updated_at,
        roster_json = excluded.roster_json
    `);

    const checkSeatsCountStmt = db.prepare('SELECT COUNT(*) as c FROM seats WHERE section_id = ?');
    const insertInitialSeat = db.prepare(`
      INSERT INTO seats (section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, attendance, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'default', NULL, ?)
    `);

    for (const s of sections) {
      if (!s.id) continue;
      const rosterJson = typeof s.roster === 'string' ? s.roster : JSON.stringify(s.roster || []);
      insertSec.run(
        s.id,
        s.level || '',
        s.classNumber || s.class_number || '',
        s.teacher || '',
        s.assignedTeacherId || s.assigned_teacher_id || null,
        s.createdAt || new Date().toISOString(),
        s.updatedAt || new Date().toISOString(),
        rosterJson
      );

      // If seats table has 0 seats for this section, populate 100 seats using the roster
      const seatsCount = (checkSeatsCountStmt.get(s.id) as any)?.c || 0;
      if (seatsCount === 0) {
        let roster: any[] = [];
        try {
          roster = typeof s.roster === 'string' ? JSON.parse(s.roster) : (s.roster || []);
        } catch {
          roster = [];
        }
        const now = new Date().toISOString();
        for (let i = 1; i <= 100; i++) {
          const student = roster[i - 1];
          insertInitialSeat.run(
            s.id,
            i,
            student?.name || '',
            student?.number || '',
            student?.massarNumber || '',
            student?.id || null,
            now
          );
        }
      }
    }

    // Also sync seats if any
    const seats = await listDocs('seats');
    if (seats && seats.length > 0) {
      console.log(`📥 [FirestoreSync] Found ${seats.length} seats in Firestore. Syncing...`);
      const insertSeat = db.prepare(`
        INSERT OR REPLACE INTO seats (
          section_id, seat_num, student_name, student_number, massar_number, 
          roster_id, attendance, status_color, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const checkSectionStmt = db.prepare('SELECT 1 FROM sections WHERE id = ?');

      for (const st of seats) {
        if (!st.sectionId || st.seatNum === undefined) continue;
        try {
          const sectionExists = checkSectionStmt.get(st.sectionId);
          if (!sectionExists) continue;

          insertSeat.run(
            st.sectionId,
            Number(st.seatNum),
            st.studentName || '',
            st.studentNumber || '',
            st.massarNumber || '',
            st.rosterId || null,
            st.attendance || null,
            st.statusColor || 'default',
            st.updatedAt || new Date().toISOString()
          );
        } catch (rowErr: any) {
          console.warn(`[FirestoreSync] Skipping seat sync for section ${st.sectionId} seat ${st.seatNum}: ${rowErr?.message}`);
        }
      }
    }
  } catch (e: any) {
    console.error('Error in syncSectionsFromFirestore:', e.message);
  }
}

async function syncAttendanceFromFirestore(db: any) {
  try {
    const list = await listDocs('attendance_history');
    if (!list || list.length === 0) return;

    console.log(`📥 [FirestoreSync] Found ${list.length} attendance records in Firestore.`);
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO attendance_history (
        id, section_id, seat_num, student_name, student_number,
        status, recorded_date, session_period, teacher_name, teacher_subject,
        justified, justification_reason, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const checkSectionStmt = db.prepare('SELECT 1 FROM sections WHERE id = ?');

    for (const a of list) {
      if (!a.id || !a.sectionId) continue;
      try {
        const sectionExists = checkSectionStmt.get(a.sectionId);
        if (!sectionExists) {
          console.warn(`[FirestoreSync] Skipping attendance ${a.id}: Section ${a.sectionId} does not exist.`);
          continue;
        }

        insertStmt.run(
          a.id,
          a.sectionId,
          Number(a.seatNum || 0),
          a.studentName || '',
          a.studentNumber || '',
          a.status || 'absent',
          a.date || a.recordedDate || new Date().toISOString().slice(0, 10),
          a.session || a.sessionPeriod || 'كامل اليوم',
          a.teacherName || '',
          a.teacherSubject || '',
          a.isJustified ? 'justified' : (a.justified || 'unjustified'),
          a.justificationReason || '',
          a.notes || '',
          a.createdAt || new Date().toISOString()
        );
      } catch (rowErr: any) {
        console.warn(`[FirestoreSync] Skipping attendance record ${a.id}: ${rowErr?.message}`);
      }
    }
  } catch (e: any) {
    console.error('Error in syncAttendanceFromFirestore:', e.message);
  }
}

async function syncViolationsFromFirestore(db: any) {
  try {
    const list = await listDocs('daily_violations');
    if (!list || list.length === 0) return;

    console.log(`📥 [FirestoreSync] Found ${list.length} violations in Firestore.`);
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO daily_violations (
        id, section_id, seat_num, student_name, student_number,
        violation_type, description, action_taken, teacher_name, teacher_subject,
        recorded_date, recorded_time, created_at, teacher_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const checkSectionStmt = db.prepare('SELECT 1 FROM sections WHERE id = ?');

    for (const v of list) {
      if (!v.id || !v.sectionId) continue;
      try {
        const sectionExists = checkSectionStmt.get(v.sectionId);
        if (!sectionExists) {
          console.warn(`[FirestoreSync] Skipping violation ${v.id}: Section ${v.sectionId} does not exist.`);
          continue;
        }

        insertStmt.run(
          v.id,
          v.sectionId,
          Number(v.seatNum || 0),
          v.studentName || '',
          v.studentNumber || '',
          v.violationType || 'مخالفة تربوية أخرى',
          v.description || v.notes || 'مخالفة سلوكية',
          v.actionTaken || 'تنبيه شفهي',
          v.teacherName || '',
          v.teacherSubject || '',
          v.date || v.recordedDate || new Date().toISOString().slice(0, 10),
          v.time || v.recordedTime || new Date().toTimeString().slice(0, 5),
          v.createdAt || new Date().toISOString(),
          v.teacherId || ''
        );
      } catch (rowErr: any) {
        console.warn(`[FirestoreSync] Skipping violation ${v.id}: ${rowErr?.message}`);
      }
    }
  } catch (e: any) {
    console.error('Error in syncViolationsFromFirestore:', e.message);
  }
}

async function syncNotesFromFirestore(db: any) {
  try {
    const list = await listDocs('notes');
    if (!list || list.length === 0) return;

    console.log(`📥 [FirestoreSync] Found ${list.length} notes in Firestore.`);
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO notes (
        id, section_id, seat_num, note_text, note_date, note_time, created_at, teacher_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const checkSectionStmt = db.prepare('SELECT 1 FROM sections WHERE id = ?');

    for (const n of list) {
      if (!n.id || !n.sectionId) continue;
      try {
        const sectionExists = checkSectionStmt.get(n.sectionId);
        if (!sectionExists) continue;

        insertStmt.run(
          n.id,
          n.sectionId,
          Number(n.seatNum || 0),
          n.noteText || n.text || '',
          n.noteDate || n.date || '',
          n.noteTime || n.time || '',
          n.createdAt || new Date().toISOString(),
          n.teacherId || ''
        );
      } catch (rowErr: any) {
        console.warn(`[FirestoreSync] Skipping note ${n.id}: ${rowErr?.message}`);
      }
    }
  } catch (e: any) {
    console.error('Error in syncNotesFromFirestore:', e.message);
  }
}

async function syncTeacherSeatOverridesFromFirestore(db: any) {
  try {
    const list = await listDocs('teacher_seat_overrides');
    if (!list || list.length === 0) return;

    console.log(`📥 [FirestoreSync] Found ${list.length} teacher seat overrides in Firestore.`);
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO teacher_seat_overrides (
        teacher_id, section_id, seat_num, student_name, student_number, massar_number, roster_id, status_color, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const checkSectionStmt = db.prepare('SELECT 1 FROM sections WHERE id = ?');
    const checkUserStmt = db.prepare('SELECT 1 FROM users WHERE id = ?');

    for (const o of list) {
      if (!o.teacherId || !o.sectionId || o.seatNum === undefined) continue;
      try {
        const sectionExists = checkSectionStmt.get(o.sectionId);
        const userExists = checkUserStmt.get(o.teacherId);
        if (!sectionExists || !userExists) continue;

        insertStmt.run(
          o.teacherId,
          o.sectionId,
          Number(o.seatNum),
          o.studentName || '',
          o.studentNumber || '',
          o.massarNumber || '',
          o.rosterId || null,
          o.statusColor || 'default',
          o.updatedAt || new Date().toISOString()
        );
      } catch (rowErr: any) {
        console.warn(`[FirestoreSync] Skipping seat override for teacher ${o.teacherId} sec ${o.sectionId} seat ${o.seatNum}: ${rowErr?.message}`);
      }
    }
  } catch (e: any) {
    console.error('Error in syncTeacherSeatOverridesFromFirestore:', e.message);
  }
}

async function syncAssignmentsFromFirestore(db: any) {
  try {
    const list = await listDocs('section_assignments');
    if (!list || list.length === 0) return;

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO section_assignments (
        id, teacher_id, section_id, status, request_note, requested_at, reviewed_at, reviewed_by, academic_year, subject
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const checkUserStmt = db.prepare('SELECT 1 FROM users WHERE id = ?');
    const checkSectionStmt = db.prepare('SELECT 1 FROM sections WHERE id = ?');

    for (const a of list) {
      if (!a.id || !a.teacherId || !a.sectionId) continue;
      try {
        const userExists = checkUserStmt.get(a.teacherId);
        const sectionExists = checkSectionStmt.get(a.sectionId);
        if (!userExists || !sectionExists) {
          console.warn(`[FirestoreSync] Skipping assignment ${a.id}: user or section missing.`);
          continue;
        }

        insertStmt.run(
          a.id,
          a.teacherId,
          a.sectionId,
          a.status || 'pending',
          a.requestNote || '',
          a.requestedAt || new Date().toISOString(),
          a.reviewedAt || null,
          a.reviewedBy || null,
          a.academicYear || '2026/2027',
          a.subject || 'عام'
        );
      } catch (rowErr: any) {
        console.warn(`[FirestoreSync] Skipping assignment ${a.id}: ${rowErr?.message}`);
      }
    }

    // Auto-update section primary teacher for approved assignments if empty
    try {
      db.prepare(`
        UPDATE sections
        SET assigned_teacher_id = (
          SELECT teacher_id FROM section_assignments
          WHERE section_assignments.section_id = sections.id AND section_assignments.status = 'approved'
          LIMIT 1
        )
        WHERE assigned_teacher_id IS NULL OR assigned_teacher_id = ''
      `).run();
    } catch {
      // Ignore
    }
  } catch (e: any) {
    console.error('Error in syncAssignmentsFromFirestore:', e.message);
  }
}

async function syncTimetableFromFirestore(db: any) {
  try {
    const list = await listDocs('teacher_timetable');
    if (!list || list.length === 0) return;

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO teacher_timetable (
        id, teacher_id, day_of_week, slot_id, period_type,
        start_time, end_time, section_id, room, subject, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of list) {
      if (!t.id || !t.teacherId || !t.sectionId) continue;
      try {
        insertStmt.run(
          t.id,
          t.teacherId,
          t.dayOfWeek || 'monday',
          t.slotId || '',
          t.periodType || 'morning',
          t.startTime || '08:00',
          t.endTime || '09:00',
          t.sectionId,
          t.room || '',
          t.subject || '',
          t.notes || '',
          t.createdAt || new Date().toISOString(),
          t.updatedAt || new Date().toISOString()
        );
      } catch (rowErr: any) {
        console.warn(`[FirestoreSync] Skipping timetable entry ${t.id}: ${rowErr?.message}`);
      }
    }
  } catch (e: any) {
    console.error('Error in syncTimetableFromFirestore:', e.message);
  }
}

// Push any SQLite records that are missing from Firestore
async function pushMissingLocalDataToFirestore(db: any) {
  try {
    // 1. Users
    const localUsers = db.prepare('SELECT * FROM users').all() as any[];
    for (const u of localUsers) {
      await setDoc('users', u.id, {
        id: u.id,
        username: u.username,
        email: u.email,
        password: u.password,
        fullName: u.full_name,
        role: u.role,
        status: u.status,
        subject: u.subject || '',
        academicYear: u.academic_year || '2026/2027',
        emailVerified: Boolean(u.email_verified),
        mustChangeProfile: Boolean(u.must_change_profile),
        mustChangePassword: Boolean(u.must_change_password),
        createdAt: u.created_at || new Date().toISOString(),
        updatedAt: u.updated_at || new Date().toISOString()
      });
    }

    // 2. Sections
    const localSections = db.prepare('SELECT * FROM sections').all() as any[];
    for (const s of localSections) {
      await setDoc('sections', s.id, {
        id: s.id,
        level: s.level,
        classNumber: s.class_number,
        teacher: s.teacher || '',
        assignedTeacherId: s.assigned_teacher_id || null,
        academicYear: s.academic_year || '2025/2026',
        createdAt: s.created_at || new Date().toISOString(),
        updatedAt: s.updated_at || new Date().toISOString()
      });
    }

    // 3. Settings
    const localSettings = db.prepare('SELECT * FROM app_settings').all() as any[];
    for (const s of localSettings) {
      await setDoc('app_settings', s.key, {
        key: s.key,
        value: s.value,
        updatedAt: s.updated_at || new Date().toISOString()
      });
    }

    // 4. Daily Violations (with teacherId)
    const localViolations = db.prepare('SELECT * FROM daily_violations').all() as any[];
    for (const v of localViolations) {
      await setDoc('daily_violations', v.id, {
        id: v.id,
        sectionId: v.section_id,
        seatNum: Number(v.seat_num || 0),
        studentName: v.student_name || '',
        studentNumber: v.student_number || '',
        massarNumber: v.massar_number || '',
        violationType: v.violation_type || '',
        actionTaken: v.action_taken || '',
        teacherName: v.teacher_name || '',
        teacherSubject: v.teacher_subject || '',
        date: v.recorded_date || '',
        time: v.recorded_time || '',
        academicYear: '2025/2026',
        notes: v.description || '',
        createdAt: v.created_at || new Date().toISOString(),
        teacherId: v.teacher_id || ''
      });
    }

    // 5. Notes (with teacherId)
    const localNotes = db.prepare('SELECT * FROM notes').all() as any[];
    for (const n of localNotes) {
      await setDoc('notes', n.id, {
        id: n.id,
        sectionId: n.section_id,
        seatNum: Number(n.seat_num || 0),
        noteText: n.note_text || '',
        noteDate: n.note_date || '',
        noteTime: n.note_time || '',
        createdAt: n.created_at || new Date().toISOString(),
        teacherId: n.teacher_id || ''
      });
    }

    // 6. Teacher Seat Overrides (with teacherId and sectionId)
    const localOverrides = db.prepare('SELECT * FROM teacher_seat_overrides').all() as any[];
    for (const o of localOverrides) {
      const overrideId = `${o.teacher_id}_${o.section_id}_seat_${o.seat_num}`;
      await setDoc('teacher_seat_overrides', overrideId, {
        id: overrideId,
        teacherId: o.teacher_id,
        sectionId: o.section_id,
        seatNum: Number(o.seat_num),
        studentName: o.student_name || '',
        studentNumber: o.student_number || '',
        massarNumber: o.massar_number || '',
        rosterId: o.roster_id || null,
        statusColor: o.status_color || 'default',
        updatedAt: o.updated_at || new Date().toISOString()
      });
    }

    // 7. Section Assignments
    const localAssignments = db.prepare('SELECT * FROM section_assignments').all() as any[];
    for (const asgn of localAssignments) {
      await setDoc('section_assignments', asgn.id, {
        id: asgn.id,
        teacherId: asgn.teacher_id,
        sectionId: asgn.section_id,
        status: asgn.status || 'approved',
        requestNote: asgn.request_note || '',
        requestedAt: asgn.requested_at || new Date().toISOString(),
        reviewedAt: asgn.reviewed_at || new Date().toISOString(),
        reviewedBy: asgn.reviewed_by || 'admin',
        academicYear: asgn.academic_year || '2026/2027',
        subject: asgn.subject || 'عام'
      });
    }

    // 8. Teacher Timetable
    const localTimetable = db.prepare('SELECT * FROM teacher_timetable').all() as any[];
    for (const t of localTimetable) {
      await setDoc('teacher_timetable', t.id, {
        id: t.id,
        teacherId: t.teacher_id,
        dayOfWeek: t.day_of_week,
        slotId: t.slot_id,
        periodType: t.period_type || 'morning',
        startTime: t.start_time || '08:00',
        endTime: t.end_time || '09:00',
        sectionId: t.section_id,
        room: t.room || '',
        subject: t.subject || '',
        notes: t.notes || '',
        createdAt: t.created_at || new Date().toISOString(),
        updatedAt: t.updated_at || new Date().toISOString()
      });
    }
  } catch (e: any) {
    console.warn('pushMissingLocalDataToFirestore warning:', e.message);
  }
}

// ----------------------------------------------------
// Durable single-item Firestore writers
// ----------------------------------------------------

const pendingCloudWrites = new Set<Promise<boolean>>();

function trackCloudWrite(label: string, operation: () => Promise<boolean>): Promise<boolean> {
  const promise = operation().catch((error) => {
    console.error(`[FirestoreSync] ${label} failed:`, error);
    return false;
  });
  pendingCloudWrites.add(promise);
  void promise.finally(() => pendingCloudWrites.delete(promise));
  return promise;
}

export async function flushPendingCloudWrites(): Promise<boolean> {
  let allSucceeded = true;
  while (pendingCloudWrites.size > 0) {
    const results = await Promise.all(Array.from(pendingCloudWrites));
    if (results.some((result) => !result)) allSucceeded = false;
  }
  return allSucceeded;
}

export function cloudSaveUser(user: any) {
  return trackCloudWrite(`cloudSaveUser(${user.id})`, () => setDoc('users', user.id, {
    id: user.id,
    username: user.username,
    email: user.email,
    password: user.password,
    fullName: user.fullName || user.full_name,
    role: user.role,
    status: user.status || 'active',
    subject: user.subject || '',
    academicYear: user.academicYear || user.academic_year || '2026/2027',
    emailVerified: Boolean(user.emailVerified ?? user.email_verified),
    mustChangeProfile: Boolean(user.mustChangeProfile ?? user.must_change_profile),
    mustChangePassword: Boolean(user.mustChangePassword ?? user.must_change_password),
    createdAt: user.createdAt || user.created_at || new Date().toISOString(),
    updatedAt: user.updatedAt || user.updated_at || new Date().toISOString()
  }));
}

export function cloudDeleteUser(userId: string) {
  return trackCloudWrite(`cloudDeleteUser(${userId})`, () => deleteDoc('users', userId));
}

export function cloudSaveSection(sec: any) {
  return trackCloudWrite(`cloudSaveSection(${sec.id})`, () => setDoc('sections', sec.id, {
    id: sec.id, level: sec.level, classNumber: sec.classNumber || sec.class_number,
    teacher: sec.teacher || '', assignedTeacherId: sec.assignedTeacherId || sec.assigned_teacher_id || null,
    academicYear: sec.academicYear || sec.academic_year || '2025/2026',
    updatedAt: new Date().toISOString()
  }));
}

export function cloudDeleteSection(sectionId: string) {
  return trackCloudWrite(`cloudDeleteSection(${sectionId})`, () => deleteDoc('sections', sectionId));
}

export function cloudSaveSeat(sectionId: string, seat: any) {
  const seatId = `${sectionId}_seat_${seat.seat || seat.seat_num}`;
  return trackCloudWrite(`cloudSaveSeat(${seatId})`, () => setDoc('seats', seatId, {
    id: seatId, sectionId, seatNum: Number(seat.seat || seat.seat_num),
    studentName: seat.name || seat.student_name || '', studentNumber: seat.number || seat.student_number || '',
    massarNumber: seat.massarNumber || seat.massar_number || '', rosterId: seat.rosterId || seat.roster_id || null,
    attendance: seat.attendance || null, statusColor: seat.statusColor || seat.status_color || 'default',
    updatedAt: new Date().toISOString()
  }));
}

export function cloudSaveAttendance(att: any) {
  return trackCloudWrite(`cloudSaveAttendance(${att.id})`, () => setDoc('attendance_history', att.id, {
    id: att.id, sectionId: att.sectionId || att.section_id, seatNum: Number(att.seatNum || att.seat_num || 0),
    studentName: att.studentName || att.student_name || '', studentNumber: att.studentNumber || att.student_number || '',
    massarNumber: att.massarNumber || att.massar_number || '', status: att.status, date: att.date,
    time: att.time || '', session: att.session || '', subject: att.subject || '',
    teacherName: att.teacherName || att.teacher_name || '',
    isJustified: Boolean(att.isJustified ?? att.is_justified),
    justificationReason: att.justificationReason || att.justification_reason || '',
    academicYear: att.academicYear || att.academic_year || '2025/2026',
    createdAt: att.createdAt || att.created_at || new Date().toISOString()
  }));
}

export function cloudDeleteAttendance(id: string) {
  return trackCloudWrite(`cloudDeleteAttendance(${id})`, () => deleteDoc('attendance_history', id));
}

export function cloudSaveViolation(vio: any) {
  return trackCloudWrite(`cloudSaveViolation(${vio.id})`, () => setDoc('daily_violations', vio.id, {
    id: vio.id, sectionId: vio.sectionId || vio.section_id, seatNum: Number(vio.seatNum || vio.seat_num || 0),
    studentName: vio.studentName || vio.student_name || '', studentNumber: vio.studentNumber || vio.student_number || '',
    massarNumber: vio.massarNumber || vio.massar_number || '', violationType: vio.violationType || vio.violation_type || '',
    actionTaken: vio.actionTaken || vio.action_taken || '', teacherName: vio.teacherName || vio.teacher_name || '',
    teacherSubject: vio.teacherSubject || vio.teacher_subject || '', date: vio.date || '', time: vio.time || '',
    academicYear: vio.academicYear || vio.academic_year || '2025/2026', notes: vio.notes || '',
    createdAt: vio.createdAt || vio.created_at || new Date().toISOString(), teacherId: vio.teacherId || vio.teacher_id || ''
  }));
}

export function cloudDeleteViolation(id: string) {
  return trackCloudWrite(`cloudDeleteViolation(${id})`, () => deleteDoc('daily_violations', id));
}

export function cloudSaveNote(note: any) {
  return trackCloudWrite(`cloudSaveNote(${note.id})`, () => setDoc('notes', note.id, {
    id: note.id, sectionId: note.sectionId || note.section_id, seatNum: Number(note.seatNum || note.seat_num || 0),
    noteText: note.noteText || note.note_text || note.text || '', noteDate: note.noteDate || note.note_date || note.date || '',
    noteTime: note.noteTime || note.note_time || note.time || '', createdAt: note.createdAt || note.created_at || new Date().toISOString(),
    teacherId: note.teacherId || note.teacher_id || ''
  }));
}

export function cloudDeleteNote(id: string) {
  return trackCloudWrite(`cloudDeleteNote(${id})`, () => deleteDoc('notes', id));
}

export function cloudSaveTeacherSeatOverride(override: any) {
  const overrideId = `${override.teacherId || override.teacher_id}_${override.sectionId || override.section_id}_seat_${override.seatNum || override.seat_num}`;
  return trackCloudWrite(`cloudSaveTeacherSeatOverride(${overrideId})`, () => setDoc('teacher_seat_overrides', overrideId, {
    id: overrideId, teacherId: override.teacherId || override.teacher_id, sectionId: override.sectionId || override.section_id,
    seatNum: Number(override.seatNum || override.seat_num), studentName: override.studentName || override.student_name || '',
    studentNumber: override.studentNumber || override.student_number || '', massarNumber: override.massarNumber || override.massar_number || '',
    rosterId: override.rosterId || override.roster_id || null, statusColor: override.statusColor || override.status_color || 'default',
    updatedAt: override.updatedAt || override.updated_at || new Date().toISOString()
  }));
}

export function cloudDeleteTeacherSeatOverride(teacherId: string, sectionId: string, seatNum: number) {
  const overrideId = `${teacherId}_${sectionId}_seat_${seatNum}`;
  return trackCloudWrite(`cloudDeleteTeacherSeatOverride(${overrideId})`, () => deleteDoc('teacher_seat_overrides', overrideId));
}

export function cloudSaveAssignment(asgn: any) {
  return trackCloudWrite(`cloudSaveAssignment(${asgn.id})`, () => setDoc('section_assignments', asgn.id, {
    id: asgn.id, teacherId: asgn.teacherId || asgn.teacher_id, sectionId: asgn.sectionId || asgn.section_id,
    status: asgn.status, requestNote: asgn.requestNote || asgn.request_note || '',
    requestedAt: asgn.requestedAt || asgn.requested_at || new Date().toISOString(),
    reviewedAt: asgn.reviewedAt || asgn.reviewed_at || null, reviewedBy: asgn.reviewedBy || asgn.reviewed_by || null,
    academicYear: asgn.academicYear || asgn.academic_year || '2026/2027',
    subject: asgn.subject || ''
  }));
}

export function cloudDeleteAssignment(id: string) {
  return trackCloudWrite(`cloudDeleteAssignment(${id})`, () => deleteDoc('section_assignments', id));
}

export function cloudSaveSetting(key: string, value: string) {
  return trackCloudWrite(`cloudSaveSetting(${key})`, () => setDoc('app_settings', key, {
    key, value, updatedAt: new Date().toISOString()
  }));
}

export function cloudSaveTimetableEntry(entry: any) {
  return trackCloudWrite(`cloudSaveTimetableEntry(${entry.id})`, () => setDoc('teacher_timetable', entry.id, {
    id: entry.id,
    teacherId: entry.teacherId || entry.teacher_id,
    dayOfWeek: entry.dayOfWeek || entry.day_of_week,
    slotId: entry.slotId || entry.slot_id,
    periodType: entry.periodType || entry.period_type || 'morning',
    startTime: entry.startTime || entry.start_time,
    endTime: entry.endTime || entry.end_time,
    sectionId: entry.sectionId || entry.section_id,
    room: entry.room || '',
    subject: entry.subject || '',
    notes: entry.notes || '',
    createdAt: entry.createdAt || entry.created_at || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.updated_at || new Date().toISOString()
  }));
}

export function cloudDeleteTimetableEntry(id: string) {
  return trackCloudWrite(`cloudDeleteTimetableEntry(${id})`, () => deleteDoc('teacher_timetable', id));
}
