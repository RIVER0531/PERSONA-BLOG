import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Plus,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  Lock,
  Trash2,
  MapPin,
  Edit3,
} from 'lucide-react';
import type { Album, PhotoItem, SiteSectionTitles } from '../types/garden';
import { filterVisibleContent } from '../utils/gardenLogic';
import { compressAndUploadImage } from '../utils/api';

interface GalleryViewProps {
  albums: Album[];
  sectionTitles?: SiteSectionTitles;
  isAdmin: boolean;
  onCreateAlbum: (album: Partial<Album>) => Promise<void>;
  onUpdateAlbum: (id: string, album: Partial<Album>) => Promise<void>;
  onDeleteAlbum: (id: string) => Promise<void>;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  albums,
  sectionTitles,
  isAdmin,
  onCreateAlbum,
  onUpdateAlbum,
  onDeleteAlbum,
}) => {
  const visibleAlbums = filterVisibleContent(albums, isAdmin);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Album form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCoverImage, setNewCoverImage] = useState('');
  const [newStatus, setNewStatus] = useState<'public' | 'private'>('public');

  // Batch upload state
  const [targetAlbumId, setTargetAlbumId] = useState<string>(
    visibleAlbums[0]?.id || ''
  );
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoCamera, setPhotoCamera] = useState('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const displayedAlbums =
    selectedAlbumId === 'all'
      ? visibleAlbums
      : visibleAlbums.filter((a) => a.id === selectedAlbumId);

  const flatPhotos: Array<PhotoItem & { albumTitle: string; albumStatus: string }> =
    displayedAlbums.flatMap((al) =>
      al.photos.map((p) => ({
        ...p,
        albumTitle: al.title,
        albumStatus: al.status,
      }))
    );

  // Keyboard navigation in Lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev !== null ? (prev + 1) % flatPhotos.length : null
        );
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev !== null
            ? (prev - 1 + flatPhotos.length) % flatPhotos.length
            : null
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, flatPhotos.length]);

  const handleBatchFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const u = await compressAndUploadImage(file);
        urls.push(u);
      }
      setUploadedUrls((prev) => [...prev, ...urls]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const album = albums.find((a) => a.id === (targetAlbumId || visibleAlbums[0]?.id));
    if (!album || uploadedUrls.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const newPhotoItems: PhotoItem[] = uploadedUrls.map((url, idx) => ({
      id: `ph-${Date.now()}-${idx}`,
      url,
      title:
        uploadedUrls.length > 1 && photoTitle
          ? `${photoTitle} (${idx + 1})`
          : photoTitle || album.title,
      caption: photoCaption,
      camera: photoCamera,
      takenAt: today,
      location: album.location,
    }));
    await onUpdateAlbum(album.id, {
      coverImage: album.coverImage || newPhotoItems[0].url,
      photos: [...newPhotoItems, ...album.photos],
    });
    setUploadedUrls([]);
    setPhotoTitle('');
    setPhotoCaption('');
    setShowUploadModal(false);
  };

  const handleCreateAlbumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (editingAlbumId) {
      await onUpdateAlbum(editingAlbumId, {
        title: newTitle.trim(),
        description: newDesc.trim(),
        category: newCategory.trim() || '摄影集',
        location: newLocation.trim(),
        coverImage: newCoverImage.trim() || undefined,
        status: newStatus,
      });
    } else {
      await onCreateAlbum({
        title: newTitle.trim(),
        description: newDesc.trim(),
        category: newCategory.trim() || '摄影集',
        location: newLocation.trim(),
        coverImage: newCoverImage.trim() || undefined,
        status: newStatus,
        date: new Date().toISOString().slice(0, 10),
        photos: [],
      });
    }
    setNewTitle('');
    setNewDesc('');
    setNewCategory('');
    setNewLocation('');
    setNewCoverImage('');
    setEditingAlbumId(null);
    setShowCreateModal(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[var(--border-organic)]">
        <div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold">
            {sectionTitles?.galleryPageTitle || '光影相册 · 胶片与自然切片'}
          </h1>
          {(sectionTitles?.galleryPageSubtitle ??
            '用镜头与自然光线留存的四季影集。') !== '' && (
            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-xl">
              {sectionTitles?.galleryPageSubtitle ??
                '用镜头与自然光线留存的四季影集。'}
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingAlbumId(null);
                setNewTitle('');
                setNewDesc('');
                setNewCategory('');
                setNewLocation('');
                setNewCoverImage('');
                setNewStatus('public');
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-elevated)] text-xs font-medium hover:border-[#8b9d77] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#687a56]" />
              <span>新建相册</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTargetAlbumId(visibleAlbums[0]?.id || '');
                setShowUploadModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium hover:bg-[#586947] cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>批量上传照片</span>
            </button>
          </div>
        )}
      </div>

      {/* Album Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <button
          type="button"
          onClick={() => setSelectedAlbumId('all')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
            selectedAlbumId === 'all'
              ? 'border-[#687a56] bg-[#8b9d77]/15'
              : 'border-[var(--border-organic)] bg-[var(--bg-elevated)] hover:border-[#8b9d77]'
          }`}
        >
          <div>
            <span className="text-xs text-[#687a56] font-medium">全部光影</span>
            <h2 className="font-serif-editorial text-lg font-semibold mt-1">
              所有相册精选流
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              按画廊瀑布流浏览全部摄影作品
            </p>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-4">
            共 {visibleAlbums.reduce((acc, a) => acc + a.photos.length, 0)} 张照片
          </p>
        </button>

        {visibleAlbums.map((album) => (
          <div
            key={album.id}
            onClick={() => setSelectedAlbumId(album.id)}
            className={`group rounded-2xl border overflow-hidden transition-all cursor-pointer flex flex-col ${
              selectedAlbumId === album.id
                ? 'border-[#687a56] ring-2 ring-[#8b9d77]/30 bg-[var(--bg-elevated)]'
                : 'border-[var(--border-organic)] bg-[var(--bg-elevated)] hover:border-[#8b9d77]'
            }`}
          >
            <div className="h-32 overflow-hidden relative">
              <img
                src={album.coverImage}
                alt={album.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                  <span>{album.category} · {album.location}</span>
                  {album.status === 'private' && (
                    <Lock className="w-3.5 h-3.5 text-[#d4a373]" />
                  )}
                </div>
                <h3 className="font-serif-editorial text-base font-semibold mt-1 line-clamp-1">
                  {album.title}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                  {album.description}
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--border-organic)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>{album.photos.length} 张照片 · {album.date}</span>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`编辑相册 ${album.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAlbumId(album.id);
                        setNewTitle(album.title);
                        setNewDesc(album.description);
                        setNewCategory(album.category);
                        setNewLocation(album.location);
                        setNewCoverImage(album.coverImage);
                        setNewStatus(album.status);
                        setShowCreateModal(true);
                      }}
                      className="hover:text-[#687a56] p-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除相册 ${album.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAlbum(album.id);
                      }}
                      className="hover:text-[#b55346] p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Photo Grid / Masonry Display */}
      {flatPhotos.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] text-center">
          <p className="font-serif-editorial text-base">该相册暂无照片，点击右上角「批量上传照片」添加作品。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {flatPhotos.map((photo, idx) => (
            <figure
              key={photo.id}
              onClick={() => setLightboxIndex(idx)}
              className="group rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] overflow-hidden hover:border-[#8b9d77] transition-all cursor-zoom-in flex flex-col"
            >
              <div className="h-64 overflow-hidden bg-[var(--bg-muted)]">
                <img
                  src={photo.url}
                  alt={photo.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                />
              </div>
              <figcaption className="p-4 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-serif-editorial text-base font-medium text-[var(--text-primary)]">
                    {photo.title}
                  </h4>
                  {photo.caption && (
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">
                      {photo.caption}
                    </p>
                  )}
                </div>
                <div className="pt-2 text-[11px] text-[var(--text-muted)] flex flex-wrap items-center gap-x-2">
                  {photo.camera && (
                    <span className="inline-flex items-center gap-1">
                      <Camera className="w-3 h-3 text-[#687a56]" />
                      {photo.camera}
                    </span>
                  )}
                  {photo.location && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {photo.location}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span>{photo.takenAt}</span>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox with Keyboard & Mobile Touch Swipe */}
      {lightboxIndex !== null && flatPhotos[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="全屏大图浏览"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            if (delta > 50) {
              setLightboxIndex(
                (lightboxIndex - 1 + flatPhotos.length) % flatPhotos.length
              );
            } else if (delta < -50) {
              setLightboxIndex((lightboxIndex + 1) % flatPhotos.length);
            }
            touchStartX.current = null;
          }}
          className="fixed inset-0 z-50 bg-black/90 text-[#faf6f1] flex flex-col justify-between p-4 sm:p-8"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/70">
              {lightboxIndex + 1} / {flatPhotos.length} · {flatPhotos[lightboxIndex].albumTitle}
            </span>
            <button
              type="button"
              aria-label="关闭大图浏览"
              onClick={() => setLightboxIndex(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative flex-1 flex items-center justify-center my-4">
            <button
              type="button"
              aria-label="上一张照片"
              onClick={() =>
                setLightboxIndex(
                  (lightboxIndex - 1 + flatPhotos.length) % flatPhotos.length
                )
              }
              className="absolute left-2 sm:left-6 p-3 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <img
              src={flatPhotos[lightboxIndex].url}
              alt={flatPhotos[lightboxIndex].title}
              className="max-h-[72vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
            />

            <button
              type="button"
              aria-label="下一张照片"
              onClick={() =>
                setLightboxIndex((lightboxIndex + 1) % flatPhotos.length)
              }
              className="absolute right-2 sm:right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-2xl mx-auto text-center space-y-1">
            <h3 className="font-serif-editorial text-lg font-medium">
              {flatPhotos[lightboxIndex].title}
            </h3>
            {flatPhotos[lightboxIndex].caption && (
              <p className="text-xs text-white/75">{flatPhotos[lightboxIndex].caption}</p>
            )}
            <p className="text-[11px] text-white/55">
              {[
                flatPhotos[lightboxIndex].camera,
                flatPhotos[lightboxIndex].lens,
                flatPhotos[lightboxIndex].location,
                flatPhotos[lightboxIndex].takenAt,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Create Album Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="新建相册"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateAlbumSubmit}
            className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-6 space-y-4"
          >
            <h3 className="font-serif-editorial text-xl font-semibold">
              {editingAlbumId ? '编辑相册信息' : '新建摄影相册'}
            </h3>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">相册名称</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="例如：冬雪漫行"
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">相册描述（可留空）</label>
              <textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="记录这组照片背后的心境……"
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">相册分类</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="例如：日常静物"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">拍摄地点（可留空）</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="例如：书房 / 旅途"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">相册封面图片 URL（可留空自动取首张）</label>
              <input
                type="text"
                value={newCoverImage}
                onChange={(e) => setNewCoverImage(e.target.value)}
                placeholder="https://... 或 /uploads/..."
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">可见权限</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'public' | 'private')}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              >
                <option value="public">公开相册（所有访客可见）</option>
                <option value="private">私人相册（仅园主可见）</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingAlbumId(null);
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs border border-[var(--border-organic)] cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs bg-[#687a56] text-[#faf6f1] cursor-pointer"
              >
                {editingAlbumId ? '保存修改' : '创建相册'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Batch Upload Modal */}
      {showUploadModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="批量上传图片"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleConfirmBatchUpload}
            className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] p-6 space-y-4"
          >
            <h3 className="font-serif-editorial text-xl font-semibold">批量上传照片至相册</h3>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">选择目标相册</label>
              <select
                value={targetAlbumId}
                onChange={(e) => setTargetAlbumId(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              >
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.status === 'private' ? '私密' : '公开'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                type="button"
                onClick={() => batchInputRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-[var(--border-organic)] rounded-2xl text-xs text-[var(--text-muted)] hover:border-[#8b9d77] flex flex-col items-center gap-2 cursor-pointer"
              >
                <Upload className="w-5 h-5 text-[#687a56]" />
                <span>
                  {isUploading
                    ? '正在压缩并上传照片……'
                    : '点击选择一张或多张本地照片（自动压缩优化存储）'}
                </span>
              </button>
              <input
                ref={batchInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleBatchFiles(e.target.files)}
              />
            </div>

            {uploadedUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedUrls.map((u, idx) => (
                  <img
                    key={u + idx}
                    src={u}
                    alt="已上传"
                    className="w-16 h-16 object-cover rounded-lg border border-[var(--border-organic)]"
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">照片标题</label>
                <input
                  type="text"
                  value={photoTitle}
                  onChange={(e) => setPhotoTitle(e.target.value)}
                  placeholder="例如：雨后的苔庭"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">拍摄器材</label>
                <input
                  type="text"
                  value={photoCamera}
                  onChange={(e) => setPhotoCamera(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">文字说明</label>
              <input
                type="text"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="记录拍摄时的光影与故事"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl text-xs border border-[var(--border-organic)] cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={uploadedUrls.length === 0}
                className="px-4 py-2 rounded-xl text-xs bg-[#687a56] text-[#faf6f1] disabled:opacity-50 cursor-pointer"
              >
                保存至相册 ({uploadedUrls.length})
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
