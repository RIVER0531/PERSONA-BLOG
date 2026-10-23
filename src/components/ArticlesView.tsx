import React, { useState, useMemo } from 'react';
import {
  Search,
  Shuffle,
  Plus,
  Edit3,
  Trash2,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Share2,
  Check,
  Lock,
  FileText,
  Pin,
} from 'lucide-react';
import type { Article, SiteSectionTitles } from '../types/garden';
import {
  estimateReadingTime,
  extractTableOfContents,
  injectHeadingIds,
  filterVisibleContent,
  sortArticles,
  getAdjacentArticles,
  formatEditorialDate,
  stripHtml,
} from '../utils/gardenLogic';

interface ArticlesViewProps {
  articles: Article[];
  categories: string[];
  sectionTitles?: SiteSectionTitles;
  selectedArticleId: string | null;
  isAdmin: boolean;
  onSelectArticle: (id: string | null) => void;
  onNewArticle: () => void;
  onEditArticle: (article: Article) => void;
  onDeleteArticle: (id: string) => Promise<void>;
}

export const ArticlesView: React.FC<ArticlesViewProps> = ({
  articles,
  categories,
  sectionTitles,
  selectedArticleId,
  isAdmin,
  onSelectArticle,
  onNewArticle,
  onEditArticle,
  onDeleteArticle,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'public' | 'private' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  const visibleArticles = useMemo(
    () => sortArticles(filterVisibleContent(articles, isAdmin), true),
    [articles, isAdmin]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    visibleArticles.forEach((a) => a.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [visibleArticles]);

  const filteredArticles = useMemo(() => {
    return visibleArticles.filter((art) => {
      if (selectedCategory !== '全部' && art.category !== selectedCategory) {
        return false;
      }
      if (selectedTag && !art.tags.includes(selectedTag)) {
        return false;
      }
      if (isAdmin && statusFilter !== 'all' && art.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const plain = stripHtml(art.content);
        const hay = `${art.title} ${art.excerpt} ${plain} ${art.category} ${art.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleArticles, selectedCategory, selectedTag, isAdmin, statusFilter, searchQuery]);

  const currentArticle = useMemo(
    () => visibleArticles.find((a) => a.id === selectedArticleId) || null,
    [visibleArticles, selectedArticleId]
  );

  const handleRandomRead = () => {
    if (visibleArticles.length === 0) return;
    const pool = currentArticle
      ? visibleArticles.filter((a) => a.id !== currentArticle.id)
      : visibleArticles;
    const target =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : visibleArticles[0];
    if (target) {
      onSelectArticle(target.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- ARTICLE READER DETAIL VIEW ---
  if (currentArticle) {
    const readMinutes = estimateReadingTime(currentArticle.content);
    const toc = extractTableOfContents(currentArticle.content);
    const enrichedHtml = injectHeadingIds(currentArticle.content);
    const { prev, next } = getAdjacentArticles(articles, currentArticle.id, isAdmin);

    const handleCopyLink = () => {
      const url = `${window.location.origin}/?article=${encodeURIComponent(currentArticle.id)}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    };

    return (
      <article className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Top Reader Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-[var(--border-organic)]">
          <button
            type="button"
            onClick={() => onSelectArticle(null)}
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回全部文章列表</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRandomRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-xs font-medium hover:border-[#8b9d77] transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#687a56]" />
              <span>随机漫步一篇</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-xs font-medium hover:border-[#8b9d77] transition-colors cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#687a56]" />
                  <span>链接已复制</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>分享文章</span>
                </>
              )}
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => onEditArticle(currentArticle)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium hover:bg-[#586947] transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>编辑此文</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(currentArticle.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#d4a373] text-xs text-[var(--text-primary)] hover:bg-[#d4a373]/15 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Article Header */}
        <header className="max-w-3xl mx-auto mb-10">
          <div className="text-xs text-[var(--text-muted)] mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-[#687a56]">{currentArticle.category}</span>
            <span>·</span>
            <time dateTime={currentArticle.createdAt}>
              发布于 {formatEditorialDate(currentArticle.createdAt)}
            </time>
            <span>·</span>
            <span>约 {readMinutes} 分钟阅读</span>
            {currentArticle.location && (
              <>
                <span>·</span>
                <span>{currentArticle.location}</span>
              </>
            )}
            {currentArticle.weather && (
              <>
                <span>·</span>
                <span>{currentArticle.weather}</span>
              </>
            )}
            {currentArticle.status === 'private' && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-[#d4a373] font-medium">
                  <Lock className="w-3 h-3" /> 私人手札（仅自己可见）
                </span>
              </>
            )}
            {currentArticle.status === 'draft' && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-[var(--text-muted)] font-medium">
                  <FileText className="w-3 h-3" /> 未发布草稿
                </span>
              </>
            )}
          </div>

          <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold leading-tight mb-5">
            {currentArticle.title}
          </h1>

          {currentArticle.excerpt && (
            <p className="text-base text-[var(--text-muted)] leading-relaxed border-l-2 border-[#8b9d77] pl-4 py-1">
              {currentArticle.excerpt}
            </p>
          )}
        </header>

        {/* Cover Image */}
        {currentArticle.coverImage && (
          <div className="max-w-4xl mx-auto mb-12">
            <img
              src={currentArticle.coverImage}
              alt={currentArticle.title}
              onClick={() => setZoomedImageUrl(currentArticle.coverImage)}
              className="w-full max-h-[460px] object-cover rounded-2xl border border-[var(--border-organic)] shadow-xs cursor-zoom-in"
            />
          </div>
        )}

        {/* Main Content + Sticky Table of Contents Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-5xl mx-auto">
          <div className="lg:col-span-8 lg:col-start-1">
            <div
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'IMG') {
                  const src = (target as HTMLImageElement).src;
                  if (src) setZoomedImageUrl(src);
                }
              }}
              className="garden-prose mx-auto"
              dangerouslySetInnerHTML={{ __html: enrichedHtml }}
            />

            {/* Article Footer Metadata */}
            <footer className="mt-14 pt-6 border-t border-[var(--border-organic)] flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
              <div>
                <span>标签：</span>
                {currentArticle.tags.length > 0
                  ? currentArticle.tags.join(' · ')
                  : '无标签'}
              </div>
              <div>最后修剪于 {formatEditorialDate(currentArticle.updatedAt)}</div>
            </footer>

            {/* Previous & Next Article Navigation */}
            <nav
              aria-label="上下篇文章导航"
              className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {prev ? (
                <button
                  type="button"
                  onClick={() => {
                    onSelectArticle(prev.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-left p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-colors cursor-pointer group"
                >
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mb-1.5">
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    上一篇手记
                  </span>
                  <p className="font-serif-editorial text-base font-medium line-clamp-1">
                    {prev.title}
                  </p>
                </button>
              ) : (
                <div className="p-5 rounded-2xl border border-dashed border-[var(--border-organic)] text-xs text-[var(--text-muted)] flex items-center">
                  已是最新一篇手记
                </div>
              )}

              {next ? (
                <button
                  type="button"
                  onClick={() => {
                    onSelectArticle(next.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-right p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-colors cursor-pointer group"
                >
                  <span className="text-xs text-[var(--text-muted)] flex items-center justify-end gap-1 mb-1.5">
                    下一篇手记
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <p className="font-serif-editorial text-base font-medium line-clamp-1">
                    {next.title}
                  </p>
                </button>
              ) : (
                <div className="p-5 rounded-2xl border border-dashed border-[var(--border-organic)] text-xs text-[var(--text-muted)] flex items-center justify-end">
                  已是最早一篇手记
                </div>
              )}
            </nav>
          </div>

          {/* Sticky Table of Contents Sidebar */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-serif-editorial font-semibold">
                <BookOpen className="w-4 h-4 text-[#687a56]" />
                <span>文章章节目录</span>
              </div>
              {toc.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">本文为随笔短章，无分节目录。</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {toc.map((heading) => (
                    <li
                      key={heading.id}
                      className={heading.level === 3 ? 'pl-3.5' : ''}
                    >
                      <a
                        href={`#${heading.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const el = document.getElementById(heading.id);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="text-[var(--text-muted)] hover:text-[#687a56] transition-colors block py-0.5 leading-snug"
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        {/* Lightbox for zoomed article image */}
        {zoomedImageUrl && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="文章图片大图预览"
            onClick={() => setZoomedImageUrl(null)}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <img
              src={zoomedImageUrl}
              alt="放大的文章插图"
              className="max-w-full max-h-[90vh] rounded-xl object-contain"
            />
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {confirmDeleteId && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="确认删除文章"
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          >
            <div className="max-w-sm w-full rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-6 space-y-4">
              <h3 className="font-serif-editorial text-lg font-semibold">确认移除这篇手记？</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                删除后文章将从数字花园与时间线中移除。建议在删除重要长文前先导出花园备份。
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 rounded-xl text-xs border border-[var(--border-organic)] cursor-pointer"
                >
                  保留文章
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const id = confirmDeleteId;
                    setConfirmDeleteId(null);
                    await onDeleteArticle(id);
                    onSelectArticle(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs bg-[#b55346] text-white cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
    );
  }

  // --- ARTICLES EDITORIAL LIST VIEW ---
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[var(--border-organic)]">
        <div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold">
            {sectionTitles?.articlesPageTitle || '林间手记 · 文章总集'}
          </h1>
          {(sectionTitles?.articlesPageSubtitle ??
            '收录远行游记、器物长测、读书笔记与四季随想。') !== '' && (
            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-xl">
              {sectionTitles?.articlesPageSubtitle ??
                '收录远行游记、器物长测、读书笔记与四季随想。'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRandomRead}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-xs font-medium hover:border-[#8b9d77] transition-colors cursor-pointer"
          >
            <Shuffle className="w-4 h-4 text-[#687a56]" />
            <span>随机漫步一篇</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onNewArticle}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium hover:bg-[#586947] transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>写新文章（可视化编辑器）</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Interactive Category Filter Buttons */}
          <div
            role="tablist"
            aria-label="文章分类筛选"
            className="flex flex-wrap items-center gap-1.5"
          >
            {['全部', ...categories].map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#687a56] text-[#faf6f1]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-organic)] hover:text-[var(--text-primary)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题、正文、分类或标签…"
              aria-label="搜索文章"
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-organic)] focus:outline-none focus:border-[#8b9d77]"
            />
          </div>
        </div>

        {/* Tag Filter & Admin Status Filter */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
            <span>热门标签：</span>
            <button
              type="button"
              onClick={() => setSelectedTag('')}
              className={`cursor-pointer hover:text-[var(--text-primary)] ${
                selectedTag === '' ? 'font-semibold text-[#687a56] underline underline-offset-4' : ''
              }`}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                className={`cursor-pointer hover:text-[var(--text-primary)] ${
                  selectedTag === tag
                    ? 'font-semibold text-[#687a56] underline underline-offset-4'
                    : ''
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">状态筛选：</span>
              {(
                [
                  { id: 'all', label: '全部' },
                  { id: 'public', label: '公开' },
                  { id: 'private', label: '私人' },
                  { id: 'draft', label: '草稿' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-[var(--bg-muted)] font-semibold text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editorial Asymmetric Articles Layout */}
      {filteredArticles.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-center space-y-3">
          <p className="font-serif-editorial text-lg">未找到符合条件的文章手记</p>
          <p className="text-xs text-[var(--text-muted)]">
            可以尝试切换分类、清空搜索词，或者写下一篇新的记录。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredArticles.map((article, idx) => {
            const readTime = estimateReadingTime(article.content);
            const isHeroItem = idx === 0 && article.isPinned;

            return (
              <article
                key={article.id}
                className={`group rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-all overflow-hidden ${
                  isHeroItem
                    ? 'grid grid-cols-1 lg:grid-cols-12'
                    : 'grid grid-cols-1 md:grid-cols-12'
                }`}
              >
                {article.coverImage && (
                  <div
                    onClick={() => onSelectArticle(article.id)}
                    className={`${
                      isHeroItem ? 'lg:col-span-6 h-64 lg:h-auto' : 'md:col-span-4 h-52 md:h-auto'
                    } overflow-hidden cursor-pointer`}
                  >
                    <img
                      src={article.coverImage}
                      alt={article.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                )}

                <div
                  className={`${
                    article.coverImage
                      ? isHeroItem
                        ? 'lg:col-span-6'
                        : 'md:col-span-8'
                      : 'col-span-12'
                  } p-6 sm:p-8 flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    {/* Unboxed inline metadata (Zero-Pill discipline) */}
                    <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-x-2 gap-y-1">
                      {article.isPinned && (
                        <>
                          <span className="inline-flex items-center gap-1 font-medium text-[#687a56]">
                            <Pin className="w-3 h-3" /> 置顶手记
                          </span>
                          <span>·</span>
                        </>
                      )}
                      <span className="font-medium text-[var(--text-primary)]">
                        {article.category}
                      </span>
                      <span>·</span>
                      <time dateTime={article.createdAt}>
                        {formatEditorialDate(article.createdAt)}
                      </time>
                      <span>·</span>
                      <span>约 {readTime} 分钟阅读</span>
                      {article.status === 'private' && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-[#d4a373] font-medium">
                            <Lock className="w-3 h-3" /> 私人
                          </span>
                        </>
                      )}
                      {article.status === 'draft' && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-[var(--text-muted)] font-medium">
                            <FileText className="w-3 h-3" /> 草稿
                          </span>
                        </>
                      )}
                    </div>

                    <h2
                      onClick={() => onSelectArticle(article.id)}
                      className={`font-serif-editorial ${
                        isHeroItem ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                      } font-semibold group-hover:text-[#687a56] transition-colors cursor-pointer`}
                    >
                      {article.title}
                    </h2>

                    <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3">
                      {article.excerpt || stripHtml(article.content).slice(0, 140)}
                    </p>
                  </div>

                  <div className="pt-5 mt-5 border-t border-[var(--border-organic)] flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-[var(--text-muted)]">
                      {article.tags.map((t) => `#${t}`).join('  ')}
                    </div>

                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onEditArticle(article)}
                          className="text-xs text-[var(--text-muted)] hover:text-[#687a56] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>编辑</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectArticle(article.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#687a56] hover:underline cursor-pointer"
                      >
                        <span>展卷阅读</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
