import JSZip from 'jszip';
import crypto from 'crypto';
import type {
  GardenDatabase,
  Article,
  Moment,
  Album,
  TravelFootprint,
  CollectionItem,
  TimelineEvent,
} from '../types/garden';
import { buildTimelineEvents } from './gardenLogic';

export const CURRENT_BACKUP_SCHEMA_VERSION = 2;

export interface MediaReferenceEntry {
  mediaUrl: string;
  isLocalUpload: boolean;
  filename: string | null;
  referencedBy: Array<{
    type: 'profile' | 'article' | 'moment' | 'album' | 'travel' | 'collection';
    id: string;
    title: string;
    field: string;
  }>;
}

export interface TravelRelationEntry {
  travelId: string;
  destination: string;
  relatedArticleId?: string;
  relatedArticleTitle?: string;
  articleExists: boolean;
  relatedAlbumId?: string;
  relatedAlbumTitle?: string;
  albumExists: boolean;
}

export interface GardenRelationsReport {
  generatedAt: string;
  schemaVersion: number;
  tagIndex: Record<
    string,
    {
      articles: string[];
      moments: string[];
      travels: string[];
      collections: string[];
    }
  >;
  categoryIndex: {
    articles: Record<string, string[]>;
    collections: Record<string, string[]>;
    albums: Record<string, string[]>;
  };
  travelRelations: TravelRelationEntry[];
  mediaReferences: MediaReferenceEntry[];
  timeline: TimelineEvent[];
}

export interface BackupFileManifestEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
  category: 'data' | 'media' | 'doc';
}

export interface BackupManifest {
  backupFormat: 'qichi-garden-zip-v2';
  schemaVersion: number;
  exportedAt: string;
  appName: string;
  gardenName: string;
  counts: {
    articles: number;
    publicArticles: number;
    privateArticles: number;
    draftArticles: number;
    moments: number;
    albums: number;
    photos: number;
    travels: number;
    collections: number;
    uploadedMediaFiles: number;
    timelineEvents: number;
  };
  securityAudit: {
    containsCredentials: false;
    containsTokens: false;
    containsApiKeys: false;
  };
  files: BackupFileManifestEntry[];
}

export interface BackupInspectionResult {
  valid: boolean;
  compatible: boolean;
  error?: string;
  warnings: string[];
  manifest: BackupManifest | null;
  duplicateSummary: {
    totalDuplicates: number;
    articles: string[];
    moments: string[];
    albums: string[];
    travels: string[];
    collections: string[];
  };
  newSummary: {
    articles: number;
    moments: number;
    albums: number;
    travels: number;
    collections: number;
    mediaFiles: number;
  };
  missingMediaFiles: string[];
  checksumVerified: boolean;
  brokenRelations: string[];
}

export function sha256Buffer(buf: Buffer | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function extractLocalFilename(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:^|\/)uploads\/([a-zA-Z0-9_.\-]+)(?:\?.*)?$/);
  return match ? match[1] : null;
}

export function extractMediaUrlsFromHtml(html: string): string[] {
  if (!html) return [];
  const urls: string[] = [];
  const regex = /<(?:img|video|source)\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      urls.push(match[1].trim());
    }
  }
  return urls;
}

/**
 * Builds a complete relational and media dependency graph for the garden database.
 */
export function extractRelationshipsAndMedia(
  db: GardenDatabase
): GardenRelationsReport {
  const tagIndex: GardenRelationsReport['tagIndex'] = {};
  const ensureTag = (tag: string) => {
    if (!tagIndex[tag]) {
      tagIndex[tag] = { articles: [], moments: [], travels: [], collections: [] };
    }
  };

  const categoryIndex: GardenRelationsReport['categoryIndex'] = {
    articles: {},
    collections: {},
    albums: {},
  };

  const mediaMap = new Map<string, MediaReferenceEntry>();
  const addMediaRef = (
    url: string | undefined,
    ref: MediaReferenceEntry['referencedBy'][0]
  ) => {
    if (!url || !url.trim()) return;
    const clean = url.trim();
    const filename = extractLocalFilename(clean);
    const existing = mediaMap.get(clean);
    if (existing) {
      existing.referencedBy.push(ref);
    } else {
      mediaMap.set(clean, {
        mediaUrl: clean,
        isLocalUpload: Boolean(filename),
        filename,
        referencedBy: [ref],
      });
    }
  };

  // Profile media
  addMediaRef(db.profile.avatar, {
    type: 'profile',
    id: 'profile',
    title: db.profile.ownerName,
    field: 'avatar',
  });
  addMediaRef(db.profile.heroImage, {
    type: 'profile',
    id: 'profile',
    title: db.profile.gardenName,
    field: 'heroImage',
  });

  // Articles
  db.articles.forEach((art) => {
    const cat = art.category || '未分类';
    if (!categoryIndex.articles[cat]) categoryIndex.articles[cat] = [];
    categoryIndex.articles[cat].push(art.id);

    art.tags.forEach((t) => {
      ensureTag(t);
      tagIndex[t].articles.push(art.id);
    });

    addMediaRef(art.coverImage, {
      type: 'article',
      id: art.id,
      title: art.title,
      field: 'coverImage',
    });

    const inlineUrls = extractMediaUrlsFromHtml(art.content);
    inlineUrls.forEach((u) =>
      addMediaRef(u, {
        type: 'article',
        id: art.id,
        title: art.title,
        field: 'contentHtml',
      })
    );
  });

  // Moments
  db.moments.forEach((mom) => {
    mom.tags.forEach((t) => {
      ensureTag(t);
      tagIndex[t].moments.push(mom.id);
    });
    mom.images.forEach((img) =>
      addMediaRef(img, {
        type: 'moment',
        id: mom.id,
        title: mom.content.slice(0, 24),
        field: 'images',
      })
    );
  });

  // Albums
  db.albums.forEach((alb) => {
    const cat = alb.category || '未分类';
    if (!categoryIndex.albums[cat]) categoryIndex.albums[cat] = [];
    categoryIndex.albums[cat].push(alb.id);

    addMediaRef(alb.coverImage, {
      type: 'album',
      id: alb.id,
      title: alb.title,
      field: 'coverImage',
    });

    alb.photos.forEach((ph) =>
      addMediaRef(ph.url, {
        type: 'album',
        id: alb.id,
        title: `${alb.title} - ${ph.title}`,
        field: `photos.${ph.id}`,
      })
    );
  });

  // Travels & Relations
  const travelRelations: TravelRelationEntry[] = db.travels.map((trv) => {
    trv.tags.forEach((t) => {
      ensureTag(t);
      tagIndex[t].travels.push(trv.id);
    });

    addMediaRef(trv.coverImage, {
      type: 'travel',
      id: trv.id,
      title: trv.destination,
      field: 'coverImage',
    });

    trv.photos.forEach((p) =>
      addMediaRef(p, {
        type: 'travel',
        id: trv.id,
        title: trv.destination,
        field: 'photos',
      })
    );

    const linkedArticle = trv.relatedArticleId
      ? db.articles.find((a) => a.id === trv.relatedArticleId)
      : undefined;
    const linkedAlbum = trv.relatedAlbumId
      ? db.albums.find((al) => al.id === trv.relatedAlbumId)
      : undefined;

    return {
      travelId: trv.id,
      destination: trv.destination,
      relatedArticleId: trv.relatedArticleId,
      relatedArticleTitle: linkedArticle?.title,
      articleExists: trv.relatedArticleId ? Boolean(linkedArticle) : true,
      relatedAlbumId: trv.relatedAlbumId,
      relatedAlbumTitle: linkedAlbum?.title,
      albumExists: trv.relatedAlbumId ? Boolean(linkedAlbum) : true,
    };
  });

  // Collections
  db.collections.forEach((col) => {
    const cat = col.category || 'other';
    if (!categoryIndex.collections[cat]) categoryIndex.collections[cat] = [];
    categoryIndex.collections[cat].push(col.id);

    col.tags.forEach((t) => {
      ensureTag(t);
      tagIndex[t].collections.push(col.id);
    });

    addMediaRef(col.coverImage, {
      type: 'collection',
      id: col.id,
      title: col.title,
      field: 'coverImage',
    });
  });

  const timeline = buildTimelineEvents(db, true);

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    tagIndex,
    categoryIndex,
    travelRelations,
    mediaReferences: Array.from(mediaMap.values()),
    timeline,
  };
}

/**
 * Strips any accidental sensitive keys from database object before export.
 */
export function sanitizeDatabaseForExport(db: GardenDatabase): GardenDatabase {
  const clone = structuredClone(db) as unknown as Record<string, unknown>;
  delete clone.passwordHash;
  delete clone.activeTokens;
  delete clone.apiKey;
  delete clone.secret;
  return clone as unknown as GardenDatabase;
}

/**
 * Generates a complete, self-contained ZIP backup buffer containing:
 * - manifest.json (with SHA-256 checksums and inventory)
 * - data/garden-data.json (structured database)
 * - data/relations-and-timeline.json (tags, categories, travel links, media graph, timeline)
 * - media/uploads/<filename> (actual raw binary image files)
 * - README-MIGRATION.md (human-readable migration guide)
 */
export async function createFullBackupZip(
  rawDb: GardenDatabase,
  uploadedFiles: Map<string, Buffer>
): Promise<{ zipBuffer: Buffer; manifest: BackupManifest }> {
  const db = sanitizeDatabaseForExport(rawDb);
  const relations = extractRelationshipsAndMedia(db);
  const zip = new JSZip();
  const filesInventory: BackupFileManifestEntry[] = [];

  // 1. data/garden-data.json
  const gardenDataBuf = Buffer.from(JSON.stringify(db, null, 2), 'utf-8');
  zip.file('data/garden-data.json', gardenDataBuf);
  filesInventory.push({
    path: 'data/garden-data.json',
    sizeBytes: gardenDataBuf.length,
    sha256: sha256Buffer(gardenDataBuf),
    category: 'data',
  });

  // 2. data/relations-and-timeline.json
  const relationsBuf = Buffer.from(JSON.stringify(relations, null, 2), 'utf-8');
  zip.file('data/relations-and-timeline.json', relationsBuf);
  filesInventory.push({
    path: 'data/relations-and-timeline.json',
    sizeBytes: relationsBuf.length,
    sha256: sha256Buffer(relationsBuf),
    category: 'data',
  });

  // 3. media/uploads/<filename> (Actual binary image files)
  for (const [filename, fileBuf] of uploadedFiles.entries()) {
    const safeName = filename.replace(/[^a-zA-Z0-9_.\-]/g, '');
    if (!safeName) continue;
    const zipPath = `media/uploads/${safeName}`;
    zip.file(zipPath, fileBuf);
    filesInventory.push({
      path: zipPath,
      sizeBytes: fileBuf.length,
      sha256: sha256Buffer(fileBuf),
      category: 'media',
    });
  }

  // 4. README-MIGRATION.md
  const readmeText = `# ${db.profile.gardenName} · 个人数字花园完整数据备份包

- **导出时间**: ${new Date().toISOString()}
- **数据结构版本**: v${CURRENT_BACKUP_SCHEMA_VERSION}
- **安全声明**: 本备份包仅包含公开/私密内容数据与原始媒体图片文件，绝不包含任何管理员密码、访问令牌或云平台 API 密钥。

## 目录结构说明

1. \`manifest.json\`：备份元数据、内容统计、数据结构版本与所有文件的 SHA-256 完整性校验清单。
2. \`data/garden-data.json\`：全站核心结构化数据（个人资料、文章、草稿、富文本 HTML 正文、日常瞬间、摄影相册、远行足迹、兴趣收藏与自定义分类）。
3. \`data/relations-and-timeline.json\`：标签索引、分类映射、旅行足迹与游记/相册关联关系、图片引用图谱以及自动生成的全站时间线数据。
4. \`media/uploads/\`：所有上传的原始图片、文章配图、封面与相册照片二进制文件。

## 跨平台恢复与迁移指南

- **在栖迟园后台直接恢复**：登录「花园后台」->「数据备份与恢复」，上传此 ZIP 文件即可执行预检校验，并选择「完整覆盖恢复」或「智能合并导入」。
- **迁移至其他独立服务器或静态生成器**：直接读取 \`data/garden-data.json\`，并将 \`media/uploads/\` 挂载至目标站点的 \`/uploads/\` 静态目录，所有文章内的图片与封面关联即可 100% 无缝还原。
`;
  const readmeBuf = Buffer.from(readmeText, 'utf-8');
  zip.file('README-MIGRATION.md', readmeBuf);
  filesInventory.push({
    path: 'README-MIGRATION.md',
    sizeBytes: readmeBuf.length,
    sha256: sha256Buffer(readmeBuf),
    category: 'doc',
  });

  const manifest: BackupManifest = {
    backupFormat: 'qichi-garden-zip-v2',
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: '栖迟园 · Personal Digital Garden',
    gardenName: db.profile.gardenName,
    counts: {
      articles: db.articles.length,
      publicArticles: db.articles.filter((a) => a.status === 'public').length,
      privateArticles: db.articles.filter((a) => a.status === 'private').length,
      draftArticles: db.articles.filter((a) => a.status === 'draft').length,
      moments: db.moments.length,
      albums: db.albums.length,
      photos: db.albums.reduce((acc, a) => acc + a.photos.length, 0),
      travels: db.travels.length,
      collections: db.collections.length,
      uploadedMediaFiles: uploadedFiles.size,
      timelineEvents: relations.timeline.length,
    },
    securityAudit: {
      containsCredentials: false,
      containsTokens: false,
      containsApiKeys: false,
    },
    files: filesInventory,
  };

  zip.file('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { zipBuffer, manifest };
}

/**
 * Inspects and validates an uploaded ZIP backup file before restoring.
 * Detects version incompatibility, corrupted checksums, missing image files, broken relations, and duplicate records.
 */
export async function inspectBackupZip(
  zipBuffer: Buffer,
  currentDb: GardenDatabase
): Promise<BackupInspectionResult> {
  const emptyResult: BackupInspectionResult = {
    valid: false,
    compatible: false,
    warnings: [],
    manifest: null,
    duplicateSummary: {
      totalDuplicates: 0,
      articles: [],
      moments: [],
      albums: [],
      travels: [],
      collections: [],
    },
    newSummary: {
      articles: 0,
      moments: 0,
      albums: 0,
      travels: 0,
      collections: 0,
      mediaFiles: 0,
    },
    missingMediaFiles: [],
    checksumVerified: false,
    brokenRelations: [],
  };

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    return {
      ...emptyResult,
      error: '上传的文件不是有效的 ZIP 压缩包，请检查文件是否损坏。',
    };
  }

  const manifestFile = zip.file('manifest.json');
  const gardenDataFile = zip.file('data/garden-data.json');

  if (!manifestFile || !gardenDataFile) {
    return {
      ...emptyResult,
      error: 'ZIP 包内缺少 manifest.json 或 data/garden-data.json 核心数据文件。',
    };
  }

  let manifest: BackupManifest;
  let backupDb: GardenDatabase;
  try {
    manifest = JSON.parse(await manifestFile.async('string')) as BackupManifest;
    backupDb = JSON.parse(await gardenDataFile.async('string')) as GardenDatabase;
  } catch {
    return {
      ...emptyResult,
      error: '备份包内的 JSON 数据文件解析失败，格式可能已损坏。',
    };
  }

  // Version compatibility check
  if (
    typeof manifest.schemaVersion !== 'number' ||
    manifest.schemaVersion > CURRENT_BACKUP_SCHEMA_VERSION ||
    manifest.schemaVersion < 1
  ) {
    return {
      ...emptyResult,
      manifest,
      valid: true,
      compatible: false,
      error: `数据结构版本不兼容：备份包版本为 v${manifest.schemaVersion}，当前系统支持版本为 v1 ~ v${CURRENT_BACKUP_SCHEMA_VERSION}。`,
    };
  }

  if (
    !Array.isArray(backupDb.articles) ||
    !Array.isArray(backupDb.moments) ||
    !Array.isArray(backupDb.albums) ||
    !Array.isArray(backupDb.travels) ||
    !Array.isArray(backupDb.collections)
  ) {
    return {
      ...emptyResult,
      manifest,
      error: 'data/garden-data.json 缺少必要的模块数组结构（articles/moments/albums/travels/collections）。',
    };
  }

  const warnings: string[] = [];

  // Verify file checksums from manifest
  let checksumVerified = true;
  if (Array.isArray(manifest.files)) {
    for (const entry of manifest.files) {
      const f = zip.file(entry.path);
      if (!f) {
        checksumVerified = false;
        warnings.push(`清单中声明的文件缺失：${entry.path}`);
        continue;
      }
      const buf = await f.async('nodebuffer');
      if (sha256Buffer(buf) !== entry.sha256) {
        checksumVerified = false;
        warnings.push(`文件校验和（SHA-256）不匹配：${entry.path}`);
      }
    }
  }

  // Check if all local /uploads/<filename> referenced in backupDb actually exist in media/uploads/<filename> inside the ZIP
  const relations = extractRelationshipsAndMedia(backupDb);
  const missingMediaFiles: string[] = [];
  for (const ref of relations.mediaReferences) {
    if (ref.isLocalUpload && ref.filename) {
      const zipMediaPath = `media/uploads/${ref.filename}`;
      if (!zip.file(zipMediaPath)) {
        missingMediaFiles.push(ref.filename);
      }
    }
  }
  if (missingMediaFiles.length > 0) {
    warnings.push(
      `发现 ${missingMediaFiles.length} 个正文中引用的本地图片未包含在 media/uploads/ 目录中：${missingMediaFiles.join(', ')}`
    );
  }

  // Check broken relations between Travel -> Article / Album
  const brokenRelations: string[] = [];
  relations.travelRelations.forEach((rel) => {
    if (rel.relatedArticleId && !rel.articleExists) {
      brokenRelations.push(
        `足迹「${rel.destination}」关联的文章 ID (${rel.relatedArticleId}) 在备份中不存在`
      );
    }
    if (rel.relatedAlbumId && !rel.albumExists) {
      brokenRelations.push(
        `足迹「${rel.destination}」关联的相册 ID (${rel.relatedAlbumId}) 在备份中不存在`
      );
    }
  });
  if (brokenRelations.length > 0) {
    warnings.push(...brokenRelations);
  }

  // Compare against currentDb to find duplicate IDs vs new items
  const currentArticleIds = new Set(currentDb.articles.map((a) => a.id));
  const currentMomentIds = new Set(currentDb.moments.map((m) => m.id));
  const currentAlbumIds = new Set(currentDb.albums.map((al) => al.id));
  const currentTravelIds = new Set(currentDb.travels.map((t) => t.id));
  const currentCollectionIds = new Set(currentDb.collections.map((c) => c.id));

  const dupArticles = backupDb.articles
    .filter((a) => currentArticleIds.has(a.id))
    .map((a) => a.title);
  const dupMoments = backupDb.moments
    .filter((m) => currentMomentIds.has(m.id))
    .map((m) => m.id);
  const dupAlbums = backupDb.albums
    .filter((al) => currentAlbumIds.has(al.id))
    .map((al) => al.title);
  const dupTravels = backupDb.travels
    .filter((t) => currentTravelIds.has(t.id))
    .map((t) => t.destination);
  const dupCollections = backupDb.collections
    .filter((c) => currentCollectionIds.has(c.id))
    .map((c) => c.title);

  const totalDuplicates =
    dupArticles.length +
    dupMoments.length +
    dupAlbums.length +
    dupTravels.length +
    dupCollections.length;

  if (totalDuplicates > 0) {
    warnings.push(
      `检测到与当前花园存在 ${totalDuplicates} 项相同 ID 的重复记录（含 ${dupArticles.length} 篇文章）。可选择「智能合并」或「完整覆盖」。`
    );
  }

  const mediaFilesInZip = Object.keys(zip.files).filter(
    (p) => p.startsWith('media/uploads/') && !zip.files[p].dir
  ).length;

  return {
    valid: true,
    compatible: true,
    warnings,
    manifest,
    duplicateSummary: {
      totalDuplicates,
      articles: dupArticles,
      moments: dupMoments,
      albums: dupAlbums,
      travels: dupTravels,
      collections: dupCollections,
    },
    newSummary: {
      articles: backupDb.articles.length - dupArticles.length,
      moments: backupDb.moments.length - dupMoments.length,
      albums: backupDb.albums.length - dupAlbums.length,
      travels: backupDb.travels.length - dupTravels.length,
      collections: backupDb.collections.length - dupCollections.length,
      mediaFiles: mediaFilesInZip,
    },
    missingMediaFiles,
    checksumVerified,
    brokenRelations,
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

/**
 * Restores structured data, relationships, and binary media files from a verified backup ZIP.
 */
export async function restoreFromBackupZip(
  zipBuffer: Buffer,
  currentDb: GardenDatabase,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{
  restoredDb: GardenDatabase;
  restoredMediaFiles: Map<string, Buffer>;
  inspection: BackupInspectionResult;
}> {
  const inspection = await inspectBackupZip(zipBuffer, currentDb);
  if (!inspection.valid || !inspection.compatible) {
    throw new Error(inspection.error || '备份包校验未通过，无法执行恢复');
  }

  const zip = await JSZip.loadAsync(zipBuffer);
  const gardenDataRaw = await zip.file('data/garden-data.json')!.async('string');
  const incomingDb = sanitizeDatabaseForExport(
    JSON.parse(gardenDataRaw) as GardenDatabase
  );

  // Extract all binary media files from media/uploads/*
  const restoredMediaFiles = new Map<string, Buffer>();
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (relativePath.startsWith('media/uploads/') && !zipEntry.dir) {
      const filename = relativePath.slice('media/uploads/'.length).trim();
      if (filename && !filename.includes('..') && !filename.includes('/')) {
        const buf = await zipEntry.async('nodebuffer');
        restoredMediaFiles.set(filename, buf);
      }
    }
  }

  let restoredDb: GardenDatabase;
  if (mode === 'replace') {
    restoredDb = {
      version: incomingDb.version || 1,
      lastUpdated: new Date().toISOString(),
      profile: incomingDb.profile || currentDb.profile,
      articles: incomingDb.articles,
      moments: incomingDb.moments,
      albums: incomingDb.albums,
      travels: incomingDb.travels,
      collections: incomingDb.collections,
      customCategories: incomingDb.customCategories || currentDb.customCategories,
    };
  } else {
    // Smart Merge mode: preserve existing items and merge incoming items + categories
    const mergedArticleCats = Array.from(
      new Set([
        ...currentDb.customCategories.articleCategories,
        ...(incomingDb.customCategories?.articleCategories || []),
        ...incomingDb.articles.map((a) => a.category).filter(Boolean),
      ])
    );

    const colCatMap = new Map<string, string>();
    currentDb.customCategories.collectionCategories.forEach((c) =>
      colCatMap.set(c.id, c.label)
    );
    (incomingDb.customCategories?.collectionCategories || []).forEach((c) =>
      colCatMap.set(c.id, c.label)
    );
    incomingDb.collections.forEach((c) => {
      if (c.category && c.categoryLabel && !colCatMap.has(c.category)) {
        colCatMap.set(c.category, c.categoryLabel);
      }
    });

    restoredDb = {
      version: Math.max(currentDb.version || 1, incomingDb.version || 1),
      lastUpdated: new Date().toISOString(),
      profile: incomingDb.profile || currentDb.profile,
      articles: mergeById<Article>(currentDb.articles, incomingDb.articles),
      moments: mergeById<Moment>(currentDb.moments, incomingDb.moments),
      albums: mergeById<Album>(currentDb.albums, incomingDb.albums),
      travels: mergeById<TravelFootprint>(currentDb.travels, incomingDb.travels),
      collections: mergeById<CollectionItem>(
        currentDb.collections,
        incomingDb.collections
      ),
      customCategories: {
        articleCategories: mergedArticleCats,
        collectionCategories: Array.from(colCatMap.entries()).map(([id, label]) => ({
          id,
          label,
        })),
      },
    };
  }

  return {
    restoredDb,
    restoredMediaFiles,
    inspection,
  };
}
