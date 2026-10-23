import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Sparkles,
  Compass,
  Bookmark,
  Camera,
  Lock,
  ArrowRight,
} from 'lucide-react';
import type { GardenDatabase, TimelineEvent } from '../types/garden';
import { buildTimelineEvents } from '../utils/gardenLogic';

interface TimelineViewProps {
  garden: GardenDatabase;
  isAdmin: boolean;
  onNavigateEvent: (event: TimelineEvent) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  garden,
  isAdmin,
  onNavigateEvent,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  const allEvents = useMemo(
    () => buildTimelineEvents(garden, isAdmin, 'all', 'all'),
    [garden, isAdmin]
  );

  const availableYears = useMemo(
    () => Array.from(new Set(allEvents.map((e) => e.year))).sort((a, b) => Number(b) - Number(a)),
    [allEvents]
  );

  const filteredEvents = useMemo(
    () => buildTimelineEvents(garden, isAdmin, filterType, filterYear),
    [garden, isAdmin, filterType, filterYear]
  );

  // Group by Year -> Month
  const groupedByYearMonth = useMemo(() => {
    const map = new Map<string, Map<string, TimelineEvent[]>>();
    filteredEvents.forEach((ev) => {
      if (!map.has(ev.year)) {
        map.set(ev.year, new Map());
      }
      const yearMap = map.get(ev.year)!;
      if (!yearMap.has(ev.month)) {
        yearMap.set(ev.month, []);
      }
      yearMap.get(ev.month)!.push(ev);
    });
    return Array.from(map.entries()).map(([year, monthsMap]) => ({
      year,
      months: Array.from(monthsMap.entries()).map(([month, items]) => ({
        month,
        items,
      })),
    }));
  }, [filteredEvents]);

  const getTypeIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'article':
        return <BookOpen className="w-3.5 h-3.5 text-[#687a56]" />;
      case 'moment':
        return <Sparkles className="w-3.5 h-3.5 text-[#d4a373]" />;
      case 'travel':
        return <Compass className="w-3.5 h-3.5 text-[#687a56]" />;
      case 'collection':
        return <Bookmark className="w-3.5 h-3.5 text-[#d4a373]" />;
      case 'album':
        return <Camera className="w-3.5 h-3.5 text-[#687a56]" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Header */}
      <div className="pb-8 border-b border-[var(--border-organic)]">
        <h1 className="font-serif-editorial text-3xl sm:text-4xl font-semibold">
          {garden.profile.sectionTitles?.timelinePageTitle ??
            '岁月年轮 · 全站记忆时间线'}
        </h1>
        {(garden.profile.sectionTitles?.timelinePageSubtitle ??
          '自动汇聚每一篇长文手记、日常瞬间、远行足迹、相册与收藏。') && (
          <p className="text-sm text-[var(--text-muted)] mt-2 max-w-2xl">
            {garden.profile.sectionTitles?.timelinePageSubtitle ??
              '自动汇聚每一篇长文手记、日常瞬间、远行足迹、相册与收藏。多年以后重返此处，依然能清晰看见当时的自己走过了哪些地方、想过什么问题。'}
          </p>
        )}
      </div>

      {/* Interactive Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)]">
        <div
          role="tablist"
          aria-label="时间线内容类型筛选"
          className="flex flex-wrap items-center gap-1.5"
        >
          {[
            { id: 'all', label: `全部记录 (${allEvents.length})` },
            { id: 'article', label: '长文手记' },
            { id: 'moment', label: '日常瞬间' },
            { id: 'travel', label: '远行足迹' },
            { id: 'collection', label: '兴趣收藏' },
            { id: 'album', label: '光影相册' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filterType === tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                filterType === tab.id
                  ? 'bg-[#687a56] text-[#faf6f1]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)]">年份：</span>
          <button
            type="button"
            onClick={() => setFilterYear('all')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer ${
              filterYear === 'all'
                ? 'bg-[var(--bg-muted)] font-semibold text-[var(--text-primary)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            全部年份
          </button>
          {availableYears.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setFilterYear(yr)}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                filterYear === yr
                  ? 'bg-[var(--bg-muted)] font-semibold text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {yr}年
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Year & Month Timeline */}
      <div className="space-y-12">
        {groupedByYearMonth.map(({ year, months }) => (
          <section key={year} className="space-y-8">
            <div className="flex items-baseline gap-4">
              <h2 className="font-serif-editorial text-3xl sm:text-4xl font-semibold text-[#687a56]">
                {year} 年
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                共收录 {months.reduce((acc, m) => acc + m.items.length, 0)} 处生活印记
              </span>
            </div>

            <div className="space-y-8 pl-4 sm:pl-6 border-l border-[var(--border-organic)]">
              {months.map(({ month, items }) => (
                <div key={`${year}-${month}`} className="space-y-4">
                  <div className="flex items-center gap-3 -ml-[23px] sm:-ml-[31px]">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#d4a373] ring-4 ring-[var(--bg-primary)]" />
                    <h3 className="font-serif-editorial text-lg font-semibold">
                      {month} 月
                    </h3>
                  </div>

                  <div className="space-y-4 pl-2">
                    {items.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => onNavigateEvent(ev)}
                        className="group p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-organic)] hover:border-[#8b9d77] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-x-2">
                            <span className="tabular-nums font-medium text-[var(--text-primary)]">
                              {ev.month}月{ev.day}日
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                              {getTypeIcon(ev.type)}
                              {ev.typeLabel}
                            </span>
                            {ev.meta && (
                              <>
                                <span>·</span>
                                <span>{ev.meta}</span>
                              </>
                            )}
                            {ev.status === 'private' && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-[#d4a373]">
                                  <Lock className="w-3 h-3" /> 私人
                                </span>
                              </>
                            )}
                          </div>

                          <h4 className="font-serif-editorial text-lg font-medium group-hover:text-[#687a56] transition-colors">
                            {ev.title}
                          </h4>

                          <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                            {ev.summary}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          {ev.coverImage && (
                            <img
                              src={ev.coverImage}
                              alt={ev.title}
                              loading="lazy"
                              className="w-20 h-14 object-cover rounded-xl border border-[var(--border-organic)]"
                            />
                          )}
                          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#687a56] group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
