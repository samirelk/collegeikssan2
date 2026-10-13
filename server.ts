import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  initDatabase,
  getAppSettings,
  saveAppSettings,
  getAllSections,
  resetAllDataToZero,
  createSection,
  updateSectionMeta,
  deleteSection,
  deleteAllSections,
  updateSeat,
  batchUpdateSeats,
  addSeatNote,
  deleteSeatNote,
  saveSectionRoster,
  getChangeLogs,
  getDatabaseStats,
  exportFullBackup,
  importFullBackup,
  swapSeats,
  shuffleSectionSeats,
  orderSectionSeatsByNumber,
  renumberSectionStudents,
  reorderSectionStudents,
  batchImportSections,
  seedTenSections,
  findUserByUsernameOrEmail,
  findUserById,
  createUser,
  updateUserProfile,
  getAllTeachers,
  batchCreateTeachers,
  deleteTeacher,
  deleteAllTeachers,
  createAssignmentRequest,
  getAssignmentRequests,
  reviewAssignmentRequest,
  assignSectionDirectly,
  unassignSection,
  getAvailableSectionsForRequest,
  requestPasswordReset,
  getOutboxEmails,
  getDirectorAnalytics,
  updateTeacherStatus,
  adminResetTeacherPassword,
  updateTeacherData,
  getSchoolActivities,
  createSchoolActivity,
  updateSchoolActivityStatus,
  deleteSchoolActivity,
  likeSchoolActivity,
  getAllDirectors,
  createDirector,
  updateDirectorData,
  updateDirectorStatus,
  adminResetDirectorPassword,
  deleteDirector,
  sendVerificationCode,
  verifyEmailCode,
  manualVerifyEmail,
  getDailyArchive,
  getStudentHistory,
  getRepeatedAbsenceStudents,
  getAttendanceMonthlySummary,
  getCurrentSchoolPeriod,
  addDailyAbsence,
  updateDailyAbsence,
  resolveDailyAbsence,
  deleteDailyAbsence,
  resetAbsences,
  batchImportDailyAbsences,
  addDailyViolation,
  updateDailyViolation,
  deleteDailyViolation,
  getAllAcademicYears,
  createAcademicYear,
  setCurrentAcademicYear,
  archiveAcademicYear,
  unarchiveAcademicYear,
  deleteAcademicYear,
  addStudentToSection,
  removeStudentFromSection,
  transferStudentToSection,
  getViolationTypes,
  addViolationType,
  updateViolationType,
  deleteViolationType,
  resetViolationTypes,
  addStudentViolation,
  deleteStudentViolation,
  addPositiveParticipation,
  deletePositiveParticipation,
  getPositiveParticipationsBySection,
  getTeacherTimetable,
  upsertTimetableSlot,
  deleteTimetableSlot,
  deleteTimetableEntryById,
  wipeAllDataExceptAdmin,
  getTeachersWithCredentials,
  trackVisitorLog,
  getVisitorAnalytics,
  clearVisitorLogs,
  getParentSummons,
  createParentSummons,
  updateParentSummons,
  deleteParentSummons,
  getAdvancedInstitutionalAnalytics,
  studentLogin,
  getStudentAccounts,
  regenerateStudentAccessCode,
  regenerateSectionStudentAccessCodes,
  db
} from './server/db.ts';
import { flushPendingCloudWrites, syncDatabaseWithFirestore } from './server/firestoreSync.ts';
import {
  configureCloudBackup,
  markDirty,
  flushSnapshot,
  writeSnapshot,
  listSnapshots,
  restoreSnapshot,
  restoreLatestSnapshotOnBoot,
  getBackupStatus,
} from './server/cloudBackup.ts';

async function startServer() {
  initDatabase();
  configureCloudBackup({ exportFullBackup, importFullBackup, db });

  // 1. First, restore the latest full database snapshot on boot if needed
  try {
    await restoreLatestSnapshotOnBoot();
  } catch (err: any) {
    console.warn('[CloudBackup] restoreLatestSnapshotOnBoot warning:', err?.message || err);
  }

  // 2. Authoritative Single Cloud Database Persistence:
  // Google Cloud Firestore (ai-studio-152aaa98-85f4-47cd-a9c7-c5d362d5959a)
  // Run asynchronously in the background to ensure port 3000 starts listening immediately for Cloud Run TCP health checks.
  void (async () => {
    try {
      console.log('🔄 [SingleDatabase] Initializing permanent Cloud Firestore synchronization in background...');
      await syncDatabaseWithFirestore(db);
      console.log('✅ [SingleDatabase] Cloud Firestore is active as the single authoritative database.');
    } catch (err: any) {
      console.warn('Initial Firebase Firestore sync warning:', err?.message || err);
    }
  })();

  // Gracefully flush all pending Firestore writes on container exit
  let shuttingDown = false;
  const gracefulExit = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[SingleDatabase] Received ${signal}; flushing all pending writes to Firestore before exit...`);
    try {
      await flushPendingCloudWrites();
    } catch {
      // ignore
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void gracefulExit('SIGTERM'));
  process.on('SIGINT', () => void gracefulExit('SIGINT'));

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Every successful mutation must wait for its Firestore writes and a full
  // snapshot before the response leaves the server. This prevents navigation,
  // logout, or a container restart from racing the cloud persistence layer.
  app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    const isMutation = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH';
    const isCloudControlRoute = req.path.startsWith('/api/cloud-backup') || req.path.startsWith('/api/cloud-sync');
    const isReadOnlyAuth = req.path === '/api/auth/login';
    if (!isMutation || !req.path.startsWith('/api') || isCloudControlRoute || isReadOnlyAuth) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    let responseStarted = false;
    res.json = ((body: unknown) => {
      if (responseStarted) return res;
      responseStarted = true;
      void (async () => {
        try {
          await flushPendingCloudWrites();
        } catch (error) {
          console.warn('[CloudPersistence] Warning flushing pending writes:', error);
        }
        originalJson(body);
      })().catch((error) => {
        console.error('[CloudPersistence] Error sending response:', error);
        try {
          originalJson(body);
        } catch {
          // ignore
        }
      });
      return res;
    }) as express.Response['json'];
    next();
  });

  // Mark the database dirty after any successful mutating API request so the
  // cloud-backup engine schedules a fresh snapshot automatically.
  app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    const isMutation = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH';
    const isBackupRoute = req.path.startsWith('/api/cloud-backup') || req.path.startsWith('/api/cloud-sync') || req.path.startsWith('/api/db/export');
    const isReadOnlyAuth = req.path === '/api/auth/login';
    if (isMutation && req.path.startsWith('/api') && !isBackupRoute && !isReadOnlyAuth) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          markDirty();
        }
      });
    }
    next();
  });

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-role');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Strict RBAC Helper Functions:
  // Extracts requester identity and verifies against database
  function getRequester(req: express.Request): { userId: string; role: string } {
    const headerId = (req.headers['x-user-id'] as string) || '';
    const headerRole = (req.headers['x-user-role'] as string) || '';
    const bodyId = req.body?.requesterId || req.body?.userId || '';
    const bodyRole = req.body?.requesterRole || '';
    const queryId = (req.query?.userId as string) || '';
    const queryRole = (req.query?.userRole as string) || '';

    const userId = headerId || bodyId || queryId;
    let role = headerRole || bodyRole || queryRole;

    if (userId) {
      try {
        const u = findUserById(userId);
        if (u) {
          role = u.role;
        }
      } catch {
        // ignore
      }
    }

    return { userId, role };
  }

  // Enforces that ONLY the App Super-Admin (مشرف التطبيق) can execute
  function requireAdmin(req: express.Request, res: express.Response): boolean {
    const { role } = getRequester(req);
    if (role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'صلاحية مرفوضة: هذه العملية حصرية لمشرف التطبيق (Admin) فقط. لا يملك مدير المؤسسة أو غيره صلاحية الوصول إليها.'
      });
      return false;
    }
    return true;
  }

  // Enforces that either Admin or Institution Director can execute
  function requireAdminOrDirector(req: express.Request, res: express.Response): { authorized: boolean; role: string; userId: string } {
    const requester = getRequester(req);
    if (requester.role !== 'admin' && requester.role !== 'director') {
      res.status(403).json({
        success: false,
        error: 'صلاحية مرفوضة: هذه العملية متاحة فقط لإدارة المؤسسة (المدير أو المشرف العام).'
      });
      return { authorized: false, ...requester };
    }
    return { authorized: true, ...requester };
  }

  // 1. Health & Cloud Sync
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/cloud-sync/status', async (req, res) => {
    try {
      const usersCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
      const sectionsCount = (db.prepare('SELECT COUNT(*) as c FROM sections').get() as any)?.c || 0;
      const attendanceCount = (db.prepare('SELECT COUNT(*) as c FROM attendance_history').get() as any)?.c || 0;
      res.json({
        success: true,
        cloudStorage: 'Firebase Firestore',
        databaseId: 'ai-studio-152aaa98-85f4-47cd-a9c7-c5d362d5959a',
        projectId: 'teak-helix-753bd',
        status: 'active',
        localStats: { users: usersCount, sections: sectionsCount, attendance: attendanceCount }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/cloud-sync/trigger', async (req, res) => {
    try {
      await syncDatabaseWithFirestore(db);
      res.json({ success: true, message: 'تمت مزامنة كافة البيانات مع قاعدة بيانات Firebase بنجاح' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1b. Automatic Cloud Backup (full-snapshot durability layer)
  // Status + list of available daily restore points
  app.get('/api/cloud-backup/status', async (req, res) => {
    try {
      const status = getBackupStatus();
      const snapshots = await listSnapshots();
      res.json({
        success: true,
        status,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          createdAt: s.createdAt,
          sectionsCount: s.sectionsCount,
          sizeKb: Math.round((s.length || 0) / 1024),
          reason: s.reason,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Take a snapshot right now
  app.post('/api/cloud-backup/snapshot', async (req, res) => {
    try {
      const manifest = await writeSnapshot('manual');
      if (!manifest) {
        return res.status(202).json({ success: true, message: 'نسخة أخرى قيد الحفظ حالياً، سيتم الحفظ تلقائياً.' });
      }
      res.json({
        success: true,
        message: `تم حفظ نسخة سحابية (${manifest.sectionsCount} قسم) بنجاح`,
        snapshot: { id: manifest.id, createdAt: manifest.createdAt, sectionsCount: manifest.sectionsCount },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Restore a specific day's snapshot (or the latest when no id is provided)
  app.post('/api/cloud-backup/restore', async (req, res) => {
    try {
      const snapshotId = req.body?.snapshotId as string | undefined;
      const result = await restoreSnapshot(snapshotId);
      if (!result) {
        return res.status(404).json({ success: false, error: 'لا توجد نسخة سحابية متاحة للاسترجاع.' });
      }
      res.json({
        success: true,
        message: `تم استرجاع نسخة "${result.snapshotId}" (${result.count} قسم) بنجاح`,
        count: result.count,
        snapshotId: result.snapshotId,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Settings
  app.get('/api/settings', (req, res) => {
    try {
      const settings = getAppSettings();
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/settings', (req, res) => {
    try {
      const updated = saveAppSettings(req.body);
      res.json({ success: true, settings: updated, message: 'تم حفظ الإعدادات في قاعدة البيانات بنجاح' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Sections
  app.get('/api/sections', (req, res) => {
    try {
      const requester = getRequester(req);
      const teacherId = req.query.teacherId as string | undefined;
      const viewerId = requester.userId || (req.headers['x-user-id'] as string) || undefined;
      const viewerRole = requester.role || (req.headers['x-user-role'] as string) || undefined;
      const sections = getAllSections(teacherId, viewerId, viewerRole);
      res.json({ success: true, sections });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/sections/available-for-request', (req, res) => {
    try {
      const teacherId = (req.query.teacherId as string) || '';
      const sections = getAvailableSectionsForRequest(teacherId);
      res.json({ success: true, sections });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/sections', (req, res) => {
    try {
      const sec = createSection(req.body);
      res.json({ success: true, section: sec });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/sections/:id', (req, res) => {
    try {
      updateSectionMeta(req.params.id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/sections', (req, res) => {
    try {
      const result = deleteAllSections();
      res.json({ success: true, count: result.count });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/sections/:id', (req, res) => {
    try {
      deleteSection(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Seats
  app.put('/api/sections/:id/seats/:seatNum', (req, res) => {
    try {
      const sectionId = req.params.id;
      const seatNum = Number(req.params.seatNum);
      const result = updateSeat(sectionId, seatNum, {
        ...req.body,
        actorId: (req.headers['x-user-id'] as string) || req.body.actorId || '',
        actorRole: (req.headers['x-user-role'] as string) || req.body.actorRole || 'teacher'
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4b. Batch Update Seats (آلية التحديث المجمع لتقليل استهلاك حصة Firestore)
  app.post('/api/sections/:id/seats/batch-update', (req, res) => {
    try {
      const sectionId = req.params.id;
      const updates = req.body.updates;
      const actorId = (req.headers['x-user-id'] as string) || req.body.actorId || '';
      const actorRole = (req.headers['x-user-role'] as string) || req.body.actorRole || 'teacher';
      const result = batchUpdateSeats(sectionId, updates, { actorId, actorRole });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Notes
  app.post('/api/sections/:id/seats/:seatNum/notes', (req, res) => {
    try {
      const sectionId = req.params.id;
      const seatNum = Number(req.params.seatNum);
      const note = addSeatNote(sectionId, seatNum, {
        ...req.body,
        teacherId: (req.headers['x-user-id'] as string) || req.body.teacherId || ''
      });
      res.json({ success: true, note });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/sections/:id/seats/:seatNum/notes/:noteId', (req, res) => {
    try {
      const sectionId = req.params.id;
      const seatNum = Number(req.params.seatNum);
      const noteId = req.params.noteId;
      const result = deleteSeatNote(sectionId, seatNum, noteId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5a. Predefined Violation Types (Managed by Director)
  app.get('/api/violation-types', (req, res) => {
    try {
      const types = getViolationTypes();
      res.json({ success: true, types });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/violation-types', (req, res) => {
    try {
      const result = addViolationType(req.body);
      res.json({ success: true, type: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/violation-types/:id', (req, res) => {
    try {
      const result = updateViolationType(req.params.id, req.body);
      res.json({ success: true, type: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/violation-types/:id', (req, res) => {
    try {
      const result = deleteViolationType(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/violation-types/reset', (req, res) => {
    try {
      const types = resetViolationTypes();
      res.json({ success: true, types, message: 'تم استعادة القائمة الافتراضية بنجاح' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5b. Student Seat Violations (Teacher / Director Record)
  app.post('/api/sections/:id/seats/:seatNum/violations', (req, res) => {
    try {
      const sectionId = req.params.id;
      const seatNum = Number(req.params.seatNum);
      const violation = addStudentViolation(sectionId, seatNum, {
        ...req.body,
        teacherId: (req.headers['x-user-id'] as string) || req.body.teacherId || ''
      });
      res.json({ success: true, violation });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/sections/:id/seats/:seatNum/violations/:violationId', (req, res) => {
    try {
      const sectionId = req.params.id;
      const seatNum = Number(req.params.seatNum);
      const violationId = req.params.violationId;
      const result = deleteStudentViolation(sectionId, seatNum, violationId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5c. Positive Participation Endpoints (المشاركات الإيجابية والنقاط التشجيعية للتلميذ)
  app.post('/api/sections/:id/seats/:seatNum/positive-participations', (req, res) => {
    try {
      const sectionId = req.params.id;
      const seatNum = Number(req.params.seatNum);
      const teacherId = (req.headers['x-user-id'] as string) || req.body.teacherId || '';
      const participation = addPositiveParticipation({
        ...req.body,
        sectionId,
        seatNum,
        teacherId
      });
      markDirty();
      res.json({ success: true, participation });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/sections/:id/positive-participations', (req, res) => {
    try {
      const sectionId = req.params.id;
      const teacherId = (req.headers['x-user-id'] as string) || req.body.teacherId || '';
      const participation = addPositiveParticipation({
        ...req.body,
        sectionId,
        teacherId
      });
      markDirty();
      res.json({ success: true, participation });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/sections/:id/positive-participations', (req, res) => {
    try {
      const sectionId = req.params.id;
      const teacherId = (req.query.teacherId as string) || undefined;
      const list = getPositiveParticipationsBySection(sectionId, teacherId);
      res.json({ success: true, participations: list });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/sections/:id/positive-participations/:participationId', (req, res) => {
    try {
      const participationId = req.params.participationId;
      const result = deletePositiveParticipation(participationId);
      markDirty();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Roster
  app.post('/api/sections/:id/roster', (req, res) => {
    try {
      const result = saveSectionRoster(req.params.id, req.body.roster || []);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6a1. Add student to end of section (Director/Admin)
  app.post('/api/sections/:id/students', (req, res) => {
    try {
      const sectionId = req.params.id;
      const { name, number, massarNumber, customSeatNum } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'اسم التلميذ مطلوب' });
      }
      const result = addStudentToSection(sectionId, { name, number, massarNumber, customSeatNum });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6a2. Remove student from section (Transfer or Dropout)
  app.delete('/api/sections/:id/students/:seatNum', (req, res) => {
    try {
      const sectionId = req.params.id;
      const seatNum = Number(req.params.seatNum);
      const reason = req.query.reason ? String(req.query.reason) : (req.body?.reason || 'انتقال');
      const result = removeStudentFromSection(sectionId, seatNum, reason);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6a3. Transfer student to another section in the same institution
  app.post('/api/sections/:id/students/:seatNum/transfer', (req, res) => {
    try {
      const sourceSectionId = req.params.id;
      const sourceSeatNum = Number(req.params.seatNum);
      const { targetSectionId, targetSeatNum, transferHistory } = req.body;
      if (!targetSectionId) {
        return res.status(400).json({ success: false, error: 'يرجى اختيار القسم المستقبل لنقل التلميذ إليه' });
      }
      const result = transferStudentToSection(
        sourceSectionId,
        sourceSeatNum,
        targetSectionId,
        targetSeatNum ? Number(targetSeatNum) : undefined,
        transferHistory !== false
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6b. Swap Seats (Drag & Drop)
  app.post('/api/sections/:id/swap-seats', (req, res) => {
    try {
      const sectionId = req.params.id;
      const { seatA, seatB } = req.body;
      const result = swapSeats(
        sectionId,
        Number(seatA),
        Number(seatB),
        (req.headers['x-user-id'] as string) || req.body.actorId,
        (req.headers['x-user-role'] as string) || req.body.actorRole
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6c. Shuffle / Randomize Seats
  app.post('/api/sections/:id/shuffle-seats', (req, res) => {
    try {
      const sectionId = req.params.id;
      const actorId = (req.headers['x-user-id'] as string) || req.body?.actorId || undefined;
      const actorRole = (req.headers['x-user-role'] as string) || req.body?.actorRole || undefined;
      const result = shuffleSectionSeats(sectionId, actorId, actorRole);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6c2. Order Section Seats by Sequential Student Number (الترتيب الافتراضي للتلاميذ حسب الرقم ابتداءً من الرقم 1)
  app.post('/api/sections/:id/order-by-number', (req, res) => {
    try {
      const sectionId = req.params.id;
      const actorId = (req.headers['x-user-id'] as string) || req.body?.actorId || undefined;
      const actorRole = (req.headers['x-user-role'] as string) || req.body?.actorRole || undefined;
      const result = orderSectionSeatsByNumber(sectionId, actorId, actorRole);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6c3. Renumber Section Students Sequentially (إعادة ترقيم التلاميذ تسلسلياً وسد أي أرقام فارغة)
  app.post('/api/sections/:id/renumber', (req, res) => {
    try {
      const sectionId = req.params.id;
      const result = renumberSectionStudents(sectionId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6c4. Reorder Section Students (سحب ووضع التلميذ سابقاً أو لاحقاً مع تحيين الأرقام تصاعدياً)
  app.post('/api/sections/:id/reorder-students', (req, res) => {
    try {
      const sectionId = req.params.id;
      const { sourceIndex, targetIndex, orderedStudentNames, studentName, newPosition, reorderSeatsToo } = req.body || {};
      const actorId = (req.headers['x-user-id'] as string) || req.body?.actorId || undefined;
      const actorRole = (req.headers['x-user-role'] as string) || req.body?.actorRole || undefined;

      const result = reorderSectionStudents(
        sectionId,
        {
          sourceIndex: typeof sourceIndex === 'number' ? sourceIndex : undefined,
          targetIndex: typeof targetIndex === 'number' ? targetIndex : undefined,
          orderedStudentNames: Array.isArray(orderedStudentNames) ? orderedStudentNames : undefined,
          studentName: typeof studentName === 'string' ? studentName : undefined,
          newPosition: typeof newPosition === 'number' ? newPosition : undefined,
          reorderSeatsToo: !!reorderSeatsToo
        },
        false,
        actorId,
        actorRole
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6d. Batch Import Multiple Sections
  app.post('/api/sections/batch-import', (req, res) => {
    try {
      const { sections, replaceExisting } = req.body;
      const result = batchImportSections(sections, !!replaceExisting);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6e. Seed 10 Sections
  app.post('/api/sections/seed-10', (req, res) => {
    try {
      const result = seedTenSections();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6f. Download PHP & MySQL Complete Package (ZIP & TAR.GZ)
  app.get(['/echsa_school_system_complete.zip', '/api/download-zip'], (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'public', 'echsa_school_system_complete.zip');
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Disposition', 'attachment; filename="echsa_school_system_complete.zip"');
        res.setHeader('Content-Type', 'application/zip');
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.status(404).json({ success: false, error: 'ملف الحزمة غير موجود' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get(['/echsa_school_system_complete.tar.gz', '/echsa_php_mysql_complete_package.tar.gz', '/api/export-php-package'], (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'public', 'echsa_school_system_complete.tar.gz');
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Disposition', 'attachment; filename="echsa_school_system_complete.tar.gz"');
        res.setHeader('Content-Type', 'application/gzip');
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.status(404).json({ success: false, error: 'ملف الحزمة غير موجود حالياً' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Audit Log / Change History
  app.get('/api/history', (req, res) => {
    try {
      const logs = getChangeLogs(Number(req.query.limit) || 50);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. DB Stats
  app.get('/api/db/stats', (req, res) => {
    try {
      const stats = getDatabaseStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Export Backup
  app.get('/api/db/export', (req, res) => {
    try {
      const backup = exportFullBackup();
      res.setHeader('Content-Disposition', 'attachment; filename="classroom-backup.json"');
      res.setHeader('Content-Type', 'application/json');
      res.json(backup);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 10. Import Backup
  app.post('/api/db/import', (req, res) => {
    try {
      const result = importFullBackup(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 11. Authentication Endpoints
  app.post('/api/auth/register', (req, res) => {
    try {
      const { username, email, password, confirmPassword, fullName, academicYear, subject } = req.body;
      if (confirmPassword !== undefined && password !== confirmPassword) {
        return res.status(400).json({ success: false, error: 'كلمتا المرور غير متطابقتين، يرجى إعادة التأكد' });
      }
      const user = createUser({
        username,
        email,
        password,
        fullName,
        academicYear,
        subject,
        status: 'pending' // Suspended until Director approval
      });
      res.json({
        success: true,
        user,
        needsEmailVerification: !user?.emailVerified,
        email: user?.email,
        username: user?.username,
        message: 'تم تسجيل الحساب بنجاح! يرجى إدخال رمز التأكيد المكون من 6 أرقام المرسل إلى بريدك الإلكتروني لتأكيد ملكية الحساب.',
        isPendingApproval: true
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/verify-email', (req, res) => {
    try {
      const { identifier, code } = req.body;
      if (!identifier || !code) {
        return res.status(400).json({ success: false, error: 'يرجى إدخال البريد الإلكتروني ورمز التحقق' });
      }
      const result = verifyEmailCode(identifier, code);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/resend-verification', (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ success: false, error: 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم' });
      }
      const result = sendVerificationCode(identifier);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/manual-verify-email', (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'معرف الأستاذ مطلوب' });
      }
      const result = manualVerifyEmail(userId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/admin-create-teacher', (req, res) => {
    try {
      const { username, email, password, fullName, academicYear, subject } = req.body;
      const user = createUser({
        username,
        email,
        password,
        fullName,
        academicYear,
        subject,
        status: 'active', // Pre-approved by Director
        autoVerifyEmail: true
      });
      res.json({ success: true, user, message: 'تم إنشاء حساب الأستاذ وتفعيله وتأكيد بريده مباشرة بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/admin-batch-create-teachers', (req, res) => {
    try {
      const { teachers, defaultPassword, updateExistingSubject } = req.body;
      if (!Array.isArray(teachers) || teachers.length === 0) {
        return res.status(400).json({ success: false, error: 'لم يتم تزويد لائحة الأساتذة للاستيراد' });
      }

      const result = batchCreateTeachers(teachers, {
        defaultPassword: defaultPassword || '123456',
        updateExistingSubject: updateExistingSubject ?? true
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Total wipe of all data except Super Admin account
  app.post('/api/admin/wipe-database', async (req, res) => {
    try {
      const requester = getRequester(req);
      if (requester.role && requester.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'هذه العملية محصورة بالمشرف العام على التطبيق (Admin) فقط' });
      }
      const result = wipeAllDataExceptAdmin();
      try {
        await writeSnapshot('manual');
      } catch {
        // non-blocking
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ success: false, error: 'يرجى إدخال اسم المستخدم/البريد وكلمة المرور' });
      }

      const userRow = findUserByUsernameOrEmail(identifier);
      if (!userRow) {
        return res.status(401).json({ success: false, error: 'اسم المستخدم أو البريد الإلكتروني غير صحيح' });
      }

      if (userRow.password !== password) {
        return res.status(401).json({ success: false, error: 'كلمة المرور غير صحيحة' });
      }

      // Check if email is verified for teachers
      if (userRow.role === 'teacher' && !userRow.email_verified) {
        // Automatically send a fresh code if expired or none exists
        try {
          sendVerificationCode(userRow.id);
        } catch {
          // ignore
        }
        return res.status(403).json({
          success: false,
          needsEmailVerification: true,
          email: userRow.email,
          username: userRow.username,
          error: 'يرجى تأكيد بريدك الإلكتروني أولاً. تم إرسال رمز التحقق المكون من 6 أرقام إلى بريدك الإلكتروني.'
        });
      }

      // Check account approval status for non-admin accounts
      if (userRow.role !== 'admin') {
        if (userRow.status === 'pending') {
          return res.status(403).json({
            success: false,
            error: 'حسابك معلق حالياً وفي انتظار موافقة وتفعيل السيد المدير. يرجى الانتظار حتى تتم المراجعة.',
            isPending: true
          });
        }
        if (userRow.status === 'inactive') {
          return res.status(403).json({
            success: false,
            error: 'تم توقيف هذا الحساب مؤقتاً من طرف إدارة المؤسسة. يرجى التواصل مع السيد المدير.',
            isInactive: true
          });
        }
      }

      const user = findUserById(userRow.id);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ success: false, error: 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم' });
      }

      const result = requestPasswordReset(identifier);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    try {
      const userId = (req.query.userId as string) || '';
      if (!userId) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم غير محدد' });
      }

      const user = findUserById(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
      }

      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/auth/profile', (req, res) => {
    try {
      const requester = getRequester(req);
      const { userId, fullName, academicYear, password, email, username, mustChangeProfile } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم غير محدد' });
      }

      const user = updateUserProfile(userId, { fullName, academicYear, password, email, username, mustChangeProfile }, requester);
      res.json({ success: true, user, message: 'تم تحديث بيانات الحساب بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/profile', (req, res) => {
    try {
      const requester = getRequester(req);
      const { userId, fullName, academicYear, password, email, username, mustChangeProfile } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم غير محدد' });
      }

      const user = updateUserProfile(userId, { fullName, academicYear, password, email, username, mustChangeProfile }, requester);
      res.json({ success: true, user, message: 'تم تحديث وتثبيت بيانات الحساب بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Teacher Management Endpoints
  // - Viewing list is open to authenticated users
  // - Editing/Deleting/Status/Password is restricted to Admin or Director
  app.get('/api/auth/teachers', (req, res) => {
    try {
      const teachers = getAllTeachers();
      res.json({ success: true, teachers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Director & Admin Credential Export for Printing
  app.get('/api/director/teachers/credentials', (req, res) => {
    try {
      const auth = requireAdminOrDirector(req, res);
      if (!auth.authorized) return;

      const teachers = getTeachersWithCredentials();
      res.json({ success: true, teachers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/auth/teachers/:id', (req, res) => {
    try {
      const auth = requireAdminOrDirector(req, res);
      if (!auth.authorized) return;

      const teacher = updateTeacherData(req.params.id, req.body, auth.role);
      res.json({ success: true, teacher, message: 'تم تحديث بيانات الأستاذ بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/auth/teachers', (req, res) => {
    try {
      const auth = requireAdminOrDirector(req, res);
      if (!auth.authorized) return;

      const result = deleteAllTeachers(auth.role);
      markDirty();
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/auth/teachers/:id', (req, res) => {
    try {
      const auth = requireAdminOrDirector(req, res);
      if (!auth.authorized) return;

      const result = deleteTeacher(req.params.id, auth.role);
      markDirty();
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/auth/teachers/:id/status', (req, res) => {
    try {
      const auth = requireAdminOrDirector(req, res);
      if (!auth.authorized) return;

      const { status } = req.body;
      if (!status || !['active', 'pending', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, error: 'حالة غير صالحة' });
      }
      const teacher = updateTeacherStatus(req.params.id, status, auth.role);
      res.json({ success: true, teacher });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/auth/teachers/:id/reset-password', (req, res) => {
    try {
      const auth = requireAdminOrDirector(req, res);
      if (!auth.authorized) return;

      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, error: 'كلمة المرور الجديدة مطلوبة' });
      }
      const result = adminResetTeacherPassword(req.params.id, password, auth.role);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Director Management Endpoints (Strictly Exclusive to App Supervisor / Admin)
  // An Institution Director CANNOT add, update, replace, change status, or delete directors
  app.get('/api/admin/directors', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const directors = getAllDirectors('admin');
      res.json({ success: true, directors });
    } catch (err: any) {
      res.status(403).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/directors', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const { username, email, password, fullName, academicYear, status } = req.body;
      if (!username || !email || !fullName) {
        return res.status(400).json({ success: false, error: 'يرجى ملء جميع الحقول الإلزامية للمدير (الاسم، اسم المستخدم، والبريد)' });
      }
      const director = createDirector({ username, email, password, fullName, academicYear, status }, 'admin');
      res.json({ success: true, director, message: 'تم إنشاء حساب المدير بنجاح وتفعيله من طرف المشرف العام' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/directors/:id', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const director = updateDirectorData(req.params.id, req.body, 'admin');
      res.json({ success: true, director, message: 'تم تعديل بيانات المدير بنجاح من طرف المشرف العام' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/directors/:id/status', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const { status } = req.body;
      if (status !== 'active' && status !== 'inactive') {
        return res.status(400).json({ success: false, error: 'حالة غير صالحة، يجب أن تكون active أو inactive' });
      }
      const director = updateDirectorStatus(req.params.id, status, 'admin');
      res.json({
        success: true,
        director,
        message: status === 'active' ? 'تم تفعيل حساب المدير بنجاح' : 'تم تعطيل حساب المدير مؤقتاً بنجاح'
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/directors/:id/reset-password', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, error: 'كلمة المرور الجديدة مطلوبة' });
      }
      const result = adminResetDirectorPassword(req.params.id, password, 'admin');
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/directors/:id', (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const result = deleteDirector(req.params.id, 'admin');
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Reset all application data back to zero (Strictly Exclusive to General Supervisor / Super-Admin)
  app.post('/api/admin/reset-to-zero', async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;
      const result = await resetAllDataToZero('admin');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Academic Years Endpoints (تدبير المواسم الدراسية)
  // ==========================================
  app.get('/api/academic-years', (req, res) => {
    try {
      const years = getAllAcademicYears();
      res.json({ success: true, academicYears: years });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/academic-years', (req, res) => {
    try {
      const { name, startDate, endDate, isCurrent, notes } = req.body;
      const years = createAcademicYear({ name, startDate, endDate, isCurrent, notes });
      res.json({ success: true, academicYears: years, message: 'تمت إضافة الموسم الدراسي بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/academic-years/:id/set-current', (req, res) => {
    try {
      const years = setCurrentAcademicYear(req.params.id);
      res.json({ success: true, academicYears: years, message: 'تم تعيين الموسم الدراسي كنشط حالياً' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/academic-years/:id/archive', (req, res) => {
    try {
      const years = archiveAcademicYear(req.params.id);
      res.json({ success: true, academicYears: years, message: 'تمت أرشفة الموسم الدراسي بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/academic-years/:id/unarchive', (req, res) => {
    try {
      const years = unarchiveAcademicYear(req.params.id);
      res.json({ success: true, academicYears: years, message: 'تم إلغاء أرشفة الموسم الدراسي' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/academic-years/:id', (req, res) => {
    try {
      const years = deleteAcademicYear(req.params.id);
      res.json({ success: true, academicYears: years, message: 'تم حذف الموسم الدراسي بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Director Analytics Endpoint
  app.get('/api/director/analytics', (req, res) => {
    try {
      const analytics = getDirectorAnalytics();
      res.json({ success: true, ...analytics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 12. Section Assignment Requests Endpoints
  app.post('/api/assignment-requests', (req, res) => {
    try {
      const { teacherId, sectionId, requestNote } = req.body;
      if (!teacherId || !sectionId) {
        return res.status(400).json({ success: false, error: 'معلومات الطلب غير مكتملة' });
      }

      const result = createAssignmentRequest(teacherId, sectionId, requestNote);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/assignment-requests', (req, res) => {
    try {
      const teacherId = req.query.teacherId as string | undefined;
      const status = req.query.status as string | undefined;
      const requests = getAssignmentRequests({ teacherId, status });
      res.json({ success: true, requests });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/assignment-requests/:id/review', (req, res) => {
    try {
      const { decision, reviewerId } = req.body;
      if (!decision || (decision !== 'approved' && decision !== 'rejected')) {
        return res.status(400).json({ success: false, error: 'القرار يجب أن يكون إما approved أو rejected' });
      }

      const result = reviewAssignmentRequest(req.params.id, decision, reviewerId || 'admin');
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/sections/:id/assign-teacher', (req, res) => {
    try {
      const { teacherId } = req.body;
      if (!teacherId) {
        return res.status(400).json({ success: false, error: 'معرف الأستاذ مطلوب' });
      }

      const result = assignSectionDirectly(teacherId, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/sections/:id/unassign-teacher', (req, res) => {
    try {
      const teacherId = req.body?.teacherId || (req.query?.teacherId as string | undefined);
      const result = unassignSection(req.params.id, teacherId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 13. Simulated Email Outbox Endpoint (Password recovery & alerts)
  app.get('/api/emails/outbox', (req, res) => {
    try {
      const limit = Number(req.query.limit) || 30;
      const emails = getOutboxEmails(limit);
      res.json({ success: true, emails });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 14. School Activities & Institutional Wall Endpoints
  app.get('/api/activities', (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const userRole = req.query.userRole as string | undefined;
      const activities = getSchoolActivities(userId, userRole);
      res.json({ success: true, activities });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/activities', (req, res) => {
    try {
      const { title, description, category, imageUrl, authorId, authorName, authorRole, authorSubject } = req.body;
      if (!title || !authorId || !authorName) {
        return res.status(400).json({ success: false, error: 'عنوان المنشور ومعلومات الكاتب مطلوبة' });
      }

      const activity = createSchoolActivity({
        title,
        description,
        category,
        imageUrl,
        authorId,
        authorName,
        authorRole: authorRole === 'admin' ? 'admin' : 'teacher',
        authorSubject
      });

      res.json({ success: true, activity });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Director / Admin Approves or Rejects a Post
  app.put('/api/activities/:id/status', (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'الحالة يجب أن تكون إما approved أو rejected' });
      }

      const updated = updateSchoolActivityStatus(req.params.id, status);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'المنشور غير موجود' });
      }

      res.json({ success: true, activity: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/activities/:id', (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const userRole = req.query.userRole as string | undefined;

      const deleted = deleteSchoolActivity(req.params.id, userId, userRole);
      if (!deleted) {
        return res.status(403).json({ success: false, error: 'ليس لديك صلاحية لحذف هذا المنشور' });
      }

      res.json({ success: true, message: 'تم حذف المنشور بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/activities/:id/like', (req, res) => {
    try {
      const result = likeSchoolActivity(req.params.id);
      if (!result) {
        return res.status(404).json({ success: false, error: 'المنشور غير موجود' });
      }
      res.json({ success: true, likesCount: result.likesCount });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // DAILY ARCHIVE ROUTES (أرشيف الغيابات والمخالفات اليومي)
  // ==========================================

  // Get daily archive records and statistics for a given date
  app.get('/api/daily-archive', (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const rawSectionId = req.query.sectionId as string | undefined;
      const teacherId = req.query.teacherId as string | undefined;
      const sectionId = rawSectionId && rawSectionId !== 'all' ? rawSectionId : undefined;
      const data = getDailyArchive(date, sectionId, teacherId);
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/students/:sectionId/:seatNum/history', (req, res) => {
    try {
      const seatNum = Number(req.params.seatNum);
      if (!req.params.sectionId || !Number.isInteger(seatNum) || seatNum < 1) {
        return res.status(400).json({ success: false, error: 'بيانات التلميذ غير صالحة' });
      }
      const studentName = (req.query.studentName as string) || undefined;
      const studentNumber = (req.query.studentNumber as string) || undefined;
      const viewerId = (req.headers['x-user-id'] as string) || (req.query.viewerId as string) || undefined;
      res.json({ success: true, history: getStudentHistory(req.params.sectionId, seatNum, studentName, studentNumber, viewerId) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Query student history by query params
  app.get('/api/students/history', (req, res) => {
    try {
      const sectionId = (req.query.sectionId as string) || '';
      const seatNum = Number(req.query.seatNum || 1);
      const studentName = (req.query.studentName as string) || undefined;
      const studentNumber = (req.query.studentNumber as string) || undefined;
      const viewerId = (req.headers['x-user-id'] as string) || (req.query.viewerId as string) || undefined;
      if (!sectionId) {
        return res.status(400).json({ success: false, error: 'معرف القسم مطلوب' });
      }
      res.json({ success: true, history: getStudentHistory(sectionId, seatNum, studentName, studentNumber, viewerId) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Early warning: Repeated absences list
  app.get('/api/attendance/repeated-absences', (req, res) => {
    try {
      const threshold = Number(req.query.threshold || 3);
      const students = getRepeatedAbsenceStudents(threshold);
      res.json({ success: true, count: students.length, threshold, students });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Monthly Attendance Summary by Section
  app.get('/api/attendance/monthly-summary', (req, res) => {
    try {
      const month = (req.query.month as string) || undefined;
      const result = getAttendanceMonthlySummary(month);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reset Absences (تصفير الغيابات والمواظبة)
  app.post(['/api/attendance/reset', '/api/director/reset-absences'], async (req, res) => {
    try {
      const mode = (req.body.mode as 'today' | 'all' | 'section') || 'today';
      const sectionId = req.body.sectionId || undefined;
      const actorId = (req.headers['x-user-id'] as string) || req.body.actorId || '';
      const actorRole = (req.headers['x-user-role'] as string) || req.body.actorRole || 'director';
      const actorName = req.body.actorName || '';

      const result = await resetAbsences({
        mode,
        sectionId,
        actor: { id: actorId, role: actorRole, name: actorName }
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Teacher Timetable API (استعمال زمن الأساتذة)
  // ==========================================

  app.get('/api/teacher/timetable', (req, res) => {
    try {
      const teacherId = (req.query.teacherId as string) || (req.headers['x-user-id'] as string);
      if (!teacherId) {
        return res.status(400).json({ success: false, error: 'معرف الأستاذ مطلوب' });
      }
      const entries = getTeacherTimetable(teacherId);
      res.json({ success: true, teacherId, entries });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/teacher/timetable', (req, res) => {
    try {
      const teacherId = req.body.teacherId || (req.headers['x-user-id'] as string);
      if (!teacherId) {
        return res.status(400).json({ success: false, error: 'معرف الأستاذ مطلوب' });
      }
      const { dayOfWeek, slotId, periodType, startTime, endTime, sectionId, room, subject, notes } = req.body;
      if (!dayOfWeek || !slotId || !sectionId) {
        return res.status(400).json({ success: false, error: 'بيانات الحصة غير مكتملة' });
      }
      const entry = upsertTimetableSlot(teacherId, {
        dayOfWeek,
        slotId,
        periodType: periodType || 'morning',
        startTime: startTime || '08:00',
        endTime: endTime || '09:00',
        sectionId,
        room,
        subject,
        notes
      });
      markDirty();
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/teacher/timetable/:id', (req, res) => {
    try {
      const teacherId = (req.headers['x-user-id'] as string) || undefined;
      deleteTimetableEntryById(req.params.id, teacherId);
      markDirty();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/teacher/timetable/slot/:dayOfWeek/:slotId', (req, res) => {
    try {
      const teacherId = (req.query.teacherId as string) || (req.headers['x-user-id'] as string);
      if (!teacherId) {
        return res.status(400).json({ success: false, error: 'معرف الأستاذ مطلوب' });
      }
      deleteTimetableSlot(teacherId, req.params.slotId, req.params.dayOfWeek);
      markDirty();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Add a new daily absence record
  app.post('/api/daily-archive/absences', (req, res) => {
    try {
      const {
        sectionId,
        seatNum,
        studentName,
        studentNumber,
        status,
        recordedDate,
        sessionPeriod,
        teacherName,
        teacherSubject,
        justified,
        justificationReason,
        notes
      } = req.body;

      if (!sectionId || !studentName) {
        return res.status(400).json({ success: false, error: 'القسم واسم التلميذ مطلوبان' });
      }

      const result = addDailyAbsence({
        sectionId,
        seatNum: Number(seatNum) || 0,
        studentName,
        studentNumber,
        status: status || 'absent',
        recordedDate,
        sessionPeriod,
        teacherName,
        teacherSubject,
        justified,
        justificationReason,
        notes
      });

      res.json({ success: true, id: result.id, message: 'تم تسجيل الغياب اليومي بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Batch import absences (e.g. from Massar Excel / CSV)
  app.post('/api/daily-archive/absences/batch-import', (req, res) => {
    try {
      const items = req.body.absences;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'قائمة الغيابات فارغة أو غير صحيحة' });
      }
      const result = batchImportDailyAbsences(items);
      markDirty();
      res.json({
        ...result,
        message: `تم استيراد ${result.importedCount} حالة غياب بنجاح ومطابقة ${result.matchedStudentsCount} تلميذاً`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update a daily absence record (e.g. justify, add medical certificate, change session)
  app.put('/api/daily-archive/absences/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, sessionPeriod, justified, justificationReason, notes } = req.body;
      const result = updateDailyAbsence(id, {
        status,
        sessionPeriod,
        justified,
        justificationReason,
        notes
      });
      res.json({ success: true, message: 'تم تحديث سجل الغياب بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Resolve an active absence (mark as ended/attended while preserving in archive)
  app.post('/api/daily-archive/absences/:id/resolve', (req, res) => {
    try {
      const id = Number(req.params.id);
      const actorId = (req.headers['x-user-id'] as string) || req.body?.actorId || '';
      const actorRole = (req.headers['x-user-role'] as string) || req.body?.actorRole || 'director';
      const actorName = req.body?.actorName || '';
      const actorSubject = req.body?.actorSubject || '';

      const result = resolveDailyAbsence(id, {
        id: actorId,
        role: actorRole,
        name: actorName,
        subject: actorSubject
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Advanced Institutional Analytics API
  // ==========================================
  app.get('/api/analytics/institutional', (req, res) => {
    try {
      const year = req.query.year as string | undefined;
      const data = getAdvancedInstitutionalAnalytics(year);
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Parent Summons & Commitments API
  // ==========================================
  app.get('/api/parent-summons', (req, res) => {
    try {
      const sectionId = req.query.sectionId as string | undefined;
      const summons = getParentSummons(sectionId);
      res.json({ success: true, summons });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/parent-summons', (req, res) => {
    try {
      const {
        sectionId,
        studentName,
        studentNumber,
        massarNumber,
        reason,
        summonsDate,
        appointmentTime,
        status,
        guardianName,
        notes
      } = req.body;

      if (!sectionId || !studentName || !reason || !summonsDate) {
        return res.status(400).json({ success: false, error: 'القسم، اسم التلميذ، سبب الاستدعاء وتاريخ الاستدعاء مطلوبة' });
      }

      const createdBy = (req.headers['x-user-id'] as string) || '';
      const item = createParentSummons({
        sectionId,
        studentName,
        studentNumber,
        massarNumber,
        reason,
        summonsDate,
        appointmentTime,
        status,
        guardianName,
        notes,
        createdBy
      });
      markDirty();
      res.json({ success: true, item, message: 'تم إنشاء استدعاء ولي الأمر بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/parent-summons/:id', (req, res) => {
    try {
      const id = req.params.id;
      const { status, guardianName, notes, appointmentTime, reason } = req.body;
      const result = updateParentSummons(id, {
        status,
        guardianName,
        notes,
        appointmentTime,
        reason
      });
      markDirty();
      res.json({ success: true, message: 'تم تحديث حالة الاستدعاء بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/parent-summons/:id', (req, res) => {
    try {
      deleteParentSummons(req.params.id);
      markDirty();
      res.json({ success: true, message: 'تم حذف الاستدعاء بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Student Portal API (فضاء التلميذ)
  // ==========================================
  app.post('/api/student/login', (req, res) => {
    try {
      const { massarNumber, accessCode } = req.body;
      const data = studentLogin(massarNumber, accessCode);
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message });
    }
  });

  app.get('/api/student/accounts', (req, res) => {
    try {
      const sectionId = req.query.sectionId as string | undefined;
      const accounts = getStudentAccounts(sectionId);
      res.json({ success: true, accounts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/student/accounts/:id/regenerate', (req, res) => {
    try {
      const { customCode } = req.body;
      const result = regenerateStudentAccessCode(req.params.id, customCode);
      markDirty();
      res.json({ ...result, message: 'تم توليد كود دخول جديد بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/student/accounts/section/:sectionId/regenerate', (req, res) => {
    try {
      const result = regenerateSectionStudentAccessCodes(req.params.sectionId);
      markDirty();
      res.json({ ...result, message: `تم توليد أكواد جديدة لـ ${result.count} تلميذاً في القسم بنجاح` });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Delete a daily absence record
  app.delete('/api/daily-archive/absences/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      deleteDailyAbsence(id);
      res.json({ success: true, message: 'تم حذف سجل الغياب بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Add a new daily violation record
  app.post('/api/daily-archive/violations', (req, res) => {
    try {
      const {
        sectionId,
        seatNum,
        studentName,
        studentNumber,
        violationType,
        description,
        actionTaken,
        teacherName,
        teacherSubject,
        recordedDate,
        recordedTime
      } = req.body;

      if (!sectionId || !studentName || !description) {
        return res.status(400).json({ success: false, error: 'القسم واسم التلميذ ووصف المخالفة مطلوبة' });
      }

      const result = addDailyViolation({
        sectionId,
        seatNum: seatNum ? Number(seatNum) : undefined,
        studentName,
        studentNumber,
        violationType: violationType || 'مخالفة تربوية أخرى',
        description,
        actionTaken,
        teacherName,
        teacherSubject,
        recordedDate,
        recordedTime,
        teacherId: (req.headers['x-user-id'] as string) || req.body.teacherId || ''
      });

      res.json({ success: true, id: result.id, message: 'تم تسجيل المخالفة بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Update a daily violation record
  app.put('/api/daily-archive/violations/:id', (req, res) => {
    try {
      const id = req.params.id;
      const { violationType, description, actionTaken, recordedDate, recordedTime } = req.body;
      updateDailyViolation(id, {
        violationType,
        description,
        actionTaken,
        recordedDate,
        recordedTime
      });
      res.json({ success: true, message: 'تم تحديث سجل المخالفة بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Delete a daily violation record
  app.delete('/api/daily-archive/violations/:id', (req, res) => {
    try {
      const id = req.params.id;
      deleteDailyViolation(id);
      res.json({ success: true, message: 'تم حذف سجل المخالفة بنجاح' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Visitor Tracking & Analytics API (زوار الموقع)
  // ==========================================

  app.post('/api/visitors/track', (req, res) => {
    try {
      const { visitorId, userId, visitorType, userName, userEmail, subject, path: clientPath, pageTitle } = req.body;
      const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
      const ipAddress = rawIp.split(',')[0].trim();
      const userAgent = (req.headers['user-agent'] as string) || '';

      const result = trackVisitorLog({
        visitorId,
        userId,
        visitorType,
        userName,
        userEmail,
        subject,
        ipAddress,
        userAgent,
        path: clientPath,
        pageTitle
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get(['/api/visitors/analytics', '/api/visitors/stats'], (req, res) => {
    try {
      const role = (req.headers['x-user-role'] as string) || (req.query.role as string);
      if (role !== 'admin') {
        return res.status(403).json({ success: false, error: 'غير مصرح: إحصائيات الزوار متاحة حصرياً لمدير التطبيق (Admin)' });
      }
      const stats = getVisitorAnalytics();
      res.json({ success: true, ...stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/visitors/logs', (req, res) => {
    try {
      const role = (req.headers['x-user-role'] as string) || (req.query.role as string);
      if (role !== 'admin') {
        return res.status(403).json({ success: false, error: 'غير مصرح: مسح السجلات متاح حصرياً لمدير التطبيق (Admin)' });
      }
      const result = clearVisitorLogs();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite Middleware in Dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} with persistent SQLite DB`);
  });
}

startServer();
