import type {
  Article,
  GardenDatabase,
  TimelineEvent,
  VisibilityStatus,
} from '../types/garden';

/**
 * Strips HTML tags and returns clean plain text.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estimates reading time in minutes for mixed Chinese and English rich HTML content.
 * Assumes ~350 Chinese characters or English words per minute for relaxed reading.
 */
export function estimateReadingTime(htmlOrText: string): number {
  const plain = stripHtml(htmlOrText);
  if (!plain) return 1;
  const cjkMatches = plain.match(/[\u4e00-\u9fa5]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const nonCjkText = plain.replace(/[\u4e00-\u9fa5]/g, ' ');
  const wordMatches = nonCjkText.trim().split(/\s+/).filter(Boolean);
  const wordCount = wordMatches.length;
  const totalUnits = cjkCount + wordCount;
  return Math.max(1, Math.ceil(totalUnits / 320));
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

/**
 * Extracts H1, H2, H3 headings from rich HTML and returns a structured Table of Contents.
 */
export function extractTableOfContents(html: string): TocHeading[] {
  if (!html) return [];
  const regex = /<h([1-3])(?:\s+[^>]*)?>([\s\S]*?)<\/h\1>/gi;
  const headings: TocHeading[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const rawInner = match[2];
    const text = stripHtml(rawInner);
    if (text) {
      index += 1;
      const slug = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const id = `heading-${index}-${slug || index}`;
      headings.push({ id, text, level });
    }
  }
  return headings;
}

/**
 * Injects deterministic `id` attributes into H1, H2, H3 tags so TOC links scroll accurately.
 */
export function injectHeadingIds(html: string): string {
  if (!html) return '';
  let index = 0;
  return html.replace(
    /<h([1-3])(\s+[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (fullMatch, levelStr, attrs = '', inner) => {
      const text = stripHtml(inner);
      if (!text) return fullMatch;
      index += 1;
      const slug = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const id = `heading-${index}-${slug || index}`;
      // Remove any existing id attribute to avoid duplicates
      const cleanedAttrs = attrs ? attrs.replace(/\s*id="[^"]*"/gi, '') : '';
      return `<h${levelStr} id="${id}"${cleanedAttrs}>${inner}</h${levelStr}>`;
    }
  );
}

/**
 * Enforces visibility rules: non-admin visitors only see 'public' content.
 */
export function filterVisibleContent<T extends { status: string }>(
  items: T[],
  isAdmin: boolean
): T[] {
  if (isAdmin) return items;
  return items.filter((item) => item.status === 'public');
}

/**
 * Sorts articles with pinned first (when desired), then newest createdAt first.
 */
export function sortArticles(articles: Article[], prioritizePinned = true): Article[] {
  return [...articles].sort((a, b) => {
    if (prioritizePinned && a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Finds previous and next articles and a random article for "随机漫步".
 */
export function getAdjacentArticles(
  articles: Article[],
  currentId: string,
  isAdmin: boolean
): {
  prev: Article | null;
  next: Article | null;
  random: Article | null;
} {
  const visible = sortArticles(filterVisibleContent(articles, isAdmin), false);
  const idx = visible.findIndex((a) => a.id === currentId);
  const prev = idx > 0 ? visible[idx - 1] : null;
  const next = idx >= 0 && idx < visible.length - 1 ? visible[idx + 1] : null;
  const candidates = visible.filter((a) => a.id !== currentId);
  const random =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : visible[0] || null;
  return { prev, next, random };
}

/**
 * Formats an ISO date string into a warm Chinese editorial format, e.g., "2026年10月18日"
 */
export function formatEditorialDate(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return isoDate;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}年${m}月${d}日`;
}

/**
 * Aggregates Articles, Moments, Travel Footprints, Collections, and Albums into a unified Timeline.
 */
export function buildTimelineEvents(
  db: GardenDatabase,
  isAdmin: boolean,
  filterType = 'all',
  filterYear = 'all'
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  const parseDateParts = (rawDate: string) => {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) {
      return {
        iso: '2026-01-01T00:00:00.000Z',
        year: '2026',
        month: '01',
        day: '01',
      };
    }
    return {
      iso: d.toISOString(),
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
    };
  };

  // 1. Articles
  filterVisibleContent(db.articles, isAdmin).forEach((article) => {
    const parts = parseDateParts(article.createdAt);
    events.push({
      id: `tl-article-${article.id}`,
      sourceId: article.id,
      type: 'article',
      typeLabel: '文章手记',
      date: parts.iso,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      title: article.title,
      summary: article.excerpt || stripHtml(article.content).slice(0, 110),
      coverImage: article.coverImage,
      tags: [article.category, ...article.tags].filter(Boolean),
      status: article.status,
      meta: `${article.category} · 约 ${estimateReadingTime(article.content)} 分钟阅读`,
    });
  });

  // 2. Moments
  filterVisibleContent(db.moments, isAdmin).forEach((moment) => {
    const parts = parseDateParts(moment.createdAt);
    const cleanText = moment.content.trim();
    events.push({
      id: `tl-moment-${moment.id}`,
      sourceId: moment.id,
      type: 'moment',
      typeLabel: '日常瞬间',
      date: parts.iso,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      title: cleanText.length > 36 ? `${cleanText.slice(0, 36)}…` : cleanText,
      summary: cleanText,
      coverImage: moment.images[0],
      tags: moment.tags,
      status: moment.status as VisibilityStatus,
      meta: [moment.weather, moment.mood, moment.location].filter(Boolean).join(' · '),
    });
  });

  // 3. Travel Footprints
  filterVisibleContent(db.travels, isAdmin).forEach((travel) => {
    const parts = parseDateParts(travel.startDate || travel.createdAt);
    events.push({
      id: `tl-travel-${travel.id}`,
      sourceId: travel.id,
      type: 'travel',
      typeLabel: '远行足迹',
      date: parts.iso,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      title: `行旅 · ${travel.destination}`,
      summary: travel.summary,
      coverImage: travel.coverImage,
      tags: travel.tags,
      status: travel.status as VisibilityStatus,
      meta: `${travel.country} · ${travel.region}`,
    });
  });

  // 4. Collections
  filterVisibleContent(db.collections, isAdmin).forEach((item) => {
    const parts = parseDateParts(item.recordedDate || item.createdAt);
    events.push({
      id: `tl-collection-${item.id}`,
      sourceId: item.id,
      type: 'collection',
      typeLabel: `收藏 · ${item.categoryLabel}`,
      date: parts.iso,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      title: item.title,
      summary: item.review,
      coverImage: item.coverImage,
      tags: item.tags,
      status: item.status as VisibilityStatus,
      meta: `${item.creator} · 评分 ${'★'.repeat(item.rating)}`,
    });
  });

  // 5. Albums
  filterVisibleContent(db.albums, isAdmin).forEach((album) => {
    const parts = parseDateParts(album.date || album.createdAt);
    events.push({
      id: `tl-album-${album.id}`,
      sourceId: album.id,
      type: 'album',
      typeLabel: '光影相册',
      date: parts.iso,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      title: `相册 · ${album.title}`,
      summary: album.description,
      coverImage: album.coverImage,
      tags: [album.category, album.location].filter(Boolean),
      status: album.status as VisibilityStatus,
      meta: `${album.location} · 共 ${album.photos.length} 张照片`,
    });
  });

  return events
    .filter((ev) => (filterType === 'all' ? true : ev.type === filterType))
    .filter((ev) => (filterYear === 'all' ? true : ev.year === filterYear))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export interface SearchResultItem {
  id: string;
  type: 'article' | 'moment' | 'travel' | 'collection' | 'album';
  typeLabel: string;
  title: string;
  snippet: string;
  date: string;
  status: VisibilityStatus;
}

/**
 * Full-text search across all garden modules.
 */
export function searchGardenContent(
  db: GardenDatabase,
  query: string,
  isAdmin: boolean
): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResultItem[] = [];

  filterVisibleContent(db.articles, isAdmin).forEach((a) => {
    const plain = stripHtml(a.content);
    const hay = `${a.title} ${a.excerpt} ${plain} ${a.category} ${a.tags.join(' ')}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: a.id,
        type: 'article',
        typeLabel: '文章',
        title: a.title,
        snippet: a.excerpt || plain.slice(0, 90),
        date: a.createdAt,
        status: a.status,
      });
    }
  });

  filterVisibleContent(db.moments, isAdmin).forEach((m) => {
    const hay = `${m.content} ${m.tags.join(' ')} ${m.location || ''}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: m.id,
        type: 'moment',
        typeLabel: '瞬间',
        title: m.content.slice(0, 40),
        snippet: m.content,
        date: m.createdAt,
        status: m.status,
      });
    }
  });

  filterVisibleContent(db.travels, isAdmin).forEach((t) => {
    const hay = `${t.destination} ${t.region} ${t.country} ${t.summary} ${t.story} ${t.tags.join(' ')}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: t.id,
        type: 'travel',
        typeLabel: '足迹',
        title: t.destination,
        snippet: t.summary,
        date: t.startDate,
        status: t.status,
      });
    }
  });

  filterVisibleContent(db.collections, isAdmin).forEach((c) => {
    const hay = `${c.title} ${c.creator} ${c.categoryLabel} ${c.review} ${c.tags.join(' ')}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: c.id,
        type: 'collection',
        typeLabel: `收藏·${c.categoryLabel}`,
        title: c.title,
        snippet: c.review,
        date: c.recordedDate,
        status: c.status,
      });
    }
  });

  filterVisibleContent(db.albums, isAdmin).forEach((al) => {
    const hay = `${al.title} ${al.description} ${al.location} ${al.category}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: al.id,
        type: 'album',
        typeLabel: '相册',
        title: al.title,
        snippet: al.description,
        date: al.date,
        status: al.status,
      });
    }
  });

  return results;
}
