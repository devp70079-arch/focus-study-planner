import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarClock,
  CheckCircle2,
  Compass,
  PenTool,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AcademicProfile, PreparationLevel } from '../types';
import { getLocalDateString } from '../utils/date';

interface OnboardingDesk3DProps {
  profile: AcademicProfile;
  onComplete: (updatedProfile: AcademicProfile) => void;
  onSkip: () => void;
}

const STEPS = [
  {
    stepNum: '01',
    title: 'Upload Syllabus & Past Papers',
    subtitle: 'AI Master Strategist',
    description:
      'Feed your university syllabus PDFs and previous-year question papers. We map real topic recurrence, mark weightage, and build your exact priority sequence — never inventing fake statistics.',
    highlight: 'Verified PYQ Frequency + AI Predicted Practice Papers',
  },
  {
    stepNum: '02',
    title: 'Divide Syllabus & Retain Everything',
    subtitle: 'Daily Plan + Spaced Revision',
    description:
      'Break units into realistic daily milestones, recover automatically if you miss a day, and reinforce formulas via adaptive flashcards, quick quizzes, and your Mistake Bank.',
    highlight: '4-Milestone Mastery + Adaptive Spaced Repetition',
  },
  {
    stepNum: '03',
    title: 'Set Your Exam Desk',
    subtitle: 'Personalize Your Command Center',
    description:
      'Enter your target exam details so your daily workload, countdown, and revision intervals calibrate accurately to your schedule.',
    highlight: 'Zero Fake Scores — Built From Your Real Study Evidence',
  },
];

export const OnboardingDesk3D: React.FC<OnboardingDesk3DProps> = ({
  profile,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<number>(0);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [universityOrBoard, setUniversityOrBoard] = useState(profile.universityOrBoard || '');
  const [courseAndSemester, setCourseAndSemester] = useState(profile.courseAndSemester || '');
  const [primarySubject, setPrimarySubject] = useState(profile.primarySubject || '');
  const [upcomingExamDate, setUpcomingExamDate] = useState(
    profile.upcomingExamDate || getLocalDateString(30)
  );
  const [dailyAvailableHours, setDailyAvailableHours] = useState(profile.dailyAvailableHours || 4);
  const [preparationLevel, setPreparationLevel] = useState<PreparationLevel>(
    profile.preparationLevel || 'intermediate'
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: relY * -6, y: relX * 8 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleFinish = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanedSubject = primarySubject.trim();
    const nextExams = [...(profile.exams || [])];
    if (
      cleanedSubject &&
      upcomingExamDate &&
      !nextExams.some((ex) => ex.subject.toLowerCase() === cleanedSubject.toLowerCase())
    ) {
      nextExams.unshift({
        id: `exam-${Date.now()}`,
        subject: cleanedSubject,
        examDate: upcomingExamDate,
        universityOrBoard: universityOrBoard.trim() || 'General',
        courseAndSemester: courseAndSemester.trim() || 'Current Term',
      });
    }

    onComplete({
      ...profile,
      universityOrBoard: universityOrBoard.trim(),
      courseAndSemester: courseAndSemester.trim(),
      primarySubject: cleanedSubject,
      upcomingExamDate,
      dailyAvailableHours: Math.max(1, Math.min(16, Number(dailyAvailableHours) || 4)),
      preparationLevel,
      exams: nextExams,
      onboardingCompleted: true,
    });
  };

  const activeStep = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#081710]/92 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to AI Academic Command Center"
    >
      <div className="max-w-5xl w-full bg-[#FAF6EE] border border-[#B08D57]/60 rounded-2xl shadow-[0_32px_90px_rgba(0,0,0,0.65)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Lightweight CSS 3D Interactive Study Desk Scene */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="lg:col-span-6 relative bg-[#0C2218] p-6 sm:p-8 flex flex-col justify-between overflow-hidden min-h-[340px] lg:min-h-[540px]"
        >
          {/* Soft Warm Desk Lamp Radial Lighting */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-[#C8A66A]/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 right-0 w-72 h-72 rounded-full bg-[#14532D]/40 blur-3xl"
          />

          <div className="relative z-10 flex items-center justify-between text-xs text-[#E6CFA3]">
            <span className="font-serif italic tracking-wide">
              Its Last Chance For Focus · Academic Desk
            </span>
            <span className="font-mono text-[11px] text-[#B8C7BD] tabular-nums">
              Step {activeStep.stepNum} / 03
            </span>
          </div>

          {/* 3D Perspective Stage */}
          <div className="relative z-10 my-6 flex items-center justify-center desk-3d-stage">
            <div
              className="desk-3d-surface relative w-full max-w-[360px] aspect-[4/3] rounded-xl"
              style={{
                transform: `rotateX(${8 + tilt.x}deg) rotateY(${tilt.y}deg)`,
              }}
            >
              {/* Wooden / Oxford Desk Mat Base */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#133525] via-[#0E281C] to-[#081911] border border-[#B08D57]/30 shadow-[0_24px_45px_rgba(0,0,0,0.6)]" />

              {/* Open Archival Study Book */}
              <div className="animate-desk-book absolute inset-x-5 top-7 bottom-7 rounded-lg bg-[#0F291E] p-1.5 border border-[#C8A66A]/45 shadow-2xl grid grid-cols-2 gap-0.5">
                {/* Left Ivory Page */}
                <div className="bg-[#FAF6EE] rounded-l-md p-3 flex flex-col justify-between border-r border-[#DDD3C1]">
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-[#8C6B32]">
                      Syllabus Map
                    </div>
                    <div className="font-serif text-xs font-semibold text-[#1C2420] mt-0.5">
                      {primarySubject || 'Exam Strategy'}
                    </div>
                    <div className="mt-2.5 space-y-1.5">
                      <div className="h-1.5 w-4/5 bg-[#14532D]/70 rounded" />
                      <div className="h-1.5 w-3/5 bg-[#B08D57]/60 rounded" />
                      <div className="h-1.5 w-11/12 bg-[#D6CCB8] rounded" />
                      <div className="h-1.5 w-2/3 bg-[#D6CCB8] rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-[#14532D] font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>4 Milestones</span>
                  </div>
                </div>

                {/* Right Ivory Page */}
                <div className="bg-[#F6F0E4] rounded-r-md p-3 flex flex-col justify-between">
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-[#14532D]">
                      PYQ Recurrence
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[9px] font-mono text-[#1C2420]">
                        <span>Unit I</span>
                        <span className="text-[#14532D] font-semibold">High</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E2D8C6] rounded overflow-hidden">
                        <div className="w-4/5 h-full bg-[#14532D]" />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-mono text-[#1C2420] pt-1">
                        <span>Unit II</span>
                        <span className="text-[#8C6B32] font-semibold">Med</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E2D8C6] rounded overflow-hidden">
                        <div className="w-3/5 h-full bg-[#B08D57]" />
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-[#5A655E]">Verified Sources</div>
                </div>
              </div>

              {/* Brass Fountain Pen Accent */}
              <div
                aria-hidden="true"
                className="absolute -right-2 bottom-5 w-28 h-2.5 rounded-full bg-gradient-to-r from-[#8C6B32] via-[#E6CFA3] to-[#6B4F21] shadow-lg -rotate-12 flex items-center justify-end pr-1"
              >
                <PenTool className="w-3 h-3 text-[#0F291E]" />
              </div>

              {/* Floating Academic Index Card (Top Left) */}
              <div className="animate-desk-float absolute -top-3 -left-2 bg-[#FAF6EE] border border-[#B08D57] rounded-lg px-2.5 py-1.5 shadow-xl flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-[#14532D]" />
                <span className="text-[10px] font-semibold text-[#1C2420]">Spaced Recall</span>
              </div>

              {/* Floating Focus Shield Card (Bottom Left) */}
              <div
                className="animate-desk-float absolute -bottom-3 left-4 bg-[#173D2D] border border-[#B08D57]/60 rounded-lg px-2.5 py-1.5 shadow-xl flex items-center gap-1.5"
                style={{ animationDelay: '1.4s' }}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#E6CFA3]" />
                <span className="text-[10px] font-medium text-[#FAF6EE]">Focus Guardian</span>
              </div>
            </div>
          </div>

          {/* Step Dots & Highlight */}
          <div className="relative z-10 space-y-3">
            <div className="text-xs text-[#E6CFA3] font-medium">{activeStep.highlight}</div>
            <div className="flex items-center gap-2">
              {STEPS.map((s, idx) => (
                <button
                  key={s.stepNum}
                  type="button"
                  onClick={() => setStep(idx)}
                  aria-label={`Go to onboarding step ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === step ? 'w-8 bg-[#E6CFA3]' : 'w-3 bg-[#365C49] hover:bg-[#5B856E]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Structured Onboarding Copy & Quick Setup */}
        <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between gap-6 bg-[#FAF6EE]">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[#8C6B32] uppercase tracking-wider">
                  {activeStep.subtitle}
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight text-balance">
                  {activeStep.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={onSkip}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#5A655E] hover:text-[#1C2420] px-2.5 py-1.5 rounded-lg hover:bg-[#F2ECE0] transition-colors shrink-0"
              >
                <span>Skip</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-sm text-[#4A554E] leading-relaxed">{activeStep.description}</p>

            {step === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#14532D]">
                    <Compass className="w-4 h-4" />
                    <span>5 Questions Answered</span>
                  </div>
                  <p className="text-xs text-[#4A554E]">
                    What to study first, what to complete today, high-yield topics, what to revise, and real readiness.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8C6B32]">
                    <BookOpen className="w-4 h-4" />
                    <span>Traceable Evidence</span>
                  </div>
                  <p className="text-xs text-[#4A554E]">
                    Distinguishes verified PYQ frequency from AI-estimated syllabus importance.
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-2.5 pt-1 text-xs">
                <div className="p-3 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] flex items-start gap-3">
                  <CalendarClock className="w-4 h-4 text-[#14532D] mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-[#1C2420]">Smart Study Recovery</div>
                    <p className="text-[#4A554E] mt-0.5">
                      Miss a study day? Automatically rebalance missed tasks across upcoming days without cramming tomorrow.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] flex items-start gap-3">
                  <Brain className="w-4 h-4 text-[#8C6B32] mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-[#1C2420]">Revision Center &amp; Mistake Bank</div>
                    <p className="text-[#4A554E] mt-0.5">
                      Wrong quiz answers are automatically logged into your Mistake Bank and tighten your revision intervals.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <form id="onboarding-setup-form" onSubmit={handleFinish} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#1C2420] mb-1">
                      Primary Subject
                    </label>
                    <input
                      type="text"
                      value={primarySubject}
                      onChange={(e) => setPrimarySubject(e.target.value)}
                      placeholder="e.g. Data Structures, Physics"
                      className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#1C2420] mb-1">
                      Upcoming Exam Date
                    </label>
                    <input
                      type="date"
                      value={upcomingExamDate}
                      onChange={(e) => setUpcomingExamDate(e.target.value)}
                      className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#1C2420] mb-1">
                      University / Exam Board
                    </label>
                    <input
                      type="text"
                      value={universityOrBoard}
                      onChange={(e) => setUniversityOrBoard(e.target.value)}
                      placeholder="e.g. CBSE, VTU, Mumbai Univ"
                      className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#1C2420] mb-1">
                      Course &amp; Semester
                    </label>
                    <input
                      type="text"
                      value={courseAndSemester}
                      onChange={(e) => setCourseAndSemester(e.target.value)}
                      placeholder="e.g. B.Tech Sem 4, Class 12"
                      className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#1C2420] mb-1">
                      Study Hours / Day
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      step={0.5}
                      value={dailyAvailableHours}
                      onChange={(e) => setDailyAvailableHours(Number(e.target.value))}
                      className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#1C2420] mb-1">
                      Current Preparation
                    </label>
                    <select
                      value={preparationLevel}
                      onChange={(e) => setPreparationLevel(e.target.value as PreparationLevel)}
                      className="w-full bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                    >
                      <option value="beginner">Just Starting</option>
                      <option value="intermediate">Mid-Syllabus</option>
                      <option value="revision_stage">Revision Stage</option>
                      <option value="exam_week">Exam Week</option>
                    </select>
                  </div>
                </div>
              </form>
            )}
          </div>

          <div className="pt-4 border-t border-[#E5DCCB] flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="px-4 py-2.5 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-xs font-semibold text-[#4A554E] transition-colors"
              >
                Back
              </button>
            ) : (
              <span className="text-xs text-[#6B756F]">You can replay this anytime in Settings.</span>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                form="onboarding-setup-form"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold transition-colors"
              >
                <span>Enter Command Center</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
