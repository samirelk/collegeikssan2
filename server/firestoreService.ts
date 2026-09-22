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

export function getFirestoreBaseUrl(): string {
  const config = getFirebaseConfig();
  const dbId = config.firestoreDatabaseId || '(default)';
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

export async function setDoc(collection: string, docId: string, data: Record<string, any>): Promise<boolean> {
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
  const config = getFirebaseConfig();
  const url = `${getFirestoreBaseUrl()}/${collection}/${encodeURIComponent(docId)}?key=${config.apiKey}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok || res.status === 404) return true;
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
  const dbId = config.firestoreDatabaseId || '(default)';
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

// Batch write / upsert helper
export async function batchSetDocs(collection: string, docs: Array<{ id: string; data: Record<string, any> }>): Promise<number> {
  let successCount = 0;
  // Process in small batches of 5 concurrent requests
  const CHUNK_SIZE = 5;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (item) => {
        const ok = await setDoc(collection, item.id, item.data);
        if (ok) successCount++;
      })
    );
  }
  return successCount;
}
