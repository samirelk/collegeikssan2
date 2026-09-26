import fs from 'node:fs';
import path from 'node:path';

// Interface for Firebase Config
export interface FirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

let cachedConfig: FirebaseConfig | null = null;

export function getFirebaseConfig(): FirebaseConfig {
  if (cachedConfig) return cachedConfig;
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      cachedConfig = JSON.parse(raw);
      return cachedConfig!;
    } catch (e) {
      console.error('Failed to read firebase-applet-config.json:', e);
    }
  }

  // Fallback defaults if file temporarily missing
  cachedConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'teak-helix-753bd',
    appId: process.env.FIREBASE_APP_ID || '',
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBY3O8tDRSzF_Z_ZX1P_bR6PbvWENAYZCo',
    authDomain: 'teak-helix-753bd.firebaseapp.com',
    firestoreDatabaseId: 'ai-studio-152aaa98-85f4-47cd-a9c7-c5d362d5959a'
  };
  return cachedConfig;
}

export const PERMANENT_FIRESTORE_DB_ID = 'ai-studio-152aaa98-85f4-47cd-a9c7-c5d362d5959a';

export function getFirestoreBaseUrl(): string {
  const config = getFirebaseConfig();
  const dbId = config.firestoreDatabaseId || PERMANENT_FIRESTORE_DB_ID;
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents`;
}

// Convert JavaScript values to Firestore REST value format
export function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Convert Firestore REST value format back to standard JavaScript objects
export function fromFirestoreValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

export function decodeFirestoreDocument(doc: any): Record<string, any> | null {
  if (!doc || !doc.fields) return null;
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    result[k] = fromFirestoreValue(v);
  }
  // Extract id from doc.name if not present
  if (doc.name && !result.id) {
    const parts = doc.name.split('/');
    result.id = parts[parts.length - 1];
  }
  return result;
}

// REST CRUD functions for Firestore
export async function getDoc(collection: string, docId: string): Promise<Record<string, any> | null> {
  const config = getFirebaseConfig();
  const url = `${getFirestoreBaseUrl()}/${collection}/${encodeURIComponent(docId)}?key=${config.apiKey}`;
  try {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      const err = await res.text();
      console.warn(`Firestore getDoc(${collection}/${docId}) returned ${res.status}:`, err);
      return null;
    }
    const data = await res.json();
    return decodeFirestoreDocument(data);
  } catch (err) {
    console.error(`Firestore getDoc(${collection}/${docId}) network error:`, err);
    return null;
  }
}

// Quota circuit breaker to avoid hammering Firestore when daily write limit is reached (429 RESOURCE_EXHAUSTED)
let quotaExhaustedUntil = 0;

export function isQuotaExhausted(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

export function markQuotaExhausted(cooldownMs = 60_000): void {
  quotaExhaustedUntil = Date.now() + cooldownMs;
  console.warn(`⚠️ [FirestoreService] Quota reached (429 RESOURCE_EXHAUSTED). Cloud writes paused for ${Math.round(cooldownMs / 1000)}s; local SQLite & Cloud Backup are handling persistence.`);
}

export async function setDoc(collection: string, docId: string, data: Record<string, any>): Promise<boolean> {
  if (isQuotaExhausted()) return false;

  const config = getFirebaseConfig();
  const url = `${getFirestoreBaseUrl()}/${collection}/${encodeURIComponent(docId)}?key=${config.apiKey}`;
  
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      if (res.ok) return true;
      if (res.status === 429) {
        markQuotaExhausted();
        return false;
      }
      const errText = await res.text();
      console.error(`Firestore setDoc(${collection}/${docId}) failed [${res.status}] attempt ${attempt}:`, errText);
    } catch (err) {
      console.error(`Firestore setDoc(${collection}/${docId}) network error attempt ${attempt}:`, err);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  return false;
}

export async function deleteDoc(collection: string, docId: string): Promise<boolean> {
  if (isQuotaExhausted()) return false;

  const config = getFirebaseConfig();
  const url = `${getFirestoreBaseUrl()}/${collection}/${encodeURIComponent(docId)}?key=${config.apiKey}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok || res.status === 404) return true;
      if (res.status === 429) {
        markQuotaExhausted();
        return false;
      }
      console.error(`Firestore deleteDoc(${collection}/${docId}) failed [${res.status}] attempt ${attempt}`);
    } catch (err) {
      console.error(`Firestore deleteDoc(${collection}/${docId}) network error attempt ${attempt}:`, err);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  return false;
}

export async function listDocs(collection: string): Promise<Record<string, any>[]> {
  const config = getFirebaseConfig();
  const dbId = config.firestoreDatabaseId || PERMANENT_FIRESTORE_DB_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents:runQuery?key=${config.apiKey}`;
  const results: Record<string, any>[] = [];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }]
        }
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Firestore runQuery(${collection}) error [${res.status}]:`, errText);
      return [];
    }
    const items = await res.json();
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.document) {
          const decoded = decodeFirestoreDocument(item.document);
          if (decoded) results.push(decoded);
        }
      }
    }
  } catch (err) {
    console.error(`Firestore listDocs(${collection}) network error:`, err);
  }

  return results;
}

// List documents from a direct subcollection path (e.g. 'sections/s1/teachers/t1/seats')
export async function listSubcollectionDocs(collectionPath: string): Promise<Record<string, any>[]> {
  const config = getFirebaseConfig();
  const url = `${getFirestoreBaseUrl()}/${collectionPath}?key=${config.apiKey}`;
  const results: Record<string, any>[] = [];

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        const decoded = decodeFirestoreDocument(doc);
        if (decoded) results.push(decoded);
      }
    }
  } catch (err) {
    console.warn(`Firestore listSubcollectionDocs(${collectionPath}) network warning:`, err);
  }

  return results;
}

// Native Firestore REST documents:commit Batch Operations (Atomic & Quota Efficient)
export async function commitBatchDocs(
  writes: Array<{ type: 'set' | 'delete'; collection: string; id: string; data?: Record<string, any> }>
): Promise<number> {
  if (writes.length === 0) return 0;
  if (isQuotaExhausted()) return 0;

  const config = getFirebaseConfig();
  const dbId = config.firestoreDatabaseId || PERMANENT_FIRESTORE_DB_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents:commit?key=${config.apiKey}`;

  let totalSucceeded = 0;
  // Firestore commit supports up to 500 writes in a single HTTP request!
  const CHUNK_SIZE = 100;

  for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
    if (isQuotaExhausted()) break;
    const chunk = writes.slice(i, i + CHUNK_SIZE);
    const writePayload = chunk.map((w) => {
      const docPath = `projects/${config.projectId}/databases/${dbId}/documents/${w.collection}/${encodeURIComponent(w.id)}`;
      if (w.type === 'delete') {
        return { delete: docPath };
      }
      const fields: Record<string, any> = {};
      for (const [k, v] of Object.entries(w.data || {})) {
        if (v !== undefined) {
          fields[k] = toFirestoreValue(v);
        }
      }
      return {
        update: {
          name: docPath,
          fields
        }
      };
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: writePayload })
      });

      if (res.ok) {
        totalSucceeded += chunk.length;
      } else {
        if (res.status === 429) {
          markQuotaExhausted();
          break;
        }
        const errText = await res.text();
        console.warn(`Firestore commitBatchDocs returned ${res.status}:`, errText);
      }
    } catch (err) {
      console.error('Firestore commitBatchDocs network error:', err);
    }
  }

  return totalSucceeded;
}

// Batch write / upsert helper using atomic commit
export async function batchDeleteDocs(collection: string, docIds: string[]): Promise<number> {
  return commitBatchDocs(docIds.map((id) => ({ type: 'delete', collection, id })));
}

export async function batchSetDocs(collection: string, docs: Array<{ id: string; data: Record<string, any> }>): Promise<number> {
  return commitBatchDocs(docs.map((d) => ({ type: 'set', collection, id: d.id, data: d.data })));
}

export async function deleteDocumentByPath(docPath: string): Promise<boolean> {
  const config = getFirebaseConfig();
  const cleanPath = docPath.replace(/^\/+/, '');
  const url = `${getFirestoreBaseUrl()}/${cleanPath}?key=${config.apiKey}`;
  try {
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok || res.status === 404;
  } catch (err) {
    console.error(`deleteDocumentByPath(${cleanPath}) error:`, err);
    return false;
  }
}

export async function queryAllDocPaths(collectionId: string): Promise<string[]> {
  const config = getFirebaseConfig();
  const dbId = config.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents:runQuery?key=${config.apiKey}`;
  const paths: string[] = [];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId, allDescendants: true }]
        }
      })
    });
    if (!res.ok) return [];
    const items = await res.json();
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.document?.name) {
          const prefix = `/documents/`;
          const idx = item.document.name.indexOf(prefix);
          if (idx !== -1) {
            paths.push(item.document.name.substring(idx + prefix.length));
          }
        }
      }
    }
  } catch (err) {
    console.error(`queryAllDocPaths(${collectionId}) error:`, err);
  }
  return paths;
}
