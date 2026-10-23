import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  createFullBackupZip,
  inspectBackupZip,
  restoreFromBackupZip,
  extractRelationshipsAndMedia,
} from './backupEngine';
import { SEED_GARDEN_DATABASE } from '../data/seedGarden';

test('createFullBackupZip packages articles, relations, and raw binary images with zero credentials', async () => {
  const sampleDb = structuredClone(SEED_GARDEN_DATABASE);
  sampleDb.articles.unshift({
    id: 'art-test-upload',
    title: '测试备份文章：春山新雨后',
    slug: 'test-backup-article',
    excerpt: '验证正文中上传的图片与封面完整打包进 ZIP',
    coverImage: '/uploads/1729680000-cover.jpg',
    content: '<p>正文段落</p><figure><img src="/uploads/1729680000-inline.png" alt="内嵌图" /></figure>',
    category: '远行漫记',
    tags: ['备份测试', '春山'],
    status: 'public',
    isPinned: false,
    isFeatured: false,
    createdAt: '2026-10-23T09:00:00.000Z',
    updatedAt: '2026-10-23T09:00:00.000Z',
  });

  const fakeCoverBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const fakeInlineBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const mediaMap = new Map<string, Buffer>([
    ['1729680000-cover.jpg', fakeCoverBytes],
    ['1729680000-inline.png', fakeInlineBytes],
  ]);

  const { zipBuffer, manifest } = await createFullBackupZip(sampleDb, mediaMap);
  assert.equal(manifest.backupFormat, 'qichi-garden-zip-v2');
  assert.equal(manifest.counts.uploadedMediaFiles, 2);
  assert.equal(manifest.securityAudit.containsCredentials, false);

  // Verify actual ZIP contents
  const loadedZip = await JSZip.loadAsync(zipBuffer);
  assert.ok(loadedZip.file('manifest.json'));
  assert.ok(loadedZip.file('data/garden-data.json'));
  assert.ok(loadedZip.file('data/relations-and-timeline.json'));
  assert.ok(loadedZip.file('media/uploads/1729680000-cover.jpg'));
  assert.ok(loadedZip.file('media/uploads/1729680000-inline.png'));

  const extractedCover = await loadedZip
    .file('media/uploads/1729680000-cover.jpg')!
    .async('nodebuffer');
  assert.deepEqual(extractedCover, fakeCoverBytes);

  // Verify no sensitive keys in garden-data.json
  const gardenDataStr = await loadedZip.file('data/garden-data.json')!.async('string');
  assert.equal(gardenDataStr.includes('passwordHash'), false);
  assert.equal(gardenDataStr.includes('activeTokens'), false);
});

test('inspectBackupZip detects duplicates, missing media files, and version incompatibility', async () => {
  const sampleDb = structuredClone(SEED_GARDEN_DATABASE);
  sampleDb.articles[0].coverImage = '/uploads/missing-photo.jpg';

  // Export without providing missing-photo.jpg in mediaMap
  const { zipBuffer } = await createFullBackupZip(sampleDb, new Map());

  const inspection = await inspectBackupZip(zipBuffer, SEED_GARDEN_DATABASE);
  assert.equal(inspection.valid, true);
  assert.equal(inspection.compatible, true);
  assert.equal(inspection.checksumVerified, true);
  assert.equal(inspection.missingMediaFiles.includes('missing-photo.jpg'), true);
  assert.equal(inspection.duplicateSummary.articles.length, SEED_GARDEN_DATABASE.articles.length);
});

test('restoreFromBackupZip accurately restores articles, binary images, tags, and relationships in isolated environment', async () => {
  const sourceDb = structuredClone(SEED_GARDEN_DATABASE);
  sourceDb.articles.unshift({
    id: 'art-isolated-restore',
    title: '隔离环境恢复验证文章',
    slug: 'isolated-restore-test',
    excerpt: '摘要内容',
    coverImage: '/uploads/test-restore-img.jpg',
    content: '<h2>第一章</h2><p>包含本地图片 <img src="/uploads/test-restore-img.jpg" /></p>',
    category: '备份专栏',
    tags: ['数据迁移', '跨平台'],
    status: 'public',
    isPinned: true,
    isFeatured: true,
    createdAt: '2026-10-23T10:00:00.000Z',
    updatedAt: '2026-10-23T10:00:00.000Z',
  });
  sourceDb.travels[0].relatedArticleId = 'art-isolated-restore';

  const imgContent = Buffer.from('RAW_JPEG_BINARY_CONTENT_FOR_RESTORE_TEST', 'utf-8');
  const mediaFiles = new Map<string, Buffer>([['test-restore-img.jpg', imgContent]]);

  const { zipBuffer } = await createFullBackupZip(sourceDb, mediaFiles);

  // Simulate an empty/minimal isolated database environment
  const emptyIsolatedDb = structuredClone(SEED_GARDEN_DATABASE);
  emptyIsolatedDb.articles = [];
  emptyIsolatedDb.moments = [];
  emptyIsolatedDb.albums = [];
  emptyIsolatedDb.travels = [];
  emptyIsolatedDb.collections = [];

  const { restoredDb, restoredMediaFiles, inspection } = await restoreFromBackupZip(
    zipBuffer,
    emptyIsolatedDb,
    'replace'
  );

  assert.equal(inspection.valid, true);
  assert.equal(inspection.missingMediaFiles.length, 0);
  assert.equal(restoredDb.articles.length, sourceDb.articles.length);
  assert.equal(restoredDb.articles[0].id, 'art-isolated-restore');
  assert.deepEqual(restoredDb.articles[0].tags, ['数据迁移', '跨平台']);
  assert.equal(restoredMediaFiles.has('test-restore-img.jpg'), true);
  assert.deepEqual(restoredMediaFiles.get('test-restore-img.jpg'), imgContent);

  // Check relationship integrity after restore
  const relations = extractRelationshipsAndMedia(restoredDb);
  assert.equal(relations.travelRelations[0].relatedArticleId, 'art-isolated-restore');
  assert.equal(relations.travelRelations[0].articleExists, true);
  assert.ok(relations.tagIndex['数据迁移'].articles.includes('art-isolated-restore'));
});
