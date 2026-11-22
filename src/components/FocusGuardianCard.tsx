import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Bell,
  BellOff,
  Info,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { focusGuardian } from '../utils/focusGuardianService';

interface FocusGuardianCardProps {
  isEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  isSessionActive: boolean;
  activeSubject?: string;
  remainingSeconds: number;
  distractionCount: number;
  motivationalMessage?: string;
  onNavigateToFocus?: () => void;
  variant?: 'compact' | 'full';
}

export const FocusGuardianCard: React.FC<FocusGuardianCardProps> = ({
  isEnabled,
  onToggleEnabled,
  isSessionActive,
  activeSubject = 'Physics',
  remainingSeconds,
  distractionCount,
  motivationalMessage = "You've got this! Return to your studies and complete your session.",
  onNavigateToFocus,
}) => {
  const [showTechInfo, setShowTechInfo] = useState<boolean>(false);
  const [permStatus, setPermStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(() =>
    focusGuardian.getPermissionStatus()
  );

  const formatRemainingTime = (secs: number) => {
    if (secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleRequestPermission = async () => {
    const res = await focusGuardian.requestPermission();
    setPermStatus(res);
  };

  const handleSwitchToggle = () => {
    const next = !isEnabled;
    onToggleEnabled(next);
    if (next && permStatus === 'default') {
      handleRequestPermission();
    }
  };

  return (
    <section className="rounded-xl border border-[#DDD3C1] bg-[#F3ECE0] p-5 space-y-4">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
              isEnabled
                ? isSessionActive
                  ? 'bg-[#14532D] text-[#FAF6EE] border-[#14532D]'
                  : 'bg-[#FAF6EE] text-[#14532D] border-[#B08D57]/50'
                : 'bg-[#E9E1D2] text-[#6B756F] border-[#D5CBB8]'
            }`}
          >
            {isEnabled ? (
              isSessionActive ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )
            ) : (
              <Shield className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-base font-semibold text-[#1C2420]">
                Focus Guardian
              </h3>
              <span className="text-xs text-[#4A554E]" aria-hidden="true">
                ·
              </span>
              <span
                className={`text-xs font-semibold ${
                  isEnabled
                    ? isSessionActive
                      ? 'text-[#14532D]'
                      : 'text-[#8C6B32]'
                    : 'text-[#6B756F]'
                }`}
              >
                {isEnabled ? (isSessionActive ? 'Monitoring Active' : 'Armed (ON)') : 'Standby (OFF)'}
              </span>
            </div>
            <p className="text-xs text-[#4A554E] mt-0.5 leading-relaxed">
              {isEnabled
                ? 'Detects tab switches or backgrounding and sends gentle return reminders.'
                : 'Enable before starting to record app-switching distraction events.'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="focus-guardian-toggle"
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label="Toggle Focus Guardian monitoring"
            onClick={handleSwitchToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C6B32] ${
              isEnabled
                ? 'bg-[#14532D] border-[#14532D]'
                : 'bg-[#D5CBB8] border-[#C2B6A0]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[#FAF6EE] shadow-sm transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>

          <button
            id="focus-guardian-info-trigger"
            type="button"
            onClick={() => setShowTechInfo(!showTechInfo)}
            className="p-1.5 rounded-lg text-[#4A554E] hover:text-[#1C2420] hover:bg-[#E7DEC9] transition-colors"
            title="Web Visibility Architecture & Privacy Notes"
            aria-label="Toggle Focus Guardian technical details"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Technical Sandbox Note */}
      {showTechInfo && (
        <div className="p-3.5 rounded-lg bg-[#FAF6EE] border border-[#DDD3C1] text-xs text-[#37423B] space-y-1.5">
          <div className="font-semibold text-[#8C6B32] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Web Platform Visibility Architecture</span>
          </div>
          <p className="leading-relaxed">
            Focus Guardian uses the standard <strong>W3C Page Visibility API</strong> (
            <code className="font-mono text-[#14532D]">document.visibilityState</code>) to detect
            when this study page loses foreground focus.
          </p>
          <p className="text-[#4A554E] leading-relaxed">
            <strong>Platform Limitation:</strong> Browser security sandboxes prevent web apps from
            inspecting other native Android or desktop processes or identifying which external app you
            opened. Navigating between chapters inside this study book does not count as leaving.
          </p>
        </div>
      )}

      {/* 4 Clean Status Ledger Readouts (No nested bordered cards or pills) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-[#DDD3C1]">
        <div>
          <span className="text-[11px] font-medium text-[#5A655E] block">Status</span>
          <span
            className={`text-sm font-semibold mt-0.5 block ${
              isEnabled ? 'text-[#14532D]' : 'text-[#5A655E]'
            }`}
          >
            {isEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-[#5A655E] block">Subject</span>
          <span className="text-sm font-semibold text-[#1C2420] mt-0.5 block truncate">
            {activeSubject || 'Standby'}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-[#5A655E] block">Remaining</span>
          <span className="font-mono text-sm font-semibold text-[#8C6B32] mt-0.5 flex items-center gap-1 tabular-nums">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{isSessionActive ? formatRemainingTime(remainingSeconds) : 'Ready'}</span>
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-[#5A655E] block">Distractions</span>
          <span
            className={`font-mono text-sm font-semibold mt-0.5 block tabular-nums ${
              distractionCount === 0 ? 'text-[#14532D]' : 'text-[#991B1B]'
            }`}
          >
            {distractionCount} {distractionCount === 1 ? 'event' : 'events'}
          </span>
        </div>
      </div>

      {/* Motivational Quote */}
      <p className="text-xs text-[#37423B] italic leading-relaxed">
        “{motivationalMessage}”
      </p>

      {/* Notification Permission & Optional Focus Jump */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div>
          {permStatus === 'granted' ? (
            <span className="inline-flex items-center gap-1.5 text-[#14532D] font-medium">
              <Bell className="w-3.5 h-3.5" />
              Browser reminders ready
            </span>
          ) : permStatus === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 text-[#8C6B32] font-medium">
              <BellOff className="w-3.5 h-3.5" />
              Browser notifications blocked (audio alert active)
            </span>
          ) : (
            <button
              id="enable-guardian-notifications"
              type="button"
              onClick={handleRequestPermission}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF6EE] hover:bg-[#EAE1D0] border border-[#D4C9B4] text-[#1C2420] font-medium transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-[#8C6B32]" />
              <span>Enable Reminder Alerts</span>
            </button>
          )}
        </div>

        {onNavigateToFocus && !isSessionActive && (
          <button
            id="guardian-go-to-focus-chamber"
            type="button"
            onClick={onNavigateToFocus}
            className="inline-flex items-center gap-1 font-semibold text-[#14532D] hover:text-[#0F291E] underline underline-offset-4 transition-colors"
          >
            <span>Open Focus Desk</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </section>
  );
};
