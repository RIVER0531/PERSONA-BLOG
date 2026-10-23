import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Cloud,
  FileArchive,
  AlertTriangle,
  RefreshCw,
  FlaskConical,
} from 'lucide-react';
import type {
  GardenDatabase,
  Article,
  VisibilityStatus,
  SiteProfile,
  SiteSectionTitles,
} from '../types/garden';
import type { BackupInspectionResult } from '../utils/backupEngine';
import {
  exportFullZipBackup,
  inspectZipBackupFile,
  restoreZipBackupFile,
  fetchStorageDiagnostics,
  updateAdminPassword,
  fetchAgentApiKeyInfo,
  regenerateAgentApiKey,
  type StorageDiagnosticsResponse,
  type RestoreZipResponse,
  type AgentApiKeyInfo,
} from '../utils/api';
import { formatEditorialDate } from '../utils/gardenLogic';
import { buildOpenApiSpec } from '../utils/agentApi';

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
  onUpdateCategories?: (payload: {
    articleCategories?: string[];
    collectionCategories?: Array<{ id: string; label: string }>;
  }) => Promise<void>;
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
  onUpdateCategories,
  onRestoreBackupSuccess,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'homeConfig' | 'aiAgent' | 'backup' | 'articles' | 'moments'
  >('aiAgent');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Diagnostics, Backup & AI Agent states
  const [diagnostics, setDiagnostics] = useState<StorageDiagnosticsResponse | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentApiKeyInfo | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<BackupInspectionResult | null>(
    null
  );
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [sandboxReport, setSandboxReport] = useState<
    RestoreZipResponse['sandboxVerification'] | null
  >(null);

  // Full Site & Homepage config state
  const [gardenName, setGardenName] = useState(garden.profile.gardenName);
  const [gardenSubtitle, setGardenSubtitle] = useState(
    garden.profile.gardenSubtitle ?? ''
  );
  const [footerText, setFooterText] = useState(
    garden.profile.footerText !== undefined
      ? garden.profile.footerText
      : garden.profile.signature
  );
  const [heroTitle, setHeroTitle] = useState(garden.profile.heroTitle);
  const [heroIntro, setHeroIntro] = useState(garden.profile.heroIntro);
  const [heroQuote, setHeroQuote] = useState(garden.profile.heroQuote);
  const [seasonNote, setSeasonNote] = useState(garden.profile.seasonNote);
  const [homeModules, setHomeModules] = useState(garden.profile.homeModules);
  const [sectionTitles, setSectionTitles] = useState<SiteSectionTitles>(
    garden.profile.sectionTitles || {}
  );

  // Custom categories state
  const [articleCategories, setArticleCategories] = useState<string[]>(
    garden.customCategories.articleCategories
  );
  const [newArtCat, setNewArtCat] = useState('');
  const [collectionCategories, setCollectionCategories] = useState<
    Array<{ id: string; label: string }>
  >(garden.customCategories.collectionCategories);
  const [newColCatId, setNewColCatId] = useState('');
  const [newColCatLabel, setNewColCatLabel] = useState('');

  useEffect(() => {
    setGardenName(garden.profile.gardenName);
    setGardenSubtitle(garden.profile.gardenSubtitle ?? '');
    setFooterText(
      garden.profile.footerText !== undefined
        ? garden.profile.footerText
        : garden.profile.signature
    );
    setHeroTitle(garden.profile.heroTitle);
    setHeroIntro(garden.profile.heroIntro);
    setHeroQuote(garden.profile.heroQuote);
    setSeasonNote(garden.profile.seasonNote);
    setHomeModules(garden.profile.homeModules);
    setSectionTitles(garden.profile.sectionTitles || {});
    setArticleCategories(garden.customCategories.articleCategories);
    setCollectionCategories(garden.customCategories.collectionCategories);
  }, [garden.profile, garden.customCategories]);

  // Password change state
  const [currPw, setCurrPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const zipInputRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string) => {
    setErrorMsg('');
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 6000);
  };

  const notifyError = (msg: string) => {
    setFeedbackMsg('');
    setErrorMsg(msg);
  };

  const refreshDiagnostics = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [diag, aiInfo] = await Promise.all([
        fetchStorageDiagnostics(),
        fetchAgentApiKeyInfo(),
      ]);
      setDiagnostics(diag);
      setAgentInfo(aiInfo);
    } catch {
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    refreshDiagnostics();
  }, [refreshDiagnostics, garden]);

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
              这里是个人数字花园的管理中枢。验证园主密钥后，即可自定义全站顶部/底部文字与各个板块标题、使用可视化编辑器撰文、管理草稿与私密内容，以及导出/恢复全站 ZIP 备份包。
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

  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      const { filename, sizeBytes } = await exportFullZipBackup();
      const kb = (sizeBytes / 1024).toFixed(1);
      notify(`已生成并下载完整 ZIP 备份包：${filename} (${kb} KB，含结构化 JSON 与原始图片文件)`);
      await refreshDiagnostics();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '导出 ZIP 备份失败');
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleSelectZipFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedZipFile(file);
    setInspectionResult(null);
    setSandboxReport(null);
    setConfirmOverwrite(false);
    setIsInspecting(true);
    setErrorMsg('');
    try {
      const result = await inspectZipBackupFile(file);
      setInspectionResult(result);
      if (!result.valid || !result.compatible) {
        notifyError(result.error || '备份包预检未通过');
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '读取或校验 ZIP 备份文件失败');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleRunSandboxRestore = async () => {
    if (!selectedZipFile) return;
    setIsRestoring(true);
    setErrorMsg('');
    try {
      const res = await restoreZipBackupFile(
        selectedZipFile,
        restoreMode,
        'isolated_sandbox'
      );
      setSandboxReport(res.sandboxVerification || null);
      notify('已在安全隔离沙箱环境中完成备份恢复验证，正式环境数据未受影响！');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '隔离沙箱验证失败');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRunProductionRestore = async () => {
    if (!selectedZipFile || !confirmOverwrite) return;
    setIsRestoring(true);
    setErrorMsg('');
    try {
      const res = await restoreZipBackupFile(
        selectedZipFile,
        restoreMode,
        'production'
      );
      if (res.garden) {
        onRestoreBackupSuccess(res.garden);
      }
      await refreshDiagnostics();
      notify(
        `已完成备份恢复（模式：${
          restoreMode === 'replace' ? '完整覆盖恢复' : '智能合并导入'
        }），成功还原 ${res.restoredMediaCount ?? 0} 个原始图片文件并同步至 Cloud Firestore！`
      );
      setConfirmOverwrite(false);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : '恢复备份数据失败');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSaveHomeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      gardenName: gardenName.trim() || '数字花园',
      gardenSubtitle: gardenSubtitle.trim(),
      footerText: footerText.trim(),
      heroTitle: heroTitle.trim(),
      heroIntro: heroIntro.trim(),
      heroQuote: heroQuote.trim(),
      seasonNote: seasonNote.trim(),
      homeModules,
      sectionTitles,
    });
    if (onUpdateCategories) {
      await onUpdateCategories({
        articleCategories,
        collectionCategories,
      });
    }
    notify('全站文案、顶部副标题、底部文字、各栏目名称与分类已全部保存并实时同步至云端！');
  };

  const updateSectionField = (key: keyof SiteSectionTitles, val: string) => {
    setSectionTitles((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Top Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--border-organic)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#687a56] font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>
              园主已认证 · Firebase Firestore 云端持久化已激活 (
              {diagnostics?.cloud.databaseId || 'Cloud Firestore'})
            </span>
          </div>
          <h1 className="font-serif-editorial text-3xl font-semibold">
            {garden.profile.gardenName || '数字花园'} · 全站自定义与内容管理中心
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
            disabled={isExportingZip}
            onClick={handleExportZip}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#687a56] bg-[var(--bg-elevated)] text-xs font-medium hover:bg-[#8b9d77]/15 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#687a56]" />
            <span>{isExportingZip ? '正在打包 ZIP…' : '一键下载完整 ZIP 备份包'}</span>
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
          <CheckCircle2 className="w-4 h-4 text-[#687a56] shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#b55346]/15 border border-[#b55346] text-xs font-medium text-[#b55346] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
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
          <span className="text-xs text-[var(--text-muted)]">已上传原始图片</span>
          <p className="font-serif-editorial text-2xl font-semibold mt-1 text-[#687a56]">
            {diagnostics?.localMirror.localMediaCount ?? 0} 张
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
          aria-selected={activeTab === 'aiAgent'}
          onClick={() => setActiveTab('aiAgent')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${
            activeTab === 'aiAgent'
              ? 'bg-[#687a56] text-[#faf6f1]'
              : 'bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-[var(--text-muted)]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>ChatGPT / AI 接管与 API</span>
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
          <span>全站自定义与门面配置</span>
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
          <span>数据备份与恢复</span>
        </button>

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
      </div>

      {/* TAB 1: DATA BACKUP, RESTORE & CLOUD PERSISTENCE ARCHITECTURE */}
      {activeTab === 'backup' && (
        <div className="space-y-8">
          {/* 1. Cloud Persistence & Storage Architecture Audit Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#687a56] font-medium">
                  <Cloud className="w-4 h-4" />
                  <span>双层持久化架构：Firebase Cloud Firestore + 本地写穿透镜像</span>
                </div>
                <h2 className="font-serif-editorial text-xl font-semibold">
                  当前数据持久化架构与云端状态诊断
                </h2>
              </div>

              <button
                type="button"
                onClick={refreshDiagnostics}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-organic)] text-xs hover:border-[#8b9d77] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>刷新存储状态</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1.5">
                <span className="text-[var(--text-muted)]">主云端数据库 (Firestore)</span>
                <p className="font-semibold text-[var(--text-primary)]">
                  项目：{diagnostics?.cloud.projectId || 'gen-lang-client-0753546236'}
                </p>
                <p className="text-[var(--text-muted)]">
                  实例：{diagnostics?.cloud.databaseId || 'ai-studio-6a908b50...'}
                </p>
                <p className="text-[#687a56] font-medium">
                  状态：{diagnostics?.cloud.connected ? '云端实时同步正常' : '同步就绪'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1.5">
                <span className="text-[var(--text-muted)]">原始图片与媒体持久化</span>
                <p className="font-semibold text-[var(--text-primary)]">
                  云端已存图片：{diagnostics?.cloud.cloudMediaCount ?? 0} 个原始文件
                </p>
                <p className="text-[var(--text-muted)]">
                  本地缓存镜像：/data/uploads/ ({diagnostics?.localMirror.localMediaCount ?? 0} 个文件)
                </p>
                <p className="text-[#687a56]">
                  容器重启或扩缩容时自动从 Firestore 按需回填恢复
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1.5">
                <span className="text-[var(--text-muted)]">关联关系与时间线索引</span>
                <p className="font-semibold text-[var(--text-primary)]">
                  时间线节点：{diagnostics?.counts.timelineEvents ?? 0} 处记忆
                </p>
                <p className="text-[var(--text-muted)]">
                  标签总数：{diagnostics?.relationsSummary.totalTags ?? 0} 个 · 足迹关联：{diagnostics?.relationsSummary.travelLinks ?? 0} 处
                </p>
                <p className="text-[var(--text-muted)]">
                  数据与平台完全解耦，可随时一键完整迁出
                </p>
              </div>
            </div>
          </div>

          {/* 2. Export & Restore Two-Column Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 Cols: Full ZIP Backup Export */}
            <div className="lg:col-span-5 p-6 sm:p-7 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-[#8b9d77]/20 text-[#687a56] flex items-center justify-center">
                  <FileArchive className="w-5 h-5" />
                </div>
                <h3 className="font-serif-editorial text-xl font-semibold">
                  一键导出完整 ZIP 备份包
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  将整座数字花园打包为标准独立的 <code className="font-mono">.zip</code> 归档文件。不依赖任何云端外链即可完整迁移至任意服务器或本地归档。
                </p>

                <ul className="space-y-2 text-xs text-[var(--text-body)] pt-1">
                  <li>· <strong>data/garden-data.json</strong>：全部公开文章、私人手札、草稿箱、富文本 HTML 正文、瞬间、相册、旅行与收藏。</li>
                  <li>· <strong>data/relations-and-timeline.json</strong>：分类、标签索引、旅行与游记/相册关联图谱及完整时间线。</li>
                  <li>· <strong>media/uploads/*</strong>：所有上传的原始图片、封面与插图二进制文件（非仅保存 URL）。</li>
                  <li>· <strong>manifest.json</strong>：备份时间、数据结构版本（v2）与每个文件的 SHA-256 校验清单。</li>
                  <li>· <strong>零敏感凭据保证</strong>：严格剔除管理员密码哈希、访问令牌与 API 密钥。</li>
                </ul>
              </div>

              <button
                type="button"
                disabled={isExportingZip}
                onClick={handleExportZip}
                className="w-full py-3 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs sm:text-sm font-medium hover:bg-[#586947] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isExportingZip ? '正在打包全站数据与原始图片…' : '下载完整 ZIP 备份包 (.zip)'}
                </span>
              </button>
            </div>

            {/* Right 7 Cols: Pre-Restore Inspection, Sandbox Verification & Production Restore */}
            <div className="lg:col-span-7 p-6 sm:p-7 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-5">
              <div className="space-y-1">
                <h3 className="font-serif-editorial text-xl font-semibold">
                  从 ZIP 备份包校验与恢复数据
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  上传之前导出的 <code className="font-mono">.zip</code> 备份包，系统将自动执行结构版本校验、SHA-256 完整性核对、缺失图片检测与重复数据对比。
                </p>
              </div>

              {/* Upload Trigger */}
              <div>
                <button
                  type="button"
                  onClick={() => zipInputRef.current?.click()}
                  className="w-full py-6 px-4 border-2 border-dashed border-[var(--border-organic)] hover:border-[#8b9d77] rounded-2xl text-xs text-[var(--text-muted)] flex flex-col items-center gap-2 transition-colors cursor-pointer bg-[var(--bg-primary)]/50"
                >
                  <Upload className="w-5 h-5 text-[#687a56]" />
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedZipFile
                      ? `已选择备份包：${selectedZipFile.name} (${(
                          selectedZipFile.size / 1024
                        ).toFixed(1)} KB)`
                      : '点击选择要恢复的 .zip 完整备份包'}
                  </span>
                  <span>支持备份预检、隔离沙箱演练与正式恢复</span>
                </button>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  aria-label="上传 ZIP 备份文件"
                  className="hidden"
                  onChange={(e) => handleSelectZipFile(e.target.files)}
                />
              </div>

              {isInspecting && (
                <div className="p-4 rounded-xl bg-[var(--bg-primary)] text-xs text-[var(--text-muted)]">
                  正在解析 ZIP 备份包并校验文件 SHA-256 签名与图片关联关系……
                </div>
              )}

              {/* Inspection Report Panel */}
              {inspectionResult && inspectionResult.manifest && (
                <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-organic)]">
                    <div>
                      <span className="font-serif-editorial text-sm font-semibold text-[var(--text-primary)]">
                        备份包预检报告 · 版本 v{inspectionResult.manifest.schemaVersion}
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        备份时间：{formatEditorialDate(inspectionResult.manifest.exportedAt)} ·{' '}
                        {inspectionResult.checksumVerified
                          ? 'SHA-256 文件完整性校验通过'
                          : '存在校验和警告'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-medium ${
                        inspectionResult.valid && inspectionResult.compatible
                          ? 'bg-[#8b9d77]/20 text-[#687a56]'
                          : 'bg-[#b55346]/20 text-[#b55346]'
                      }`}
                    >
                      {inspectionResult.valid && inspectionResult.compatible
                        ? '校验通过 · 可安全恢复'
                        : '版本或格式不兼容'}
                    </span>
                  </div>

                  {/* Content Counts in Backup */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
                      <span className="text-[var(--text-muted)] block">文章/草稿</span>
                      <strong className="text-sm">{inspectionResult.manifest.counts.articles}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
                      <span className="text-[var(--text-muted)] block">瞬间</span>
                      <strong className="text-sm">{inspectionResult.manifest.counts.moments}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
                      <span className="text-[var(--text-muted)] block">相册</span>
                      <strong className="text-sm">{inspectionResult.manifest.counts.albums}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
                      <span className="text-[var(--text-muted)] block">旅行足迹</span>
                      <strong className="text-sm">{inspectionResult.manifest.counts.travels}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
                      <span className="text-[var(--text-muted)] block">兴趣收藏</span>
                      <strong className="text-sm">
                        {inspectionResult.manifest.counts.collections}
                      </strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
                      <span className="text-[var(--text-muted)] block">原始图片文件</span>
                      <strong className="text-sm text-[#687a56]">
                        {inspectionResult.manifest.counts.uploadedMediaFiles}
                      </strong>
                    </div>
                  </div>

                  {/* File Inventory List */}
                  <div className="space-y-1.5">
                    <span className="font-medium text-[var(--text-primary)]">
                      备份包内文件清单 ({inspectionResult.manifest.files.length} 个文件)：
                    </span>
                    <div className="max-h-28 overflow-y-auto rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-2.5 space-y-1 font-mono text-[11px]">
                      {inspectionResult.manifest.files.map((f) => (
                        <div key={f.path} className="flex items-center justify-between gap-2">
                          <span className="truncate">{f.path}</span>
                          <span className="text-[var(--text-muted)] shrink-0">
                            {(f.sizeBytes / 1024).toFixed(1)} KB · sha256:{f.sha256.slice(0, 8)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warnings */}
                  {inspectionResult.warnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-[#d4a373]/15 border border-[#d4a373] space-y-1">
                      <span className="font-semibold text-[var(--text-primary)] block">
                        预检提示与重复项检测：
                      </span>
                      {inspectionResult.warnings.map((w, idx) => (
                        <p key={idx} className="text-[var(--text-body)]">
                          · {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Restore Mode & Confirmation Controls */}
                  {inspectionResult.valid && inspectionResult.compatible && (
                    <div className="pt-2 space-y-4 border-t border-[var(--border-organic)]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setRestoreMode('merge')}
                          className={`p-3 rounded-xl border text-left cursor-pointer ${
                            restoreMode === 'merge'
                              ? 'border-[#687a56] bg-[#8b9d77]/15'
                              : 'border-[var(--border-organic)] bg-[var(--bg-elevated)]'
                          }`}
                        >
                          <span className="font-semibold block">智能合并导入（推荐）</span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            保留当前已有内容，合并备份中的新文章、图片与关联关系
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRestoreMode('replace')}
                          className={`p-3 rounded-xl border text-left cursor-pointer ${
                            restoreMode === 'replace'
                              ? 'border-[#d4a373] bg-[#d4a373]/15'
                              : 'border-[var(--border-organic)] bg-[var(--bg-elevated)]'
                          }`}
                        >
                          <span className="font-semibold block">完整覆盖恢复</span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            将全站数据库完全还原为备份包时间点的状态并恢复所有图片
                          </span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={handleRunSandboxRestore}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#687a56] text-[#687a56] font-medium hover:bg-[#8b9d77]/15 cursor-pointer"
                        >
                          <FlaskConical className="w-4 h-4" />
                          <span>先在隔离沙箱中测试恢复</span>
                        </button>

                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmOverwrite}
                            onChange={(e) => setConfirmOverwrite(e.target.checked)}
                            className="accent-[#687a56]"
                          />
                          <span>我已核对预检清单，确认执行恢复操作</span>
                        </label>

                        <button
                          type="button"
                          disabled={!confirmOverwrite || isRestoring}
                          onClick={handleRunProductionRestore}
                          className="px-5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] font-medium disabled:opacity-45 cursor-pointer"
                        >
                          {isRestoring ? '正在恢复数据与图片…' : '确认恢复至当前网站'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sandbox Verification Result */}
                  {sandboxReport && (
                    <div
                      data-testid="sandbox-verification-report"
                      className="p-4 rounded-xl bg-[#8b9d77]/15 border border-[#687a56] space-y-1.5"
                    >
                      <div className="font-semibold text-[#687a56] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>安全隔离沙箱恢复验证通过（/data/sandbox/）</span>
                      </div>
                      <p>
                        · 成功还原文章：{sandboxReport.restoredArticlesCount} 篇 · 瞬间：
                        {sandboxReport.restoredMomentsCount} 条 · 相册：
                        {sandboxReport.restoredAlbumsCount} 本 · 足迹：
                        {sandboxReport.restoredTravelsCount} 处 · 收藏：
                        {sandboxReport.restoredCollectionsCount} 项
                      </p>
                      <p>
                        · 成功提取原始图片二进制文件 ({sandboxReport.extractedMediaFiles.length} 个)：
                        {sandboxReport.extractedMediaFiles.join(', ') || '无新增本地上传文件'}
                      </p>
                      <p>
                        · 标签与关联完整性：共恢复 {sandboxReport.totalTagsRestored} 个标签，时间线{' '}
                        {sandboxReport.timelineEventsCount} 个节点，旅行关联校验{' '}
                        {sandboxReport.travelLinksVerified ? '100% 完整' : '存在缺失'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Security Password Settings */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await updateAdminPassword(currPw, newPw);
                notify(res.message);
                setCurrPw('');
                setNewPw('');
              } catch (err) {
                notifyError(err instanceof Error ? err.message : '修改密钥失败');
              }
            }}
            className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          >
            <div className="space-y-1">
              <h3 className="font-serif-editorial text-lg font-semibold">
                修改园主管理密钥
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                管理密钥仅以 SHA-256 加盐哈希形式独立存放，绝不会写入导出的备份包中。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="password"
                required
                value={currPw}
                onChange={(e) => setCurrPw(e.target.value)}
                placeholder="当前密钥"
                aria-label="当前密钥"
                className="text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
              <input
                type="password"
                required
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="新园主密钥（至少4位）"
                aria-label="新园主密钥"
                className="text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#5c4033] text-[#faf6f1] text-xs font-medium cursor-pointer"
              >
                更新管理密钥
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: ARTICLES & DRAFTS MANAGEMENT */}
      {activeTab === 'articles' && (
        <div className="space-y-4">
          {garden.articles.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-center text-sm text-[var(--text-muted)]">
              当前暂无文章，点击右上角「写新文章」开始记录。
            </div>
          ) : (
            garden.articles.map((art) => (
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
            ))
          )}
        </div>
      )}

      {/* TAB 3: MOMENTS MANAGEMENT */}
      {activeTab === 'moments' && (
        <div className="space-y-3">
          {garden.moments.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-center text-sm text-[var(--text-muted)]">
              当前暂无日常瞬间。
            </div>
          ) : (
            garden.moments.map((m) => (
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
            ))
          )}
        </div>
      )}

      {/* TAB 4: FULL SITE CUSTOMIZATION & HOMEPAGE CONFIGURATION */}
      {activeTab === 'homeConfig' && (
        <form onSubmit={handleSaveHomeConfig} className="space-y-8">
          {/* 1. Header Brand & Footer Text Customization */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-organic)]">
              <div>
                <h2 className="font-serif-editorial text-xl font-semibold">
                  一、顶部站点名称与网页底部签名设置
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  完全自定义顶部导航栏站点名称、旁边的副标题以及网页最底部的自定义文字（留空即可直接隐藏对应项，绝不强制显示或截断）。
                </p>
              </div>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
              >
                保存全站配置
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  顶部站点名称（如：竹林）
                </label>
                <input
                  type="text"
                  value={gardenName}
                  onChange={(e) => setGardenName(e.target.value)}
                  placeholder="请输入站点名称"
                  className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  顶部站点副标题（显示在站点名右侧，留空则完全隐藏）
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gardenSubtitle}
                    onChange={(e) => setGardenSubtitle(e.target.value)}
                    placeholder="留空则不显示任何副标题"
                    className="flex-1 text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                  />
                  {gardenSubtitle && (
                    <button
                      type="button"
                      onClick={() => setGardenSubtitle('')}
                      className="px-3 py-2 rounded-xl border border-[var(--border-organic)] text-xs text-[var(--text-muted)] hover:text-[#b55346] cursor-pointer"
                    >
                      清空隐藏
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                网页底部自定义文字（完整展示不截断；留空则隐藏底部文字）
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="输入你想放在网页底部的句子，或留空隐藏"
                  className="flex-1 text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
                {footerText && (
                  <button
                    type="button"
                    onClick={() => setFooterText('')}
                    className="px-3 py-2 rounded-xl border border-[var(--border-organic)] text-xs text-[var(--text-muted)] hover:text-[#b55346] cursor-pointer"
                  >
                    清空隐藏
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Homepage Hero & Modules */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-5">
            <h2 className="font-serif-editorial text-xl font-semibold pb-3 border-b border-[var(--border-organic)]">
              二、首页主视觉文案与板块开关
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  首页主视觉大标题
                </label>
                <input
                  type="text"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  节气与生活状态栏（首页顶部胶囊，留空则隐藏）
                </label>
                <input
                  type="text"
                  value={seasonNote}
                  onChange={(e) => setSeasonNote(e.target.value)}
                  placeholder="留空则隐藏"
                  className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                首页欢迎导语（留空则隐藏）
              </label>
              <textarea
                rows={2}
                value={heroIntro}
                onChange={(e) => setHeroIntro(e.target.value)}
                placeholder="留空则隐藏导语段落"
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  首页寄语引用框（留空则隐藏引用框）
                </label>
                <input
                  type="text"
                  value={heroQuote}
                  onChange={(e) => setHeroQuote(e.target.value)}
                  placeholder="留空则隐藏"
                  className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  首页右侧名片角标文字（默认：园主小像）
                </label>
                <input
                  type="text"
                  value={sectionTitles.ownerCardBadge ?? '园主小像'}
                  onChange={(e) =>
                    updateSectionField('ownerCardBadge', e.target.value)
                  }
                  className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>

            <div className="pt-2">
              <span className="block text-xs text-[var(--text-muted)] mb-3">
                首页板块显示开关（勾选即在首页展示）：
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
          </div>

          {/* 3. Custom Section & Page Titles */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-5">
            <div>
              <h2 className="font-serif-editorial text-xl font-semibold">
                三、全站各栏目与板块标题自定义
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                你可以自由修改首页各板块标题以及各个独立栏目页的标题与导语说明。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  首页文章板块标题
                </label>
                <input
                  type="text"
                  value={sectionTitles.featuredArticlesTitle ?? '长文与手记'}
                  onChange={(e) =>
                    updateSectionField('featuredArticlesTitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  首页文章板块副标题（可留空）
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.featuredArticlesSubtitle ??
                    '思考、游历与日常观察的慢速书写'
                  }
                  onChange={(e) =>
                    updateSectionField(
                      'featuredArticlesSubtitle',
                      e.target.value
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  文章页大标题
                </label>
                <input
                  type="text"
                  value={sectionTitles.articlesPageTitle ?? '长文手记 · 漫长思考'}
                  onChange={(e) =>
                    updateSectionField('articlesPageTitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  文章页导语（可留空）
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.articlesPageSubtitle ??
                    '记录阅读、旅途、器物与日常里的细微顿悟。'
                  }
                  onChange={(e) =>
                    updateSectionField('articlesPageSubtitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  瞬间页大标题
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.momentsPageTitle ?? '日常瞬间 · 吉光片羽'
                  }
                  onChange={(e) =>
                    updateSectionField('momentsPageTitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  瞬间页导语（可留空）
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.momentsPageSubtitle ??
                    '不必成篇的随手摘录。一朵云、一杯热茶、一句读到的话，或是深夜突然闪现的念头。'
                  }
                  onChange={(e) =>
                    updateSectionField('momentsPageSubtitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  相册页大标题
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.galleryPageTitle ?? '光影相册 · 胶片与数码记忆'
                  }
                  onChange={(e) =>
                    updateSectionField('galleryPageTitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  相册页导语（可留空）
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.galleryPageSubtitle ??
                    '按主题与季节整理的私人摄影集。留存光线、空气与当时的心境。'
                  }
                  onChange={(e) =>
                    updateSectionField('galleryPageSubtitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  远行足迹页大标题
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.travelPageTitle ?? '远行足迹 · 山海漫游手卷'
                  }
                  onChange={(e) =>
                    updateSectionField('travelPageTitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  远行地图左下角说明文字
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.travelMapCaption ?? '点击坐标点切换目的地记录'
                  }
                  onChange={(e) =>
                    updateSectionField('travelMapCaption', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  收藏页大标题
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.collectionsPageTitle ??
                    '器物与精神食粮 · 兴趣收藏室'
                  }
                  onChange={(e) =>
                    updateSectionField('collectionsPageTitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  时间线页大标题
                </label>
                <input
                  type="text"
                  value={
                    sectionTitles.timelinePageTitle ??
                    '岁月年轮 · 全站记忆时间线'
                  }
                  onChange={(e) =>
                    updateSectionField('timelinePageTitle', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>
          </div>

          {/* 4. Custom Categories Management */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-6">
            <div>
              <h2 className="font-serif-editorial text-xl font-semibold">
                四、文章分类与收藏馆分类管理
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                自由增删属于你自己的文章分类与兴趣收藏分类，修改后点击底部保存即可生效。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Article Categories */}
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-3">
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                  文章分类列表 ({articleCategories.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {articleCategories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-xs"
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setArticleCategories(
                            articleCategories.filter((c) => c !== cat)
                          )
                        }
                        className="text-[var(--text-muted)] hover:text-[#b55346] cursor-pointer"
                        title="删除该分类"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newArtCat}
                    onChange={(e) => setNewArtCat(e.target.value)}
                    placeholder="输入新文章分类名称"
                    className="flex-1 text-xs px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newArtCat.trim();
                      if (v && !articleCategories.includes(v)) {
                        setArticleCategories([...articleCategories, v]);
                        setNewArtCat('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs cursor-pointer"
                  >
                    添加分类
                  </button>
                </div>
              </div>

              {/* Collection Categories */}
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-3">
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                  兴趣收藏分类列表 ({collectionCategories.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {collectionCategories.map((cat) => (
                    <span
                      key={cat.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-xs"
                    >
                      <span>
                        {cat.label} ({cat.id})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCollectionCategories(
                            collectionCategories.filter((c) => c.id !== cat.id)
                          )
                        }
                        className="text-[var(--text-muted)] hover:text-[#b55346] cursor-pointer"
                        title="删除该分类"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newColCatId}
                    onChange={(e) => setNewColCatId(e.target.value)}
                    placeholder="英文代号(如 game)"
                    className="w-28 text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <input
                    type="text"
                    value={newColCatLabel}
                    onChange={(e) => setNewColCatLabel(e.target.value)}
                    placeholder="分类名称(如 游戏与主机)"
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const id = newColCatId.trim();
                      const label = newColCatLabel.trim();
                      if (
                        id &&
                        label &&
                        !collectionCategories.some((c) => c.id === id)
                      ) {
                        setCollectionCategories([
                          ...collectionCategories,
                          { id, label },
                        ]);
                        setNewColCatId('');
                        setNewColCatLabel('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs cursor-pointer"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-organic)]">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs sm:text-sm font-medium hover:bg-[#586947] cursor-pointer shadow-xs"
              >
                保存全站自定义设置
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: CHATGPT / AI AGENT INTEGRATION & OPENAPI */}
      {activeTab === 'aiAgent' && (
        <div className="space-y-8">
          {/* 0. Direct Chat Mode (MCP Connector + @Mention like Gmail/Outlook) */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border-2 border-[#687a56]/40 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--border-organic)]">
              <div className="space-y-1">
                <span className="text-xs text-[#687a56] font-semibold">
                  原生支持 MCP 连接器协议 · 像在聊天里让 ChatGPT 查发邮件一样直接操作博客
                </span>
                <h2 className="font-serif-editorial text-2xl font-semibold">
                  在 ChatGPT 普通聊天模式里直接指挥它写文章、改网站
                </h2>
                <p className="text-xs text-[var(--text-muted)] max-w-3xl leading-relaxed">
                  你之所以能在普通聊天框里直接让 ChatGPT 动你的邮箱，是因为邮箱通过 <strong>连接器 (Connectors / MCP)</strong> 或 <strong>@应用召唤</strong> 挂载到了主聊天框。现在你的博客也已内置同款 <strong>MCP 远程连接器服务</strong>，下面两种方式都能让你在日常聊天窗口里直接一句话指挥它！
                </p>
              </div>
            </div>

            {/* Method A & Method B comparison cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Method A: Native ChatGPT Connector (MCP) */}
              <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#687a56]">
                    方式一：挂载到 ChatGPT「连接器 (Connectors)」（和邮箱完全同款）
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    免填 Header · 密钥已内嵌于专属连接地址
                  </span>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-[var(--text-secondary)] font-medium">
                    你的专属 MCP 连接器地址（点击复制）：
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={
                        agentInfo?.mcpUrl ||
                        `https://river05531.ai.studio/mcp/${agentInfo?.apiKey || 'gdn_live_8ee9f04686590079dcd2a6159f49a68e'}`
                      }
                      aria-label="MCP 连接器地址"
                      className="flex-1 font-mono text-xs px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url =
                          agentInfo?.mcpUrl ||
                          `https://river05531.ai.studio/mcp/${agentInfo?.apiKey || 'gdn_live_8ee9f04686590079dcd2a6159f49a68e'}`;
                        navigator.clipboard?.writeText(url);
                        notify('已复制专属 MCP 连接器地址！');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
                    >
                      复制 MCP 地址
                    </button>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#d4a373]/15 border border-[#d4a373] text-xs text-[var(--text-primary)] leading-relaxed">
                  <strong>⚠️ 重要前提（必看）：</strong>在 ChatGPT 点击「创建为插件」之前，请务必先点击当前 AI Studio 页面右上角的 <strong>「Deploy / 部署（更新线上版本）」</strong> 按钮！因为 ChatGPT 访问的是线上正式域名 <code className="font-mono">river05531.ai.studio</code>，只有点击部署后，最新的 <code className="font-mono">/mcp</code> 接口才会在正式域名生效。
                </div>
                <ol className="text-xs text-[var(--text-secondary)] space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>
                    先点击 AI Studio 右上角 <strong>Deploy</strong> 发布更新，等待约 30 秒部署完成。
                  </li>
                  <li>
                    在 ChatGPT「添加自定义 MCP 服务器」窗口中，名称填 <code className="font-mono text-[#687a56]">竹林博客</code>，服务器 URL 粘贴上方复制的 <strong>MCP 连接器地址</strong>，身份验证选 <strong>无需身份验证</strong>，点击「创建为插件」。
                  </li>
                  <li>
                    创建成功后，回到<strong>平时随便聊天的普通窗口</strong>，直接对它说：<em>“帮我写一篇关于春夜听雨的随笔发到博客上”</em>，它就会像发邮件一样直接帮你发布！
                  </li>
                </ol>
              </div>

              {/* Method B: @Mention in normal chat */}
              <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#687a56]">
                    方式二：在普通聊天框直接输入 @ 召唤（零切换窗口）
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    适用于所有 Plus / Pro / Team 账号
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  如果你已经按下方步骤创建好了名为「竹林主笔」的 GPT，你<strong>根本不需要专门点进那个 GPT 的独立页面</strong>：
                </p>
                <ol className="text-xs text-[var(--text-secondary)] space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    留在你平时日常使用的<strong>普通 ChatGPT 聊天窗口</strong>（甚至可以和查邮件在同一个对话里）。
                  </li>
                  <li>
                    在聊天输入框里直接打一个 <code className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-organic)] font-mono text-[#687a56]">@</code> 符号，菜单会自动弹出你创建的<strong>「@竹林主笔」</strong>。
                  </li>
                  <li>
                    回车选中它，直接说：
                    <span className="block mt-1 p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-[var(--text-primary)]">
                      “@竹林主笔 把我刚才聊的这段感悟整理成一篇随笔发到我的博客里，顺便把网站底部的诗句改成‘明月松间照，清泉石上流’。”
                    </span>
                  </li>
                  <li>
                    它会在当前普通聊天里直接调用博客接口完成发布与修改，无需离开当前对话！
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* 1. API Key & Quick Setup Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--border-organic)]">
              <div className="space-y-1">
                <span className="text-xs text-[#687a56] font-medium">
                  OpenAPI 3.1.0 标准协议 · 自动支持 Markdown 转富文本排版
                </span>
                <h2 className="font-serif-editorial text-2xl font-semibold">
                  OpenAPI 凭证与 Custom GPT 绑定配置
                </h2>
                <p className="text-xs text-[var(--text-muted)] max-w-3xl leading-relaxed">
                  无论是配置上面的 MCP 连接器，还是配置 Custom GPT Actions，下方都是你的全站最高权限凭证。
                </p>
              </div>
            </div>

            {/* Credentials Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    1. 专属永久 AI API Key (Bearer Token)
                  </span>
                  <span className="text-[11px] text-[#687a56]">
                    云端持久化 · 实例重启永不失效
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={agentInfo?.apiKey || '正在加载密钥…'}
                    aria-label="专属 AI API Key"
                    className="flex-1 font-mono text-xs px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (agentInfo?.apiKey) {
                        navigator.clipboard?.writeText(agentInfo.apiKey);
                        notify('已复制专属 AI API Key');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
                  >
                    复制 Key
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await regenerateAgentApiKey();
                        setAgentInfo((prev) =>
                          prev
                            ? {
                                ...prev,
                                apiKey: res.apiKey,
                                mcpUrl: res.mcpUrl,
                                sseUrl: res.sseUrl,
                                systemPrompt: res.systemPrompt,
                              }
                            : null
                        );
                        notify(res.message);
                      } catch (err) {
                        notifyError(
                          err instanceof Error ? err.message : '重置失败'
                        );
                      }
                    }}
                    className="px-3 py-2 rounded-xl border border-[var(--border-organic)] text-xs text-[var(--text-muted)] hover:text-[#b55346] cursor-pointer"
                  >
                    重置更换
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  注：除了此专属 Key，你也随时可以直接用你的园主登录密码作为 Bearer Token 调用所有接口。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    2. OpenAPI 3.1.0 规范地址（供 GPT Actions 导入）
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    支持 URL 导入或直接复制 JSON
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      agentInfo?.openApiUrl ||
                      'https://river05531.ai.studio/openapi.json'
                    }
                    aria-label="OpenAPI 规范地址"
                    className="flex-1 font-mono text-xs px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url =
                        agentInfo?.openApiUrl ||
                        'https://river05531.ai.studio/openapi.json';
                      navigator.clipboard?.writeText(url);
                      notify('已复制 OpenAPI 规范 URL');
                    }}
                    className="px-3 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
                  >
                    复制 URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const spec = buildOpenApiSpec(
                        agentInfo?.productionUrl ||
                          'https://river05531.ai.studio',
                        garden.profile.gardenName
                      );
                      navigator.clipboard?.writeText(
                        JSON.stringify(spec, null, 2)
                      );
                      notify(
                        '已复制完整 OpenAPI 3.1.0 JSON Schema，可直接粘贴到 ChatGPT Actions Schema 框中！'
                      );
                    }}
                    className="px-3 py-2 rounded-xl border border-[#687a56] text-[#687a56] text-xs font-medium cursor-pointer"
                  >
                    复制完整 Schema
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  在 ChatGPT 创建 GPT → Configure → Actions → 点击「Import from URL」粘贴上方地址，或直接点击「复制完整 Schema」粘贴到 Schema 框中。
                </p>
              </div>
            </div>

            {/* 3-Step Guide + System Prompt */}
            <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif-editorial text-base font-semibold">
                    3. 给 ChatGPT 的专属主笔提示词（Instructions / System Prompt）
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    将下方提示词复制到 ChatGPT 的「Instructions」框或直接发给 AI Agent，它就能明白如何替你写文章、发日常瞬间和打理博客：
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (agentInfo?.systemPrompt) {
                      navigator.clipboard?.writeText(agentInfo.systemPrompt);
                      notify('已复制 ChatGPT 专属主笔提示词！');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
                >
                  一键复制提示词
                </button>
              </div>
              <textarea
                rows={7}
                readOnly
                value={agentInfo?.systemPrompt || ''}
                aria-label="ChatGPT 系统提示词"
                className="w-full font-mono text-xs p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] leading-relaxed"
              />
            </div>
          </div>

          {/* 2. Full API Endpoint Reference Table */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-5">
            <div>
              <h2 className="font-serif-editorial text-xl font-semibold">
                完整 API 路径与参数速查表（基于 https://river05531.ai.studio）
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                所有写入接口均在请求头携带 <code className="font-mono text-[#687a56]">Authorization: Bearer {agentInfo?.apiKey || '<API_KEY>'}</code>（或 <code className="font-mono">x-api-key</code>）。文章正文支持直接传入 Markdown 语法，服务端会自动转换为富文本 HTML 并提取摘要。
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-organic)] text-[var(--text-muted)]">
                    <th className="py-2.5 pr-4 font-semibold">方法</th>
                    <th className="py-2.5 pr-4 font-semibold">完整接口路径</th>
                    <th className="py-2.5 pr-4 font-semibold">功能说明</th>
                    <th className="py-2.5 font-semibold">核心 JSON 参数示例</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-organic)]">
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#687a56] font-bold">GET</td>
                    <td className="py-3 pr-4 font-mono">
                      https://river05531.ai.studio/api/agent/overview
                    </td>
                    <td className="py-3 pr-4">
                      读取全站配置、分类、已有文章/瞬间/足迹/收藏列表与 ID
                    </td>
                    <td className="py-3 font-mono text-[var(--text-muted)]">无需 Body</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#d4a373] font-bold">POST</td>
                    <td className="py-3 pr-4 font-mono">
                      https://river05531.ai.studio/api/agent/execute
                    </td>
                    <td className="py-3 pr-4">
                      <strong>AI 全能一键代管接口</strong>（一次请求可同时发文、发瞬间、加足迹、加收藏、改全站配置）
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {`{"createArticle": {"title": "秋夜随笔", "content": "## 标题\\n正文内容", "category": "生活杂记"}}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#d4a373] font-bold">POST</td>
                    <td className="py-3 pr-4 font-mono">
                      https://river05531.ai.studio/api/articles
                    </td>
                    <td className="py-3 pr-4">
                      撰写并发布新文章（支持 Markdown 自动转排版 HTML，免填摘要自动生成）
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {`{"title": "标题", "content": "Markdown或HTML正文", "category": "山居随笔", "tags": ["日常"], "status": "public"}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#687a56] font-bold">PUT</td>
                    <td className="py-3 pr-4 font-mono">
                      https://river05531.ai.studio/api/articles/:id
                    </td>
                    <td className="py-3 pr-4">
                      修改或润色指定 ID 的已有文章/草稿
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {`{"title": "新标题", "content": "润色后的正文", "status": "public"}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#d4a373] font-bold">POST</td>
                    <td className="py-3 pr-4 font-mono">
                      https://river05531.ai.studio/api/moments
                    </td>
                    <td className="py-3 pr-4">
                      随手发布一条日常短瞬间/动态
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {`{"content": "窗外桂花落了一地。", "mood": "闲适", "location": "书房"}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#d4a373] font-bold">POST</td>
                    <td className="py-3 pr-4 font-mono">
                      https://river05531.ai.studio/api/travel
                    </td>
                    <td className="py-3 pr-4">
                      点亮并添加新的旅行足迹坐标与故事
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {`{"destination": "大理 · 沙溪", "region": "云南", "summary": "古镇听雨", "story": "详细游记..."}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#d4a373] font-bold">POST</td>
                    <td className="py-3 pr-4 font-mono">
                      https://river05531.ai.studio/api/collections
                    </td>
                    <td className="py-3 pr-4">
                      收录好物、电影、书籍、黑胶唱片等兴趣收藏
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {`{"title": "小森林", "creator": "森淳一", "category": "film", "rating": 5, "review": "治愈四季"}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#687a56] font-bold">PUT</td>
                    <td className="py-3 pr-4 font-mono">
                      https://river05531.ai.studio/api/profile
                    </td>
                    <td className="py-3 pr-4">
                      修改站点名称、顶部副标题、底部文字、首页大标题与关于页自述
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {`{"gardenName": "竹林", "gardenSubtitle": "", "footerText": "", "heroTitle": "渔樵夜归客"}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

