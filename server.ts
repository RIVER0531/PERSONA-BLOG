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

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
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
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function loadAuthConfig(): AuthConfig {
  ensureDirectories();
  if (!fs.existsSync(AUTH_FILE)) {
    const initial: AuthConfig = {
      // Default admin password: "garden2026"
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

function loadDatabase(): GardenDatabase {
  ensureDirectories();
  if (!fs.existsSync(DB_FILE)) {
    const initial = structuredClone(SEED_GARDEN_DATABASE);
    saveDatabase(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as GardenDatabase;
    return parsed;
  } catch (err) {
    console.error('Failed to read garden-db.json, restoring from seed:', err);
    const fallback = structuredClone(SEED_GARDEN_DATABASE);
    saveDatabase(fallback);
    return fallback;
  }
}

function saveDatabase(db: GardenDatabase) {
  ensureDirectories();
  db.lastUpdated = new Date().toISOString();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
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
  // Initialize DB & Auth files on boot
  loadDatabase();
  loadAuthConfig();

  const app = express();
  app.use(express.json({ limit: '30mb' }));
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

  // --- MAIN GARDEN DATA FETCH (Server-Side Filtered for Visitors) ---
  app.get('/api/garden', (req: Request, res: Response) => {
    const db = loadDatabase();
    const isAdmin = isRequestAdmin(req);
    const payload = isAdmin ? db : sanitizeDatabaseForVisitor(db);
    res.json({
      isAdmin,
      garden: payload,
    });
  });

  // --- PROFILE & SITE CONFIG ---
  app.put('/api/profile', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
    const updatedProfile = req.body as Partial<SiteProfile>;
    db.profile = {
      ...db.profile,
      ...updatedProfile,
      homeModules: {
        ...db.profile.homeModules,
        ...(updatedProfile.homeModules || {}),
      },
    };
    saveDatabase(db);
    res.json({ profile: db.profile });
  });

  // --- ARTICLES CRUD ---
  app.post('/api/articles', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.status(201).json({ article: newArticle });
  });

  app.put('/api/articles/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
    const { id } = req.params;
    const idx = db.articles.findIndex((a) => a.id === id);
    const body = req.body as Partial<Article>;

    if (idx === -1) {
      // Upsert support for draft auto-save
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
      saveDatabase(db);
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
    saveDatabase(db);
    res.json({ article: updated });
  });

  app.delete('/api/articles/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
    const { id } = req.params;
    db.articles = db.articles.filter((a) => a.id !== id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- MOMENTS CRUD ---
  app.post('/api/moments', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.status(201).json({ moment: newMoment });
  });

  app.put('/api/moments/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.json({ moment: db.moments[idx] });
  });

  app.delete('/api/moments/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
    db.moments = db.moments.filter((m) => m.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- ALBUMS & GALLERY CRUD ---
  app.post('/api/albums', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.status(201).json({ album: newAlbum });
  });

  app.put('/api/albums/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.json({ album: updated });
  });

  app.delete('/api/albums/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
    db.albums = db.albums.filter((al) => al.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- TRAVEL FOOTPRINTS CRUD ---
  app.post('/api/travel', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.status(201).json({ travel: newTravel });
  });

  app.put('/api/travel/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.json({ travel: db.travels[idx] });
  });

  app.delete('/api/travel/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
    db.travels = db.travels.filter((t) => t.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- COLLECTIONS CRUD ---
  app.post('/api/collections', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.status(201).json({ collection: newItem });
  });

  app.put('/api/collections/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
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
    saveDatabase(db);
    res.json({ collection: db.collections[idx] });
  });

  app.delete('/api/collections/:id', requireAdmin, (req: Request, res: Response) => {
    const db = loadDatabase();
    db.collections = db.collections.filter((c) => c.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  // --- REAL PERSISTENT IMAGE UPLOAD ---
  app.post('/api/upload', requireAdmin, (req: Request, res: Response) => {
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
      fs.writeFileSync(filePath, buffer);
      res.status(201).json({
        url: `/uploads/${finalName}`,
        filename: finalName,
        size: buffer.length,
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: '图片保存失败' });
    }
  });

  // --- DATA EXPORT & IMPORT / RESTORE ---
  app.get('/api/export', requireAdmin, (_req: Request, res: Response) => {
    const db = loadDatabase();
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qichi-garden-backup-${dateStamp}.json"`
    );
    res.send(JSON.stringify(db, null, 2));
  });

  app.post('/api/import', requireAdmin, (req: Request, res: Response) => {
    const incoming = req.body as Partial<GardenDatabase>;
    if (
      !incoming ||
      !Array.isArray(incoming.articles) ||
      !Array.isArray(incoming.moments) ||
      !incoming.profile
    ) {
      res.status(400).json({ error: '导入的备份文件结构不完整，请检查是否为有效的栖迟园备份 JSON' });
      return;
    }
    const current = loadDatabase();
    const merged: GardenDatabase = {
      version: incoming.version || 1,
      lastUpdated: new Date().toISOString(),
      profile: incoming.profile || current.profile,
      articles: incoming.articles,
      moments: incoming.moments,
      albums: Array.isArray(incoming.albums) ? incoming.albums : current.albums,
      travels: Array.isArray(incoming.travels) ? incoming.travels : current.travels,
      collections: Array.isArray(incoming.collections) ? incoming.collections : current.collections,
      customCategories: incoming.customCategories || current.customCategories,
    };
    saveDatabase(merged);
    res.json({ ok: true, garden: merged });
  });

  // --- SEO SITEMAP.XML ---
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const db = loadDatabase();
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
