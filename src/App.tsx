import React, { useState, useEffect, useCallback } from 'react';
import {
  Leaf,
  Search,
  Sun,
  Moon,
  Feather,
  Shield,
  Menu,
  X,
  ArrowRight,
  Lock,
} from 'lucide-react';
import type {
  GardenDatabase,
  Article,
  Moment,
  Album,
  TravelFootprint,
  CollectionItem,
  SiteProfile,
  TimelineEvent,
  VisibilityStatus,
} from './types/garden';
import { SEED_GARDEN_DATABASE } from './data/seedGarden';
import {
  fetchGardenData,
  loginAdmin,
  logoutAdmin,
  updateSiteProfile,
  createArticleApi,
  updateArticleApi,
  deleteArticleApi,
  createMomentApi,
  updateMomentApi,
  deleteMomentApi,
  createAlbumApi,
  updateAlbumApi,
  deleteAlbumApi,
  createTravelApi,
  deleteTravelApi,
  createCollectionApi,
  deleteCollectionApi,
} from './utils/api';
import { searchGardenContent } from './utils/gardenLogic';
import { HomeView } from './components/HomeView';
import { ArticlesView } from './components/ArticlesView';
import { WysiwygEditor } from './components/WysiwygEditor';
import { MomentsView } from './components/MomentsView';
import { GalleryView } from './components/GalleryView';
import { TravelView } from './components/TravelView';
import { CollectionsView } from './components/CollectionsView';
import { TimelineView } from './components/TimelineView';
import { AboutView } from './components/AboutView';
import { AdminDashboardView } from './components/AdminDashboardView';

type ActivePage =
  | 'home'
  | 'articles'
  | 'editor'
  | 'moments'
  | 'gallery'
  | 'travel'
  | 'collections'
  | 'timeline'
  | 'about'
  | 'admin';

export default function App() {
  const [garden, setGarden] = useState<GardenDatabase>(SEED_GARDEN_DATABASE);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  // Theme & Search modal & Mobile menu states
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const loadFromServer = useCallback(async () => {
    try {
      const data = await fetchGardenData();
      setGarden(data.garden);
      setIsAdmin(data.isAdmin);
    } catch (err) {
      console.error('Failed to fetch from server, using initial garden state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromServer();
    // Check URL query param `?article=...`
    const params = new URLSearchParams(window.location.search);
    const articleParam = params.get('article');
    if (articleParam) {
      setSelectedArticleId(articleParam);
      setActivePage('articles');
    }
  }, [loadFromServer]);

  // Apply Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Keyboard shortcut Cmd/Ctrl + K for global search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
      if (e.key === 'Escape' && showSearchModal) {
        setShowSearchModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSearchModal]);

  // Dynamic Document Title for SEO
  useEffect(() => {
    const baseName = `${garden.profile.gardenName} · 个人数字花园`;
    if (activePage === 'articles' && selectedArticleId) {
      const art = garden.articles.find((a) => a.id === selectedArticleId);
      if (art) {
        document.title = `${art.title} | ${baseName}`;
        return;
      }
    }
    const pageNames: Record<ActivePage, string> = {
      home: baseName,
      articles: `文章总集 | ${baseName}`,
      editor: `可视化写作工坊 | ${baseName}`,
      moments: `日常瞬间 | ${baseName}`,
      gallery: `光影相册 | ${baseName}`,
      travel: `远行足迹 | ${baseName}`,
      collections: `兴趣收藏 | ${baseName}`,
      timeline: `岁月时间线 | ${baseName}`,
      about: `关于园主 | ${baseName}`,
      admin: `花园后台管理 | ${baseName}`,
    };
    document.title = pageNames[activePage] || baseName;
  }, [activePage, selectedArticleId, garden]);

  const navigateTo = (page: ActivePage) => {
    if (page !== 'articles') {
      setSelectedArticleId(null);
    }
    if (page === 'editor' && !editingArticle) {
      setEditingArticle(null);
    }
    setActivePage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenArticle = (id: string) => {
    setSelectedArticleId(id);
    setActivePage('articles');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- ADMIN AUTH HANDLERS ---
  const handleLogin = async (password: string) => {
    await loginAdmin(password);
    await loadFromServer();
  };

  const handleLogout = async () => {
    await logoutAdmin();
    await loadFromServer();
    setActivePage('home');
  };

  // --- CRUD HANDLERS ---
  const handleSaveArticleFromEditor = async (
    articleData: Partial<Article>,
    isAutoSave = false
  ): Promise<Article> => {
    const exists = garden.articles.some((a) => a.id === articleData.id);
    const saved = exists
      ? await updateArticleApi(articleData.id!, articleData)
      : await createArticleApi(articleData);

    if (!isAutoSave) {
      await loadFromServer();
    } else {
      setGarden((prev) => {
        const idx = prev.articles.findIndex((a) => a.id === saved.id);
        if (idx === -1) {
          return { ...prev, articles: [saved, ...prev.articles] };
        }
        const copy = [...prev.articles];
        copy[idx] = saved;
        return { ...prev, articles: copy };
      });
    }
    return saved;
  };

  const handleDeleteArticle = async (id: string) => {
    await deleteArticleApi(id);
    await loadFromServer();
  };

  const handleUpdateArticleStatus = async (
    id: string,
    status: VisibilityStatus
  ) => {
    await updateArticleApi(id, { status });
    await loadFromServer();
  };

  const handleCreateMoment = async (data: Partial<Moment>) => {
    await createMomentApi(data);
    await loadFromServer();
  };

  const handleUpdateMoment = async (id: string, data: Partial<Moment>) => {
    await updateMomentApi(id, data);
    await loadFromServer();
  };

  const handleDeleteMoment = async (id: string) => {
    await deleteMomentApi(id);
    await loadFromServer();
  };

  const handleCreateAlbum = async (album: Partial<Album>) => {
    await createAlbumApi(album);
    await loadFromServer();
  };

  const handleUpdateAlbum = async (id: string, album: Partial<Album>) => {
    await updateAlbumApi(id, album);
    await loadFromServer();
  };

  const handleDeleteAlbum = async (id: string) => {
    await deleteAlbumApi(id);
    await loadFromServer();
  };

  const handleCreateTravel = async (travel: Partial<TravelFootprint>) => {
    await createTravelApi(travel);
    await loadFromServer();
  };

  const handleDeleteTravel = async (id: string) => {
    await deleteTravelApi(id);
    await loadFromServer();
  };

  const handleCreateCollection = async (item: Partial<CollectionItem>) => {
    await createCollectionApi(item);
    await loadFromServer();
  };

  const handleDeleteCollection = async (id: string) => {
    await deleteCollectionApi(id);
    await loadFromServer();
  };

  const handleUpdateProfile = async (profileUpdate: Partial<SiteProfile>) => {
    await updateSiteProfile(profileUpdate);
    await loadFromServer();
  };

  const handleTimelineNavigate = (ev: TimelineEvent) => {
    if (ev.type === 'article') {
      handleOpenArticle(ev.sourceId);
    } else if (ev.type === 'moment') {
      navigateTo('moments');
    } else if (ev.type === 'travel') {
      navigateTo('travel');
    } else if (ev.type === 'collection') {
      navigateTo('collections');
    } else if (ev.type === 'album') {
      navigateTo('gallery');
    }
  };

  const searchResults = searchGardenContent(garden, globalSearchQuery, isAdmin);

  const navItems: Array<{ id: ActivePage; label: string }> = [
    { id: 'home', label: '首页' },
    { id: 'articles', label: '文章' },
    { id: 'moments', label: '瞬间' },
    { id: 'gallery', label: '相册' },
    { id: 'travel', label: '足迹' },
    { id: 'collections', label: '收藏' },
    { id: 'timeline', label: '时间线' },
    { id: 'about', label: '关于' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Top Natural Organic Navigation Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border-organic)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2.5 sm:gap-3 text-left group cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-[#687a56] text-[#faf6f1] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif-editorial text-lg sm:text-xl font-semibold tracking-tight block leading-none whitespace-nowrap">
                {garden.profile.gardenName}
              </span>
              <span className="hidden sm:block text-[11px] text-[var(--text-muted)] mt-0.5 whitespace-nowrap">
                Personal Digital Garden
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="主导航"
            className="hidden lg:flex items-center gap-1"
          >
            {navItems.map((item) => {
              const isActive =
                activePage === item.id &&
                !(item.id === 'articles' && activePage === 'editor');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'articles') setSelectedArticleId(null);
                    navigateTo(item.id);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#8b9d77]/20 text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Utility Controls */}
          <div className="flex items-center gap-2">
            {/* Global Search Button */}
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              aria-label="全站搜索"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)] hover:border-[#8b9d77] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">搜索花园</span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? '切换为浅色模式' : '切换为深色模式'}
              className="p-2 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[#8b9d77] transition-colors cursor-pointer"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#deb083]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Quick Write Button (when Admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  navigateTo('editor');
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium hover:bg-[#586947] transition-colors cursor-pointer"
              >
                <Feather className="w-3.5 h-3.5" />
                <span>写文章</span>
              </button>
            )}

            {/* Admin Portal Button */}
            <button
              type="button"
              onClick={() => navigateTo('admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activePage === 'admin' || isAdmin
                  ? 'border-[#687a56] bg-[#8b9d77]/15 text-[var(--text-primary)]'
                  : 'border-[var(--border-organic)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-[#687a56]" />
              <span>{isAdmin ? '花园后台' : '园主登录'}</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="展开移动端导航菜单"
              className="lg:hidden p-2 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <nav
            aria-label="移动端导航"
            className="lg:hidden px-4 pt-2 pb-5 bg-[var(--bg-elevated)] border-b border-[var(--border-organic)] grid grid-cols-4 gap-2"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'articles') setSelectedArticleId(null);
                  navigateTo(item.id);
                }}
                className={`py-2.5 rounded-xl text-xs font-medium text-center cursor-pointer ${
                  activePage === item.id
                    ? 'bg-[#687a56] text-[#faf6f1]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-organic)]'
                }`}
              >
                {item.label}
              </button>
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  navigateTo('editor');
                }}
                className="col-span-4 py-2.5 rounded-xl bg-[#d4a373]/20 border border-[#d4a373] text-xs font-medium text-center"
              >
                + 提笔写新文章（可视化编辑器）
              </button>
            )}
          </nav>
        )}
      </header>

      {/* Main Content View */}
      <main className="flex-1">
        {isLoading ? (
          <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#687a56] border-t-transparent animate-spin mx-auto" />
            <p className="font-serif-editorial text-sm text-[var(--text-muted)]">
              正在推开栖迟园的木门……
            </p>
          </div>
        ) : (
          <>
            {activePage === 'home' && (
              <HomeView
                garden={garden}
                isAdmin={isAdmin}
                onNavigate={navigateTo}
                onOpenArticle={handleOpenArticle}
              />
            )}

            {activePage === 'articles' && (
              <ArticlesView
                articles={garden.articles}
                categories={garden.customCategories.articleCategories}
                selectedArticleId={selectedArticleId}
                isAdmin={isAdmin}
                onSelectArticle={(id) => setSelectedArticleId(id)}
                onNewArticle={() => {
                  setEditingArticle(null);
                  navigateTo('editor');
                }}
                onEditArticle={(art) => {
                  setEditingArticle(art);
                  navigateTo('editor');
                }}
                onDeleteArticle={handleDeleteArticle}
              />
            )}

            {activePage === 'editor' && (
              <WysiwygEditor
                initialArticle={editingArticle}
                categories={garden.customCategories.articleCategories}
                onSave={handleSaveArticleFromEditor}
                onCancel={() => navigateTo('articles')}
                onPublishSuccess={(saved) => {
                  setSelectedArticleId(saved.id);
                  setActivePage('articles');
                }}
              />
            )}

            {activePage === 'moments' && (
              <MomentsView
                moments={garden.moments}
                isAdmin={isAdmin}
                onCreateMoment={handleCreateMoment}
                onUpdateMoment={handleUpdateMoment}
                onDeleteMoment={handleDeleteMoment}
              />
            )}

            {activePage === 'gallery' && (
              <GalleryView
                albums={garden.albums}
                isAdmin={isAdmin}
                onCreateAlbum={handleCreateAlbum}
                onUpdateAlbum={handleUpdateAlbum}
                onDeleteAlbum={handleDeleteAlbum}
              />
            )}

            {activePage === 'travel' && (
              <TravelView
                travels={garden.travels}
                articles={garden.articles}
                albums={garden.albums}
                isAdmin={isAdmin}
                onCreateTravel={handleCreateTravel}
                onDeleteTravel={handleDeleteTravel}
                onOpenArticle={handleOpenArticle}
                onOpenGallery={() => navigateTo('gallery')}
              />
            )}

            {activePage === 'collections' && (
              <CollectionsView
                collections={garden.collections}
                categories={garden.customCategories.collectionCategories}
                isAdmin={isAdmin}
                onCreateCollection={handleCreateCollection}
                onDeleteCollection={handleDeleteCollection}
              />
            )}

            {activePage === 'timeline' && (
              <TimelineView
                garden={garden}
                isAdmin={isAdmin}
                onNavigateEvent={handleTimelineNavigate}
              />
            )}

            {activePage === 'about' && (
              <AboutView
                profile={garden.profile}
                isAdmin={isAdmin}
                onUpdateProfile={handleUpdateProfile}
              />
            )}

            {activePage === 'admin' && (
              <AdminDashboardView
                garden={garden}
                isAdmin={isAdmin}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onNewArticle={() => {
                  setEditingArticle(null);
                  navigateTo('editor');
                }}
                onEditArticle={(art) => {
                  setEditingArticle(art);
                  navigateTo('editor');
                }}
                onUpdateArticleStatus={handleUpdateArticleStatus}
                onDeleteArticle={handleDeleteArticle}
                onDeleteMoment={handleDeleteMoment}
                onUpdateProfile={handleUpdateProfile}
                onRestoreBackupSuccess={(restored) => setGarden(restored)}
              />
            )}
          </>
        )}
      </main>

      {/* Organic Footer */}
      <footer className="mt-20 border-t border-[var(--border-organic)] bg-[var(--bg-elevated)]/60 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-[#687a56]" />
            <span className="font-serif-editorial font-medium text-[var(--text-primary)]">
              {garden.profile.gardenName}
            </span>
            <span>·</span>
            <span>{garden.profile.signature.slice(0, 26)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo('timeline')}
              className="hover:text-[var(--text-primary)] cursor-pointer"
            >
              全站时间线
            </button>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text-primary)]"
            >
              站点地图 Sitemap
            </a>
            <button
              type="button"
              onClick={() => navigateTo('admin')}
              className="hover:text-[var(--text-primary)] cursor-pointer"
            >
              {isAdmin ? '后台与数据备份' : '园主入口'}
            </button>
          </div>
        </div>
      </footer>

      {/* Global Search Modal */}
      {showSearchModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="全站内容搜索"
          className="fixed inset-0 z-50 bg-black/45 flex items-start justify-center pt-16 sm:pt-24 p-4"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-organic)] flex items-center gap-3">
              <Search className="w-4 h-4 text-[#687a56]" />
              <input
                type="search"
                autoFocus
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="搜索文章、瞬间、远行目的地、相册或收藏好物…"
                aria-label="全站搜索输入框"
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              <button
                type="button"
                aria-label="关闭搜索"
                onClick={() => setShowSearchModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-4 space-y-2">
              {!globalSearchQuery.trim() ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-8">
                  输入关键词（如：京都、咖啡、键盘、瓦尔登湖）即可检索整座数字花园
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-8">
                  未找到与「{globalSearchQuery}」相关的记录
                </p>
              ) : (
                searchResults.map((res) => (
                  <button
                    key={`${res.type}-${res.id}`}
                    type="button"
                    onClick={() => {
                      setShowSearchModal(false);
                      if (res.type === 'article') {
                        handleOpenArticle(res.id);
                      } else if (res.type === 'moment') {
                        navigateTo('moments');
                      } else if (res.type === 'travel') {
                        navigateTo('travel');
                      } else if (res.type === 'collection') {
                        navigateTo('collections');
                      } else if (res.type === 'album') {
                        navigateTo('gallery');
                      }
                    }}
                    className="w-full text-left p-3.5 rounded-xl hover:bg-[var(--bg-muted)] transition-colors flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="text-[11px] text-[#687a56] font-medium flex items-center gap-2">
                        <span>{res.typeLabel}</span>
                        {res.status === 'private' && (
                          <span className="inline-flex items-center gap-0.5 text-[#d4a373]">
                            <Lock className="w-3 h-3" /> 私人
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif-editorial text-base font-medium">
                        {res.title}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1">
                        {res.snippet}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
