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
} from '../types/garden';
import type { BackupInspectionResult } from '../utils/backupEngine';
import {
  exportFullZipBackup,
  inspectZipBackupFile,
  restoreZipBackupFile,
  fetchStorageDiagnostics,
  updateAdminPassword,
  type StorageDiagnosticsResponse,
  type RestoreZipResponse,
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
    'backup' | 'articles' | 'moments' | 'homeConfig'
  >('backup');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Diagnostics & Backup states
  const [diagnostics, setDiagnostics] = useState<StorageDiagnosticsResponse | null>(null);
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
      const diag = await fetchStorageDiagnostics();
      setDiagnostics(diag);
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
              这里是个人数字花园的管理中枢。验证园主密钥后，即可使用所见即所得编辑器撰文、管理草稿与私密内容、查看云端持久化诊断以及导出/恢复全站 ZIP 备份包。
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
      gardenName: gardenName.trim(),
      heroTitle: heroTitle.trim(),
      heroIntro: heroIntro.trim(),
      heroQuote: heroQuote.trim(),
      seasonNote: seasonNote.trim(),
      homeModules,
    });
    notify('首页文案与模块显示配置已保存并同步至 Cloud Firestore');
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
            栖迟园 · 内容管理与数据备份迁移中心
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
                      : '点击选择要恢复的栖迟园 .zip 完整备份包'}
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

                  {/* Warnings (Duplicates, Missing Files, Broken Relations) */}
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

      {/* TAB 3: MOMENTS MANAGEMENT */}
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

      {/* TAB 4: HOMEPAGE CONFIGURATION */}
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
    </div>
  );
};
