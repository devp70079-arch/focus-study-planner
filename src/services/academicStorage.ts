import {
  AcademicProfile,
  DistractionSettings,
  MistakeRecord,
  NightBattlePlan,
  PredictedPaper,
  RevisionItem,
  StrategistAnalysis,
  StudyAssistantMessage,
  StudySession,
  SyllabusUnit,
  Task,
  UploadedAcademicDocument,
  WeeklyScheduleBlock,
} from '../types';
import { getLocalDateString } from '../utils/date';

export const LEGACY_KEYS = {
  TASKS: 'focus_tasks',
  WEEKLY_SCHEDULE: 'focus_weekly_schedule',
  NIGHT_PLANS: 'focus_night_plans',
  SESSIONS: 'focus_sessions',
  SETTINGS: 'focus_settings',
} as const;

export const COMMAND_CENTER_KEYS = {
  PROFILE: 'acc_profile_v1',
  SYLLABUS_UNITS: 'acc_syllabus_units_v1',
  UPLOADED_DOCS: 'acc_uploaded_docs_v1',
  STRATEGIST_ANALYSES: 'acc_strategist_analyses_v1',
  PREDICTED_PAPERS: 'acc_predicted_papers_v1',
  REVISIONS: 'acc_revisions_v1',
  MISTAKES: 'acc_mistakes_v1',
  ASSISTANT_MESSAGES: 'acc_assistant_messages_v1',
} as const;

export const DEFAULT_SETTINGS: DistractionSettings = {
  strictMode: 'strict',
  tabSwitchAlarm: true,
  focusGuardianEnabled: true,
  flipPhoneReminder: true,
  soundEffectOnComplete: true,
  autoBlockDuration: 45,
  blockedApps: [
    'instagram',
    'youtube_shorts',
    'reddit',
    'tiktok',
    'netflix',
    'twitter',
    'twitch',
    'games',
  ],
  allowedEducationalApps: [
    'youtube_edu',
    'khan_academy',
    'ncert_pdf',
    'wikipedia',
    'github_docs',
  ],
  blockedWebsites: ['facebook.com', 'quora.com', 'pinterest.com'],
  zenModeActive: true,
  dailyFocusGoalMinutes: 240,
};

export function createDefaultAcademicProfile(): AcademicProfile {
  return {
    studentName: '',
    universityOrBoard: '',
    courseAndSemester: '',
    primarySubject: '',
    examYear: String(new Date().getFullYear()),
    upcomingExamDate: getLocalDateString(30),
    dailyAvailableHours: 4,
    preparationLevel: 'intermediate',
    exams: [],
    onboardingCompleted: false,
  };
}

export function safeLoadJson<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeSaveJson<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Storage write failed for ${key}:`, err);
    return false;
  }
}

export interface FullBackupPayload {
  exportedAt: string;
  version: string;
  profile: AcademicProfile;
  settings: DistractionSettings;
  tasks: Task[];
  sessions: StudySession[];
  schedule: WeeklyScheduleBlock[];
  nightPlans: NightBattlePlan[];
  syllabusUnits: SyllabusUnit[];
  uploadedDocs: UploadedAcademicDocument[];
  analyses: StrategistAnalysis[];
  predictedPapers: PredictedPaper[];
  revisions: RevisionItem[];
  mistakes: MistakeRecord[];
}

export function exportAcademicBackup(payload: Omit<FullBackupPayload, 'exportedAt' | 'version'>): string {
  const full: FullBackupPayload = {
    exportedAt: new Date().toISOString(),
    version: 'acc-1.0',
    ...payload,
  };
  return JSON.stringify(full, null, 2);
}

export function clearCommandCenterDataOnly(): void {
  Object.values(COMMAND_CENTER_KEYS).forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
}

export function hasAnyLegacyUserData(): boolean {
  return Object.values(LEGACY_KEYS).some((k) => {
    try {
      return localStorage.getItem(k) !== null;
    } catch {
      return false;
    }
  });
}

export function saveAssistantMessagesTrimmed(messages: StudyAssistantMessage[]): void {
  safeSaveJson(COMMAND_CENTER_KEYS.ASSISTANT_MESSAGES, messages.slice(-30));
}
