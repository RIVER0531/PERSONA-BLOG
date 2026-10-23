import React, { useState, useRef } from 'react';
import {
  Plus,
  ExternalLink,
  Trash2,
  Disc,
  BookMarked,
  Film,
  Cpu,
  Globe,
  Upload,
  Lock,
} from 'lucide-react';
import type { CollectionItem } from '../types/garden';
import { filterVisibleContent } from '../utils/gardenLogic';
import { compressAndUploadImage } from '../utils/api';

interface CollectionsViewProps {
  collections: CollectionItem[];
  categories: Array<{ id: string; label: string }>;
  isAdmin: boolean;
  onCreateCollection: (item: Partial<CollectionItem>) => Promise<void>;
  onDeleteCollection: (id: string) => Promise<void>;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  categories,
  isAdmin,
  onCreateCollection,
  onDeleteCollection,
}) => {
  const visibleItems = filterVisibleContent(collections, isAdmin);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add item form state
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('');
  const [category, setCategory] = useState(categories[0]?.id || 'gear');
  const [customCatId, setCustomCatId] = useState('');
  const [customCatLabel, setCustomCatLabel] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [experienceNote, setExperienceNote] = useState('');
  const [specsOrMeta, setSpecsOrMeta] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [tagsInput, setTagsInput] = useState('偏爱，长期主义');
  const [status, setStatus] = useState<'public' | 'private'>('public');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems =
    selectedCat === 'all'
      ? visibleItems
      : visibleItems.filter((item) => item.category === selectedCat);

  const handleCoverUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const url = await compressAndUploadImage(files[0]);
      setCoverImage(url);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const finalCatId = customCatId.trim() || category;
    const foundLabel =
      categories.find((c) => c.id === category)?.label || '好物收藏';
    const finalCatLabel = customCatLabel.trim() || foundLabel;

    await onCreateCollection({
      title: title.trim(),
      creator: creator.trim(),
      category: finalCatId,
      categoryLabel: finalCatLabel,
      coverImage:
        coverImage.trim() ||
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
      rating,
      review: review.trim(),
      experienceNote: experienceNote.trim(),
      specsOrMeta: specsOrMeta.trim(),
      externalLink: externalLink.trim() || undefined,
      tags: tagsInput
        .split(/[,，、\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      recordedDate: new Date().toISOString().slice(0, 10),
      status,
      favorite: rating === 5,
    });

    setTitle('');
    setCreator('');
    setReview('');
    setExperienceNote('');
    setSpecsOrMeta('');
    setCustomCatId('');
    setCustomCatLabel('');
    setShowAddModal(false);
  };

  const renderStars = (score: number) => '★'.repeat(score) + '☆'.repeat(Math.max(0, 5 - score));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[var(--border-organic)]">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#687a56] mb-2">
            Curated Cabinet of Curiosities
          </p>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold">
            器物与精神食粮 · 兴趣收藏室
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2 max-w-xl">
            存放陪伴我日常创作的数码器物、深夜重温的电影、案头书册与黑胶唱片。
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium hover:bg-[#586947] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>收录新藏品 / 新分类</span>
          </button>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div
        role="tablist"
        aria-label="收藏分类筛选"
        className="flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCat === 'all'}
          onClick={() => setSelectedCat('all')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            selectedCat === 'all'
              ? 'bg-[#687a56] text-[#faf6f1]'
              : 'bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          全部馆藏 ({visibleItems.length})
        </button>

        {categories.map((cat) => {
          const count = visibleItems.filter((i) => i.category === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCat === cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                selectedCat === cat.id
                  ? 'bg-[#687a56] text-[#faf6f1]'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Category-Adapted Editorial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredItems.map((item) => {
          // 1. MUSIC / VINYL RECORD STYLE
          if (item.category === 'music') {
            return (
              <div
                key={item.id}
                className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] flex flex-col sm:flex-row gap-6 items-center sm:items-start"
              >
                <div className="relative w-36 h-36 shrink-0">
                  {/* Vinyl disc peeking out */}
                  <div className="absolute -right-4 top-2 w-32 h-32 rounded-full bg-[#24201d] border-4 border-[#3a332c] flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-[#d4a373]/80" />
                  </div>
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    loading="lazy"
                    className="relative z-10 w-32 h-32 object-cover rounded-xl shadow-md border border-[var(--border-organic)]"
                  />
                </div>

                <div className="flex-1 space-y-2.5">
                  <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[#687a56] font-medium">
                      <Disc className="w-3.5 h-3.5" />
                      {item.categoryLabel} · {item.creator}
                    </span>
                    <span className="text-[#d4a373] tracking-widest">
                      {renderStars(item.rating)}
                    </span>
                  </div>

                  <h3 className="font-serif-editorial text-xl font-semibold">
                    {item.title}
                  </h3>

                  {item.specsOrMeta && (
                    <p className="text-xs text-[var(--text-muted)]">{item.specsOrMeta}</p>
                  )}

                  <p className="text-sm leading-relaxed">{item.review}</p>

                  {item.experienceNote && (
                    <p className="text-xs text-[var(--text-muted)] italic border-l-2 border-[#8b9d77] pl-3">
                      聆听手记：{item.experienceNote}
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>收录于 {item.recordedDate}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onDeleteCollection(item.id)}
                        className="hover:text-[#b55346] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // 2. FILM / BOOK POSTER STYLE
          if (item.category === 'film' || item.category === 'book') {
            const Icon = item.category === 'film' ? Film : BookMarked;
            return (
              <div
                key={item.id}
                className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] flex flex-col sm:flex-row gap-6"
              >
                <div className="w-full sm:w-32 h-48 shrink-0 rounded-xl overflow-hidden border border-[var(--border-organic)] shadow-xs">
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[#687a56] font-medium">
                        <Icon className="w-3.5 h-3.5" />
                        {item.categoryLabel} · {item.creator}
                      </span>
                      <span className="text-[#d4a373] tracking-widest">
                        {renderStars(item.rating)}
                      </span>
                    </div>

                    <h3 className="font-serif-editorial text-xl font-semibold">
                      {item.title}
                    </h3>

                    {item.specsOrMeta && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.specsOrMeta}
                      </p>
                    )}

                    <p className="text-sm leading-relaxed">{item.review}</p>

                    {item.experienceNote && (
                      <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-muted)] p-2.5 rounded-xl">
                        批注：{item.experienceNote}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>{item.tags.map((t) => `#${t}`).join('  ')}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onDeleteCollection(item.id)}
                        className="hover:text-[#b55346] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // 3. DIGITAL GEAR / WEBSITE / CUSTOM SHOWCASE CARD
          return (
            <div
              key={item.id}
              className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="h-52 overflow-hidden bg-[var(--bg-muted)]">
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 space-y-3">
                  <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[#687a56] font-medium">
                      {item.category === 'site' ? (
                        <Globe className="w-3.5 h-3.5" />
                      ) : (
                        <Cpu className="w-3.5 h-3.5" />
                      )}
                      {item.categoryLabel} · {item.creator}
                    </span>
                    <span className="text-[#d4a373] tracking-widest">
                      {renderStars(item.rating)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-serif-editorial text-xl font-semibold">
                      {item.title}
                    </h3>
                    {item.status === 'private' && (
                      <Lock className="w-3.5 h-3.5 text-[#d4a373]" />
                    )}
                  </div>

                  {item.specsOrMeta && (
                    <p className="text-xs text-[var(--text-muted)]">
                      规格信息：{item.specsOrMeta}
                    </p>
                  )}

                  <p className="text-sm leading-relaxed">{item.review}</p>

                  {item.experienceNote && (
                    <div className="p-3 rounded-xl bg-[var(--bg-muted)] text-xs text-[var(--text-primary)]">
                      长期体验：{item.experienceNote}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 pb-5 pt-3 border-t border-[var(--border-organic)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>
                  {item.tags.map((t) => `#${t}`).join('  ')} · {item.recordedDate}
                </span>

                <div className="flex items-center gap-3">
                  {item.externalLink && (
                    <a
                      href={item.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#687a56] font-medium hover:underline"
                    >
                      <span>访问站点</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onDeleteCollection(item.id)}
                      className="hover:text-[#b55346] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Collection Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="新增收藏条目"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
        >
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-6 space-y-4 my-8"
          >
            <h3 className="font-serif-editorial text-xl font-semibold">
              新增兴趣收藏条目
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">藏品名称</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：Leica M10-P / 《山之四季》"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  作者 / 品牌 / 导演 / 音乐人
                </label>
                <input
                  type="text"
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  placeholder="例如：高村光太郎"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">选择现有分类</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  或扩展新分类代号
                </label>
                <input
                  type="text"
                  value={customCatId}
                  onChange={(e) => setCustomCatId(e.target.value)}
                  placeholder="如：tea（选填）"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  新分类中文名
                </label>
                <input
                  type="text"
                  value={customCatLabel}
                  onChange={(e) => setCustomCatLabel(e.target.value)}
                  placeholder="如：茶器与香道"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">喜爱评分 (1-5星)</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                >
                  <option value={5}>★★★★★ (5星挚爱)</option>
                  <option value={4}>★★★★☆ (4星推荐)</option>
                  <option value={3}>★★★☆☆ (3星尚可)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">规格 / 年份说明</label>
                <input
                  type="text"
                  value={specsOrMeta}
                  onChange={(e) => setSpecsOrMeta(e.target.value)}
                  placeholder="例如：2024 · 手作柴烧"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">评价与体会</label>
              <textarea
                rows={3}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="写下为什么喜欢它，以及它带来的触动……"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">长期体验备注 / 批注</label>
              <input
                type="text"
                value={experienceNote}
                onChange={(e) => setExperienceNote(e.target.value)}
                placeholder="例如：已主力使用两年，依然爱不释手"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">外部链接（选填）</label>
                <input
                  type="url"
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">可见状态</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'public' | 'private')}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                >
                  <option value="public">公开展示</option>
                  <option value="private">仅自己可见</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-organic)] text-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#687a56]" />
                <span>{isUploading ? '上传中…' : coverImage ? '已上传封面图' : '上传藏品图片'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleCoverUpload(e.target.files)}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs border border-[var(--border-organic)] cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-[#687a56] text-[#faf6f1] cursor-pointer"
                >
                  保存藏品
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
