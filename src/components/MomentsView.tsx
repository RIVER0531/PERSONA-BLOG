import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Lock,
  Globe,
  Trash2,
  Edit3,
  Send,
  X,
} from 'lucide-react';
import type { Moment, SiteSectionTitles } from '../types/garden';
import { filterVisibleContent, formatEditorialDate } from '../utils/gardenLogic';
import { compressAndUploadImage } from '../utils/api';

interface MomentsViewProps {
  moments: Moment[];
  sectionTitles?: SiteSectionTitles;
  isAdmin: boolean;
  onCreateMoment: (data: Partial<Moment>) => Promise<void>;
  onUpdateMoment: (id: string, data: Partial<Moment>) => Promise<void>;
  onDeleteMoment: (id: string) => Promise<void>;
}

export const MomentsView: React.FC<MomentsViewProps> = ({
  moments,
  sectionTitles,
  isAdmin,
  onCreateMoment,
  onUpdateMoment,
  onDeleteMoment,
}) => {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [weather, setWeather] = useState('');
  const [location, setLocation] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [status, setStatus] = useState<'public' | 'private'>('public');
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'public' | 'private'>('public');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleMoments = filterVisibleContent(moments, isAdmin);

  const allTags = Array.from(
    new Set(visibleMoments.flatMap((m) => m.tags))
  );

  const filteredMoments = selectedTag
    ? visibleMoments.filter((m) => m.tags.includes(selectedTag))
    : visibleMoments;

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        const url = await compressAndUploadImage(file);
        uploaded.push(url);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const tags = tagsText
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    await onCreateMoment({
      content: content.trim(),
      mood: mood.trim(),
      weather: weather.trim(),
      location: location.trim(),
      tags,
      images,
      status,
    });
    setContent('');
    setImages([]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Header */}
      <div className="pb-8 border-b border-[var(--border-organic)]">
        <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold">
          {sectionTitles?.momentsPageTitle || '吉光片羽 · 日常瞬间'}
        </h1>
        {(sectionTitles?.momentsPageSubtitle ??
          '不需要长篇大论的时刻，随手记下一句话、一杯咖啡的气味、窗台新开的植物或傍晚的云。') !==
          '' && (
          <p className="text-sm text-[var(--text-muted)] mt-2 max-w-xl">
            {sectionTitles?.momentsPageSubtitle ??
              '不需要长篇大论的时刻，随手记下一句话、一杯咖啡的气味、窗台新开的植物或傍晚的云。'}
          </p>
        )}
      </div>

      {/* Admin Quick Moment Composer */}
      {isAdmin && (
        <form
          onSubmit={handlePublish}
          className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-serif-editorial text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#d4a373]" />
              记录此刻的念头
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatus('public')}
                className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer ${
                  status === 'public'
                    ? 'bg-[#8b9d77]/20 text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-[#687a56]" />
                公开
              </button>
              <button
                type="button"
                onClick={() => setStatus('private')}
                className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer ${
                  status === 'private'
                    ? 'bg-[#d4a373]/20 text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-[#d4a373]" />
                私密
              </button>
            </div>
          </div>

          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下此刻的想法、看到的风景或读到的一句诗……"
            aria-label="瞬间内容"
            className="w-full p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] text-sm leading-relaxed focus:outline-none focus:border-[#8b9d77]"
          />

          {images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={img + i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-[var(--border-organic)]">
                  <img src={img} alt="配图预览" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    aria-label="移除配图"
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
            <input
              type="text"
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              placeholder="天气（如：秋晴 · 20℃）"
              aria-label="天气"
              className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
            <input
              type="text"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="心情（如：松弛）"
              aria-label="心情"
              className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="地点（如：书房窗边）"
              aria-label="地点"
              className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="标签（用逗号分隔）"
              aria-label="瞬间标签"
              className="px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-organic)] text-xs hover:border-[#8b9d77] cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-[#687a56]" />
                <span>{isUploading ? '上传中…' : '添加照片'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handlePhotoUpload(e.target.files)}
              />
            </div>

            <button
              type="submit"
              disabled={!content.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium hover:bg-[#586947] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>发布瞬间</span>
            </button>
          </div>
        </form>
      )}

      {/* Tag Filter */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-[var(--text-muted)]">
        <span>按标签翻阅：</span>
        <button
          type="button"
          onClick={() => setSelectedTag('')}
          className={`cursor-pointer ${
            selectedTag === '' ? 'font-semibold text-[#687a56] underline underline-offset-4' : ''
          }`}
        >
          全部 ({visibleMoments.length})
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

      {/* Organic Vertical Stream */}
      <div className="relative pl-6 sm:pl-8 border-l border-[var(--border-organic)] space-y-8">
        {filteredMoments.map((moment) => {
          const isEditing = editingId === moment.id;
          return (
            <div key={moment.id} className="relative group">
              {/* Botanical Node Dot */}
              <span className="absolute -left-[29px] sm:-left-[37px] top-2 w-3 h-3 rounded-full bg-[#8b9d77] ring-4 ring-[var(--bg-primary)]" />

              <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <time dateTime={moment.createdAt} className="font-medium text-[var(--text-primary)]">
                      {formatEditorialDate(moment.createdAt)}
                    </time>
                    {moment.weather && (
                      <>
                        <span>·</span>
                        <span>{moment.weather}</span>
                      </>
                    )}
                    {moment.mood && (
                      <>
                        <span>·</span>
                        <span>心情：{moment.mood}</span>
                      </>
                    )}
                    {moment.location && (
                      <>
                        <span>·</span>
                        <span>{moment.location}</span>
                      </>
                    )}
                    {moment.status === 'private' && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-[#d4a373] font-medium">
                          <Lock className="w-3 h-3" /> 私人记录
                        </span>
                      </>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(moment.id);
                          setEditContent(moment.content);
                          setEditStatus(moment.status);
                        }}
                        className="hover:text-[#687a56] flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>编辑</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMoment(moment.id)}
                        className="hover:text-[#b55346] flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>删除</span>
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as 'public' | 'private')}
                        aria-label="修改可见状态"
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                      >
                        <option value="public">公开</option>
                        <option value="private">私人</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded-lg text-xs border border-[var(--border-organic)] cursor-pointer"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await onUpdateMoment(moment.id, {
                              content: editContent,
                              status: editStatus,
                            });
                            setEditingId(null);
                          }}
                          className="px-3 py-1 rounded-lg text-xs bg-[#687a56] text-[#faf6f1] cursor-pointer"
                        >
                          保存修改
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line">
                    {moment.content}
                  </p>
                )}

                {moment.images.length > 0 && (
                  <div
                    className={`grid gap-3 pt-1 ${
                      moment.images.length === 1
                        ? 'grid-cols-1 max-w-md'
                        : 'grid-cols-2 sm:grid-cols-3'
                    }`}
                  >
                    {moment.images.map((imgUrl, idx) => (
                      <img
                        key={imgUrl + idx}
                        src={imgUrl}
                        alt="日常瞬间配图"
                        loading="lazy"
                        onClick={() => setLightboxImg(imgUrl)}
                        className="w-full h-48 object-cover rounded-xl border border-[var(--border-organic)] cursor-zoom-in hover:opacity-95 transition-opacity"
                      />
                    ))}
                  </div>
                )}

                {moment.tags.length > 0 && (
                  <div className="text-xs text-[var(--text-muted)] pt-1">
                    {moment.tags.map((t) => `#${t}`).join('  ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="瞬间照片大图"
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={lightboxImg}
            alt="放大查看"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
};
