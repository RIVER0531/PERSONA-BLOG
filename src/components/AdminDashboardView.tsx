import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Download,
  Upload,
  Plus,
  Edit3,
  Trash2,
  Globe,
  Lock,
  FileText,
  CheckCircle2,
  Settings,
  Database,
  BookOpen,
  Sparkles,
  LogOut,
} from 'lucide-react';
import type {
  GardenDatabase,
  Article,
  VisibilityStatus,
  SiteProfile,
} from '../types/garden';
import {
  exportGardenBackup,
  importGardenBackup,
  updateAdminPassword,
} from '../utils/api';
import { formatEditorialDate } from '../utils/gardenLogic';

interface AdminDashboardViewProps {
  garden: GardenDatabase;
  isAdmin: boolean;
  onLogin: (password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onNewArticle: () => void;
  onEditArticle: (article: Article) => void;
  onUpdateArticleStatus: (id: string, status: VisibilityStatus) => Promise<void>;
  onDeleteArticle: (id: string) => Promise<void>;
  onDeleteMoment: (id: string) => Promise<void>;
  onUpdateProfile: (profile: Partial<SiteProfile>) => Promise<void>;
  onRestoreBackupSuccess: (restored: GardenDatabase) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  garden,
  isAdmin,
  onLogin,
  onLogout,
  onNewArticle,
  onEditArticle,
  onUpdateArticleStatus,
  onDeleteArticle,
  onDeleteMoment,
  onUpdateProfile,
  onRestoreBackupSuccess,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'articles' | 'moments' | 'homeConfig' | 'backup'
  >('articles');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Home & Site config state
  const [gardenName, setGardenName] = useState(garden.profile.gardenName);
  const [heroTitle, setHeroTitle] = useState(garden.profile.heroTitle);
  const [heroIntro, setHeroIntro] = useState(garden.profile.heroIntro);
  const [heroQuote, setHeroQuote] = useState(garden.profile.heroQuote);
  const [seasonNote, setSeasonNote] = useState(garden.profile.seasonNote);
  const [homeModules, setHomeModules] = useState(garden.profile.homeModules);

  // Password change state
  const [currPw, setCurrPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const restoreFileRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  // --- LOGIN GATE FOR UNLOCKING GARDEN ADMIN ---
  if (!isAdmin) {
    const handleLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      setIsLoggingIn(true);
      try {
        await onLogin(passwordInput);
        setPasswordInput('');
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : '登录验证失败');
      } finally {
        setIsLoggingIn(false);
      }
    };

    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
        <div className="p-8 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-6 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#8b9d77]/20 flex items-center justify-center text-[#687a56]">
            <KeyRound className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h1 className="font-serif-editorial text-2xl font-semibold">
              园主身份验证 · 进入花园后台
            </h1>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              这里是个人数字花园的管理中枢。验证园主密钥后，即可使用所见即所得编辑器撰文、管理草稿与私密内容、配置首页以及导出全站备份。
            </p>
          </div>

          {loginError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[#b55346]/15 border border-[#b55346] text-xs text-[#b55346]"
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-xs text-[var(--text-muted)] mb-1.5"
              >
                园主管理密钥
              </label>
              <input
                id="admin-password-input"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="请输入园主密钥"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] text-sm focus:outline-none focus:border-[#8b9d77]"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-2">
                提示：初始默认园主密钥为 <code className="font-mono text-[#687a56]">garden2026</code>（登录后可在安全设置中修改）。
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-sm font-medium hover:bg-[#586947] transition-colors cursor-pointer"
            >
              {isLoggingIn ? '正在验证密钥…' : '开启花园后台'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const publicCount = garden.articles.filter((a) => a.status === 'public').length;
  const privateCount = garden.articles.filter((a) => a.status === 'private').length;
  const draftCount = garden.articles.filter((a) => a.status === 'draft').length;

  const handleSaveHomeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      gardenName: gardenName.trim(),
      heroTitle: heroTitle.trim(),
      heroIntro: heroIntro.trim(),
      heroQuote: heroQuote.trim(),
      seasonNote: seasonNote.trim(),
      homeModules,
    });
    notify('首页文案与模块显示配置已保存并即时生效');
  };

  const handleRestoreFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const text = await files[0].text();
      const parsed = JSON.parse(text) as GardenDatabase;
      const restored = await importGardenBackup(parsed);
      onRestoreBackupSuccess(restored);
      notify('全站数据备份已成功恢复！');
    } catch (err) {
      notify(err instanceof Error ? err.message : '备份文件解析或恢复失败');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Top Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--border-organic)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#687a56] font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>园主已认证 · 服务端持久化已连接</span>
          </div>
          <h1 className="font-serif-editorial text-3xl font-semibold">
            栖迟园 · 内容管理与长期备份中心
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onNewArticle}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium hover:bg-[#586947] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>写新文章</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await exportGardenBackup();
              notify('已生成并下载完整花园 JSON 数据备份');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-xs font-medium hover:border-[#8b9d77] cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#687a56]" />
            <span>一键导出全站数据</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-organic)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>退出管理</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          role="status"
          className="p-4 rounded-xl bg-[#8b9d77]/20 border border-[#687a56] text-xs font-medium flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-[#687a56]" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Overview Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
          <span className="text-xs text-[var(--text-muted)]">公开文章</span>
          <p className="font-serif-editorial text-2xl font-semibold mt-1">{publicCount} 篇</p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
          <span className="text-xs text-[var(--text-muted)]">私人手札</span>
          <p className="font-serif-editorial text-2xl font-semibold mt-1 text-[#d4a373]">
            {privateCount} 篇
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
          <span className="text-xs text-[var(--text-muted)]">未发草稿</span>
          <p className="font-serif-editorial text-2xl font-semibold mt-1">{draftCount} 篇</p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
          <span className="text-xs text-[var(--text-muted)]">日常瞬间</span>
          <p className="font-serif-editorial text-2xl font-semibold mt-1">
            {garden.moments.length} 条
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
          <span className="text-xs text-[var(--text-muted)]">相册 / 足迹 / 收藏</span>
          <p className="font-serif-editorial text-2xl font-semibold mt-1">
            {garden.albums.length + garden.travels.length + garden.collections.length} 项
          </p>
        </div>
      </div>

      {/* Admin Section Tabs */}
      <div
        role="tablist"
        aria-label="后台管理模块切换"
        className="flex flex-wrap gap-2 border-b border-[var(--border-organic)] pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'articles'}
          onClick={() => setActiveTab('articles')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${
            activeTab === 'articles'
              ? 'bg-[#687a56] text-[#faf6f1]'
              : 'bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-[var(--text-muted)]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>文章与草稿管理 ({garden.articles.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'moments'}
          onClick={() => setActiveTab('moments')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${
            activeTab === 'moments'
              ? 'bg-[#687a56] text-[#faf6f1]'
              : 'bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-[var(--text-muted)]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>日常瞬间管理 ({garden.moments.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'homeConfig'}
          onClick={() => setActiveTab('homeConfig')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${
            activeTab === 'homeConfig'
              ? 'bg-[#687a56] text-[#faf6f1]'
              : 'bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-[var(--text-muted)]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>首页文案与模块布局</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'backup'}
          onClick={() => setActiveTab('backup')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-[#687a56] text-[#faf6f1]'
              : 'bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-[var(--text-muted)]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>数据备份、恢复与安全</span>
        </button>
      </div>

      {/* TAB 1: ARTICLES & DRAFTS MANAGEMENT */}
      {activeTab === 'articles' && (
        <div className="space-y-4">
          {garden.articles.map((art) => (
            <div
              key={art.id}
              className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-x-2">
                  <span className="font-medium text-[var(--text-primary)]">{art.category}</span>
                  <span>·</span>
                  <span>{formatEditorialDate(art.createdAt)}</span>
                  <span>·</span>
                  {art.status === 'public' && (
                    <span className="inline-flex items-center gap-1 text-[#687a56] font-medium">
                      <Globe className="w-3 h-3" /> 公开
                    </span>
                  )}
                  {art.status === 'private' && (
                    <span className="inline-flex items-center gap-1 text-[#d4a373] font-medium">
                      <Lock className="w-3 h-3" /> 私人手札
                    </span>
                  )}
                  {art.status === 'draft' && (
                    <span className="inline-flex items-center gap-1 text-[var(--text-muted)] font-medium">
                      <FileText className="w-3 h-3" /> 草稿
                    </span>
                  )}
                </div>

                <h3 className="font-serif-editorial text-lg font-semibold">
                  {art.title}
                </h3>
                <p className="text-xs text-[var(--text-muted)] line-clamp-1">
                  {art.excerpt}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  aria-label={`修改文章 ${art.title} 的可见状态`}
                  value={art.status}
                  onChange={async (e) => {
                    const nextStatus = e.target.value as VisibilityStatus;
                    await onUpdateArticleStatus(art.id, nextStatus);
                    notify(`已将《${art.title}》状态设为 ${nextStatus}`);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                >
                  <option value="public">设为公开</option>
                  <option value="private">设为私人</option>
                  <option value="draft">移至草稿</option>
                </select>

                <button
                  type="button"
                  onClick={() => onEditArticle(art)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>继续编辑</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteArticle(art.id);
                    notify(`已删除文章《${art.title}》`);
                  }}
                  className="p-1.5 rounded-xl border border-[var(--border-organic)] hover:text-[#b55346] cursor-pointer"
                  aria-label={`删除 ${art.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: MOMENTS MANAGEMENT */}
      {activeTab === 'moments' && (
        <div className="space-y-3">
          {garden.moments.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="text-xs text-[var(--text-muted)]">
                  {formatEditorialDate(m.createdAt)} ·{' '}
                  {m.status === 'private' ? '私人瞬间' : '公开瞬间'}
                </div>
                <p className="text-sm line-clamp-2">{m.content}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteMoment(m.id);
                  notify('已删除该条瞬间');
                }}
                className="p-2 rounded-xl border border-[var(--border-organic)] hover:text-[#b55346] cursor-pointer"
                aria-label="删除瞬间"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: HOMEPAGE CONFIGURATION */}
      {activeTab === 'homeConfig' && (
        <form
          onSubmit={handleSaveHomeConfig}
          className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-5"
        >
          <h2 className="font-serif-editorial text-xl font-semibold">
            自定义首页门面文案与模块开关
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">数字花园名称</label>
              <input
                type="text"
                value={gardenName}
                onChange={(e) => setGardenName(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                节气与生活状态栏（首页顶部展示）
              </label>
              <input
                type="text"
                value={seasonNote}
                onChange={(e) => setSeasonNote(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">首页主视觉标题</label>
            <input
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">首页欢迎导语</label>
            <textarea
              rows={2}
              value={heroIntro}
              onChange={(e) => setHeroIntro(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">花园寄语引用</label>
            <input
              type="text"
              value={heroQuote}
              onChange={(e) => setHeroQuote(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div className="pt-2">
            <span className="block text-xs text-[var(--text-muted)] mb-3">
              首页板块显示开关：
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {(
                [
                  { key: 'showFeaturedArticles', label: '精选与最新文章模块' },
                  { key: 'showMoments', label: '最近生活瞬间模块' },
                  { key: 'showGallery', label: '光影相册预览模块' },
                  { key: 'showTravel', label: '远行足迹预览模块' },
                  { key: 'showCollections', label: '器物与收藏预览模块' },
                  { key: 'showAlmanac', label: '节气生活手历卡片' },
                ] as const
              ).map((mod) => (
                <label
                  key={mod.key}
                  className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={homeModules[mod.key]}
                    onChange={(e) =>
                      setHomeModules({
                        ...homeModules,
                        [mod.key]: e.target.checked,
                      })
                    }
                    className="accent-[#687a56]"
                  />
                  <span>{mod.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
            >
              保存首页配置
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: DATA BACKUP, MIGRATION & SECURITY */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
            <h3 className="font-serif-editorial text-xl font-semibold">
              完整数据导出与恢复迁移
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              所有文章、草稿、瞬间、相册、旅行足迹与兴趣收藏均采用开放的结构化 JSON 格式持久化保存在服务端。你可以随时导出完整备份，长期保存或迁移至任何平台。
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  await exportGardenBackup();
                  notify('完整花园数据备份已下载');
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>下载完整 JSON 备份包</span>
              </button>

              <button
                type="button"
                onClick={() => restoreFileRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-organic)] text-xs font-medium hover:border-[#8b9d77] cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#d4a373]" />
                <span>从备份 JSON 恢复数据</span>
              </button>
              <input
                ref={restoreFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => handleRestoreFileChange(e.target.files)}
              />
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await updateAdminPassword(currPw, newPw);
                notify(res.message);
                setCurrPw('');
                setNewPw('');
              } catch (err) {
                notify(err instanceof Error ? err.message : '修改密钥失败');
              }
            }}
            className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4"
          >
            <h3 className="font-serif-editorial text-xl font-semibold">
              修改园主管理密钥
            </h3>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">当前密钥</label>
              <input
                type="password"
                required
                value={currPw}
                onChange={(e) => setCurrPw(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">新园主密钥</label>
              <input
                type="password"
                required
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#5c4033] text-[#faf6f1] text-xs font-medium cursor-pointer"
            >
              更新管理密钥
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
