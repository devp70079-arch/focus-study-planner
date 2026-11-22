import React, { useState } from 'react';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  CalendarRange,
  Compass,
  Home,
  Menu,
  MessageSquareText,
  Settings,
  Timer,
  X,
} from 'lucide-react';
import { CommandCenterView } from '../types';

export interface NavItemConfig {
  id: CommandCenterView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface SidebarNavProps {
  activeView: CommandCenterView;
  onSelectView: (view: CommandCenterView) => void;
  onOpenAssistant: () => void;
  dueRevisionCount: number;
  overdueTaskCount: number;
  daysUntilExam: number | null;
  activeExamSubject: string;
  isFocusActive: boolean;
  focusFormattedTime: string;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeView,
  onSelectView,
  onOpenAssistant,
  dueRevisionCount,
  overdueTaskCount,
  daysUntilExam,
  activeExamSubject,
  isFocusActive,
  focusFormattedTime,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItemConfig[] = [
    { id: 'home', label: 'Home', shortLabel: 'Home', icon: Home },
    { id: 'strategist', label: 'Master Strategist', shortLabel: 'Strategist', icon: Compass },
    { id: 'syllabus', label: 'My Syllabus', shortLabel: 'Syllabus', icon: BookMarked },
    {
      id: 'planner',
      label: 'Study Planner',
      shortLabel: 'Planner',
      icon: CalendarRange,
      badge: overdueTaskCount > 0 ? overdueTaskCount : undefined,
    },
    {
      id: 'revision',
      label: 'Revision Center',
      shortLabel: 'Revision',
      icon: Brain,
      badge: dueRevisionCount > 0 ? dueRevisionCount : undefined,
    },
    { id: 'focus', label: 'Focus Mode', shortLabel: 'Focus', icon: Timer },
    { id: 'progress', label: 'Progress', shortLabel: 'Progress', icon: BarChart3 },
    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
  ];

  const activeItem = navItems.find((n) => n.id === activeView) || navItems[0];

  const handleNav = (id: CommandCenterView) => {
    onSelectView(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* 3-Zone Top Header Bar (Desktop & Mobile) */}
      <header className="no-print sticky top-0 z-30 h-14 bg-[#0F291E] border-b border-[#B08D57]/30 px-4 lg:px-6 flex items-center justify-between gap-3">
        {/* Left Zone: Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-1.5 rounded-lg bg-[#173D2D] text-[#E6CFA3] hover:bg-[#1E4F3A] transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleNav('home')}
            className="flex items-center gap-2.5 text-left min-w-0"
          >
            <div className="w-8 h-8 rounded-lg bg-[#173D2D] border border-[#B08D57]/50 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-[#E6CFA3]" />
            </div>
            <div className="min-w-0">
              <div className="font-serif text-sm sm:text-base font-semibold text-[#FAF6EE] leading-tight truncate">
                AI Academic Command Center
              </div>
              <div className="hidden sm:block text-[10px] text-[#B8C7BD] truncate">
                Its Last Chance For Focus
              </div>
            </div>
          </button>
        </div>

        {/* Center Zone: Current View & Exam Countdown / Live Timer */}
        <div className="hidden md:flex items-center gap-3 text-xs text-[#C8D4CC] min-w-0">
          <span className="font-medium text-[#FAF6EE] whitespace-nowrap">{activeItem.label}</span>
          <span aria-hidden="true" className="text-[#5A7566]">
            ·
          </span>
          {isFocusActive ? (
            <button
              type="button"
              onClick={() => handleNav('focus')}
              className="font-mono text-[#E6CFA3] font-semibold tabular-nums hover:underline whitespace-nowrap"
            >
              Focus Active {focusFormattedTime}
            </button>
          ) : daysUntilExam !== null ? (
            <span className="font-mono text-[#E6CFA3] tabular-nums truncate">
              {daysUntilExam}d until {activeExamSubject}
            </span>
          ) : (
            <span className="text-[#9DB2A4] whitespace-nowrap">Set exam date in Settings</span>
          )}
        </div>

        {/* Right Zone: 1 Primary Action (AI Study Assistant) */}
        <button
          id="open-study-assistant-button"
          type="button"
          onClick={onOpenAssistant}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#8C6B32] hover:bg-[#A17C3D] text-[#FAF6EE] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          <span>AI Tutor</span>
        </button>
      </header>

      {/* Desktop Fixed Left Sidebar (232px) */}
      <aside
        aria-label="Academic Command Center Navigation"
        className="no-print hidden lg:flex lg:flex-col lg:w-[232px] lg:fixed lg:top-14 lg:bottom-0 lg:left-0 bg-[#0F291E] border-r border-[#B08D57]/25 px-3 py-4 justify-between z-20"
      >
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#FAF6EE] text-[#1C2420] font-semibold shadow-sm'
                    : 'text-[#C8D4CC] hover:bg-[#173D2D] hover:text-[#FAF6EE]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#14532D]' : 'text-[#C8A66A]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                      isActive
                        ? 'bg-[#14532D] text-[#FAF6EE]'
                        : 'bg-[#8C6B32]/30 text-[#E6CFA3]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quiet Exam Status Footer in Sidebar */}
        <div className="pt-3 border-t border-[#1D4634] px-2 space-y-1">
          <div className="text-[11px] font-medium text-[#E6CFA3] truncate">
            {activeExamSubject}
          </div>
          <div className="text-[11px] font-mono text-[#9DB2A4] tabular-nums">
            {daysUntilExam !== null ? `${daysUntilExam} days remaining` : 'No exam date set'}
          </div>
        </div>
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#05100B]/75 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-[#0F291E] border-r border-[#B08D57]/35 h-full p-4 flex flex-col justify-between z-10 shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1D4634]">
                <span className="font-serif text-sm font-semibold text-[#FAF6EE]">
                  Command Center
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-[#173D2D] text-[#E6CFA3]"
                  aria-label="Close navigation menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-[#FAF6EE] text-[#1C2420] font-semibold'
                          : 'text-[#C8D4CC] hover:bg-[#173D2D] hover:text-[#FAF6EE]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${isActive ? 'text-[#14532D]' : 'text-[#C8A66A]'}`}
                        />
                        <span>{item.label}</span>
                      </span>
                      {item.badge !== undefined && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#8C6B32] text-[#FAF6EE] tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="pt-3 border-t border-[#1D4634] text-[11px] text-[#9DB2A4]">
              {daysUntilExam !== null
                ? `${daysUntilExam}d until ${activeExamSubject}`
                : 'Configure exams in Settings'}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
