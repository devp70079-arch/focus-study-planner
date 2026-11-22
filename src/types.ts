export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type IncompleteReason =
  | 'mobile_distraction'
  | 'procrastination'
  | 'underestimated_time'
  | 'fatigue'
  | 'unexpected_work'
  | 'other';

export interface Task {
  id: string;
  title: string;
  subject: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  completed: boolean;
  completedAt?: string; // ISO date string
  dueDate: string; // YYYY-MM-DD
  scheduledTime?: string; // e.g. "09:00"
  priority: Priority;
  category?: 'revision' | 'practice' | 'theory' | 'test' | 'assignment' | 'derivation';
  incompleteReason?: IncompleteReason;
  notes?: string;
  isMIT?: boolean;
  // Syllabus linkage
  syllabusTopicId?: string;
  unitName?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  prerequisites?: string[];
  revisionRequired?: boolean;
  orderIndex?: number;
}

export type StudyMode =
  | 'pomodoro'
  | 'sprint_50_10'
  | 'ultra_90'
  | 'flowtime'
  | 'hardcore_lock'
  | 'custom'
  | 'short_break'
  | 'long_break';

export const MODE_DURATIONS: Record<StudyMode, number> = {
  pomodoro: 25 * 60,
  sprint_50_10: 50 * 60,
  ultra_90: 90 * 60,
  flowtime: 0, // counts up
  hardcore_lock: 60 * 60,
  custom: 40 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

export interface StudySession {
  id: string;
  subject: string;
  topic?: string;
  syllabusTopicId?: string;
  plannedMinutes?: number;
  durationMinutes: number;
  mode: StudyMode;
  timestamp: string; // ISO string
  completed: boolean;
  distractionIncidents: number;
  questionsPracticed?: number;
  selfConfidence?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  soundUsed?: string;
  focusGuardianEnabled?: boolean;
}

export interface FocusGuardianState {
  enabled: boolean;
  isMonitoring: boolean;
  activeSubject: string;
  remainingSeconds: number;
  totalDurationSeconds: number;
  distractionCount: number;
  motivationalMessage: string;
  lastNotificationTime: number;
  notificationPermission: 'default' | 'granted' | 'denied' | 'unsupported';
}

export interface WeeklyScheduleBlock {
  id: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ... 6 = Sat
  dayName?: string;
  startTime: string; // "07:00"
  endTime: string; // "09:00"
  subject: string;
  topic: string;
  color: string;
  completed: boolean;
  notes?: string;
}

export interface PendingSprintRequest {
  durationMinutes: number;
  subject?: string;
  topic?: string;
  syllabusTopicId?: string;
  mode?: StudyMode;
  key: number;
}

export interface NightBattlePlan {
  id: string;
  date: string; // YYYY-MM-DD
  top3MITs: string[];
  morningKickoffTask: string;
  wakeUpTime: string;
  sleepTime: string;
  targetHours?: number;
  phoneLockCommitment: boolean;
  eveningReflection: string;
  antiDistractionRule: string;
  diagnosticInsight?: string;
  motivationalQuote?: string;
  status: 'planned' | 'in_progress' | 'executed';
  createdAt: string;
}

export interface DistractionSettings {
  strictMode: 'gentle' | 'strict' | 'hardcore_last_chance' | boolean;
  tabSwitchAlarm: boolean;
  focusGuardianEnabled?: boolean;
  flipPhoneReminder?: boolean;
  soundEffectOnComplete?: boolean;
  autoBlockDuration?: number;
  blockedApps?: string[];
  allowedEducationalApps?: string[];
  blockedWebsites?: string[];
  zenModeActive?: boolean;
  dailyFocusGoalMinutes?: number;
}

export interface SubjectStat {
  subject: string;
  color: string;
  totalHoursStudied: number;
  tasksCompleted: number;
  tasksIncomplete: number;
}

export interface VoiceAssistantResponse {
  intent: string;
  detectedLanguage: string;
  naturalVoiceReply: string;
  extractedTasks?: Array<{
    title: string;
    subject: string;
    estimatedMinutes: number;
    dueDate?: string;
    priority: Priority;
  }>;
  extractedScheduleBlocks?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    subject: string;
    topic?: string;
  }>;
  nightPlanData?: {
    top3MITs?: string[];
    wakeUpTime?: string;
    sleepTime?: string;
    kickoffTask?: string;
  };
  focusRequest?: {
    subject?: string;
    durationMinutes?: number;
    mode?: string;
  };
}

// ============================================================================
// AI ACADEMIC COMMAND CENTER TYPES
// ============================================================================

export type PreparationLevel = 'beginner' | 'intermediate' | 'revision_stage' | 'exam_week';

export interface ExamEntry {
  id: string;
  subject: string;
  examDate: string; // YYYY-MM-DD
  universityOrBoard: string;
  courseAndSemester: string;
  examPattern?: string;
  targetMarks?: number;
}

export interface AcademicProfile {
  studentName?: string;
  universityOrBoard: string;
  courseAndSemester: string;
  primarySubject: string;
  examYear: string;
  upcomingExamDate: string; // YYYY-MM-DD
  dailyAvailableHours: number;
  preparationLevel: PreparationLevel;
  exams: ExamEntry[];
  onboardingCompleted: boolean;
}

export type UploadedDocCategory =
  | 'syllabus'
  | 'previous_year_paper'
  | 'sample_paper'
  | 'model_paper'
  | 'exam_pattern'
  | 'study_notes';

export interface UploadedAcademicDocument {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: UploadedDocCategory;
  paperYear?: string;
  subject?: string;
  uploadedAt: string;
  extractedSummary?: string;
}

export interface TopicMilestones {
  understanding: boolean;
  notes: boolean;
  practice: boolean;
  revision: boolean;
}

export interface SyllabusSubtopic {
  id: string;
  title: string;
  completed: boolean;
}

export interface SyllabusTopic {
  id: string;
  unitId: string;
  unitName: string;
  subject: string;
  title: string;
  subtopics: SyllabusSubtopic[];
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  priority: Priority;
  prerequisites: string[];
  milestones: TopicMilestones;
  confidence: 1 | 2 | 3 | 4 | 5;
  lastStudiedAt?: string;
  keyFormulas?: string[];
  keyDefinitions?: string[];
  observedFrequencyLabel?: string;
  sourceBasis: 'verified_pyq' | 'syllabus_estimated' | 'manual';
}

export interface SyllabusUnit {
  id: string;
  subject: string;
  unitNumber: number;
  title: string;
  weightageNote?: string;
  topics: SyllabusTopic[];
}

export interface TopicFrequencyRow {
  topic: string;
  unit: string;
  yearsAppeared: string[];
  papersMatchedCount: number;
  totalPapersUploaded: number;
  frequencySummary: string;
  marksObserved: string;
  priority: Priority;
  confidence: 'high' | 'medium' | 'low';
  evidenceSourceRefs: string[];
  basis: 'verified_from_uploaded_papers' | 'ai_estimated_from_syllabus';
}

export interface ExtractedPYQItem {
  questionText: string;
  sourceFile: string;
  paperYear: string;
  questionRef: string;
  mappedUnit: string;
  mappedTopic: string;
  marksObserved: string;
  questionType: string;
}

export interface UnitStrategyItem {
  unit: string;
  recommendedOrder: number;
  focusAllocationHours: number;
  strategy: string;
  prerequisites: string[];
}

export interface StrategistAnalysis {
  id: string;
  createdAt: string;
  subject: string;
  universityOrBoard: string;
  courseAndSemester: string;
  totalUploadedPapers: number;
  documentsAnalyzed: Array<{
    name: string;
    category: UploadedDocCategory;
    paperYear?: string;
  }>;
  limitationsAndWarnings: string[];
  extractedSyllabusUnits: Array<{
    unitNumber: number;
    title: string;
    topics: Array<{
      title: string;
      subtopics: string[];
      estimatedMinutes: number;
      difficulty: 'easy' | 'medium' | 'hard';
      priority: Priority;
      prerequisites: string[];
      keyFormulas?: string[];
      keyDefinitions?: string[];
    }>;
  }>;
  extractedQuestions: ExtractedPYQItem[];
  topicFrequencyTable: TopicFrequencyRow[];
  highPriorityTopics: string[];
  mediumPriorityTopics: string[];
  lowerPriorityTopics: string[];
  frequentlyRepeatedQuestions: Array<{
    pattern: string;
    occurrences: string;
    sourceRefs: string[];
    basis: 'verified' | 'ai_estimated';
  }>;
  importantDerivationsAndDiagrams: string[];
  importantNumericalProblems: string[];
  unitWiseStrategy: UnitStrategyItem[];
  recommendedStudySequence: Array<{
    step: number;
    topic: string;
    unit: string;
    reason: string;
    estimatedHours: number;
  }>;
  lastMinuteRevisionStrategy: string[];
  personalizedExamPlanSummary: string;
  sourceContextDigest: string;
}

export type PredictedQuestionType =
  | 'MCQ'
  | 'Definition'
  | 'Short Answer'
  | 'Long Answer'
  | 'Derivation'
  | 'Numerical'
  | 'Diagram-Based';

export interface PredictedQuestion {
  id: string;
  section: string;
  questionNumber: string;
  unit: string;
  topic: string;
  questionType: PredictedQuestionType;
  marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options?: string[];
  answerKey: string;
  modelAnswer: string;
  basisNote: string;
}

export interface PredictedPaper {
  id: string;
  createdAt: string;
  subject: string;
  examPattern: string;
  totalMarks: number;
  durationMinutes: number;
  difficulty: 'easy' | 'moderate' | 'challenging' | 'exam_standard';
  includedUnits: string[];
  disclaimer: string;
  marksDistribution: Array<{
    section: string;
    questionCount: number;
    marksPerQuestion: number;
    totalMarks: number;
  }>;
  topicCoverage: Array<{
    topic: string;
    unit: string;
    marks: number;
  }>;
  questions: PredictedQuestion[];
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  kind: 'concept' | 'formula' | 'definition';
}

export interface QuickQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  mistakeTypeHint: MistakeType;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface RevisionItem {
  id: string;
  syllabusTopicId: string;
  subject: string;
  unitName: string;
  topicTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  confidence: 1 | 2 | 3 | 4 | 5;
  repetitionStage: number; // 0, 1, 2, 3+
  intervalDays: number;
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedAt?: string;
  lastQuizScorePercent?: number;
  mistakeCount: number;
  keyFormulas: string[];
  keyDefinitions: string[];
  flashcards: FlashcardItem[];
  quizQuestions: QuickQuizQuestion[];
}

export type MistakeType =
  | 'conceptual_gap'
  | 'formula_error'
  | 'calculation_slip'
  | 'misread_question'
  | 'incomplete_steps'
  | 'memory_lapse';

export interface MistakeRecord {
  id: string;
  subject: string;
  topic: string;
  syllabusTopicId?: string;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation: string;
  mistakeType: MistakeType;
  difficulty: 'easy' | 'medium' | 'hard';
  dateRecorded: string; // YYYY-MM-DD
  corrected: boolean;
  correctedAt?: string;
  retryCount: number;
}

export type AssistantExplanationStyle =
  | 'beginner'
  | 'simple'
  | 'detailed'
  | 'exam_oriented'
  | 'quick_revision';

export interface StudyAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  style?: AssistantExplanationStyle;
  subject?: string;
  topic?: string;
  text: string;
  sourceGroundedSection?: string;
  generalExplanationSection?: string;
  stepByStepFormulas?: string[];
  workedExample?: string;
  practiceQuestions?: Array<{ question: string; hint: string }>;
  sourceCitationNote?: string;
}

export interface ReadinessFactor {
  id: string;
  label: string;
  score: number | null; // null when no evidence exists
  weightPercent: number;
  evidenceSummary: string;
  status: 'strong' | 'developing' | 'needs_attention' | 'no_data';
}

export interface ReadinessAssessment {
  hasSufficientEvidence: boolean;
  overallScore: number | null;
  verdictLabel: string;
  factors: ReadinessFactor[];
  weakTopics: Array<{
    topicId?: string;
    subject: string;
    topic: string;
    reason: string;
  }>;
  nextBestAction: {
    title: string;
    detail: string;
    targetView: CommandCenterView;
    ctaLabel: string;
    topicId?: string;
    subject?: string;
  };
  daysRemaining: number | null;
  activeExamSubject: string;
  studyStreakDays: number;
}

export type CommandCenterView =
  | 'home'
  | 'strategist'
  | 'syllabus'
  | 'planner'
  | 'revision'
  | 'focus'
  | 'progress'
  | 'settings';
