import type {
  GardenDatabase,
  Article,
  Moment,
  Album,
  TravelFootprint,
  CollectionItem,
  SiteProfile,
} from '../types/garden';
import type { BackupInspectionResult } from './backupEngine';

const TOKEN_STORAGE_KEY = 'qichi_garden_admin_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchGardenData(): Promise<{
  isAdmin: boolean;
  garden: GardenDatabase;
}> {
  const res = await fetch('/api/garden', {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error('无法加载花园数据');
  }
  return res.json();
}

export async function loginAdmin(password: string): Promise<{ token: string; isAdmin: boolean }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '登录失败');
  }
  setStoredToken(data.token);
  return data;
}

export async function logoutAdmin(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: authHeaders(),
  }).catch(() => {});
  setStoredToken(null);
}

export async function updateAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  const res = await fetch('/api/auth/password', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '更新密钥失败');
  }
  return data;
}

export async function updateSiteProfile(
  profile: Partial<SiteProfile>
): Promise<SiteProfile> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(profile),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '保存个人资料失败');
  return data.profile;
}

export async function createArticleApi(article: Partial<Article>): Promise<Article> {
  const res = await fetch('/api/articles', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(article),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '创建文章失败');
  return data.article;
}

export async function updateArticleApi(
  id: string,
  article: Partial<Article>
): Promise<Article> {
  const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(article),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '更新文章失败');
  return data.article;
}

export async function deleteArticleApi(id: string): Promise<void> {
  const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '删除文章失败');
  }
}

export async function createMomentApi(moment: Partial<Moment>): Promise<Moment> {
  const res = await fetch('/api/moments', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(moment),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '发布瞬间失败');
  return data.moment;
}

export async function updateMomentApi(
  id: string,
  moment: Partial<Moment>
): Promise<Moment> {
  const res = await fetch(`/api/moments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(moment),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '更新瞬间失败');
  return data.moment;
}

export async function deleteMomentApi(id: string): Promise<void> {
  const res = await fetch(`/api/moments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('删除瞬间失败');
}

export async function createAlbumApi(album: Partial<Album>): Promise<Album> {
  const res = await fetch('/api/albums', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(album),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '创建相册失败');
  return data.album;
}

export async function updateAlbumApi(
  id: string,
  album: Partial<Album>
): Promise<Album> {
  const res = await fetch(`/api/albums/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(album),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '更新相册失败');
  return data.album;
}

export async function deleteAlbumApi(id: string): Promise<void> {
  const res = await fetch(`/api/albums/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('删除相册失败');
}

export async function createTravelApi(
  travel: Partial<TravelFootprint>
): Promise<TravelFootprint> {
  const res = await fetch('/api/travel', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(travel),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '保存足迹失败');
  return data.travel;
}

export async function updateTravelApi(
  id: string,
  travel: Partial<TravelFootprint>
): Promise<TravelFootprint> {
  const res = await fetch(`/api/travel/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(travel),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '更新足迹失败');
  return data.travel;
}

export async function deleteTravelApi(id: string): Promise<void> {
  const res = await fetch(`/api/travel/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('删除足迹失败');
}

export async function createCollectionApi(
  item: Partial<CollectionItem>
): Promise<CollectionItem> {
  const res = await fetch('/api/collections', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(item),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '添加收藏失败');
  return data.collection;
}

export async function updateCollectionApi(
  id: string,
  item: Partial<CollectionItem>
): Promise<CollectionItem> {
  const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(item),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '更新收藏失败');
  return data.collection;
}

export async function deleteCollectionApi(id: string): Promise<void> {
  const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('删除收藏失败');
}

/**
 * Compresses an image File in browser before uploading to `/api/upload`.
 */
export async function compressAndUploadImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dataUrl, filename: file.name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '上传图片失败');
  return data.url;
}

export interface StorageDiagnosticsResponse {
  cloud: {
    connected: boolean;
    projectId: string;
    databaseId: string;
    lastSyncedAt: string | null;
    cloudMediaCount: number;
  };
  localMirror: {
    dbFileExists: boolean;
    localMediaCount: number;
    localMediaFiles: string[];
  };
  counts: {
    articles: number;
    publicArticles: number;
    privateArticles: number;
    draftArticles: number;
    moments: number;
    albums: number;
    travels: number;
    collections: number;
    timelineEvents: number;
    referencedLocalMedia: number;
  };
  relationsSummary: {
    totalTags: number;
    travelLinks: number;
    mediaReferenceCount: number;
  };
}

export async function fetchStorageDiagnostics(): Promise<StorageDiagnosticsResponse> {
  const res = await fetch('/api/storage/diagnostics', {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('获取存储架构诊断失败');
  return res.json();
}

/**
 * Downloads the complete ZIP backup package containing structured JSON, relations, and raw binary images.
 */
export async function exportFullZipBackup(): Promise<{ filename: string; sizeBytes: number }> {
  const res = await fetch('/api/backup/export', {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '导出完整 ZIP 备份包失败');
  }
  const blob = await res.blob();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `qichi-garden-full-backup-${dateStamp}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { filename, sizeBytes: blob.size };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取备份文件失败'));
    reader.readAsDataURL(file);
  });
}

export async function inspectZipBackupFile(
  file: File
): Promise<BackupInspectionResult> {
  const zipBase64 = await fileToBase64(file);
  const res = await fetch('/api/backup/inspect', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ zipBase64 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '备份包校验失败');
  return data.inspection;
}

export interface RestoreZipResponse {
  ok: boolean;
  targetEnv: 'production' | 'isolated_sandbox';
  garden?: GardenDatabase;
  restoredMediaCount?: number;
  inspection: BackupInspectionResult;
  sandboxVerification?: {
    restoredArticlesCount: number;
    restoredMomentsCount: number;
    restoredAlbumsCount: number;
    restoredTravelsCount: number;
    restoredCollectionsCount: number;
    extractedMediaFiles: string[];
    totalTagsRestored: number;
    travelLinksVerified: boolean;
    timelineEventsCount: number;
  };
}

export async function restoreZipBackupFile(
  file: File,
  mode: 'replace' | 'merge',
  targetEnv: 'production' | 'isolated_sandbox'
): Promise<RestoreZipResponse> {
  const zipBase64 = await fileToBase64(file);
  const res = await fetch('/api/backup/restore', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ zipBase64, mode, targetEnv }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '恢复备份失败');
  return data;
}
