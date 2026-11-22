import React, { useState } from 'react';
import { Calendar, Plus, Sparkles, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { WeeklyScheduleBlock } from '../types';

interface WeeklyPlannerProps {
  schedule: WeeklyScheduleBlock[];
  onSaveSchedule: (blocks: WeeklyScheduleBlock[]) => void;
  onToggleBlockComplete: (blockId: string) => void;
  mobilePage?: 'left' | 'right';
}

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday', short: 'MON' },
  { id: 2, name: 'Tuesday', short: 'TUE' },
  { id: 3, name: 'Wednesday', short: 'WED' },
  { id: 4, name: 'Thursday', short: 'THU' },
  { id: 5, name: 'Friday', short: 'FRI' },
  { id: 6, name: 'Saturday', short: 'SAT' },
  { id: 0, name: 'Sunday', short: 'SUN' },
];

const SUBJECT_COLORS: Record<string, string> = {
  Physics: '#1D4ED8',
  Mathematics: '#6D28D9',
  Chemistry: '#047857',
  Biology: '#BE185D',
  'Computer Science': '#B45309',
  English: '#0E7490',
  Revision: '#374151',
};

export const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({
  schedule,
  onSaveSchedule,
  onToggleBlockComplete,
  mobilePage = 'left',
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);

  // New Block Form state
  const [newDay, setNewDay] = useState<number>(selectedDay);
  const [newStartTime, setNewStartTime] = useState<string>('06:00');
  const [newEndTime, setNewEndTime] = useState<string>('08:00');
  const [newSubject, setNewSubject] = useState<string>('Physics');
  const [newTopic, setNewTopic] = useState<string>('');

  // AI Weekly Generator State
  const [targetWeeklyHours, setTargetWeeklyHours] = useState<number>(35);
  const [weakSubjects, setWeakSubjects] = useState<string>('Mathematics, Chemistry');
  const [examDays, setExamDays] = useState<number>(14);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiStrategySummary, setAiStrategySummary] = useState<string>('');
  const [addModalError, setAddModalError] = useState<string>('');
  const [aiGenError, setAiGenError] = useState<string>('');

  const handleAddBlock = () => {
    if (!newTopic.trim()) {
      setAddModalError('Please enter a topic or goal for this study slot.');
      return;
    }

    const [sh, sm] = newStartTime.split(':').map(Number);
    const [eh, em] = newEndTime.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      setAddModalError('End time must be after start time.');
      return;
    }

    const newBlock: WeeklyScheduleBlock = {
      id: `w-${Date.now()}`,
      dayOfWeek: newDay,
      startTime: newStartTime,
      endTime: newEndTime,
      subject: newSubject,
      topic: newTopic.trim(),
      color: SUBJECT_COLORS[newSubject] || '#14532D',
      completed: false,
    };

    onSaveSchedule([...schedule, newBlock]);
    setSelectedDay(newDay);
    setShowAddModal(false);
    setNewTopic('');
    setAddModalError('');
  };

  const handleDeleteBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveSchedule(schedule.filter((b) => b.id !== id));
  };

  const handleGenerateAiSchedule = async () => {
    setIsAiGenerating(true);
    setAiGenError('');
    try {
      const response = await fetch('/api/ai/generate-week-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetWeeklyHours,
          weakSubjects: weakSubjects
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          examCountdownDays: examDays,
          subjects: ['Physics', 'Mathematics', 'Chemistry', 'Biology', 'English', 'Computer Science'],
        }),
      });

      const res = await response.json();
      if (response.ok && res.success && res.data?.scheduleBlocks) {
        const generated: WeeklyScheduleBlock[] = res.data.scheduleBlocks.map(
          (b: any, idx: number) => {
            const rawDay = typeof b.dayOfWeek === 'number' ? b.dayOfWeek : 1;
            const normalizedDay = rawDay === 7 ? 0 : Math.max(0, Math.min(6, rawDay));
            return {
              id: `ai-${Date.now()}-${idx}`,
              dayOfWeek: normalizedDay,
              startTime: b.startTime || '07:00',
              endTime: b.endTime || '09:00',
              subject: b.subject || 'Physics',
              topic: b.topic || 'Exam Focus Block',
              color: SUBJECT_COLORS[b.subject] || '#1D4ED8',
              completed: false,
              notes: b.tip,
            };
          }
        );

        onSaveSchedule(generated);
        setAiStrategySummary(res.data.strategySummary || 'Balanced 7-day study timetable generated.');
        setShowAiModal(false);
      } else {
        setAiGenError(res.error || 'Could not generate schedule. Please try again.');
      }
    } catch (err) {
      console.error('Error generating AI schedule', err);
      setAiGenError('Network issue contacting AI schedule generator. Please try again.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const dayBlocks = schedule
    .filter((b) => b.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const totalWeeklyBlocks = schedule.length;
  const completedWeeklyBlocks = schedule.filter((b) => b.completed).length;
  const completionRate =
    totalWeeklyBlocks > 0 ? Math.round((completedWeeklyBlocks / totalWeeklyBlocks) * 100) : 0;

  const getDayHours = (dayId: number) => {
    return schedule
      .filter((b) => b.dayOfWeek === dayId)
      .reduce((acc, b) => {
        const [sh, sm] = b.startTime.split(':').map(Number);
        const [eh, em] = b.endTime.split(':').map(Number);
        const diffHours = (eh * 60 + em - (sh * 60 + sm)) / 60;
        return acc + (Number.isFinite(diffHours) && diffHours > 0 ? diffHours : 0);
      }, 0);
  };

  const maxDayHours = Math.max(...DAYS_OF_WEEK.map((d) => getDayHours(d.id)), 6);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[640px]">
      {/* ================= LEFT PAGE (Page 5: Day Index & Weekly Distribution) ================= */}
      <article
        className={`${
          mobilePage === 'left' ? 'block' : 'hidden lg:block'
        } relative p-6 sm:p-8 lg:p-10 lg:border-r lg:border-[#DFD5C3] book-spine-shadow-left flex flex-col justify-between gap-6`}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E5DCCB]">
            <div>
              <div className="text-xs font-medium text-[#8C6B32]">
                Chapter III · Page 5 · 7-Day Study Index
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight text-balance">
                Weekly Timetable
              </h2>
            </div>

            <button
              id="ai-generate-week-schedule-button"
              type="button"
              onClick={() => setShowAiModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F291E] hover:bg-[#173D2D] text-[#FAF6EE] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E6CFA3]" />
              <span>AI Auto-Build Week</span>
            </button>
          </div>

          {aiStrategySummary && (
            <div className="p-3 rounded-lg bg-[#F3ECE0] border border-[#D8CEBC] text-xs text-[#37423B]">
              <strong className="text-[#14532D]">Strategy Note:</strong> {aiStrategySummary}
            </div>
          )}

          {/* Day Selection List */}
          <div className="divide-y divide-[#E5DCCB] border-y border-[#E5DCCB]">
            {DAYS_OF_WEEK.map((d) => {
              const count = schedule.filter((b) => b.dayOfWeek === d.id).length;
              const hours = getDayHours(d.id);
              const isCurrent = selectedDay === d.id;

              return (
                <button
                  key={d.id}
                  id={`day-tab-${d.id}`}
                  type="button"
                  onClick={() => setSelectedDay(d.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                    isCurrent
                      ? 'bg-[#F2ECE0] text-[#1C2420]'
                      : 'text-[#4A554E] hover:bg-[#F6F1E6] hover:text-[#1C2420]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-serif text-sm ${
                        isCurrent ? 'font-semibold text-[#14532D]' : 'font-medium'
                      }`}
                    >
                      {d.name}
                    </span>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-[#5A655E]">
                    <span>{hours.toFixed(1)}h</span>
                    <span className="mx-2 text-[#B08D57]" aria-hidden="true">
                      ·
                    </span>
                    <span className={count > 0 ? 'text-[#14532D] font-semibold' : ''}>
                      {count} {count === 1 ? 'block' : 'blocks'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Weekly Distribution Bars */}
        <section className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-serif font-semibold text-[#1C2420]">Weekly Load Balance</span>
            <span className="font-mono font-semibold text-[#14532D] tabular-nums">
              {completionRate}% completed
            </span>
          </div>

          <div className="h-24 flex items-end justify-between gap-2 pt-2">
            {DAYS_OF_WEEK.map((d) => {
              const hours = getDayHours(d.id);
              const heightPercent = Math.max(10, Math.min(100, (hours / maxDayHours) * 100));
              const isSelected = selectedDay === d.id;

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDay(d.id)}
                  className="flex-1 flex flex-col items-center gap-1 group"
                >
                  <span className="font-mono text-[10px] text-[#5A655E] tabular-nums">
                    {hours > 0 ? `${hours.toFixed(0)}h` : '–'}
                  </span>
                  <div className="w-full bg-[#E3DAC9] rounded-t h-14 flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${
                        isSelected
                          ? 'bg-[#14532D]'
                          : 'bg-[#B08D57]/65 group-hover:bg-[#8C6B32]'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span
                    className={`font-mono text-[10px] font-semibold ${
                      isSelected ? 'text-[#14532D]' : 'text-[#5A655E]'
                    }`}
                  >
                    {d.short}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </article>

      {/* ================= RIGHT PAGE (Page 6: Selected Day Schedule) ================= */}
      <article
        className={`${
          mobilePage === 'right' ? 'block' : 'hidden lg:block'
        } relative p-6 sm:p-8 lg:p-10 book-spine-shadow-right flex flex-col justify-between gap-6`}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E5DCCB]">
            <div>
              <div className="text-xs font-medium text-[#8C6B32]">
                Chapter III · Page 6 · Time Blocks
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#1C2420] mt-1 tracking-tight">
                {DAYS_OF_WEEK.find((d) => d.id === selectedDay)?.name} Schedule
              </h2>
            </div>

            <button
              id="add-schedule-slot-button"
              type="button"
              onClick={() => {
                setNewDay(selectedDay);
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Time Slot</span>
            </button>
          </div>

          {dayBlocks.length === 0 ? (
            <div className="text-center py-14 px-4 space-y-3 bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl">
              <Calendar className="w-8 h-8 text-[#8C6B32] mx-auto" />
              <h3 className="font-serif text-base font-semibold text-[#1C2420]">
                No Study Blocks Scheduled
              </h3>
              <p className="text-xs text-[#4A554E] max-w-xs mx-auto leading-relaxed">
                Add a dedicated time slot for this day or use AI Auto-Build Week to plan the full week.
              </p>
              <button
                type="button"
                onClick={() => {
                  setNewDay(selectedDay);
                  setShowAddModal(true);
                }}
                className="px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-xs transition-colors"
              >
                Create First Slot
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {dayBlocks.map((block) => (
                <div
                  key={block.id}
                  className={`p-4 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                    block.completed
                      ? 'bg-[#F6F1E6] border-[#E5DCCB] opacity-65'
                      : 'bg-[#F3ECE0] border-[#D8CEBC] hover:border-[#B08D57]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleBlockComplete(block.id)}
                      className="mt-0.5 text-[#5A655E] hover:text-[#14532D] transition-colors"
                      title={block.completed ? 'Mark incomplete' : 'Mark completed'}
                    >
                      {block.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-[#14532D]" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#8C6B32]" />
                      )}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className="font-semibold"
                          style={{ color: block.color || '#14532D' }}
                        >
                          {block.subject}
                        </span>
                        <span className="text-[#8C6B32]" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-[#4A554E] tabular-nums">
                          {block.startTime} – {block.endTime}
                        </span>
                      </div>

                      <h4
                        className={`text-sm font-semibold mt-1 text-[#1C2420] ${
                          block.completed ? 'line-through text-[#6B756F]' : ''
                        }`}
                      >
                        {block.topic}
                      </h4>

                      {block.notes && (
                        <p className="text-xs text-[#4A554E] mt-1 italic">{block.notes}</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteBlock(block.id, e)}
                    className="text-[#7A847D] hover:text-[#991B1B] p-1 rounded transition-colors"
                    title="Delete study slot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-[#5A655E] pt-3 border-t border-[#E5DCCB]">
          Check off each time block as you finish it to update your weekly completion rate.
        </p>
      </article>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#07140E]/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF6EE] border border-[#B08D57] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-serif text-lg font-semibold text-[#1C2420]">Add Study Time Block</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#1C2420] font-semibold mb-1">Day of Week</label>
                <select
                  value={newDay}
                  onChange={(e) => setNewDay(Number(e.target.value))}
                  className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#1C2420] font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#1C2420] font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1C2420] font-semibold mb-1">Subject</label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                >
                  {Object.keys(SUBJECT_COLORS).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#1C2420] font-semibold mb-1">
                  Topic / Practice Goal
                </label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => {
                    setNewTopic(e.target.value);
                    if (addModalError) setAddModalError('');
                  }}
                  placeholder="e.g. Chapter 4 Solved Examples"
                  className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                />
              </div>

              {addModalError && (
                <p className="text-xs text-[#991B1B] font-semibold">{addModalError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DCCB]">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setAddModalError('');
                }}
                className="px-4 py-2 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#4A554E] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBlock}
                className="px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold"
              >
                Save Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Schedule Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-[#07140E]/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF6EE] border border-[#B08D57] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#14532D]">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-serif text-lg font-semibold text-[#1C2420]">
                AI Weekly Timetable Builder
              </h3>
            </div>
            <p className="text-xs text-[#4A554E] leading-relaxed">
              Distribute your target study hours across all seven days while giving extra weight to weak subjects.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#1C2420] font-semibold mb-1">
                  Target Weekly Study Hours
                </label>
                <input
                  type="number"
                  min="10"
                  max="70"
                  value={targetWeeklyHours}
                  onChange={(e) => setTargetWeeklyHours(Number(e.target.value))}
                  className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-[#1C2420] font-semibold mb-1">
                  Priority / Weak Subjects (comma separated)
                </label>
                <input
                  type="text"
                  value={weakSubjects}
                  onChange={(e) => setWeakSubjects(e.target.value)}
                  className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                />
              </div>

              <div>
                <label className="block text-[#1C2420] font-semibold mb-1">
                  Days Until Exam / Milestone
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={examDays}
                  onChange={(e) => setExamDays(Number(e.target.value))}
                  className="w-full bg-[#F2ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono"
                />
              </div>

              {aiGenError && (
                <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg text-xs text-[#991B1B] font-medium">
                  {aiGenError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5DCCB]">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                disabled={isAiGenerating}
                className="px-4 py-2 rounded-lg bg-[#F2ECE0] text-[#4A554E] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateAiSchedule}
                disabled={isAiGenerating}
                className="px-5 py-2.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
                <span>{isAiGenerating ? 'Generating...' : 'Generate 7-Day Plan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
