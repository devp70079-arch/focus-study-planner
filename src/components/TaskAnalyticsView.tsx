import React, { useState } from 'react';
import { CheckCircle2, Plus, Trash2, Search, AlertTriangle, Clock } from 'lucide-react';
import { Task, StudySession, IncompleteReason, Priority } from '../types';
import { FocusGuardianCard } from './FocusGuardianCard';
import { getLocalDateString } from '../utils/date';

interface TaskAnalyticsViewProps {
  tasks: Task[];
  sessions: StudySession[];
  onAddTask: (task: Task) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateIncompleteReason: (taskId: string, reason: IncompleteReason) => void;
  todayHoursStudied: number;
  dailyTargetHours: number;

  // Focus Guardian Dashboard Props
  focusGuardianEnabled?: boolean;
  onToggleFocusGuardian?: (enabled: boolean) => void;
  isSessionActive?: boolean;
  activeSubject?: string;
  remainingSeconds?: number;
  distractionCount?: number;
  motivationalMessage?: string;
  onNavigateToFocus?: () => void;
  mobilePage?: 'left' | 'right';
}

const REASON_LABELS: Record<IncompleteReason, { label: string; color: string }> = {
  mobile_distraction: { label: 'Mobile / Reels Distraction', color: '#991B1B' },
  procrastination: { label: 'Delayed Start / Procrastination', color: '#B45309' },
  underestimated_time: { label: 'Underestimated Complexity', color: '#6D28D9' },
  fatigue: { label: 'Mental Fatigue', color: '#0E7490' },
  unexpected_work: { label: 'Unexpected Interruption', color: '#4A554E' },
  other: { label: 'Other Friction', color: '#6B756F' },
};

export const TaskAnalyticsView: React.FC<TaskAnalyticsViewProps> = ({
  tasks,
  sessions,
  onAddTask,
  onToggleTaskComplete,
  onDeleteTask,
  onUpdateIncompleteReason,
  todayHoursStudied,
  dailyTargetHours,
  focusGuardianEnabled = true,
  onToggleFocusGuardian = () => {},
  isSessionActive = false,
  activeSubject = 'Physics',
  remainingSeconds = 0,
  distractionCount = 0,
  motivationalMessage = "You've got this! Return to your studies and complete your session.",
  onNavigateToFocus,
  mobilePage = 'left',
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed' | 'mit'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const [newTitle, setNewTitle] = useState<string>('');
  const [newSubject, setNewSubject] = useState<string>('Physics');
  const [newMinutes, setNewMinutes] = useState<number>(60);
  const [newPriority, setNewPriority] = useState<Priority>('high');
  const [newDueDate, setNewDueDate] = useState<string>(() => getLocalDateString());
  const [isMIT, setIsMIT] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed);
  const pendingTasks = tasks.filter((t) => !t.completed);
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  const totalStudyMinutes = sessions.reduce(
    (acc, s) => acc + (s.completed ? s.durationMinutes : 0),
    0
  );
  const totalStudyHours = (totalStudyMinutes / 60).toFixed(1);
  const totalDistractionIncidents = sessions.reduce(
    (acc, s) => acc + (s.distractionIncidents || 0),
    0
  );

  const reasonCounts: Record<string, number> = {};
  let taggedIncompleteCount = 0;
  pendingTasks.forEach((t) => {
    if (t.incompleteReason) {
      reasonCounts[t.incompleteReason] = (reasonCounts[t.incompleteReason] || 0) + 1;
      taggedIncompleteCount += 1;
    }
  });

  const subjectHours: Record<string, number> = {};
  sessions.forEach((s) => {
    if (s.completed) {
      subjectHours[s.subject] = (subjectHours[s.subject] || 0) + s.durationMinutes / 60;
    }
  });

  const handleSaveNewTask = () => {
    if (!newTitle.trim()) {
      setFormError('Please enter a task title');
      return;
    }

    const newTask: Task = {
      id: `t-${Date.now()}`,
      title: newTitle.trim(),
      subject: newSubject,
      estimatedMinutes: Number(newMinutes) || 45,
      completed: false,
      dueDate: newDueDate,
      priority: newPriority,
      isMIT,
    };

    onAddTask(newTask);
    setShowAddModal(false);
    setNewTitle('');
    setIsMIT(false);
    setFormError('');
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterTab === 'pending' && t.completed) return false;
    if (filterTab === 'completed' && !t.completed) return false;
    if (filterTab === 'mit' && !t.isMIT) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[640px]">
      {/* ================= LEFT PAGE (Page 7: Study Ledger & Analytics) ================= */}
      <article
        className={`${
          mobilePage === 'left' ? 'block' : 'hidden lg:block'
        } relative p-6 sm:p-8 lg:p-10 lg:border-r lg:border-[#DFD5C3] book-spine-shadow-left space-y-6`}
      >
        <div className="pb-3 border-b border-[#E5DCCB]">
          <div className="text-xs font-medium text-[#8C6B32]">
            Chapter IV · Page 7 · Target {dailyTargetHours.toFixed(1)}h/day
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight text-balance">
            Study Ledger &amp; Audit
          </h2>
        </div>

        {/* 4 Unboxed Ledger Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-b border-[#E5DCCB]">
          <div>
            <span className="text-xs text-[#5A655E] block">Completed</span>
            <span className="font-mono text-2xl font-semibold text-[#14532D] tabular-nums">
              {completedTasks.length}
              <span className="text-xs text-[#6B756F] font-normal">/{totalTasks}</span>
            </span>
            <span className="text-[11px] text-[#4A554E] block tabular-nums">
              {completionRate}% rate
            </span>
          </div>

          <div>
            <span className="text-xs text-[#5A655E] block">Pending</span>
            <span className="font-mono text-2xl font-semibold text-[#991B1B] tabular-nums">
              {pendingTasks.length}
            </span>
            <span className="text-[11px] text-[#4A554E] block">open tasks</span>
          </div>

          <div>
            <span className="text-xs text-[#5A655E] block">Study Hours</span>
            <span className="font-mono text-2xl font-semibold text-[#1C2420] tabular-nums">
              {todayHoursStudied.toFixed(1)}h
            </span>
            <span className="text-[11px] text-[#4A554E] block tabular-nums">
              {totalStudyHours}h total
            </span>
          </div>

          <div>
            <span className="text-xs text-[#5A655E] block">Distractions</span>
            <span className="font-mono text-2xl font-semibold text-[#8C6B32] tabular-nums">
              {totalDistractionIncidents}
            </span>
            <span className="text-[11px] text-[#4A554E] block">logged</span>
          </div>
        </div>

        {/* Focus Guardian Live Status Card */}
        <FocusGuardianCard
          isEnabled={focusGuardianEnabled}
          onToggleEnabled={onToggleFocusGuardian}
          isSessionActive={isSessionActive}
          activeSubject={activeSubject}
          remainingSeconds={remainingSeconds}
          distractionCount={distractionCount}
          motivationalMessage={motivationalMessage}
          onNavigateToFocus={onNavigateToFocus}
        />

        {/* Subject Distribution & Incomplete Reasons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <section className="space-y-3">
            <h3 className="font-serif text-sm font-semibold text-[#1C2420] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#14532D]" />
              <span>Hours by Subject</span>
            </h3>
            <div className="space-y-2.5">
              {[
                { name: 'Physics', color: '#1D4ED8' },
                { name: 'Mathematics', color: '#6D28D9' },
                { name: 'Chemistry', color: '#047857' },
                { name: 'Biology', color: '#BE185D' },
                { name: 'Computer Science', color: '#B45309' },
                { name: 'English', color: '#0E7490' },
                { name: 'Revision', color: '#374151' },
              ].map((sub) => {
                const hours = subjectHours[sub.name] || 0;
                const maxHours = Math.max(...Object.values(subjectHours), 4);
                const barPercent = hours > 0 ? Math.max(4, Math.min(100, Math.round((hours / maxHours) * 100))) : 0;

                return (
                  <div key={sub.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#1C2420]">{sub.name}</span>
                      <span className="font-mono text-[#4A554E] tabular-nums">
                        {hours.toFixed(1)}h
                      </span>
                    </div>
                    <div className="w-full bg-[#E3DAC9] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${barPercent}%`,
                          backgroundColor: sub.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-serif text-sm font-semibold text-[#1C2420] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#8C6B32]" />
              <span>Incomplete Task Causes</span>
            </h3>
            <div className="space-y-2.5">
              {Object.entries(REASON_LABELS).map(([key, config]) => {
                const count = reasonCounts[key] || 0;
                const percent =
                  taggedIncompleteCount > 0 ? Math.round((count / taggedIncompleteCount) * 100) : 0;

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#37423B] truncate pr-2">{config.label}</span>
                      <span className="font-mono text-[#5A655E] tabular-nums shrink-0">
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#E3DAC9] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: config.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </article>

      {/* ================= RIGHT PAGE (Page 8: Task Register) ================= */}
      <article
        className={`${
          mobilePage === 'right' ? 'block' : 'hidden lg:block'
        } relative p-6 sm:p-8 lg:p-10 book-spine-shadow-right flex flex-col justify-between gap-5`}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E5DCCB]">
            <div>
              <div className="text-xs font-medium text-[#8C6B32]">
                Chapter IV · Page 8 · Assignments &amp; Goals
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#1C2420] mt-1 tracking-tight">
                Task Register
              </h2>
            </div>

            <button
              id="add-task-analytics-button"
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 bg-[#F2ECE0] p-1 rounded-lg border border-[#DDD3C1] text-xs overflow-x-auto">
              {(
                [
                  { id: 'all', label: `All (${totalTasks})` },
                  { id: 'pending', label: `Pending (${pendingTasks.length})` },
                  { id: 'completed', label: `Done (${completedTasks.length})` },
                  { id: 'mit', label: `MITs (${tasks.filter((t) => t.isMIT).length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                    filterTab === tab.id
                      ? 'bg-[#0F291E] text-[#FAF6EE]'
                      : 'text-[#4A554E] hover:text-[#1C2420]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7A847D] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search register..."
                className="w-full sm:w-44 bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
              />
            </div>
          </div>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-[#5A655E] text-xs bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl">
              No tasks match this filter. Add a new study task to get started.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 book-scroll">
              {filteredTasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                    t.completed
                      ? 'bg-[#F6F1E6] border-[#E5DCCB] opacity-65'
                      : 'bg-[#F3ECE0] border-[#D8CEBC] hover:border-[#B08D57]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleTaskComplete(t.id)}
                      className="mt-0.5 shrink-0"
                      title={t.completed ? 'Mark incomplete' : 'Mark completed'}
                    >
                      {t.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-[#14532D]" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-[#8C6B32] hover:border-[#14532D] transition-colors" />
                      )}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#5A655E]">
                        <span className="font-semibold text-[#14532D]">{t.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{t.estimatedMinutes}m</span>
                        {t.isMIT && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#8C6B32]">Priority MIT</span>
                          </>
                        )}
                      </div>

                      <h4
                        className={`text-sm font-medium mt-0.5 text-[#1C2420] ${
                          t.completed ? 'line-through text-[#6B756F]' : ''
                        }`}
                      >
                        {t.title}
                      </h4>

                      {!t.completed && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="text-[#5A655E]">Delay cause:</span>
                          <select
                            value={t.incompleteReason || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                onUpdateIncompleteReason(t.id, e.target.value as IncompleteReason);
                              }
                            }}
                            className="bg-[#FAF6EE] border border-[#D4C9B4] rounded px-2 py-0.5 text-[11px] text-[#1C2420] focus:outline-none"
                          >
                            <option value="">Select reason...</option>
                            {Object.entries(REASON_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteTask(t.id)}
                    className="text-[#7A847D] hover:text-[#991B1B] p-1 rounded transition-colors shrink-0"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* Create Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#07140E]/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF6EE] border border-[#B08D57] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-serif text-lg font-semibold text-[#1C2420]">Create Study Task</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#1C2420] font-semibold mb-1">
                  Task Title / Chapter
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="e.g. Solve 25 Organic Chemistry problems"
                  className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                />
                {formError && <p className="text-xs text-[#991B1B] font-semibold mt-1">{formError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#1C2420] font-semibold mb-1">Subject</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                  >
                    {[
                      'Physics',
                      'Mathematics',
                      'Chemistry',
                      'Biology',
                      'Computer Science',
                      'English',
                      'Revision',
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#1C2420] font-semibold mb-1">Est. Minutes</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#1C2420] font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#1C2420] font-semibold mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
                    className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg bg-[#F2ECE0] border border-[#DDD3C1]">
                <input
                  type="checkbox"
                  checked={isMIT}
                  onChange={(e) => setIsMIT(e.target.checked)}
                  className="accent-[#14532D] rounded"
                />
                <span className="text-[#1C2420] font-semibold">
                  Mark as Most Important Task (MIT)
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DCCB]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg bg-[#F2ECE0] text-[#4A554E] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewTask}
                className="px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-xs"
              >
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
