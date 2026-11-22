import React, { useState, useEffect } from 'react';
import {
  Moon,
  Sun,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Clock,
  ListChecks,
} from 'lucide-react';
import { NightBattlePlan, Task } from '../types';
import { getLocalDateString } from '../utils/date';

interface NightPlanViewProps {
  nightPlans: NightBattlePlan[];
  onSaveNightPlan: (plan: NightBattlePlan) => void;
  tasks: Task[];
  hoursStudiedToday: number;
  mobilePage?: 'left' | 'right';
}

export const NightPlanView: React.FC<NightPlanViewProps> = ({
  nightPlans,
  onSaveNightPlan,
  tasks,
  hoursStudiedToday,
  mobilePage = 'left',
}) => {
  const getTomorrowStr = () => getLocalDateString(1);

  const activePlan = nightPlans[0] || {
    id: `np-${Date.now()}`,
    date: getTomorrowStr(),
    top3MITs: ['', '', ''],
    morningKickoffTask: '',
    wakeUpTime: '06:00 AM',
    sleepTime: '10:45 PM',
    targetHours: 6.5,
    phoneLockCommitment: true,
    eveningReflection: '',
    antiDistractionRule: '',
    status: 'planned',
    createdAt: new Date().toISOString(),
  };

  const [date] = useState<string>(activePlan.date || getTomorrowStr());
  const [mit1, setMit1] = useState<string>(activePlan.top3MITs?.[0] || '');
  const [mit2, setMit2] = useState<string>(activePlan.top3MITs?.[1] || '');
  const [mit3, setMit3] = useState<string>(activePlan.top3MITs?.[2] || '');
  const [kickoff, setKickoff] = useState<string>(activePlan.morningKickoffTask || '');
  const [wakeTime, setWakeTime] = useState<string>(activePlan.wakeUpTime || '06:00 AM');
  const [sleepTime, setSleepTime] = useState<string>(activePlan.sleepTime || '10:45 PM');
  const [phoneLock, setPhoneLock] = useState<boolean>(activePlan.phoneLockCommitment ?? true);
  const [reflection, setReflection] = useState<string>(activePlan.eveningReflection || '');
  const [antiDistractionRule, setAntiDistractionRule] = useState<string>(
    activePlan.antiDistractionRule || ''
  );
  const [targetTomorrowHoursInput, setTargetTomorrowHoursInput] = useState<string>(
    String(activePlan.targetHours ?? 6.5)
  );

  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiInsight, setAiInsight] = useState<string>(activePlan.diagnosticInsight || '');
  const [aiQuote, setAiQuote] = useState<string>(activePlan.motivationalQuote || '');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Sync external updates (e.g. from Bilingual Voice Assistant)
  useEffect(() => {
    if (!nightPlans[0]) return;
    const latest = nightPlans[0];
    if (latest.top3MITs) {
      setMit1(latest.top3MITs[0] || '');
      setMit2(latest.top3MITs[1] || '');
      setMit3(latest.top3MITs[2] || '');
    }
    if (latest.morningKickoffTask !== undefined) setKickoff(latest.morningKickoffTask);
    if (latest.wakeUpTime !== undefined) setWakeTime(latest.wakeUpTime);
    if (latest.sleepTime !== undefined) setSleepTime(latest.sleepTime);
    if (latest.antiDistractionRule !== undefined) setAntiDistractionRule(latest.antiDistractionRule);
    if (latest.eveningReflection !== undefined) setReflection(latest.eveningReflection);
    if (latest.diagnosticInsight !== undefined) setAiInsight(latest.diagnosticInsight);
    if (latest.motivationalQuote !== undefined) setAiQuote(latest.motivationalQuote);
    if (latest.targetHours !== undefined) setTargetTomorrowHoursInput(String(latest.targetHours));
  }, [nightPlans]);

  const completedToday = tasks.filter((t) => t.completed);
  const incompletedToday = tasks.filter((t) => !t.completed);

  const parsedTargetHours = Math.min(16, Math.max(1, parseFloat(targetTomorrowHoursInput) || 6.5));

  const handleAiNightAssist = async () => {
    setIsAiGenerating(true);
    setFormError('');
    try {
      const response = await fetch('/api/ai/night-plan-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTasks: completedToday.map((t) => t.title),
          incompletedTasks: incompletedToday.map(
            (t) => `${t.title} (${t.incompleteReason || 'pending'})`
          ),
          hoursStudiedToday,
          targetTomorrowHours: parsedTargetHours,
          userNotes: reflection || 'Reviewing today and preparing tomorrow study targets',
        }),
      });

      const res = await response.json();
      if (response.ok && res.success && res.data) {
        const data = res.data;
        if (data.top3MITs && data.top3MITs.length >= 3) {
          setMit1(data.top3MITs[0]);
          setMit2(data.top3MITs[1]);
          setMit3(data.top3MITs[2]);
        }
        if (data.morningKickoffTask) setKickoff(data.morningKickoffTask);
        if (data.wakeUpGoal) setWakeTime(data.wakeUpGoal);
        if (data.sleepCurfewGoal) setSleepTime(data.sleepCurfewGoal);
        if (data.antiDistractionRule) setAntiDistractionRule(data.antiDistractionRule);
        if (data.diagnosticInsight) setAiInsight(data.diagnosticInsight);
        if (data.motivationalQuoteHindiEnglish) setAiQuote(data.motivationalQuoteHindiEnglish);
      } else {
        setFormError(res.error || 'Could not generate AI plan. Please fill fields manually.');
      }
    } catch (err) {
      console.error('Failed to generate AI night plan assist', err);
      setFormError('Could not connect to AI service. Please fill your plan manually.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSavePlan = () => {
    if (!mit1.trim()) {
      setFormError('Please specify at least the #1 Most Important Task for tomorrow.');
      return;
    }
    setFormError('');

    const newPlan: NightBattlePlan = {
      id: activePlan.id || `np-${Date.now()}`,
      date,
      top3MITs: [mit1.trim(), mit2.trim(), mit3.trim()].filter(Boolean),
      morningKickoffTask: kickoff.trim() || 'Start 25m focus sprint right after waking up',
      wakeUpTime: wakeTime,
      sleepTime: sleepTime,
      targetHours: parsedTargetHours,
      phoneLockCommitment: phoneLock,
      eveningReflection: reflection,
      antiDistractionRule: antiDistractionRule || 'No social media before completing MIT #1',
      diagnosticInsight: aiInsight,
      motivationalQuote: aiQuote || 'Kal subah determination ke saath utho aur target complete karo!',
      status: 'planned',
      createdAt: new Date().toISOString(),
    };

    onSaveNightPlan(newPlan);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[640px]">
      {/* ================= LEFT PAGE (Page 3: Tomorrow's Big 3 & Morning Launch) ================= */}
      <article
        className={`${
          mobilePage === 'left' ? 'block' : 'hidden lg:block'
        } relative p-6 sm:p-8 lg:p-10 lg:border-r lg:border-[#DFD5C3] book-spine-shadow-left flex flex-col justify-between gap-6`}
      >
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E5DCCB]">
            <div>
              <div className="text-xs font-medium text-[#8C6B32]">
                Chapter II · Page 3 · Target Date {date}
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight text-balance">
                Night Preparation Plan
              </h2>
            </div>

            <button
              id="ai-night-assist-button"
              type="button"
              onClick={handleAiNightAssist}
              disabled={isAiGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F291E] hover:bg-[#173D2D] text-[#FAF6EE] text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#E6CFA3] ${isAiGenerating ? 'animate-spin' : ''}`} />
              <span>{isAiGenerating ? 'Drafting Plan...' : 'AI Review & Draft'}</span>
            </button>
          </div>

          {aiInsight && (
            <div className="p-3.5 rounded-lg bg-[#F3ECE0] border border-[#D8CEBC] text-xs text-[#1C2420] space-y-1">
              <div className="font-semibold text-[#14532D]">Study Mentor Note</div>
              <p className="text-[#37423B] leading-relaxed">{aiInsight}</p>
              {aiQuote && <p className="italic text-[#8C6B32] pt-1">“{aiQuote}”</p>}
            </div>
          )}

          {/* Top 3 MITs */}
          <section className="space-y-3">
            <div>
              <h3 className="font-serif text-base font-semibold text-[#1C2420] flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-[#14532D]" />
                <span>Three Non-Negotiable Tasks (MITs)</span>
              </h3>
              <p className="text-xs text-[#4A554E] mt-0.5">
                Decide tonight so tomorrow starts with zero hesitation.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-3 bg-[#F3ECE0] border border-[#D8CEBC] rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#14532D]">
                <span className="font-serif font-bold text-sm text-[#991B1B] w-5 text-center shrink-0">
                  1.
                </span>
                <input
                  id="mit-task-1"
                  type="text"
                  value={mit1}
                  onChange={(e) => setMit1(e.target.value)}
                  placeholder="Most critical priority (e.g. 2h Physics Optics numericals)"
                  className="w-full bg-transparent text-sm text-[#1C2420] placeholder-[#7A847D] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 bg-[#F3ECE0] border border-[#D8CEBC] rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#14532D]">
                <span className="font-serif font-bold text-sm text-[#8C6B32] w-5 text-center shrink-0">
                  2.
                </span>
                <input
                  id="mit-task-2"
                  type="text"
                  value={mit2}
                  onChange={(e) => setMit2(e.target.value)}
                  placeholder="Second priority (e.g. Calculus practice sheet)"
                  className="w-full bg-transparent text-sm text-[#1C2420] placeholder-[#7A847D] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 bg-[#F3ECE0] border border-[#D8CEBC] rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#14532D]">
                <span className="font-serif font-bold text-sm text-[#14532D] w-5 text-center shrink-0">
                  3.
                </span>
                <input
                  id="mit-task-3"
                  type="text"
                  value={mit3}
                  onChange={(e) => setMit3(e.target.value)}
                  placeholder="Third priority (e.g. Organic Chemistry flashcards)"
                  className="w-full bg-transparent text-sm text-[#1C2420] placeholder-[#7A847D] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Morning Kickoff Trigger */}
          <section className="space-y-2 pt-2 border-t border-[#E5DCCB]">
            <h3 className="font-serif text-base font-semibold text-[#1C2420] flex items-center gap-2">
              <Sun className="w-4 h-4 text-[#8C6B32]" />
              <span>Morning First-15-Minutes Starter</span>
            </h3>
            <p className="text-xs text-[#4A554E]">
              The exact page or problem you will open right after waking up.
            </p>
            <input
              id="morning-kickoff-input"
              type="text"
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
              placeholder="e.g. Open NCERT Physics Pg 112 Problem 4 at 6:00 AM"
              className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3.5 py-2.5 text-sm text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
            />
          </section>
        </div>

        <p className="text-xs text-[#5A655E] pt-3 border-t border-[#E5DCCB]">
          Today&apos;s baseline: <span className="font-mono font-semibold tabular-nums">{completedToday.length}</span> completed ·{' '}
          <span className="font-mono font-semibold tabular-nums">{incompletedToday.length}</span> remaining ·{' '}
          <span className="font-mono font-semibold tabular-nums">{hoursStudiedToday.toFixed(1)}h</span> logged
        </p>
      </article>

      {/* ================= RIGHT PAGE (Page 4: Evening Reflection & Curfew Lock) ================= */}
      <article
        className={`${
          mobilePage === 'right' ? 'block' : 'hidden lg:block'
        } relative p-6 sm:p-8 lg:p-10 book-spine-shadow-right flex flex-col justify-between gap-6`}
      >
        <div className="space-y-6">
          <div className="pb-3 border-b border-[#E5DCCB]">
            <div className="text-xs font-medium text-[#8C6B32]">
              Chapter II · Page 4 · Evening Accountability
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#1C2420] mt-1 tracking-tight">
              Reflection & Sleep Curfew
            </h2>
          </div>

          {/* Reflection */}
          <section className="space-y-3">
            <div>
              <label
                htmlFor="evening-reflection-textarea"
                className="block text-xs font-semibold text-[#1C2420] mb-1.5"
              >
                What caused distractions today &amp; what changes tomorrow?
              </label>
              <textarea
                id="evening-reflection-textarea"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Write a brief honest reflection on today's focus..."
                className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg p-3 text-xs text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                rows={3}
              />
            </div>

            <div>
              <label
                htmlFor="anti-distraction-rule-input"
                className="block text-xs font-semibold text-[#1C2420] mb-1.5"
              >
                Tomorrow&apos;s Anti-Distraction Rule
              </label>
              <input
                id="anti-distraction-rule-input"
                type="text"
                value={antiDistractionRule}
                onChange={(e) => setAntiDistractionRule(e.target.value)}
                placeholder="e.g. Phone stays in another room until MIT #1 is complete"
                className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2.5 text-xs text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
              />
            </div>
          </section>

          {/* Sleep & Target Hours */}
          <section className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-xl p-4 space-y-4">
            <h3 className="font-serif text-sm font-semibold text-[#1C2420] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#14532D]" />
              <span>Rest &amp; Study Targets</span>
            </h3>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[#4A554E] font-medium mb-1">Target Hours</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  step="0.5"
                  value={targetTomorrowHoursInput}
                  onChange={(e) => setTargetTomorrowHoursInput(e.target.value)}
                  onBlur={() => setTargetTomorrowHoursInput(String(parsedTargetHours))}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-2.5 py-2 font-mono font-semibold text-[#1C2420] text-center tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[#4A554E] font-medium mb-1">Sleep Curfew</label>
                <input
                  type="text"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-2.5 py-2 font-mono font-semibold text-[#1C2420] text-center"
                />
              </div>

              <div>
                <label className="block text-[#4A554E] font-medium mb-1">Wake Goal</label>
                <input
                  type="text"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-2.5 py-2 font-mono font-semibold text-[#1C2420] text-center"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 pt-2 border-t border-[#DDD3C1] cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={phoneLock}
                onChange={(e) => setPhoneLock(e.target.checked)}
                className="mt-0.5 accent-[#14532D] rounded"
              />
              <div>
                <span className="font-semibold text-[#1C2420] flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-[#8C6B32]" />
                  <span>Overnight Phone Curfew</span>
                </span>
                <span className="text-[#4A554E] block mt-0.5">
                  Keep phone charging outside the bedroom before lights out.
                </span>
              </div>
            </label>
          </section>
        </div>

        {/* Save Action */}
        <div className="space-y-2.5">
          <button
            id="save-night-battle-plan-button"
            type="button"
            onClick={handleSavePlan}
            className="w-full py-3.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-[#E6CFA3]" />
            <span>Lock In Tomorrow&apos;s Night Plan</span>
          </button>

          {savedSuccess && (
            <div className="p-2.5 rounded-lg bg-[#E8F3EC] border border-[#B7D7C2] text-[#14532D] text-xs font-semibold text-center flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Night plan saved to your study book.</span>
            </div>
          )}

          {formError && (
            <div className="p-2.5 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-semibold text-center">
              {formError}
            </div>
          )}
        </div>
      </article>
    </div>
  );
};
