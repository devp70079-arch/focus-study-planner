import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
} from 'lucide-react';
import { speechHandler, SpeechRecognitionResultEvent } from '../utils/speech';
import {
  Task,
  WeeklyScheduleBlock,
  NightBattlePlan,
  VoiceAssistantResponse,
  PendingSprintRequest,
  StudyMode,
} from '../types';
import { getLocalDateString } from '../utils/date';

const SUBJECT_COLORS: Record<string, string> = {
  Physics: '#1D4ED8',
  Mathematics: '#6D28D9',
  Chemistry: '#047857',
  Biology: '#BE185D',
  'Computer Science': '#B45309',
  English: '#0E7490',
  Revision: '#374151',
};

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: Task) => void;
  onCompleteTask?: (taskId: string) => void;
  onAddScheduleBlock: (block: WeeklyScheduleBlock) => void;
  onUpdateNightPlan: (plan: Partial<NightBattlePlan>) => void;
  onStartFocusSession?: (req: Omit<PendingSprintRequest, 'key'>) => void;
  tasks: Task[];
  weeklySchedule: WeeklyScheduleBlock[];
}

const SAMPLE_PROMPTS = [
  {
    lang: 'Hinglish',
    text: 'Kal subah 6 baje Physics Optics numericals schedule kar do 2 ghante ke liye',
  },
  {
    lang: 'English',
    text: 'Add task Chemistry Aldehydes reaction sheet 60 minutes high priority',
  },
  {
    lang: 'English',
    text: 'Schedule Mathematics Calculus mock test on Wednesday from 04:00 PM to 06:00 PM',
  },
  {
    lang: 'Hinglish',
    text: 'Night plan: Kal ke top 3 tasks set karo - Math integration, Physics derivation, Chem reactions',
  },
];

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
  onCompleteTask,
  onAddScheduleBlock,
  onUpdateNightPlan,
  onStartFocusSession,
  tasks,
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [language, setLanguage] = useState<'hi-IN' | 'en-US'>('hi-IN');
  const [transcript, setTranscript] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [assistantReply, setAssistantReply] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState<boolean>(true);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    speechHandler.setLanguage(language);
  }, [language]);

  const handleClose = () => {
    speechHandler.stop();
    speechHandler.stopSpeaking();
    setIsListening(false);
    onClose();
  };

  if (!isOpen) return null;

  const startListening = () => {
    setErrorMessage('');
    setAssistantReply('');
    setActionSuccessMessage('');

    speechHandler.setLanguage(language);
    setIsListening(true);

    speechHandler.start(
      (result: SpeechRecognitionResultEvent) => {
        setTranscript(result.transcript);
        if (result.isFinal) {
          setIsListening(false);
          processVoiceTranscript(result.transcript);
        }
      },
      () => {
        setIsListening(false);
        setErrorMessage(
          'Microphone unavailable in this browser. Type your Hindi or English command below.'
        );
      },
      () => {
        setIsListening(false);
      }
    );
  };

  const stopListening = () => {
    speechHandler.stop();
    setIsListening(false);
    if (transcript.trim()) {
      processVoiceTranscript(transcript);
    }
  };

  const processVoiceTranscript = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          currentContext: {
            totalTasks: tasks.length,
            pendingTasks: tasks.filter((t) => !t.completed).map((t) => t.title),
          },
        }),
      });

      const json = await response.json();
      if (response.ok && json.success && json.data) {
        const result: VoiceAssistantResponse = json.data;
        setAssistantReply(result.naturalVoiceReply);
        setDetectedLanguage(result.detectedLanguage);

        const actionsSummary: string[] = [];

        if (result.intent === 'MARK_TASK_COMPLETE' && onCompleteTask) {
          const lowerText = text.toLowerCase();
          const pending = tasks.filter((t) => !t.completed);
          const matched = pending.find(
            (t) =>
              lowerText.includes(t.subject.toLowerCase()) ||
              t.title
                .toLowerCase()
                .split(/\s+/)
                .some((word) => word.length > 3 && lowerText.includes(word))
          );
          if (matched) {
            onCompleteTask(matched.id);
            actionsSummary.push(`Marked completed: "${matched.title}"`);
          }
        } else if (result.extractedTasks && result.extractedTasks.length > 0 && result.intent !== 'FOCUS_START') {
          result.extractedTasks.forEach((t) => {
            const rawDue = (t.dueDate || '').trim().toLowerCase();
            const resolvedDueDate = rawDue.match(/^\d{4}-\d{2}-\d{2}$/)
              ? rawDue
              : rawDue === 'tomorrow'
              ? getLocalDateString(1)
              : getLocalDateString(0);
            const newTask: Task = {
              id: `t-voice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title: t.title,
              subject: t.subject || 'General Study',
              estimatedMinutes: t.estimatedMinutes || 45,
              completed: false,
              dueDate: resolvedDueDate,
              priority: t.priority || 'high',
            };
            onAddTask(newTask);
            actionsSummary.push(`Added task: "${newTask.title}" (${newTask.estimatedMinutes}m)`);
          });
        }

        if (result.extractedScheduleBlocks && result.extractedScheduleBlocks.length > 0) {
          result.extractedScheduleBlocks.forEach((b) => {
            const rawDay = typeof b.dayOfWeek === 'number' ? b.dayOfWeek : 1;
            const normalizedDay = rawDay === 7 ? 0 : Math.max(0, Math.min(6, rawDay));
            const subjectName = b.subject || 'Physics';
            const newBlock: WeeklyScheduleBlock = {
              id: `w-voice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              dayOfWeek: normalizedDay,
              startTime: b.startTime || '07:00',
              endTime: b.endTime || '09:00',
              subject: subjectName,
              topic: b.topic || subjectName || 'Study Slot',
              color: SUBJECT_COLORS[subjectName] || '#1D4ED8',
              completed: false,
            };
            onAddScheduleBlock(newBlock);
            actionsSummary.push(
              `Scheduled: ${newBlock.subject} ${newBlock.startTime}–${newBlock.endTime}`
            );
          });
        }

        if (result.nightPlanData) {
          const np = result.nightPlanData;
          onUpdateNightPlan({
            top3MITs: np.top3MITs,
            wakeUpTime: np.wakeUpTime,
            sleepTime: np.sleepTime,
            morningKickoffTask: np.kickoffTask,
          });
          actionsSummary.push('Updated tomorrow Night Plan MITs.');
        }

        if ((result.intent === 'FOCUS_START' || result.focusRequest) && onStartFocusSession) {
          const req = result.focusRequest;
          const duration = req?.durationMinutes || 25;
          const validModes: StudyMode[] = ['pomodoro', 'sprint_50_10', 'ultra_90', 'flowtime', 'hardcore_lock'];
          const requestedMode = validModes.includes(req?.mode as StudyMode)
            ? (req?.mode as StudyMode)
            : undefined;
          onStartFocusSession({
            durationMinutes: duration,
            subject: req?.subject,
            mode: requestedMode,
          });
          actionsSummary.push(`Started ${duration}m focus session${req?.subject ? ` (${req.subject})` : ''}`);
        }

        if (actionsSummary.length > 0) {
          setActionSuccessMessage(actionsSummary.join(' · '));
        }

        if (audioFeedbackEnabled && result.naturalVoiceReply) {
          speechHandler.speak(
            result.naturalVoiceReply,
            result.detectedLanguage?.toLowerCase().includes('hindi') ? 'hi-IN' : 'en-US'
          );
        }
      } else {
        setErrorMessage(json.error || 'Could not understand command.');
      }
    } catch (err) {
      console.error('Voice process failure', err);
      setErrorMessage('Failed to connect to AI server. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim()) {
      processVoiceTranscript(transcript);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07140E]/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FAF6EE] border border-[#B08D57] rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto book-scroll">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E5DCCB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0F291E] text-[#E6CFA3] flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-[#1C2420]">
                Bilingual Study Assistant
              </h3>
              <p className="text-xs text-[#4A554E]">
                Speak or type in Hindi, Hinglish, or English to add tasks, slots, or night plans.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg bg-[#F2ECE0] border border-[#DDD3C1] text-[#4A554E] hover:text-[#1C2420]"
            aria-label="Close Voice Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language & Audio Reply Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F3ECE0] border border-[#DDD3C1] p-2.5 rounded-xl text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#4A554E] font-medium px-1">Mic Language:</span>
            <button
              type="button"
              onClick={() => setLanguage('hi-IN')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                language === 'hi-IN'
                  ? 'bg-[#0F291E] text-[#FAF6EE]'
                  : 'text-[#4A554E] hover:text-[#1C2420]'
              }`}
            >
              हिन्दी / Hinglish
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en-US')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                language === 'en-US'
                  ? 'bg-[#0F291E] text-[#FAF6EE]'
                  : 'text-[#4A554E] hover:text-[#1C2420]'
              }`}
            >
              English
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAudioFeedbackEnabled(!audioFeedbackEnabled)}
            className="flex items-center gap-1.5 text-[#14532D] font-medium px-2"
          >
            {audioFeedbackEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Voice Reply ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#6B756F]" />
                <span className="text-[#6B756F]">Voice Reply Muted</span>
              </>
            )}
          </button>
        </div>

        {/* Recording & Text Input Stage */}
        <div className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl p-5 text-center space-y-4">
          <button
            id="assistant-record-trigger"
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-transform shadow-sm ${
              isListening
                ? 'bg-[#991B1B] text-[#FAF6EE] scale-105'
                : 'bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE]'
            }`}
            aria-label={isListening ? 'Stop listening' : 'Start microphone'}
          >
            {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>

          <div className="text-xs font-medium text-[#4A554E]">
            {isListening
              ? 'Listening... Speak in Hindi or English now.'
              : isProcessing
              ? 'Processing your study command...'
              : 'Tap the microphone or type your instruction below.'}
          </div>

          <form onSubmit={handleManualSubmit} className="relative">
            <input
              ref={inputRef}
              id="voice-command-text-input"
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g. Kal subah 6 baje Physics Optics revise karni hai..."
              className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-4 py-2.5 pr-11 text-sm text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
            />
            <button
              type="submit"
              disabled={isProcessing || !transcript.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md bg-[#0F291E] text-[#FAF6EE] disabled:opacity-40"
              aria-label="Send command"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Response Box */}
        {assistantReply && (
          <div className="p-4 bg-[#F3ECE0] border border-[#B08D57] rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-[#8C6B32] font-semibold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Assistant Reply ({detectedLanguage})</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  speechHandler.speak(
                    assistantReply,
                    detectedLanguage?.toLowerCase().includes('hindi') ? 'hi-IN' : 'en-US'
                  )
                }
                className="text-[#14532D] hover:underline flex items-center gap-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Listen</span>
              </button>
            </div>
            <p className="text-sm font-medium text-[#1C2420] leading-relaxed">
              “{assistantReply}”
            </p>
            {actionSuccessMessage && (
              <div className="pt-2 border-t border-[#DDD3C1] flex items-center gap-2 text-xs text-[#14532D] font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionSuccessMessage}</span>
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Prompts */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#4A554E]">Example Commands</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SAMPLE_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTranscript(p.text);
                  processVoiceTranscript(p.text);
                }}
                className="text-left p-2.5 rounded-lg bg-[#F3ECE0] hover:bg-[#EAE1D0] border border-[#DDD3C1] text-xs text-[#1C2420] flex items-center justify-between gap-2 transition-colors"
              >
                <span className="truncate">
                  <strong className="text-[#8C6B32] mr-1">{p.lang}:</strong>
                  {p.text}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#8C6B32] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
