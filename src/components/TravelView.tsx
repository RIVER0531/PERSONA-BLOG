import React, { useState, useRef } from 'react';
import {
  Compass,
  MapPin,
  BookOpen,
  Camera,
  Plus,
  Trash2,
  Calendar,
  Upload,
  Lock,
  Edit3,
} from 'lucide-react';
import type {
  TravelFootprint,
  Article,
  Album,
  SiteSectionTitles,
} from '../types/garden';
import { filterVisibleContent } from '../utils/gardenLogic';
import { compressAndUploadImage } from '../utils/api';

interface TravelViewProps {
  travels: TravelFootprint[];
  articles: Article[];
  albums: Album[];
  isAdmin: boolean;
  sectionTitles?: SiteSectionTitles;
  onCreateTravel: (travel: Partial<TravelFootprint>) => Promise<void>;
  onUpdateTravel?: (id: string, travel: Partial<TravelFootprint>) => Promise<void>;
  onDeleteTravel: (id: string) => Promise<void>;
  onOpenArticle: (articleId: string) => void;
  onOpenGallery: () => void;
}

export const TravelView: React.FC<TravelViewProps> = ({
  travels,
  articles,
  albums,
  isAdmin,
  sectionTitles,
  onCreateTravel,
  onUpdateTravel,
  onDeleteTravel,
  onOpenArticle,
  onOpenGallery,
}) => {
  const visibleTravels = filterVisibleContent(travels, isAdmin);
  const [activeTravelId, setActiveTravelId] = useState<string>(
    visibleTravels[0]?.id || ''
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTravelId, setEditingTravelId] = useState<string | null>(null);

  const pageTitle = sectionTitles?.travelPageTitle ?? '远行足迹 · 山海漫游手卷';
  const pageSubtitle =
    sectionTitles?.travelPageSubtitle ??
    '标记去过的山川、古镇与岛屿。将地理坐标与当时的游记、照片串联成一份长期生长的行旅地图。';
  const mapCaption =
    sectionTitles?.travelMapCaption ?? '点击坐标点切换目的地记录';

  // Form state
  const [destination, setDestination] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('中国');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [summary, setSummary] = useState('');
  const [story, setStory] = useState('');
  const [coordX, setCoordX] = useState(58);
  const [coordY, setCoordY] = useState(48);
  const [relatedArticleId, setRelatedArticleId] = useState('');
  const [relatedAlbumId, setRelatedAlbumId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<'public' | 'private'>('public');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTravel =
    visibleTravels.find((t) => t.id === activeTravelId) ||
    visibleTravels[0] ||
    null;

  const openCreateModal = () => {
    setEditingTravelId(null);
    setDestination('');
    setRegion('');
    setCountry('中国');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date().toISOString().slice(0, 10));
    setSummary('');
    setStory('');
    setCoordX(58);
    setCoordY(48);
    setRelatedArticleId('');
    setRelatedAlbumId('');
    setTagsInput('');
    setStatus('public');
    setPhotos([]);
    setShowAddModal(true);
  };

  const openEditModal = (trv: TravelFootprint) => {
    setEditingTravelId(trv.id);
    setDestination(trv.destination);
    setRegion(trv.region);
    setCountry(trv.country);
    setStartDate(trv.startDate);
    setEndDate(trv.endDate);
    setSummary(trv.summary);
    setStory(trv.story);
    setCoordX(trv.coordinates.x);
    setCoordY(trv.coordinates.y);
    setRelatedArticleId(trv.relatedArticleId || '');
    setRelatedAlbumId(trv.relatedAlbumId || '');
    setTagsInput(trv.tags.join('，'));
    setStatus(trv.status === 'private' ? 'private' : 'public');
    setPhotos(trv.photos);
    setShowAddModal(true);
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        const u = await compressAndUploadImage(file);
        urls.push(u);
      }
      setPhotos((prev) => [...prev, ...urls]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;
    const payload: Partial<TravelFootprint> = {
      destination: destination.trim(),
      region: region.trim(),
      country: country.trim() || '中国',
      startDate,
      endDate,
      summary: summary.trim(),
      story: story.trim(),
      coordinates: { x: coordX, y: coordY, lat: 30, lng: 115 },
      coverImage:
        photos[0] ||
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
      photos,
      relatedArticleId: relatedArticleId || undefined,
      relatedAlbumId: relatedAlbumId || undefined,
      tags: tagsInput
        .split(/[,，、\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      status,
    };

    if (editingTravelId && onUpdateTravel) {
      await onUpdateTravel(editingTravelId, payload);
    } else {
      await onCreateTravel(payload);
    }
    setShowAddModal(false);
    setEditingTravelId(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[var(--border-organic)]">
        <div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold">
            {pageTitle}
          </h1>
          {pageSubtitle && (
            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-xl">
              {pageSubtitle}
            </p>
          )}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium hover:bg-[#586947] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>点亮新足迹</span>
          </button>
        )}
      </div>

      {/* Interactive Hand-Crafted Topographic Footprints Map + Active Destination Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Stylized Organic SVG Map */}
        <div className="lg:col-span-7 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-3 z-10">
            <span className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#687a56]" />
              手绘等高线行旅图 · 点击坐标点切换目的地
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              已记录 {visibleTravels.length} 处远行坐标
            </span>
          </div>

          <div className="relative w-full h-72 sm:h-80 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-organic)] overflow-hidden">
            {/* Topographic Contours & Route SVG */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full opacity-55"
            >
              <path
                d="M-10,30 Q25,10 55,28 T110,20"
                fill="none"
                stroke="#8b9d77"
                strokeWidth="0.35"
                strokeDasharray="1.5 1"
              />
              <path
                d="M-5,55 Q35,35 65,58 T105,48"
                fill="none"
                stroke="#d4a373"
                strokeWidth="0.4"
              />
              <path
                d="M0,78 Q40,62 75,82 T110,70"
                fill="none"
                stroke="#8b9d77"
                strokeWidth="0.35"
              />
              <ellipse
                cx="32"
                cy="30"
                rx="22"
                ry="12"
                fill="none"
                stroke="#857263"
                strokeWidth="0.25"
                opacity="0.5"
              />
              <ellipse
                cx="68"
                cy="52"
                rx="26"
                ry="16"
                fill="none"
                stroke="#857263"
                strokeWidth="0.25"
                opacity="0.5"
              />

              {visibleTravels.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#687a56"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1.5"
                  points={visibleTravels
                    .map((t) => `${t.coordinates.x},${t.coordinates.y}`)
                    .join(' ')}
                />
              )}
            </svg>

            {/* Interactive Destination Pins */}
            {visibleTravels.map((travel) => {
              const isSelected = activeTravel?.id === travel.id;
              return (
                <button
                  key={travel.id}
                  type="button"
                  onClick={() => setActiveTravelId(travel.id)}
                  style={{
                    left: `${travel.coordinates.x}%`,
                    top: `${travel.coordinates.y}%`,
                  }}
                  aria-label={`查看足迹：${travel.destination}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer focus:outline-none"
                >
                  <span
                    className={`flex items-center justify-center rounded-full transition-all ${
                      isSelected
                        ? 'w-5 h-5 bg-[#687a56] text-[#faf6f1] ring-4 ring-[#8b9d77]/40 scale-110'
                        : 'w-3.5 h-3.5 bg-[#d4a373] hover:bg-[#687a56] ring-2 ring-[var(--bg-elevated)]'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                  <span
                    className={`mt-1 block whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-serif-editorial transition-all ${
                      isSelected
                        ? 'bg-[#5c4033] text-[#faf6f1] font-medium shadow-xs'
                        : 'bg-[var(--bg-elevated)]/90 text-[var(--text-primary)] border border-[var(--border-organic)]'
                    }`}
                  >
                    {travel.destination.split('·')[0].trim()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span>{mapCaption}</span>
            <span>离线手绘地图模式</span>
          </div>
        </div>

        {/* Selected Footprint Spotlight Card */}
        <div className="lg:col-span-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] overflow-hidden flex flex-col justify-between">
          {activeTravel ? (
            <>
              <div>
                <div className="h-52 overflow-hidden relative">
                  <img
                    src={activeTravel.coverImage}
                    alt={activeTravel.destination}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 space-y-3">
                  <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-x-2">
                    <span className="font-medium text-[#687a56]">
                      {activeTravel.country}
                      {activeTravel.region ? ` · ${activeTravel.region}` : ''}
                    </span>
                    <span>·</span>
                    <span>
                      {activeTravel.startDate} 至 {activeTravel.endDate}
                    </span>
                    {activeTravel.status === 'private' && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-[#d4a373]">
                          <Lock className="w-3 h-3" /> 私密足迹
                        </span>
                      </>
                    )}
                  </div>

                  <h2 className="font-serif-editorial text-2xl font-semibold">
                    {activeTravel.destination}
                  </h2>

                  {activeTravel.summary && (
                    <p className="text-xs text-[var(--text-muted)] italic">
                      {activeTravel.summary}
                    </p>
                  )}

                  {activeTravel.story && (
                    <p className="text-sm leading-relaxed pt-1">
                      {activeTravel.story}
                    </p>
                  )}
                </div>
              </div>

              <div className="px-6 pb-6 pt-3 border-t border-[var(--border-organic)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {activeTravel.relatedArticleId && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenArticle(activeTravel.relatedArticleId!)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8b9d77]/15 text-[#687a56] text-xs font-medium hover:bg-[#8b9d77]/25 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>阅读关联游记</span>
                    </button>
                  )}
                  {activeTravel.relatedAlbumId && (
                    <button
                      type="button"
                      onClick={onOpenGallery}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-organic)] text-xs hover:border-[#8b9d77] cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#d4a373]" />
                      <span>浏览旅行相册</span>
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-3">
                    {onUpdateTravel && (
                      <button
                        type="button"
                        onClick={() => openEditModal(activeTravel)}
                        className="text-xs text-[#687a56] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>编辑</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteTravel(activeTravel.id)}
                      className="text-xs text-[var(--text-muted)] hover:text-[#b55346] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              暂无旅行记录
            </div>
          )}
        </div>
      </div>

      {/* Chronological Travel Chronicles List */}
      <div className="space-y-6">
        <h2 className="font-serif-editorial text-2xl font-semibold">
          历年行旅档案 ({visibleTravels.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleTravels.map((trv) => (
            <div
              key={trv.id}
              onClick={() => setActiveTravelId(trv.id)}
              className={`p-6 rounded-2xl bg-[var(--bg-elevated)] border transition-all cursor-pointer space-y-4 ${
                activeTravel?.id === trv.id
                  ? 'border-[#687a56]'
                  : 'border-[var(--border-organic)] hover:border-[#8b9d77]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[#687a56] font-medium">
                      <MapPin className="w-3.5 h-3.5" />
                      {trv.country}
                      {trv.region ? ` · ${trv.region}` : ''}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {trv.startDate}
                    </span>
                  </div>
                  <h3 className="font-serif-editorial text-xl font-semibold mt-1">
                    {trv.destination}
                  </h3>
                </div>
                {isAdmin && onUpdateTravel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(trv);
                    }}
                    className="text-xs text-[#687a56] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>编辑</span>
                  </button>
                )}
              </div>

              {trv.summary && (
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {trv.summary}
                </p>
              )}

              {trv.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {trv.photos.slice(0, 2).map((p, idx) => (
                    <img
                      key={p + idx}
                      src={p}
                      alt={trv.destination}
                      loading="lazy"
                      className="w-full h-32 object-cover rounded-xl border border-[var(--border-organic)]"
                    />
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>{trv.tags.map((t) => `#${t}`).join('  ')}</span>
                {trv.relatedArticleId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenArticle(trv.relatedArticleId!);
                    }}
                    className="text-[#687a56] font-medium hover:underline cursor-pointer"
                  >
                    阅读游记 →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Travel Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingTravelId ? '编辑远行足迹' : '点亮新足迹'}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
        >
          <form
            onSubmit={handleSaveSubmit}
            className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-6 space-y-4 my-8"
          >
            <h3 className="font-serif-editorial text-xl font-semibold">
              {editingTravelId ? '编辑远行足迹' : '记录一段新的远行足迹'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  目的地名称
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="例如：景德镇 · 丙丁柴窑"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  区域 / 省份
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="选填"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  国家 / 地区
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  出发日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  返程日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                一句话旅途印象
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="简短概括这次旅行的气息……"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                行旅详细故事记录
              </label>
              <textarea
                rows={3}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="写下旅途中遇到的人、小店与风景……"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                标签（用逗号分隔）
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="例如：慢行，山野"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  关联游记文章
                </label>
                <select
                  value={relatedArticleId}
                  onChange={(e) => setRelatedArticleId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                >
                  <option value="">不关联</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  关联摄影相册
                </label>
                <select
                  value={relatedAlbumId}
                  onChange={(e) => setRelatedAlbumId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                >
                  <option value="">不关联</option>
                  {albums.map((al) => (
                    <option key={al.id} value={al.id}>
                      {al.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  地图横坐标 (10-90)
                </label>
                <input
                  type="number"
                  min={10}
                  max={90}
                  value={coordX}
                  onChange={(e) => setCoordX(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  地图纵坐标 (15-85)
                </label>
                <input
                  type="number"
                  min={15}
                  max={85}
                  value={coordY}
                  onChange={(e) => setCoordY(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  可见状态
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as 'public' | 'private')
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                >
                  <option value="public">公开</option>
                  <option value="private">私人</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-organic)] text-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#687a56]" />
                <span>
                  {isUploading ? '上传中…' : `上传旅途照片 (${photos.length})`}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handlePhotoUpload(e.target.files)}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTravelId(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs border border-[var(--border-organic)] cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-[#687a56] text-[#faf6f1] cursor-pointer"
                >
                  保存足迹
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
