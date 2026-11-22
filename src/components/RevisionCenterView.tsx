import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquareText,
  Plus,
  RotateCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  MistakeRecord,
  MistakeType,
  RevisionItem,
  SyllabusTopic,
  SyllabusUnit,
} from '../types';
import { computeAdaptiveRevisionInterval } from '../services/academicEngines';
import { getLocalDateString } from '../utils/date';

interface RevisionCenterViewProps {
  revisions: RevisionItem[];
  mistakes: MistakeRecord[];
  syllabusUnits: SyllabusUnit[];
  daysUntilExam: number | null;
  sourceContextDigest?: string;
  onUpdateRevisions: (revisions: RevisionItem[]) => void;
  onAddRevisionFromTopic: (topic: SyllabusTopic) => void;
  onAddMistakes: (newMistakes: MistakeRecord[]) => void;
  onToggleMistakeCorrected: (mistakeId: string) => void;
  onDeleteMistake: (mistakeId: string) => void;
  onAskAssistant: (prompt: string, subject?: string, topic?: string) => void;
}

const MISTAKE_TYPE_LABELS: Record<MistakeType, string> = {
  conceptual_gap: 'Conceptual Gap',
  formula_error: 'Formula Error',
  calculation_slip: 'Calculation Slip',
  misread_question: 'Misread Question',
  incomplete_steps: 'Incomplete Steps',
  memory_lapse: 'Memory Lapse',
};

export const RevisionCenterView: React.FC<RevisionCenterViewProps> = ({
  revisions,
  mistakes,
  syllabusUnits,
  daysUntilExam,
  sourceContextDigest,
  onUpdateRevisions,
  onAddRevisionFromTopic,
  onAddMistakes,
  onToggleMistakeCorrected,
  onDeleteMistake,
  onAskAssistant,
}) => {
  const [subTab, setSubTab] = useState<'queue' | 'practice' | 'mistakes'>('queue');
  const [activeRevisionId, setActiveRevisionId] = useState<string>(revisions[0]?.id || '');
  const [generatingKit, setGeneratingKit] = useState(false);
  const [kitError, setKitError] = useState('');

  // Flashcard State
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // Quick Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResultNote, setQuizResultNote] = useState('');

  // Mistake Bank Filters & Manual Add
  const [mistakeFilterSubject, setMistakeFilterSubject] = useState('ALL');
  const [mistakeFilterStatus, setMistakeFilterStatus] = useState<'all' | 'open' | 'corrected'>('open');
  const [showAddMistake, setShowAddMistake] = useState(false);
  const [mSubject, setMSubject] = useState('');
  const [mTopic, setMTopic] = useState('');
  const [mQuestion, setMQuestion] = useState('');
  const [mStudentAns, setMStudentAns] = useState('');
  const [mCorrectAns, setMCorrectAns] = useState('');
  const [mType, setMType] = useState<MistakeType>('conceptual_gap');
  const [mDiff, setMDiff] = useState<'easy' | 'medium' | 'hard'>('medium');

  const today = getLocalDateString(0);
  const overdueRevisions = revisions.filter((r) => r.nextReviewDate < today);
  const dueTodayRevisions = revisions.filter((r) => r.nextReviewDate === today);
  const upcomingRevisions = revisions
    .filter((r) => r.nextReviewDate > today)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
  const weakRevisions = revisions.filter(
    (r) =>
      r.confidence <= 2 ||
      r.mistakeCount >= 2 ||
      (r.lastQuizScorePercent !== undefined && r.lastQuizScorePercent < 65)
  );

  const activeRevision =
    revisions.find((r) => r.id === activeRevisionId) || revisions[0] || null;

  const allSyllabusTopics = syllabusUnits.flatMap((u) => u.topics);
  const unqueuedTopics = allSyllabusTopics.filter(
    (t) => !revisions.some((r) => r.syllabusTopicId === t.id)
  );

  const handleQuickMarkRevised = (rev: RevisionItem, confidence: 1 | 2 | 3 | 4 | 5) => {
    const next = computeAdaptiveRevisionInterval({
      repetitionStage: rev.repetitionStage,
      difficulty: rev.difficulty,
      confidence,
      quizScorePercent: rev.lastQuizScorePercent,
      mistakeCount: rev.mistakeCount,
      daysUntilExam,
    });

    onUpdateRevisions(
      revisions.map((item) =>
        item.id === rev.id
          ? {
              ...item,
              confidence,
              repetitionStage: next.nextStage,
              intervalDays: next.intervalDays,
              nextReviewDate: next.nextReviewDate,
              lastReviewedAt: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const handleGenerateRevisionKit = async (rev: RevisionItem) => {
    setGeneratingKit(true);
    setKitError('');
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizResultNote('');
    setCardIndex(0);
    setCardFlipped(false);

    try {
      const matchedTopic = allSyllabusTopics.find((t) => t.id === rev.syllabusTopicId);
      const res = await fetch('/api/academic/generate-revision-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: rev.subject,
          unitName: rev.unitName,
          topicTitle: rev.topicTitle,
          difficulty: rev.difficulty,
          subtopics: matchedTopic?.subtopics.map((s) => s.title) || [],
          sourceContextDigest,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to generate revision kit.');
      }

      const kit = payload.data;
      onUpdateRevisions(
        revisions.map((item) =>
          item.id === rev.id
            ? {
                ...item,
                keyFormulas: kit.keyFormulas?.length ? kit.keyFormulas : item.keyFormulas,
                keyDefinitions: kit.keyDefinitions?.length
                  ? kit.keyDefinitions
                  : item.keyDefinitions,
                flashcards: kit.flashcards || [],
                quizQuestions: kit.quizQuestions || [],
              }
            : item
        )
      );
    } catch (err: any) {
      setKitError(err?.message || 'Failed to build active recall kit.');
    } finally {
      setGeneratingKit(false);
    }
  };

  const handleSubmitQuiz = () => {
    if (!activeRevision || activeRevision.quizQuestions.length === 0) return;
    let correct = 0;
    const newlyRecordedMistakes: MistakeRecord[] = [];

    activeRevision.quizQuestions.forEach((q) => {
      const picked = quizAnswers[q.id];
      if (picked === q.correctIndex) {
        correct += 1;
      } else {
        newlyRecordedMistakes.push({
          id: `mk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          subject: activeRevision.subject,
          topic: activeRevision.topicTitle,
          syllabusTopicId: activeRevision.syllabusTopicId,
          questionText: q.question,
          studentAnswer:
            picked !== undefined ? q.options[picked] || 'Unanswered' : 'Not answered',
          correctAnswer: q.options[q.correctIndex] || '',
          explanation: q.explanation,
          mistakeType: q.mistakeTypeHint || 'conceptual_gap',
          difficulty: q.difficulty || activeRevision.difficulty,
          dateRecorded: today,
          corrected: false,
          retryCount: 0,
        });
      }
    });

    const scorePercent = Math.round((correct / activeRevision.quizQuestions.length) * 100);
    const updatedMistakeCount = activeRevision.mistakeCount + newlyRecordedMistakes.length;
    const derivedConfidence: 1 | 2 | 3 | 4 | 5 =
      scorePercent >= 90
        ? 5
        : scorePercent >= 75
        ? 4
        : scorePercent >= 50
        ? 3
        : 2;

    const next = computeAdaptiveRevisionInterval({
      repetitionStage: activeRevision.repetitionStage,
      difficulty: activeRevision.difficulty,
      confidence: derivedConfidence,
      quizScorePercent: scorePercent,
      mistakeCount: updatedMistakeCount,
      daysUntilExam,
    });

    onUpdateRevisions(
      revisions.map((item) =>
        item.id === activeRevision.id
          ? {
              ...item,
              confidence: derivedConfidence,
              lastQuizScorePercent: scorePercent,
              mistakeCount: updatedMistakeCount,
              repetitionStage: next.nextStage,
              intervalDays: next.intervalDays,
              nextReviewDate: next.nextReviewDate,
              lastReviewedAt: new Date().toISOString(),
            }
          : item
      )
    );

    if (newlyRecordedMistakes.length > 0) {
      onAddMistakes(newlyRecordedMistakes);
    }

    setQuizSubmitted(true);
    setQuizResultNote(
      `Scored ${correct}/${activeRevision.quizQuestions.length} (${scorePercent}%). Next spaced-repetition review scheduled for ${next.nextReviewDate} (+${next.intervalDays}d).${
        newlyRecordedMistakes.length > 0
          ? ` ${newlyRecordedMistakes.length} missed question(s) automatically added to your Mistake Bank.`
          : ' Zero mistakes!'
      }`
    );
  };

  const handleManualAddMistake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mSubject.trim() || !mTopic.trim() || !mQuestion.trim()) return;
    onAddMistakes([
      {
        id: `mk-${Date.now()}`,
        subject: mSubject.trim(),
        topic: mTopic.trim(),
        questionText: mQuestion.trim(),
        studentAnswer: mStudentAns.trim() || 'Missed during practice',
        correctAnswer: mCorrectAns.trim() || 'See notes',
        explanation: 'Manually recorded for targeted exam revision.',
        mistakeType: mType,
        difficulty: mDiff,
        dateRecorded: today,
        corrected: false,
        retryCount: 0,
      },
    ]);
    setMQuestion('');
    setMStudentAns('');
    setMCorrectAns('');
    setShowAddMistake(false);
  };

  const mistakeSubjects = Array.from(new Set(mistakes.map((m) => m.subject))).sort();
  const filteredMistakes = mistakes.filter((m) => {
    if (mistakeFilterSubject !== 'ALL' && m.subject !== mistakeFilterSubject) return false;
    if (mistakeFilterStatus === 'open' && m.corrected) return false;
    if (mistakeFilterStatus === 'corrected' && !m.corrected) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Sub-tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E5DCCB]">
        <div>
          <div className="text-xs font-medium text-[#8C6B32]">
            Adaptive Spaced Repetition · Active Recall Flashcards &amp; Quizzes · Mistake Bank
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight">
            Revision Center
          </h1>
        </div>

        <div className="inline-flex bg-[#F2ECE0] p-1 rounded-lg border border-[#DDD3C1] text-xs self-start">
          {(
            [
              { id: 'queue', label: `Queue (${overdueRevisions.length + dueTodayRevisions.length} due)` },
              { id: 'practice', label: 'Flashcards & Quiz' },
              {
                id: 'mistakes',
                label: `Mistake Bank (${mistakes.filter((m) => !m.corrected).length})`,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              id={`revision-tab-${t.id}`}
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

      {/* ==================== TAB 1: REVISION QUEUE & FORMULA VAULT ==================== */}
      {subTab === 'queue' && (
        <div className="space-y-5">
          {/* Quick Queue Enrollment from Syllabus */}
          {unqueuedTopics.length > 0 && (
            <div className="p-4 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-[#4A554E]">
                Add any syllabus topic into your adaptive spaced-repetition calendar:
              </span>
              <select
                defaultValue=""
                onChange={(e) => {
                  const found = unqueuedTopics.find((t) => t.id === e.target.value);
                  if (found) {
                    onAddRevisionFromTopic(found);
                    e.target.value = '';
                  }
                }}
                className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5 text-xs text-[#1C2420]"
              >
                <option value="">+ Enroll syllabus topic into Revision Center...</option>
                {unqueuedTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.subject}] {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {revisions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#F3ECE0] border border-[#DDD3C1] text-center space-y-2">
              <Brain className="w-8 h-8 text-[#8C6B32] mx-auto" />
              <h3 className="font-serif text-lg font-semibold text-[#1C2420]">
                No Topics in Spaced Repetition Yet
              </h3>
              <p className="text-xs text-[#4A554E] max-w-md mx-auto">
                Topics are automatically scheduled here when you complete Understanding + Practice in <strong>My Syllabus</strong>, or you can enroll any syllabus topic above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Due Today & Overdue Queue */}
              <div className="lg:col-span-7 space-y-4">
                {[
                  {
                    title: 'Overdue Revisions',
                    items: overdueRevisions,
                    accent: 'text-[#991B1B]',
                  },
                  {
                    title: 'Due Today',
                    items: dueTodayRevisions,
                    accent: 'text-[#8C6B32]',
                  },
                  {
                    title: 'Upcoming Spaced Schedule',
                    items: upcomingRevisions,
                    accent: 'text-[#14532D]',
                  },
                ].map((group) => (
                  <section
                    key={group.title}
                    className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-[#F3ECE0] border-b border-[#E5DCCB] flex items-center justify-between">
                      <h2 className={`font-serif text-sm font-semibold ${group.accent}`}>
                        {group.title}
                      </h2>
                      <span className="font-mono text-xs text-[#5A655E] tabular-nums">
                        {group.items.length}
                      </span>
                    </div>
                    {group.items.length === 0 ? (
                      <div className="p-4 text-xs text-[#6B756F]">None right now.</div>
                    ) : (
                      <div className="divide-y divide-[#EAE2D3]">
                        {group.items.map((rev) => (
                          <div key={rev.id} className="p-4 space-y-2.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="text-[11px] font-mono text-[#5A655E]">
                                  <strong className="text-[#14532D]">{rev.subject}</strong> · Next:{' '}
                                  <span className="tabular-nums">{rev.nextReviewDate}</span> (+
                                  {rev.intervalDays}d) · Confidence {rev.confidence}/5
                                  {rev.lastQuizScorePercent !== undefined && (
                                    <span> · Last Quiz {rev.lastQuizScorePercent}%</span>
                                  )}
                                </div>
                                <div className="text-sm font-semibold text-[#1C2420] mt-0.5">
                                  {rev.topicTitle}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRevisionId(rev.id);
                                  setSubTab('practice');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F291E] hover:bg-[#173D2D] text-[#FAF6EE] text-[11px] font-semibold"
                              >
                                <Sparkles className="w-3 h-3 text-[#E6CFA3]" />
                                <span>Flashcards &amp; Quiz</span>
                              </button>
                            </div>

                            {/* Quick Confidence Self-Rating for Fast Spaced-Repetition Update */}
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5A655E]">
                              <span>Quick recall log:</span>
                              {(
                                [
                                  { conf: 2 as const, label: 'Shaky (Shorten)' },
                                  { conf: 4 as const, label: 'Solid (+Interval)' },
                                  { conf: 5 as const, label: 'Mastered (Extend)' },
                                ]
                              ).map((btn) => (
                                <button
                                  key={btn.conf}
                                  type="button"
                                  onClick={() => handleQuickMarkRevised(rev, btn.conf)}
                                  className="px-2.5 py-1 rounded bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-[#1C2420] font-medium"
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* Right Column: Weak Topics + Formula & Definitions Vault */}
              <div className="lg:col-span-5 space-y-4">
                <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-xl p-4 space-y-3">
                  <h3 className="font-serif text-sm font-semibold text-[#991B1B] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>Weak &amp; Forgotten Topics ({weakRevisions.length})</span>
                  </h3>
                  {weakRevisions.length === 0 ? (
                    <p className="text-xs text-[#5A655E]">
                      No weak topics flagged from confidence or quiz scores.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {weakRevisions.map((w) => (
                        <div
                          key={w.id}
                          className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-[#1C2420]">{w.topicTitle}</div>
                            <div className="text-[11px] text-[#991B1B]">
                              Conf {w.confidence}/5 · {w.mistakeCount} mistakes
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRevisionId(w.id);
                              setSubTab('practice');
                            }}
                            className="font-semibold text-[#14532D] underline shrink-0"
                          >
                            Drill
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-xl p-4 space-y-3">
                  <h3 className="font-serif text-sm font-semibold text-[#1C2420] flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#14532D]" />
                    <span>Formulas &amp; Definitions Vault</span>
                  </h3>
                  {revisions.every(
                    (r) => r.keyFormulas.length === 0 && r.keyDefinitions.length === 0
                  ) ? (
                    <p className="text-xs text-[#5A655E]">
                      Generate a Flashcard &amp; Quiz Revision Kit for any topic to populate formulas and exam definitions here.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 book-scroll">
                      {revisions
                        .filter(
                          (r) => r.keyFormulas.length > 0 || r.keyDefinitions.length > 0
                        )
                        .map((r) => (
                          <div
                            key={r.id}
                            className="p-3 rounded-lg bg-[#F3ECE0] border border-[#E5DCCB] text-xs space-y-1.5"
                          >
                            <div className="font-semibold text-[#14532D]">{r.topicTitle}</div>
                            {r.keyFormulas.length > 0 && (
                              <ul className="space-y-1 font-mono text-[11px] text-[#1C2420]">
                                {r.keyFormulas.map((f, i) => (
                                  <li key={i}>• {f}</li>
                                ))}
                              </ul>
                            )}
                            {r.keyDefinitions.length > 0 && (
                              <ul className="space-y-1 text-[11px] text-[#4A554E] pt-1 border-t border-[#E0D6C4]">
                                {r.keyDefinitions.map((d, i) => (
                                  <li key={i}>— {d}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: FLASHCARDS & QUICK RECALL QUIZ ==================== */}
      {subTab === 'practice' && (
        <div className="space-y-5">
          {revisions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#F3ECE0] border border-[#DDD3C1] text-center text-xs text-[#5A655E]">
              Enroll at least one topic in the Revision Queue tab first to practice flashcards and quizzes.
            </div>
          ) : (
            <>
              <div className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs">
                  <label className="font-semibold text-[#1C2420]">Topic:</label>
                  <select
                    value={activeRevision?.id || ''}
                    onChange={(e) => {
                      setActiveRevisionId(e.target.value);
                      setCardIndex(0);
                      setCardFlipped(false);
                      setQuizAnswers({});
                      setQuizSubmitted(false);
                      setQuizResultNote('');
                    }}
                    className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5 text-xs text-[#1C2420]"
                  >
                    {revisions.map((r) => (
                      <option key={r.id} value={r.id}>
                        [{r.subject}] {r.topicTitle}
                      </option>
                    ))}
                  </select>
                </div>

                {activeRevision && (
                  <button
                    id="generate-revision-kit-btn"
                    type="button"
                    disabled={generatingKit}
                    onClick={() => handleGenerateRevisionKit(activeRevision)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold disabled:opacity-60"
                  >
                    {generatingKit ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Building Flashcards &amp; Quiz...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#E6CFA3]" />
                        <span>
                          {activeRevision.flashcards.length > 0
                            ? 'Regenerate Revision Kit'
                            : 'Generate AI Flashcards & Quiz'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {kitError && (
                <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                  {kitError}
                </div>
              )}

              {activeRevision && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Flashcards */}
                  <section className="lg:col-span-5 bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between text-xs">
                      <h3 className="font-serif text-base font-semibold text-[#1C2420]">
                        Active Recall Flashcards
                      </h3>
                      {activeRevision.flashcards.length > 0 && (
                        <span className="font-mono text-[#5A655E] tabular-nums">
                          {cardIndex + 1} / {activeRevision.flashcards.length}
                        </span>
                      )}
                    </div>

                    {activeRevision.flashcards.length === 0 ? (
                      <div className="p-8 rounded-xl bg-[#F3ECE0] text-center text-xs text-[#5A655E]">
                        Click <strong>Generate AI Flashcards &amp; Quiz</strong> above to create tailored flashcards and exam recall questions for{' '}
                        <strong>{activeRevision.topicTitle}</strong>.
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setCardFlipped(!cardFlipped)}
                          className={`min-h-[210px] w-full p-6 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                            cardFlipped
                              ? 'bg-[#0F291E] border-[#B08D57] text-[#FAF6EE]'
                              : 'bg-[#F3ECE0] border-[#D4C9B4] text-[#1C2420]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono uppercase">
                            <span className={cardFlipped ? 'text-[#E6CFA3]' : 'text-[#8C6B32]'}>
                              {activeRevision.flashcards[cardIndex]?.kind} ·{' '}
                              {cardFlipped ? 'Answer' : 'Prompt'}
                            </span>
                            <RotateCw className="w-3.5 h-3.5 opacity-70" />
                          </div>
                          <p className="text-sm leading-relaxed my-4">
                            {cardFlipped
                              ? activeRevision.flashcards[cardIndex]?.back
                              : activeRevision.flashcards[cardIndex]?.front}
                          </p>
                          <span className="text-[11px] opacity-70">Click card to flip</span>
                        </button>

                        <div className="flex items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setCardIndex((i) =>
                                i > 0 ? i - 1 : activeRevision.flashcards.length - 1
                              );
                              setCardFlipped(false);
                            }}
                            className="px-3.5 py-2 rounded-lg bg-[#F2ECE0] border border-[#DDD3C1] font-semibold text-[#1C2420]"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCardIndex((i) => (i + 1) % activeRevision.flashcards.length);
                              setCardFlipped(false);
                            }}
                            className="px-3.5 py-2 rounded-lg bg-[#14532D] text-[#FAF6EE] font-semibold"
                          >
                            Next Card
                          </button>
                        </div>
                      </>
                    )}
                  </section>

                  {/* Quick Recall Quiz (Auto-logs mistakes into Mistake Bank) */}
                  <section className="lg:col-span-7 bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-base font-semibold text-[#1C2420]">
                        Quick Recall Quiz (Auto-Logs Mistakes)
                      </h3>
                    </div>

                    {activeRevision.quizQuestions.length === 0 ? (
                      <div className="p-8 rounded-xl bg-[#F3ECE0] text-center text-xs text-[#5A655E]">
                        Generate a Revision Kit to launch a scored 4-question recall check that adapts your revision interval and logs mistakes automatically.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeRevision.quizQuestions.map((q, idx) => {
                          const selected = quizAnswers[q.id];
                          return (
                            <div
                              key={q.id}
                              className="p-4 rounded-xl bg-[#F3ECE0] border border-[#E2D8C6] space-y-2.5 text-xs"
                            >
                              <div className="font-semibold text-[#1C2420]">
                                Q{idx + 1}. {q.question}
                              </div>
                              <div className="space-y-1.5">
                                {q.options.map((opt, oIdx) => {
                                  const isPicked = selected === oIdx;
                                  const isCorrect = oIdx === q.correctIndex;
                                  let styleClass =
                                    'bg-[#FAF6EE] border-[#D4C9B4] text-[#1C2420] hover:border-[#8C6B32]';
                                  if (quizSubmitted) {
                                    if (isCorrect)
                                      styleClass =
                                        'bg-[#E8F3EC] border-[#14532D] text-[#14532D] font-semibold';
                                    else if (isPicked && !isCorrect)
                                      styleClass =
                                        'bg-[#FEF2F2] border-[#991B1B] text-[#991B1B]';
                                  } else if (isPicked) {
                                    styleClass =
                                      'bg-[#0F291E] border-[#0F291E] text-[#FAF6EE] font-semibold';
                                  }

                                  return (
                                    <button
                                      key={oIdx}
                                      type="button"
                                      disabled={quizSubmitted}
                                      onClick={() =>
                                        setQuizAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                                      }
                                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${styleClass}`}
                                    >
                                      <span className="font-mono mr-2">
                                        {String.fromCharCode(65 + oIdx)}.
                                      </span>
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                              {quizSubmitted && (
                                <div className="text-[11px] text-[#37423B] pt-1 border-t border-[#DDD3C1]">
                                  <strong>Explanation:</strong> {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {quizResultNote && (
                          <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#14532D] font-medium">
                            {quizResultNote}
                          </div>
                        )}

                        {!quizSubmitted ? (
                          <button
                            id="submit-revision-quiz-btn"
                            type="button"
                            onClick={handleSubmitQuiz}
                            className="w-full py-2.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold"
                          >
                            Submit Quiz &amp; Update Spaced Repetition
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setQuizAnswers({});
                              setQuizSubmitted(false);
                              setQuizResultNote('');
                            }}
                            className="w-full py-2.5 rounded-lg bg-[#F2ECE0] border border-[#DDD3C1] text-[#1C2420] text-xs font-semibold"
                          >
                            Retry Quiz
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ==================== TAB 3: MISTAKE BANK ==================== */}
      {subTab === 'mistakes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl p-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={mistakeFilterSubject}
                onChange={(e) => setMistakeFilterSubject(e.target.value)}
                className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5"
                aria-label="Filter mistakes by subject"
              >
                <option value="ALL">All Subjects</option>
                {mistakeSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={mistakeFilterStatus}
                onChange={(e) => setMistakeFilterStatus(e.target.value as any)}
                className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5"
                aria-label="Filter mistakes by status"
              >
                <option value="open">Unresolved Only</option>
                <option value="all">All Mistakes</option>
                <option value="corrected">Corrected Only</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAddMistake(!showAddMistake)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#14532D] text-[#FAF6EE] font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Mistake</span>
            </button>
          </div>

          {showAddMistake && (
            <form
              onSubmit={handleManualAddMistake}
              className="p-4 rounded-xl bg-[#FAF6EE] border border-[#B08D57] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
            >
              <input
                type="text"
                required
                placeholder="Subject *"
                value={mSubject}
                onChange={(e) => setMSubject(e.target.value)}
                className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
              />
              <input
                type="text"
                required
                placeholder="Topic *"
                value={mTopic}
                onChange={(e) => setMTopic(e.target.value)}
                className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
              />
              <select
                value={mType}
                onChange={(e) => setMType(e.target.value as MistakeType)}
                className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
              >
                {Object.entries(MISTAKE_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={mDiff}
                onChange={(e) => setMDiff(e.target.value as any)}
                className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <input
                type="text"
                required
                placeholder="Question or problem statement *"
                value={mQuestion}
                onChange={(e) => setMQuestion(e.target.value)}
                className="sm:col-span-2 bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
              />
              <input
                type="text"
                placeholder="What went wrong / your answer"
                value={mStudentAns}
                onChange={(e) => setMStudentAns(e.target.value)}
                className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
              />
              <input
                type="text"
                placeholder="Correct answer / key insight"
                value={mCorrectAns}
                onChange={(e) => setMCorrectAns(e.target.value)}
                className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
              />
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMistake(false)}
                  className="px-4 py-2 rounded-lg bg-[#F2ECE0] text-[#4A554E] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#14532D] text-[#FAF6EE] font-semibold"
                >
                  Save to Mistake Bank
                </button>
              </div>
            </form>
          )}

          {filteredMistakes.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#F3ECE0] border border-[#DDD3C1] text-center space-y-2">
              <ClipboardList className="w-7 h-7 text-[#8C6B32] mx-auto" />
              <div className="font-serif text-base font-semibold text-[#1C2420]">
                No Mistakes Match This Filter
              </div>
              <p className="text-xs text-[#5A655E]">
                Wrong quiz answers are captured here automatically, or you can log manual practice errors above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMistakes.map((m) => (
                <div
                  key={m.id}
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    m.corrected
                      ? 'bg-[#F6F1E6] border-[#E5DCCB] opacity-75'
                      : 'bg-[#FAF6EE] border-[#D8CEBC]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#5A655E]">
                      <span className="font-bold text-[#14532D]">{m.subject}</span>
                      <span>·</span>
                      <span className="font-semibold text-[#1C2420]">{m.topic}</span>
                      <span>·</span>
                      <span className="text-[#991B1B] font-semibold">
                        {MISTAKE_TYPE_LABELS[m.mistakeType]}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">{m.dateRecorded}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleMistakeCorrected(m.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold ${
                          m.corrected
                            ? 'bg-[#E8F3EC] text-[#14532D]'
                            : 'bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#1C2420]'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{m.corrected ? 'Corrected' : 'Mark Corrected'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onAskAssistant(
                            `I made a ${MISTAKE_TYPE_LABELS[m.mistakeType]} mistake on "${m.questionText}". My answer was "${m.studentAnswer}" instead of "${m.correctAnswer}". Explain how to avoid this mistake in the exam.`,
                            m.subject,
                            m.topic
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0F291E] text-[#FAF6EE] font-semibold"
                      >
                        <MessageSquareText className="w-3 h-3 text-[#E6CFA3]" />
                        <span>Fix With AI</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMistake(m.id)}
                        className="p-1 text-[#7A847D] hover:text-[#991B1B]"
                        aria-label="Delete mistake"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-[#1C2420]">{m.questionText}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
                      <span className="font-semibold text-[#991B1B] block">Your Answer</span>
                      <span className="text-[#1C2420]">{m.studentAnswer}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0]">
                      <span className="font-semibold text-[#14532D] block">Correct Concept</span>
                      <span className="text-[#1C2420]">{m.correctAnswer}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
