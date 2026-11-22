import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react';
import {
  AssistantExplanationStyle,
  MistakeRecord,
  StudyAssistantMessage,
  SyllabusUnit,
} from '../types';

interface StudyAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: StudyAssistantMessage[];
  onAppendMessages: (newMessages: StudyAssistantMessage[]) => void;
  onClearMessages: () => void;
  defaultSubject: string;
  sourceContextDigest?: string;
  syllabusUnits: SyllabusUnit[];
  mistakes: MistakeRecord[];
  initialPromptRequest?: { prompt: string; subject?: string; topic?: string; key: number } | null;
  onPromptHandled?: () => void;
}

const STYLES: Array<{ id: AssistantExplanationStyle; label: string }> = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'simple', label: 'Simple' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'exam_oriented', label: 'Exam-Oriented' },
  { id: 'quick_revision', label: 'Quick Revision' },
];

export const StudyAssistantDrawer: React.FC<StudyAssistantDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onAppendMessages,
  onClearMessages,
  defaultSubject,
  sourceContextDigest,
  syllabusUnits,
  mistakes,
  initialPromptRequest,
  onPromptHandled,
}) => {
  const [question, setQuestion] = useState('');
  const [style, setStyle] = useState<AssistantExplanationStyle>('exam_oriented');
  const [subject, setSubject] = useState(defaultSubject || '');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultSubject && !subject) setSubject(defaultSubject);
  }, [defaultSubject, subject]);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  const sendQuestion = async (qText: string, overrideSubject?: string, overrideTopic?: string) => {
    const trimmed = qText.trim();
    if (!trimmed || loading) return;

    setError('');
    setLoading(true);
    const activeSubj = overrideSubject ?? subject;
    const activeTop = overrideTopic ?? topic;

    const userMsg: StudyAssistantMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      timestamp: new Date().toISOString(),
      style,
      subject: activeSubj || undefined,
      topic: activeTop || undefined,
      text: trimmed,
    };

    try {
      const syllabusTopicsList = syllabusUnits
        .flatMap((u) => u.topics)
        .filter((t) => !activeSubj || t.subject.toLowerCase() === activeSubj.toLowerCase())
        .map((t) => `${t.unitName}: ${t.title}`);

      const recentMistakes = mistakes
        .filter((m) => !m.corrected)
        .slice(0, 5)
        .map((m) => `${m.topic} (${m.mistakeType}): ${m.questionText}`);

      const res = await fetch('/api/academic/study-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          style,
          subject: activeSubj,
          topic: activeTop,
          sourceContextDigest,
          syllabusTopicsList,
          recentMistakes,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Could not reach AI Study Assistant.');
      }

      const d = payload.data;
      const assistantMsg: StudyAssistantMessage = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        style,
        subject: activeSubj || undefined,
        topic: activeTop || undefined,
        text: d.generalExplanationSection || '',
        sourceGroundedSection: d.sourceGroundedSection,
        generalExplanationSection: d.generalExplanationSection,
        stepByStepFormulas: d.stepByStepFormulas || [],
        workedExample: d.workedExample,
        practiceQuestions: d.practiceQuestions || [],
        sourceCitationNote: d.sourceCitationNote,
      };

      onAppendMessages([userMsg, assistantMsg]);
      setQuestion('');
    } catch (err: any) {
      setError(err?.message || 'Failed to get an answer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !initialPromptRequest) return;
    if (initialPromptRequest.subject) setSubject(initialPromptRequest.subject);
    if (initialPromptRequest.topic) setTopic(initialPromptRequest.topic);
    sendQuestion(
      initialPromptRequest.prompt,
      initialPromptRequest.subject,
      initialPromptRequest.topic
    );
    onPromptHandled?.();
  }, [isOpen, initialPromptRequest]);

  if (!isOpen) return null;

  return (
    <div
      className="no-print fixed inset-0 z-[65] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="AI Study Assistant"
    >
      <div className="fixed inset-0 bg-[#07140E]/65 backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-[#FAF6EE] border-l border-[#B08D57]/50 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0F291E] text-[#FAF6EE] border-b border-[#B08D57]/35 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium text-[#E6CFA3] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Grounded AI Study Tutor</span>
            </div>
            <h2 className="font-serif text-lg font-semibold mt-0.5">
              Syllabus-Aware Study Assistant
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={onClearMessages}
                className="p-2 rounded-lg bg-[#173D2D] hover:bg-[#1E4F3A] text-[#C8D4CC]"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#173D2D] hover:bg-[#1E4F3A] text-[#FAF6EE]"
              aria-label="Close AI Study Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Style & Subject Context Bar */}
        <div className="p-3 bg-[#F3ECE0] border-b border-[#DDD3C1] space-y-2.5 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStyle(st.id)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  style === st.id
                    ? 'bg-[#14532D] text-[#FAF6EE]'
                    : 'bg-[#FAF6EE] text-[#4A554E] border border-[#D4C9B4] hover:text-[#1C2420]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (e.g. Physics)"
              className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2420]"
            />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (optional)"
              className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2420]"
            />
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 book-scroll">
          {messages.length === 0 ? (
            <div className="p-5 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] space-y-3 text-xs text-[#4A554E]">
              <div className="font-serif text-sm font-semibold text-[#1C2420] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#14532D]" />
                <span>Ask Anything About Your Syllabus, Formulas, or Derivations</span>
              </div>
              <p>
                Every reply clearly separates <strong>Uploaded Material / Syllabus Notes</strong> from{' '}
                <strong>General AI Explanation</strong>, plus step-by-step formulas, a worked example, and 2 quick practice questions.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  'Explain the core derivation and exam scoring steps for my next topic',
                  'Give me a 2-minute quick revision cheat sheet for today’s subject',
                  'Walk me through a worked numerical example step by step',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => sendQuestion(sample)}
                    className="text-left px-3 py-1.5 rounded-lg bg-[#FAF6EE] border border-[#D4C9B4] hover:border-[#14532D] text-[#1C2420]"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-4 text-xs space-y-3 ${
                  m.role === 'user'
                    ? 'bg-[#0F291E] text-[#FAF6EE] ml-8'
                    : 'bg-[#F3ECE0] border border-[#DDD3C1] text-[#1C2420]'
                }`}
              >
                {m.role === 'user' ? (
                  <div>
                    <div className="text-[10px] text-[#E6CFA3] font-mono mb-1">
                      You · {m.style?.replace('_', ' ')} {m.subject ? `· ${m.subject}` : ''}
                    </div>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {m.sourceGroundedSection && (
                      <div className="p-3 rounded-lg bg-[#E8F3EC] border border-[#B7D7C2] space-y-1">
                        <div className="text-[10px] font-mono font-bold uppercase text-[#14532D]">
                          From Your Uploaded Material &amp; Syllabus
                        </div>
                        <p className="text-[#1C2420] leading-relaxed whitespace-pre-line">
                          {m.sourceGroundedSection}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="text-[10px] font-mono font-bold uppercase text-[#8C6B32]">
                        General AI Explanation ({m.style?.replace('_', ' ')})
                      </div>
                      <p className="text-sm text-[#1C2420] leading-relaxed whitespace-pre-line">
                        {m.generalExplanationSection || m.text}
                      </p>
                    </div>

                    {m.stepByStepFormulas && m.stepByStepFormulas.length > 0 && (
                      <div className="p-3 rounded-lg bg-[#FAF6EE] border border-[#E2D8C6] space-y-1">
                        <div className="font-semibold text-[#14532D]">Key Formulas &amp; Steps</div>
                        <ul className="space-y-1 font-mono text-[11px]">
                          {m.stepByStepFormulas.map((f, idx) => (
                            <li key={idx}>• {f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {m.workedExample && (
                      <div className="p-3 rounded-lg bg-[#FAF6EE] border border-[#E2D8C6] space-y-1">
                        <div className="font-semibold text-[#8C6B32]">Worked Example</div>
                        <p className="whitespace-pre-line leading-relaxed">{m.workedExample}</p>
                      </div>
                    )}

                    {m.practiceQuestions && m.practiceQuestions.length > 0 && (
                      <div className="p-3 rounded-lg bg-[#FAF6EE] border border-[#E2D8C6] space-y-1.5">
                        <div className="font-semibold text-[#1C2420]">Quick Practice Check</div>
                        {m.practiceQuestions.map((pq, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="font-medium">
                              {idx + 1}. {pq.question}
                            </div>
                            <div className="text-[11px] text-[#5A655E]">Hint: {pq.hint}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {m.sourceCitationNote && (
                      <div className="text-[10px] text-[#5A655E] italic">
                        {m.sourceCitationNote}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(question);
          }}
          className="p-4 bg-[#F3ECE0] border-t border-[#DDD3C1] space-y-2"
        >
          {error && <div className="text-xs text-[#991B1B] font-medium">{error}</div>}
          <div className="flex items-center gap-2">
            <input
              id="study-assistant-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a doubt, formula, derivation, or exam strategy question..."
              className="flex-1 bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2.5 text-xs text-[#1C2420] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
            />
            <button
              id="study-assistant-send-btn"
              type="submit"
              disabled={loading || !question.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Ask</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
