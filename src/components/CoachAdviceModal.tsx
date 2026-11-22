import React, { useState, useEffect } from 'react';
import { ShieldAlert, Sparkles, X, Heart, Volume2 } from 'lucide-react';
import { speechHandler } from '../utils/speech';

interface CoachAdviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSprint: (durationMinutes: number) => void;
  hoursStudiedToday?: number;
}

export const CoachAdviceModal: React.FC<CoachAdviceModalProps> = ({
  isOpen,
  onClose,
  onStartSprint,
  hoursStudiedToday = 0,
}) => {
  const [distractionTrigger, setDistractionTrigger] = useState<string>(
    'Instagram Reels & YouTube Shorts'
  );
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [coachResponse, setCoachResponse] = useState<any>(null);
  const [coachError, setCoachError] = useState<string>('');

  // 4-7-8 Breathing state
  const [breathingActive, setBreathingActive] = useState<boolean>(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale (4s)' | 'Hold (7s)' | 'Exhale (8s)'>(
    'Inhale (4s)'
  );
  const [breathTimer, setBreathTimer] = useState<number>(4);

  useEffect(() => {
    if (!breathingActive) return;
    const interval = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev <= 1) {
          if (breathPhase === 'Inhale (4s)') {
            setBreathPhase('Hold (7s)');
            return 7;
          } else if (breathPhase === 'Hold (7s)') {
            setBreathPhase('Exhale (8s)');
            return 8;
          } else {
            setBreathPhase('Inhale (4s)');
            return 4;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [breathingActive, breathPhase]);

  const handleClose = () => {
    speechHandler.stopSpeaking();
    setBreathingActive(false);
    onClose();
  };

  const handleGetCoaching = async () => {
    setIsAiLoading(true);
    setCoachError('');
    try {
      const response = await fetch('/api/ai/coach-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distractionTrigger,
          currentMood: 'Stressed and feeling like procrastinating',
          hoursStudiedToday: Number(hoursStudiedToday.toFixed(1)),
          remainingExamDays: 14,
        }),
      });

      const res = await response.json();
      if (response.ok && res.success && res.data) {
        setCoachResponse(res.data);
        if (res.data.speechVoiceScript) {
          speechHandler.speak(res.data.speechVoiceScript, 'hi-IN');
        }
      } else {
        setCoachError(res.error || 'Could not reach AI Coach right now. Try a breathing reset or micro sprint.');
      }
    } catch (err) {
      console.error('Failed to get coaching', err);
      setCoachError('Network error contacting AI Coach. Try a 15m Micro Sprint to regain momentum.');
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#07140E]/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FAF6EE] border border-[#B08D57] rounded-2xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto book-scroll">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-5 right-5 p-2 rounded-lg bg-[#F2ECE0] border border-[#DDD3C1] text-[#4A554E] hover:text-[#1C2420]"
          aria-label="Close Focus Coach"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pr-8 pb-3 border-b border-[#E5DCCB]">
          <div className="w-10 h-10 rounded-lg bg-[#991B1B] text-[#FAF6EE] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-semibold text-[#1C2420]">
              Focus Rescue Coach
            </h3>
            <p className="text-xs text-[#4A554E]">
              Break a distraction impulse and return cleanly to your study book.
            </p>
          </div>
        </div>

        {/* Distraction Selector */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#1C2420]">
            What is pulling your attention right now?
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              'Instagram Reels & YouTube Shorts',
              'WhatsApp / Discord Chatting',
              'Exam Fear & Overthinking',
              'Fatigue & Bed Procrastination',
            ].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setDistractionTrigger(opt)}
                className={`p-3 rounded-lg border text-left font-medium transition-colors ${
                  distractionTrigger === opt
                    ? 'bg-[#0F291E] border-[#0F291E] text-[#FAF6EE]'
                    : 'bg-[#F3ECE0] border-[#D8CEBC] text-[#1C2420] hover:border-[#B08D57]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* AI Coaching Button */}
        <button
          type="button"
          onClick={handleGetCoaching}
          disabled={isAiLoading}
          className="w-full py-3 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 text-[#E6CFA3] ${isAiLoading ? 'animate-spin' : ''}`} />
          <span>{isAiLoading ? 'Preparing Intervention...' : 'Get AI Mindset Reset (EN / HI)'}</span>
        </button>

        {/* AI Coach Error */}
        {coachError && (
          <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-lg font-medium">
            {coachError}
          </div>
        )}

        {/* AI Coach Output */}
        {coachResponse && (
          <div className="p-4 bg-[#F3ECE0] border border-[#B08D57] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#8C6B32]">Coach Note</span>
              <button
                type="button"
                onClick={() =>
                  speechHandler.speak(
                    coachResponse.speechVoiceScript || coachResponse.mindsetInterventionHindiEnglish,
                    'hi-IN'
                  )
                }
                className="text-[#14532D] hover:underline flex items-center gap-1 font-semibold"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Replay Voice</span>
              </button>
            </div>

            <p className="font-serif italic text-sm text-[#1C2420] leading-relaxed">
              “{coachResponse.mindsetInterventionHindiEnglish}”
            </p>

            {coachResponse.twoMinuteMicroAction && (
              <div className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#DDD3C1] text-xs text-[#1C2420]">
                <strong className="text-[#14532D]">2-Minute Reset:</strong>{' '}
                {coachResponse.twoMinuteMicroAction}
              </div>
            )}
          </div>
        )}

        {/* 4-7-8 Breathing Reset */}
        <div className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#1C2420] flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-[#991B1B]" />
              <span>4-7-8 Breathing Reset</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setBreathPhase('Inhale (4s)');
                setBreathTimer(4);
                setBreathingActive((prev) => !prev);
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                breathingActive
                  ? 'bg-[#991B1B] text-[#FAF6EE]'
                  : 'bg-[#FAF6EE] border border-[#D4C9B4] text-[#1C2420]'
              }`}
            >
              {breathingActive ? 'Stop' : 'Start Breathing'}
            </button>
          </div>

          {breathingActive && (
            <div className="text-center py-3 bg-[#FAF6EE] rounded-lg border border-[#DDD3C1]">
              <div className="font-serif text-lg font-semibold text-[#14532D]">{breathPhase}</div>
              <div className="font-mono text-3xl font-bold text-[#1C2420] mt-1 tabular-nums">
                {breathTimer}s
              </div>
            </div>
          )}
        </div>

        {/* Direct Sprint Launchers */}
        <div className="flex items-center gap-3 pt-2 border-t border-[#E5DCCB]">
          <button
            type="button"
            onClick={() => {
              onStartSprint(15);
              handleClose();
            }}
            className="flex-1 py-2.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#1C2420] font-semibold text-xs border border-[#D4C9B4] transition-colors"
          >
            Start 15m Micro Sprint
          </button>
          <button
            type="button"
            onClick={() => {
              onStartSprint(25);
              handleClose();
            }}
            className="flex-1 py-2.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-xs transition-colors"
          >
            Start 25m Focus Session
          </button>
        </div>
      </div>
    </div>
  );
};
