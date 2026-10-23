import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { SEED_GARDEN_DATABASE } from './src/data/seedGarden';
import type {
  GardenDatabase,
  Article,
  Moment,
  Album,
  TravelFootprint,
  CollectionItem,
  SiteProfile,
} from './src/types/garden';
import {
  createFullBackupZip,
  inspectBackupZip,
  restoreFromBackupZip,
  extractRelationshipsAndMedia,
} from './src/utils/backupEngine';
import {
  testFirestoreConnection,
  loadDatabaseFromCloud,
  syncDatabaseToCloud,
  syncMediaAssetToCloud,
  loadMediaAssetFromCloud,
  loadAllMediaAssetsFromCloud,
  getCloudPersistenceDiagnostics,
} from './src/utils/cloudPersistence';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SANDBOX_DIR = path.join(DATA_DIR, 'sandbox');
const DB_FILE = path.join(DATA_DIR, 'garden-db.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth-config.json');

interface AuthConfig {
  passwordHash: string;
  activeTokens: string[];
}

function hashPassword(pw: string): string {
  return crypto.createHash('sha256').update(`qichi_salt_${pw}`).digest('hex');
}

function ensureDirectories() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, SANDBOX_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function loadAuthConfig(): AuthConfig {
  ensureDirectories();
  if (!fs.existsSync(AUTH_FILE)) {
    const initial: AuthConfig = {
      passwordHash: hashPassword(process.env.GARDEN_ADMIN_PASSWORD || 'garden2026'),
      activeTokens: [],
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(raw) as AuthConfig;
  } catch {
    return {
      passwordHash: hashPassword('garden2026'),
      activeTokens: [],
    };
  }
}

function saveAuthConfig(config: AuthConfig) {
  ensureDirectories();
  const tmp = `${AUTH_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
  fs.renameSync(tmp, AUTH_FILE);
}

function loadLocalDatabase(): GardenDatabase {
  ensureDirectories();
  if (!fs.existsSync(DB_FILE)) {
    const initial = structuredClone(SEED_GARDEN_DATABASE);
    writeLocalDatabaseFile(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as GardenDatabase;
  } catch (err) {
    console.error('Failed to read local garden-db.json, restoring from seed:', err);
    const fallback = structuredClone(SEED_GARDEN_DATABASE);
    writeLocalDatabaseFile(fallback);
    return fallback;
  }
}

function writeLocalDatabaseFile(db: GardenDatabase) {
  ensureDirectories();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

async function saveDatabase(db: GardenDatabase): Promise<void> {
  db.lastUpdated = new Date().toISOString();
  writeLocalDatabaseFile(db);
  await syncDatabaseToCloud(db);
}

/**
 * Bootstraps and reconciles local disk storage with Cloud Firestore on startup.
 * Ensures zero data loss across Cloud Run instance restarts, redeployments, or autoscaling.
 */
async function initializeCloudAndLocalStorage(): Promise<void> {
  ensureDirectories();
  await testFirestoreConnection();

  const cloudDb = await loadDatabaseFromCloud();
  if (cloudDb && Array.isArray(cloudDb.articles)) {
    // Cloud Firestore has authoritative state -> hydrate local mirror
    writeLocalDatabaseFile(cloudDb);
    console.log('☁️ Hydrated garden database from Cloud Firestore');
  } else {
    // First boot after provisioning -> migrate existing local database to Cloud Firestore
    const localDb = loadLocalDatabase();
    await syncDatabaseToCloud(localDb);
    console.log('☁️ Migrated existing local garden database to Cloud Firestore');
  }

  // Reconcile uploaded media files between local /data/uploads/ and Cloud Firestore
  const cloudMedia = await loadAllMediaAssetsFromCloud();
  for (const [filename, buf] of cloudMedia.entries()) {
    const localPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(localPath)) {
      fs.writeFileSync(localPath, buf);
    }
  }

  // Also migrate any local files in /data/uploads/ that aren't in Cloud Firestore yet
  const localFiles = fs.readdirSync(UPLOADS_DIR);
  for (const filename of localFiles) {
    if (!cloudMedia.has(filename)) {
      const fullPath = path.join(UPLOADS_DIR, filename);
      if (fs.statSync(fullPath).isFile()) {
        const buf = fs.readFileSync(fullPath);
        await syncMediaAssetToCloud(filename, buf);
      }
    }
  }
}

async function collectAllUploadedMediaFiles(): Promise<Map<string, Buffer>> {
  ensureDirectories();
  const mediaMap = new Map<string, Buffer>();

  // 1. Read from local /data/uploads/
  const localFiles = fs.readdirSync(UPLOADS_DIR);
  for (const filename of localFiles) {
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (fs.statSync(fullPath).isFile()) {
      mediaMap.set(filename, fs.readFileSync(fullPath));
    }
  }

  // 2. Ensure any media stored in Cloud Firestore is also included
  const cloudMedia = await loadAllMediaAssetsFromCloud();
  for (const [filename, buf] of cloudMedia.entries()) {
    if (!mediaMap.has(filename)) {
      mediaMap.set(filename, buf);
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
    }
  }

  return mediaMap;
}

function isRequestAdmin(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return false;
  const authConfig = loadAuthConfig();
  return authConfig.activeTokens.includes(token);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isRequestAdmin(req)) {
    res.status(401).json({ error: '需要园主（管理员）权限方可操作' });
    return;
  }
  next();
}

function sanitizeDatabaseForVisitor(db: GardenDatabase): GardenDatabase {
  return {
    ...db,
    articles: db.articles.filter((a) => a.status === 'public'),
    moments: db.moments.filter((m) => m.status === 'public'),
    albums: db.albums.filter((al) => al.status === 'public'),
    travels: db.travels.filter((t) => t.status === 'public'),
    collections: db.collections.filter((c) => c.status === 'public'),
  };
}

async function startServer() {
  ensureDirectories();
  loadAuthConfig();
  await initializeCloudAndLocalStorage();

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Cloud-backed static media middleware: if a container restarted and local file is missing, hydrate from Cloud Firestore on the fly
  app.get('/uploads/:filename', async (req: Request, res: Response, next: NextFunction) => {
    const rawName = String(req.params.filename || '');
    const safeName = path.basename(rawName);
    const localPath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(localPath)) {
      next();
      return;
    }
    const cloudBuf = await loadMediaAssetFromCloud(safeName);
    if (cloudBuf) {
      fs.writeFileSync(localPath, cloudBuf);
      next();
      return;
    }
    res.status(404).send('Media file not found');
  });

  app.use('/uploads', express.static(UPLOADS_DIR));

  // --- AUTHENTICATION ROUTES ---
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: '请输入园主密钥' });
      return;
    }
    const authConfig = loadAuthConfig();
    if (hashPassword(password) !== authConfig.passwordHash) {
      res.status(401).json({ error: '园主密钥不正确，请重试' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    authConfig.activeTokens = [...authConfig.activeTokens.slice(-19), token];
    saveAuthConfig(authConfig);
    res.json({ token, isAdmin: true });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      const authConfig = loadAuthConfig();
      authConfig.activeTokens = authConfig.activeTokens.filter((t) => t !== token);
      saveAuthConfig(authConfig);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/verify', (req: Request, res: Response) => {
    res.json({ isAdmin: isRequestAdmin(req) });
  });

  app.post('/api/auth/password', requireAdmin, (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword || newPassword.length < 4) {
      res.status(400).json({ error: '新密钥长度至少为 4 位字符' });
      return;
    }
    const authConfig = loadAuthConfig();
    if (hashPassword(currentPassword) !== authConfig.passwordHash) {
      res.status(401).json({ error: '当前密钥验证失败' });
      return;
    }
    authConfig.passwordHash = hashPassword(newPassword);
    saveAuthConfig(authConfig);
    res.json({ ok: true, message: '园主密钥已更新' });
  });

  // --- MAIN GARDEN DATA FETCH ---
  app.get('/api/garden', (_req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const isAdmin = isRequestAdmin(_req);
    const payload = isAdmin ? db : sanitizeDatabaseForVisitor(db);
    res.json({
      isAdmin,
      garden: payload,
    });
  });

  // --- PROFILE & SITE CONFIG ---
  app.put('/api/profile', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const updatedProfile = req.body as Partial<SiteProfile>;
    db.profile = {
      ...db.profile,
      ...updatedProfile,
      homeModules: {
        ...db.profile.homeModules,
        ...(updatedProfile.homeModules || {}),
      },
    };
    await saveDatabase(db);
    res.json({ profile: db.profile });
  });

  // --- ARTICLES CRUD ---
  app.post('/api/articles', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as Partial<Article>;
    if (!body.title || !body.title.trim()) {
      res.status(400).json({ error: '文章标题不能为空' });
      return;
    }
    const now = new Date().toISOString();
    const newArticle: Article = {
      id: body.id || `art-${Date.now()}`,
      title: body.title.trim(),
      slug:
        body.slug ||
        body.title
          .trim()
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
          .replace(/^-+|-+$/g, '') ||
        `post-${Date.now()}`,
      excerpt: body.excerpt ?? '',
      coverImage: body.coverImage ?? '',
      content: body.content ?? '<p></p>',
      category: body.category || '生活杂记',
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: body.status || 'public',
      isPinned: Boolean(body.isPinned),
      isFeatured: Boolean(body.isFeatured),
      location: body.location || '',
      weather: body.weather || '',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    if (
      newArticle.category &&
      !db.customCategories.articleCategories.includes(newArticle.category)
    ) {
      db.customCategories.articleCategories.push(newArticle.category);
    }

    db.articles.unshift(newArticle);
    await saveDatabase(db);
    res.status(201).json({ article: newArticle });
  });

  app.put('/api/articles/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const { id } = req.params;
    const idx = db.articles.findIndex((a) => a.id === id);
    const body = req.body as Partial<Article>;

    if (idx === -1) {
      const now = new Date().toISOString();
      const created: Article = {
        id,
        title: (body.title || '未命名手记').trim(),
        slug: body.slug || `post-${Date.now()}`,
        excerpt: body.excerpt ?? '',
        coverImage: body.coverImage ?? '',
        content: body.content ?? '<p></p>',
        category: body.category || '生活杂记',
        tags: Array.isArray(body.tags) ? body.tags : [],
        status: body.status || 'draft',
        isPinned: Boolean(body.isPinned),
        isFeatured: Boolean(body.isFeatured),
        location: body.location || '',
        weather: body.weather || '',
        createdAt: body.createdAt || now,
        updatedAt: now,
      };
      db.articles.unshift(created);
      await saveDatabase(db);
      res.json({ article: created });
      return;
    }

    const existing = db.articles[idx];
    const updated: Article = {
      ...existing,
      ...body,
      id: existing.id,
      title: body.title !== undefined ? body.title.trim() || '未命名手记' : existing.title,
      tags: Array.isArray(body.tags) ? body.tags : existing.tags,
      updatedAt: new Date().toISOString(),
    };

    if (
      updated.category &&
      !db.customCategories.articleCategories.includes(updated.category)
    ) {
      db.customCategories.articleCategories.push(updated.category);
    }

    db.articles[idx] = updated;
    await saveDatabase(db);
    res.json({ article: updated });
  });

  app.delete('/api/articles/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const { id } = req.params;
    db.articles = db.articles.filter((a) => a.id !== id);
    await saveDatabase(db);
    res.json({ ok: true });
  });

  // --- MOMENTS CRUD ---
  app.post('/api/moments', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as Partial<Moment>;
    if (!body.content || !body.content.trim()) {
      res.status(400).json({ error: '瞬间内容不能为空' });
      return;
    }
    const newMoment: Moment = {
      id: `mom-${Date.now()}`,
      content: body.content.trim(),
      images: Array.isArray(body.images) ? body.images : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      mood: body.mood || '',
      weather: body.weather || '',
      location: body.location || '',
      status: body.status === 'private' ? 'private' : 'public',
      createdAt: body.createdAt || new Date().toISOString(),
    };
    db.moments.unshift(newMoment);
    await saveDatabase(db);
    res.status(201).json({ moment: newMoment });
  });

  app.put('/api/moments/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const { id } = req.params;
    const idx = db.moments.findIndex((m) => m.id === id);
    if (idx === -1) {
      res.status(404).json({ error: '未找到该瞬间记录' });
      return;
    }
    db.moments[idx] = {
      ...db.moments[idx],
      ...(req.body as Partial<Moment>),
      id,
    };
    await saveDatabase(db);
    res.json({ moment: db.moments[idx] });
  });

  app.delete('/api/moments/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    db.moments = db.moments.filter((m) => m.id !== req.params.id);
    await saveDatabase(db);
    res.json({ ok: true });
  });

  // --- ALBUMS CRUD ---
  app.post('/api/albums', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as Partial<Album>;
    if (!body.title || !body.title.trim()) {
      res.status(400).json({ error: '相册名称不能为空' });
      return;
    }
    const photos = Array.isArray(body.photos) ? body.photos : [];
    const newAlbum: Album = {
      id: `alb-${Date.now()}`,
      title: body.title.trim(),
      description: body.description || '',
      coverImage:
        body.coverImage ||
        photos[0]?.url ||
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=80',
      category: body.category || '生活摄影',
      location: body.location || '',
      date: body.date || new Date().toISOString().slice(0, 10),
      status: body.status === 'private' ? 'private' : 'public',
      photos,
      createdAt: new Date().toISOString(),
    };
    db.albums.unshift(newAlbum);
    await saveDatabase(db);
    res.status(201).json({ album: newAlbum });
  });

  app.put('/api/albums/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const { id } = req.params;
    const idx = db.albums.findIndex((al) => al.id === id);
    if (idx === -1) {
      res.status(404).json({ error: '未找到该相册' });
      return;
    }
    const updated = {
      ...db.albums[idx],
      ...(req.body as Partial<Album>),
      id,
    };
    if (!updated.coverImage && updated.photos.length > 0) {
      updated.coverImage = updated.photos[0].url;
    }
    db.albums[idx] = updated;
    await saveDatabase(db);
    res.json({ album: updated });
  });

  app.delete('/api/albums/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    db.albums = db.albums.filter((al) => al.id !== req.params.id);
    await saveDatabase(db);
    res.json({ ok: true });
  });

  // --- TRAVEL FOOTPRINTS CRUD ---
  app.post('/api/travel', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as Partial<TravelFootprint>;
    if (!body.destination || !body.destination.trim()) {
      res.status(400).json({ error: '旅行目的地不能为空' });
      return;
    }
    const newTravel: TravelFootprint = {
      id: `trv-${Date.now()}`,
      destination: body.destination.trim(),
      region: body.region || '山野远方',
      country: body.country || '中国',
      coordinates: body.coordinates || { x: 50, y: 50, lat: 30.27, lng: 120.15 },
      startDate: body.startDate || new Date().toISOString().slice(0, 10),
      endDate: body.endDate || new Date().toISOString().slice(0, 10),
      summary: body.summary || '',
      story: body.story || '',
      coverImage:
        body.coverImage ||
        body.photos?.[0] ||
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
      photos: Array.isArray(body.photos) ? body.photos : [],
      relatedArticleId: body.relatedArticleId || undefined,
      relatedAlbumId: body.relatedAlbumId || undefined,
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: body.status === 'private' ? 'private' : 'public',
      createdAt: new Date().toISOString(),
    };
    db.travels.unshift(newTravel);
    await saveDatabase(db);
    res.status(201).json({ travel: newTravel });
  });

  app.put('/api/travel/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const { id } = req.params;
    const idx = db.travels.findIndex((t) => t.id === id);
    if (idx === -1) {
      res.status(404).json({ error: '未找到该足迹记录' });
      return;
    }
    db.travels[idx] = {
      ...db.travels[idx],
      ...(req.body as Partial<TravelFootprint>),
      id,
    };
    await saveDatabase(db);
    res.json({ travel: db.travels[idx] });
  });

  app.delete('/api/travel/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    db.travels = db.travels.filter((t) => t.id !== req.params.id);
    await saveDatabase(db);
    res.json({ ok: true });
  });

  // --- COLLECTIONS CRUD ---
  app.post('/api/collections', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as Partial<CollectionItem>;
    if (!body.title || !body.title.trim()) {
      res.status(400).json({ error: '收藏条目名称不能为空' });
      return;
    }
    const category = body.category || 'gear';
    const categoryLabel = body.categoryLabel || '器物与好物';
    if (!db.customCategories.collectionCategories.some((c) => c.id === category)) {
      db.customCategories.collectionCategories.push({ id: category, label: categoryLabel });
    }
    const newItem: CollectionItem = {
      id: `col-${Date.now()}`,
      title: body.title.trim(),
      creator: body.creator || '',
      category,
      categoryLabel,
      coverImage:
        body.coverImage ||
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
      rating: Math.min(5, Math.max(1, Number(body.rating) || 5)),
      review: body.review || '',
      experienceNote: body.experienceNote || '',
      specsOrMeta: body.specsOrMeta || '',
      externalLink: body.externalLink || '',
      tags: Array.isArray(body.tags) ? body.tags : [],
      recordedDate: body.recordedDate || new Date().toISOString().slice(0, 10),
      status: body.status === 'private' ? 'private' : 'public',
      favorite: Boolean(body.favorite),
      createdAt: new Date().toISOString(),
    };
    db.collections.unshift(newItem);
    await saveDatabase(db);
    res.status(201).json({ collection: newItem });
  });

  app.put('/api/collections/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const { id } = req.params;
    const idx = db.collections.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: '未找到该收藏条目' });
      return;
    }
    db.collections[idx] = {
      ...db.collections[idx],
      ...(req.body as Partial<CollectionItem>),
      id,
    };
    await saveDatabase(db);
    res.json({ collection: db.collections[idx] });
  });

  app.delete('/api/collections/:id', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    db.collections = db.collections.filter((c) => c.id !== req.params.id);
    await saveDatabase(db);
    res.json({ ok: true });
  });

  // --- CLOUD-PERSISTENT IMAGE UPLOAD ---
  app.post('/api/upload', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { dataUrl, filename } = req.body as { dataUrl?: string; filename?: string };
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: '请提供有效的图片数据' });
        return;
      }
      const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!matches) {
        res.status(400).json({ error: '图片编码格式无效' });
        return;
      }
      const extRaw = matches[1].toLowerCase();
      const ext = extRaw === 'jpeg' ? 'jpg' : extRaw === 'svg+xml' ? 'svg' : extRaw;
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const safeBase = (filename || 'image')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 24);
      const finalName = `${Date.now()}-${safeBase || 'photo'}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, finalName);

      // Write to local static cache AND persist to Cloud Firestore
      fs.writeFileSync(filePath, buffer);
      const syncedToCloud = await syncMediaAssetToCloud(finalName, buffer);

      res.status(201).json({
        url: `/uploads/${finalName}`,
        filename: finalName,
        size: buffer.length,
        cloudPersisted: syncedToCloud,
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: '图片保存失败' });
    }
  });

  // --- STORAGE ARCHITECTURE DIAGNOSTICS ---
  app.get('/api/storage/diagnostics', requireAdmin, async (_req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const cloudDiag = await getCloudPersistenceDiagnostics();
    const relations = extractRelationshipsAndMedia(db);
    const localMediaFiles = fs.existsSync(UPLOADS_DIR)
      ? fs.readdirSync(UPLOADS_DIR).filter((f) => fs.statSync(path.join(UPLOADS_DIR, f)).isFile())
      : [];

    res.json({
      cloud: cloudDiag,
      localMirror: {
        dbFileExists: fs.existsSync(DB_FILE),
        localMediaCount: localMediaFiles.length,
        localMediaFiles,
      },
      counts: {
        articles: db.articles.length,
        publicArticles: db.articles.filter((a) => a.status === 'public').length,
        privateArticles: db.articles.filter((a) => a.status === 'private').length,
        draftArticles: db.articles.filter((a) => a.status === 'draft').length,
        moments: db.moments.length,
        albums: db.albums.length,
        travels: db.travels.length,
        collections: db.collections.length,
        timelineEvents: relations.timeline.length,
        referencedLocalMedia: relations.mediaReferences.filter((m) => m.isLocalUpload).length,
      },
      relationsSummary: {
        totalTags: Object.keys(relations.tagIndex).length,
        travelLinks: relations.travelRelations.length,
        mediaReferenceCount: relations.mediaReferences.length,
      },
    });
  });

  // --- FULL ZIP BACKUP EXPORT (Admin Only) ---
  app.get('/api/backup/export', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const db = loadLocalDatabase();
      const uploadedFilesMap = await collectAllUploadedMediaFiles();
      const { zipBuffer } = await createFullBackupZip(db, uploadedFilesMap);
      const dateStamp = new Date().toISOString().slice(0, 10);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="qichi-garden-full-backup-${dateStamp}.zip"`
      );
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err) {
      console.error('ZIP backup export error:', err);
      res.status(500).json({ error: '生成完整 ZIP 备份包失败' });
    }
  });

  // --- PRE-RESTORE BACKUP INSPECTION (Admin Only) ---
  app.post('/api/backup/inspect', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { zipBase64 } = req.body as { zipBase64?: string };
      if (!zipBase64) {
        res.status(400).json({ error: '请提供待校验的 ZIP 备份文件数据' });
        return;
      }
      const cleanBase64 = zipBase64.replace(/^data:.*?;base64,/, '');
      const zipBuffer = Buffer.from(cleanBase64, 'base64');
      const currentDb = loadLocalDatabase();
      const inspection = await inspectBackupZip(zipBuffer, currentDb);
      res.json({ inspection });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : '备份包预检失败',
      });
    }
  });

  // --- FULL BACKUP RESTORE (Production or Isolated Sandbox Verification) ---
  app.post('/api/backup/restore', requireAdmin, async (req: Request, res: Response) => {
    try {
      const {
        zipBase64,
        mode = 'replace',
        targetEnv = 'production',
      } = req.body as {
        zipBase64?: string;
        mode?: 'replace' | 'merge';
        targetEnv?: 'production' | 'isolated_sandbox';
      };

      if (!zipBase64) {
        res.status(400).json({ error: '请上传有效的 ZIP 备份文件' });
        return;
      }

      const cleanBase64 = zipBase64.replace(/^data:.*?;base64,/, '');
      const zipBuffer = Buffer.from(cleanBase64, 'base64');

      if (targetEnv === 'isolated_sandbox') {
        // Safe isolated test environment verification: start from empty sandbox DB and isolated directory
        const emptySandboxDb: GardenDatabase = {
          ...structuredClone(SEED_GARDEN_DATABASE),
          articles: [],
          moments: [],
          albums: [],
          travels: [],
          collections: [],
        };
        const { restoredDb, restoredMediaFiles, inspection } = await restoreFromBackupZip(
          zipBuffer,
          emptySandboxDb,
          'replace'
        );

        // Write restored files to isolated /data/sandbox/ to verify disk extraction
        const sandboxUploadsDir = path.join(SANDBOX_DIR, 'uploads');
        if (!fs.existsSync(sandboxUploadsDir)) {
          fs.mkdirSync(sandboxUploadsDir, { recursive: true });
        }
        const extractedFiles: string[] = [];
        for (const [filename, buf] of restoredMediaFiles.entries()) {
          const sandboxFilePath = path.join(sandboxUploadsDir, filename);
          fs.writeFileSync(sandboxFilePath, buf);
          extractedFiles.push(filename);
        }

        const sandboxDbPath = path.join(SANDBOX_DIR, 'sandbox-garden-db.json');
        fs.writeFileSync(sandboxDbPath, JSON.stringify(restoredDb, null, 2), 'utf-8');
        const relations = extractRelationshipsAndMedia(restoredDb);

        res.json({
          ok: true,
          targetEnv: 'isolated_sandbox',
          inspection,
          sandboxVerification: {
            restoredArticlesCount: restoredDb.articles.length,
            restoredMomentsCount: restoredDb.moments.length,
            restoredAlbumsCount: restoredDb.albums.length,
            restoredTravelsCount: restoredDb.travels.length,
            restoredCollectionsCount: restoredDb.collections.length,
            extractedMediaFiles: extractedFiles,
            totalTagsRestored: Object.keys(relations.tagIndex).length,
            travelLinksVerified: relations.travelRelations.every(
              (r) => r.articleExists && r.albumExists
            ),
            timelineEventsCount: relations.timeline.length,
          },
        });
        return;
      }

      // Production restore: update live database, write all media files to /data/uploads/, and sync to Cloud Firestore
      const currentDb = loadLocalDatabase();
      const { restoredDb, restoredMediaFiles, inspection } = await restoreFromBackupZip(
        zipBuffer,
        currentDb,
        mode
      );

      for (const [filename, buf] of restoredMediaFiles.entries()) {
        const destPath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(destPath, buf);
        await syncMediaAssetToCloud(filename, buf);
      }

      await saveDatabase(restoredDb);

      res.json({
        ok: true,
        targetEnv: 'production',
        garden: restoredDb,
        restoredMediaCount: restoredMediaFiles.size,
        inspection,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : '从 ZIP 备份恢复失败',
      });
    }
  });

  // Legacy JSON export/import compatibility
  app.get('/api/export', requireAdmin, (_req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qichi-garden-backup-${dateStamp}.json"`
    );
    res.send(JSON.stringify(db, null, 2));
  });

  // --- SEO SITEMAP.XML ---
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const publicArticles = db.articles.filter((a) => a.status === 'public');
    const urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      ...publicArticles.map(
        (a) =>
          `<url><loc>${baseUrl}/?article=${encodeURIComponent(
            a.id
          )}</loc><lastmod>${new Date(a.updatedAt).toISOString()}</lastmod><priority>0.8</priority></url>`
      ),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join('\n  ')}
</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  });

  // --- VITE DEV MIDDLEWARE OR PRODUCTION STATIC ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌱 栖迟园 Personal Digital Garden server running on http://localhost:${PORT}`);
  });
}

startServer();
