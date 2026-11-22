import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  GraduationCap,
  Plus,
  RotateCcw,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AcademicProfile,
  DistractionSettings,
  ExamEntry,
  PreparationLevel,
} from '../types';
import { getFocusPlatformCapabilities } from '../services/academicEngines';

interface SettingsViewProps {
  profile: AcademicProfile;
  settings: DistractionSettings;
  onUpdateProfile: (profile: AcademicProfile) => void;
  onUpdateSettings: (settings: DistractionSettings) => void;
  onReplayOnboarding: () => void;
  onExportBackup: () => void;
  onResetCommandCenterData: () => void;
}

const EDUCATIONAL_APP_OPTIONS = [
  { id: 'youtube_edu', name: 'YouTube (Educational Channels)' },
  { id: 'khan_academy', name: 'Khan Academy' },
  { id: 'ncert_pdf', name: 'PDF / Textbook Reader' },
  { id: 'wikipedia', name: 'Wikipedia & Reference Docs' },
  { id: 'github_docs', name: 'GitHub & MDN Documentation' },
  { id: 'coursera_nptel', name: 'NPTEL / Coursera Lectures' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  settings,
  onUpdateProfile,
  onUpdateSettings,
  onReplayOnboarding,
  onExportBackup,
  onResetCommandCenterData,
}) => {
  const [savedBanner, setSavedBanner] = useState('');
  const [newExamSubject, setNewExamSubject] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [newExamPattern, setNewExamPattern] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const capabilities = getFocusPlatformCapabilities();
  const allowedEduApps = settings.allowedEducationalApps || [];

  const handleToggleAllowedApp = (id: string) => {
    const next = allowedEduApps.includes(id)
      ? allowedEduApps.filter((x) => x !== id)
      : [...allowedEduApps, id];
    onUpdateSettings({ ...settings, allowedEducationalApps: next });
  };

  const handleAddExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamSubject.trim() || !newExamDate) return;
    const exam: ExamEntry = {
      id: `exam-${Date.now()}`,
      subject: newExamSubject.trim(),
      examDate: newExamDate,
      universityOrBoard: profile.universityOrBoard || 'General',
      courseAndSemester: profile.courseAndSemester || 'Current Term',
      examPattern: newExamPattern.trim() || undefined,
    };
    onUpdateProfile({
      ...profile,
      exams: [...(profile.exams || []), exam],
      primarySubject: profile.primarySubject || exam.subject,
      upcomingExamDate: profile.upcomingExamDate || exam.examDate,
    });
    setNewExamSubject('');
    setNewExamDate('');
    setNewExamPattern('');
    setSavedBanner(`Added ${exam.subject} exam on ${exam.examDate}.`);
  };

  const handleRemoveExam = (id: string) => {
    onUpdateProfile({
      ...profile,
      exams: (profile.exams || []).filter((e) => e.id !== id),
    });
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E5DCCB]">
        <div className="text-xs font-medium text-[#8C6B32]">
          Academic Profile · Exam Calendar · Focus Policies · Data Backup
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight">
          Settings &amp; Platform Configuration
        </h1>
      </div>

      {savedBanner && (
        <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#14532D] font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {savedBanner}
          </span>
          <button
            type="button"
            onClick={() => setSavedBanner('')}
            className="underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Academic Profile & Daily Goals */}
      <section className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="font-serif text-lg font-semibold text-[#1C2420] flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#14532D]" />
          <span>Student Academic Profile</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-[#1C2420] mb-1">Student Name</label>
            <input
              type="text"
              value={profile.studentName || ''}
              onChange={(e) => onUpdateProfile({ ...profile, studentName: e.target.value })}
              placeholder="Optional greeting name"
              className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#1C2420] mb-1">
              University / Examination Board
            </label>
            <input
              type="text"
              value={profile.universityOrBoard}
              onChange={(e) => onUpdateProfile({ ...profile, universityOrBoard: e.target.value })}
              placeholder="e.g. CBSE, VTU, Delhi Univ"
              className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#1C2420] mb-1">Course &amp; Semester</label>
            <input
              type="text"
              value={profile.courseAndSemester}
              onChange={(e) => onUpdateProfile({ ...profile, courseAndSemester: e.target.value })}
              placeholder="e.g. B.Tech Sem 4"
              className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#1C2420] mb-1">
              Daily Available Study Hours
            </label>
            <input
              type="number"
              min={1}
              max={16}
              step={0.5}
              value={profile.dailyAvailableHours}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  dailyAvailableHours: Math.max(1, Number(e.target.value) || 4),
                })
              }
              className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#1C2420] mb-1">
              Daily Focus Timer Goal (Minutes)
            </label>
            <input
              type="number"
              min={30}
              max={720}
              step={15}
              value={settings.dailyFocusGoalMinutes || 240}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  dailyFocusGoalMinutes: Math.max(30, Number(e.target.value) || 240),
                })
              }
              className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#1C2420] mb-1">Preparation Stage</label>
            <select
              value={profile.preparationLevel}
              onChange={(e) =>
                onUpdateProfile({
                  ...profile,
                  preparationLevel: e.target.value as PreparationLevel,
                })
              }
              className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="revision_stage">Revision Stage</option>
              <option value="exam_week">Exam Week</option>
            </select>
          </div>
        </div>
      </section>

      {/* Upcoming Exams Manager */}
      <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="font-serif text-lg font-semibold text-[#1C2420]">Upcoming Exams</h2>

        <form onSubmit={handleAddExam} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
          <input
            type="text"
            required
            value={newExamSubject}
            onChange={(e) => setNewExamSubject(e.target.value)}
            placeholder="Subject name *"
            className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
          />
          <input
            type="date"
            required
            value={newExamDate}
            onChange={(e) => setNewExamDate(e.target.value)}
            className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2 font-mono"
          />
          <input
            type="text"
            value={newExamPattern}
            onChange={(e) => setNewExamPattern(e.target.value)}
            placeholder="Pattern (e.g. 70M Theory)"
            className="bg-[#F3ECE0] border border-[#D4C9B4] rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Exam</span>
          </button>
        </form>

        {(profile.exams || []).length > 0 && (
          <div className="divide-y divide-[#EAE2D3] border border-[#E5DCCB] rounded-xl overflow-hidden">
            {profile.exams.map((ex) => (
              <div
                key={ex.id}
                className="p-3 bg-[#F3ECE0] flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#1C2420]">{ex.subject}</span>
                  <span className="mx-2 text-[#8C6B32] font-mono tabular-nums">{ex.examDate}</span>
                  {ex.examPattern && <span className="text-[#5A655E]">· {ex.examPattern}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveExam(ex.id)}
                  className="text-[#7A847D] hover:text-[#991B1B]"
                  aria-label={`Remove ${ex.subject}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Allowed Educational Apps & Honest Platform Architecture Disclosure */}
      <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#1C2420] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#14532D]" />
            <span>Allowed Educational Apps &amp; Focus Platform Capabilities</span>
          </h2>
          <p className="text-xs text-[#4A554E] mt-1">
            Whitelist study platforms you legitimately use during study blocks. This configuration syncs cleanly with any future native Android wrapper.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {EDUCATIONAL_APP_OPTIONS.map((item) => {
            const allowed = allowedEduApps.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleToggleAllowedApp(item.id)}
                className={`p-3 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-colors ${
                  allowed
                    ? 'bg-[#E8F3EC] border-[#14532D]/40 text-[#14532D]'
                    : 'bg-[#F3ECE0] border-[#DDD3C1] text-[#5A655E]'
                }`}
              >
                <span>{item.name}</span>
                <span className="font-mono font-bold">{allowed ? 'Allowed' : 'Off'}</span>
              </button>
            );
          })}
        </div>

        {/* Transparent Web vs Native Android Capability Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 text-xs">
          <div className="p-4 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] space-y-2">
            <div className="font-semibold text-[#14532D]">
              Active Now in Web Browser (Implemented)
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[#4A554E]">
              {capabilities.supportedInBrowser.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <div className="font-semibold text-[#991B1B] pt-2">
              Browser Sandbox Limitations (Transparent)
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[#7F1D1D]">
              {capabilities.cannotDoInBrowser.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-[#0F291E] text-[#FAF6EE] border border-[#B08D57]/35 space-y-2">
            <div className="font-semibold text-[#E6CFA3] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>Native Android App Integration Architecture</span>
            </div>
            <p className="text-[11px] text-[#C8D4CC]">
              True OS-level app blocking cannot run inside a website. To enforce native Android app restrictions, wrap this app in Kotlin/Capacitor with:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#D6E0D9]">
              {capabilities.nativeAndroidIntegrationBoundary.requiredComponents.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Experience & Data Management */}
      <section className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onReplayOnboarding}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F291E] hover:bg-[#173D2D] text-[#FAF6EE] font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E6CFA3]" />
            <span>Replay 3D Study Desk Onboarding</span>
          </button>

          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FAF6EE] hover:bg-[#E7DEC9] border border-[#D4C9B4] text-[#1C2420] font-semibold"
          >
            <Download className="w-3.5 h-3.5 text-[#14532D]" />
            <span>Export JSON Backup</span>
          </button>
        </div>

        <div>
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[#991B1B] hover:bg-[#FEE2E2] font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Command Center Data</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[#991B1B] font-semibold">Reset syllabus, analyses &amp; revisions?</span>
              <button
                type="button"
                onClick={() => {
                  onResetCommandCenterData();
                  setConfirmReset(false);
                  setSavedBanner('Command Center academic records cleared (legacy tasks/sessions preserved).');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#991B1B] text-[#FAF6EE] font-semibold"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg bg-[#FAF6EE] text-[#4A554E] font-semibold"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
