import type {
  GardenDatabase,
  Article,
  Moment,
  Album,
  TravelFootprint,
  CollectionItem,
  SiteProfile,
} from '../types/garden';

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
 * Compresses an image File in browser before uploading to `/api/upload` for fast loading and reliable storage.
 */
export async function compressAndUploadImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
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
        resolve(canvas.toDataURL('image/jpeg', 0.86));
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

export async function exportGardenBackup(): Promise<void> {
  const res = await fetch('/api/export', {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('导出备份失败');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `qichi-garden-backup-${dateStamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importGardenBackup(
  backupJson: GardenDatabase
): Promise<GardenDatabase> {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(backupJson),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '恢复数据失败');
  return data.garden;
}
