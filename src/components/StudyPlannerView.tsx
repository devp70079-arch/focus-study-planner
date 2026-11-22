import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FastForward,
  Play,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import {
  AcademicProfile,
  NightBattlePlan,
  Priority,
  Task,
  WeeklyScheduleBlock,
} from '../types';
import { getLocalDateString } from '../utils/date';
import { NightPlanView } from './NightPlanView';
import { WeeklyPlanner } from './WeeklyPlanner';

interface StudyPlannerViewProps {
  profile: AcademicProfile;
  tasks: Task[];
  nightPlans: NightBattlePlan[];
  schedule: WeeklyScheduleBlock[];
  todayHoursStudied: number;
  onAddTask: (task: Task) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onReorderTasks: (orderedTasks: Task[]) => void;
  onAutoDivideSyllabus: () => string;
  onRunSmartRecovery: () => string;
  onSaveNightPlan: (plan: NightBattlePlan) => void;
  onSaveSchedule: (blocks: WeeklyScheduleBlock[]) => void;
  onToggleScheduleBlock: (blockId: string) => void;
  onStartFocusTask: (task: Task) => void;
}

export const StudyPlannerView: React.FC<StudyPlannerViewProps> = ({
  profile,
  tasks,
  nightPlans,
  schedule,
  todayHoursStudied,
  onAddTask,
  onToggleTaskComplete,
  onDeleteTask,
  onUpdateTask,
  onReorderTasks,
  onAutoDivideSyllabus,
  onRunSmartRecovery,
  onSaveNightPlan,
  onSaveSchedule,
  onToggleScheduleBlock,
  onStartFocusTask,
}) => {
  const [subTab, setSubTab] = useState<'daily' | 'night' | 'weekly'>('daily');
  const [statusMessage, setStatusMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState(profile.primarySubject || 'General');
  const [newMinutes, setNewMinutes] = useState(40);
  const [newDueDate, setNewDueDate] = useState(() => getLocalDateString(0));
  const [newPriority, setNewPriority] = useState<Priority>('high');
  const [newCategory, setNewCategory] = useState<NonNullable<Task['category']>>('theory');

  const today = getLocalDateString(0);
  const tomorrow = getLocalDateString(1);

  const overdueTasks = tasks.filter((t) => !t.completed && t.dueDate < today);
  const todayTasks = tasks.filter((t) => t.dueDate === today);
  const upcomingTasks = tasks
    .filter((t) => t.dueDate > today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const todayPendingMinutes = todayTasks
    .filter((t) => !t.completed)
    .reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
  const safeDailyBudgetMinutes = Math.round((profile.dailyAvailableHours || 4) * 60 * 0.85);
  const loadRatio = Math.min(100, Math.round((todayPendingMinutes / (safeDailyBudgetMinutes || 1)) * 100));

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask({
      id: `t-${Date.now()}`,
      title: newTitle.trim(),
      subject: newSubject.trim() || 'General',
      estimatedMinutes: Math.max(10, Number(newMinutes) || 30),
      completed: false,
      dueDate: newDueDate,
      priority: newPriority,
      category: newCategory,
      isMIT: newPriority === 'critical',
    });
    setNewTitle('');
    setShowAddForm(false);
  };

  const handleMoveTodayTask = (taskId: string, direction: -1 | 1) => {
    const todayIds = todayTasks.map((t) => t.id);
    const idx = todayIds.indexOf(taskId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= todayIds.length) return;

    const copy = [...todayTasks];
    const [item] = copy.splice(idx, 1);
    copy.splice(swapIdx, 0, item);

    const others = tasks.filter((t) => t.dueDate !== today);
    onReorderTasks([...copy, ...others]);
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E5DCCB]">
        <div>
          <div className="text-xs font-medium text-[#8C6B32]">
            Daily Execution · Smart Study Recovery · Night Ritual · Weekly Timetable
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight">
            Study Planner
          </h1>
        </div>

        <div className="inline-flex bg-[#F2ECE0] p-1 rounded-lg border border-[#DDD3C1] text-xs self-start">
          {(
            [
              { id: 'daily', label: 'Daily Action Plan' },
              { id: 'night', label: 'Night Battle Plan' },
              { id: 'weekly', label: 'Weekly Timetable' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-2 rounded-md font-semibold transition-colors whitespace-nowrap ${
                subTab === t.id
                  ? 'bg-[#0F291E] text-[#FAF6EE]'
                  : 'text-[#4A554E] hover:text-[#1C2420]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== SUB-TAB 1: DAILY ACTION PLAN ==================== */}
      {subTab === 'daily' && (
        <div className="space-y-5">
          {/* Action & Workload Strip */}
          <div className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1C2420] flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-[#14532D]" />
                  <span>Today’s Workload vs Realistic Focus Capacity</span>
                </span>
                <span className="font-mono text-[#4A554E] tabular-nums">
                  {todayPendingMinutes}m / {safeDailyBudgetMinutes}m cap
                </span>
              </div>
              <div className="w-full h-2 bg-[#E0D6C4] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${loadRatio}%`,
                    backgroundColor:
                      todayPendingMinutes > safeDailyBudgetMinutes ? '#991B1B' : '#14532D',
                  }}
                />
              </div>
              <p className="text-[11px] text-[#5A655E]">
                Budgeted at 85% of your {profile.dailyAvailableHours}h daily study availability to prevent burnout and leave room for spaced revisions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                id="planner-auto-divide-btn"
                type="button"
                onClick={() => setStatusMessage(onAutoDivideSyllabus())}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-[#E6CFA3]" />
                <span>Auto-Divide Syllabus for Today</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FAF6EE] hover:bg-[#E7DEC9] border border-[#D4C9B4] text-xs font-semibold text-[#1C2420]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#14532D] font-medium flex items-center justify-between gap-3">
              <span>{statusMessage}</span>
              <button
                type="button"
                onClick={() => setStatusMessage('')}
                className="underline font-semibold shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Smart Study Recovery Banner (Appears whenever missed tasks exist) */}
          {overdueTasks.length > 0 && (
            <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-[#7F1D1D]">
                <AlertTriangle className="w-4 h-4 text-[#991B1B] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">
                    {overdueTasks.length} Missed Study {overdueTasks.length === 1 ? 'Task' : 'Tasks'} Detected
                  </div>
                  <p className="mt-0.5 text-[#991B1B]">
                    Smart Study Recovery redistributes missed tasks across upcoming days while preserving revision slots and capping daily workload.
                  </p>
                </div>
              </div>
              <button
                id="planner-smart-recovery-btn"
                type="button"
                onClick={() => setStatusMessage(onRunSmartRecovery())}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#991B1B] hover:bg-[#7F1D1D] text-[#FAF6EE] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Run Smart Study Recovery</span>
              </button>
            </div>
          )}

          {/* Add Task Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreateTask}
              className="p-4 rounded-xl bg-[#FAF6EE] border border-[#B08D57] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs items-end"
            >
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#1C2420] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Complete Binary Tree Traversal — 40m"
                  className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">Subject</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">Minutes</label>
                <input
                  type="number"
                  min={10}
                  max={240}
                  value={newMinutes}
                  onChange={(e) => setNewMinutes(Number(e.target.value))}
                  className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as Priority)}
                  className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-2 py-2"
                  aria-label="Priority"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-2 py-2"
                  aria-label="Category"
                >
                  <option value="theory">Study</option>
                  <option value="practice">Practice</option>
                  <option value="revision">Revision</option>
                  <option value="derivation">Derivation</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-lg bg-[#F2ECE0] text-[#4A554E] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#14532D] text-[#FAF6EE] font-semibold"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {/* Today's Actionable Study Plan */}
          <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl overflow-hidden">
            <div className="p-4 bg-[#F3ECE0] border-b border-[#E5DCCB] flex items-center justify-between">
              <h2 className="font-serif text-base font-semibold text-[#1C2420]">
                Today’s Study Plan ({today})
              </h2>
              <span className="font-mono text-xs text-[#4A554E] tabular-nums">
                {todayTasks.filter((t) => t.completed).length}/{todayTasks.length} completed
              </span>
            </div>

            {todayTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5A655E]">
                No tasks scheduled for today. Click <strong>Auto-Divide Syllabus for Today</strong> or{' '}
                <strong>Add Task</strong> to build a realistic daily queue.
              </div>
            ) : (
              <div className="divide-y divide-[#EAE2D3]">
                {todayTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      task.completed ? 'opacity-65 bg-[#F8F4EC]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleTaskComplete(task.id)}
                        className="mt-0.5 shrink-0"
                        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-[#14532D]" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-[#8C6B32] hover:border-[#14532D]" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#5A655E]">
                          <span className="font-bold text-[#14532D]">{task.subject}</span>
                          <span>·</span>
                          <span className="tabular-nums">{task.estimatedMinutes} min</span>
                          <span>·</span>
                          <span className="uppercase">{task.priority}</span>
                          {task.category && (
                            <>
                              <span>·</span>
                              <span className="capitalize">{task.category}</span>
                            </>
                          )}
                        </div>
                        <div
                          className={`text-sm font-medium mt-0.5 ${
                            task.completed ? 'line-through text-[#6B756F]' : 'text-[#1C2420]'
                          }`}
                        >
                          {idx + 1}. {task.title}
                        </div>
                        {task.notes && (
                          <div className="text-[11px] text-[#5A655E] mt-0.5">{task.notes}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!task.completed && (
                        <>
                          <button
                            type="button"
                            onClick={() => onStartFocusTask(task)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-[11px] font-semibold"
                            title="Start Focus Timer for this task"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Focus</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateTask(task.id, { dueDate: tomorrow })}
                            className="p-1.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#4A554E]"
                            title="Postpone to tomorrow"
                          >
                            <FastForward className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMoveTodayTask(task.id, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-[#F2ECE0] text-[#4A554E] disabled:opacity-35"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTodayTask(task.id, 1)}
                        disabled={idx === todayTasks.length - 1}
                        className="p-1.5 rounded-lg bg-[#F2ECE0] text-[#4A554E] disabled:opacity-35"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 text-[#7A847D] hover:text-[#991B1B]"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Scheduled Tasks */}
          {upcomingTasks.length > 0 && (
            <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl overflow-hidden">
              <div className="p-4 bg-[#F3ECE0] border-b border-[#E5DCCB]">
                <h3 className="font-serif text-sm font-semibold text-[#1C2420]">
                  Upcoming Days ({upcomingTasks.length} scheduled)
                </h3>
              </div>
              <div className="divide-y divide-[#EAE2D3]">
                {upcomingTasks.slice(0, 12).map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-[#8C6B32] mr-2 tabular-nums">
                        {task.dueDate}
                      </span>
                      <span className="font-semibold text-[#14532D] mr-2">{task.subject}</span>
                      <span className="text-[#1C2420]">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateTask(task.id, { dueDate: today })}
                        className="text-[11px] font-semibold text-[#14532D] hover:underline"
                      >
                        Move to Today
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="text-[#7A847D] hover:text-[#991B1B]"
                        aria-label={`Delete ${task.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ==================== SUB-TAB 2: NIGHT BATTLE PLAN (Preserved) ==================== */}
      {subTab === 'night' && (
        <div className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl overflow-hidden">
          <NightPlanView
            nightPlans={nightPlans}
            onSaveNightPlan={onSaveNightPlan}
            tasks={tasks}
            hoursStudiedToday={todayHoursStudied}
          />
        </div>
      )}

      {/* ==================== SUB-TAB 3: WEEKLY TIMETABLE (Preserved) ==================== */}
      {subTab === 'weekly' && (
        <div className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl overflow-hidden">
          <WeeklyPlanner
            schedule={schedule}
            onSaveSchedule={onSaveSchedule}
            onToggleBlockComplete={onToggleScheduleBlock}
          />
        </div>
      )}
    </div>
  );
};
