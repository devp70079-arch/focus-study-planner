import { Task, StudySession, WeeklyScheduleBlock, NightBattlePlan, DistractionSettings } from '../types';

const STORAGE_KEYS = {
  TASKS: 'last_chance_tasks_v1',
  SESSIONS: 'last_chance_sessions_v1',
  WEEKLY_SCHEDULE: 'last_chance_weekly_schedule_v1',
  NIGHT_PLANS: 'last_chance_night_plans_v1',
  SETTINGS: 'last_chance_settings_v1',
  DAILY_TARGET: 'last_chance_daily_target_v1',
};

const getTodayString = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const INITIAL_TASKS: Task[] = [
  {
    id: 't-1',
    title: 'Physics: Electromagnetic Induction Numericals (Ch 6)',
    subject: 'Physics',
    estimatedMinutes: 90,
    actualMinutes: 85,
    completed: true,
    completedAt: `${getTodayString()}T10:30:00.000Z`,
    dueDate: getTodayString(),
    scheduledTime: '08:00',
    priority: 'critical',
    category: 'practice',
    isMIT: true,
  },
  {
    id: 't-2',
    title: 'Organic Chemistry: Aldehydes & Ketones Reaction Mechanisms',
    subject: 'Chemistry',
    estimatedMinutes: 75,
    actualMinutes: 60,
    completed: true,
    completedAt: `${getTodayString()}T12:45:00.000Z`,
    dueDate: getTodayString(),
    scheduledTime: '11:00',
    priority: 'high',
    category: 'theory',
    isMIT: true,
  },
  {
    id: 't-3',
    title: 'Mathematics: Definite Integration Previous Year Questions',
    subject: 'Mathematics',
    estimatedMinutes: 120,
    completed: false,
    dueDate: getTodayString(),
    scheduledTime: '16:00',
    priority: 'critical',
    category: 'practice',
    incompleteReason: 'mobile_distraction',
    notes: 'Got sucked into 45 mins of reels scrolling in the afternoon. Need to reschedule.',
    isMIT: true,
  },
  {
    id: 't-4',
    title: 'Biology: Molecular Basis of Inheritance Chapter Summary',
    subject: 'Biology',
    estimatedMinutes: 60,
    completed: false,
    dueDate: getTodayString(),
    scheduledTime: '19:00',
    priority: 'medium',
    category: 'revision',
    incompleteReason: 'fatigue',
    notes: 'Felt exhausted by 8 PM, shifted to tomorrow morning',
  },
  {
    id: 't-5',
    title: 'English: Core Essay & Letter Format Writing Practice',
    subject: 'English',
    estimatedMinutes: 45,
    completed: true,
    completedAt: `${getTodayString(-1)}T17:00:00.000Z`,
    dueDate: getTodayString(-1),
    priority: 'medium',
    category: 'assignment',
  },
  {
    id: 't-6',
    title: 'Computer Science: Python File Handling & Binary Files Code',
    subject: 'Computer Science',
    estimatedMinutes: 60,
    completed: false,
    dueDate: getTodayString(1),
    priority: 'high',
    category: 'practice',
  },
];

const INITIAL_SESSIONS: StudySession[] = [
  {
    id: 's-1',
    subject: 'Physics',
    topic: 'EMI Formulas & Circuit Numericals',
    durationMinutes: 85,
    mode: 'sprint_50_10',
    timestamp: `${getTodayString()}T08:30:00.000Z`,
    completed: true,
    distractionIncidents: 0,
    soundUsed: 'binaural_40hz',
  },
  {
    id: 's-2',
    subject: 'Chemistry',
    topic: 'Aldehydes Reaction Sheet',
    durationMinutes: 60,
    mode: 'pomodoro',
    timestamp: `${getTodayString()}T11:30:00.000Z`,
    completed: true,
    distractionIncidents: 1,
    soundUsed: 'rain',
  },
  {
    id: 's-3',
    subject: 'Mathematics',
    topic: 'Integration substitution shortcuts',
    durationMinutes: 30,
    mode: 'hardcore_lock',
    timestamp: `${getTodayString()}T15:00:00.000Z`,
    completed: false,
    distractionIncidents: 3,
    notes: 'Checked phone notification at min 28, lost momentum.',
    soundUsed: 'brown_noise',
  },
  {
    id: 's-4',
    subject: 'Biology',
    topic: 'Genetics Pedigree Charts',
    durationMinutes: 90,
    mode: 'ultra_90',
    timestamp: `${getTodayString(-1)}T09:00:00.000Z`,
    completed: true,
    distractionIncidents: 0,
    soundUsed: 'lofi_drone',
  },
  {
    id: 's-5',
    subject: 'Physics',
    topic: 'Ray Optics Lens Formula',
    durationMinutes: 120,
    mode: 'flowtime',
    timestamp: `${getTodayString(-2)}T14:00:00.000Z`,
    completed: true,
    distractionIncidents: 1,
    soundUsed: 'binaural_40hz',
  },
];

const INITIAL_WEEKLY_SCHEDULE: WeeklyScheduleBlock[] = [
  // Monday (1)
  { id: 'w-1', dayOfWeek: 1, startTime: '06:00', endTime: '08:00', subject: 'Physics', topic: 'Electrodynamics & Solved Ex.', color: '#3b82f6', completed: true },
  { id: 'w-2', dayOfWeek: 1, startTime: '09:00', endTime: '11:00', subject: 'Mathematics', topic: 'Calculus Practice Set', color: '#8b5cf6', completed: true },
  { id: 'w-3', dayOfWeek: 1, startTime: '16:00', endTime: '18:00', subject: 'Chemistry', topic: 'Organic Reaction Mechanisms', color: '#10b981', completed: false },
  
  // Tuesday (2)
  { id: 'w-4', dayOfWeek: 2, startTime: '06:00', endTime: '08:30', subject: 'Chemistry', topic: 'Coordination Compounds', color: '#10b981', completed: true },
  { id: 'w-5', dayOfWeek: 2, startTime: '10:00', endTime: '12:00', subject: 'Biology', topic: 'Cell Division & Cytogenetics', color: '#ec4899', completed: true },
  { id: 'w-6', dayOfWeek: 2, startTime: '17:00', endTime: '19:30', subject: 'Physics', topic: 'Modern Physics & Dual Nature', color: '#3b82f6', completed: false },
  
  // Wednesday (3)
  { id: 'w-7', dayOfWeek: 3, startTime: '06:00', endTime: '08:00', subject: 'Mathematics', topic: 'Vectors & 3D Geometry', color: '#8b5cf6', completed: true },
  { id: 'w-8', dayOfWeek: 3, startTime: '15:00', endTime: '17:30', subject: 'Physics', topic: 'Optics Wave Theory', color: '#3b82f6', completed: false },
  { id: 'w-9', dayOfWeek: 3, startTime: '19:00', endTime: '21:00', subject: 'Computer Science', topic: 'Data Structures & SQL', color: '#f59e0b', completed: false },
  
  // Thursday (4)
  { id: 'w-10', dayOfWeek: 4, startTime: '06:00', endTime: '08:30', subject: 'Biology', topic: 'Ecology & Environment', color: '#ec4899', completed: false },
  { id: 'w-11', dayOfWeek: 4, startTime: '10:00', endTime: '12:00', subject: 'Chemistry', topic: 'Chemical Kinetics Numericals', color: '#10b981', completed: false },
  { id: 'w-12', dayOfWeek: 4, startTime: '16:00', endTime: '18:30', subject: 'Mathematics', topic: 'Probability & Matrices', color: '#8b5cf6', completed: false },

  // Friday (5)
  { id: 'w-13', dayOfWeek: 5, startTime: '06:00', endTime: '08:00', subject: 'Physics', topic: 'Full Mock Section A', color: '#3b82f6', completed: false },
  { id: 'w-14', dayOfWeek: 5, startTime: '15:00', endTime: '17:00', subject: 'English', topic: 'Sample Paper & Comprehension', color: '#06b6d4', completed: false },
  { id: 'w-15', dayOfWeek: 5, startTime: '18:00', endTime: '20:30', subject: 'Chemistry', topic: 'Solid State & Solutions', color: '#10b981', completed: false },

  // Saturday (6)
  { id: 'w-16', dayOfWeek: 6, startTime: '07:00', endTime: '10:00', subject: 'Mathematics', topic: '3-Hour Timed Mock Test', color: '#8b5cf6', completed: false },
  { id: 'w-17', dayOfWeek: 6, startTime: '14:00', endTime: '17:00', subject: 'Physics', topic: 'Formula Sheet Revision & Errors', color: '#3b82f6', completed: false },

  // Sunday (0)
  { id: 'w-18', dayOfWeek: 0, startTime: '08:00', endTime: '11:00', subject: 'Biology', topic: 'Full NCERT Diagram Review', color: '#ec4899', completed: false },
  { id: 'w-19', dayOfWeek: 0, startTime: '16:00', endTime: '19:00', subject: 'Chemistry', topic: 'Weekly Error Log Analysis', color: '#10b981', completed: false },
];

const INITIAL_NIGHT_PLAN: NightBattlePlan = {
  id: 'np-1',
  date: getTodayString(1), // Tomorrow
  top3MITs: [
    'Conquer Mathematics: Definite Integration PyQs (120 min)',
    'Physics: Ray Optics derivations & prism formula (90 min)',
    'Chemistry: 20 Named Organic Reactions on flashcards (60 min)',
  ],
  morningKickoffTask: 'Solve 3 integral problems immediately with glass of water at 6:00 AM before touching phone',
  wakeUpTime: '06:00 AM',
  sleepTime: '10:45 PM',
  phoneLockCommitment: true,
  eveningReflection: 'Lost 1 hour to Instagram reels in the afternoon today. Tomorrow I will lock my mobile in the drawer across the room.',
  antiDistractionRule: 'Mobile remains in flight mode until the first 2 hours of Math are completed.',
  diagnosticInsight: 'Morning focus was strong (2.5 hrs), afternoon slump occurred due to notifications. Isolating phone in afternoon is essential.',
  motivationalQuote: 'Kal ka din tumhari preparation ka turning point hai. Apne future se compromise mat karo!',
  status: 'planned',
  createdAt: new Date().toISOString(),
};

const INITIAL_SETTINGS: DistractionSettings = {
  strictMode: 'strict',
  tabSwitchAlarm: true,
  flipPhoneReminder: true,
  soundEffectOnComplete: true,
  autoBlockDuration: 50,
};

export const storage = {
  getTasks: (): Task[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  },
  saveTasks: (tasks: Task[]) => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  },

  getSessions: (): StudySession[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : INITIAL_SESSIONS;
    } catch {
      return INITIAL_SESSIONS;
    }
  },
  saveSessions: (sessions: StudySession[]) => {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },

  getWeeklySchedule: (): WeeklyScheduleBlock[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_SCHEDULE);
      return data ? JSON.parse(data) : INITIAL_WEEKLY_SCHEDULE;
    } catch {
      return INITIAL_WEEKLY_SCHEDULE;
    }
  },
  saveWeeklySchedule: (blocks: WeeklyScheduleBlock[]) => {
    localStorage.setItem(STORAGE_KEYS.WEEKLY_SCHEDULE, JSON.stringify(blocks));
  },

  getNightPlans: (): NightBattlePlan[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NIGHT_PLANS);
      return data ? JSON.parse(data) : [INITIAL_NIGHT_PLAN];
    } catch {
      return [INITIAL_NIGHT_PLAN];
    }
  },
  saveNightPlans: (plans: NightBattlePlan[]) => {
    localStorage.setItem(STORAGE_KEYS.NIGHT_PLANS, JSON.stringify(plans));
  },

  getSettings: (): DistractionSettings => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  },
  saveSettings: (settings: DistractionSettings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getDailyTargetHours: (): number => {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.DAILY_TARGET);
      return val ? Number(val) : 6.0;
    } catch {
      return 6.0;
    }
  },
  saveDailyTargetHours: (hours: number) => {
    localStorage.setItem(STORAGE_KEYS.DAILY_TARGET, String(hours));
  },
};
