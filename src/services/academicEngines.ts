import {
  AcademicProfile,
  MistakeRecord,
  Priority,
  ReadinessAssessment,
  ReadinessFactor,
  RevisionItem,
  StrategistAnalysis,
  StudySession,
  SyllabusTopic,
  SyllabusUnit,
  Task,
  TopicMilestones,
} from '../types';
import { getLocalDateFromISO, getLocalDateString } from '../utils/date';

const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const DIFFICULTY_WEIGHT: Record<'easy' | 'medium' | 'hard', number> = {
  hard: 3,
  medium: 2,
  easy: 1,
};

export function daysBetweenLocalDates(fromYYYYMMDD: string, toYYYYMMDD: string): number {
  const [fy, fm, fd] = fromYYYYMMDD.split('-').map(Number);
  const [ty, tm, td] = toYYYYMMDD.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  const start = new Date(fy, fm - 1, fd).getTime();
  const end = new Date(ty, tm - 1, td).getTime();
  return Math.round((end - start) / 86400000);
}

export function getDaysUntilExam(examDate?: string): number | null {
  if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return null;
  const today = getLocalDateString(0);
  return Math.max(0, daysBetweenLocalDates(today, examDate));
}

export function getMilestoneProgress(milestones: TopicMilestones): number {
  const achieved =
    (milestones.understanding ? 1 : 0) +
    (milestones.notes ? 1 : 0) +
    (milestones.practice ? 1 : 0) +
    (milestones.revision ? 1 : 0);
  return achieved / 4;
}

export function isTopicMastered(topic: SyllabusTopic): boolean {
  // Never consider a topic complete from a single passive milestone alone.
  // Require understanding + practice + at least one of notes/revision.
  return (
    topic.milestones.understanding &&
    topic.milestones.practice &&
    (topic.milestones.notes || topic.milestones.revision)
  );
}

/**
 * Convert a StrategistAnalysis extracted syllabus into persistent SyllabusUnits
 * while merging non-destructively with any existing user milestones.
 */
export function mergeStrategistSyllabusIntoUnits(
  existingUnits: SyllabusUnit[],
  analysis: StrategistAnalysis
): SyllabusUnit[] {
  const subject = analysis.subject || 'General Study';
  const freqMap = new Map(
    analysis.topicFrequencyTable.map((row) => [row.topic.toLowerCase().trim(), row])
  );

  const otherSubjectUnits = existingUnits.filter(
    (u) => u.subject.toLowerCase() !== subject.toLowerCase()
  );
  const existingSubjectTopics = new Map<string, SyllabusTopic>();
  existingUnits
    .filter((u) => u.subject.toLowerCase() === subject.toLowerCase())
    .forEach((u) =>
      u.topics.forEach((t) => existingSubjectTopics.set(t.title.toLowerCase().trim(), t))
    );

  const mergedUnits: SyllabusUnit[] = analysis.extractedSyllabusUnits.map((rawUnit, uIdx) => {
    const unitId = `unit-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${rawUnit.unitNumber || uIdx + 1}`;
    const topics: SyllabusTopic[] = rawUnit.topics.map((rawTopic, tIdx) => {
      const normalizedKey = rawTopic.title.toLowerCase().trim();
      const prev = existingSubjectTopics.get(normalizedKey);
      const freqRow = freqMap.get(normalizedKey);

      return {
        id: prev?.id || `${unitId}-t-${tIdx + 1}-${Date.now().toString(36).slice(-4)}`,
        unitId,
        unitName: `Unit ${rawUnit.unitNumber || uIdx + 1}: ${rawUnit.title}`,
        subject,
        title: rawTopic.title,
        subtopics:
          prev?.subtopics && prev.subtopics.length > 0
            ? prev.subtopics
            : (rawTopic.subtopics || []).map((st, sIdx) => ({
                id: `${unitId}-t-${tIdx + 1}-st-${sIdx + 1}`,
                title: st,
                completed: false,
              })),
        estimatedMinutes: Math.max(20, Math.min(240, rawTopic.estimatedMinutes || 45)),
        difficulty: rawTopic.difficulty || 'medium',
        priority: freqRow?.priority || rawTopic.priority || 'medium',
        prerequisites: rawTopic.prerequisites || [],
        milestones: prev?.milestones || {
          understanding: false,
          notes: false,
          practice: false,
          revision: false,
        },
        confidence: prev?.confidence || 2,
        lastStudiedAt: prev?.lastStudiedAt,
        keyFormulas: rawTopic.keyFormulas || prev?.keyFormulas || [],
        keyDefinitions: rawTopic.keyDefinitions || prev?.keyDefinitions || [],
        observedFrequencyLabel: freqRow?.frequencySummary || prev?.observedFrequencyLabel,
        sourceBasis:
          freqRow?.basis === 'verified_from_uploaded_papers'
            ? 'verified_pyq'
            : 'syllabus_estimated',
      };
    });

    return {
      id: unitId,
      subject,
      unitNumber: rawUnit.unitNumber || uIdx + 1,
      title: rawUnit.title,
      topics,
    };
  });

  return [...mergedUnits, ...otherSubjectUnits];
}

/**
 * Syllabus Divider -> Actionable Daily Study Plan Generator
 * Respects daily available hours, upcoming exam urgency, prerequisites,
 * topic importance, difficulty, preparation level, and existing revision queue.
 */
export function generateDailyPlanFromSyllabus(params: {
  syllabusUnits: SyllabusUnit[];
  existingTasks: Task[];
  revisions: RevisionItem[];
  profile: AcademicProfile;
  targetDate?: string;
}): { generatedTasks: Task[]; summaryNote: string } {
  const { syllabusUnits, existingTasks, revisions, profile } = params;
  const today = params.targetDate || getLocalDateString(0);

  // Realistic daily budget: cap at 85% of available hours to avoid overloading students
  const availableMinutes = Math.max(45, Math.round((profile.dailyAvailableHours || 4) * 60));
  const safeBudgetMinutes = Math.round(availableMinutes * 0.85);

  const existingTodayTasks = existingTasks.filter((t) => t.dueDate === today && !t.completed);
  const alreadyAllocatedMinutes = existingTodayTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 30),
    0
  );
  let remainingBudget = Math.max(0, safeBudgetMinutes - alreadyAllocatedMinutes);

  if (remainingBudget < 20) {
    return {
      generatedTasks: [],
      summaryNote: `Today already has ${alreadyAllocatedMinutes} minutes planned (near your realistic ${safeBudgetMinutes}-minute focus cap). Complete or postpone existing tasks before adding more.`,
    };
  }

  const allTopics = syllabusUnits.flatMap((u) => u.topics);
  if (allTopics.length === 0) {
    return {
      generatedTasks: [],
      summaryNote: 'No syllabus topics found yet. Upload a syllabus in Master Strategist or add units in My Syllabus first.',
    };
  }

  const existingTopicIdsToday = new Set(
    existingTodayTasks.map((t) => t.syllabusTopicId).filter(Boolean)
  );
  const completedTopicTitles = new Set(
    allTopics.filter((t) => isTopicMastered(t)).map((t) => t.title.toLowerCase().trim())
  );

  const generated: Task[] = [];
  let orderCounter = existingTasks.length;

  // 1. Reserve space first for overdue / due-today revisions (spaced repetition protection)
  const dueRevisions = revisions
    .filter((r) => r.nextReviewDate <= today)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
    .slice(0, 2);

  for (const rev of dueRevisions) {
    if (remainingBudget < 15) break;
    if (existingTopicIdsToday.has(rev.syllabusTopicId)) continue;
    const revMinutes = rev.difficulty === 'hard' ? 25 : 15;
    if (revMinutes > remainingBudget) continue;

    generated.push({
      id: `t-rev-${Date.now()}-${orderCounter++}`,
      title: `Revise ${rev.topicTitle} (Spaced Repetition)`,
      subject: rev.subject,
      unitName: rev.unitName,
      syllabusTopicId: rev.syllabusTopicId,
      estimatedMinutes: revMinutes,
      completed: false,
      dueDate: today,
      priority: rev.nextReviewDate < today ? 'critical' : 'high',
      category: 'revision',
      difficulty: rev.difficulty,
      revisionRequired: true,
      isMIT: rev.nextReviewDate < today,
      orderIndex: orderCounter,
    });
    existingTopicIdsToday.add(rev.syllabusTopicId);
    remainingBudget -= revMinutes;
  }

  // 2. Score remaining unmastered syllabus topics considering prerequisites, priority, difficulty, prep level
  const candidateTopics = allTopics
    .filter((t) => !isTopicMastered(t) && !existingTopicIdsToday.has(t.id))
    .map((topic) => {
      const unmetPrereqs = (topic.prerequisites || []).filter(
        (p) => !completedTopicTitles.has(p.toLowerCase().trim())
      );
      let score = PRIORITY_WEIGHT[topic.priority] * 25;
      // Prerequisites met -> strong boost
      score += unmetPrereqs.length === 0 ? 18 : -14 * unmetPrereqs.length;
      // Prep level adaptation
      if (profile.preparationLevel === 'beginner') {
        score += topic.difficulty === 'easy' ? 12 : topic.difficulty === 'medium' ? 6 : 0;
      } else if (profile.preparationLevel === 'exam_week' || profile.preparationLevel === 'revision_stage') {
        score += PRIORITY_WEIGHT[topic.priority] * 10;
      } else {
        score += DIFFICULTY_WEIGHT[topic.difficulty] * 4;
      }
      // Partially started topics deserve completion continuity
      const prog = getMilestoneProgress(topic.milestones);
      if (prog > 0 && prog < 1) score += 15;

      return { topic, score };
    })
    .sort((a, b) => b.score - a.score);

  for (const { topic } of candidateTopics) {
    if (remainingBudget < 20 || generated.length >= 6) break;

    // Decide the next concrete milestone task for this topic
    if (!topic.milestones.understanding) {
      const studyMins = Math.min(Math.max(25, Math.min(topic.estimatedMinutes, 50)), remainingBudget);
      generated.push({
        id: `t-syl-${Date.now()}-${orderCounter++}`,
        title: `Study & understand ${topic.title}`,
        subject: topic.subject,
        unitName: topic.unitName,
        syllabusTopicId: topic.id,
        estimatedMinutes: studyMins,
        completed: false,
        dueDate: today,
        priority: topic.priority,
        category: 'theory',
        difficulty: topic.difficulty,
        prerequisites: topic.prerequisites,
        revisionRequired: true,
        isMIT: topic.priority === 'critical' || generated.length === 0,
        orderIndex: orderCounter,
      });
      remainingBudget -= studyMins;
    }

    if (!topic.milestones.practice && remainingBudget >= 20 && generated.length < 6) {
      const practiceMins = Math.min(25, remainingBudget);
      generated.push({
        id: `t-prac-${Date.now()}-${orderCounter++}`,
        title: `Practice 5 exam questions on ${topic.title}`,
        subject: topic.subject,
        unitName: topic.unitName,
        syllabusTopicId: topic.id,
        estimatedMinutes: practiceMins,
        completed: false,
        dueDate: today,
        priority: topic.priority,
        category: 'practice',
        difficulty: topic.difficulty,
        revisionRequired: true,
        isMIT: false,
        orderIndex: orderCounter,
      });
      remainingBudget -= practiceMins;
    } else if (!topic.milestones.notes && remainingBudget >= 15 && generated.length < 6) {
      const notesMins = Math.min(20, remainingBudget);
      generated.push({
        id: `t-notes-${Date.now()}-${orderCounter++}`,
        title: `Summarize formulas & key notes for ${topic.title}`,
        subject: topic.subject,
        unitName: topic.unitName,
        syllabusTopicId: topic.id,
        estimatedMinutes: notesMins,
        completed: false,
        dueDate: today,
        priority: topic.priority,
        category: 'derivation',
        difficulty: topic.difficulty,
        revisionRequired: false,
        isMIT: false,
        orderIndex: orderCounter,
      });
      remainingBudget -= notesMins;
    }
  }

  const totalAddedMins = generated.reduce((s, t) => s + t.estimatedMinutes, 0);
  return {
    generatedTasks: generated,
    summaryNote:
      generated.length > 0
        ? `Added ${generated.length} balanced tasks (${totalAddedMins} min) within your realistic ${safeBudgetMinutes}-minute daily study capacity.`
        : 'All prioritized syllabus tasks are already scheduled or mastered.',
  };
}

/**
 * Smart Study Recovery Engine
 * Instead of dumping every missed task onto tomorrow, it:
 * - Preserves dedicated revision slots
 * - Prioritizes critical/high & prerequisite tasks first
 * - Redistributes missed workload across the next 3-7 days within daily caps
 */
export function recalculateRecoveryPlan(params: {
  tasks: Task[];
  profile: AcademicProfile;
  revisions: RevisionItem[];
}): {
  updatedTasks: Task[];
  redistributedCount: number;
  deferredLowPriorityCount: number;
  recoverySummary: string;
} {
  const { tasks, profile, revisions } = params;
  const today = getLocalDateString(0);
  const daysLeft = getDaysUntilExam(profile.upcomingExamDate);
  const horizonDays = Math.max(2, Math.min(7, daysLeft !== null && daysLeft > 1 ? daysLeft - 1 : 5));

  const dailyCapacityMinutes = Math.max(60, Math.round((profile.dailyAvailableHours || 4) * 60 * 0.8));

  const overdueTasks = tasks.filter((t) => !t.completed && t.dueDate < today);
  if (overdueTasks.length === 0) {
    return {
      updatedTasks: tasks,
      redistributedCount: 0,
      deferredLowPriorityCount: 0,
      recoverySummary: 'No overdue tasks detected. Your study schedule is on track.',
    };
  }

  // Track already-allocated load per upcoming day (plus reserved revision time)
  const dayLoads: Record<string, number> = {};
  for (let offset = 0; offset < horizonDays; offset++) {
    const dStr = getLocalDateString(offset);
    const existingLoad = tasks
      .filter((t) => !t.completed && t.dueDate === dStr)
      .reduce((s, t) => s + (t.estimatedMinutes || 30), 0);
    const dueRevMinutes = revisions.filter((r) => r.nextReviewDate === dStr).length * 20;
    dayLoads[dStr] = existingLoad + Math.min(45, dueRevMinutes);
  }

  // Sort overdue tasks: revision & critical/high first, low priority last
  const sortedOverdue = [...overdueTasks].sort((a, b) => {
    const revBonusA = a.category === 'revision' ? 2 : 0;
    const revBonusB = b.category === 'revision' ? 2 : 0;
    const scoreA = PRIORITY_WEIGHT[a.priority] + revBonusA;
    const scoreB = PRIORITY_WEIGHT[b.priority] + revBonusB;
    return scoreB - scoreA;
  });

  const reassignedDates = new Map<string, string>();
  let deferredLowPriorityCount = 0;

  for (const task of sortedOverdue) {
    const duration = task.estimatedMinutes || 30;
    let placedDate: string | null = null;

    for (let offset = 0; offset < horizonDays; offset++) {
      const candidateDay = getLocalDateString(offset);
      if ((dayLoads[candidateDay] || 0) + duration <= dailyCapacityMinutes) {
        placedDate = candidateDay;
        dayLoads[candidateDay] = (dayLoads[candidateDay] || 0) + duration;
        break;
      }
    }

    if (!placedDate) {
      // If horizon is full, place on the lightest-load day within horizon (or push low-priority to final day)
      const sortedDays = Object.entries(dayLoads).sort((a, b) => a[1] - b[1]);
      placedDate =
        task.priority === 'low'
          ? getLocalDateString(horizonDays)
          : sortedDays[0]?.[0] || getLocalDateString(1);
      if (task.priority === 'low') deferredLowPriorityCount += 1;
      dayLoads[placedDate] = (dayLoads[placedDate] || 0) + duration;
    }

    reassignedDates.set(task.id, placedDate);
  }

  const updatedTasks = tasks.map((t) => {
    const newDate = reassignedDates.get(t.id);
    if (!newDate) return t;
    return {
      ...t,
      dueDate: newDate,
      notes: t.notes
        ? `${t.notes} (Recovered to ${newDate})`
        : `Rescheduled via Smart Recovery to ${newDate}`,
    };
  });

  return {
    updatedTasks,
    redistributedCount: overdueTasks.length,
    deferredLowPriorityCount,
    recoverySummary: `Redistributed ${overdueTasks.length} missed ${
      overdueTasks.length === 1 ? 'task' : 'tasks'
    } across the next ${horizonDays} days while preserving revision buffers and capping daily load at ~${Math.round(
      dailyCapacityMinutes / 60
    )}h/day.${
      deferredLowPriorityCount > 0
        ? ` ${deferredLowPriorityCount} lower-priority item(s) were shifted later to protect essential topics.`
        : ''
    }`,
  };
}

/**
 * Adaptive Spaced-Repetition Scheduler
 * Computes the next review interval using:
 * - current repetition stage
 * - topic difficulty
 * - student self-confidence (1-5)
 * - latest quiz performance (0-100%)
 * - mistake count
 * - time remaining before upcoming exam
 */
export function computeAdaptiveRevisionInterval(params: {
  repetitionStage: number;
  difficulty: 'easy' | 'medium' | 'hard';
  confidence: 1 | 2 | 3 | 4 | 5;
  quizScorePercent?: number;
  mistakeCount: number;
  daysUntilExam: number | null;
}): { nextStage: number; intervalDays: number; nextReviewDate: string } {
  const baseLadder = [1, 3, 7, 14, 24];
  const score = params.quizScorePercent;

  // Determine whether performance advances or resets stage
  let nextStage = params.repetitionStage + 1;
  if ((score !== undefined && score < 50) || params.confidence <= 2) {
    nextStage = Math.max(0, params.repetitionStage - 1);
  }

  let interval = baseLadder[Math.min(nextStage, baseLadder.length - 1)];

  // Difficulty multiplier
  if (params.difficulty === 'hard') interval *= 0.75;
  if (params.difficulty === 'easy') interval *= 1.25;

  // Confidence adjustment
  if (params.confidence >= 5) interval *= 1.2;
  else if (params.confidence <= 2) interval *= 0.6;

  // Quiz accuracy & mistakes penalty
  if (score !== undefined) {
    if (score < 60) interval = Math.min(interval, 1);
    else if (score < 80) interval *= 0.8;
  }
  if (params.mistakeCount >= 3) {
    interval *= 0.7;
  }

  // Compress intervals smoothly when exam is approaching
  if (params.daysUntilExam !== null && params.daysUntilExam > 0) {
    const maxAllowedGap = Math.max(1, Math.floor(params.daysUntilExam / 2));
    interval = Math.min(interval, maxAllowedGap);
  }

  const intervalDays = Math.max(1, Math.round(interval));
  return {
    nextStage,
    intervalDays,
    nextReviewDate: getLocalDateString(intervalDays),
  };
}

export function createRevisionFromTopic(
  topic: SyllabusTopic,
  daysUntilExam: number | null
): RevisionItem {
  const sched = computeAdaptiveRevisionInterval({
    repetitionStage: 0,
    difficulty: topic.difficulty,
    confidence: topic.confidence,
    mistakeCount: 0,
    daysUntilExam,
  });

  return {
    id: `rev-${topic.id}`,
    syllabusTopicId: topic.id,
    subject: topic.subject,
    unitName: topic.unitName,
    topicTitle: topic.title,
    difficulty: topic.difficulty,
    confidence: topic.confidence,
    repetitionStage: 1,
    intervalDays: sched.intervalDays,
    nextReviewDate: sched.nextReviewDate,
    lastReviewedAt: new Date().toISOString(),
    mistakeCount: 0,
    keyFormulas: topic.keyFormulas || [],
    keyDefinitions: topic.keyDefinitions || [],
    flashcards: [],
    quizQuestions: [],
  };
}

/**
 * Compute consecutive study streak days from actual completed sessions.
 */
export function computeStudyStreakDays(sessions: StudySession[]): number {
  const completedDates = new Set(
    sessions
      .filter((s) => s.completed && s.durationMinutes >= 5)
      .map((s) => getLocalDateFromISO(s.timestamp))
  );

  if (completedDates.size === 0) return 0;

  let streak = 0;
  let offset = 0;
  // Allow streak to stay active if today hasn't been logged yet but yesterday was
  if (!completedDates.has(getLocalDateString(0)) && completedDates.has(getLocalDateString(-1))) {
    offset = -1;
  }

  while (completedDates.has(getLocalDateString(offset))) {
    streak += 1;
    offset -= 1;
  }

  return streak;
}

/**
 * Evidence-Based Exam Readiness Engine
 * Strictly avoids arbitrary or fabricated percentages:
 * Every factor reports real recorded data or `null` ("No recorded evidence yet").
 */
export function calculateExamReadiness(params: {
  profile: AcademicProfile;
  syllabusUnits: SyllabusUnit[];
  tasks: Task[];
  revisions: RevisionItem[];
  mistakes: MistakeRecord[];
  sessions: StudySession[];
  dailyGoalMinutes: number;
}): ReadinessAssessment {
  const { profile, syllabusUnits, tasks, revisions, mistakes, sessions, dailyGoalMinutes } = params;
  const today = getLocalDateString(0);

  // Upcoming exam resolution
  const upcomingExams = [...(profile.exams || [])]
    .filter((e) => e.examDate >= today)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));

  const nearestExam = upcomingExams[0];
  const examDate = nearestExam?.examDate || profile.upcomingExamDate;
  const activeExamSubject = nearestExam?.subject || profile.primarySubject || 'Your Exam';
  const daysRemaining = getDaysUntilExam(examDate);

  const allTopics = syllabusUnits.flatMap((u) => u.topics);
  const studyStreakDays = computeStudyStreakDays(sessions);

  // Factor 1: Syllabus & Milestone Mastery (weight 35%)
  let syllabusScore: number | null = null;
  let syllabusEvidence = 'No syllabus uploaded or added yet.';
  if (allTopics.length > 0) {
    const milestoneSum = allTopics.reduce((sum, t) => sum + getMilestoneProgress(t.milestones), 0);
    syllabusScore = Math.round((milestoneSum / allTopics.length) * 100);
    const masteredCount = allTopics.filter((t) => isTopicMastered(t)).length;
    syllabusEvidence = `${masteredCount} of ${allTopics.length} topics mastered across 4 learning milestones (${syllabusScore}% milestone completion).`;
  }

  // Factor 2: Revision Adherence (weight 25%)
  let revisionScore: number | null = null;
  let revisionEvidence = 'No revision schedule entries recorded yet.';
  const overdueRevisions = revisions.filter((r) => r.nextReviewDate < today);
  const dueTodayRevisions = revisions.filter((r) => r.nextReviewDate === today);
  if (revisions.length > 0) {
    const onTrackCount = revisions.filter((r) => r.nextReviewDate >= today).length;
    const reviewedOnceCount = revisions.filter((r) => r.repetitionStage >= 1).length;
    revisionScore = Math.round(
      ((onTrackCount / revisions.length) * 0.7 + (reviewedOnceCount / revisions.length) * 0.3) * 100
    );
    revisionEvidence = `${onTrackCount}/${revisions.length} topics on schedule · ${overdueRevisions.length} overdue · ${dueTodayRevisions.length} due today.`;
  }

  // Factor 3: Practice & Mistake Resolution (weight 20%)
  let practiceScore: number | null = null;
  let practiceEvidence = 'No quiz scores or practice sessions recorded yet.';
  const quizzedRevisions = revisions.filter((r) => r.lastQuizScorePercent !== undefined);
  const practiceSessions = sessions.filter((s) => s.completed && (s.questionsPracticed || 0) > 0);
  if (quizzedRevisions.length > 0 || mistakes.length > 0 || practiceSessions.length > 0) {
    const avgQuiz =
      quizzedRevisions.length > 0
        ? quizzedRevisions.reduce((s, r) => s + (r.lastQuizScorePercent || 0), 0) /
          quizzedRevisions.length
        : null;
    const resolvedMistakeRate =
      mistakes.length > 0
        ? (mistakes.filter((m) => m.corrected).length / mistakes.length) * 100
        : null;

    if (avgQuiz !== null && resolvedMistakeRate !== null) {
      practiceScore = Math.round(avgQuiz * 0.65 + resolvedMistakeRate * 0.35);
    } else if (avgQuiz !== null) {
      practiceScore = Math.round(avgQuiz);
    } else if (resolvedMistakeRate !== null) {
      practiceScore = Math.round(resolvedMistakeRate);
    } else {
      const totalQ = practiceSessions.reduce((s, p) => s + (p.questionsPracticed || 0), 0);
      practiceScore = Math.min(100, Math.round((totalQ / 30) * 100));
    }

    const uncorrected = mistakes.filter((m) => !m.corrected).length;
    const totalQuestionsPracticed = practiceSessions.reduce(
      (s, p) => s + (p.questionsPracticed || 0),
      0
    );
    practiceEvidence = `${
      avgQuiz !== null ? `Avg quiz ${Math.round(avgQuiz)}%` : `${totalQuestionsPracticed} practice Qs logged`
    } · ${uncorrected} unresolved mistake${uncorrected === 1 ? '' : 's'}.`;
  }

  // Factor 4: Study Consistency (Last 7 days focus logs vs goal) (weight 20%)
  let consistencyScore: number | null = null;
  let consistencyEvidence = 'No completed focus sessions recorded in the last 7 days.';
  const last7DateSet = new Set(Array.from({ length: 7 }, (_, i) => getLocalDateString(-i)));
  const recentSessions = sessions.filter(
    (s) => s.completed && last7DateSet.has(getLocalDateFromISO(s.timestamp))
  );
  if (recentSessions.length > 0) {
    const activeDays = new Set(recentSessions.map((s) => getLocalDateFromISO(s.timestamp))).size;
    const totalMins7d = recentSessions.reduce((s, x) => s + x.durationMinutes, 0);
    const weeklyGoalMins = Math.max(60, dailyGoalMinutes * 5); // 5 active study days/week baseline
    const volumeRatio = Math.min(1, totalMins7d / weeklyGoalMins);
    const cadenceRatio = Math.min(1, activeDays / 5);
    consistencyScore = Math.round((volumeRatio * 0.55 + cadenceRatio * 0.45) * 100);
    consistencyEvidence = `${(totalMins7d / 60).toFixed(1)}h studied across ${activeDays} of last 7 days · ${studyStreakDays}-day streak.`;
  }

  const toStatus = (score: number | null): ReadinessFactor['status'] => {
    if (score === null) return 'no_data';
    if (score >= 75) return 'strong';
    if (score >= 45) return 'developing';
    return 'needs_attention';
  };

  const factors: ReadinessFactor[] = [
    {
      id: 'syllabus',
      label: 'Syllabus Milestone Mastery',
      score: syllabusScore,
      weightPercent: 35,
      evidenceSummary: syllabusEvidence,
      status: toStatus(syllabusScore),
    },
    {
      id: 'revision',
      label: 'Spaced-Repetition Adherence',
      score: revisionScore,
      weightPercent: 25,
      evidenceSummary: revisionEvidence,
      status: toStatus(revisionScore),
    },
    {
      id: 'practice',
      label: 'Practice & Mistake Resolution',
      score: practiceScore,
      weightPercent: 20,
      evidenceSummary: practiceEvidence,
      status: toStatus(practiceScore),
    },
    {
      id: 'consistency',
      label: '7-Day Focus Consistency',
      score: consistencyScore,
      weightPercent: 20,
      evidenceSummary: consistencyEvidence,
      status: toStatus(consistencyScore),
    },
  ];

  const availableFactors = factors.filter((f) => f.score !== null);
  const hasSufficientEvidence = availableFactors.length >= 2 || syllabusScore !== null;

  let overallScore: number | null = null;
  if (availableFactors.length > 0) {
    // Weighted strictly across factors that have recorded evidence; penalize missing syllabus/practice transparently
    const weightSum = availableFactors.reduce((sum, f) => sum + f.weightPercent, 0);
    const weighted = availableFactors.reduce(
      (sum, f) => sum + (f.score || 0) * (f.weightPercent / weightSum),
      0
    );
    // Do not inflate readiness to 100% if only 1 minor factor has data
    const coverageMultiplier = Math.min(1, 0.55 + availableFactors.length * 0.1125);
    overallScore = Math.round(weighted * coverageMultiplier);
  }

  let verdictLabel = 'Insufficient Evidence Yet';
  if (overallScore !== null) {
    if (!hasSufficientEvidence) verdictLabel = 'Early Baseline (Add Syllabus & Practice)';
    else if (overallScore >= 80) verdictLabel = 'Exam-Ready Trajectory';
    else if (overallScore >= 60) verdictLabel = 'Solid Progress — Close Gaps';
    else if (overallScore >= 35) verdictLabel = 'Building Foundation';
    else verdictLabel = 'High Attention Needed';
  }

  // Weak Topics detection from real signals: low confidence, uncorrected mistakes, overdue revisions, low quiz score
  const weakMap = new Map<
    string,
    { topicId?: string; subject: string; topic: string; reason: string }
  >();

  mistakes
    .filter((m) => !m.corrected)
    .forEach((m) => {
      const key = `${m.subject}::${m.topic}`.toLowerCase();
      if (!weakMap.has(key)) {
        weakMap.set(key, {
          topicId: m.syllabusTopicId,
          subject: m.subject,
          topic: m.topic,
          reason: `Unresolved ${m.mistakeType.replace(/_/g, ' ')} mistake`,
        });
      }
    });

  revisions
    .filter(
      (r) =>
        r.nextReviewDate < today ||
        (r.lastQuizScorePercent !== undefined && r.lastQuizScorePercent < 65) ||
        r.confidence <= 2
    )
    .forEach((r) => {
      const key = `${r.subject}::${r.topicTitle}`.toLowerCase();
      if (!weakMap.has(key)) {
        weakMap.set(key, {
          topicId: r.syllabusTopicId,
          subject: r.subject,
          topic: r.topicTitle,
          reason:
            r.nextReviewDate < today
              ? `Revision overdue since ${r.nextReviewDate}`
              : r.lastQuizScorePercent !== undefined && r.lastQuizScorePercent < 65
              ? `Quiz score ${r.lastQuizScorePercent}%`
              : `Low confidence (${r.confidence}/5)`,
        });
      }
    });

  allTopics
    .filter((t) => !isTopicMastered(t) && (t.priority === 'critical' || t.confidence <= 2))
    .slice(0, 5)
    .forEach((t) => {
      const key = `${t.subject}::${t.title}`.toLowerCase();
      if (!weakMap.has(key)) {
        weakMap.set(key, {
          topicId: t.id,
          subject: t.subject,
          topic: t.title,
          reason:
            t.priority === 'critical'
              ? 'High-priority syllabus topic not yet mastered'
              : `Confidence rated ${t.confidence}/5`,
        });
      }
    });

  const weakTopics = Array.from(weakMap.values()).slice(0, 6);

  // Determine the single clearest Next Best Action
  const overdueTasks = tasks.filter((t) => !t.completed && t.dueDate < today);
  const todayPendingTasks = tasks
    .filter((t) => !t.completed && t.dueDate === today)
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  const unresolvedMistakes = mistakes.filter((m) => !m.corrected);

  let nextBestAction: ReadinessAssessment['nextBestAction'];

  if (allTopics.length === 0) {
    nextBestAction = {
      title: 'Upload your syllabus & past papers to generate your exam strategy',
      detail:
        'Start in Master Strategist to extract units, measure verified topic recurrence from your uploaded PYQs, and auto-build your study plan.',
      targetView: 'strategist',
      ctaLabel: 'Open Master Strategist',
    };
  } else if (overdueRevisions.length > 0) {
    const topRev = overdueRevisions[0];
    nextBestAction = {
      title: `Revise ${topRev.topicTitle} and complete a quick recall check`,
      detail: `${overdueRevisions.length} spaced-repetition review${
        overdueRevisions.length === 1 ? ' is' : 's are'
      } overdue. Revising now prevents memory decay before your exam.`,
      targetView: 'revision',
      ctaLabel: 'Open Revision Center',
      topicId: topRev.syllabusTopicId,
      subject: topRev.subject,
    };
  } else if (overdueTasks.length >= 2) {
    nextBestAction = {
      title: `Run Smart Study Recovery for ${overdueTasks.length} missed tasks`,
      detail:
        'Redistribute missed tasks across upcoming days without overloading today or sacrificing your revision schedule.',
      targetView: 'planner',
      ctaLabel: 'Recover Study Plan',
    };
  } else if (todayPendingTasks.length > 0) {
    const topTask = todayPendingTasks[0];
    nextBestAction = {
      title: `${topTask.title} (${topTask.estimatedMinutes} min)`,
      detail: `Your highest-priority task for today in ${topTask.subject}. Launch Focus Mode with Focus Guardian enabled.`,
      targetView: 'focus',
      ctaLabel: 'Start Focus Session',
      topicId: topTask.syllabusTopicId,
      subject: topTask.subject,
    };
  } else if (unresolvedMistakes.length > 0) {
    const topMistake = unresolvedMistakes[0];
    nextBestAction = {
      title: `Fix your recorded mistake in ${topMistake.topic}`,
      detail: `You have ${unresolvedMistakes.length} uncorrected mistake${
        unresolvedMistakes.length === 1 ? '' : 's'
      } in your Mistake Bank. Resolving them raises exam accuracy fastest.`,
      targetView: 'revision',
      ctaLabel: 'Review Mistake Bank',
      subject: topMistake.subject,
    };
  } else {
    const nextTopic = allTopics.find((t) => !isTopicMastered(t));
    nextBestAction = nextTopic
      ? {
          title: `Advance ${nextTopic.title} and practice 5 exam questions`,
          detail: `Generate today's syllabus-backed study plan or launch a focused block on ${nextTopic.subject}.`,
          targetView: 'planner',
          ctaLabel: 'Build Today’s Plan',
          topicId: nextTopic.id,
          subject: nextTopic.subject,
        }
      : {
          title: `Generate a timed AI Predicted Paper for ${activeExamSubject}`,
          detail:
            'Your syllabus milestones are complete. Test exam readiness under timed conditions and inspect any weak areas.',
          targetView: 'strategist',
          ctaLabel: 'Generate Practice Paper',
          subject: activeExamSubject,
        };
  }

  return {
    hasSufficientEvidence,
    overallScore,
    verdictLabel,
    factors,
    weakTopics,
    nextBestAction,
    daysRemaining,
    activeExamSubject,
    studyStreakDays,
  };
}

/**
 * Transparent Platform Capability Descriptor for Focus Guardian & App Restrictions.
 * Never claims a web browser can block native Android OS apps.
 */
export function getFocusPlatformCapabilities() {
  const isBrowser = typeof window !== 'undefined';
  return {
    platform: 'web' as const,
    supportedInBrowser: [
      'Tab & app backgrounding detection via W3C Page Visibility API (document.visibilityState)',
      'Fullscreen Distraction-Free Reading Mode via Fullscreen API',
      'Rate-limited browser study reminder notifications & acoustic return alerts',
      'Session interruption logging, focus goals, streaks, and post-session insights',
      'Curated Allowed Educational Sites & Blocked Targets checklist (used as self-commitment & native sync config)',
    ],
    cannotDoInBrowser: [
      'Cannot intercept, force-close, or block other native Android or desktop applications',
      'Cannot inspect OS process lists to identify which external app the student opened',
    ],
    nativeAndroidIntegrationBoundary: {
      requiredComponents: [
        'Android UsageStatsManager (PACKAGE_USAGE_STATS with explicit user grant in Settings -> Usage Access) for foreground app detection',
        'Android NotificationManager / Foreground Service with POST_NOTIFICATIONS runtime permission for reliable background reminders',
        'Digital Wellbeing / Lock Task Mode or VPN/DNS local allowlist module (blocking distracting packages while whitelisting educational packages like com.google.android.youtube educational channels)',
        'Kotlin/Capacitor bridge exposing `FocusRestrictionBridge.setPolicy(blockedPackages, allowedEducationalPackages)` using the exact JSON config already saved by this web app',
      ],
    },
  };
}
