import React from 'react';
import {
  ArrowRight,
  Feather,
  Compass,
  Camera,
  Bookmark,
  Sparkles,
  Shuffle,
  MapPin,
  BookOpen,
  Music,
  Pin,
} from 'lucide-react';
import type { GardenDatabase } from '../types/garden';
import {
  filterVisibleContent,
  sortArticles,
  estimateReadingTime,
  formatEditorialDate,
} from '../utils/gardenLogic';

interface HomeViewProps {
  garden: GardenDatabase;
  isAdmin: boolean;
  onNavigate: (
    page:
      | 'home'
      | 'articles'
      | 'editor'
      | 'moments'
      | 'gallery'
      | 'travel'
      | 'collections'
      | 'timeline'
      | 'about'
      | 'admin'
  ) => void;
  onOpenArticle: (id: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  garden,
  isAdmin,
  onNavigate,
  onOpenArticle,
}) => {
  const { profile } = garden;
  const visibleArticles = sortArticles(
    filterVisibleContent(garden.articles, isAdmin),
    true
  );
  const featuredArticles = visibleArticles.slice(0, 3);
  const recentMoments = filterVisibleContent(garden.moments, isAdmin).slice(0, 3);
  const recentAlbums = filterVisibleContent(garden.albums, isAdmin).slice(0, 3);
  const recentTravels = filterVisibleContent(garden.travels, isAdmin).slice(0, 3);
  const favoriteCollections = filterVisibleContent(
    garden.collections,
    isAdmin
  ).slice(0, 4);

  const handleRandomWalk = () => {
    if (visibleArticles.length === 0) return;
    const pick =
      visibleArticles[Math.floor(Math.random() * visibleArticles.length)];
    onOpenArticle(pick.id);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-16">
      {/* 1. HERO EDITORIAL SPREAD & OWNER PROFILE CARD */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left 7 Cols: Magazine Cover Story & Garden Intro */}
        <div className="lg:col-span-7 p-7 sm:p-10 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Botanical Hand-Drawn SVG Leaf Watermark */}
          <svg
            viewBox="0 0 120 120"
            className="w-40 h-40 absolute -right-6 -bottom-6 text-[#8b9d77]/12 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <path d="M20,100 C40,60 75,35 105,15 C85,45 65,80 20,100 Z" />
            <path d="M20,100 C45,75 75,45 105,15" />
            <path d="M52,68 L42,50" />
            <path d="M68,52 L85,48" />
          </svg>

          <div className="space-y-5 relative z-10">
            {profile.homeModules.showAlmanac && profile.seasonNote && profile.seasonNote.trim() && (
              <div className="inline-flex items-center gap-2 text-xs text-[#687a56] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#687a56]" />
                <span>{profile.seasonNote}</span>
              </div>
            )}

            <h1 className="font-serif-editorial text-3xl sm:text-4xl lg:text-[2.5rem] font-semibold leading-[1.28] tracking-tight">
              {profile.heroTitle}
            </h1>

            {profile.heroIntro && profile.heroIntro.trim() && (
              <p className="text-sm sm:text-base text-[var(--text-body)] leading-relaxed max-w-2xl">
                {profile.heroIntro}
              </p>
            )}

            {profile.heroQuote && profile.heroQuote.trim() && (
              <blockquote className="font-serif-editorial text-sm italic text-[var(--text-muted)] border-l-2 border-[#d4a373] pl-3.5 py-0.5">
                {profile.heroQuote}
              </blockquote>
            )}
          </div>

          <div className="pt-8 mt-6 border-t border-[var(--border-organic)] flex flex-wrap items-center gap-3 relative z-10">
            <button
              type="button"
              onClick={() => onNavigate('articles')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs sm:text-sm font-medium hover:bg-[#586947] transition-colors cursor-pointer"
            >
              <span>翻阅文章</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {visibleArticles.length > 0 && (
              <button
                type="button"
                onClick={handleRandomWalk}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-primary)] text-xs sm:text-sm font-medium hover:border-[#8b9d77] transition-colors cursor-pointer"
              >
                <Shuffle className="w-4 h-4 text-[#687a56]" />
                <span>随机漫步一篇</span>
              </button>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('editor')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#d4a373] text-xs sm:text-sm font-medium hover:bg-[#d4a373]/15 transition-colors cursor-pointer"
                >
                  <Feather className="w-4 h-4 text-[#d4a373]" />
                  <span>写新文章</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-primary)] text-xs sm:text-sm font-medium hover:border-[#8b9d77] transition-colors cursor-pointer"
                >
                  <span>自定义全站文字与板块</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Garden Keeper Identity & Now Card */}
        <div className="lg:col-span-5 p-7 sm:p-8 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {profile.avatar && (
                <img
                  src={profile.avatar}
                  alt={profile.ownerName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#8b9d77]"
                />
              )}
              <div>
                {(profile.sectionTitles?.ownerCardBadge ?? '园主名片') !== '' && (
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    {profile.sectionTitles?.ownerCardBadge ?? '园主名片'}
                  </span>
                )}
                <h2 className="font-serif-editorial text-2xl font-semibold">
                  {profile.ownerName}
                </h2>
                {profile.ownerTitle && (
                  <p className="text-xs text-[var(--text-muted)]">{profile.ownerTitle}</p>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-xs sm:text-sm text-[var(--text-body)] leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>

          {(profile.currentLocation || profile.currentReading || profile.currentListening) && (
            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-2.5 text-xs">
              {profile.currentLocation && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#687a56]" /> 常居坐标
                  </span>
                  <span className="font-medium">{profile.currentLocation}</span>
                </div>
              )}
              {profile.currentReading && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#d4a373]" /> 案头在读
                  </span>
                  <span className="font-medium truncate max-w-[190px]">
                    {profile.currentReading}
                  </span>
                </div>
              )}
              {profile.currentListening && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-[#687a56]" /> 循环旋律
                  </span>
                  <span className="font-medium truncate max-w-[190px]">
                    {profile.currentListening}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[var(--text-muted)]">
              已存 {visibleArticles.length} 篇长文 · {garden.moments.length} 条瞬间 · {garden.travels.length} 处远行
            </span>
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className="text-[#687a56] font-medium hover:underline cursor-pointer"
            >
              关于我 →
            </button>
          </div>
        </div>
      </section>

      {/* 2. FEATURED ESSAYS SPREAD (Asymmetric Editorial Layout) */}
      {profile.homeModules.showFeaturedArticles && featuredArticles.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between border-b border-[var(--border-organic)] pb-4">
            <div>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold">
                {profile.sectionTitles?.homeArticlesTitle || '精选长文手记'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('articles')}
              className="text-xs font-medium text-[#687a56] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>阅读全部 {visibleArticles.length} 篇文章</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lead Article (7 cols) */}
            {featuredArticles[0] && (
              <article
                onClick={() => onOpenArticle(featuredArticles[0].id)}
                className="lg:col-span-7 group rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-all overflow-hidden cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {featuredArticles[0].coverImage && (
                    <div className="h-64 sm:h-72 overflow-hidden">
                      <img
                        src={featuredArticles[0].coverImage}
                        alt={featuredArticles[0].title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-6 sm:p-8 space-y-3">
                    <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-x-2">
                      {featuredArticles[0].isPinned && (
                        <>
                          <span className="inline-flex items-center gap-1 text-[#687a56] font-medium">
                            <Pin className="w-3 h-3" /> 置顶精选
                          </span>
                          <span>·</span>
                        </>
                      )}
                      <span className="font-medium text-[var(--text-primary)]">
                        {featuredArticles[0].category}
                      </span>
                      <span>·</span>
                      <span>{formatEditorialDate(featuredArticles[0].createdAt)}</span>
                      <span>·</span>
                      <span>约 {estimateReadingTime(featuredArticles[0].content)} 分钟阅读</span>
                    </div>

                    <h3 className="font-serif-editorial text-2xl font-semibold group-hover:text-[#687a56] transition-colors">
                      {featuredArticles[0].title}
                    </h3>

                    <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3">
                      {featuredArticles[0].excerpt}
                    </p>
                  </div>
                </div>

                <div className="px-6 sm:px-8 pb-6 pt-3 border-t border-[var(--border-organic)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>{featuredArticles[0].tags.map((t) => `#${t}`).join('  ')}</span>
                  <span className="text-[#687a56] font-medium">展卷阅读 →</span>
                </div>
              </article>
            )}

            {/* Secondary Stacked Articles (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {featuredArticles.slice(1, 3).map((art) => (
                <article
                  key={art.id}
                  onClick={() => onOpenArticle(art.id)}
                  className="flex-1 group p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="text-xs text-[var(--text-muted)]">
                      <span className="font-medium text-[#687a56]">{art.category}</span>
                      {' · '}
                      <span>{formatEditorialDate(art.createdAt)}</span>
                      {' · '}
                      <span>约 {estimateReadingTime(art.content)} 分钟</span>
                    </div>

                    <h3 className="font-serif-editorial text-xl font-semibold group-hover:text-[#687a56] transition-colors">
                      {art.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3">
                      {art.excerpt}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--border-organic)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>{art.location || profile.currentLocation || ''}</span>
                    <span className="text-[#687a56] font-medium">阅读全文 →</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. MOMENTS STREAM & TRAVEL FOOTPRINTS SPLIT SECTION */}
      {((profile.homeModules.showMoments && recentMoments.length > 0) ||
        (profile.homeModules.showTravel && recentTravels.length > 0)) && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Recent Moments */}
          {profile.homeModules.showMoments && recentMoments.length > 0 && (
            <div
              className={`${
                profile.homeModules.showTravel && recentTravels.length > 0
                  ? 'lg:col-span-7'
                  : 'lg:col-span-12'
              } space-y-5`}
            >
              <div className="flex items-end justify-between border-b border-[var(--border-organic)] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#d4a373]" />
                  <h2 className="font-serif-editorial text-2xl font-semibold">
                    {profile.sectionTitles?.homeMomentsTitle || '吉光片羽 · 最近生活瞬间'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('moments')}
                  className="text-xs font-medium text-[#687a56] hover:underline cursor-pointer"
                >
                  全部瞬间 →
                </button>
              </div>

              <div className="space-y-4">
                {recentMoments.map((mom) => (
                  <div
                    key={mom.id}
                    onClick={() => onNavigate('moments')}
                    className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-colors cursor-pointer space-y-2.5"
                  >
                    <div className="text-xs text-[var(--text-muted)]">
                      {formatEditorialDate(mom.createdAt)}
                      {mom.weather ? ` · ${mom.weather}` : ''}
                      {mom.location ? ` · ${mom.location}` : ''}
                    </div>
                    <p className="text-sm leading-relaxed">{mom.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Travel Footprints Preview */}
          {profile.homeModules.showTravel && recentTravels.length > 0 && (
            <div
              className={`${
                profile.homeModules.showMoments && recentMoments.length > 0
                  ? 'lg:col-span-5'
                  : 'lg:col-span-12'
              } space-y-5`}
            >
              <div className="flex items-end justify-between border-b border-[var(--border-organic)] pb-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#687a56]" />
                  <h2 className="font-serif-editorial text-2xl font-semibold">
                    {profile.sectionTitles?.homeTravelTitle || '远行足迹 · 山海手卷'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('travel')}
                  className="text-xs font-medium text-[#687a56] hover:underline cursor-pointer"
                >
                  展开行旅地图 →
                </button>
              </div>

              <div className="space-y-4">
                {recentTravels.map((trv) => (
                  <div
                    key={trv.id}
                    onClick={() => onNavigate('travel')}
                    className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-all cursor-pointer flex items-center gap-4"
                  >
                    <img
                      src={trv.coverImage}
                      alt={trv.destination}
                      loading="lazy"
                      className="w-20 h-20 rounded-xl object-cover shrink-0 border border-[var(--border-organic)]"
                    />
                    <div className="space-y-1">
                      <span className="text-[11px] text-[#687a56] font-medium">
                        {trv.country} · {trv.startDate}
                      </span>
                      <h3 className="font-serif-editorial text-base font-semibold">
                        {trv.destination}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                        {trv.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. GALLERY & CURATED COLLECTIONS PREVIEW */}
      {profile.homeModules.showGallery && recentAlbums.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between border-b border-[var(--border-organic)] pb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#687a56]" />
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold">
                {profile.sectionTitles?.homeGalleryTitle || '光影相册 · 四季定格'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('gallery')}
              className="text-xs font-medium text-[#687a56] hover:underline cursor-pointer"
            >
              进入相册画廊 →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentAlbums.map((album) => (
              <div
                key={album.id}
                onClick={() => onNavigate('gallery')}
                className="group rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] overflow-hidden hover:border-[#8b9d77] transition-all cursor-pointer"
              >
                <div className="h-52 overflow-hidden">
                  <img
                    src={album.coverImage}
                    alt={album.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5 space-y-1.5">
                  <div className="text-xs text-[var(--text-muted)]">
                    {album.category} · {album.location} · {album.photos.length} 帧
                  </div>
                  <h3 className="font-serif-editorial text-lg font-semibold">
                    {album.title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                    {album.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. CURATED COLLECTIONS SHELF */}
      {profile.homeModules.showCollections && favoriteCollections.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between border-b border-[var(--border-organic)] pb-4">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#d4a373]" />
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold">
                {profile.sectionTitles?.homeCollectionsTitle || '器物与书影 · 兴趣收藏精选'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('collections')}
              className="text-xs font-medium text-[#687a56] hover:underline cursor-pointer"
            >
              浏览全部收藏 →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {favoriteCollections.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate('collections')}
                className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="space-y-3">
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-36 object-cover rounded-xl border border-[var(--border-organic)]"
                  />
                  <div>
                    <span className="text-[11px] text-[#687a56] font-medium">
                      {item.categoryLabel} · {item.creator}
                    </span>
                    <h3 className="font-serif-editorial text-base font-semibold mt-0.5 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                      {item.review}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-[#d4a373] tracking-widest pt-1">
                  {'★'.repeat(item.rating)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
