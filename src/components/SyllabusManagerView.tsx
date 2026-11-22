import React, { useState } from 'react';
import {
  BookMarked,
  Brain,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MessageSquareText,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { Priority, SyllabusTopic, SyllabusUnit, TopicMilestones } from '../types';
import { getMilestoneProgress, isTopicMastered } from '../services/academicEngines';

interface SyllabusManagerViewProps {
  syllabusUnits: SyllabusUnit[];
  defaultSubject: string;
  onUpdateSyllabusUnits: (units: SyllabusUnit[]) => void;
  onGenerateDailyPlan: () => void;
  onScheduleRevisionForTopic: (topic: SyllabusTopic) => void;
  onStartFocusOnTopic: (topic: SyllabusTopic) => void;
  onAskAssistantAboutTopic: (topic: SyllabusTopic) => void;
}

const MILESTONE_KEYS: Array<{ key: keyof TopicMilestones; label: string }> = [
  { key: 'understanding', label: 'Understood' },
  { key: 'notes', label: 'Notes' },
  { key: 'practice', label: 'Practiced' },
  { key: 'revision', label: 'Revised' },
];

export const SyllabusManagerView: React.FC<SyllabusManagerViewProps> = ({
  syllabusUnits,
  defaultSubject,
  onUpdateSyllabusUnits,
  onGenerateDailyPlan,
  onScheduleRevisionForTopic,
  onStartFocusOnTopic,
  onAskAssistantAboutTopic,
}) => {
  const [expandedUnitIds, setExpandedUnitIds] = useState<Record<string, boolean>>({});
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');

  // Add Unit Form
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnitSubject, setNewUnitSubject] = useState(defaultSubject || '');
  const [newUnitTitle, setNewUnitTitle] = useState('');

  // Add Topic Inline Form
  const [addingTopicUnitId, setAddingTopicUnitId] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicSubtopics, setNewTopicSubtopics] = useState('');
  const [newTopicMinutes, setNewTopicMinutes] = useState(45);
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [newTopicPriority, setNewTopicPriority] = useState<Priority>('high');
  const [newTopicPrereqs, setNewTopicPrereqs] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  const subjects = Array.from(new Set(syllabusUnits.map((u) => u.subject))).sort();
  const visibleUnits =
    subjectFilter === 'ALL'
      ? syllabusUnits
      : syllabusUnits.filter((u) => u.subject === subjectFilter);

  const allTopics = visibleUnits.flatMap((u) => u.topics);
  const masteredCount = allTopics.filter((t) => isTopicMastered(t)).length;

  const isExpanded = (unitId: string) => expandedUnitIds[unitId] !== false;

  const toggleUnitExpand = (unitId: string) => {
    setExpandedUnitIds((prev) => ({
      ...prev,
      [unitId]: prev[unitId] === false ? true : false,
    }));
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitTitle.trim() || !newUnitSubject.trim()) return;
    const sameSubjUnits = syllabusUnits.filter(
      (u) => u.subject.toLowerCase() === newUnitSubject.trim().toLowerCase()
    );
    const created: SyllabusUnit = {
      id: `unit-${Date.now()}`,
      subject: newUnitSubject.trim(),
      unitNumber: sameSubjUnits.length + 1,
      title: newUnitTitle.trim(),
      topics: [],
    };
    onUpdateSyllabusUnits([...syllabusUnits, created]);
    setNewUnitTitle('');
    setShowAddUnit(false);
    setAddingTopicUnitId(created.id);
  };

  const handleDeleteUnit = (unitId: string) => {
    onUpdateSyllabusUnits(syllabusUnits.filter((u) => u.id !== unitId));
  };

  const handleAddTopic = (unit: SyllabusUnit) => {
    if (!newTopicTitle.trim()) return;
    const topic: SyllabusTopic = {
      id: `top-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      unitId: unit.id,
      unitName: `Unit ${unit.unitNumber}: ${unit.title}`,
      subject: unit.subject,
      title: newTopicTitle.trim(),
      subtopics: newTopicSubtopics
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((title, idx) => ({
          id: `st-${Date.now()}-${idx}`,
          title,
          completed: false,
        })),
      estimatedMinutes: Math.max(15, Number(newTopicMinutes) || 45),
      difficulty: newTopicDifficulty,
      priority: newTopicPriority,
      prerequisites: newTopicPrereqs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      milestones: {
        understanding: false,
        notes: false,
        practice: false,
        revision: false,
      },
      confidence: 2,
      sourceBasis: 'manual',
    };

    onUpdateSyllabusUnits(
      syllabusUnits.map((u) => (u.id === unit.id ? { ...u, topics: [...u.topics, topic] } : u))
    );
    setNewTopicTitle('');
    setNewTopicSubtopics('');
    setNewTopicPrereqs('');
    setAddingTopicUnitId(null);
  };

  const handleToggleMilestone = (
    unitId: string,
    topic: SyllabusTopic,
    key: keyof TopicMilestones
  ) => {
    const updatedMilestones: TopicMilestones = {
      ...topic.milestones,
      [key]: !topic.milestones[key],
    };
    const updatedTopic: SyllabusTopic = {
      ...topic,
      milestones: updatedMilestones,
      lastStudiedAt: new Date().toISOString(),
    };

    onUpdateSyllabusUnits(
      syllabusUnits.map((u) =>
        u.id === unitId
          ? { ...u, topics: u.topics.map((t) => (t.id === topic.id ? updatedTopic : t)) }
          : u
      )
    );

    // Automatically queue spaced repetition once Understanding + Practice are achieved
    if (
      updatedMilestones.understanding &&
      updatedMilestones.practice &&
      (!topic.milestones.understanding || !topic.milestones.practice)
    ) {
      onScheduleRevisionForTopic(updatedTopic);
      setStatusNotice(`"${topic.title}" added to your Revision Center spaced-repetition queue.`);
    }
  };

  const handleToggleSubtopic = (unitId: string, topicId: string, subtopicId: string) => {
    onUpdateSyllabusUnits(
      syllabusUnits.map((u) =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map((t) =>
                t.id === topicId
                  ? {
                      ...t,
                      subtopics: t.subtopics.map((st) =>
                        st.id === subtopicId ? { ...st, completed: !st.completed } : st
                      ),
                    }
                  : t
              ),
            }
          : u
      )
    );
  };

  const handleConfidenceChange = (unitId: string, topicId: string, conf: 1 | 2 | 3 | 4 | 5) => {
    onUpdateSyllabusUnits(
      syllabusUnits.map((u) =>
        u.id === unitId
          ? {
              ...u,
              topics: u.topics.map((t) => (t.id === topicId ? { ...t, confidence: conf } : t)),
            }
          : u
      )
    );
  };

  const handleDeleteTopic = (unitId: string, topicId: string) => {
    onUpdateSyllabusUnits(
      syllabusUnits.map((u) =>
        u.id === unitId ? { ...u, topics: u.topics.filter((t) => t.id !== topicId) } : u
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E5DCCB]">
        <div>
          <div className="text-xs font-medium text-[#8C6B32]">
            Subject → Unit → Topic → Subtopic · 4-Milestone Mastery Tracking
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight">
            My Syllabus &amp; Divider
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddUnit(!showAddUnit)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-xs font-semibold text-[#1C2420]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Unit</span>
          </button>

          <button
            id="syllabus-generate-daily-plan-btn"
            type="button"
            onClick={onGenerateDailyPlan}
            disabled={allTopics.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold disabled:opacity-50"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-[#E6CFA3]" />
            <span>Divide into Today’s Plan</span>
          </button>
        </div>
      </div>

      {/* Mastery Summary Strip & Subject Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl p-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span>
            Units: <strong className="font-mono text-[#1C2420]">{visibleUnits.length}</strong>
          </span>
          <span>
            Topics: <strong className="font-mono text-[#1C2420]">{allTopics.length}</strong>
          </span>
          <span>
            Mastered (Understanding + Practice + Notes/Revision):{' '}
            <strong className="font-mono text-[#14532D]">
              {masteredCount}/{allTopics.length}
            </strong>
          </span>
        </div>

        {subjects.length > 1 && (
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5 text-xs text-[#1C2420]"
            aria-label="Filter syllabus by subject"
          >
            <option value="ALL">All Subjects ({subjects.length})</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {statusNotice && (
        <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#14532D] font-medium flex items-center justify-between">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice('')}
            className="underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add Unit Form */}
      {showAddUnit && (
        <form
          onSubmit={handleAddUnit}
          className="p-4 rounded-xl bg-[#FAF6EE] border border-[#B08D57] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end"
        >
          <div>
            <label className="block font-semibold text-[#1C2420] mb-1">Subject *</label>
            <input
              type="text"
              required
              value={newUnitSubject}
              onChange={(e) => setNewUnitSubject(e.target.value)}
              placeholder="e.g. Data Structures"
              className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#1C2420] mb-1">Unit Title *</label>
            <input
              type="text"
              required
              value={newUnitTitle}
              onChange={(e) => setNewUnitTitle(e.target.value)}
              placeholder="e.g. Trees & Graph Algorithms"
              className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2 px-4 rounded-lg bg-[#14532D] text-[#FAF6EE] font-semibold"
            >
              Save Unit
            </button>
            <button
              type="button"
              onClick={() => setShowAddUnit(false)}
              className="py-2 px-3 rounded-lg bg-[#F2ECE0] text-[#4A554E] font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Empty State */}
      {visibleUnits.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3ECE0] border border-[#DDD3C1] text-center space-y-3">
          <BookMarked className="w-8 h-8 text-[#8C6B32] mx-auto" />
          <h3 className="font-serif text-lg font-semibold text-[#1C2420]">
            Your Syllabus Tree Is Empty
          </h3>
          <p className="text-xs text-[#4A554E] max-w-md mx-auto">
            Upload your university syllabus PDF in <strong>Master Strategist</strong> to automatically decompose it into units, topics, and subtopics — or click <strong>Add Unit</strong> above to build it manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleUnits.map((unit) => {
            const expanded = isExpanded(unit.id);
            const unitMastered = unit.topics.filter((t) => isTopicMastered(t)).length;
            return (
              <section
                key={unit.id}
                className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl overflow-hidden"
              >
                {/* Unit Header */}
                <div className="p-4 bg-[#F3ECE0] border-b border-[#E5DCCB] flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleUnitExpand(unit.id)}
                    className="flex items-center gap-2.5 text-left min-w-0"
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-[#14532D] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#5A655E] shrink-0" />
                    )}
                    <div>
                      <div className="text-[11px] font-mono text-[#8C6B32] font-semibold">
                        {unit.subject} · Unit {unit.unitNumber}
                      </div>
                      <h2 className="font-serif text-base font-semibold text-[#1C2420]">
                        {unit.title}
                      </h2>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-[#4A554E] tabular-nums">
                      {unitMastered}/{unit.topics.length} mastered
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAddingTopicUnitId(addingTopicUnitId === unit.id ? null : unit.id)
                      }
                      className="px-2.5 py-1 rounded-md bg-[#FAF6EE] hover:bg-[#E7DEC9] border border-[#D4C9B4] text-[11px] font-semibold text-[#14532D]"
                    >
                      + Topic
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUnit(unit.id)}
                      className="p-1.5 text-[#7A847D] hover:text-[#991B1B]"
                      aria-label={`Delete unit ${unit.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add Topic Inline Drawer */}
                {addingTopicUnitId === unit.id && (
                  <div className="p-4 bg-[#F7F2E7] border-b border-[#E5DCCB] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-[#1C2420] mb-1">
                        Topic Title *
                      </label>
                      <input
                        type="text"
                        value={newTopicTitle}
                        onChange={(e) => setNewTopicTitle(e.target.value)}
                        placeholder="e.g. Binary Tree Traversal"
                        className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1C2420] mb-1">
                        Est. Minutes
                      </label>
                      <input
                        type="number"
                        min={15}
                        max={240}
                        value={newTopicMinutes}
                        onChange={(e) => setNewTopicMinutes(Number(e.target.value))}
                        className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-semibold text-[#1C2420] mb-1">Difficulty</label>
                        <select
                          value={newTopicDifficulty}
                          onChange={(e) => setNewTopicDifficulty(e.target.value as any)}
                          className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-2 py-1.5"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-[#1C2420] mb-1">Priority</label>
                        <select
                          value={newTopicPriority}
                          onChange={(e) => setNewTopicPriority(e.target.value as Priority)}
                          className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-2 py-1.5"
                        >
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-[#1C2420] mb-1">
                        Subtopics (comma separated)
                      </label>
                      <input
                        type="text"
                        value={newTopicSubtopics}
                        onChange={(e) => setNewTopicSubtopics(e.target.value)}
                        placeholder="Inorder, Preorder, Postorder, Level Order"
                        className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1C2420] mb-1">
                        Prerequisites (optional)
                      </label>
                      <input
                        type="text"
                        value={newTopicPrereqs}
                        onChange={(e) => setNewTopicPrereqs(e.target.value)}
                        placeholder="Recursion, Stacks"
                        className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddTopic(unit)}
                        className="flex-1 py-2 px-3 rounded-lg bg-[#14532D] text-[#FAF6EE] font-semibold"
                      >
                        Add Topic
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingTopicUnitId(null)}
                        className="py-2 px-3 rounded-lg bg-[#E5DCCB] text-[#4A554E] font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Topics List */}
                {expanded && (
                  <div className="divide-y divide-[#EAE2D3]">
                    {unit.topics.length === 0 ? (
                      <div className="p-4 text-xs text-[#5A655E]">
                        No topics in this unit yet. Click <strong>+ Topic</strong> to add one.
                      </div>
                    ) : (
                      unit.topics.map((topic) => {
                        const progressPct = Math.round(getMilestoneProgress(topic.milestones) * 100);
                        const mastered = isTopicMastered(topic);

                        return (
                          <div key={topic.id} className="p-4 space-y-3">
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#5A655E]">
                                  <span
                                    className={`font-bold uppercase ${
                                      topic.priority === 'critical'
                                        ? 'text-[#991B1B]'
                                        : topic.priority === 'high'
                                        ? 'text-[#8C6B32]'
                                        : 'text-[#14532D]'
                                    }`}
                                  >
                                    {topic.priority}
                                  </span>
                                  <span>·</span>
                                  <span className="capitalize">{topic.difficulty}</span>
                                  <span>·</span>
                                  <span className="tabular-nums">{topic.estimatedMinutes}m</span>
                                  {topic.observedFrequencyLabel && (
                                    <>
                                      <span>·</span>
                                      <span className="text-[#14532D]">
                                        {topic.observedFrequencyLabel}
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {mastered && (
                                    <CheckCircle2 className="w-4 h-4 text-[#14532D] shrink-0" />
                                  )}
                                  <h3 className="text-sm font-semibold text-[#1C2420]">
                                    {topic.title}
                                  </h3>
                                  <span className="font-mono text-[11px] text-[#5A655E] tabular-nums">
                                    ({progressPct}%)
                                  </span>
                                </div>

                                {topic.prerequisites.length > 0 && (
                                  <div className="text-[11px] text-[#5A655E]">
                                    Prerequisites: {topic.prerequisites.join(', ')}
                                  </div>
                                )}
                              </div>

                              {/* Quick Topic Actions */}
                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onStartFocusOnTopic(topic)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-[11px] font-semibold"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Focus</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onScheduleRevisionForTopic(topic);
                                    setStatusNotice(
                                      `"${topic.title}" scheduled in Revision Center.`
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-[11px] font-semibold text-[#1C2420]"
                                >
                                  <Brain className="w-3 h-3 text-[#8C6B32]" />
                                  <span>Revise</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAskAssistantAboutTopic(topic)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-[11px] font-semibold text-[#1C2420]"
                                >
                                  <MessageSquareText className="w-3 h-3 text-[#14532D]" />
                                  <span>AI Tutor</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTopic(unit.id, topic.id)}
                                  className="p-1.5 text-[#7A847D] hover:text-[#991B1B]"
                                  aria-label={`Delete topic ${topic.title}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* 4-Milestone Checkboxes & Confidence Rating */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {MILESTONE_KEYS.map((mk) => (
                                  <label
                                    key={mk.key}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs cursor-pointer transition-colors ${
                                      topic.milestones[mk.key]
                                        ? 'bg-[#E8F3EC] border-[#14532D]/40 text-[#14532D] font-semibold'
                                        : 'bg-[#F3ECE0] border-[#DDD3C1] text-[#4A554E]'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={topic.milestones[mk.key]}
                                      onChange={() =>
                                        handleToggleMilestone(unit.id, topic, mk.key)
                                      }
                                      className="accent-[#14532D] rounded"
                                    />
                                    <span>{mk.label}</span>
                                  </label>
                                ))}
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] text-[#5A655E]">
                                <span>Confidence:</span>
                                {([1, 2, 3, 4, 5] as const).map((lvl) => (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => handleConfidenceChange(unit.id, topic.id, lvl)}
                                    className={`w-6 h-6 rounded font-mono text-xs font-semibold transition-colors ${
                                      topic.confidence === lvl
                                        ? 'bg-[#0F291E] text-[#FAF6EE]'
                                        : 'bg-[#F2ECE0] text-[#4A554E] hover:bg-[#E7DEC9]'
                                    }`}
                                  >
                                    {lvl}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Subtopics */}
                            {topic.subtopics.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {topic.subtopics.map((st) => (
                                  <label
                                    key={st.id}
                                    className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded border cursor-pointer ${
                                      st.completed
                                        ? 'bg-[#F6F1E6] border-[#DDD3C1] text-[#6B756F] line-through'
                                        : 'bg-[#FFFFFF] border-[#E2D8C6] text-[#37423B]'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={st.completed}
                                      onChange={() =>
                                        handleToggleSubtopic(unit.id, topic.id, st.id)
                                      }
                                      className="accent-[#14532D]"
                                    />
                                    <span>{st.title}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
