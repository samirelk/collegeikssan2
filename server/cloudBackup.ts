import { getDoc, setDoc, deleteDoc, listDocs } from './firestoreService.ts';

/**
 * Automatic durable cloud backup engine.
 *
 * The app runs on an ephemeral filesystem: the local SQLite file is wiped on
 * every container restart / redeploy. To make the data truly durable we take
 * periodic FULL snapshots of the database (the exact same payload the user used
 * to export/import by hand as JSON) and store them in Firebase Firestore, then
 * automatically restore the latest snapshot on boot when the local DB is empty.
 *
 * Snapshots are:
 *   - Taken automatically after any change (debounced) and on a safety interval.
 *   - Kept one-per-day so the user can always roll back to "yesterday's version".
 *   - Chunked across multiple Firestore docs to stay under the 1 MiB/doc limit.
 */

// Manifest docs (small) live here — one per calendar day.
const SNAPSHOT_COLLECTION = 'db_snapshots';
// The large JSON payload is split into string chunks stored here.
const CHUNK_COLLECTION = 'db_snapshot_chunks';
// Max characters per chunk. Firestore hard limit is 1,048,576 bytes/doc; keep a wide margin.
const CHUNK_SIZE = 700_000;
// How many daily snapshots to retain before pruning the oldest.
const MAX_DAILY_SNAPSHOTS = 21;
// Debounce window after a change before writing a snapshot.
const DEBOUNCE_MS = 2_000;
// Safety interval to catch anything the debounce missed.
const INTERVAL_MS = 5 * 60 * 1000;

type ExportFn = () => any;
type ImportFn = (backup: any) => { success: boolean; count: number };

let exportFullBackup: ExportFn | null = null;
let importFullBackup: ImportFn | null = null;
let dbRef: any = null;

let dirty = false;
let writing = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let lastSnapshotAt: string | null = null;
let lastSnapshotError: string | null = null;
let restoredOnBoot = false;

export interface SnapshotManifest {
  id: string;            // calendar day key, e.g. "2026-09-20"
  createdAt: string;     // ISO timestamp of the most recent write for that day
  chunkCount: number;
  length: number;        // total JSON string length
  sectionsCount: number;
  reason: string;
}

export function configureCloudBackup(opts: { exportFullBackup: ExportFn; importFullBackup: ImportFn; db: any }) {
  exportFullBackup = opts.exportFullBackup;
  importFullBackup = opts.importFullBackup;
  dbRef = opts.db;
}

function dayKey(d: Date = new Date()): string {
  // Calendar day in GMT (UTC). Snapshots for the same day overwrite each other.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

/** Write a full snapshot to Firestore. Overwrites the current day's snapshot. */
export async function writeSnapshot(reason: string = 'manual'): Promise<SnapshotManifest | null> {
  if (!exportFullBackup) {
    console.warn('[CloudBackup] Not configured; skipping snapshot.');
    return null;
  }
  if (writing) {
    // A write is already in flight. Wait for it instead of allowing a request
    // to finish while the latest local change is still only in memory.
    dirty = true;
    while (writing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return writeSnapshot(reason);
  }

  writing = true;
  // Reset the dirty flag up-front so changes arriving mid-write re-trigger a snapshot.
  dirty = false;

  try {
    const backup = exportFullBackup();
    const json = JSON.stringify(backup);
    const chunks = chunkString(json, CHUNK_SIZE);
    const snapshotId = dayKey();
    const now = new Date().toISOString();
    const sectionsCount = Array.isArray(backup?.sections) ? backup.sections.length : 0;

    // Read the previous manifest so we can delete any now-orphaned chunks.
    const prev = (await getDoc(SNAPSHOT_COLLECTION, snapshotId)) as SnapshotManifest | null;
    const prevChunkCount = prev?.chunkCount || 0;

    // Safety guard: only skip auto-snapshots if sectionsCount is 0 AND it was an unverified auto-tick without an intentional deletion
    const isExplicitlyCleared = Boolean(dbRef?.prepare?.("SELECT 1 FROM app_settings WHERE key IN ('data_reset_completed', 'user_deleted_all_sections') AND value = 'true'")?.get?.());
    if (reason === 'auto' && sectionsCount === 0 && prev && (prev.sectionsCount || 0) > 0 && !isExplicitlyCleared) {
      console.warn(`[CloudBackup] Skipping auto-snapshot: local DB has 0 sections while existing snapshot "${snapshotId}" has ${prev.sectionsCount} sections.`);
      return prev;
    }

    // Write chunks (sequential to keep memory + concurrency modest).
    for (let i = 0; i < chunks.length; i++) {
      if (!await setDoc(CHUNK_COLLECTION, `${snapshotId}__${i}`, { data: chunks[i], index: i })) {
        throw new Error(`تعذر حفظ مقطع النسخة السحابية رقم ${i}.`);
      }
    }

    // Remove leftover chunks from a previously larger snapshot for this day.
    for (let i = chunks.length; i < prevChunkCount; i++) {
      if (!await deleteDoc(CHUNK_COLLECTION, `${snapshotId}__${i}`)) {
        throw new Error(`تعذر حذف المقطع القديم رقم ${i} من النسخة السحابية.`);
      }
    }

    const manifest: SnapshotManifest = {
      id: snapshotId,
      createdAt: now,
      chunkCount: chunks.length,
      length: json.length,
      sectionsCount,
      reason,
    };
    if (!await setDoc(SNAPSHOT_COLLECTION, snapshotId, manifest as any)) {
      throw new Error('تعذر حفظ بيان النسخة السحابية.');
    }

    lastSnapshotAt = now;
    lastSnapshotError = null;
    console.log(`☁️  [CloudBackup] Snapshot "${snapshotId}" saved (${sectionsCount} sections, ${(json.length / 1024).toFixed(0)} KB, ${chunks.length} chunk[s], reason=${reason}).`);

    await pruneOldSnapshots();
    return manifest;
  } catch (err: any) {
    lastSnapshotError = err?.message || String(err);
    console.error('[CloudBackup] writeSnapshot failed:', lastSnapshotError);
    dirty = true; // retry on next tick
    return null;
  } finally {
    writing = false;
  }
}

/** List all snapshot manifests, newest first. */
export async function listSnapshots(): Promise<SnapshotManifest[]> {
  const docs = (await listDocs(SNAPSHOT_COLLECTION)) as SnapshotManifest[];
  return docs
    .filter((d) => d && d.id)
    .sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));
}

/** Reassemble and parse a snapshot payload by its id. */
export async function readSnapshot(snapshotId: string): Promise<any | null> {
  const manifest = (await getDoc(SNAPSHOT_COLLECTION, snapshotId)) as SnapshotManifest | null;
  if (!manifest) return null;

  let json = '';
  for (let i = 0; i < manifest.chunkCount; i++) {
    const chunk = await getDoc(CHUNK_COLLECTION, `${snapshotId}__${i}`);
    if (!chunk || typeof chunk.data !== 'string') {
      throw new Error(`النسخة "${snapshotId}" ناقصة (المقطع ${i} مفقود).`);
    }
    json += chunk.data;
  }

  try {
    return JSON.parse(json);
  } catch {
    throw new Error(`تعذّر قراءة النسخة "${snapshotId}" (بيانات تالفة).`);
  }
}

/** Restore a snapshot into the local DB. Restores the latest one when no id given. */
export async function restoreSnapshot(snapshotId?: string): Promise<{ success: boolean; count: number; snapshotId: string } | null> {
  if (!importFullBackup) throw new Error('CloudBackup غير مهيأ.');

  let id = snapshotId;
  if (!id) {
    const all = await listSnapshots();
    if (all.length === 0) return null;
    id = all[0].id;
  }

  const backup = await readSnapshot(id!);
  if (!backup) return null;

  const result = importFullBackup(backup);
  return { ...result, snapshotId: id! };
}

/** Delete a snapshot manifest and all of its chunks. */
async function deleteSnapshot(manifest: SnapshotManifest) {
  for (let i = 0; i < (manifest.chunkCount || 0); i++) {
    await deleteDoc(CHUNK_COLLECTION, `${manifest.id}__${i}`);
  }
  await deleteDoc(SNAPSHOT_COLLECTION, manifest.id);
}

async function pruneOldSnapshots() {
  try {
    const all = await listSnapshots();
    if (all.length <= MAX_DAILY_SNAPSHOTS) return;
    const stale = all.slice(MAX_DAILY_SNAPSHOTS);
    for (const m of stale) {
      await deleteSnapshot(m);
      console.log(`🧹 [CloudBackup] Pruned old snapshot "${m.id}".`);
    }
  } catch (err: any) {
    console.warn('[CloudBackup] pruneOldSnapshots warning:', err?.message || err);
  }
}

/**
 * Boot-time recovery. Restores the latest cloud snapshot automatically so that
 * seating maps, rosters, notes and settings survive ephemeral container restarts.
 * Runs at most once per process.
 */
export async function restoreLatestSnapshotOnBoot(): Promise<void> {
  if (restoredOnBoot || !dbRef) return;
  restoredOnBoot = true;

  try {
    // Check if user has explicitly reset data or deleted all sections
    const isReset = Boolean(dbRef.prepare("SELECT 1 FROM app_settings WHERE key IN ('data_reset_completed', 'user_deleted_all_sections') AND value = 'true'").get());
    if (isReset) {
      console.log('ℹ️  [CloudBackup] Data reset or intentional wipe marker detected; skipping snapshot auto-restore.');
      return;
    }

    let localSections = 0;
    try {
      localSections = (dbRef.prepare('SELECT COUNT(*) as c FROM sections').get() as any)?.c || 0;
    } catch {
      localSections = 0;
    }

    // If local database has ANY sections (even empty sections), respect the local state!
    if (localSections > 0) {
      console.log(`✅ [CloudBackup] Local database already initialized with ${localSections} section(s); skipping snapshot auto-restore to respect current state.`);
      return;
    }

    const all = await listSnapshots();
    if (all.length === 0) {
      console.log('☁️  [CloudBackup] No cloud snapshot found yet. Local data will seed the first one.');
      return;
    }

    // Always use the most recent daily snapshot
    const targetSnapshot = all[0];
    if (targetSnapshot.sectionsCount === 0) {
      console.log('☁️  [CloudBackup] Latest snapshot has 0 sections; skipping restore.');
      return;
    }

    console.log(`♻️  [CloudBackup] Auto-restoring cloud snapshot "${targetSnapshot.id}" (${targetSnapshot.sectionsCount} section[s], local was ${localSections} sections)...`);
    const res = await restoreSnapshot(targetSnapshot.id);
    if (res?.success) {
      console.log(`✅ [CloudBackup] Auto-restored ${res.count} section(s) from snapshot "${targetSnapshot.id}".`);
    }
  } catch (err: any) {
    console.error('[CloudBackup] restoreLatestSnapshotOnBoot failed:', err?.message || err);
  }
}

/** Purge all snapshots and chunks from Firestore (used during complete reset) */
export async function purgeAllSnapshots(): Promise<void> {
  try {
    const all = await listSnapshots();
    for (const m of all) {
      await deleteSnapshot(m);
    }
    console.log(`🧹 [CloudBackup] Purged ${all.length} snapshot(s) from cloud.`);
  } catch (err: any) {
    console.warn('[CloudBackup] purgeAllSnapshots warning:', err?.message || err);
  }
}

/** Mark the DB as changed; schedules a debounced snapshot. */
export function markDirty() {
  dirty = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void maybeSnapshot('auto');
  }, DEBOUNCE_MS);
}

async function maybeSnapshot(reason: string) {
  if (!dirty || writing) return;
  await writeSnapshot(reason);
}

/** Start the periodic safety-net snapshot loop. */
export function startAutoBackup() {
  if (intervalTimer) return;
  intervalTimer = setInterval(() => {
    void maybeSnapshot('interval');
  }, INTERVAL_MS);
  if (typeof (intervalTimer as any).unref === 'function') (intervalTimer as any).unref();
  console.log('☁️  [CloudBackup] Automatic cloud backup is active (debounced + every 5 min).');
}

/** Force a snapshot immediately (used on graceful shutdown / manual trigger). */
export async function flushSnapshot(reason: string = 'flush'): Promise<SnapshotManifest | null> {
  dirty = true;
  return writeSnapshot(reason);
}

export function getBackupStatus() {
  return {
    active: intervalTimer !== null,
    lastSnapshotAt,
    lastSnapshotError,
    pendingChanges: dirty,
  };
}
