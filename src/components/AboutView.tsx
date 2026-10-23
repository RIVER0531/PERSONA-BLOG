import React, { useState } from 'react';
import {
  MapPin,
  BookOpen,
  Music,
  ExternalLink,
  Edit3,
  Check,
  Sparkles,
} from 'lucide-react';
import type { SiteProfile } from '../types/garden';

interface AboutViewProps {
  profile: SiteProfile;
  isAdmin: boolean;
  onUpdateProfile: (updated: Partial<SiteProfile>) => Promise<void>;
}

export const AboutView: React.FC<AboutViewProps> = ({
  profile,
  isAdmin,
  onUpdateProfile,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [ownerTitle, setOwnerTitle] = useState(profile.ownerTitle);
  const [signature, setSignature] = useState(profile.signature);
  const [bio, setBio] = useState(profile.bio);
  const [currentLocation, setCurrentLocation] = useState(profile.currentLocation);
  const [currentReading, setCurrentReading] = useState(profile.currentReading);
  const [currentListening, setCurrentListening] = useState(profile.currentListening);
  const [interestsText, setInterestsText] = useState(profile.interests.join('，'));
  const [aboutContent, setAboutContent] = useState(profile.aboutContent);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateProfile({
        ownerName: ownerName.trim(),
        ownerTitle: ownerTitle.trim(),
        signature: signature.trim(),
        bio: bio.trim(),
        currentLocation: currentLocation.trim(),
        currentReading: currentReading.trim(),
        currentListening: currentListening.trim(),
        interests: interestsText
          .split(/[,，、]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        aboutContent,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Profile Hero Card */}
      <section className="p-6 sm:p-10 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-4 flex flex-col items-center text-center space-y-4">
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-[#e5dccb] shadow-md">
            <img
              src={profile.avatar}
              alt={profile.ownerName}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="font-serif-editorial text-2xl sm:text-3xl font-semibold">
              {profile.ownerName}
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {profile.ownerTitle}
            </p>
          </div>
        </div>

        <div className="md:col-span-8 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <blockquote className="font-serif-editorial text-lg sm:text-xl leading-relaxed text-[var(--text-primary)] border-l-2 border-[#8b9d77] pl-4">
              “{profile.signature}”
            </blockquote>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--border-organic)] text-xs font-medium hover:border-[#8b9d77] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#687a56]" />
                <span>{isEditing ? '取消编辑' : '编辑个人介绍'}</span>
              </button>
            )}
          </div>

          <p className="text-sm leading-relaxed text-[var(--text-body)]">
            {profile.bio}
          </p>

          {/* Now Status Strip */}
          <div className="pt-4 border-t border-[var(--border-organic)] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1">
              <span className="text-[var(--text-muted)] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#687a56]" /> 常居坐标
              </span>
              <p className="font-medium text-[var(--text-primary)]">
                {profile.currentLocation}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1">
              <span className="text-[var(--text-muted)] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#d4a373]" /> 最近在读
              </span>
              <p className="font-medium text-[var(--text-primary)] line-clamp-1">
                {profile.currentReading}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1">
              <span className="text-[var(--text-muted)] flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-[#687a56]" /> 最近常听
              </span>
              <p className="font-medium text-[var(--text-primary)] line-clamp-1">
                {profile.currentListening}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Admin Inline Profile Editor */}
      {isAdmin && isEditing && (
        <form
          onSubmit={handleSave}
          className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[#8b9d77] space-y-4"
        >
          <h2 className="font-serif-editorial text-xl font-semibold">
            修改关于页面与个人名片
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">园主名字</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">个人头衔 / 身份描述</label>
              <input
                type="text"
                value={ownerTitle}
                onChange={(e) => setOwnerTitle(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">个性签名</label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">个人简介</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">常居地</label>
              <input
                type="text"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">最近在读</label>
              <input
                type="text"
                value={currentReading}
                onChange={(e) => setCurrentReading(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">最近常听</label>
              <input
                type="text"
                value={currentListening}
                onChange={(e) => setCurrentListening(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              兴趣与偏爱（用逗号分隔）
            </label>
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              关于页长文介绍（支持 HTML 段落排版）
            </label>
            <textarea
              rows={6}
              value={aboutContent}
              onChange={(e) => setAboutContent(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? '正在保存…' : '保存个人介绍'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Main Content + Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Rich Editorial Self-Intro */}
        <div className="lg:col-span-8 p-6 sm:p-10 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
          <div
            className="garden-prose max-w-none"
            dangerouslySetInnerHTML={{ __html: profile.aboutContent }}
          />
        </div>

        {/* Right: Interests, Milestones & Contact */}
        <div className="lg:col-span-4 space-y-6">
          {/* Interests */}
          <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
            <h2 className="font-serif-editorial text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#d4a373]" />
              日常偏爱与兴趣
            </h2>
            <ul className="space-y-2 text-sm text-[var(--text-body)]">
              {profile.interests.map((interest) => (
                <li key={interest} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8b9d77]" />
                  <span>{interest}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Personal Journey / Milestones */}
          <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
            <h2 className="font-serif-editorial text-lg font-semibold">
              个人经历与花园纪事
            </h2>
            <div className="space-y-4 pl-3 border-l border-[var(--border-organic)]">
              {profile.milestones.map((ms) => (
                <div key={ms.year + ms.title} className="relative space-y-1">
                  <span className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-[#687a56]" />
                  <span className="text-xs font-mono font-semibold text-[#687a56]">
                    {ms.year}
                  </span>
                  <h3 className="font-serif-editorial text-sm font-medium">
                    {ms.title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {ms.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Social & Contact Links */}
          <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
            <h2 className="font-serif-editorial text-lg font-semibold">
              通信与联络方式
            </h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              这里不设评论区喧哗，若某篇文字恰好与你产生共鸣，欢迎写信给我，像老朋友一样慢速通信。
            </p>
            <div className="space-y-2.5">
              {profile.socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] hover:border-[#8b9d77] text-xs transition-colors"
                >
                  <span className="font-medium">{link.label}</span>
                  <span className="text-[var(--text-muted)] flex items-center gap-1">
                    {link.handle}
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
