import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { GardenDatabase } from '../types/garden';
import { sha256Buffer, sanitizeDatabaseForExport } from './backupEngine';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: false,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const PRIMARY_STATE_KEY = 'qichi_primary_state_v1';
const MEDIA_INDEX_KEY = 'qichi_media_index_v1';

function toMediaDocKey(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 90);
  return `qichi_media_asset_${safe}`;
}

export interface CloudPersistenceStatus {
  connected: boolean;
  projectId: string;
  databaseId: string;
  lastSyncedAt: string | null;
  cloudMediaCount: number;
  error?: string;
}

let lastCloudSyncTime: string | null = null;
let isCloudConnected = false;

/**
 * Validates connection to Cloud Firestore on boot as required by firebase-integration-rpc.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
    isCloudConnected = true;
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
      isCloudConnected = false;
      return false;
    }
    // Even if 'test/connection' doc does not exist, reaching server without offline error means connected
    isCloudConnected = true;
    return true;
  }
}

/**
 * Loads the primary GardenDatabase state from Cloud Firestore.
 */
export async function loadDatabaseFromCloud(): Promise<GardenDatabase | null> {
  const path = `garden_cloud_store/${PRIMARY_STATE_KEY}`;
  try {
    const snap = await getDoc(doc(firestoreDb, 'garden_cloud_store', PRIMARY_STATE_KEY));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as {
      storeType: string;
      payloadJson: string;
      sha256: string;
      updatedAt: string;
    };
    if (!data?.payloadJson) return null;
    lastCloudSyncTime = data.updatedAt || new Date().toISOString();
    isCloudConnected = true;
    return JSON.parse(data.payloadJson) as GardenDatabase;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    console.warn('Cloud Firestore load warning:', error);
    return null;
  }
}

/**
 * Persists the full GardenDatabase state to Cloud Firestore.
 */
export async function syncDatabaseToCloud(dbState: GardenDatabase): Promise<boolean> {
  const path = `garden_cloud_store/${PRIMARY_STATE_KEY}`;
  try {
    const clean = sanitizeDatabaseForExport(dbState);
    const payloadJson = JSON.stringify(clean);
    if (payloadJson.length > 940000) {
      console.warn('Database state approaching Firestore 1MB doc limit');
    }
    const now = new Date().toISOString();
    await setDoc(doc(firestoreDb, 'garden_cloud_store', PRIMARY_STATE_KEY), {
      storeType: 'state',
      payloadJson,
      sha256: sha256Buffer(payloadJson),
      updatedAt: now,
    });
    lastCloudSyncTime = now;
    isCloudConnected = true;
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.warn('Cloud Firestore sync warning:', error);
    return false;
  }
}

/**
 * Loads the list of uploaded media filenames stored in Cloud Firestore.
 */
export async function loadMediaIndexFromCloud(): Promise<string[]> {
  const path = `garden_cloud_store/${MEDIA_INDEX_KEY}`;
  try {
    const snap = await getDoc(doc(firestoreDb, 'garden_cloud_store', MEDIA_INDEX_KEY));
    if (!snap.exists()) return [];
    const data = snap.data() as { payloadJson?: string };
    if (!data?.payloadJson) return [];
    const parsed = JSON.parse(data.payloadJson);
    return Array.isArray(parsed.filenames) ? parsed.filenames : [];
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return [];
  }
}

async function saveMediaIndexToCloud(filenames: string[]): Promise<void> {
  const path = `garden_cloud_store/${MEDIA_INDEX_KEY}`;
  const unique = Array.from(new Set(filenames));
  const payloadJson = JSON.stringify({ filenames: unique });
  const now = new Date().toISOString();
  try {
    await setDoc(doc(firestoreDb, 'garden_cloud_store', MEDIA_INDEX_KEY), {
      storeType: 'media_index',
      payloadJson,
      sha256: sha256Buffer(payloadJson),
      updatedAt: now,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * Persists an uploaded image binary buffer to Cloud Firestore so it survives Cloud Run restarts.
 */
export async function syncMediaAssetToCloud(
  filename: string,
  buffer: Buffer
): Promise<boolean> {
  const docKey = toMediaDocKey(filename);
  const path = `garden_cloud_store/${docKey}`;
  try {
    const base64Content = buffer.toString('base64');
    const payloadJson = JSON.stringify({
      filename,
      sizeBytes: buffer.length,
      base64: base64Content,
    });
    // Ensure payload fits within Firestore 950KB rule constraint
    if (payloadJson.length > 945000) {
      console.warn(`Media asset ${filename} exceeds single Firestore doc budget (${payloadJson.length} chars)`);
      return false;
    }
    const now = new Date().toISOString();
    await setDoc(doc(firestoreDb, 'garden_cloud_store', docKey), {
      storeType: 'media_asset',
      payloadJson,
      sha256: sha256Buffer(buffer),
      updatedAt: now,
    });

    const currentIndex = await loadMediaIndexFromCloud();
    if (!currentIndex.includes(filename)) {
      await saveMediaIndexToCloud([...currentIndex, filename]);
    }
    lastCloudSyncTime = now;
    isCloudConnected = true;
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.warn(`Failed to sync media asset ${filename} to Cloud Firestore:`, error);
    return false;
  }
}

/**
 * Loads a single media asset binary Buffer from Cloud Firestore.
 */
export async function loadMediaAssetFromCloud(
  filename: string
): Promise<Buffer | null> {
  const docKey = toMediaDocKey(filename);
  const path = `garden_cloud_store/${docKey}`;
  try {
    const snap = await getDoc(doc(firestoreDb, 'garden_cloud_store', docKey));
    if (!snap.exists()) return null;
    const data = snap.data() as { payloadJson?: string };
    if (!data?.payloadJson) return null;
    const parsed = JSON.parse(data.payloadJson) as { base64?: string };
    if (!parsed.base64) return null;
    return Buffer.from(parsed.base64, 'base64');
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return null;
  }
}

/**
 * Loads all persisted media assets from Cloud Firestore.
 */
export async function loadAllMediaAssetsFromCloud(): Promise<Map<string, Buffer>> {
  const map = new Map<string, Buffer>();
  const index = await loadMediaIndexFromCloud();
  for (const filename of index) {
    const buf = await loadMediaAssetFromCloud(filename);
    if (buf) {
      map.set(filename, buf);
    }
  }
  return map;
}

export async function getCloudPersistenceDiagnostics(): Promise<CloudPersistenceStatus> {
  const index = await loadMediaIndexFromCloud();
  return {
    connected: isCloudConnected,
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    lastSyncedAt: lastCloudSyncTime,
    cloudMediaCount: index.length,
  };
}
