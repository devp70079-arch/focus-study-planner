import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Globe,
  Plus,
  X,
} from 'lucide-react';
import { DistractionSettings } from '../types';

interface DistractionShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DistractionSettings;
  onUpdateSettings: (settings: DistractionSettings) => void;
}

export type FocusPreset = 'deep_work' | 'light_review' | 'hardcore_lock' | 'custom';

interface AppBlockItem {
  id: string;
  name: string;
  url: string;
}

const DEFAULT_BLOCKABLE_APPS: AppBlockItem[] = [
  { id: 'instagram', name: 'Instagram & Reels', url: 'instagram.com' },
  { id: 'youtube', name: 'YouTube & Shorts', url: 'youtube.com' },
  { id: 'whatsapp', name: 'WhatsApp Web', url: 'web.whatsapp.com' },
  { id: 'reddit', name: 'Reddit & Forums', url: 'reddit.com' },
  { id: 'tiktok', name: 'TikTok Shorts', url: 'tiktok.com' },
  { id: 'netflix', name: 'Netflix Streaming', url: 'netflix.com' },
  { id: 'discord', name: 'Discord Chat', url: 'discord.com' },
  { id: 'twitter', name: 'X / Twitter', url: 'x.com' },
  { id: 'twitch', name: 'Twitch Streams', url: 'twitch.tv' },
  { id: 'games', name: 'Browser Games', url: 'poki.com' },
];

const PRESETS: Record<
  FocusPreset,
  { name: string; desc: string; blockedIds: string[]; label: string; tabAlarm: boolean }
> = {
  deep_work: {
    name: 'Strict Deep Work',
    desc: 'Blocks social media, short videos, streaming, and games for unbroken study flow.',
    blockedIds: ['instagram', 'youtube', 'reddit', 'tiktok', 'netflix', 'twitter', 'twitch', 'games'],
    label: 'Recommended',
    tabAlarm: true,
  },
  light_review: {
    name: 'Gentle Review',
    desc: 'Blocks heavy entertainment and gaming while keeping messaging accessible.',
    blockedIds: ['instagram', 'tiktok', 'netflix', 'games', 'twitch'],
    label: 'Flexible',
    tabAlarm: false,
  },
  hardcore_lock: {
    name: 'Hardcore Last Chance',
    desc: 'Full digital fortress. Blocks all distracting apps and enables window-blur alarms.',
    blockedIds: [
      'instagram',
      'youtube',
      'whatsapp',
      'reddit',
      'tiktok',
      'netflix',
      'discord',
      'twitter',
      'twitch',
      'games',
    ],
    label: 'Zero Tolerance',
    tabAlarm: true,
  },
  custom: {
    name: 'Custom Rules',
    desc: 'Handpick specific apps and websites to keep off your study desk.',
    blockedIds: [],
    label: 'Custom',
    tabAlarm: true,
  },
};

function derivePresetFromStrictMode(
  strictMode: DistractionSettings['strictMode']
): FocusPreset {
  if (strictMode === 'hardcore_last_chance' || strictMode === true) return 'hardcore_lock';
  if (strictMode === 'gentle' || strictMode === false) return 'light_review';
  return 'deep_work';
}

export const DistractionShieldModal: React.FC<DistractionShieldModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activePreset, setActivePreset] = useState<FocusPreset>(() =>
    derivePresetFromStrictMode(settings.strictMode)
  );
  const [blockedAppIds, setBlockedAppIds] = useState<string[]>(
    settings.blockedApps || PRESETS.deep_work.blockedIds
  );
  const [allowedEduApps, setAllowedEduApps] = useState<string[]>(
    settings.allowedEducationalApps || ['youtube_edu', 'khan_academy', 'ncert_pdf', 'wikipedia']
  );
  const [customWebsites, setCustomWebsites] = useState<string[]>(
    settings.blockedWebsites || ['facebook.com', 'quora.com', 'pinterest.com']
  );
  const [newCustomSite, setNewCustomSite] = useState<string>('');
  const [zenModeActive, setZenModeActive] = useState<boolean>(settings.zenModeActive ?? true);
  const [tabAlarm, setTabAlarm] = useState<boolean>(settings.tabSwitchAlarm ?? true);
  const [focusGuardianEnabled, setFocusGuardianEnabled] = useState<boolean>(
    settings.focusGuardianEnabled !== false
  );
  const [showSavedNotification, setShowSavedNotification] = useState<boolean>(false);

  // Resync modal state whenever opened or settings update externally
  useEffect(() => {
    if (!isOpen) return;
    setActivePreset(derivePresetFromStrictMode(settings.strictMode));
    setBlockedAppIds(settings.blockedApps || PRESETS.deep_work.blockedIds);
    setAllowedEduApps(
      settings.allowedEducationalApps || ['youtube_edu', 'khan_academy', 'ncert_pdf', 'wikipedia']
    );
    setCustomWebsites(settings.blockedWebsites || ['facebook.com', 'quora.com', 'pinterest.com']);
    setZenModeActive(settings.zenModeActive ?? true);
    setTabAlarm(settings.tabSwitchAlarm ?? true);
    setFocusGuardianEnabled(settings.focusGuardianEnabled !== false);
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleApplyPreset = (presetKey: FocusPreset) => {
    setActivePreset(presetKey);
    if (presetKey !== 'custom') {
      const p = PRESETS[presetKey];
      setBlockedAppIds(p.blockedIds);
      setTabAlarm(p.tabAlarm);
    }
  };

  const toggleAppBlock = (appId: string) => {
    setActivePreset('custom');
    if (blockedAppIds.includes(appId)) {
      setBlockedAppIds(blockedAppIds.filter((id) => id !== appId));
    } else {
      setBlockedAppIds([...blockedAppIds, appId]);
    }
  };

  const handleAddCustomSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomSite.trim()) return;
    const cleanUrl = newCustomSite.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!customWebsites.includes(cleanUrl)) {
      setCustomWebsites([...customWebsites, cleanUrl]);
    }
    setNewCustomSite('');
  };

  const handleRemoveCustomSite = (site: string) => {
    setCustomWebsites(customWebsites.filter((s) => s !== site));
  };

  const handleSaveSettings = () => {
    const mappedStrictMode: DistractionSettings['strictMode'] =
      activePreset === 'hardcore_lock'
        ? 'hardcore_last_chance'
        : activePreset === 'light_review'
        ? 'gentle'
        : 'strict';

    const updated: DistractionSettings = {
      ...settings,
      blockedApps: blockedAppIds,
      allowedEducationalApps: allowedEduApps,
      blockedWebsites: customWebsites,
      zenModeActive,
      tabSwitchAlarm: tabAlarm,
      focusGuardianEnabled,
      strictMode: mappedStrictMode,
    };
    onUpdateSettings(updated);
    setShowSavedNotification(true);
    setTimeout(() => {
      setShowSavedNotification(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07140E]/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FAF6EE] border border-[#B08D57] rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto book-scroll">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E5DCCB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0F291E] text-[#E6CFA3] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-[#1C2420]">
                Distraction Shields &amp; Strictness
              </h3>
              <p className="text-xs text-[#4A554E] mt-0.5">
                Configure protection intensity, Focus Guardian monitoring, and distraction rules.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#F2ECE0] border border-[#DDD3C1] text-[#4A554E] hover:text-[#1C2420] transition-colors"
            aria-label="Close Distraction Shields"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#1C2420]">Protection Level</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(PRESETS) as FocusPreset[]).map((key) => {
              const p = PRESETS[key];
              const isSelected = activePreset === key;

              return (
                <button
                  key={key}
                  id={`preset-${key}`}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  className={`p-3.5 rounded-xl border text-left transition-colors ${
                    isSelected
                      ? 'bg-[#0F291E] border-[#0F291E] text-[#FAF6EE]'
                      : 'bg-[#F3ECE0] border-[#D8CEBC] text-[#1C2420] hover:border-[#B08D57]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <span
                      className={`text-[11px] font-medium ${
                        isSelected ? 'text-[#E6CFA3]' : 'text-[#8C6B32]'
                      }`}
                    >
                      {p.label}
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isSelected ? 'text-[#C6D1CA]' : 'text-[#4A554E]'
                    }`}
                  >
                    {p.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shield Toggles */}
        <div className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl p-4 space-y-3">
          <h4 className="font-serif text-sm font-semibold text-[#1C2420]">
            Monitoring &amp; Alerts
          </h4>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-3 p-3 bg-[#FAF6EE] rounded-lg border border-[#DDD3C1]">
              <div>
                <div className="font-semibold text-[#1C2420]">Zen Mode Desk Immersion</div>
                <div className="text-[#4A554E] mt-0.5">
                  Suppresses non-essential prompts during active focus blocks
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={zenModeActive}
                onClick={() => setZenModeActive(!zenModeActive)}
                className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center shrink-0 ${
                  zenModeActive ? 'bg-[#14532D] justify-end' : 'bg-[#D5CBB8] justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-[#FAF6EE] rounded-full shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-[#FAF6EE] rounded-lg border border-[#DDD3C1]">
              <div>
                <div className="font-semibold text-[#1C2420]">Tab Switch Acoustic Alert</div>
                <div className="text-[#4A554E] mt-0.5">
                  Plays a warning tone if you switch away from your study page
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={tabAlarm}
                onClick={() => setTabAlarm(!tabAlarm)}
                className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center shrink-0 ${
                  tabAlarm ? 'bg-[#14532D] justify-end' : 'bg-[#D5CBB8] justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-[#FAF6EE] rounded-full shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-[#FAF6EE] rounded-lg border border-[#DDD3C1]">
              <div>
                <div className="font-semibold text-[#1C2420]">
                  Focus Guardian Visibility Monitoring
                </div>
                <div className="text-[#4A554E] mt-0.5">
                  Tracks app backgrounding and sends rate-limited study reminders
                </div>
              </div>
              <button
                id="modal-toggle-focus-guardian"
                type="button"
                role="switch"
                aria-checked={focusGuardianEnabled}
                onClick={() => setFocusGuardianEnabled(!focusGuardianEnabled)}
                className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center shrink-0 ${
                  focusGuardianEnabled ? 'bg-[#14532D] justify-end' : 'bg-[#D5CBB8] justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-[#FAF6EE] rounded-full shadow-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* App Checklist */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1C2420]">
              Blocked Distraction Targets ({blockedAppIds.length} active)
            </span>
            <span className="text-[#5A655E]">Click to toggle</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEFAULT_BLOCKABLE_APPS.map((app) => {
              const isBlocked = blockedAppIds.includes(app.id);

              return (
                <button
                  key={app.id}
                  id={`block-toggle-${app.id}`}
                  type="button"
                  onClick={() => toggleAppBlock(app.id)}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-left transition-colors ${
                    isBlocked
                      ? 'bg-[#F3ECE0] border-[#8C6B32] text-[#1C2420]'
                      : 'bg-[#FAF6EE] border-[#E5DCCB] text-[#6B756F] opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{app.name}</div>
                    <div className="text-[10px] text-[#5A655E] truncate">{app.url}</div>
                  </div>
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isBlocked ? 'bg-[#14532D] text-[#FAF6EE]' : 'bg-[#E5DCCB] text-[#5A655E]'
                    }`}
                  >
                    {isBlocked ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Domains */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-[#1C2420] block">
            Custom Blocked Domains
          </label>

          <form onSubmit={handleAddCustomSite} className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-[#7A847D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={newCustomSite}
                onChange={(e) => setNewCustomSite(e.target.value)}
                placeholder="e.g. reddit.com, twitch.tv"
                className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg pl-9 pr-3 py-2 text-xs text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0F291E] hover:bg-[#173D2D] text-[#FAF6EE] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2 text-xs text-[#37423B]">
            {customWebsites.map((site) => (
              <span
                key={site}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F2ECE0] border border-[#DDD3C1]"
              >
                <span>{site}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomSite(site)}
                  className="text-[#5A655E] hover:text-[#991B1B]"
                  aria-label={`Remove ${site}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Allowed Educational Apps Whitelist */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#1C2420]">
            Allowed Educational Apps ({allowedEduApps.length} whitelisted)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'youtube_edu', name: 'YouTube (Edu)' },
              { id: 'khan_academy', name: 'Khan Academy' },
              { id: 'ncert_pdf', name: 'PDF / Textbooks' },
              { id: 'wikipedia', name: 'Wikipedia' },
              { id: 'github_docs', name: 'GitHub / Docs' },
              { id: 'coursera_nptel', name: 'NPTEL / Coursera' },
            ].map((item) => {
              const allowed = allowedEduApps.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setAllowedEduApps((prev) =>
                      prev.includes(item.id)
                        ? prev.filter((x) => x !== item.id)
                        : [...prev, item.id]
                    )
                  }
                  className={`p-2 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-colors ${
                    allowed
                      ? 'bg-[#E8F3EC] border-[#14532D]/40 text-[#14532D]'
                      : 'bg-[#FAF6EE] border-[#E5DCCB] text-[#6B756F]'
                  }`}
                >
                  <span className="truncate">{item.name}</span>
                  <span className="font-mono text-[10px] font-bold">{allowed ? 'OK' : 'Off'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Transparent Web Browser Capability Disclosure */}
        <div className="p-3 rounded-xl bg-[#FEF9EC] border border-[#E5C98B] text-[11px] text-[#594A29] leading-relaxed">
          <strong>Web Browser Scope:</strong> Focus Guardian actively monitors tab switches, app backgrounding, fullscreen lock, and acoustic alerts inside your browser. A web app cannot force-close native Android apps — these allow/block rules serve as your personal study contract and ready-to-sync policy for a native Android wrapper (see Settings for the Android UsageStatsManager integration spec).
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-[#E5DCCB] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#4A554E] font-semibold text-xs border border-[#DDD3C1] transition-colors"
          >
            Cancel
          </button>

          <button
            id="apply-distraction-shield-settings-button"
            type="button"
            onClick={handleSaveSettings}
            className="flex-1 py-2.5 px-5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-[#E6CFA3]" />
            <span>
              {showSavedNotification ? 'Shield Settings Saved!' : 'Save Shield Settings'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
