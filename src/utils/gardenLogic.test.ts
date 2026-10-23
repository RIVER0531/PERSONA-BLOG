import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripHtml,
  estimateReadingTime,
  extractTableOfContents,
  injectHeadingIds,
  filterVisibleContent,
  buildTimelineEvents,
  searchGardenContent,
} from './gardenLogic';
import type { GardenDatabase } from '../types/garden';

test('stripHtml removes tags and normalizes whitespace', () => {
  const html = '<h2>春山行旅</h2><p>这是一段 <strong>自然有机</strong> 的文字。</p>';
  assert.equal(stripHtml(html), '春山行旅 这是一段 自然有机 的文字。');
});

test('estimateReadingTime calculates Chinese reading minutes accurately', () => {
  const shortText = '<p>简短的随笔记录。</p>';
  assert.equal(estimateReadingTime(shortText), 1);

  const longChinese = '<p>' + '春水初生，春林初盛。'.repeat(80) + '</p>'; // 800 chars
  assert.equal(estimateReadingTime(longChinese), 3);
});

test('extractTableOfContents and injectHeadingIds match heading IDs', () => {
  const sampleHtml = `
    <p>导语段落</p>
    <h2>一、鸭川的午后</h2>
    <p>内容一</p>
    <h3>1. 旧书店寻访</h3>
    <p>内容二</p>
  `;
  const toc = extractTableOfContents(sampleHtml);
  assert.equal(toc.length, 2);
  assert.equal(toc[0].level, 2);
  assert.equal(toc[0].text, '一、鸭川的午后');
  assert.equal(toc[1].level, 3);
  assert.equal(toc[1].text, '1. 旧书店寻访');

  const injected = injectHeadingIds(sampleHtml);
  assert.equal(injected.includes(`id="${toc[0].id}"`), true);
  assert.equal(injected.includes(`id="${toc[1].id}"`), true);
});

test('filterVisibleContent hides private and draft items for visitors and reveals all for admin', () => {
  const items = [
    { id: '1', status: 'public' },
    { id: '2', status: 'private' },
    { id: '3', status: 'draft' },
  ];
  const visitorView = filterVisibleContent(items, false);
  assert.equal(visitorView.length, 1);
  assert.equal(visitorView[0].id, '1');

  const adminView = filterVisibleContent(items, true);
  assert.equal(adminView.length, 3);
});

test('buildTimelineEvents and searchGardenContent respect privacy and aggregate chronologically', () => {
  const mockDb: GardenDatabase = {
    version: 1,
    lastUpdated: '2026-10-20T00:00:00.000Z',
    profile: {
      gardenName: '栖迟园',
      gardenSubtitle: '个人数字花园',
      ownerName: '林知夏',
      ownerTitle: '记录者',
      avatar: '',
      signature: '',
      bio: '',
      heroTitle: '',
      heroIntro: '',
      heroImage: '',
      heroQuote: '',
      seasonNote: '',
      currentLocation: '',
      currentReading: '',
      currentListening: '',
      aboutContent: '',
      interests: [],
      socialLinks: [],
      milestones: [],
      homeModules: {
        showFeaturedArticles: true,
        showMoments: true,
        showGallery: true,
        showTravel: true,
        showCollections: true,
        showAlmanac: true,
      },
    },
    articles: [
      {
        id: 'a1',
        title: '京都秋日漫步',
        slug: 'kyoto-autumn',
        excerpt: '在鸭川边喝咖啡',
        coverImage: '',
        content: '<p>京都的枫叶与旧书店</p>',
        category: '行旅',
        tags: ['京都'],
        status: 'public',
        isPinned: true,
        isFeatured: true,
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-15T10:00:00.000Z',
      },
      {
        id: 'a2',
        title: '私密日记本',
        slug: 'secret-diary',
        excerpt: '仅自己可见',
        coverImage: '',
        content: '<p>深夜独白与京都回忆</p>',
        category: '私密',
        tags: ['随想'],
        status: 'private',
        isPinned: false,
        isFeatured: false,
        createdAt: '2026-10-18T10:00:00.000Z',
        updatedAt: '2026-10-18T10:00:00.000Z',
      },
    ],
    moments: [
      {
        id: 'm1',
        content: '手冲了一杯埃塞俄比亚水洗豆',
        images: [],
        tags: ['咖啡'],
        status: 'public',
        createdAt: '2026-10-19T08:00:00.000Z',
      },
    ],
    albums: [],
    travels: [],
    collections: [],
    customCategories: {
      articleCategories: ['行旅', '私密'],
      collectionCategories: [],
    },
  };

  const visitorTimeline = buildTimelineEvents(mockDb, false);
  assert.equal(visitorTimeline.length, 2); // a1 and m1, not a2
  assert.equal(visitorTimeline[0].sourceId, 'm1'); // Oct 19 is newer than Oct 15

  const adminTimeline = buildTimelineEvents(mockDb, true);
  assert.equal(adminTimeline.length, 3);

  const visitorSearch = searchGardenContent(mockDb, '京都', false);
  assert.equal(visitorSearch.length, 1);
  assert.equal(visitorSearch[0].id, 'a1');

  const adminSearch = searchGardenContent(mockDb, '京都', true);
  assert.equal(adminSearch.length, 2);
});

import { convertMarkdownOrTextToHtml, buildOpenApiSpec } from './agentApi';

test('convertMarkdownOrTextToHtml converts Markdown headings, bold, quotes, lists, and paragraphs into semantic HTML', () => {
  const md = `## 一、山中听雨

今天在竹林里煮茶，读完了**《草木有趣》**。

> 衡门之下，可以栖迟。

- 岩茶一泡
- 手写笔记两页`;

  const html = convertMarkdownOrTextToHtml(md);
  assert.equal(html.includes('<h2>一、山中听雨</h2>'), true);
  assert.equal(html.includes('<strong>《草木有趣》</strong>'), true);
  assert.equal(html.includes('<blockquote>衡门之下，可以栖迟。</blockquote>'), true);
  assert.equal(html.includes('<ul><li>岩茶一泡</li><li>手写笔记两页</li></ul>'), true);
});

test('buildOpenApiSpec produces valid OpenAPI 3.1.0 schema with server URL and BearerAuth', () => {
  const spec = buildOpenApiSpec('https://river05531.ai.studio/', '竹林');
  assert.equal(spec.openapi, '3.1.0');
  assert.equal(spec.servers[0].url, 'https://river05531.ai.studio');
  assert.equal(Boolean(spec.paths['/api/agent/execute']), true);
  assert.equal(Boolean(spec.paths['/api/articles']), true);
});

