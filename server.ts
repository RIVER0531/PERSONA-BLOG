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
  subscribeToCloudDatabaseChanges,
  loadAuthVaultFromCloud,
  syncAuthVaultToCloud,
} from './src/utils/cloudPersistence';
import {
  convertMarkdownOrTextToHtml,
  buildAgentOverview,
  buildOpenApiSpec,
  buildChatGptSystemPrompt,
} from './src/utils/agentApi';
import { stripHtml } from './src/utils/gardenLogic';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SANDBOX_DIR = path.join(DATA_DIR, 'sandbox');
const DB_FILE = path.join(DATA_DIR, 'garden-db.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth-config.json');

interface AuthConfig {
  passwordHash: string;
  activeTokens: string[];
  agentApiKey?: string;
}

function hashPassword(pw: string): string {
  return crypto.createHash('sha256').update(`qichi_salt_${pw}`).digest('hex');
}

function deriveDefaultAgentApiKey(passwordHash: string): string {
  const digest = crypto
    .createHmac('sha256', 'qichi_agent_key_v1')
    .update(passwordHash)
    .digest('hex')
    .slice(0, 32);
  return `gdn_live_${digest}`;
}

function getEffectiveAgentApiKey(authConfig: AuthConfig): string {
  return authConfig.agentApiKey || deriveDefaultAgentApiKey(authConfig.passwordHash);
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
    const pwHash = hashPassword(process.env.GARDEN_ADMIN_PASSWORD || 'garden2026');
    const initial: AuthConfig = {
      passwordHash: pwHash,
      activeTokens: [],
      agentApiKey: deriveDefaultAgentApiKey(pwHash),
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AuthConfig;
    if (!parsed.agentApiKey) {
      parsed.agentApiKey = deriveDefaultAgentApiKey(parsed.passwordHash);
    }
    return parsed;
  } catch {
    const pwHash = hashPassword('garden2026');
    return {
      passwordHash: pwHash,
      activeTokens: [],
      agentApiKey: deriveDefaultAgentApiKey(pwHash),
    };
  }
}

function saveAuthConfig(config: AuthConfig) {
  ensureDirectories();
  if (!config.agentApiKey) {
    config.agentApiKey = deriveDefaultAgentApiKey(config.passwordHash);
  }
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
 * Ensures zero data loss across Cloud Run instance restarts, redeployments, or autoscaling,
 * and subscribes to real-time updates across instances.
 */
async function initializeCloudAndLocalStorage(): Promise<void> {
  ensureDirectories();
  await testFirestoreConnection();

  // Reconcile AuthVault (passwordHash + agentApiKey) with Cloud Firestore so API keys never break across Cloud Run instances
  const localAuth = loadAuthConfig();
  const cloudVault = await loadAuthVaultFromCloud();
  if (cloudVault && cloudVault.passwordHash && cloudVault.agentApiKey) {
    localAuth.passwordHash = cloudVault.passwordHash;
    localAuth.agentApiKey = cloudVault.agentApiKey;
    saveAuthConfig(localAuth);
  } else {
    await syncAuthVaultToCloud({
      passwordHash: localAuth.passwordHash,
      agentApiKey: getEffectiveAgentApiKey(localAuth),
      updatedAt: new Date().toISOString(),
    });
  }

  const cloudDb = await loadDatabaseFromCloud();
  if (cloudDb && Array.isArray(cloudDb.articles)) {
    writeLocalDatabaseFile(cloudDb);
    console.log('☁️ Hydrated garden database from Cloud Firestore');
  } else {
    const localDb = loadLocalDatabase();
    await syncDatabaseToCloud(localDb);
    console.log('☁️ Migrated existing local garden database to Cloud Firestore');
  }

  // Subscribe to real-time Firestore changes from other instances
  subscribeToCloudDatabaseChanges((remoteDb) => {
    if (remoteDb && Array.isArray(remoteDb.articles)) {
      writeLocalDatabaseFile(remoteDb);
      console.log('☁️ Synced real-time database update from Cloud Firestore');
    }
  });

  // Reconcile uploaded media files between local /data/uploads/ and Cloud Firestore
  const cloudMedia = await loadAllMediaAssetsFromCloud();
  for (const [filename, buf] of cloudMedia.entries()) {
    const localPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(localPath)) {
      fs.writeFileSync(localPath, buf);
    }
  }

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

  const localFiles = fs.readdirSync(UPLOADS_DIR);
  for (const filename of localFiles) {
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (fs.statSync(fullPath).isFile()) {
      mediaMap.set(filename, fs.readFileSync(fullPath));
    }
  }

  const cloudMedia = await loadAllMediaAssetsFromCloud();
  for (const [filename, buf] of cloudMedia.entries()) {
    if (!mediaMap.has(filename)) {
      mediaMap.set(filename, buf);
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
    }
  }

  return mediaMap;
}

function extractRequestToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.trim()) {
    return xApiKey.trim();
  }
  const xAdminToken = req.headers['x-admin-token'];
  if (typeof xAdminToken === 'string' && xAdminToken.trim()) {
    return xAdminToken.trim();
  }
  const paramKey = req.params?.apiKey;
  if (typeof paramKey === 'string' && paramKey.trim()) {
    return paramKey.trim();
  }
  const queryKey = req.query.apiKey || req.query.key || req.query.token;
  if (typeof queryKey === 'string' && queryKey.trim()) {
    return queryKey.trim();
  }
  return '';
}

function isRequestAdmin(req: Request): boolean {
  const token = extractRequestToken(req);
  if (!token) return false;
  const authConfig = loadAuthConfig();
  const effectiveApiKey = getEffectiveAgentApiKey(authConfig);
  if (token === effectiveApiKey) return true;
  if (authConfig.activeTokens.includes(token)) return true;
  if (hashPassword(token) === authConfig.passwordHash) return true;
  return false;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isRequestAdmin(req)) {
    res.status(401).json({
      error:
        '需要园主权限或有效的 AI API Key。请在请求头携带 Authorization: Bearer <API_KEY>、URL 路径携带 /mcp/<API_KEY> 或 ?apiKey=<API_KEY>',
    });
    return;
  }
  next();
}

function resolveRequestBaseUrl(req: Request): string {
  const customBase = req.query.baseUrl;
  if (typeof customBase === 'string' && customBase.startsWith('http')) {
    return customBase.replace(/\/+$/, '');
  }
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto =
    typeof protoHeader === 'string'
      ? protoHeader.split(',')[0].trim()
      : req.protocol || 'https';
  const host = req.get('host') || 'river05531.ai.studio';
  return `${proto}://${host}`;
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

  // Enable CORS for external AI Agents (ChatGPT Connectors / MCP, Custom GPT Actions, API clients)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/mcp') ||
      req.path.startsWith('/sse') ||
      req.path.startsWith('/messages') ||
      req.path === '/openapi.json'
    ) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, x-api-key, x-admin-token, mcp-session-id, Accept, Last-Event-ID'
      );
      res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  // Cloud-backed static media middleware
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

  // --- OPENAPI 3.1.0 SPECIFICATION FOR CHATGPT ACTIONS ---
  const handleOpenApi = (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const baseUrl = resolveRequestBaseUrl(req);
    const spec = buildOpenApiSpec(baseUrl, db.profile.gardenName);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(spec);
  };
  app.get('/openapi.json', handleOpenApi);
  app.get('/api/openapi.json', handleOpenApi);

  // --- AUTHENTICATION & AI API KEY ROUTES ---
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
    const token = extractRequestToken(req);
    if (token) {
      const authConfig = loadAuthConfig();
      authConfig.activeTokens = authConfig.activeTokens.filter((t) => t !== token);
      saveAuthConfig(authConfig);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/verify', (req: Request, res: Response) => {
    res.json({ isAdmin: isRequestAdmin(req) });
  });

  app.get('/api/auth/apikey', requireAdmin, (req: Request, res: Response) => {
    const authConfig = loadAuthConfig();
    const db = loadLocalDatabase();
    const apiKey = getEffectiveAgentApiKey(authConfig);
    const currentUrl = resolveRequestBaseUrl(req);
    const productionUrl = 'https://river05531.ai.studio';
    res.json({
      apiKey,
      productionUrl,
      currentUrl,
      openApiUrl: `${productionUrl}/openapi.json`,
      currentOpenApiUrl: `${currentUrl}/openapi.json`,
      mcpUrl: `${productionUrl}/mcp/${apiKey}`,
      sseUrl: `${productionUrl}/sse/${apiKey}`,
      systemPrompt: buildChatGptSystemPrompt(
        productionUrl,
        apiKey,
        db.profile.gardenName
      ),
    });
  });

  app.post('/api/auth/apikey/regenerate', requireAdmin, async (req: Request, res: Response) => {
    const authConfig = loadAuthConfig();
    const db = loadLocalDatabase();
    const newKey = `gdn_live_${crypto.randomBytes(16).toString('hex')}`;
    authConfig.agentApiKey = newKey;
    saveAuthConfig(authConfig);
    await syncAuthVaultToCloud({
      passwordHash: authConfig.passwordHash,
      agentApiKey: newKey,
      updatedAt: new Date().toISOString(),
    });
    const productionUrl = 'https://river05531.ai.studio';
    res.json({
      apiKey: newKey,
      mcpUrl: `${productionUrl}/mcp/${newKey}`,
      sseUrl: `${productionUrl}/sse/${newKey}`,
      message: '已生成新的专属 AI API Key 并同步至云端，旧 Key 已失效',
      systemPrompt: buildChatGptSystemPrompt(
        productionUrl,
        newKey,
        db.profile.gardenName
      ),
    });
  });

  app.post('/api/auth/password', requireAdmin, async (req: Request, res: Response) => {
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
    await syncAuthVaultToCloud({
      passwordHash: authConfig.passwordHash,
      agentApiKey: getEffectiveAgentApiKey(authConfig),
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true, message: '园主密钥已更新并同步至云端' });
  });

  // --- AI AGENT OVERVIEW & BATCH EXECUTION ROUTES ---
  app.get('/api/agent/overview', requireAdmin, (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const baseUrl = resolveRequestBaseUrl(req);
    res.json(buildAgentOverview(db, baseUrl));
  });

  app.post('/api/agent/execute', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as {
      updateProfile?: Partial<SiteProfile>;
      updateCategories?: Partial<GardenDatabase['customCategories']>;
      createArticle?: Partial<Article>;
      updateArticle?: Partial<Article> & { id: string };
      deleteArticleId?: string;
      createMoment?: Partial<Moment>;
      updateMoment?: Partial<Moment> & { id: string };
      deleteMomentId?: string;
      createAlbum?: Partial<Album>;
      createTravel?: Partial<TravelFootprint>;
      createCollection?: Partial<CollectionItem>;
    };

    const actionsCompleted: string[] = [];
    const results: Record<string, unknown> = {};

    if (body.updateProfile) {
      const up = body.updateProfile;
      if (up.aboutContent) {
        up.aboutContent = convertMarkdownOrTextToHtml(up.aboutContent);
      }
      db.profile = {
        ...db.profile,
        ...up,
        sectionTitles: {
          ...(db.profile.sectionTitles || {}),
          ...(up.sectionTitles || {}),
        },
        homeModules: {
          ...db.profile.homeModules,
          ...(up.homeModules || {}),
        },
      };
      actionsCompleted.push('updateProfile');
      results.profile = db.profile;
    }

    if (body.updateCategories) {
      if (Array.isArray(body.updateCategories.articleCategories)) {
        db.customCategories.articleCategories = body.updateCategories.articleCategories
          .map((c) => String(c).trim())
          .filter(Boolean);
      }
      if (Array.isArray(body.updateCategories.collectionCategories)) {
        db.customCategories.collectionCategories = body.updateCategories.collectionCategories
          .filter((c) => c && c.id && c.label)
          .map((c) => ({ id: String(c.id).trim(), label: String(c.label).trim() }));
      }
      actionsCompleted.push('updateCategories');
      results.customCategories = db.customCategories;
    }

    if (body.createArticle && body.createArticle.title) {
      const a = body.createArticle;
      const now = new Date().toISOString();
      const htmlContent = convertMarkdownOrTextToHtml(a.content || '');
      const autoExcerpt = a.excerpt?.trim() || stripHtml(htmlContent).slice(0, 110);
      const newArticle: Article = {
        id: a.id || `art-${Date.now()}`,
        title: a.title.trim(),
        slug:
          a.slug ||
          a.title
            .trim()
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
            .replace(/^-+|-+$/g, '') ||
          `post-${Date.now()}`,
        excerpt: autoExcerpt,
        coverImage: a.coverImage ?? '',
        content: htmlContent,
        category: a.category || '生活杂记',
        tags: Array.isArray(a.tags) ? a.tags : [],
        status: a.status || 'public',
        isPinned: Boolean(a.isPinned),
        isFeatured: Boolean(a.isFeatured),
        location: a.location || '',
        weather: a.weather || '',
        createdAt: a.createdAt || now,
        updatedAt: now,
      };
      if (
        newArticle.category &&
        !db.customCategories.articleCategories.includes(newArticle.category)
      ) {
        db.customCategories.articleCategories.push(newArticle.category);
      }
      db.articles.unshift(newArticle);
      actionsCompleted.push('createArticle');
      results.createdArticle = newArticle;
    }

    if (body.updateArticle && body.updateArticle.id) {
      const idx = db.articles.findIndex((item) => item.id === body.updateArticle!.id);
      if (idx !== -1) {
        const existing = db.articles[idx];
        const up = body.updateArticle;
        const nextContent =
          up.content !== undefined
            ? convertMarkdownOrTextToHtml(up.content)
            : existing.content;
        const updated: Article = {
          ...existing,
          ...up,
          id: existing.id,
          content: nextContent,
          excerpt:
            up.excerpt !== undefined
              ? up.excerpt
              : existing.excerpt || stripHtml(nextContent).slice(0, 110),
          updatedAt: new Date().toISOString(),
        };
        db.articles[idx] = updated;
        actionsCompleted.push('updateArticle');
        results.updatedArticle = updated;
      }
    }

    if (body.deleteArticleId) {
      db.articles = db.articles.filter((a) => a.id !== body.deleteArticleId);
      actionsCompleted.push('deleteArticle');
    }

    if (body.createMoment && body.createMoment.content) {
      const m = body.createMoment;
      const newMoment: Moment = {
        id: `mom-${Date.now()}`,
        content: m.content.trim(),
        images: Array.isArray(m.images) ? m.images : [],
        tags: Array.isArray(m.tags) ? m.tags : [],
        mood: m.mood || '',
        weather: m.weather || '',
        location: m.location || '',
        status: m.status === 'private' ? 'private' : 'public',
        createdAt: m.createdAt || new Date().toISOString(),
      };
      db.moments.unshift(newMoment);
      actionsCompleted.push('createMoment');
      results.createdMoment = newMoment;
    }

    if (body.updateMoment && body.updateMoment.id) {
      const idx = db.moments.findIndex((item) => item.id === body.updateMoment!.id);
      if (idx !== -1) {
        db.moments[idx] = {
          ...db.moments[idx],
          ...body.updateMoment,
          id: db.moments[idx].id,
        };
        actionsCompleted.push('updateMoment');
        results.updatedMoment = db.moments[idx];
      }
    }

    if (body.deleteMomentId) {
      db.moments = db.moments.filter((m) => m.id !== body.deleteMomentId);
      actionsCompleted.push('deleteMoment');
    }

    if (body.createAlbum && body.createAlbum.title) {
      const al = body.createAlbum;
      const photos = Array.isArray(al.photos) ? al.photos : [];
      const newAlbum: Album = {
        id: `alb-${Date.now()}`,
        title: al.title.trim(),
        description: al.description || '',
        coverImage:
          al.coverImage ||
          photos[0]?.url ||
          'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=80',
        category: al.category || '生活摄影',
        location: al.location || '',
        date: al.date || new Date().toISOString().slice(0, 10),
        status: al.status === 'private' ? 'private' : 'public',
        photos,
        createdAt: new Date().toISOString(),
      };
      db.albums.unshift(newAlbum);
      actionsCompleted.push('createAlbum');
      results.createdAlbum = newAlbum;
    }

    if (body.createTravel && body.createTravel.destination) {
      const tr = body.createTravel;
      const newTravel: TravelFootprint = {
        id: `trv-${Date.now()}`,
        destination: tr.destination.trim(),
        region: tr.region || '',
        country: tr.country || '中国',
        coordinates: tr.coordinates || { x: 52, y: 48, lat: 30.27, lng: 120.15 },
        startDate: tr.startDate || new Date().toISOString().slice(0, 10),
        endDate: tr.endDate || new Date().toISOString().slice(0, 10),
        summary: tr.summary || '',
        story: tr.story || '',
        coverImage:
          tr.coverImage ||
          tr.photos?.[0] ||
          'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
        photos: Array.isArray(tr.photos) ? tr.photos : [],
        relatedArticleId: tr.relatedArticleId || undefined,
        relatedAlbumId: tr.relatedAlbumId || undefined,
        tags: Array.isArray(tr.tags) ? tr.tags : [],
        status: tr.status === 'private' ? 'private' : 'public',
        createdAt: new Date().toISOString(),
      };
      db.travels.unshift(newTravel);
      actionsCompleted.push('createTravel');
      results.createdTravel = newTravel;
    }

    if (body.createCollection && body.createCollection.title) {
      const col = body.createCollection;
      const category = col.category || 'gear';
      const categoryLabel = col.categoryLabel || '器物与好物';
      if (!db.customCategories.collectionCategories.some((c) => c.id === category)) {
        db.customCategories.collectionCategories.push({
          id: category,
          label: categoryLabel,
        });
      }
      const newItem: CollectionItem = {
        id: `col-${Date.now()}`,
        title: col.title.trim(),
        creator: col.creator || '',
        category,
        categoryLabel,
        coverImage:
          col.coverImage ||
          'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        rating: Math.min(5, Math.max(1, Number(col.rating) || 5)),
        review: col.review || '',
        experienceNote: col.experienceNote || '',
        specsOrMeta: col.specsOrMeta || '',
        externalLink: col.externalLink || '',
        tags: Array.isArray(col.tags) ? col.tags : [],
        recordedDate: col.recordedDate || new Date().toISOString().slice(0, 10),
        status: col.status === 'private' ? 'private' : 'public',
        favorite: Boolean(col.favorite ?? (Number(col.rating) || 5) === 5),
        createdAt: new Date().toISOString(),
      };
      db.collections.unshift(newItem);
      actionsCompleted.push('createCollection');
      results.createdCollection = newItem;
    }

    await saveDatabase(db);
    res.json({
      ok: true,
      actionsCompleted,
      results,
      lastUpdated: db.lastUpdated,
    });
  });

  // --- QUICK GET ACTION ENDPOINT (FOR IN-CHAT WEB/LINK INVOCATION) ---
  const handleQuickAgentAction = async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const action = String(req.query.action || 'overview').trim();

    if (action === 'overview' || action === 'list') {
      res.json({
        ok: true,
        gardenName: db.profile.gardenName,
        profile: db.profile,
        articles: db.articles.map((a) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          excerpt: a.excerpt,
          status: a.status,
          createdAt: a.createdAt,
        })),
        moments: db.moments.slice(0, 15),
        travels: db.travels.slice(0, 15),
        collections: db.collections.slice(0, 15),
      });
      return;
    }

    if (action === 'publish_article' || action === 'create_article') {
      const title = String(req.query.title || '').trim();
      const content = String(req.query.content || '').trim();
      if (!title) {
        res.status(400).json({ error: '缺少 title 参数' });
        return;
      }
      const now = new Date().toISOString();
      const htmlContent = convertMarkdownOrTextToHtml(content || title);
      const category = String(req.query.category || '生活杂记').trim();
      const tags = req.query.tags
        ? String(req.query.tags)
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      const newArticle: Article = {
        id: `art-${Date.now()}`,
        title,
        slug: `post-${Date.now()}`,
        excerpt: String(req.query.excerpt || stripHtml(htmlContent).slice(0, 110)),
        coverImage: String(req.query.coverImage || ''),
        content: htmlContent,
        category,
        tags,
        status: req.query.status === 'private' || req.query.status === 'draft' ? (req.query.status as 'private' | 'draft') : 'public',
        isPinned: req.query.isPinned === 'true',
        isFeatured: req.query.isFeatured === 'true',
        location: String(req.query.location || ''),
        weather: String(req.query.weather || ''),
        createdAt: now,
        updatedAt: now,
      };
      if (category && !db.customCategories.articleCategories.includes(category)) {
        db.customCategories.articleCategories.push(category);
      }
      db.articles.unshift(newArticle);
      await saveDatabase(db);
      res.json({ ok: true, action: 'publish_article', article: newArticle });
      return;
    }

    if (action === 'post_moment' || action === 'create_moment') {
      const content = String(req.query.content || '').trim();
      if (!content) {
        res.status(400).json({ error: '缺少 content 参数' });
        return;
      }
      const newMoment: Moment = {
        id: `mom-${Date.now()}`,
        content,
        images: [],
        tags: req.query.tags
          ? String(req.query.tags)
              .split(/[,，]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        mood: String(req.query.mood || ''),
        weather: String(req.query.weather || ''),
        location: String(req.query.location || ''),
        status: req.query.status === 'private' ? 'private' : 'public',
        createdAt: new Date().toISOString(),
      };
      db.moments.unshift(newMoment);
      await saveDatabase(db);
      res.json({ ok: true, action: 'post_moment', moment: newMoment });
      return;
    }

    res.status(400).json({
      error: `未知 action: ${action}。支持 overview, publish_article, post_moment`,
    });
  };

  app.get('/api/agent/quick', requireAdmin, handleQuickAgentAction);
  app.get('/api/agent/quick/:apiKey', requireAdmin, handleQuickAgentAction);

  // --- REMOTE MCP SERVER (MODEL CONTEXT PROTOCOL FOR CHATGPT NORMAL CHAT CONNECTORS) ---
  const MCP_TOOLS = [
    {
      name: 'get_blog_overview',
      description:
        '读取个人博客（竹林）的全站概览，包括站点设置、已有文章列表（含ID和正文）、日常瞬间、旅行足迹和书影好物收藏。在修改文章或查看博客现状时调用。',
      annotations: {
        title: '读取博客全站内容与设置概览',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object',
        properties: {
          includeArticleContent: {
            type: 'boolean',
            description: '是否返回文章完整正文，默认为 true',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      name: 'publish_article',
      description:
        '在个人博客发布一篇新文章。支持直接传入 Markdown 或纯文本，系统会自动转换为精美排版并实时同步到线上云端。',
      annotations: {
        title: '发布新博客文章',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', description: '文章标题' },
          content: {
            type: 'string',
            description: '文章正文（支持 Markdown 标题/列表/引用/加粗 或 HTML）',
          },
          excerpt: { type: 'string', description: '文章摘要（可选，留空自动提取）' },
          category: {
            type: 'string',
            description: '文章分类，例如：生活杂记、技术手记、读书笔记、光影随笔',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '文章标签数组',
          },
          coverImage: {
            type: 'string',
            description: '封面图 URL（可选，不填则展示无图雅致排版）',
          },
          location: { type: 'string', description: '创作地点（可选）' },
          weather: { type: 'string', description: '创作时的天气（可选）' },
          status: {
            type: 'string',
            enum: ['public', 'draft', 'private'],
            description: '公开状态，默认 public（立即公开发布）',
          },
          isPinned: { type: 'boolean', description: '是否置顶文章，默认 false' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'update_article',
      description:
        '修改、润色或更新博客中已有的文章。请先通过 get_blog_overview 获取目标文章的 id。',
      annotations: {
        title: '修改已有博客文章',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: '要修改的文章 ID（如 art-...）' },
          title: { type: 'string', description: '新标题（可选）' },
          content: { type: 'string', description: '新正文内容，支持 Markdown 或 HTML（可选）' },
          excerpt: { type: 'string', description: '新摘要（可选）' },
          category: { type: 'string', description: '新分类（可选）' },
          tags: { type: 'array', items: { type: 'string' }, description: '新标签数组（可选）' },
          coverImage: { type: 'string', description: '封面图 URL，传空字符串可移除封面图（可选）' },
          status: { type: 'string', enum: ['public', 'draft', 'private'], description: '公开状态（可选）' },
          isPinned: { type: 'boolean', description: '是否置顶（可选）' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'delete_article',
      description: '根据文章 ID 删除一篇博客文章。',
      annotations: {
        title: '删除博客文章',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: '要删除的文章 ID' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'post_moment',
      description: '在博客发布一条日常瞬间（碎碎念/短动态/今日心情）。',
      annotations: {
        title: '发布日常瞬间动态',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: '瞬间正文内容' },
          mood: { type: 'string', description: '心情状态，例如：惬意、平静、专注、喜悦' },
          weather: { type: 'string', description: '天气，例如：晴朗、微雨、晚风' },
          location: { type: 'string', description: '所在地点' },
          tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
          images: { type: 'array', items: { type: 'string' }, description: '配图 URL 数组（可选）' },
          status: { type: 'string', enum: ['public', 'private'], description: '默认 public' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'add_travel_footprint',
      description: '在博客添加一条新的旅行足迹记录。',
      annotations: {
        title: '添加旅行足迹',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object',
        required: ['destination', 'summary'],
        properties: {
          destination: { type: 'string', description: '目的地名称，如：京都、大理、阿勒泰' },
          region: { type: 'string', description: '所属省/州/区域' },
          country: { type: 'string', description: '国家，默认中国' },
          startDate: { type: 'string', description: '开始日期 YYYY-MM-DD' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
          summary: { type: 'string', description: '一句话旅途印象' },
          story: { type: 'string', description: '详细旅途见闻与游记' },
          coverImage: { type: 'string', description: '代表性照片 URL（可选）' },
          tags: { type: 'array', items: { type: 'string' }, description: '旅行标签' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'add_collection_item',
      description: '在博客添加一条书影音或器物好物收藏记录（读过的书、看过的电影、喜欢的音乐或好物）。',
      annotations: {
        title: '添加书影音与好物收藏',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', description: '作品或器物名称' },
          creator: { type: 'string', description: '作者 / 导演 / 品牌' },
          category: {
            type: 'string',
            description: '分类标识：books（阅读）、movies（光影）、music（旋律）、gear（好物）',
          },
          categoryLabel: {
            type: 'string',
            description: '分类显示名：阅读书单、光影放映、常听旋律、器物与好物',
          },
          rating: { type: 'number', description: '评分 1 到 5' },
          review: { type: 'string', description: '短评或推荐语' },
          experienceNote: { type: 'string', description: '长篇体会或摘录笔记' },
          coverImage: { type: 'string', description: '封面图片 URL（可选）' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'update_blog_profile',
      description:
        '修改博客全站自定义文字与个人资料（如站点名称、顶部英文副标题、首页欢迎语、页脚诗句、页脚落款、关于我介绍等）。',
      annotations: {
        title: '更新博客全站资料与自定义文案',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '博主昵称' },
          gardenName: { type: 'string', description: '站点名称（如：竹林）' },
          headerSubtitle: { type: 'string', description: '顶部站点名旁边的副标题文字' },
          title: { type: 'string', description: '博主身份或头衔描述' },
          heroGreeting: { type: 'string', description: '首页首屏主标题欢迎语' },
          bio: { type: 'string', description: '首页首屏个人简介段落' },
          footerQuote: { type: 'string', description: '网页底部自定义寄语/诗句' },
          footerSignature: { type: 'string', description: '网页底部版权右侧自定义落款文字' },
          aboutTitle: { type: 'string', description: '关于页大标题' },
          aboutSubtitle: { type: 'string', description: '关于页副标题' },
          aboutContent: { type: 'string', description: '关于页完整正文（支持 Markdown）' },
          location: { type: 'string', description: '常驻城市' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  ];

  async function executeMcpToolCall(
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
    const db = loadLocalDatabase();

    try {
      if (toolName === 'get_blog_overview') {
        const includeContent = args.includeArticleContent !== false;
        const overview = {
          gardenName: db.profile.gardenName,
          profile: db.profile,
          stats: {
            articles: db.articles.length,
            moments: db.moments.length,
            travels: db.travels.length,
            collections: db.collections.length,
          },
          articles: db.articles.map((a) => ({
            id: a.id,
            title: a.title,
            category: a.category,
            tags: a.tags,
            excerpt: a.excerpt,
            status: a.status,
            isPinned: a.isPinned,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            ...(includeContent ? { content: a.content } : {}),
          })),
          moments: db.moments.slice(0, 20),
          travels: db.travels.slice(0, 20),
          collections: db.collections.slice(0, 20),
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(overview, null, 2) }],
        };
      }

      if (toolName === 'publish_article') {
        const title = String(args.title || '').trim();
        if (!title) {
          return {
            isError: true,
            content: [{ type: 'text', text: '发布失败：文章标题 (title) 不能为空' }],
          };
        }
        const now = new Date().toISOString();
        const htmlContent = convertMarkdownOrTextToHtml(String(args.content || ''));
        const autoExcerpt =
          String(args.excerpt || '').trim() || stripHtml(htmlContent).slice(0, 110);
        const category = String(args.category || '生活杂记').trim();
        const newArticle: Article = {
          id: `art-${Date.now()}`,
          title,
          slug:
            title
              .toLowerCase()
              .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
              .replace(/^-+|-+$/g, '') || `post-${Date.now()}`,
          excerpt: autoExcerpt,
          coverImage: args.coverImage ? String(args.coverImage) : '',
          content: htmlContent,
          category,
          tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
          status:
            args.status === 'draft' || args.status === 'private'
              ? args.status
              : 'public',
          isPinned: Boolean(args.isPinned),
          isFeatured: Boolean(args.isFeatured),
          location: args.location ? String(args.location) : '',
          weather: args.weather ? String(args.weather) : '',
          createdAt: now,
          updatedAt: now,
        };
        if (
          category &&
          !db.customCategories.articleCategories.includes(category)
        ) {
          db.customCategories.articleCategories.push(category);
        }
        db.articles.unshift(newArticle);
        await saveDatabase(db);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  message: `文章《${newArticle.title}》已成功发布并同步至云端！`,
                  article: newArticle,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (toolName === 'update_article') {
        const id = String(args.id || '').trim();
        const idx = db.articles.findIndex((a) => a.id === id);
        if (idx === -1) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `未找到 ID 为 ${id} 的文章，请先调用 get_blog_overview 查看文章 ID 列表。`,
              },
            ],
          };
        }
        const existing = db.articles[idx];
        const nextContent =
          args.content !== undefined
            ? convertMarkdownOrTextToHtml(String(args.content))
            : existing.content;
        const updated: Article = {
          ...existing,
          ...(args.title !== undefined ? { title: String(args.title).trim() } : {}),
          ...(args.category !== undefined ? { category: String(args.category).trim() } : {}),
          ...(args.tags !== undefined && Array.isArray(args.tags)
            ? { tags: args.tags.map(String) }
            : {}),
          ...(args.coverImage !== undefined ? { coverImage: String(args.coverImage) } : {}),
          ...(args.status !== undefined ? { status: args.status } : {}),
          ...(args.isPinned !== undefined ? { isPinned: Boolean(args.isPinned) } : {}),
          content: nextContent,
          excerpt:
            args.excerpt !== undefined
              ? String(args.excerpt)
              : existing.excerpt || stripHtml(nextContent).slice(0, 110),
          updatedAt: new Date().toISOString(),
        };
        db.articles[idx] = updated;
        await saveDatabase(db);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  message: `文章《${updated.title}》已更新并同步至云端！`,
                  article: updated,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (toolName === 'delete_article') {
        const id = String(args.id || '').trim();
        const target = db.articles.find((a) => a.id === id);
        if (!target) {
          return {
            isError: true,
            content: [{ type: 'text', text: `未找到 ID 为 ${id} 的文章` }],
          };
        }
        db.articles = db.articles.filter((a) => a.id !== id);
        await saveDatabase(db);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: true,
                message: `已删除文章《${target.title}》(${id})`,
              }),
            },
          ],
        };
      }

      if (toolName === 'post_moment') {
        const content = String(args.content || '').trim();
        if (!content) {
          return {
            isError: true,
            content: [{ type: 'text', text: '瞬间内容 (content) 不能为空' }],
          };
        }
        const newMoment: Moment = {
          id: `mom-${Date.now()}`,
          content,
          images: Array.isArray(args.images) ? args.images.map(String) : [],
          tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
          mood: args.mood ? String(args.mood) : '',
          weather: args.weather ? String(args.weather) : '',
          location: args.location ? String(args.location) : '',
          status: args.status === 'private' ? 'private' : 'public',
          createdAt: new Date().toISOString(),
        };
        db.moments.unshift(newMoment);
        await saveDatabase(db);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  message: '日常瞬间已成功发布并同步至云端！',
                  moment: newMoment,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (toolName === 'add_travel_footprint') {
        const destination = String(args.destination || '').trim();
        if (!destination) {
          return {
            isError: true,
            content: [{ type: 'text', text: '目的地 (destination) 不能为空' }],
          };
        }
        const today = new Date().toISOString().slice(0, 10);
        const newTravel: TravelFootprint = {
          id: `trv-${Date.now()}`,
          destination,
          region: args.region ? String(args.region) : '',
          country: args.country ? String(args.country) : '中国',
          coordinates: { x: 52, y: 48, lat: 30.27, lng: 120.15 },
          startDate: args.startDate ? String(args.startDate) : today,
          endDate: args.endDate ? String(args.endDate) : today,
          summary: args.summary ? String(args.summary) : '',
          story: args.story ? String(args.story) : '',
          coverImage:
            args.coverImage
              ? String(args.coverImage)
              : 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
          photos: [],
          tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
          status: 'public',
          createdAt: new Date().toISOString(),
        };
        db.travels.unshift(newTravel);
        await saveDatabase(db);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  message: `旅行足迹「${destination}」已添加并同步至云端！`,
                  travel: newTravel,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (toolName === 'add_collection_item') {
        const title = String(args.title || '').trim();
        if (!title) {
          return {
            isError: true,
            content: [{ type: 'text', text: '收藏名称 (title) 不能为空' }],
          };
        }
        const category = args.category ? String(args.category) : 'books';
        const categoryLabel = args.categoryLabel ? String(args.categoryLabel) : '阅读书单';
        if (!db.customCategories.collectionCategories.some((c) => c.id === category)) {
          db.customCategories.collectionCategories.push({
            id: category,
            label: categoryLabel,
          });
        }
        const newItem: CollectionItem = {
          id: `col-${Date.now()}`,
          title,
          creator: args.creator ? String(args.creator) : '',
          category,
          categoryLabel,
          coverImage:
            args.coverImage
              ? String(args.coverImage)
              : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
          rating: Math.min(5, Math.max(1, Number(args.rating) || 5)),
          review: args.review ? String(args.review) : '',
          experienceNote: args.experienceNote ? String(args.experienceNote) : '',
          specsOrMeta: '',
          externalLink: '',
          tags: [],
          recordedDate: new Date().toISOString().slice(0, 10),
          status: 'public',
          favorite: true,
          createdAt: new Date().toISOString(),
        };
        db.collections.unshift(newItem);
        await saveDatabase(db);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  message: `收藏「${title}」已添加并同步至云端！`,
                  collection: newItem,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (toolName === 'update_blog_profile') {
        const updates: Partial<SiteProfile> = { ...args };
        if (typeof updates.aboutContent === 'string' && updates.aboutContent.trim()) {
          updates.aboutContent = convertMarkdownOrTextToHtml(updates.aboutContent);
        }
        db.profile = {
          ...db.profile,
          ...updates,
        };
        await saveDatabase(db);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  message: '博客全站资料与自定义文案已更新并同步至云端！',
                  profile: db.profile,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        isError: true,
        content: [{ type: 'text', text: `未知工具: ${toolName}` }],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `执行出错: ${err?.message || String(err)}` }],
      };
    }
  }

  async function processMcpJsonRpcPayload(payload: any): Promise<any | null> {
    if (!payload || typeof payload !== 'object') {
      return {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid Request' },
      };
    }

    const { id, method, params } = payload;

    // Notifications do not have an id and do not expect a response object
    if (id === undefined || id === null) {
      return null;
    }

    if (method === 'initialize') {
      const requestedVersion = String(params?.protocolVersion || '');
      const supportedVersions = ['2025-06-18', '2025-03-26', '2024-11-05'];
      const negotiatedVersion = supportedVersions.includes(requestedVersion)
        ? requestedVersion
        : '2024-11-05';
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: negotiatedVersion,
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: 'zhulin-blog-mcp',
            version: '2.4.0',
          },
        },
      };
    }

    if (method === 'ping') {
      return {
        jsonrpc: '2.0',
        id,
        result: {},
      };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      };
    }

    if (method === 'tools/call') {
      const toolName = String(params?.name || '');
      const toolArgs =
        params?.arguments && typeof params.arguments === 'object'
          ? params.arguments
          : {};
      const toolResult = await executeMcpToolCall(toolName, toolArgs);
      return {
        jsonrpc: '2.0',
        id,
        result: toolResult,
      };
    }

    if (method === 'resources/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: { resources: [] },
      };
    }

    if (method === 'resources/templates/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: { resourceTemplates: [] },
      };
    }

    if (method === 'prompts/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: { prompts: [] },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    };
  }

  // Active SSE sessions for MCP HTTP+SSE clients
  const mcpSseClients = new Map<string, Response>();

  const handleMcpPost = async (req: Request, res: Response) => {
    const isMessagesEndpoint = req.path.startsWith('/messages');
    const sessionId =
      (req.headers['mcp-session-id'] as string) ||
      (req.query.sessionId as string) ||
      `mcp-${crypto.randomBytes(8).toString('hex')}`;
    res.setHeader('mcp-session-id', sessionId);

    const body = req.body;
    if (Array.isArray(body)) {
      const responses = [];
      for (const item of body) {
        const r = await processMcpJsonRpcPayload(item);
        if (r !== null) responses.push(r);
      }
      if (responses.length === 0) {
        res.status(202).end();
        return;
      }
      const sseRes = mcpSseClients.get(sessionId);
      if (isMessagesEndpoint && sseRes && !sseRes.writableEnded) {
        for (const r of responses) {
          sseRes.write(`event: message\ndata: ${JSON.stringify(r)}\n\n`);
        }
        res.status(202).send('Accepted');
        return;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json(responses);
      return;
    }

    const responseObj = await processMcpJsonRpcPayload(body);
    if (responseObj === null) {
      res.status(202).end();
      return;
    }

    // If this request came to /messages for an active HTTP+SSE session, emit on the SSE stream and return 202
    const sseRes = mcpSseClients.get(sessionId);
    if (isMessagesEndpoint && sseRes && !sseRes.writableEnded) {
      sseRes.write(`event: message\ndata: ${JSON.stringify(responseObj)}\n\n`);
      res.status(202).send('Accepted');
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(responseObj);
  };

  const handleMcpGetOrSse = (req: Request, res: Response) => {
    const accept = String(req.headers.accept || '');
    const isBrowserHtmlRequest =
      accept.includes('text/html') &&
      !accept.includes('text/event-stream') &&
      !req.path.startsWith('/sse');

    if (isBrowserHtmlRequest && req.query.sse !== '1') {
      const db = loadLocalDatabase();
      res.json({
        ok: true,
        protocol: 'MCP (Model Context Protocol - Streamable HTTP + SSE)',
        serverName: 'zhulin-blog-mcp',
        gardenName: db.profile.gardenName,
        toolsCount: MCP_TOOLS.length,
        tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
        message:
          'MCP 服务运行正常！可将此 URL 直接填入 ChatGPT「添加自定义 MCP 服务器」中。若刚刚在 AI Studio 更新了代码，请先点击右上角「Deploy / 部署」发布线上版本。',
      });
      return;
    }

    const existingSessionId = req.headers['mcp-session-id'] as string | undefined;
    const sessionId =
      existingSessionId || `mcp-${crypto.randomBytes(8).toString('hex')}`;
    const token = extractRequestToken(req);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('mcp-session-id', sessionId);
    res.flushHeaders?.();

    mcpSseClients.set(sessionId, res);

    if (!existingSessionId) {
      const messagesPath = token
        ? `/messages/${encodeURIComponent(token)}?sessionId=${sessionId}`
        : `/messages?sessionId=${sessionId}`;
      res.write(`event: endpoint\ndata: ${messagesPath}\n\n`);
    }

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': keepalive\n\n');
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      mcpSseClients.delete(sessionId);
    });
  };

  const handleMcpDelete = (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && mcpSseClients.has(sessionId)) {
      const sseRes = mcpSseClients.get(sessionId);
      sseRes?.end();
      mcpSseClients.delete(sessionId);
    }
    res.status(200).json({ ok: true });
  };

  app.post('/mcp', requireAdmin, handleMcpPost);
  app.post('/mcp/:apiKey', requireAdmin, handleMcpPost);
  app.get('/mcp', requireAdmin, handleMcpGetOrSse);
  app.get('/mcp/:apiKey', requireAdmin, handleMcpGetOrSse);
  app.delete('/mcp', requireAdmin, handleMcpDelete);
  app.delete('/mcp/:apiKey', requireAdmin, handleMcpDelete);
  app.get('/sse', requireAdmin, handleMcpGetOrSse);
  app.get('/sse/:apiKey', requireAdmin, handleMcpGetOrSse);
  app.post('/messages', requireAdmin, handleMcpPost);
  app.post('/messages/:apiKey', requireAdmin, handleMcpPost);

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
    if (updatedProfile.aboutContent) {
      updatedProfile.aboutContent = convertMarkdownOrTextToHtml(
        updatedProfile.aboutContent
      );
    }
    db.profile = {
      ...db.profile,
      ...updatedProfile,
      sectionTitles: {
        ...(db.profile.sectionTitles || {}),
        ...(updatedProfile.sectionTitles || {}),
      },
      homeModules: {
        ...db.profile.homeModules,
        ...(updatedProfile.homeModules || {}),
      },
    };
    await saveDatabase(db);
    res.json({ profile: db.profile });
  });

  // --- CUSTOM CATEGORIES MANAGEMENT ---
  app.put('/api/categories', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as Partial<GardenDatabase['customCategories']>;
    if (Array.isArray(body.articleCategories)) {
      db.customCategories.articleCategories = body.articleCategories
        .map((c) => String(c).trim())
        .filter(Boolean);
    }
    if (Array.isArray(body.collectionCategories)) {
      db.customCategories.collectionCategories = body.collectionCategories
        .filter((c) => c && c.id && c.label)
        .map((c) => ({ id: String(c.id).trim(), label: String(c.label).trim() }));
    }
    await saveDatabase(db);
    res.json({ customCategories: db.customCategories });
  });

  // --- ARTICLES CRUD ---
  app.get('/api/articles/:id', (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const isAdmin = isRequestAdmin(req);
    const art = db.articles.find((a) => a.id === req.params.id);
    if (!art || (!isAdmin && art.status !== 'public')) {
      res.status(404).json({ error: '未找到该文章' });
      return;
    }
    res.json({ article: art });
  });

  app.post('/api/articles', requireAdmin, async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as Partial<Article>;
    if (!body.title || !body.title.trim()) {
      res.status(400).json({ error: '文章标题不能为空' });
      return;
    }
    const now = new Date().toISOString();
    const htmlContent = convertMarkdownOrTextToHtml(body.content ?? '<p></p>');
    const autoExcerpt =
      body.excerpt && body.excerpt.trim()
        ? body.excerpt.trim()
        : stripHtml(htmlContent).slice(0, 110);

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
      excerpt: autoExcerpt,
      coverImage: body.coverImage ?? '',
      content: htmlContent,
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
      const htmlContent = convertMarkdownOrTextToHtml(body.content ?? '<p></p>');
      const created: Article = {
        id,
        title: (body.title || '未命名手记').trim(),
        slug: body.slug || `post-${Date.now()}`,
        excerpt: body.excerpt?.trim() || stripHtml(htmlContent).slice(0, 110),
        coverImage: body.coverImage ?? '',
        content: htmlContent,
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
    const nextContent =
      body.content !== undefined
        ? convertMarkdownOrTextToHtml(body.content)
        : existing.content;
    const updated: Article = {
      ...existing,
      ...body,
      id: existing.id,
      title: body.title !== undefined ? body.title.trim() || '未命名手记' : existing.title,
      content: nextContent,
      excerpt:
        body.excerpt !== undefined
          ? body.excerpt
          : existing.excerpt || stripHtml(nextContent).slice(0, 110),
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

  // --- TRAVEL FOOTPRINTS CRUD (Supports both /api/travel and /api/travels) ---
  const createTravelHandler = async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    const body = req.body as Partial<TravelFootprint>;
    if (!body.destination || !body.destination.trim()) {
      res.status(400).json({ error: '旅行目的地不能为空' });
      return;
    }
    const newTravel: TravelFootprint = {
      id: `trv-${Date.now()}`,
      destination: body.destination.trim(),
      region: body.region || '',
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
  };

  const updateTravelHandler = async (req: Request, res: Response) => {
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
  };

  const deleteTravelHandler = async (req: Request, res: Response) => {
    const db = loadLocalDatabase();
    db.travels = db.travels.filter((t) => t.id !== req.params.id);
    await saveDatabase(db);
    res.json({ ok: true });
  };

  app.post('/api/travel', requireAdmin, createTravelHandler);
  app.post('/api/travels', requireAdmin, createTravelHandler);
  app.put('/api/travel/:id', requireAdmin, updateTravelHandler);
  app.put('/api/travels/:id', requireAdmin, updateTravelHandler);
  app.delete('/api/travel/:id', requireAdmin, deleteTravelHandler);
  app.delete('/api/travels/:id', requireAdmin, deleteTravelHandler);

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
