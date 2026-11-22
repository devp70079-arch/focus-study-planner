import React from 'react';
import { Timer, Moon, Calendar, BarChart3, BookOpen } from 'lucide-react';

export type ChapterTab = 'focus' | 'night_plan' | 'weekly' | 'analytics';

interface NavbarProps {
  activeTab: ChapterTab;
  setActiveTab: (tab: ChapterTab) => void;
  todayHoursStudied: number;
  dailyTargetHours: number;
  timeRemainingToday: string;
}

const CHAPTERS: Array<{
  id: ChapterTab;
  desktopId: string;
  mobileId: string;
  numeral: string;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'focus',
    desktopId: 'nav-tab-focus',
    mobileId: 'mobile-tab-focus',
    numeral: 'I',
    label: 'Focus Desk',
    shortLabel: 'Focus',
    icon: Timer,
  },
  {
    id: 'night_plan',
    desktopId: 'nav-tab-night-plan',
    mobileId: 'mobile-tab-night-plan',
    numeral: 'II',
    label: 'Night Plan',
    shortLabel: 'Night',
    icon: Moon,
  },
  {
    id: 'weekly',
    desktopId: 'nav-tab-weekly',
    mobileId: 'mobile-tab-weekly',
    numeral: 'III',
    label: 'Timetable',
    shortLabel: 'Week',
    icon: Calendar,
  },
  {
    id: 'analytics',
    desktopId: 'nav-tab-analytics',
    mobileId: 'mobile-tab-analytics',
    numeral: 'IV',
    label: 'Study Ledger',
    shortLabel: 'Ledger',
    icon: BarChart3,
  },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  todayHoursStudied,
  dailyTargetHours,
  timeRemainingToday,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0C2218]/95 backdrop-blur border-b border-[#B08D57]/25 text-[#FAF6EE]">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Strictly 3-Zone Top Bar Contract */}
        <div className="flex items-center justify-between gap-8 h-14 sm:h-16">
          {/* Zone 1: Single-line Brand Title */}
          <button
            type="button"
            onClick={() => setActiveTab('focus')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B08D57] rounded"
          >
            <BookOpen className="w-5 h-5 text-[#C8A66A] shrink-0" />
            <span className="font-serif font-semibold text-base sm:text-lg tracking-tight text-[#FAF6EE]">
              Its Last Chance For Focus
            </span>
          </button>

          {/* Zone 2: Clean Text Navigation Links */}
          <nav
            aria-label="Study Book Chapters"
            className="hidden lg:flex items-center gap-7"
          >
            {CHAPTERS.map((ch) => {
              const isActive = activeTab === ch.id;
              return (
                <button
                  key={ch.id}
                  id={ch.desktopId}
                  type="button"
                  onClick={() => setActiveTab(ch.id)}
                  className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B08D57] rounded ${
                    isActive
                      ? 'text-[#E6CFA3]'
                      : 'text-[#C6D1CA] hover:text-[#FAF6EE]'
                  }`}
                >
                  <span className="font-serif italic text-[#B08D57] mr-1.5">
                    {ch.numeral}.
                  </span>
                  <span>{ch.label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#C8A66A]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Clean Daily Progress Readout */}
          <div className="flex items-center gap-4 shrink-0 whitespace-nowrap">
            <div className="text-right">
              <span className="font-mono text-xs sm:text-sm font-semibold text-[#E6CFA3] tabular-nums">
                {todayHoursStudied.toFixed(1)} / {dailyTargetHours.toFixed(1)}h
              </span>
              <span className="hidden sm:inline text-xs text-[#9BB0A3] mx-2" aria-hidden="true">
                ·
              </span>
              <span className="hidden sm:inline font-mono text-xs text-[#C6D1CA] tabular-nums">
                {timeRemainingToday} left today
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Compact Chapter Tabs (keeps aggregate sticky height well below 15%) */}
        <nav
          aria-label="Mobile Study Book Chapters"
          className="lg:hidden flex items-center justify-between border-t border-[#B08D57]/20 py-1.5 gap-1 overflow-x-auto"
        >
          {CHAPTERS.map((ch) => {
            const Icon = ch.icon;
            const isActive = activeTab === ch.id;
            return (
              <button
                key={ch.id}
                id={ch.mobileId}
                type="button"
                onClick={() => setActiveTab(ch.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#173D2D] text-[#E6CFA3] border border-[#B08D57]/40'
                    : 'text-[#B4C4BA] hover:text-[#FAF6EE]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ch.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
