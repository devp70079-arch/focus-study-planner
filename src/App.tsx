import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Mic, Volume2, VolumeX, Shield, Sparkles } from 'lucide-react';
import { SidebarNav } from './components/SidebarNav';
import { OnboardingDesk3D } from './components/OnboardingDesk3D';
import { CommandCenterHome } from './components/CommandCenterHome';
import { MasterStrategistView } from './components/MasterStrategistView';
import { SyllabusManagerView } from './components/SyllabusManagerView';
import { StudyPlannerView } from './components/StudyPlannerView';
import { RevisionCenterView } from './components/RevisionCenterView';
import { FocusChamber } from './components/FocusChamber';
import { TaskAnalyticsView } from './components/TaskAnalyticsView';
import { SettingsView } from './components/SettingsView';
import { StudyAssistantDrawer } from './components/StudyAssistantDrawer';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { CoachAdviceModal } from './components/CoachAdviceModal';
import { DistractionShieldModal } from './components/DistractionShieldModal';
import {
  AcademicProfile,
  CommandCenterView,
  DistractionSettings,
  IncompleteReason,
  MistakeRecord,
  NightBattlePlan,
  PendingSprintRequest,
  PredictedPaper,
  RevisionItem,
  StrategistAnalysis,
  StudyAssistantMessage,
  StudySession,
  SyllabusTopic,
  SyllabusUnit,
  Task,
  UploadedAcademicDocument,
  WeeklyScheduleBlock,
} from './types';
import {
  COMMAND_CENTER_KEYS,
  DEFAULT_SETTINGS,
  LEGACY_KEYS,
  clearCommandCenterDataOnly,
  createDefaultAcademicProfile,
  exportAcademicBackup,
  safeLoadJson,
  safeSaveJson,
  saveAssistantMessagesTrimmed,
} from './services/academicStorage';
import {
  calculateExamReadiness,
  createRevisionFromTopic,
  generateDailyPlanFromSyllabus,
  mergeStrategistSyllabusIntoUnits,
  recalculateRecoveryPlan,
} from './services/academicEngines';
import { audioEngine } from './utils/audioEngine';
import { getLocalDateFromISO, getLocalDateString } from './utils/date';

export default function App() {
  const [activeView, setActiveView] = useState<CommandCenterView>('home');

  // Legacy-Compatible Core Study State (Preserves existing user data; starts clean [] for new users — zero fabricated mock data)
  const [tasks, setTasks] = useState<Task[]>(() => safeLoadJson<Task[]>(LEGACY_KEYS.TASKS, []));
  const [schedule, setSchedule] = useState<WeeklyScheduleBlock[]>(() =>
    safeLoadJson<WeeklyScheduleBlock[]>(LEGACY_KEYS.WEEKLY_SCHEDULE, [])
  );
  const [nightPlans, setNightPlans] = useState<NightBattlePlan[]>(() =>
    safeLoadJson<NightBattlePlan[]>(LEGACY_KEYS.NIGHT_PLANS, [])
  );
  const [sessions, setSessions] = useState<StudySession[]>(() =>
    safeLoadJson<StudySession[]>(LEGACY_KEYS.SESSIONS, [])
  );
  const [settings, setSettings] = useState<DistractionSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...safeLoadJson<Partial<DistractionSettings>>(LEGACY_KEYS.SETTINGS, DEFAULT_SETTINGS),
  }));

  // New AI Academic Command Center Persistent State
  const [profile, setProfile] = useState<AcademicProfile>(() => ({
    ...createDefaultAcademicProfile(),
    ...safeLoadJson<Partial<AcademicProfile>>(
      COMMAND_CENTER_KEYS.PROFILE,
      createDefaultAcademicProfile()
    ),
  }));
  const [syllabusUnits, setSyllabusUnits] = useState<SyllabusUnit[]>(() =>
    safeLoadJson<SyllabusUnit[]>(COMMAND_CENTER_KEYS.SYLLABUS_UNITS, [])
  );
  const [uploadedDocs, setUploadedDocs] = useState<UploadedAcademicDocument[]>(() =>
    safeLoadJson<UploadedAcademicDocument[]>(COMMAND_CENTER_KEYS.UPLOADED_DOCS, [])
  );
  const [analyses, setAnalyses] = useState<StrategistAnalysis[]>(() =>
    safeLoadJson<StrategistAnalysis[]>(COMMAND_CENTER_KEYS.STRATEGIST_ANALYSES, [])
  );
  const [predictedPapers, setPredictedPapers] = useState<PredictedPaper[]>(() =>
    safeLoadJson<PredictedPaper[]>(COMMAND_CENTER_KEYS.PREDICTED_PAPERS, [])
  );
  const [revisions, setRevisions] = useState<RevisionItem[]>(() =>
    safeLoadJson<RevisionItem[]>(COMMAND_CENTER_KEYS.REVISIONS, [])
  );
  const [mistakes, setMistakes] = useState<MistakeRecord[]>(() =>
    safeLoadJson<MistakeRecord[]>(COMMAND_CENTER_KEYS.MISTAKES, [])
  );
  const [assistantMessages, setAssistantMessages] = useState<StudyAssistantMessage[]>(() =>
    safeLoadJson<StudyAssistantMessage[]>(COMMAND_CENTER_KEYS.ASSISTANT_MESSAGES, [])
  );

  // Audio, Modals & Cross-View Launchers
  const [ambientMuted, setAmbientMuted] = useState<boolean>(() => audioEngine.getIsMuted());
  const [ambientTrack, setAmbientTrack] = useState<string>('none');
  const [pendingSprint, setPendingSprint] = useState<PendingSprintRequest | null>(null);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState<boolean>(false);
  const [showCoachModal, setShowCoachModal] = useState<boolean>(false);
  const [showDistractionShieldModal, setShowDistractionShieldModal] = useState<boolean>(false);
  const [showStudyAssistant, setShowStudyAssistant] = useState<boolean>(false);
  const [assistantPromptRequest, setAssistantPromptRequest] = useState<{
    prompt: string;
    subject?: string;
    topic?: string;
    key: number;
  } | null>(null);

  // Focus Guardian & Live Session State
  const [liveSession, setLiveSession] = useState<{
    isActive: boolean;
    isPaused: boolean;
    timeLeft: number;
    subject: string;
    topic: string;
    strikes: number;
    mode: string;
  }>({
    isActive: false,
    isPaused: false,
    timeLeft: 50 * 60,
    subject: profile.primarySubject || 'Physics',
    topic: '',
    strikes: 0,
    mode: 'sprint_50_10',
  });

  // Safe Persistence Effects
  useEffect(() => {
    safeSaveJson(LEGACY_KEYS.TASKS, tasks);
  }, [tasks]);
  useEffect(() => {
    safeSaveJson(LEGACY_KEYS.WEEKLY_SCHEDULE, schedule);
  }, [schedule]);
  useEffect(() => {
    safeSaveJson(LEGACY_KEYS.NIGHT_PLANS, nightPlans);
  }, [nightPlans]);
  useEffect(() => {
    safeSaveJson(LEGACY_KEYS.SESSIONS, sessions);
  }, [sessions]);
  useEffect(() => {
    safeSaveJson(LEGACY_KEYS.SETTINGS, settings);
  }, [settings]);
  useEffect(() => {
    safeSaveJson(COMMAND_CENTER_KEYS.PROFILE, profile);
  }, [profile]);
  useEffect(() => {
    safeSaveJson(COMMAND_CENTER_KEYS.SYLLABUS_UNITS, syllabusUnits);
  }, [syllabusUnits]);
  useEffect(() => {
    safeSaveJson(COMMAND_CENTER_KEYS.UPLOADED_DOCS, uploadedDocs);
  }, [uploadedDocs]);
  useEffect(() => {
    safeSaveJson(COMMAND_CENTER_KEYS.STRATEGIST_ANALYSES, analyses.slice(0, 10));
  }, [analyses]);
  useEffect(() => {
    safeSaveJson(COMMAND_CENTER_KEYS.PREDICTED_PAPERS, predictedPapers.slice(0, 10));
  }, [predictedPapers]);
  useEffect(() => {
    safeSaveJson(COMMAND_CENTER_KEYS.REVISIONS, revisions);
  }, [revisions]);
  useEffect(() => {
    safeSaveJson(COMMAND_CENTER_KEYS.MISTAKES, mistakes);
  }, [mistakes]);
  useEffect(() => {
    saveAssistantMessagesTrimmed(assistantMessages);
  }, [assistantMessages]);

  // Derived Daily & Evidence-Based Exam Readiness Metrics
  const todayDateStr = getLocalDateString(0);
  const todaySessions = sessions.filter(
    (s) => s.completed && getLocalDateFromISO(s.timestamp) === todayDateStr
  );
  const todayMinutes = todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const todayHoursStudied = todayMinutes / 60;
  const dailyGoalMinutes = settings.dailyFocusGoalMinutes || Math.round((profile.dailyAvailableHours || 4) * 60);

  const readiness = useMemo(
    () =>
      calculateExamReadiness({
        profile,
        syllabusUnits,
        tasks,
        revisions,
        mistakes,
        sessions,
        dailyGoalMinutes,
      }),
    [profile, syllabusUnits, tasks, revisions, mistakes, sessions, dailyGoalMinutes]
  );

  const dueRevisionCount = revisions.filter((r) => r.nextReviewDate <= todayDateStr).length;
  const overdueTaskCount = tasks.filter((t) => !t.completed && t.dueDate < todayDateStr).length;
  const latestAnalysis = analyses[0];

  // Task Handlers
  const handleAddTask = (newTask: Task) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleMarkTaskComplete = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && !t.completed
          ? { ...t, completed: true, completedAt: new Date().toISOString() }
          : t
      )
    );
  }, []);

  const handleToggleTaskComplete = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const nextState = !t.completed;
          return {
            ...t,
            completed: nextState,
            completedAt: nextState ? new Date().toISOString() : undefined,
          };
        }
        return t;
      })
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleUpdateTask = (taskId: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  };

  const handleUpdateIncompleteReason = (taskId: string, reason: IncompleteReason) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, incompleteReason: reason } : t))
    );
  };

  // Schedule & Night Plan Handlers
  const handleSaveSchedule = (newBlocks: WeeklyScheduleBlock[]) => setSchedule(newBlocks);
  const handleToggleScheduleBlock = (blockId: string) => {
    setSchedule((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, completed: !b.completed } : b))
    );
  };
  const handleAddScheduleBlock = (newBlock: WeeklyScheduleBlock) => {
    setSchedule((prev) => [...prev, newBlock]);
  };
  const handleSaveNightPlan = (plan: NightBattlePlan) => {
    setNightPlans((prev) => [plan, ...prev.filter((p) => p.date !== plan.date)]);
  };
  const handlePartialUpdateNightPlan = (partial: Partial<NightBattlePlan>) => {
    setNightPlans((prev) => {
      const active: NightBattlePlan = prev[0] || {
        id: `np-${Date.now()}`,
        date: getLocalDateString(1),
        top3MITs: ['', '', ''],
        morningKickoffTask: '',
        wakeUpTime: '06:00 AM',
        sleepTime: '11:00 PM',
        phoneLockCommitment: true,
        eveningReflection: '',
        antiDistractionRule: '',
        status: 'planned',
        createdAt: new Date().toISOString(),
      };
      return [{ ...active, ...partial }, ...prev.slice(1)];
    });
  };

  // Session Handlers
  const handleSaveSession = (newSession: StudySession) => {
    setSessions((prev) => [newSession, ...prev]);
  };

  const handleUpdateSession = (sessionId: string, patch: Partial<StudySession>) => {
    setSessions((prev) => {
      const target = prev.find((s) => s.id === sessionId);
      if (target?.syllabusTopicId && patch.selfConfidence) {
        const conf = patch.selfConfidence;
        setSyllabusUnits((units) =>
          units.map((u) => ({
            ...u,
            topics: u.topics.map((t) =>
              t.id === target.syllabusTopicId
                ? { ...t, confidence: conf, lastStudiedAt: new Date().toISOString() }
                : t
            ),
          }))
        );
      }
      return prev.map((s) => (s.id === sessionId ? { ...s, ...patch } : s));
    });
  };

  // Strategist, Syllabus Divider & Recovery Handlers
  const handleSaveAnalysis = (
    analysis: StrategistAnalysis,
    uploadedMeta: UploadedAcademicDocument[]
  ) => {
    setAnalyses((prev) => [analysis, ...prev]);
    if (uploadedMeta.length > 0) {
      setUploadedDocs((prev) => [...uploadedMeta, ...prev].slice(0, 50));
    }
  };

  const handleImportSyllabusFromAnalysis = (analysis: StrategistAnalysis) => {
    setSyllabusUnits((prev) => mergeStrategistSyllabusIntoUnits(prev, analysis));
  };

  const handleAutoDivideSyllabus = (): string => {
    const res = generateDailyPlanFromSyllabus({
      syllabusUnits,
      existingTasks: tasks,
      revisions,
      profile,
    });
    if (res.generatedTasks.length > 0) {
      setTasks((prev) => [...res.generatedTasks, ...prev]);
    }
    return res.summaryNote;
  };

  const handleGeneratePlanFromAnalysis = (analysis: StrategistAnalysis) => {
    const mergedUnits = mergeStrategistSyllabusIntoUnits(syllabusUnits, analysis);
    setSyllabusUnits(mergedUnits);
    const res = generateDailyPlanFromSyllabus({
      syllabusUnits: mergedUnits,
      existingTasks: tasks,
      revisions,
      profile,
    });
    if (res.generatedTasks.length > 0) {
      setTasks((prev) => [...res.generatedTasks, ...prev]);
    }
  };

  const handleRunSmartRecovery = (): string => {
    const res = recalculateRecoveryPlan({ tasks, profile, revisions });
    if (res.redistributedCount > 0) {
      setTasks(res.updatedTasks);
    }
    return res.recoverySummary;
  };

  // Revision & Mistake Handlers
  const handleScheduleRevisionForTopic = (topic: SyllabusTopic) => {
    setRevisions((prev) => {
      if (prev.some((r) => r.syllabusTopicId === topic.id)) return prev;
      return [createRevisionFromTopic(topic, readiness.daysRemaining), ...prev];
    });
  };

  const handleAddMistakes = (newMistakes: MistakeRecord[]) => {
    setMistakes((prev) => [...newMistakes, ...prev]);
  };

  const handleToggleMistakeCorrected = (mistakeId: string) => {
    setMistakes((prev) =>
      prev.map((m) =>
        m.id === mistakeId
          ? {
              ...m,
              corrected: !m.corrected,
              correctedAt: !m.corrected ? new Date().toISOString() : undefined,
            }
          : m
      )
    );
  };

  const handleDeleteMistake = (mistakeId: string) => {
    setMistakes((prev) => prev.filter((m) => m.id !== mistakeId));
  };

  // Launch Helpers
  const handleQuickStartFocus = (
    subject: string,
    topic: string,
    durationMinutes = 45,
    syllabusTopicId?: string
  ) => {
    setActiveView('focus');
    setPendingSprint({
      subject,
      topic,
      durationMinutes,
      syllabusTopicId,
      key: Date.now(),
    });
  };

  const handleOpenAssistantWithPrompt = (prompt: string, subject?: string, topic?: string) => {
    setShowStudyAssistant(true);
    setAssistantPromptRequest({ prompt, subject, topic, key: Date.now() });
  };

  const handleExportBackup = () => {
    const json = exportAcademicBackup({
      profile,
      settings,
      tasks,
      sessions,
      schedule,
      nightPlans,
      syllabusUnits,
      uploadedDocs,
      analyses,
      predictedPapers,
      revisions,
      mistakes,
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic-command-center-backup-${todayDateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetCommandCenterData = () => {
    clearCommandCenterDataOnly();
    setSyllabusUnits([]);
    setUploadedDocs([]);
    setAnalyses([]);
    setPredictedPapers([]);
    setRevisions([]);
    setMistakes([]);
    setAssistantMessages([]);
  };

  // Ambient Audio Mute Toggle
  const handleToggleAmbientMute = () => {
    const nextMuted = audioEngine.toggleMute();
    setAmbientMuted(nextMuted);
  };

  // Dynamic Shield Icon Color & Label based on strictMode (preserved contract)
  const isHardcore =
    settings.strictMode === 'hardcore_last_chance' || settings.strictMode === true;
  const isGentle = settings.strictMode === 'gentle' || settings.strictMode === false;

  const shieldIconColorClass = isHardcore
    ? 'text-red-500'
    : isGentle
    ? 'text-emerald-400'
    : 'text-amber-400';

  const shieldModeLabel = isHardcore ? 'Hardcore' : isGentle ? 'Gentle' : 'Strict';

  const formatShortTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-[#14532D] selection:text-[#FAF6EE]">
      {/* First-Time 3D Study Desk Onboarding */}
      {!profile.onboardingCompleted && (
        <OnboardingDesk3D
          profile={profile}
          onComplete={(updated) => setProfile(updated)}
          onSkip={() => setProfile((prev) => ({ ...prev, onboardingCompleted: true }))}
        />
      )}

      {/* 3-Zone Top Bar + 8-Item Desktop Sidebar + Mobile Drawer */}
      <SidebarNav
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenAssistant={() => setShowStudyAssistant(true)}
        dueRevisionCount={dueRevisionCount}
        overdueTaskCount={overdueTaskCount}
        daysUntilExam={readiness.daysRemaining}
        activeExamSubject={readiness.activeExamSubject}
        isFocusActive={liveSession.isActive}
        focusFormattedTime={formatShortTimer(liveSession.timeLeft)}
      />

      {/* Main Content Stage (Archival Ivory Canvas framed inside Oxford Green) */}
      <main className="flex-1 lg:pl-[232px] pb-24 lg:pb-16">
        <div className="max-w-[1260px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="bg-[#FAF6EE] rounded-2xl border border-[#B08D57]/35 shadow-[0_20px_55px_rgba(0,0,0,0.35)] overflow-hidden">
            {/* Subtle Top Brass Edge Accent */}
            <div
              aria-hidden="true"
              className="no-print h-1 w-full bg-gradient-to-r from-[#8C6B32]/40 via-[#C8A66A]/70 to-[#8C6B32]/40"
            />

            {/* FocusChamber stays permanently mounted across all 8 views so running timers & Page Visibility monitoring never reset */}
            <div className={activeView === 'focus' ? 'block' : 'hidden'}>
              <FocusChamber
                tasks={tasks}
                onCompleteTask={handleMarkTaskComplete}
                onSaveSession={handleSaveSession}
                onUpdateSession={handleUpdateSession}
                settings={settings}
                onUpdateSettings={setSettings}
                todayHoursStudied={todayHoursStudied}
                studyStreakDays={readiness.studyStreakDays}
                onSessionStateChange={setLiveSession}
                onAmbientTrackChange={setAmbientTrack}
                pendingSprint={pendingSprint}
                onSprintHandled={() => setPendingSprint(null)}
              />
            </div>

            {activeView !== 'focus' && (
              <div className="p-5 sm:p-7 lg:p-8">
                {activeView === 'home' && (
                  <CommandCenterHome
                    profile={profile}
                    readiness={readiness}
                    tasks={tasks}
                    syllabusUnits={syllabusUnits}
                    revisions={revisions}
                    mistakes={mistakes}
                    latestAnalysis={latestAnalysis}
                    todayHoursStudied={todayHoursStudied}
                    dailyGoalMinutes={dailyGoalMinutes}
                    onNavigate={setActiveView}
                    onQuickStartFocus={(subj, topic, mins) =>
                      handleQuickStartFocus(subj, topic, mins)
                    }
                    onOpenAssistantWithPrompt={handleOpenAssistantWithPrompt}
                  />
                )}

                {activeView === 'strategist' && (
                  <MasterStrategistView
                    profile={profile}
                    onUpdateProfile={setProfile}
                    syllabusUnits={syllabusUnits}
                    analyses={analyses}
                    predictedPapers={predictedPapers}
                    onSaveAnalysis={handleSaveAnalysis}
                    onImportSyllabusFromAnalysis={handleImportSyllabusFromAnalysis}
                    onGeneratePlanFromAnalysis={handleGeneratePlanFromAnalysis}
                    onSavePredictedPaper={(paper) =>
                      setPredictedPapers((prev) => [paper, ...prev])
                    }
                    onUpdatePredictedPaper={(updated) =>
                      setPredictedPapers((prev) =>
                        prev.map((p) => (p.id === updated.id ? updated : p))
                      )
                    }
                  />
                )}

                {activeView === 'syllabus' && (
                  <SyllabusManagerView
                    syllabusUnits={syllabusUnits}
                    defaultSubject={profile.primarySubject}
                    onUpdateSyllabusUnits={setSyllabusUnits}
                    onGenerateDailyPlan={() => {
                      handleAutoDivideSyllabus();
                      setActiveView('planner');
                    }}
                    onScheduleRevisionForTopic={handleScheduleRevisionForTopic}
                    onStartFocusOnTopic={(topic) =>
                      handleQuickStartFocus(
                        topic.subject,
                        topic.title,
                        topic.estimatedMinutes,
                        topic.id
                      )
                    }
                    onAskAssistantAboutTopic={(topic) =>
                      handleOpenAssistantWithPrompt(
                        `Explain "${topic.title}" (${topic.unitName}) in ${topic.subject} with key formulas, exam-scoring points, and a worked example.`,
                        topic.subject,
                        topic.title
                      )
                    }
                  />
                )}

                {activeView === 'planner' && (
                  <StudyPlannerView
                    profile={profile}
                    tasks={tasks}
                    nightPlans={nightPlans}
                    schedule={schedule}
                    todayHoursStudied={todayHoursStudied}
                    onAddTask={handleAddTask}
                    onToggleTaskComplete={handleToggleTaskComplete}
                    onDeleteTask={handleDeleteTask}
                    onUpdateTask={handleUpdateTask}
                    onReorderTasks={setTasks}
                    onAutoDivideSyllabus={handleAutoDivideSyllabus}
                    onRunSmartRecovery={handleRunSmartRecovery}
                    onSaveNightPlan={handleSaveNightPlan}
                    onSaveSchedule={handleSaveSchedule}
                    onToggleScheduleBlock={handleToggleScheduleBlock}
                    onStartFocusTask={(task) =>
                      handleQuickStartFocus(
                        task.subject,
                        task.title,
                        task.estimatedMinutes,
                        task.syllabusTopicId
                      )
                    }
                  />
                )}

                {activeView === 'revision' && (
                  <RevisionCenterView
                    revisions={revisions}
                    mistakes={mistakes}
                    syllabusUnits={syllabusUnits}
                    daysUntilExam={readiness.daysRemaining}
                    sourceContextDigest={latestAnalysis?.sourceContextDigest}
                    onUpdateRevisions={setRevisions}
                    onAddRevisionFromTopic={handleScheduleRevisionForTopic}
                    onAddMistakes={handleAddMistakes}
                    onToggleMistakeCorrected={handleToggleMistakeCorrected}
                    onDeleteMistake={handleDeleteMistake}
                    onAskAssistant={handleOpenAssistantWithPrompt}
                  />
                )}

                {activeView === 'progress' && (
                  <div className="space-y-6">
                    <div className="bg-[#0F291E] text-[#FAF6EE] rounded-2xl p-5 border border-[#B08D57]/35 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-[11px] text-[#E6CFA3]">Exam Readiness</div>
                        <div className="font-mono text-2xl font-bold tabular-nums mt-0.5">
                          {readiness.overallScore !== null ? `${readiness.overallScore}%` : '—'}
                        </div>
                        <div className="text-[11px] text-[#C8D4CC]">{readiness.verdictLabel}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#E6CFA3]">Study Streak</div>
                        <div className="font-mono text-2xl font-bold tabular-nums mt-0.5">
                          {readiness.studyStreakDays}d
                        </div>
                        <div className="text-[11px] text-[#C8D4CC]">consecutive active days</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#E6CFA3]">Mistakes Resolved</div>
                        <div className="font-mono text-2xl font-bold tabular-nums mt-0.5">
                          {mistakes.filter((m) => m.corrected).length}/{mistakes.length}
                        </div>
                        <div className="text-[11px] text-[#C8D4CC]">in Mistake Bank</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#E6CFA3]">Practice Qs Logged</div>
                        <div className="font-mono text-2xl font-bold tabular-nums mt-0.5">
                          {sessions.reduce((s, x) => s + (x.questionsPracticed || 0), 0)}
                        </div>
                        <div className="text-[11px] text-[#C8D4CC]">from Focus Insights</div>
                      </div>
                    </div>

                    <div className="border border-[#DDD3C1] rounded-2xl overflow-hidden bg-[#FAF6EE]">
                      <TaskAnalyticsView
                        tasks={tasks}
                        sessions={sessions}
                        onAddTask={handleAddTask}
                        onToggleTaskComplete={handleToggleTaskComplete}
                        onDeleteTask={handleDeleteTask}
                        onUpdateIncompleteReason={handleUpdateIncompleteReason}
                        todayHoursStudied={todayHoursStudied}
                        dailyTargetHours={dailyGoalMinutes / 60}
                        focusGuardianEnabled={settings.focusGuardianEnabled !== false}
                        onToggleFocusGuardian={(enabled) =>
                          setSettings((prev) => ({ ...prev, focusGuardianEnabled: enabled }))
                        }
                        isSessionActive={liveSession.isActive}
                        activeSubject={liveSession.subject}
                        remainingSeconds={liveSession.timeLeft}
                        distractionCount={liveSession.strikes}
                        motivationalMessage="You've got this! Return to your studies and complete your session."
                        onNavigateToFocus={() => setActiveView('focus')}
                      />
                    </div>
                  </div>
                )}

                {activeView === 'settings' && (
                  <SettingsView
                    profile={profile}
                    settings={settings}
                    onUpdateProfile={setProfile}
                    onUpdateSettings={setSettings}
                    onReplayOnboarding={() =>
                      setProfile((prev) => ({ ...prev, onboardingCompleted: false }))
                    }
                    onExportBackup={handleExportBackup}
                    onResetCommandCenterData={handleResetCommandCenterData}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Preserved Minimal Floating Corner Toolbar (Shield, Coach, Voice, Ambient Mute) */}
      <div
        aria-label="Study Tools Toolbar"
        className="no-print fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 flex items-center gap-1.5 bg-[#0F291E]/95 backdrop-blur border border-[#B08D57]/45 rounded-xl p-1.5 shadow-2xl"
      >
        <button
          id="distraction-shields-trigger-button"
          type="button"
          onClick={() => setShowDistractionShieldModal(true)}
          title={`Distraction Shields (${shieldModeLabel} mode)`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#173D2D] hover:bg-[#1E4F3A] border border-[#B08D57]/30 text-xs font-medium text-[#FAF6EE] transition-colors whitespace-nowrap shrink-0"
        >
          <Shield className={`w-4 h-4 ${shieldIconColorClass}`} />
          <span className="hidden sm:inline">Shield: {shieldModeLabel}</span>
        </button>

        <button
          id="coach-advice-button"
          type="button"
          onClick={() => setShowCoachModal(true)}
          title="AI Focus Rescue Coach"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#173D2D] hover:bg-[#1E4F3A] text-xs font-medium text-[#FAF6EE] transition-colors whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-4 h-4 text-[#E6CFA3]" />
          <span className="hidden sm:inline">Coach</span>
        </button>

        <button
          id="voice-assistant-header-button"
          type="button"
          onClick={() => setShowVoiceAssistant(true)}
          title="Bilingual Voice Assistant (Hindi / English)"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#8C6B32] hover:bg-[#A17C3D] text-xs font-semibold text-[#FAF6EE] transition-colors whitespace-nowrap shrink-0"
        >
          <Mic className="w-4 h-4" />
          <span>Voice</span>
        </button>

        <button
          id="ambient-sound-toggle"
          type="button"
          onClick={handleToggleAmbientMute}
          title={
            ambientTrack === 'none'
              ? 'Select ambient sound in Focus Mode'
              : ambientMuted
              ? 'Unmute ambient sound'
              : 'Mute ambient sound'
          }
          className="p-2 rounded-lg bg-[#173D2D] hover:bg-[#1E4F3A] text-[#E6CFA3] transition-colors shrink-0"
          aria-label={ambientMuted ? 'Unmute ambient audio' : 'Mute ambient audio'}
        >
          {ambientMuted || ambientTrack === 'none' ? (
            <VolumeX className="w-4 h-4 text-[#C6D1CA]" />
          ) : (
            <Volume2 className="w-4 h-4 text-[#E6CFA3]" />
          )}
        </button>
      </div>

      {/* Grounded AI Study Assistant Drawer */}
      <StudyAssistantDrawer
        isOpen={showStudyAssistant}
        onClose={() => setShowStudyAssistant(false)}
        messages={assistantMessages}
        onAppendMessages={(newMsgs) => setAssistantMessages((prev) => [...prev, ...newMsgs])}
        onClearMessages={() => setAssistantMessages([])}
        defaultSubject={profile.primarySubject || readiness.activeExamSubject}
        sourceContextDigest={latestAnalysis?.sourceContextDigest}
        syllabusUnits={syllabusUnits}
        mistakes={mistakes}
        initialPromptRequest={assistantPromptRequest}
        onPromptHandled={() => setAssistantPromptRequest(null)}
      />

      {/* Bilingual Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={showVoiceAssistant}
        onClose={() => setShowVoiceAssistant(false)}
        onAddTask={handleAddTask}
        onCompleteTask={handleMarkTaskComplete}
        onAddScheduleBlock={handleAddScheduleBlock}
        onUpdateNightPlan={handlePartialUpdateNightPlan}
        onStartFocusSession={(req) => {
          setActiveView('focus');
          setPendingSprint({ ...req, key: Date.now() });
        }}
        tasks={tasks}
        weeklySchedule={schedule}
      />

      {/* Emergency Coaching Modal */}
      <CoachAdviceModal
        isOpen={showCoachModal}
        onClose={() => setShowCoachModal(false)}
        hoursStudiedToday={todayHoursStudied}
        onStartSprint={(durationMinutes) => {
          setActiveView('focus');
          setPendingSprint({ durationMinutes, key: Date.now() });
        }}
      />

      {/* Distraction Shields Modal */}
      <DistractionShieldModal
        isOpen={showDistractionShieldModal}
        onClose={() => setShowDistractionShieldModal(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />
    </div>
  );
}
