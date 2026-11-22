import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Task,
  StudySession,
  DistractionSettings,
  StudyMode,
  MODE_DURATIONS,
  PendingSprintRequest,
} from '../types';
import { audioEngine } from '../utils/audioEngine';
import { focusGuardian } from '../utils/focusGuardianService';
import { FocusGuardianCard } from './FocusGuardianCard';

interface FocusChamberProps {
  tasks: Task[];
  onCompleteTask: (taskId: string) => void;
  onSaveSession: (session: StudySession) => void;
  onUpdateSession?: (sessionId: string, patch: Partial<StudySession>) => void;
  settings: DistractionSettings;
  onUpdateSettings: (settings: DistractionSettings) => void;
  todayHoursStudied: number;
  studyStreakDays?: number;
  onSessionStateChange?: (state: {
    isActive: boolean;
    isPaused: boolean;
    timeLeft: number;
    subject: string;
    topic: string;
    strikes: number;
    mode: StudyMode;
  }) => void;
  onAmbientTrackChange?: (track: string) => void;
  pendingSprint?: PendingSprintRequest | null;
  onSprintHandled?: () => void;
  mobilePage?: 'left' | 'right';
}

const STUDY_QUOTES = [
  'Depth of focus determines the depth of mastery.',
  'An uninterrupted hour outweighs three fragmented ones.',
  'Keep the phone out of reach until the page is complete.',
  'Quiet persistence turns difficult chapters into certainty.',
];

const SUBJECTS = [
  { name: 'Physics', color: '#1D4ED8' },
  { name: 'Chemistry', color: '#047857' },
  { name: 'Mathematics', color: '#6D28D9' },
  { name: 'Biology', color: '#BE185D' },
  { name: 'Computer Science', color: '#B45309' },
  { name: 'English', color: '#0E7490' },
  { name: 'Revision', color: '#374151' },
];

export const FocusChamber: React.FC<FocusChamberProps> = ({
  tasks,
  onCompleteTask,
  onSaveSession,
  onUpdateSession,
  settings,
  onUpdateSettings,
  todayHoursStudied,
  studyStreakDays = 0,
  onSessionStateChange,
  onAmbientTrackChange,
  pendingSprint,
  onSprintHandled,
  mobilePage = 'left',
}) => {
  const [mode, setMode] = useState<StudyMode>('sprint_50_10');
  const [customMinutes, setCustomMinutes] = useState<number>(40);
  const [selectedSubject, setSelectedSubject] = useState<string>('Physics');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedSyllabusTopicId, setSelectedSyllabusTopicId] = useState<string | undefined>(undefined);
  const [sessionNotes, setSessionNotes] = useState<string>('');

  const [timeLeft, setTimeLeft] = useState<number>(MODE_DURATIONS.sprint_50_10);
  const [flowTimeSeconds, setFlowTimeSeconds] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Anti-Distraction States
  const [isFullscreenLock, setIsFullscreenLock] = useState<boolean>(false);
  const [distractionStrikes, setDistractionStrikes] = useState<number>(0);
  const [showDistractionWarning, setShowDistractionWarning] = useState<boolean>(false);
  const [showEmergencyPauseModal, setShowEmergencyPauseModal] = useState<boolean>(false);
  const [pauseReflection, setPauseReflection] = useState<string>('');
  const [pauseCountdown, setPauseCountdown] = useState<number>(10);
  const [phonePhysicallyLocked, setPhonePhysicallyLocked] = useState<boolean>(true);
  const [activeSound, setActiveSound] = useState<string>('none');
  const [soundVolume, setSoundVolume] = useState<number>(0.5);
  const [quoteIndex, setQuoteIndex] = useState<number>(0);
  const [victoryModal, setVictoryModal] = useState<{
    show: boolean;
    sessionId: string;
    plannedMinutes: number;
    minutes: number;
    subject: string;
    topic: string;
    strikes: number;
    guardianProtected?: boolean;
  } | null>(null);
  const [insightQuestionsPracticed, setInsightQuestionsPracticed] = useState<number>(0);
  const [insightConfidence, setInsightConfidence] = useState<1 | 2 | 3 | 4 | 5>(4);

  const containerRef = useRef<HTMLDivElement>(null);
  const initialDurationRef = useRef<number>(MODE_DURATIONS.sprint_50_10);
  const lastDistractionAtRef = useRef<number>(0);

  // Synchronize live session state to parent / dashboard
  useEffect(() => {
    if (onSessionStateChange) {
      onSessionStateChange({
        isActive,
        isPaused,
        timeLeft: mode === 'flowtime' ? flowTimeSeconds : timeLeft,
        subject: selectedSubject,
        topic: selectedTopic,
        strikes: distractionStrikes,
        mode,
      });
    }
  }, [
    isActive,
    isPaused,
    timeLeft,
    flowTimeSeconds,
    selectedSubject,
    selectedTopic,
    distractionStrikes,
    mode,
    onSessionStateChange,
  ]);

  // Handle sprint / voice / task focus launch
  useEffect(() => {
    if (!pendingSprint) return;
    const requestedMode: StudyMode =
      pendingSprint.mode ||
      (pendingSprint.durationMinutes <= 25
        ? 'pomodoro'
        : pendingSprint.durationMinutes === 50
        ? 'sprint_50_10'
        : 'custom');
    const mins = Math.max(1, pendingSprint.durationMinutes);
    const dur = mins * 60;
    setMode(requestedMode);
    if (requestedMode === 'custom') setCustomMinutes(mins);
    if (pendingSprint.subject) {
      setSelectedSubject(pendingSprint.subject);
    }
    if (pendingSprint.topic) {
      setSelectedTopic(pendingSprint.topic);
    }
    setSelectedSyllabusTopicId(pendingSprint.syllabusTopicId);
    initialDurationRef.current = requestedMode === 'flowtime' ? 0 : dur;
    setTimeLeft(requestedMode === 'flowtime' ? 0 : dur);
    setFlowTimeSeconds(0);
    setDistractionStrikes(0);
    setShowDistractionWarning(false);
    setShowEmergencyPauseModal(false);
    setIsActive(true);
    setIsPaused(false);
    if (activeSound !== 'none') {
      audioEngine.playAmbient(activeSound as any);
      audioEngine.setVolume(soundVolume);
      onAmbientTrackChange?.(activeSound);
    }
    onSprintHandled?.();
  }, [pendingSprint, activeSound, soundVolume, onAmbientTrackChange, onSprintHandled]);

  // Switch mode handler
  const handleModeChange = (newMode: StudyMode) => {
    if (isActive) {
      audioEngine.stopAmbient();
      onAmbientTrackChange?.('none');
    }
    setMode(newMode);
    setIsActive(false);
    setIsPaused(false);
    setDistractionStrikes(0);
    setShowDistractionWarning(false);
    setShowEmergencyPauseModal(false);
    const dur = newMode === 'custom' ? Math.max(5, customMinutes) * 60 : MODE_DURATIONS[newMode];
    initialDurationRef.current = dur;
    setTimeLeft(dur);
    setFlowTimeSeconds(0);
  };

  // Complete session handler (always reads fresh state)
  const handleSessionComplete = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    setShowDistractionWarning(false);
    setShowEmergencyPauseModal(false);
    setPauseReflection('');
    audioEngine.stopAmbient();
    onAmbientTrackChange?.('none');
    if (settings.soundEffectOnComplete !== false) {
      audioEngine.playVictoryChime();
    }

    try {
      confetti({
        particleCount: 90,
        spread: 65,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignore confetti errors in headless contexts
    }

    const plannedMinutes =
      mode === 'flowtime'
        ? Math.max(1, Math.round(flowTimeSeconds / 60))
        : Math.max(1, Math.round(initialDurationRef.current / 60));

    const elapsedMinutes =
      mode === 'flowtime'
        ? Math.max(1, Math.round(flowTimeSeconds / 60))
        : timeLeft === 0
        ? plannedMinutes
        : Math.max(1, Math.round((initialDurationRef.current - timeLeft) / 60));

    const sessionId = `s-${Date.now()}`;
    const isBreak = mode === 'short_break' || mode === 'long_break';

    if (!isBreak) {
      const newSession: StudySession = {
        id: sessionId,
        subject: selectedSubject,
        topic: selectedTopic || 'Focused Study Block',
        syllabusTopicId: selectedSyllabusTopicId,
        plannedMinutes,
        durationMinutes: elapsedMinutes,
        mode,
        timestamp: new Date().toISOString(),
        completed: true,
        distractionIncidents: distractionStrikes,
        notes: sessionNotes.trim() || undefined,
        soundUsed: activeSound,
        focusGuardianEnabled: settings.focusGuardianEnabled !== false,
      };

      onSaveSession(newSession);

      if (selectedTaskId) {
        const linkedTask = tasks.find((item) => item.id === selectedTaskId);
        if (linkedTask && !linkedTask.completed) {
          onCompleteTask(selectedTaskId);
        }
        setSelectedTaskId('');
      }
    }

    setInsightQuestionsPracticed(0);
    setInsightConfidence(4);
    setVictoryModal({
      show: true,
      sessionId,
      plannedMinutes,
      minutes: elapsedMinutes,
      subject: isBreak ? 'Rest Break' : selectedSubject,
      topic: isBreak
        ? mode === 'short_break'
          ? '5-Minute Short Break'
          : '15-Minute Long Break'
        : selectedTopic || 'Focused Study Block',
      strikes: distractionStrikes,
      guardianProtected: settings.focusGuardianEnabled !== false,
    });
  }, [
    mode,
    flowTimeSeconds,
    timeLeft,
    selectedSubject,
    selectedTopic,
    selectedSyllabusTopicId,
    sessionNotes,
    distractionStrikes,
    activeSound,
    settings.focusGuardianEnabled,
    settings.soundEffectOnComplete,
    onSaveSession,
    onAmbientTrackChange,
    selectedTaskId,
    tasks,
    onCompleteTask,
  ]);

  // Pure Timer Tick (never invokes side effects inside state updater)
  useEffect(() => {
    if (!isActive || isPaused) return;

    const interval = setInterval(() => {
      if (mode === 'flowtime') {
        setFlowTimeSeconds((prev) => prev + 1);
      } else {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, mode]);

  // Trigger completion cleanly when timed countdown reaches zero
  useEffect(() => {
    if (isActive && !isPaused && mode !== 'flowtime' && timeLeft === 0) {
      handleSessionComplete();
    }
  }, [isActive, isPaused, mode, timeLeft, handleSessionComplete]);

  // Quote Rotator
  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % STUDY_QUOTES.length);
    }, 18000);
    return () => clearInterval(quoteInterval);
  }, []);

  // Anti-Distraction Page Visibility / Blur Detection (deduplicated so blur + hidden never double-count)
  useEffect(() => {
    const recordDistractionEvent = () => {
      const now = Date.now();
      if (now - lastDistractionAtRef.current < 1500) return;
      lastDistractionAtRef.current = now;

      setDistractionStrikes((prev) => prev + 1);
      setShowDistractionWarning(true);

      if (settings.focusGuardianEnabled !== false) {
        focusGuardian.triggerFocusReminderNotification(selectedSubject);
      } else if (settings.tabSwitchAlarm || mode === 'hardcore_lock') {
        audioEngine.playDistractionWarning();
      }
    };

    const handleVisibilityChange = () => {
      const guardianOn = settings.focusGuardianEnabled !== false;
      const shouldMonitor = guardianOn || settings.tabSwitchAlarm || mode === 'hardcore_lock';
      if (isActive && !isPaused && document.hidden && shouldMonitor) {
        recordDistractionEvent();
      }
    };

    const handleWindowBlur = () => {
      if (isActive && !isPaused && mode === 'hardcore_lock') {
        recordDistractionEvent();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isActive, isPaused, mode, settings.tabSwitchAlarm, settings.focusGuardianEnabled, selectedSubject]);

  // Ambient sound sync
  const handleSoundChange = (sound: string) => {
    setActiveSound(sound);
    onAmbientTrackChange?.(sound);
    if (sound === 'none') {
      audioEngine.stopAmbient();
    } else {
      audioEngine.playAmbient(sound as any);
      audioEngine.setVolume(soundVolume);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setSoundVolume(vol);
    audioEngine.setVolume(vol);
  };

  // Start Session
  const handleStartSession = () => {
    if (mode !== 'flowtime' && timeLeft === 0) {
      const dur = mode === 'custom' ? Math.max(5, customMinutes) * 60 : MODE_DURATIONS[mode];
      initialDurationRef.current = dur;
      setTimeLeft(dur);
    }
    setIsActive(true);
    setIsPaused(false);
    if (activeSound !== 'none') {
      audioEngine.playAmbient(activeSound as any);
      audioEngine.setVolume(soundVolume);
      onAmbientTrackChange?.(activeSound);
    }
  };

  // Emergency Pause with Friction
  const handleRequestPause = () => {
    if (!isActive || isPaused) return;
    setShowEmergencyPauseModal(true);
    setPauseCountdown(10);
  };

  useEffect(() => {
    if (!showEmergencyPauseModal || pauseCountdown <= 0) return;
    const pauseTimer = setTimeout(() => {
      setPauseCountdown((p) => Math.max(0, p - 1));
    }, 1000);
    return () => clearTimeout(pauseTimer);
  }, [showEmergencyPauseModal, pauseCountdown]);

  const confirmEmergencyPause = () => {
    setIsPaused(true);
    setShowEmergencyPauseModal(false);
    setPauseReflection('');
    audioEngine.stopAmbient();
    onAmbientTrackChange?.('none');
  };

  // Resume Session
  const handleResumeSession = () => {
    setIsPaused(false);
    if (activeSound !== 'none') {
      audioEngine.playAmbient(activeSound as any);
      audioEngine.setVolume(soundVolume);
      onAmbientTrackChange?.(activeSound);
    }
  };

  // Manual Reset / Stop
  const handleResetSession = () => {
    const defaultDur = mode === 'custom' ? Math.max(5, customMinutes) * 60 : MODE_DURATIONS[mode];
    initialDurationRef.current = defaultDur;
    setIsActive(false);
    setIsPaused(false);
    setShowDistractionWarning(false);
    setShowEmergencyPauseModal(false);
    setPauseReflection('');
    audioEngine.stopAmbient();
    onAmbientTrackChange?.('none');
    setTimeLeft(defaultDur);
    setFlowTimeSeconds(0);
    setDistractionStrikes(0);
  };

  // Progress Calculation
  const totalSecs = mode === 'flowtime' ? 3600 : initialDurationRef.current;
  const currentSecs = mode === 'flowtime' ? flowTimeSeconds : initialDurationRef.current - timeLeft;
  const progressPercent = Math.min(100, Math.max(0, (currentSecs / (totalSecs || 1)) * 100));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const pendingTasks = tasks.filter((t) => !t.completed);

  return (
    <div
      ref={containerRef}
      className={
        isFullscreenLock
          ? 'fixed inset-0 z-50 bg-[#0C2218] p-4 sm:p-8 overflow-y-auto flex items-center justify-center'
          : ''
      }
    >
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 min-h-[640px] ${
          isFullscreenLock
            ? 'max-w-[1280px] w-full bg-[#FAF6EE] rounded-2xl border border-[#B08D57]/40 shadow-2xl overflow-hidden'
            : ''
        }`}
      >
        {/* ================= LEFT PAGE (Page 1: Focus Desk & Timer) ================= */}
        <article
          className={`${
            mobilePage === 'left' ? 'block' : 'hidden lg:block'
          } relative p-6 sm:p-8 lg:p-10 lg:border-r lg:border-[#DFD5C3] book-spine-shadow-left flex flex-col justify-between gap-6`}
        >
          {/* Page Header */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E5DCCB]">
              <div>
                <div className="text-xs font-medium text-[#8C6B32] tabular-nums">
                  Focus Mode · Today {todayHoursStudied.toFixed(1)}h /{' '}
                  {((settings.dailyFocusGoalMinutes || 240) / 60).toFixed(1)}h goal ·{' '}
                  {studyStreakDays}d streak
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight text-balance">
                  Focus Study Desk
                </h1>
              </div>

              <button
                id="fullscreen-lock-button"
                type="button"
                onClick={() => setIsFullscreenLock(!isFullscreenLock)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E8DFCE] border border-[#D8CEBC] text-xs font-medium text-[#1C2420] whitespace-nowrap shrink-0 transition-colors"
              >
                {isFullscreenLock ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-[#8C6B32]" />
                    <span>Exit Desk</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-[#14532D]" />
                    <span>Reading Mode</span>
                  </>
                )}
              </button>
            </div>

            {/* Study & Break Mode Selector (Includes Custom + Short/Long Breaks) */}
            <div className="space-y-2">
              <div className="bg-[#F2ECE0] p-1 rounded-lg border border-[#DDD3C1] grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'pomodoro', name: '25m', sub: 'Pomodoro' },
                    { id: 'sprint_50_10', name: '50m', sub: 'Deep Sprint' },
                    { id: 'ultra_90', name: '90m', sub: 'Exam Block' },
                    { id: 'custom', name: `${customMinutes}m`, sub: 'Custom' },
                    { id: 'flowtime', name: 'Flow', sub: 'Stopwatch' },
                    { id: 'hardcore_lock', name: '60m', sub: 'Strict Lock' },
                    { id: 'short_break', name: '5m', sub: 'Short Break' },
                    { id: 'long_break', name: '15m', sub: 'Long Break' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    id={`mode-tab-${m.id}`}
                    type="button"
                    onClick={() => handleModeChange(m.id)}
                    className={`px-2 py-1.5 rounded-md text-center transition-colors ${
                      mode === m.id
                        ? 'bg-[#14532D] text-[#FAF6EE] shadow-sm'
                        : 'text-[#4A554E] hover:text-[#1C2420] hover:bg-[#FAF6EE]/60'
                    }`}
                  >
                    <div className="font-mono text-xs font-semibold tabular-nums">{m.name}</div>
                    <div
                      className={`text-[10px] truncate ${
                        mode === m.id ? 'text-[#E6CFA3]' : 'text-[#5E6A62]'
                      }`}
                    >
                      {m.sub}
                    </div>
                  </button>
                ))}
              </div>

              {mode === 'custom' && !isActive && (
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#F3ECE0] border border-[#DDD3C1] text-xs">
                  <label htmlFor="custom-focus-minutes" className="font-semibold text-[#1C2420]">
                    Custom Study Duration (minutes):
                  </label>
                  <input
                    id="custom-focus-minutes"
                    type="number"
                    min={5}
                    max={180}
                    value={customMinutes}
                    onChange={(e) => {
                      const val = Math.max(5, Math.min(180, Number(e.target.value) || 25));
                      setCustomMinutes(val);
                      initialDurationRef.current = val * 60;
                      setTimeLeft(val * 60);
                    }}
                    className="w-20 bg-[#FAF6EE] border border-[#D4C9B4] rounded px-2 py-1 font-mono text-center text-[#1C2420]"
                  />
                </div>
              )}
            </div>

            {/* Subject & Topic Selection */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {SUBJECTS.map((sub) => {
                  const selected = selectedSubject === sub.name;
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => setSelectedSubject(sub.name)}
                      disabled={isActive}
                      className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-[#0F291E] text-[#FAF6EE] border-[#0F291E]'
                          : 'bg-[#FAF6EE] text-[#4A554E] border-[#DDD3C1] hover:border-[#B08D57] hover:text-[#1C2420]'
                      } disabled:opacity-60`}
                    >
                      {sub.name}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  id="focus-topic-input"
                  type="text"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  placeholder="Chapter or problem set..."
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-sm text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                />

                <select
                  id="link-task-select"
                  value={selectedTaskId}
                  onChange={(e) => {
                    setSelectedTaskId(e.target.value);
                    const t = tasks.find((item) => item.id === e.target.value);
                    if (t) {
                      setSelectedSubject(t.subject);
                      setSelectedTopic(t.title);
                    }
                  }}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] text-xs text-[#1C2420] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                >
                  <option value="">Link pending task (optional)</option>
                  {pendingTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.subject}] {t.title} ({t.estimatedMinutes}m)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Centerpiece Study Clock */}
          <div className="flex flex-col items-center justify-center py-2">
            {distractionStrikes > 0 && (
              <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#991B1B]">
                <ShieldAlert className="w-4 h-4" />
                <span>
                  {distractionStrikes} distraction {distractionStrikes === 1 ? 'event' : 'events'} recorded
                </span>
              </div>
            )}

            <div className="relative inline-flex items-center justify-center">
              <svg className="w-56 h-56 sm:w-64 sm:h-64 transform -rotate-90" viewBox="0 0 260 260">
                <circle
                  cx="130"
                  cy="130"
                  r="114"
                  stroke="#E5DCCB"
                  strokeWidth="7"
                  fill="transparent"
                />
                <circle
                  cx="130"
                  cy="130"
                  r="114"
                  stroke={isPaused ? '#B08D57' : '#14532D'}
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 114}
                  strokeDashoffset={2 * Math.PI * 114 * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-[#1C2420] tabular-nums">
                  {mode === 'flowtime' ? formatTime(flowTimeSeconds) : formatTime(timeLeft)}
                </span>
                <span className="text-xs font-semibold text-[#14532D] mt-2">
                  {isActive ? (isPaused ? 'Session Paused' : 'Studying Now') : 'Ready to Begin'}
                </span>
                <span className="text-xs text-[#5A655E] mt-0.5 tabular-nums">
                  {selectedSubject} · {Math.round(progressPercent)}% complete
                </span>
              </div>
            </div>

            {/* Action Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              {!isActive ? (
                <button
                  id="start-study-session-button"
                  type="button"
                  onClick={handleStartSession}
                  className="inline-flex items-center gap-2.5 px-7 py-3 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-sm shadow-sm transition-colors whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Study Session</span>
                </button>
              ) : isPaused ? (
                <button
                  id="resume-study-session-button"
                  type="button"
                  onClick={handleResumeSession}
                  className="inline-flex items-center gap-2.5 px-7 py-3 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-sm shadow-sm transition-colors whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume Session</span>
                </button>
              ) : (
                <button
                  id="emergency-pause-button"
                  type="button"
                  onClick={handleRequestPause}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#C8B99D] text-[#8C6B32] font-semibold text-sm transition-colors whitespace-nowrap"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
              )}

              {isActive && (
                <button
                  id="finish-session-early-button"
                  type="button"
                  onClick={handleSessionComplete}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F291E] hover:bg-[#173D2D] text-[#FAF6EE] font-semibold text-sm transition-colors whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#E6CFA3]" />
                  <span>Finish & Log</span>
                </button>
              )}

              <button
                id="reset-session-button"
                type="button"
                onClick={handleResetSession}
                className="p-2.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-[#4A554E] hover:text-[#1C2420] transition-colors"
                title="Reset Timer"
                aria-label="Reset Timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quiet Editorial Footer Note on Left Page */}
          <p className="text-xs italic text-[#5A655E] pt-3 border-t border-[#E5DCCB] text-center">
            “{STUDY_QUOTES[quoteIndex]}”
          </p>
        </article>

        {/* ================= RIGHT PAGE (Page 2: Focus Guardian & Soundscape) ================= */}
        <article
          className={`${
            mobilePage === 'right' ? 'block' : 'hidden lg:block'
          } relative p-6 sm:p-8 lg:p-10 book-spine-shadow-right flex flex-col justify-between gap-6`}
        >
          <div className="space-y-6">
            {/* Page Header */}
            <div className="pb-3 border-b border-[#E5DCCB]">
              <div className="text-xs font-medium text-[#8C6B32]">
                Chapter I · Page 2 · Study Environment
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#1C2420] mt-1 tracking-tight">
                Guardian & Soundscape
              </h2>
            </div>

            {/* Focus Guardian Status Card (Fixed props: isEnabled + activeSubject!) */}
            <FocusGuardianCard
              isEnabled={settings.focusGuardianEnabled !== false}
              onToggleEnabled={(enabled) =>
                onUpdateSettings({ ...settings, focusGuardianEnabled: enabled })
              }
              isSessionActive={isActive}
              activeSubject={selectedSubject}
              remainingSeconds={mode === 'flowtime' ? flowTimeSeconds : timeLeft}
              distractionCount={distractionStrikes}
              motivationalMessage="You've got this! Return to your studies and complete your session."
            />

            {/* Study Hygiene Checklist */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base font-semibold text-[#1C2420] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#8C6B32]" />
                  <span>Desk Discipline Checklist</span>
                </h3>
                <span className="text-xs text-[#5A655E]">
                  {settings.strictMode === 'hardcore_last_chance' || settings.strictMode === true
                    ? 'Hardcore Mode'
                    : settings.strictMode === 'strict'
                    ? 'Strict Mode'
                    : 'Gentle Mode'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-3 p-3 rounded-lg bg-[#F3ECE0] border border-[#DDD3C1] cursor-pointer hover:border-[#B08D57] transition-colors">
                  <input
                    id="chamber-toggle-focus-guardian"
                    type="checkbox"
                    checked={settings.focusGuardianEnabled !== false}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, focusGuardianEnabled: e.target.checked })
                    }
                    className="mt-0.5 accent-[#14532D] rounded"
                  />
                  <div>
                    <span className="font-semibold text-[#1C2420] block">
                      Focus Guardian Visibility Shield
                    </span>
                    <span className="text-[#4A554E] block mt-0.5">
                      Logs an event and notifies you whenever you leave this study page.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg bg-[#F3ECE0] border border-[#DDD3C1] cursor-pointer hover:border-[#B08D57] transition-colors">
                  <input
                    type="checkbox"
                    checked={phonePhysicallyLocked}
                    onChange={(e) => setPhonePhysicallyLocked(e.target.checked)}
                    className="mt-0.5 accent-[#14532D] rounded"
                  />
                  <div>
                    <span className="font-semibold text-[#1C2420] block">
                      Phone Placed Out of Reach
                    </span>
                    <span className="text-[#4A554E] block mt-0.5">
                      Mobile device face-down in another room before pressing Start.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg bg-[#F3ECE0] border border-[#DDD3C1] cursor-pointer hover:border-[#B08D57] transition-colors">
                  <input
                    type="checkbox"
                    checked={settings.tabSwitchAlarm}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, tabSwitchAlarm: e.target.checked })
                    }
                    className="mt-0.5 accent-[#14532D] rounded"
                  />
                  <div>
                    <span className="font-semibold text-[#1C2420] block">
                      Acoustic Tab-Switch Alert
                    </span>
                    <span className="text-[#4A554E] block mt-0.5">
                      Plays a brief chime if you navigate away from this window during a session.
                    </span>
                  </div>
                </label>
              </div>
            </section>

            {/* Ambient Focus Sound Synthesizer */}
            <section className="space-y-3 pt-2 border-t border-[#E5DCCB]">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base font-semibold text-[#1C2420] flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#14532D]" />
                  <span>Study Room Soundscape</span>
                </h3>
                <span className="text-xs text-[#5A655E]">Offline Web Audio</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'binaural_40hz', name: '40Hz Gamma', desc: 'Alert Focus' },
                  { id: 'brown_noise', name: 'Brown Noise', desc: 'Deep Calm' },
                  { id: 'rain', name: 'Library Rain', desc: 'Soft Steady' },
                  { id: 'lofi_drone', name: 'Warm Chord', desc: 'Ambient Pad' },
                  { id: 'white_noise', name: 'White Noise', desc: 'Mask Noise' },
                  { id: 'none', name: 'Silence', desc: 'Muted' },
                ].map((s) => (
                  <button
                    key={s.id}
                    id={`sound-${s.id}`}
                    type="button"
                    onClick={() => handleSoundChange(s.id)}
                    className={`p-2.5 rounded-lg text-left border transition-colors ${
                      activeSound === s.id
                        ? 'bg-[#0F291E] border-[#0F291E] text-[#FAF6EE]'
                        : 'bg-[#F3ECE0] border-[#DDD3C1] text-[#1C2420] hover:border-[#B08D57]'
                    }`}
                  >
                    <div className="font-semibold text-xs">{s.name}</div>
                    <div
                      className={`text-[11px] ${
                        activeSound === s.id ? 'text-[#C8A66A]' : 'text-[#5A655E]'
                      }`}
                    >
                      {s.desc}
                    </div>
                  </button>
                ))}
              </div>

              {activeSound !== 'none' && (
                <div className="flex items-center gap-3 pt-1">
                  <VolumeX className="w-3.5 h-3.5 text-[#5A655E]" />
                  <input
                    id="ambient-volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    aria-label="Ambient sound volume"
                    className="w-full accent-[#14532D] h-1.5 bg-[#DDD3C1] rounded-lg cursor-pointer"
                  />
                  <Volume2 className="w-3.5 h-3.5 text-[#14532D]" />
                </div>
              )}
            </section>

            {/* In-Session Study Notes */}
            <section className="space-y-2 pt-2 border-t border-[#E5DCCB]">
              <label
                htmlFor="focus-session-notes"
                className="font-serif text-sm font-semibold text-[#1C2420] block"
              >
                Session Scratchpad &amp; Key Takeaways
              </label>
              <textarea
                id="focus-session-notes"
                rows={3}
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Jot key formulas, doubts to ask AI Tutor, or problems solved during this focus block..."
                className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg p-3 text-xs text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
              />
            </section>
          </div>
        </article>
      </div>

      {/* ================= MODALS ================= */}

      {/* Distraction Alert Warning Modal */}
      {showDistractionWarning && (
        <div className="fixed inset-0 z-[60] bg-[#07140E]/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF6EE] border-2 border-[#991B1B] rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#FEE2E2] border border-[#FCA5A5] flex items-center justify-center mx-auto text-[#991B1B]">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div>
              <div className="text-xs font-semibold text-[#991B1B]">
                Focus Guardian · App Visibility Lost
              </div>
              <h3 className="font-serif text-xl font-semibold text-[#1C2420] mt-1">
                Return to Your Study Book
              </h3>
            </div>

            <div className="bg-[#F2ECE0] border border-[#DDD3C1] rounded-xl p-4 text-left space-y-2">
              <p className="text-sm font-medium text-[#1C2420]">
                📚 You&apos;re studying right now! Stay focused on your studies. Avoid using other apps until your session ends.
              </p>
              <p className="text-xs text-[#14532D] font-medium flex items-center gap-1.5 pt-2 border-t border-[#DDD3C1]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>You&apos;ve got this! Return to your studies and complete your session.</span>
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-[#4A554E] px-1">
              <span>
                Subject: <strong className="text-[#1C2420]">{selectedSubject}</strong>
              </span>
              <span className="font-mono tabular-nums">
                Events: <strong className="text-[#991B1B]">{distractionStrikes}</strong>
              </span>
            </div>

            <button
              id="dismiss-distraction-warning"
              type="button"
              onClick={() => setShowDistractionWarning(false)}
              className="w-full py-3 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-sm transition-colors"
            >
              Return to Studies
            </button>
          </div>
        </div>
      )}

      {/* Emergency Pause Reality Check Modal */}
      {showEmergencyPauseModal && (
        <div className="fixed inset-0 z-[60] bg-[#07140E]/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF6EE] border border-[#C8B99D] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#8C6B32]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-serif text-lg font-semibold text-[#1C2420]">
                Confirm Study Pause
              </h3>
            </div>
            <p className="text-xs text-[#4A554E] leading-relaxed">
              Take three slow breaths before interrupting your study momentum. If you need a genuine break, note the reason below.
            </p>

            <textarea
              id="pause-reflection-input"
              value={pauseReflection}
              onChange={(e) => setPauseReflection(e.target.value)}
              placeholder="Reason for pausing (e.g., water break, restroom)..."
              className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg p-3 text-xs text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
              rows={2}
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                id="cancel-pause-resume"
                type="button"
                onClick={() => {
                  setShowEmergencyPauseModal(false);
                  setPauseReflection('');
                }}
                className="px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold transition-colors"
              >
                Keep Studying
              </button>

              <button
                id="confirm-emergency-pause"
                type="button"
                onClick={confirmEmergencyPause}
                disabled={pauseCountdown > 0}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors tabular-nums ${
                  pauseCountdown > 0
                    ? 'bg-[#E5DCCB] text-[#7A847D] cursor-not-allowed'
                    : 'bg-[#8C6B32] hover:bg-[#705526] text-[#FAF6EE]'
                }`}
              >
                {pauseCountdown > 0 ? `Wait ${pauseCountdown}s` : 'Confirm Pause'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Session Insights & Completion Modal */}
      {victoryModal && victoryModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#07140E]/75 backdrop-blur-sm">
          <div className="bg-[#FAF6EE] border border-[#B08D57] rounded-2xl p-6 sm:p-7 max-w-md w-full text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F3EC] border border-[#B7D7C2] flex items-center justify-center text-[#14532D]">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <div className="text-xs font-medium text-[#8C6B32]">Post-Session Insights</div>
              <h3 className="font-serif text-2xl font-semibold text-[#1C2420] mt-0.5">
                Session Complete
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-left">
              <div className="bg-[#F2ECE0] border border-[#DDD3C1] rounded-lg p-2.5">
                <span className="text-[11px] text-[#5A655E] block">Actual / Planned</span>
                <span className="font-mono text-base font-semibold text-[#14532D] tabular-nums">
                  {victoryModal.minutes}/{victoryModal.plannedMinutes}m
                </span>
              </div>
              <div className="bg-[#F2ECE0] border border-[#DDD3C1] rounded-lg p-2.5">
                <span className="text-[11px] text-[#5A655E] block">Distractions</span>
                <span
                  className={`font-mono text-base font-semibold tabular-nums ${
                    victoryModal.strikes === 0 ? 'text-[#14532D]' : 'text-[#8C6B32]'
                  }`}
                >
                  {victoryModal.strikes}
                </span>
              </div>
              <div className="bg-[#F2ECE0] border border-[#DDD3C1] rounded-lg p-2.5">
                <span className="text-[11px] text-[#5A655E] block">Guardian</span>
                <span className="font-mono text-xs font-semibold text-[#1C2420]">
                  {victoryModal.guardianProtected ? 'Active' : 'Off'}
                </span>
              </div>
            </div>

            <div className="bg-[#F2ECE0] border border-[#DDD3C1] rounded-lg p-3 text-left text-xs space-y-2.5">
              <div>
                <span className="text-[#5A655E]">Subject &amp; Topic: </span>
                <strong className="text-[#1C2420]">
                  {victoryModal.subject} — {victoryModal.topic}
                </strong>
              </div>

              {victoryModal.subject !== 'Rest Break' && (
                <>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#DDD3C1]">
                    <label htmlFor="insight-questions-count" className="font-semibold text-[#1C2420]">
                      Questions Practiced
                    </label>
                    <input
                      id="insight-questions-count"
                      type="number"
                      min={0}
                      max={200}
                      value={insightQuestionsPracticed}
                      onChange={(e) =>
                        setInsightQuestionsPracticed(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-20 bg-[#FAF6EE] border border-[#D4C9B4] rounded px-2 py-1 font-mono text-center"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#1C2420]">Topic Confidence</span>
                    <div className="flex items-center gap-1">
                      {([1, 2, 3, 4, 5] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setInsightConfidence(lvl)}
                          className={`w-6 h-6 rounded font-mono text-xs font-semibold ${
                            insightConfidence === lvl
                              ? 'bg-[#14532D] text-[#FAF6EE]'
                              : 'bg-[#FAF6EE] text-[#4A554E] border border-[#D4C9B4]'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              id="close-victory-celebration"
              type="button"
              onClick={() => {
                if (victoryModal.subject !== 'Rest Break' && onUpdateSession) {
                  onUpdateSession(victoryModal.sessionId, {
                    questionsPracticed: insightQuestionsPracticed,
                    selfConfidence: insightConfidence,
                    notes: sessionNotes.trim() || undefined,
                  });
                }
                setSessionNotes('');
                setVictoryModal(null);
              }}
              className="w-full py-3 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-sm transition-colors"
            >
              Save Insights &amp; Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
