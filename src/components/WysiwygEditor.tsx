import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Columns,
  Video,
  Minus,
  Undo2,
  Redo2,
  Eye,
  Edit3,
  Save,
  CheckCircle2,
  Globe,
  Lock,
  FileText,
  Upload,
  X,
  ArrowLeft,
  Pin,
  Star,
} from 'lucide-react';
import type { Article, VisibilityStatus } from '../types/garden';
import { compressAndUploadImage } from '../utils/api';
import { estimateReadingTime, extractTableOfContents, injectHeadingIds } from '../utils/gardenLogic';

interface WysiwygEditorProps {
  initialArticle?: Article | null;
  categories: string[];
  onSave: (articleData: Partial<Article>, isAutoSave?: boolean) => Promise<Article>;
  onCancel: () => void;
  onPublishSuccess: (saved: Article) => void;
}

const PRESET_COVERS = [
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1400&q=80',
];

export const WysiwygEditor: React.FC<WysiwygEditorProps> = ({
  initialArticle,
  categories,
  onSave,
  onCancel,
  onPublishSuccess,
}) => {
  const [articleId, setArticleId] = useState<string>(
    initialArticle?.id || `art-${Date.now()}`
  );
  const [title, setTitle] = useState(initialArticle?.title || '');
  const [excerpt, setExcerpt] = useState(initialArticle?.excerpt || '');
  const [coverImage, setCoverImage] = useState(
    initialArticle?.coverImage || PRESET_COVERS[0]
  );
  const [category, setCategory] = useState(
    initialArticle?.category || categories[0] || '生活杂记'
  );
  const [customCategory, setCustomCategory] = useState('');
  const [tagsInput, setTagsInput] = useState(
    initialArticle?.tags?.join('，') || '日常，随笔'
  );
  const [status, setStatus] = useState<VisibilityStatus>(
    initialArticle?.status || 'public'
  );
  const [isPinned, setIsPinned] = useState(Boolean(initialArticle?.isPinned));
  const [isFeatured, setIsFeatured] = useState(
    initialArticle ? Boolean(initialArticle.isFeatured) : true
  );
  const [location, setLocation] = useState(initialArticle?.location || '杭州 · 书房');
  const [weather, setWeather] = useState(initialArticle?.weather || '秋晴 · 20℃');
  const [htmlContent, setHtmlContent] = useState(
    initialArticle?.content ||
      '<p>在这里直接开始书写你的故事、想法或旅行手记。选中文字或点击上方工具栏即可轻松排版，支持直接粘贴或拖拽上传图片……</p>'
  );

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isUploading, setIsUploading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Dialog states for inserting link / media / captioned image
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkText, setLinkText] = useState('');

  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const isDirtyRef = useRef(false);

  // Initialize editor DOM once or when switching back from preview mode
  useEffect(() => {
    if (mode === 'edit' && editorRef.current) {
      if (editorRef.current.innerHTML !== htmlContent) {
        editorRef.current.innerHTML = htmlContent;
      }
    }
  }, [mode]);

  const syncHtmlFromDom = useCallback(() => {
    if (editorRef.current) {
      const current = editorRef.current.innerHTML;
      setHtmlContent(current);
      isDirtyRef.current = true;
    }
  }, []);

  const parseTags = (raw: string): string[] =>
    raw
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

  const buildPayload = useCallback(
    (overrideStatus?: VisibilityStatus): Partial<Article> => {
      const finalCategory = customCategory.trim() || category || '生活杂记';
      const currentHtml =
        mode === 'edit' && editorRef.current ? editorRef.current.innerHTML : htmlContent;
      return {
        id: articleId,
        title: title.trim() || '未命名手记',
        excerpt: excerpt.trim(),
        coverImage: coverImage.trim(),
        content: currentHtml,
        category: finalCategory,
        tags: parseTags(tagsInput),
        status: overrideStatus || status,
        isPinned,
        isFeatured,
        location: location.trim(),
        weather: weather.trim(),
      };
    },
    [
      articleId,
      title,
      excerpt,
      coverImage,
      mode,
      htmlContent,
      customCategory,
      category,
      tagsInput,
      status,
      isPinned,
      isFeatured,
      location,
      weather,
    ]
  );

  // Auto-save draft every 12 seconds if dirty
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!isDirtyRef.current) return;
      if (!title.trim() && !htmlContent.trim()) return;
      try {
        setSaveState('saving');
        isDirtyRef.current = false;
        const saved = await onSave(buildPayload(), true);
        setArticleId(saved.id);
        setSaveState('saved');
        setLastSavedTime(
          new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } catch {
        setSaveState('error');
      }
    }, 12000);
    return () => clearInterval(timer);
  }, [title, htmlContent, buildPayload, onSave]);

  const execFormat = (command: string, value?: string) => {
    if (mode !== 'edit' || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    syncHtmlFromDom();
  };

  const insertHtmlSnippet = (snippet: string) => {
    if (mode !== 'edit' || !editorRef.current) return;
    editorRef.current.focus();
    const success = document.execCommand('insertHTML', false, snippet);
    if (!success) {
      editorRef.current.innerHTML += snippet;
    }
    syncHtmlFromDom();
  };

  const handleSingleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setErrorMessage('');
    try {
      for (const file of Array.from(files)) {
        const url = await compressAndUploadImage(file);
        const caption = file.name.replace(/\.[^/.]+$/, '');
        insertHtmlSnippet(
          `<figure><img src="${url}" alt="${caption}" /><figcaption>${caption}（点击可直接修改图片说明）</figcaption></figure><p><br/></p>`
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '上传图片失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMultiImageGrid = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setErrorMessage('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        const url = await compressAndUploadImage(file);
        urls.push(url);
      }
      if (urls.length > 0) {
        const imgsHtml = urls.map((u) => `<img src="${u}" alt="并排画廊配图" />`).join('');
        insertHtmlSnippet(
          `<div class="image-grid-2">${imgsHtml}</div><p class="text-center text-sm text-[#857263]">组图说明：记录此刻的光影细节</p><p><br/></p>`
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '组图上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const url = await compressAndUploadImage(files[0]);
      setCoverImage(url);
      isDirtyRef.current = true;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '封面上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setIsUploading(true);
          try {
            const url = await compressAndUploadImage(file);
            insertHtmlSnippet(
              `<figure><img src="${url}" alt="粘贴的图片" /><figcaption>图片说明</figcaption></figure><p><br/></p>`
            );
          } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : '粘贴图片失败');
          } finally {
            setIsUploading(false);
          }
        }
        return;
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      e.preventDefault();
      await handleSingleImageFiles(files);
    }
  };

  const handleManualSave = async (targetStatus: VisibilityStatus) => {
    if (!title.trim()) {
      setErrorMessage('请先填写文章标题');
      return;
    }
    setErrorMessage('');
    setSaveState('saving');
    try {
      setStatus(targetStatus);
      const saved = await onSave(buildPayload(targetStatus), false);
      setArticleId(saved.id);
      isDirtyRef.current = false;
      setSaveState('saved');
      setLastSavedTime(
        new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      if (targetStatus !== 'draft') {
        onPublishSuccess(saved);
      }
    } catch (err) {
      setSaveState('error');
      setErrorMessage(err instanceof Error ? err.message : '保存失败');
    }
  };

  const readingMinutes = estimateReadingTime(htmlContent);
  const tocHeadings = extractTableOfContents(htmlContent);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-[var(--border-organic)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-sm hover:border-[#8b9d77] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回花园</span>
          </button>
          <div>
            <h1 className="font-serif-editorial text-xl font-semibold">
              {initialArticle ? '修剪手记 · 编辑文章' : '播种新篇 · 可视化写作工坊'}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              所见即所得富文本编辑器 · 无需 Markdown · 支持拖拽或粘贴插入图片 · 约 {readingMinutes} 分钟阅读
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Auto-save indicator */}
          <span className="text-xs text-[var(--text-muted)] mr-2 flex items-center gap-1.5">
            {saveState === 'saving' && <span>正在保存...</span>}
            {saveState === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#687a56]" />
                <span>已保存于 {lastSavedTime}</span>
              </>
            )}
          </span>

          {/* Mode Toggle */}
          <div className="inline-flex rounded-xl p-1 bg-[var(--bg-muted)] border border-[var(--border-organic)]">
            <button
              type="button"
              onClick={() => {
                syncHtmlFromDom();
                setMode('edit');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                mode === 'edit'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>可视化编辑</span>
            </button>
            <button
              type="button"
              onClick={() => {
                syncHtmlFromDom();
                setMode('preview');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                mode === 'preview'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>最终排版预览</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleManualSave('draft')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-sm font-medium hover:border-[#d4a373] transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#d4a373]" />
            <span>存为草稿</span>
          </button>

          <button
            type="button"
            onClick={() => handleManualSave(status === 'draft' ? 'public' : status)}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-sm font-medium hover:bg-[#586947] transition-colors cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{status === 'private' ? '保存为私密文章' : '正式发布文章'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-[#d4a373]/15 border border-[#d4a373] text-sm text-[var(--text-primary)] flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            aria-label="关闭提示"
            onClick={() => setErrorMessage('')}
            className="p-1 hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Editor / Preview Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Article Title & Excerpt Card */}
          <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
            <div>
              <label htmlFor="editor-article-title" className="block text-xs text-[var(--text-muted)] mb-1.5">
                文章标题
              </label>
              <input
                id="editor-article-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  isDirtyRef.current = true;
                }}
                placeholder="输入充满温度的文章标题……"
                className="w-full font-serif-editorial text-xl sm:text-2xl font-semibold bg-transparent border-b border-[var(--border-organic)] pb-3 focus:outline-none focus:border-[#8b9d77]"
              />
            </div>

            <div>
              <label htmlFor="editor-article-excerpt" className="block text-xs text-[var(--text-muted)] mb-1.5">
                文章导语 / 摘要（展示在首页与文章列表中）
              </label>
              <textarea
                id="editor-article-excerpt"
                rows={2}
                value={excerpt}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  isDirtyRef.current = true;
                }}
                placeholder="用两三句话概括这篇文章的心境或故事梗概……"
                className="w-full text-sm leading-relaxed bg-[var(--bg-primary)] rounded-xl p-3 border border-[var(--border-organic)] focus:outline-none focus:border-[#8b9d77]"
              />
            </div>
          </div>

          {mode === 'edit' ? (
            <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] overflow-hidden shadow-xs">
              {/* Rich Text Formatting Toolbar */}
              <div
                role="toolbar"
                aria-label="文章排版工具栏"
                className="sticky top-0 z-20 flex flex-wrap items-center gap-1 p-2.5 bg-[var(--bg-muted)] border-b border-[var(--border-organic)]"
              >
                <button
                  type="button"
                  onClick={() => execFormat('formatBlock', '<h2>')}
                  title="二级大标题 (章节)"
                  aria-label="二级大标题"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Heading2 className="w-4 h-4" />
                  <span className="hidden sm:inline">章节 H2</span>
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('formatBlock', '<h3>')}
                  title="三级小标题"
                  aria-label="三级小标题"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Heading3 className="w-4 h-4" />
                  <span className="hidden sm:inline">小节 H3</span>
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('formatBlock', '<p>')}
                  title="正文段落"
                  aria-label="正文段落"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-xs font-medium cursor-pointer"
                >
                  正文
                </button>

                <span className="h-4 w-px bg-[var(--border-organic)] mx-1" />

                <button
                  type="button"
                  onClick={() => execFormat('bold')}
                  title="加粗 (Ctrl+B)"
                  aria-label="加粗"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('italic')}
                  title="斜体 (Ctrl+I)"
                  aria-label="斜体"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('underline')}
                  title="下划线"
                  aria-label="下划线"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <Underline className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('formatBlock', '<blockquote>')}
                  title="引用段落"
                  aria-label="引用段落"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <Quote className="w-4 h-4" />
                </button>

                <span className="h-4 w-px bg-[var(--border-organic)] mx-1" />

                <button
                  type="button"
                  onClick={() => execFormat('insertUnorderedList')}
                  title="无序列表"
                  aria-label="无序列表"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('insertOrderedList')}
                  title="有序列表"
                  aria-label="有序列表"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('insertHorizontalRule')}
                  title="插入分隔线"
                  aria-label="插入分隔线"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="h-4 w-px bg-[var(--border-organic)] mx-1" />

                {/* Upload Single Image */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="上传并插入照片"
                  aria-label="上传图片"
                  className="px-2.5 py-1.5 rounded-lg bg-[#8b9d77]/15 hover:bg-[#8b9d77]/25 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#687a56]" />
                  <span>传图</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleSingleImageFiles(e.target.files)}
                />

                {/* Upload Multi-Image Grid */}
                <button
                  type="button"
                  onClick={() => multiFileInputRef.current?.click()}
                  title="上传多张图片并排排版"
                  aria-label="多图并排"
                  className="px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Columns className="w-4 h-4" />
                  <span className="hidden sm:inline">双图并排</span>
                </button>
                <input
                  ref={multiFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleMultiImageGrid(e.target.files)}
                />

                {/* Insert External Media / Video */}
                <button
                  type="button"
                  onClick={() => setShowMediaModal(true)}
                  title="插入网络图片或视频媒体"
                  aria-label="插入外部媒体"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                </button>

                {/* Insert Link */}
                <button
                  type="button"
                  onClick={() => setShowLinkModal(true)}
                  title="插入链接"
                  aria-label="插入链接"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>

                <span className="h-4 w-px bg-[var(--border-organic)] mx-1" />

                <button
                  type="button"
                  onClick={() => execFormat('undo')}
                  title="撤销 (Ctrl+Z)"
                  aria-label="撤销"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('redo')}
                  title="重做 (Ctrl+Y)"
                  aria-label="重做"
                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              {isUploading && (
                <div className="px-4 py-2 bg-[#8b9d77]/15 text-xs text-[#687a56] flex items-center gap-2">
                  <span>正在压缩并保存图片至花园图库，请稍候……</span>
                </div>
              )}

              {/* ContentEditable Canvas */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncHtmlFromDom}
                onBlur={syncHtmlFromDom}
                onPaste={handlePaste}
                onDrop={handleDrop}
                data-testid="wysiwyg-canvas"
                aria-label="文章正文编辑区"
                className="garden-prose garden-editor-canvas min-h-[480px] max-w-none p-6 sm:p-8 focus:outline-none"
              />
            </div>
          ) : (
            /* Live Magazine Preview Mode */
            <div className="p-6 sm:p-10 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
              <div className="mb-6 pb-6 border-b border-[var(--border-organic)]">
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  {customCategory || category} · 预计阅读 {readingMinutes} 分钟 · {location} · {weather}
                </p>
                <h1 className="font-serif-editorial text-3xl font-semibold mb-4">
                  {title || '未命名手记'}
                </h1>
                {excerpt && (
                  <p className="text-sm text-[var(--text-muted)] italic leading-relaxed">
                    {excerpt}
                  </p>
                )}
              </div>
              {coverImage && (
                <img
                  src={coverImage}
                  alt={title}
                  className="w-full h-72 object-cover rounded-2xl mb-8"
                />
              )}
              <div
                className="garden-prose max-w-none"
                dangerouslySetInnerHTML={{ __html: injectHeadingIds(htmlContent) }}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar: Article Metadata & Publishing Settings */}
        <div className="lg:col-span-4 space-y-6">
          {/* Visibility Status Selector */}
          <div className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
            <h3 className="font-serif-editorial text-base font-semibold">发布与可见性状态</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setStatus('public');
                  isDirtyRef.current = true;
                }}
                className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                  status === 'public'
                    ? 'border-[#687a56] bg-[#8b9d77]/15 text-[var(--text-primary)]'
                    : 'border-[var(--border-organic)] text-[var(--text-muted)]'
                }`}
              >
                <Globe className="w-4 h-4 text-[#687a56]" />
                <span>公开展示</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus('private');
                  isDirtyRef.current = true;
                }}
                className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                  status === 'private'
                    ? 'border-[#d4a373] bg-[#d4a373]/15 text-[var(--text-primary)]'
                    : 'border-[var(--border-organic)] text-[var(--text-muted)]'
                }`}
              >
                <Lock className="w-4 h-4 text-[#d4a373]" />
                <span>私人手札</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus('draft');
                  isDirtyRef.current = true;
                }}
                className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                  status === 'draft'
                    ? 'border-[#857263] bg-[var(--bg-muted)] text-[var(--text-primary)]'
                    : 'border-[var(--border-organic)] text-[var(--text-muted)]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>草稿箱</span>
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {status === 'public' && '所有来访花园的朋友均可阅读此文章，并自动收录至时间线。'}
              {status === 'private' && '服务端加密保护：仅你本人登录园主账号后可见，访客无法读取。'}
              {status === 'draft' && '保存在后台草稿箱中，随时可关闭网页后继续接着写。'}
            </p>

            <div className="pt-2 border-t border-[var(--border-organic)] flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => {
                    setIsPinned(e.target.checked);
                    isDirtyRef.current = true;
                  }}
                  className="rounded accent-[#687a56]"
                />
                <Pin className="w-3.5 h-3.5 text-[#687a56]" />
                <span>置顶文章</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => {
                    setIsFeatured(e.target.checked);
                    isDirtyRef.current = true;
                  }}
                  className="rounded accent-[#d4a373]"
                />
                <Star className="w-3.5 h-3.5 text-[#d4a373]" />
                <span>首页精选</span>
              </label>
            </div>
          </div>

          {/* Cover Image Picker & Upload */}
          <div className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-editorial text-base font-semibold">文章封面图</h3>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="text-xs text-[#687a56] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>上传本地封面</span>
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleCoverUpload(e.target.files)}
              />
            </div>

            {coverImage && (
              <img
                src={coverImage}
                alt="文章封面预览"
                className="w-full h-36 object-cover rounded-xl border border-[var(--border-organic)]"
              />
            )}

            <input
              type="text"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="或粘贴图片链接 URL"
              aria-label="封面图片链接"
              className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />

            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-xs text-[var(--text-muted)]">预设氛围图：</span>
              {PRESET_COVERS.map((preset, idx) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCoverImage(preset)}
                  aria-label={`使用预设封面 ${idx + 1}`}
                  className="w-7 h-7 rounded-md overflow-hidden border border-[var(--border-organic)] hover:scale-105 transition-transform cursor-pointer"
                >
                  <img src={preset} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Category, Tags, Weather & Location */}
          <div className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
            <h3 className="font-serif-editorial text-base font-semibold">分类、标签与印记</h3>

            <div>
              <label htmlFor="editor-category" className="block text-xs text-[var(--text-muted)] mb-1">
                所属分类专栏
              </label>
              <select
                id="editor-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="或输入新分类名称（留空则使用上方所选）"
                className="w-full mt-2 text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div>
              <label htmlFor="editor-tags" className="block text-xs text-[var(--text-muted)] mb-1">
                文章标签（用逗号分隔）
              </label>
              <input
                id="editor-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="例如：京都，慢生活，手冲咖啡"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="editor-location" className="block text-xs text-[var(--text-muted)] mb-1">
                  写作地点
                </label>
                <input
                  id="editor-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label htmlFor="editor-weather" className="block text-xs text-[var(--text-muted)] mb-1">
                  当日天气/节气
                </label>
                <input
                  id="editor-weather"
                  type="text"
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>
          </div>

          {/* Live Auto-Generated TOC Preview */}
          <div className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-2.5">
            <h3 className="font-serif-editorial text-sm font-semibold">自动文章目录预览</h3>
            {tocHeadings.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                在正文中插入「章节 H2」或「小节 H3」后，将自动生成阅读导航目录。
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                {tocHeadings.map((h) => (
                  <li
                    key={h.id}
                    className={h.level === 3 ? 'pl-4 text-[var(--text-muted)]' : 'font-medium text-[var(--text-primary)]'}
                  >
                    · {h.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Insert Link Modal */}
      {showLinkModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="插入网页链接"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-6 space-y-4">
            <h3 className="font-serif-editorial text-lg font-semibold">插入超链接</h3>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">链接文字</label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="例如：参考文章或书名"
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">目标网址 URL</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 rounded-xl text-xs border border-[var(--border-organic)] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (linkUrl.trim()) {
                    const label = linkText.trim() || linkUrl.trim();
                    insertHtmlSnippet(
                      `<a href="${linkUrl.trim()}" target="_blank" rel="noopener noreferrer">${label}</a>`
                    );
                  }
                  setShowLinkModal(false);
                  setLinkText('');
                  setLinkUrl('https://');
                }}
                className="px-4 py-2 rounded-xl text-xs bg-[#687a56] text-[#faf6f1] cursor-pointer"
              >
                插入链接
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insert External Image or Video Modal */}
      {showMediaModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="插入图片或视频媒体"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-6 space-y-4">
            <h3 className="font-serif-editorial text-lg font-semibold">插入外部图片或视频媒体</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMediaType('image')}
                className={`flex-1 py-1.5 rounded-lg text-xs border cursor-pointer ${
                  mediaType === 'image'
                    ? 'border-[#687a56] bg-[#8b9d77]/15 font-medium'
                    : 'border-[var(--border-organic)]'
                }`}
              >
                网络图片配图
              </button>
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`flex-1 py-1.5 rounded-lg text-xs border cursor-pointer ${
                  mediaType === 'video'
                    ? 'border-[#687a56] bg-[#8b9d77]/15 font-medium'
                    : 'border-[var(--border-organic)]'
                }`}
              >
                视频文件 / 嵌入链接
              </button>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">媒体地址 URL</label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">图注 / 说明文字</label>
              <input
                type="text"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="记录拍摄地点或画面背后的故事"
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                className="px-4 py-2 rounded-xl text-xs border border-[var(--border-organic)] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mediaUrl.trim()) {
                    const cap = mediaCaption.trim() || '画面记录';
                    if (mediaType === 'image') {
                      insertHtmlSnippet(
                        `<figure><img src="${mediaUrl.trim()}" alt="${cap}" /><figcaption>${cap}</figcaption></figure><p><br/></p>`
                      );
                    } else {
                      insertHtmlSnippet(
                        `<figure><video controls src="${mediaUrl.trim()}" class="w-full rounded-2xl my-4"></video><figcaption>${cap}</figcaption></figure><p><br/></p>`
                      );
                    }
                  }
                  setShowMediaModal(false);
                  setMediaUrl('');
                  setMediaCaption('');
                }}
                className="px-4 py-2 rounded-xl text-xs bg-[#687a56] text-[#faf6f1] cursor-pointer"
              >
                确认插入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
