import React, { useState, useRef } from 'react';
import {
  MapPin,
  BookOpen,
  Music,
  ExternalLink,
  Edit3,
  Check,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Quote,
  List,
  Minus,
} from 'lucide-react';
import type { SiteProfile, LifeMilestone, SocialLink } from '../types/garden';
import { compressAndUploadImage } from '../utils/api';

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
  const [avatar, setAvatar] = useState(profile.avatar);
  const [signature, setSignature] = useState(profile.signature);
  const [bio, setBio] = useState(profile.bio);
  const [currentLocation, setCurrentLocation] = useState(profile.currentLocation);
  const [currentReading, setCurrentReading] = useState(profile.currentReading);
  const [currentListening, setCurrentListening] = useState(profile.currentListening);
  const [interestsText, setInterestsText] = useState(profile.interests.join('，'));
  const [aboutContent, setAboutContent] = useState(profile.aboutContent);
  const [milestones, setMilestones] = useState<LifeMilestone[]>(profile.milestones || []);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(profile.socialLinks || []);
  const [contactIntro, setContactIntro] = useState(
    profile.sectionTitles?.contactIntro ??
      '这里不设评论区喧哗，若某篇文字恰好与你产生共鸣，欢迎写信给我，像老朋友一样慢速通信。'
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const aboutEditorRef = useRef<HTMLDivElement>(null);

  const openEditor = () => {
    setOwnerName(profile.ownerName);
    setOwnerTitle(profile.ownerTitle);
    setAvatar(profile.avatar);
    setSignature(profile.signature);
    setBio(profile.bio);
    setCurrentLocation(profile.currentLocation);
    setCurrentReading(profile.currentReading);
    setCurrentListening(profile.currentListening);
    setInterestsText(profile.interests.join('，'));
    setAboutContent(profile.aboutContent);
    setMilestones(profile.milestones || []);
    setSocialLinks(profile.socialLinks || []);
    setContactIntro(
      profile.sectionTitles?.contactIntro ??
        '这里不设评论区喧哗，若某篇文字恰好与你产生共鸣，欢迎写信给我，像老朋友一样慢速通信。'
    );
    setIsEditing(true);
  };

  const handleAvatarUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingAvatar(true);
    try {
      const uploadedUrl = await compressAndUploadImage(files[0]);
      setAvatar(uploadedUrl);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const execAboutFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (aboutEditorRef.current) {
      setAboutContent(aboutEditorRef.current.innerHTML);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const latestHtml = aboutEditorRef.current
        ? aboutEditorRef.current.innerHTML
        : aboutContent;
      await onUpdateProfile({
        ownerName: ownerName.trim(),
        ownerTitle: ownerTitle.trim(),
        avatar: avatar.trim(),
        signature: signature.trim(),
        bio: bio.trim(),
        currentLocation: currentLocation.trim(),
        currentReading: currentReading.trim(),
        currentListening: currentListening.trim(),
        interests: interestsText
          .split(/[,，、]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        aboutContent: latestHtml,
        milestones: milestones.filter((m) => m.year.trim() || m.title.trim()),
        socialLinks: socialLinks.filter((s) => s.label.trim() && s.url.trim()),
        sectionTitles: {
          ...(profile.sectionTitles || {}),
          contactIntro: contactIntro.trim(),
        },
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const displayedContactIntro =
    profile.sectionTitles?.contactIntro !== undefined
      ? profile.sectionTitles.contactIntro
      : '这里不设评论区喧哗，若某篇文字恰好与你产生共鸣，欢迎写信给我，像老朋友一样慢速通信。';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Profile Hero Card */}
      <section className="p-6 sm:p-10 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-4 flex flex-col items-center text-center space-y-4">
          {profile.avatar && (
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-[#e5dccb] shadow-md">
              <img
                src={profile.avatar}
                alt={profile.ownerName}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div>
            <h1 className="font-serif-editorial text-2xl sm:text-3xl font-semibold">
              {profile.ownerName}
            </h1>
            {profile.ownerTitle && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {profile.ownerTitle}
              </p>
            )}
          </div>
        </div>

        <div className="md:col-span-8 space-y-5">
          <div className="flex items-start justify-between gap-4">
            {profile.signature ? (
              <blockquote className="font-serif-editorial text-lg sm:text-xl leading-relaxed text-[var(--text-primary)] border-l-2 border-[#8b9d77] pl-4">
                “{profile.signature}”
              </blockquote>
            ) : (
              <div />
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => (isEditing ? setIsEditing(false) : openEditor())}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--border-organic)] text-xs font-medium hover:border-[#8b9d77] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#687a56]" />
                <span>{isEditing ? '收起编辑面板' : '自定义本页全部内容'}</span>
              </button>
            )}
          </div>

          {profile.bio && (
            <p className="text-sm leading-relaxed text-[var(--text-body)]">
              {profile.bio}
            </p>
          )}

          {/* Now Status Strip */}
          {(profile.currentLocation || profile.currentReading || profile.currentListening) && (
            <div className="pt-4 border-t border-[var(--border-organic)] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {profile.currentLocation && (
                <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1">
                  <span className="text-[var(--text-muted)] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#687a56]" /> 常居坐标
                  </span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {profile.currentLocation}
                  </p>
                </div>
              )}
              {profile.currentReading && (
                <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1">
                  <span className="text-[var(--text-muted)] flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-[#d4a373]" /> 最近在读
                  </span>
                  <p className="font-medium text-[var(--text-primary)] line-clamp-1">
                    {profile.currentReading}
                  </p>
                </div>
              )}
              {profile.currentListening && (
                <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] space-y-1">
                  <span className="text-[var(--text-muted)] flex items-center gap-1">
                    <Music className="w-3.5 h-3.5 text-[#687a56]" /> 最近常听
                  </span>
                  <p className="font-medium text-[var(--text-primary)] line-clamp-1">
                    {profile.currentListening}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Admin Visual Profile & About Page Editor (Zero HTML/Code needed) */}
      {isAdmin && isEditing && (
        <form
          onSubmit={handleSave}
          className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border-2 border-[#8b9d77] space-y-6"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-organic)] pb-3">
            <div>
              <h2 className="font-serif-editorial text-xl font-semibold">
                自定义关于页面、头像、经历大事记与联系方式
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                所有栏目均支持直接可视化修改或清空；若某一项留空，页面会自动隐藏对应区块。
              </p>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? '正在保存…' : '保存全部修改'}</span>
            </button>
          </div>

          {/* 1. Basic Identity & Avatar Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">博主名字 / 昵称</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">个人头衔 / 身份描述（可留空）</label>
              <input
                type="text"
                value={ownerTitle}
                onChange={(e) => setOwnerTitle(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">头像图片（支持上传或填链接）</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="头像图片地址"
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-primary)] text-xs hover:border-[#8b9d77] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#687a56]" />
                  <span>{isUploadingAvatar ? '上传中' : '上传头像'}</span>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarUpload(e.target.files)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">关于页顶部金句 / 个性签名（可留空）</label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                日常偏爱与兴趣标签（用逗号分隔，留空则隐藏该卡片）
              </label>
              <input
                type="text"
                value={interestsText}
                onChange={(e) => setInterestsText(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">个人简介（同时显示在首页名片与关于页顶部）</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">常居坐标（可留空）</label>
              <input
                type="text"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">最近在读（可留空）</label>
              <input
                type="text"
                value={currentReading}
                onChange={(e) => setCurrentReading(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">最近常听（可留空）</label>
              <input
                type="text"
                value={currentListening}
                onChange={(e) => setCurrentListening(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>
          </div>

          {/* 2. Visual WYSIWYG Editor for About Content */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text-primary)]">
              关于页长文自述（所见即所得可视化编辑，无需写任何代码）
            </label>
            <div className="rounded-2xl border border-[var(--border-organic)] bg-[var(--bg-primary)] overflow-hidden">
              <div className="px-3 py-2 border-b border-[var(--border-organic)] bg-[var(--bg-elevated)] flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => execAboutFormat('formatBlock', '<h2>')}
                  className="px-2.5 py-1 rounded-lg text-xs hover:bg-[var(--bg-muted)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Heading2 className="w-3.5 h-3.5" /> 大标题
                </button>
                <button
                  type="button"
                  onClick={() => execAboutFormat('formatBlock', '<h3>')}
                  className="px-2.5 py-1 rounded-lg text-xs hover:bg-[var(--bg-muted)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Heading3 className="w-3.5 h-3.5" /> 小标题
                </button>
                <button
                  type="button"
                  onClick={() => execAboutFormat('formatBlock', '<p>')}
                  className="px-2.5 py-1 rounded-lg text-xs hover:bg-[var(--bg-muted)] cursor-pointer"
                >
                  正文段落
                </button>
                <button
                  type="button"
                  onClick={() => execAboutFormat('bold')}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)] cursor-pointer"
                  title="加粗"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execAboutFormat('italic')}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)] cursor-pointer"
                  title="斜体"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execAboutFormat('formatBlock', '<blockquote>')}
                  className="px-2.5 py-1 rounded-lg text-xs hover:bg-[var(--bg-muted)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Quote className="w-3.5 h-3.5" /> 引用框
                </button>
                <button
                  type="button"
                  onClick={() => execAboutFormat('insertUnorderedList')}
                  className="px-2.5 py-1 rounded-lg text-xs hover:bg-[var(--bg-muted)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <List className="w-3.5 h-3.5" /> 列表
                </button>
                <button
                  type="button"
                  onClick={() => execAboutFormat('insertHorizontalRule')}
                  className="px-2.5 py-1 rounded-lg text-xs hover:bg-[var(--bg-muted)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" /> 分割线
                </button>
              </div>
              <div
                ref={aboutEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setAboutContent(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: aboutContent }}
                className="p-5 min-h-[220px] garden-prose max-w-none focus:outline-none"
              />
            </div>
          </div>

          {/* 3. Visual Editor for Personal Milestones */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-organic)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif-editorial text-base font-semibold">
                  个人经历与花园纪事（可自由增删改，全部删除则隐藏该卡片）
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  setMilestones([
                    ...milestones,
                    { year: new Date().getFullYear().toString(), title: '', description: '' },
                  ])
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-primary)] text-xs font-medium hover:border-[#8b9d77] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#687a56]" />
                <span>添加经历节点</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {milestones.map((ms, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                >
                  <input
                    type="text"
                    value={ms.year}
                    onChange={(e) => {
                      const next = [...milestones];
                      next[idx] = { ...next[idx], year: e.target.value };
                      setMilestones(next);
                    }}
                    placeholder="年份 (如 2026)"
                    className="sm:col-span-2 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <input
                    type="text"
                    value={ms.title}
                    onChange={(e) => {
                      const next = [...milestones];
                      next[idx] = { ...next[idx], title: e.target.value };
                      setMilestones(next);
                    }}
                    placeholder="事件标题"
                    className="sm:col-span-4 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <input
                    type="text"
                    value={ms.description}
                    onChange={(e) => {
                      const next = [...milestones];
                      next[idx] = { ...next[idx], description: e.target.value };
                      setMilestones(next);
                    }}
                    placeholder="详细描述"
                    className="sm:col-span-5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <button
                    type="button"
                    onClick={() => setMilestones(milestones.filter((_, i) => i !== idx))}
                    className="sm:col-span-1 p-1.5 text-[var(--text-muted)] hover:text-[#b55346] flex justify-center cursor-pointer"
                    title="删除该节点"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Visual Editor for Social & Contact Links */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-organic)]">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-editorial text-base font-semibold">
                通信与联络方式（可自定义导语与链接，全部清空则隐藏）
              </h3>
              <button
                type="button"
                onClick={() =>
                  setSocialLinks([...socialLinks, { label: '', handle: '', url: '' }])
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-organic)] bg-[var(--bg-primary)] text-xs font-medium hover:border-[#8b9d77] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#687a56]" />
                <span>添加联络方式</span>
              </button>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">联络卡片说明文字</label>
              <input
                type="text"
                value={contactIntro}
                onChange={(e) => setContactIntro(e.target.value)}
                placeholder="例如：欢迎写信与我交流……"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)]"
              />
            </div>

            <div className="space-y-2.5">
              {socialLinks.map((link, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-organic)] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                >
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => {
                      const next = [...socialLinks];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setSocialLinks(next);
                    }}
                    placeholder="名称 (如 个人邮箱 / 微信 / GitHub)"
                    className="sm:col-span-3 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <input
                    type="text"
                    value={link.handle || ''}
                    onChange={(e) => {
                      const next = [...socialLinks];
                      next[idx] = { ...next[idx], handle: e.target.value };
                      setSocialLinks(next);
                    }}
                    placeholder="显示文本 (如 river@example.com)"
                    className="sm:col-span-4 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <input
                    type="text"
                    value={link.url}
                    onChange={(e) => {
                      const next = [...socialLinks];
                      next[idx] = { ...next[idx], url: e.target.value };
                      setSocialLinks(next);
                    }}
                    placeholder="跳转链接 (如 mailto:... 或 https://...)"
                    className="sm:col-span-4 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-organic)]"
                  />
                  <button
                    type="button"
                    onClick={() => setSocialLinks(socialLinks.filter((_, i) => i !== idx))}
                    className="sm:col-span-1 p-1.5 text-[var(--text-muted)] hover:text-[#b55346] flex justify-center cursor-pointer"
                    title="删除该联络方式"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl border border-[var(--border-organic)] text-xs cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#687a56] text-[#faf6f1] text-xs font-medium cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? '正在保存…' : '保存全部个人介绍设置'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Main Content + Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Rich Editorial Self-Intro */}
        <div
          className={`${
            profile.interests.length > 0 ||
            profile.milestones.length > 0 ||
            profile.socialLinks.length > 0 ||
            displayedContactIntro
              ? 'lg:col-span-8'
              : 'lg:col-span-12'
          } p-6 sm:p-10 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]`}
        >
          <div
            className="garden-prose max-w-none"
            dangerouslySetInnerHTML={{ __html: profile.aboutContent }}
          />
        </div>

        {/* Right: Interests, Milestones & Contact (Each card hides if empty) */}
        {(profile.interests.length > 0 ||
          profile.milestones.length > 0 ||
          profile.socialLinks.length > 0 ||
          displayedContactIntro) && (
          <div className="lg:col-span-4 space-y-6">
            {/* Interests */}
            {profile.interests.length > 0 && (
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
            )}

            {/* Personal Journey / Milestones */}
            {profile.milestones.length > 0 && (
              <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
                <h2 className="font-serif-editorial text-lg font-semibold">
                  个人经历与花园纪事
                </h2>
                <div className="space-y-4 pl-3 border-l border-[var(--border-organic)]">
                  {profile.milestones.map((ms, idx) => (
                    <div key={ms.year + ms.title + idx} className="relative space-y-1">
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
            )}

            {/* Social & Contact Links */}
            {(profile.socialLinks.length > 0 || displayedContactIntro) && (
              <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] space-y-4">
                <h2 className="font-serif-editorial text-lg font-semibold">
                  通信与联络方式
                </h2>
                {displayedContactIntro && (
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {displayedContactIntro}
                  </p>
                )}
                {profile.socialLinks.length > 0 && (
                  <div className="space-y-2.5">
                    {profile.socialLinks.map((link, idx) => (
                      <a
                        key={link.label + idx}
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
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
