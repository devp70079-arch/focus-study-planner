import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookMarked,
  Brain,
  CalendarClock,
  CheckCircle2,
  Compass,
  Flame,
  GraduationCap,
  Play,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  AcademicProfile,
  CommandCenterView,
  MistakeRecord,
  ReadinessAssessment,
  RevisionItem,
  StrategistAnalysis,
  SyllabusUnit,
  Task,
} from '../types';
import { getDaysUntilExam, isTopicMastered } from '../services/academicEngines';
import { getLocalDateString } from '../utils/date';

interface CommandCenterHomeProps {
  profile: AcademicProfile;
  readiness: ReadinessAssessment;
  tasks: Task[];
  syllabusUnits: SyllabusUnit[];
  revisions: RevisionItem[];
  mistakes: MistakeRecord[];
  latestAnalysis?: StrategistAnalysis;
  todayHoursStudied: number;
  dailyGoalMinutes: number;
  onNavigate: (view: CommandCenterView) => void;
  onQuickStartFocus: (subject: string, topic: string, durationMinutes?: number) => void;
  onOpenAssistantWithPrompt: (prompt: string, subject?: string, topic?: string) => void;
}

export const CommandCenterHome: React.FC<CommandCenterHomeProps> = ({
  profile,
  readiness,
  tasks,
  syllabusUnits,
  revisions,
  mistakes,
  latestAnalysis,
  todayHoursStudied,
  dailyGoalMinutes,
  onNavigate,
  onQuickStartFocus,
  onOpenAssistantWithPrompt,
}) => {
  const today = getLocalDateString(0);
  const todayTasks = tasks.filter((t) => t.dueDate === today);
  const todayPending = todayTasks.filter((t) => !t.completed);
  const overdueTasks = tasks.filter((t) => !t.completed && t.dueDate < today);
  const dueRevisions = revisions.filter((r) => r.nextReviewDate <= today);
  const unresolvedMistakes = mistakes.filter((m) => !m.corrected);

  const allTopics = syllabusUnits.flatMap((u) => u.topics);
  const masteredTopics = allTopics.filter((t) => isTopicMastered(t)).length;
  const plannedTodayMinutes = todayPending.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
  const dailyGoalHours = dailyGoalMinutes / 60;

  const upcomingExams = [...(profile.exams || [])]
    .filter((e) => e.examDate >= today)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Header Row: Daily Academic Briefing */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E5DCCB]">
        <div>
          <div className="text-xs font-medium text-[#8C6B32]">
            Daily Academic Briefing · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight text-balance">
            {greeting}
            {profile.studentName ? `, ${profile.studentName}` : ''}. Here is your exam strategy today.
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#4A554E]">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#8C6B32]" />
            <span className="font-mono font-semibold text-[#1C2420] tabular-nums">
              {readiness.studyStreakDays}d
            </span>
            <span>streak</span>
          </div>
          <span aria-hidden="true" className="text-[#CFC4B0]">
            |
          </span>
          <div className="flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-[#14532D]" />
            <span className="font-mono font-semibold text-[#1C2420] tabular-nums">
              {todayHoursStudied.toFixed(1)}h / {dailyGoalHours.toFixed(1)}h
            </span>
            <span>today</span>
          </div>
        </div>
      </div>

      {/* Primary Hero Band: Next Best Action + Evidence-Based Exam Readiness */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Next Best Action (Answers: What should I study first?) */}
        <section className="xl:col-span-7 bg-[#0F291E] text-[#FAF6EE] rounded-2xl p-6 border border-[#B08D57]/40 flex flex-col justify-between gap-5 shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#E6CFA3] font-semibold flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                <span>Next Best Action · Start Here First</span>
              </span>
              {readiness.daysRemaining !== null && (
                <span className="font-mono text-[#C8D4CC] tabular-nums">
                  {readiness.daysRemaining}d to {readiness.activeExamSubject}
                </span>
              )}
            </div>

            <h2 className="font-serif text-xl sm:text-2xl font-semibold leading-snug text-[#FAF6EE]">
              {readiness.nextBestAction.title}
            </h2>

            <p className="text-xs sm:text-sm text-[#C8D4CC] leading-relaxed">
              {readiness.nextBestAction.detail}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#1D4634]">
            <button
              id="home-next-best-action-cta"
              type="button"
              onClick={() => {
                if (readiness.nextBestAction.targetView === 'focus' && todayPending[0]) {
                  onQuickStartFocus(
                    todayPending[0].subject,
                    todayPending[0].title,
                    todayPending[0].estimatedMinutes
                  );
                } else {
                  onNavigate(readiness.nextBestAction.targetView);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#8C6B32] hover:bg-[#A17C3D] text-[#FAF6EE] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{readiness.nextBestAction.ctaLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('strategist')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#173D2D] hover:bg-[#1E4F3A] text-[#FAF6EE] text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5 text-[#E6CFA3]" />
              <span>Upload Syllabus / PYQs</span>
            </button>
          </div>
        </section>

        {/* Evidence-Based Exam Readiness Card (Answers: Am I actually prepared?) */}
        <section className="xl:col-span-5 bg-[#F3ECE0] rounded-2xl p-6 border border-[#DDD3C1] flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[#8C6B32]">
                Evidence-Based Exam Readiness
              </div>
              <div className="font-serif text-lg font-semibold text-[#1C2420] mt-0.5">
                {readiness.verdictLabel}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-3xl font-bold text-[#14532D] tabular-nums">
                {readiness.overallScore !== null ? `${readiness.overallScore}%` : '—'}
              </div>
              <div className="text-[11px] text-[#5A655E]">
                {readiness.overallScore !== null ? 'computed score' : 'awaiting data'}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {readiness.factors.map((f) => (
              <div key={f.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#1C2420]">{f.label}</span>
                  <span className="font-mono text-[#4A554E] tabular-nums">
                    {f.score !== null ? `${f.score}%` : 'No data'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#E2D8C6] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${f.score ?? 0}%`,
                      backgroundColor:
                        f.status === 'strong'
                          ? '#14532D'
                          : f.status === 'developing'
                          ? '#8C6B32'
                          : f.status === 'needs_attention'
                          ? '#991B1B'
                          : '#CBD5E1',
                    }}
                  />
                </div>
                <div className="text-[11px] text-[#5A655E]">{f.evidenceSummary}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 4 Crisp Unboxed Status Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-3 border-y border-[#E5DCCB]">
        <div>
          <span className="text-xs text-[#5A655E] block">Today’s Planned Workload</span>
          <span className="font-mono text-2xl font-semibold text-[#1C2420] tabular-nums">
            {todayPending.length} tasks
          </span>
          <span className="text-[11px] text-[#4A554E] block tabular-nums">
            {plannedTodayMinutes} min remaining · {overdueTasks.length} overdue
          </span>
        </div>

        <div>
          <span className="text-xs text-[#5A655E] block">Syllabus Mastery</span>
          <span className="font-mono text-2xl font-semibold text-[#14532D] tabular-nums">
            {masteredTopics}/{allTopics.length}
          </span>
          <span className="text-[11px] text-[#4A554E] block">
            {syllabusUnits.length} syllabus units tracked
          </span>
        </div>

        <div>
          <span className="text-xs text-[#5A655E] block">Revisions Due Now</span>
          <span
            className={`font-mono text-2xl font-semibold tabular-nums ${
              dueRevisions.length > 0 ? 'text-[#8C6B32]' : 'text-[#14532D]'
            }`}
          >
            {dueRevisions.length}
          </span>
          <span className="text-[11px] text-[#4A554E] block">
            {revisions.length} total in spaced recall
          </span>
        </div>

        <div>
          <span className="text-xs text-[#5A655E] block">Unresolved Mistakes</span>
          <span
            className={`font-mono text-2xl font-semibold tabular-nums ${
              unresolvedMistakes.length > 0 ? 'text-[#991B1B]' : 'text-[#14532D]'
            }`}
          >
            {unresolvedMistakes.length}
          </span>
          <span className="text-[11px] text-[#4A554E] block">tracked in Mistake Bank</span>
        </div>
      </div>

      {/* Three Action Columns: Today's Plan | High-Yield & Weak Topics | Upcoming Exams & Revision */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: What should I complete today? */}
        <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-[#1C2420]">
                Today’s Study Queue
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="text-xs font-semibold text-[#14532D] hover:underline inline-flex items-center gap-1"
              >
                <span>Planner</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {overdueTasks.length > 0 && (
              <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] flex items-center justify-between gap-2">
                <span>{overdueTasks.length} missed task(s) need recovery</span>
                <button
                  type="button"
                  onClick={() => onNavigate('planner')}
                  className="font-semibold underline shrink-0"
                >
                  Recover
                </button>
              </div>
            )}

            {todayPending.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#F3ECE0] text-xs text-[#5A655E] space-y-2">
                <p>No pending tasks scheduled for today yet.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('planner')}
                  className="font-semibold text-[#14532D] hover:underline"
                >
                  Auto-divide syllabus into today’s plan →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {todayPending.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-[#F3ECE0] border border-[#E5DCCB] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[#14532D] truncate">
                        {t.subject} · <span className="font-mono">{t.estimatedMinutes}m</span>
                      </div>
                      <div className="text-xs font-medium text-[#1C2420] truncate mt-0.5">
                        {t.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickStartFocus(t.subject, t.title, t.estimatedMinutes)}
                      className="p-1.5 rounded-md bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] shrink-0"
                      title="Start Focus Session for this task"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Column 2: Weak Topics & High-Importance Priorities */}
        <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-[#1C2420]">
                Priority &amp; Weak Areas
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('strategist')}
                className="text-xs font-semibold text-[#14532D] hover:underline inline-flex items-center gap-1"
              >
                <span>Strategist</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {readiness.weakTopics.length > 0 ? (
              <div className="space-y-2">
                {readiness.weakTopics.slice(0, 4).map((w, idx) => (
                  <div
                    key={`${w.subject}-${w.topic}-${idx}`}
                    className="p-3 rounded-lg bg-[#F3ECE0] border border-[#E5DCCB] flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1C2420] truncate">{w.topic}</div>
                      <div className="text-[11px] text-[#991B1B] mt-0.5">{w.reason}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenAssistantWithPrompt(
                          `Explain ${w.topic} in ${w.subject} in an exam-oriented way and help me fix this weak area: ${w.reason}.`,
                          w.subject,
                          w.topic
                        )
                      }
                      className="text-[11px] font-semibold text-[#14532D] hover:underline shrink-0"
                    >
                      Ask AI
                    </button>
                  </div>
                ))}
              </div>
            ) : latestAnalysis && latestAnalysis.highPriorityTopics.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] text-[#8C6B32] font-medium">
                  High-priority topics from {latestAnalysis.subject} analysis:
                </div>
                {latestAnalysis.highPriorityTopics.slice(0, 4).map((topic, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#F3ECE0] border border-[#E5DCCB] text-xs font-medium text-[#1C2420] flex items-center gap-2"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-[#8C6B32] shrink-0" />
                    <span className="truncate">{topic}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#F3ECE0] text-xs text-[#5A655E] space-y-2">
                <p>No weak topics flagged yet. Upload a syllabus or complete a quick revision quiz to uncover gaps.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('strategist')}
                  className="font-semibold text-[#14532D] hover:underline"
                >
                  Analyze syllabus &amp; PYQs →
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Column 3: Upcoming Exams & Revision Pulse */}
        <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-[#1C2420]">
                Upcoming Exams &amp; Recall
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="text-xs font-semibold text-[#14532D] hover:underline inline-flex items-center gap-1"
              >
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {upcomingExams.length > 0 ? (
              <div className="space-y-2">
                {upcomingExams.slice(0, 3).map((ex) => {
                  const dLeft = getDaysUntilExam(ex.examDate);
                  return (
                    <div
                      key={ex.id}
                      className="p-3 rounded-lg bg-[#F3ECE0] border border-[#E5DCCB] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#1C2420] truncate">
                          {ex.subject}
                        </div>
                        <div className="text-[11px] text-[#5A655E] truncate">
                          {ex.examDate} · {ex.universityOrBoard}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#14532D] tabular-nums shrink-0">
                        {dLeft !== null ? `${dLeft}d` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-[#F3ECE0] border border-[#E5DCCB] text-xs text-[#5A655E] flex items-start gap-2.5">
                <GraduationCap className="w-4 h-4 text-[#8C6B32] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-[#1C2420]">
                    {profile.primarySubject || 'Primary Exam'}
                  </div>
                  <div className="mt-0.5">
                    Target date: {profile.upcomingExamDate || 'Not set'} · Add multiple exams in Settings.
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#E5DCCB] flex items-center justify-between text-xs">
              <span className="text-[#4A554E] flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-[#14532D]" />
                <span>{dueRevisions.length} due for revision</span>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('revision')}
                className="font-semibold text-[#14532D] hover:underline"
              >
                Revise now →
              </button>
            </div>
          </div>

          {/* Fast Links */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E5DCCB]">
            <button
              type="button"
              onClick={() => onNavigate('syllabus')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#F3ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-xs font-medium text-[#1C2420] transition-colors"
            >
              <BookMarked className="w-3.5 h-3.5 text-[#14532D]" />
              <span>My Syllabus</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenAssistantWithPrompt(
                  `Give me a concise study briefing for ${readiness.activeExamSubject} focusing on what to revise first.`,
                  readiness.activeExamSubject
                )
              }
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#F3ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-xs font-medium text-[#1C2420] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8C6B32]" />
              <span>Ask AI Tutor</span>
            </button>
          </div>
        </section>
      </div>

      {/* Explicit Honesty Footer Note when Syllabus is Empty */}
      {allTopics.length === 0 && (
        <div className="p-4 rounded-xl bg-[#F3ECE0] border border-[#D8CEBC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#4A554E]">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#14532D] mt-0.5 shrink-0" />
            <span>
              <strong>Zero fabricated student data:</strong> Your readiness score, PYQ frequency table, and revision calendar build strictly from your uploaded syllabus, past papers, focus sessions, and quiz results.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('strategist')}
            className="px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            Start With Master Strategist
          </button>
        </div>
      )}
    </div>
  );
};
