import React, { useState, useRef } from 'react';
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Loader2,
  Printer,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AcademicProfile,
  PredictedPaper,
  PredictedQuestion,
  PredictedQuestionType,
  PreparationLevel,
  StrategistAnalysis,
  SyllabusUnit,
  UploadedAcademicDocument,
  UploadedDocCategory,
} from '../types';

interface StagedFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: UploadedDocCategory;
  paperYear: string;
  base64Data?: string;
  textContent?: string;
}

interface MasterStrategistViewProps {
  profile: AcademicProfile;
  onUpdateProfile: (profile: AcademicProfile) => void;
  syllabusUnits: SyllabusUnit[];
  analyses: StrategistAnalysis[];
  predictedPapers: PredictedPaper[];
  onSaveAnalysis: (
    analysis: StrategistAnalysis,
    uploadedMeta: UploadedAcademicDocument[]
  ) => void;
  onImportSyllabusFromAnalysis: (analysis: StrategistAnalysis) => void;
  onGeneratePlanFromAnalysis: (analysis: StrategistAnalysis) => void;
  onSavePredictedPaper: (paper: PredictedPaper) => void;
  onUpdatePredictedPaper: (paper: PredictedPaper) => void;
}

const DOC_CATEGORIES: Array<{ value: UploadedDocCategory; label: string }> = [
  { value: 'syllabus', label: 'University Syllabus' },
  { value: 'previous_year_paper', label: 'Previous-Year Paper' },
  { value: 'sample_paper', label: 'Sample Paper' },
  { value: 'model_paper', label: 'Model Paper' },
  { value: 'exam_pattern', label: 'Exam Pattern' },
  { value: 'study_notes', label: 'Study Notes' },
];

const QUESTION_TYPES: PredictedQuestionType[] = [
  'MCQ',
  'Definition',
  'Short Answer',
  'Long Answer',
  'Derivation',
  'Numerical',
  'Diagram-Based',
];

function readFileAsStaged(file: File): Promise<StagedFile> {
  return new Promise((resolve, reject) => {
    const isText =
      file.type.startsWith('text/') ||
      file.name.toLowerCase().endsWith('.txt') ||
      file.name.toLowerCase().endsWith('.md');

    const guessCategory = (): UploadedDocCategory => {
      const lower = file.name.toLowerCase();
      if (lower.includes('syllab')) return 'syllabus';
      if (lower.includes('sample')) return 'sample_paper';
      if (lower.includes('model')) return 'model_paper';
      if (lower.includes('pattern')) return 'exam_pattern';
      if (lower.includes('note')) return 'study_notes';
      if (/(201\d|202\d|pyq|paper|exam|question)/.test(lower)) return 'previous_year_paper';
      return 'syllabus';
    };

    const yearMatch = file.name.match(/(201\d|202\d)/);
    const reader = new FileReader();

    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));

    if (isText) {
      reader.onload = () => {
        resolve({
          id: `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mimeType: file.type || 'text/plain',
          sizeBytes: file.size,
          category: guessCategory(),
          paperYear: yearMatch ? yearMatch[1] : '',
          textContent: String(reader.result || ''),
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        const resultStr = String(reader.result || '');
        const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        resolve({
          id: `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mimeType: file.type || 'application/pdf',
          sizeBytes: file.size,
          category: guessCategory(),
          paperYear: yearMatch ? yearMatch[1] : '',
          base64Data,
        });
      };
      reader.readAsDataURL(file);
    }
  });
}

export const MasterStrategistView: React.FC<MasterStrategistViewProps> = ({
  profile,
  onUpdateProfile,
  syllabusUnits,
  analyses,
  predictedPapers,
  onSaveAnalysis,
  onImportSyllabusFromAnalysis,
  onGeneratePlanFromAnalysis,
  onSavePredictedPaper,
  onUpdatePredictedPaper,
}) => {
  const [subTab, setSubTab] = useState<'strategist' | 'predicted_paper'>('strategist');

  // Strategist Upload & Context Form State
  const [universityOrBoard, setUniversityOrBoard] = useState(profile.universityOrBoard || '');
  const [courseAndSemester, setCourseAndSemester] = useState(profile.courseAndSemester || '');
  const [subject, setSubject] = useState(profile.primarySubject || '');
  const [examYear, setExamYear] = useState(profile.examYear || String(new Date().getFullYear()));
  const [upcomingExamDate, setUpcomingExamDate] = useState(profile.upcomingExamDate || '');
  const [dailyAvailableHours, setDailyAvailableHours] = useState(profile.dailyAvailableHours || 4);
  const [preparationLevel, setPreparationLevel] = useState<PreparationLevel>(
    profile.preparationLevel || 'intermediate'
  );
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [pastedNotes, setPastedNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(analyses[0]?.id || '');
  const [importedBanner, setImportedBanner] = useState('');
  const [showExtractedPYQs, setShowExtractedPYQs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeAnalysis =
    analyses.find((a) => a.id === selectedAnalysisId) || analyses[0] || null;

  // Predicted Paper Generator State
  const [paperSubject, setPaperSubject] = useState(
    activeAnalysis?.subject || profile.primarySubject || ''
  );
  const [examPattern, setExamPattern] = useState(
    'University End-Semester (Section A: Short/MCQ, Section B: Derivations/Medium, Section C: Long/Numericals)'
  );
  const [totalMarks, setTotalMarks] = useState(70);
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [paperDifficulty, setPaperDifficulty] = useState<
    'easy' | 'moderate' | 'challenging' | 'exam_standard'
  >('exam_standard');
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<PredictedQuestionType[]>([
    'Short Answer',
    'Long Answer',
    'Derivation',
    'Numerical',
  ]);
  const [selectedUnitNames, setSelectedUnitNames] = useState<string[]>([]);
  const [generatingPaper, setGeneratingPaper] = useState(false);
  const [paperError, setPaperError] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string>(predictedPapers[0]?.id || '');
  const [showAnswers, setShowAnswers] = useState<boolean>(false);
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null);

  const activePaper =
    predictedPapers.find((p) => p.id === selectedPaperId) || predictedPapers[0] || null;

  const availableUnitsForPaper = syllabusUnits
    .filter(
      (u) =>
        !paperSubject.trim() || u.subject.toLowerCase().includes(paperSubject.trim().toLowerCase())
    )
    .map((u) => `Unit ${u.unitNumber}: ${u.title}`);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setAnalysisError('');

    const nextFiles: StagedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.size > 15 * 1024 * 1024) {
        setAnalysisError(`"${f.name}" exceeds 15 MB. Please upload a smaller file.`);
        continue;
      }
      try {
        const staged = await readFileAsStaged(f);
        nextFiles.push(staged);
      } catch (err: any) {
        setAnalysisError(err?.message || `Could not read ${f.name}`);
      }
    }

    setStagedFiles((prev) => [...prev, ...nextFiles].slice(0, 8));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalysisError('');
    setImportedBanner('');

    if (!subject.trim()) {
      setAnalysisError('Please enter the subject name before running Master Strategist.');
      return;
    }
    if (stagedFiles.length === 0 && pastedNotes.trim().length < 20) {
      setAnalysisError(
        'Upload at least one PDF, image, or text file — or paste syllabus / question paper text (20+ chars).'
      );
      return;
    }

    // Sync profile metadata
    onUpdateProfile({
      ...profile,
      universityOrBoard: universityOrBoard.trim() || profile.universityOrBoard,
      courseAndSemester: courseAndSemester.trim() || profile.courseAndSemester,
      primarySubject: subject.trim(),
      examYear: examYear.trim() || profile.examYear,
      upcomingExamDate: upcomingExamDate || profile.upcomingExamDate,
      dailyAvailableHours: Number(dailyAvailableHours) || profile.dailyAvailableHours,
      preparationLevel,
    });

    setAnalyzing(true);
    try {
      const res = await fetch('/api/academic/analyze-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universityOrBoard,
          courseAndSemester,
          subject: subject.trim(),
          examYear,
          upcomingExamDate,
          dailyAvailableHours,
          preparationLevel,
          pastedNotes,
          files: stagedFiles.map((f) => ({
            name: f.name,
            mimeType: f.mimeType,
            category: f.category,
            paperYear: f.paperYear,
            base64Data: f.base64Data,
            textContent: f.textContent,
          })),
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Analysis failed. Please try again.');
      }

      const result: StrategistAnalysis = payload.data;
      const uploadedMeta: UploadedAcademicDocument[] = stagedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        category: f.category,
        paperYear: f.paperYear || undefined,
        subject: subject.trim(),
        uploadedAt: new Date().toISOString(),
      }));

      onSaveAnalysis(result, uploadedMeta);
      setSelectedAnalysisId(result.id);
      setPaperSubject(result.subject);
      setStagedFiles([]);
    } catch (err: any) {
      setAnalysisError(err?.message || 'Document analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGeneratePredictedPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaperError('');
    if (!paperSubject.trim()) {
      setPaperError('Please enter a subject for the predicted paper.');
      return;
    }

    setGeneratingPaper(true);
    try {
      const relevantAnalysis =
        analyses.find(
          (a) => a.subject.toLowerCase() === paperSubject.trim().toLowerCase()
        ) || activeAnalysis;

      const unitListText = syllabusUnits
        .filter((u) => u.subject.toLowerCase() === paperSubject.trim().toLowerCase())
        .map(
          (u) =>
            `Unit ${u.unitNumber}: ${u.title} (${u.topics.map((t) => t.title).join(', ')})`
        )
        .join('\n');

      const syllabusContext = [relevantAnalysis?.sourceContextDigest, unitListText]
        .filter(Boolean)
        .join('\n\n');

      const frequencySummary = relevantAnalysis?.topicFrequencyTable
        ?.slice(0, 15)
        .map((r) => `${r.topic} [${r.unit}]: ${r.frequencySummary} (${r.marksObserved})`)
        .join('\n');

      const res = await fetch('/api/academic/predict-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: paperSubject.trim(),
          examPattern,
          totalMarks,
          durationMinutes,
          units: selectedUnitNames,
          difficulty: paperDifficulty,
          questionCount,
          questionTypes: selectedQuestionTypes,
          syllabusContext,
          frequencySummary,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to generate predicted paper.');
      }

      const paper: PredictedPaper = payload.data;
      onSavePredictedPaper(paper);
      setSelectedPaperId(paper.id);
      setShowAnswers(false);
    } catch (err: any) {
      setPaperError(err?.message || 'Failed to generate predicted paper.');
    } finally {
      setGeneratingPaper(false);
    }
  };

  const handleRegenerateSingleQuestion = async (q: PredictedQuestion) => {
    if (!activePaper) return;
    setRegeneratingQuestionId(q.id);
    setPaperError('');
    try {
      const res = await fetch('/api/academic/regenerate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: activePaper.subject,
          section: q.section,
          questionNumber: q.questionNumber,
          unit: q.unit,
          topic: q.topic,
          questionType: q.questionType,
          marks: q.marks,
          difficulty: q.difficulty,
          previousQuestionText: q.questionText,
          syllabusContext: activeAnalysis?.sourceContextDigest,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Could not regenerate question.');
      }

      const replacement: PredictedQuestion = payload.data;
      const updatedPaper: PredictedPaper = {
        ...activePaper,
        questions: activePaper.questions.map((item) =>
          item.id === q.id ? replacement : item
        ),
      };
      onUpdatePredictedPaper(updatedPaper);
    } catch (err: any) {
      setPaperError(err?.message || 'Failed to regenerate question.');
    } finally {
      setRegeneratingQuestionId(null);
    }
  };

  const toggleQuestionType = (qt: PredictedQuestionType) => {
    setSelectedQuestionTypes((prev) =>
      prev.includes(qt)
        ? prev.length > 1
          ? prev.filter((item) => item !== qt)
          : prev
        : [...prev, qt]
    );
  };

  const toggleUnitForPaper = (unitLabel: string) => {
    setSelectedUnitNames((prev) =>
      prev.includes(unitLabel) ? prev.filter((u) => u !== unitLabel) : [...prev, unitLabel]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tab Switcher */}
      <div className="no-print flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E5DCCB]">
        <div>
          <div className="text-xs font-medium text-[#8C6B32]">
            Academic Intelligence Engine · Traceable Source Verification
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2420] mt-1 tracking-tight">
            AI Master Strategist &amp; Predicted Papers
          </h1>
        </div>

        <div className="inline-flex bg-[#F2ECE0] p-1 rounded-lg border border-[#DDD3C1] text-xs self-start">
          <button
            id="strategist-tab-analysis"
            type="button"
            onClick={() => setSubTab('strategist')}
            className={`px-3.5 py-2 rounded-md font-semibold transition-colors whitespace-nowrap ${
              subTab === 'strategist'
                ? 'bg-[#0F291E] text-[#FAF6EE]'
                : 'text-[#4A554E] hover:text-[#1C2420]'
            }`}
          >
            Syllabus &amp; PYQ Strategist
          </button>
          <button
            id="strategist-tab-predicted"
            type="button"
            onClick={() => setSubTab('predicted_paper')}
            className={`px-3.5 py-2 rounded-md font-semibold transition-colors whitespace-nowrap ${
              subTab === 'predicted_paper'
                ? 'bg-[#0F291E] text-[#FAF6EE]'
                : 'text-[#4A554E] hover:text-[#1C2420]'
            }`}
          >
            AI Predicted Paper Generator
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: AI MASTER STRATEGIST ==================== */}
      {subTab === 'strategist' && (
        <div className="space-y-6">
          {/* Upload & Exam Context Panel */}
          <form
            onSubmit={handleAnalyze}
            className="bg-[#F3ECE0] border border-[#DDD3C1] rounded-2xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-lg font-semibold text-[#1C2420] flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#14532D]" />
                  <span>Upload University Syllabus, PYQs &amp; Exam Materials</span>
                </h2>
                <p className="text-xs text-[#4A554E] mt-0.5">
                  Supports PDFs, question paper images (PNG/JPG/WebP), and text notes (up to 8 files, 15 MB each).
                </p>
              </div>
              {analyses.length > 0 && (
                <select
                  value={activeAnalysis?.id || ''}
                  onChange={(e) => setSelectedAnalysisId(e.target.value)}
                  className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5 text-xs text-[#1C2420]"
                  aria-label="Select saved analysis"
                >
                  {analyses.map((a) => (
                    <option key={a.id} value={a.id}>
                      Saved: {a.subject} ({new Date(a.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Academic Context Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">Subject *</label>
                <input
                  id="strategist-subject-input"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Operating Systems, Physics"
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">
                  University / Board
                </label>
                <input
                  type="text"
                  value={universityOrBoard}
                  onChange={(e) => setUniversityOrBoard(e.target.value)}
                  placeholder="e.g. AKTU, Anna Univ, CBSE"
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
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
                  placeholder="e.g. B.Tech CSE Sem 4"
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">Exam Year</label>
                <input
                  type="text"
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                  placeholder="e.g. 2026"
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono"
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
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">
                  Daily Study Hours
                </label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  step={0.5}
                  value={dailyAvailableHours}
                  onChange={(e) => setDailyAvailableHours(Number(e.target.value))}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420] font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#1C2420] mb-1">
                  Current Preparation Level
                </label>
                <select
                  value={preparationLevel}
                  onChange={(e) => setPreparationLevel(e.target.value as PreparationLevel)}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                >
                  <option value="beginner">Beginner — Starting from scratch</option>
                  <option value="intermediate">Intermediate — Covered 30–60% syllabus</option>
                  <option value="revision_stage">Revision Stage — Focusing on retention &amp; PYQs</option>
                  <option value="exam_week">Exam Week — High-yield sprint &amp; recall</option>
                </select>
              </div>
            </div>

            {/* File Dropzone + Staged File List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-[#1C2420]">
                  Attach Syllabus PDFs, Past Papers &amp; Images
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/webp,.txt,.md"
                  onChange={handleFilePick}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-5 rounded-xl border-2 border-dashed border-[#B08D57] bg-[#FAF6EE] hover:bg-[#F7F1E4] transition-colors flex flex-col items-center justify-center gap-2 text-center"
                >
                  <Upload className="w-5 h-5 text-[#14532D]" />
                  <span className="text-xs font-semibold text-[#1C2420]">
                    Click to select PDFs, Question Paper Photos, or TXT/MD files
                  </span>
                  <span className="text-[11px] text-[#5A655E]">
                    Tag each file’s type and paper year below for verified recurrence tracking
                  </span>
                </button>

                {stagedFiles.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {stagedFiles.map((sf) => (
                      <div
                        key={sf.id}
                        className="p-2.5 rounded-lg bg-[#FAF6EE] border border-[#D8CEBC] flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="w-4 h-4 text-[#14532D] shrink-0" />
                          <span className="font-medium text-[#1C2420] truncate">{sf.name}</span>
                          <span className="text-[10px] font-mono text-[#5A655E] shrink-0">
                            {(sf.sizeBytes / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={sf.category}
                            onChange={(e) =>
                              setStagedFiles((prev) =>
                                prev.map((item) =>
                                  item.id === sf.id
                                    ? { ...item, category: e.target.value as UploadedDocCategory }
                                    : item
                                )
                              )
                            }
                            className="bg-[#F3ECE0] border border-[#D4C9B4] rounded px-2 py-1 text-[11px]"
                          >
                            {DOC_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={sf.paperYear}
                            onChange={(e) =>
                              setStagedFiles((prev) =>
                                prev.map((item) =>
                                  item.id === sf.id ? { ...item, paperYear: e.target.value } : item
                                )
                              )
                            }
                            placeholder="Year"
                            className="w-16 bg-[#F3ECE0] border border-[#D4C9B4] rounded px-2 py-1 text-[11px] font-mono"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setStagedFiles((prev) => prev.filter((item) => item.id !== sf.id))
                            }
                            className="p-1 text-[#6B756F] hover:text-[#991B1B]"
                            aria-label={`Remove ${sf.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C2420]">
                  Or Paste Syllabus / Previous-Year Questions Directly
                </label>
                <textarea
                  id="strategist-pasted-notes"
                  rows={6}
                  value={pastedNotes}
                  onChange={(e) => setPastedNotes(e.target.value)}
                  placeholder="Paste unit-wise syllabus text, exam pattern, or questions from past papers here..."
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-xl p-3 text-xs text-[#1C2420] placeholder-[#7A847D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                />
              </div>
            </div>

            {analysisError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] font-medium">
                {analysisError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E0D6C4]">
              <p className="text-[11px] text-[#5A655E]">
                Every frequency statistic is verified strictly from your uploaded papers. Missing papers are explicitly flagged.
              </p>
              <button
                id="run-master-strategist-button"
                type="submit"
                disabled={analyzing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Documents &amp; Mapping PYQs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#E6CFA3]" />
                    <span>Run AI Master Strategist</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Analysis Report Output */}
          {activeAnalysis && (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="bg-[#0F291E] text-[#FAF6EE] rounded-2xl p-5 border border-[#B08D57]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[#E6CFA3] font-medium">
                    Strategy Report · {activeAnalysis.universityOrBoard} · {activeAnalysis.courseAndSemester}
                  </div>
                  <h2 className="font-serif text-xl font-semibold mt-0.5">
                    {activeAnalysis.subject} — Exam Master Strategy
                  </h2>
                  <p className="text-xs text-[#C8D4CC] mt-1 max-w-2xl">
                    {activeAnalysis.personalizedExamPlanSummary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    id="import-syllabus-from-analysis-btn"
                    type="button"
                    onClick={() => {
                      onImportSyllabusFromAnalysis(activeAnalysis);
                      setImportedBanner(
                        `Imported ${activeAnalysis.extractedSyllabusUnits.length} syllabus units for ${activeAnalysis.subject} into My Syllabus.`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#8C6B32] hover:bg-[#A17C3D] text-[#FAF6EE] text-xs font-semibold transition-colors"
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>Import into My Syllabus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onGeneratePlanFromAnalysis(activeAnalysis);
                      setImportedBanner(
                        `Imported syllabus & built today’s study plan for ${activeAnalysis.subject}. Check Study Planner.`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#173D2D] hover:bg-[#1E4F3A] text-[#FAF6EE] text-xs font-medium transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#E6CFA3]" />
                    <span>Import &amp; Build Daily Plan</span>
                  </button>
                </div>
              </div>

              {importedBanner && (
                <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#14532D] font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importedBanner}</span>
                </div>
              )}

              {/* Explicit Limitations & Transparency Callout */}
              {activeAnalysis.limitationsAndWarnings.length > 0 && (
                <div className="p-4 rounded-xl bg-[#FEF9EC] border border-[#E5C98B] space-y-1.5">
                  <div className="text-xs font-semibold text-[#8C6B32] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Source Completeness &amp; Verification Notes</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-[#594A29]">
                    {activeAnalysis.limitationsAndWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Topic Frequency Analysis Table */}
              <section className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-2xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-[#E5DCCB] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-[#1C2420]">
                      Topic Frequency &amp; Importance Analysis
                    </h3>
                    <p className="text-xs text-[#5A655E] mt-0.5">
                      Uploaded question papers analyzed:{' '}
                      <strong className="font-mono text-[#1C2420]">
                        {activeAnalysis.totalUploadedPapers}
                      </strong>{' '}
                      · Verified recurrence is separated from AI-estimated importance.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F2ECE0] border-b border-[#DDD3C1] text-[#4A554E]">
                        <th className="py-2.5 px-3 font-semibold">Topic</th>
                        <th className="py-2.5 px-3 font-semibold">Unit</th>
                        <th className="py-2.5 px-3 font-semibold">Years Appeared</th>
                        <th className="py-2.5 px-3 font-semibold">Frequency &amp; Basis</th>
                        <th className="py-2.5 px-3 font-semibold">Marks Observed</th>
                        <th className="py-2.5 px-3 font-semibold">Priority</th>
                        <th className="py-2.5 px-3 font-semibold">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE2D3]">
                      {activeAnalysis.topicFrequencyTable.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#F7F2E7] align-top">
                          <td className="py-3 px-3 font-semibold text-[#1C2420]">
                            <div>{row.topic}</div>
                            {row.evidenceSourceRefs.length > 0 && (
                              <div className="text-[10px] font-mono text-[#5A655E] font-normal mt-0.5">
                                Sources: {row.evidenceSourceRefs.join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[#4A554E]">{row.unit}</td>
                          <td className="py-3 px-3 font-mono text-[#1C2420] tabular-nums">
                            {row.yearsAppeared.length > 0 ? row.yearsAppeared.join(', ') : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-[#1C2420]">{row.frequencySummary}</div>
                            <div
                              className={`text-[10px] font-semibold mt-0.5 ${
                                row.basis === 'verified_from_uploaded_papers'
                                  ? 'text-[#14532D]'
                                  : 'text-[#8C6B32]'
                              }`}
                            >
                              {row.basis === 'verified_from_uploaded_papers'
                                ? 'Verified from uploaded papers'
                                : 'AI-estimated from syllabus'}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[#4A554E] tabular-nums">
                            {row.marksObserved}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-semibold uppercase text-[10px] ${
                                row.priority === 'critical'
                                  ? 'text-[#991B1B]'
                                  : row.priority === 'high'
                                  ? 'text-[#8C6B32]'
                                  : row.priority === 'medium'
                                  ? 'text-[#14532D]'
                                  : 'text-[#5A655E]'
                              }`}
                            >
                              {row.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3 capitalize text-[#4A554E]">{row.confidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Priority Tiers (Never advise skipping lower-priority topics) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#DDD3C1] space-y-2">
                  <h4 className="font-serif text-sm font-semibold text-[#991B1B]">
                    High-Priority Topics
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#1C2420]">
                    {activeAnalysis.highPriorityTopics.map((t, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono text-[#991B1B] font-bold">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#DDD3C1] space-y-2">
                  <h4 className="font-serif text-sm font-semibold text-[#8C6B32]">
                    Medium-Priority Topics
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#1C2420]">
                    {activeAnalysis.mediumPriorityTopics.map((t, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono text-[#8C6B32] font-bold">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#DDD3C1] space-y-2">
                  <h4 className="font-serif text-sm font-semibold text-[#14532D]">
                    Lower-Priority (Cover Core Definitions)
                  </h4>
                  <p className="text-[11px] text-[#5A655E]">
                    Do not skip entirely — secure fundamental definitions &amp; short-answer points after high-priority mastery.
                  </p>
                  <ul className="space-y-1.5 text-xs text-[#1C2420]">
                    {activeAnalysis.lowerPriorityTopics.map((t, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono text-[#14532D] font-bold">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Derivations/Diagrams, Numericals, and Repeated Patterns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] space-y-2">
                  <h4 className="font-serif text-sm font-semibold text-[#1C2420]">
                    Recurring Question Patterns
                  </h4>
                  {activeAnalysis.frequentlyRepeatedQuestions.length === 0 ? (
                    <p className="text-xs text-[#5A655E]">
                      Upload multiple past papers to identify recurring question patterns.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeAnalysis.frequentlyRepeatedQuestions.map((item, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-[#FAF6EE] border border-[#E5DCCB] text-xs"
                        >
                          <div className="font-medium text-[#1C2420]">{item.pattern}</div>
                          <div className="text-[11px] text-[#5A655E] mt-0.5">
                            {item.occurrences} ·{' '}
                            <span className="font-semibold text-[#14532D]">
                              {item.basis === 'verified' ? 'Verified' : 'AI-Estimated'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] space-y-2">
                  <h4 className="font-serif text-sm font-semibold text-[#1C2420]">
                    Important Derivations &amp; Diagrams
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#1C2420]">
                    {activeAnalysis.importantDerivationsAndDiagrams.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#F3ECE0] border border-[#DDD3C1] space-y-2">
                  <h4 className="font-serif text-sm font-semibold text-[#1C2420]">
                    Important Numerical / Applied Problems
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#1C2420]">
                    {activeAnalysis.importantNumericalProblems.map((n, i) => (
                      <li key={i}>• {n}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Study Sequence & Unit Strategy + Last-Minute Revision */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-[#FAF6EE] border border-[#DDD3C1] space-y-3">
                  <h4 className="font-serif text-base font-semibold text-[#1C2420]">
                    Recommended Prerequisite Study Sequence
                  </h4>
                  <div className="space-y-2">
                    {activeAnalysis.recommendedStudySequence.map((s) => (
                      <div
                        key={s.step}
                        className="p-3 rounded-lg bg-[#F3ECE0] border border-[#E5DCCB] flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[#1C2420]">
                            <span className="font-mono text-[#14532D] mr-1.5">#{s.step}</span>
                            {s.topic}
                          </div>
                          <div className="text-[11px] text-[#5A655E] mt-0.5">
                            {s.unit} — {s.reason}
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-[#8C6B32] shrink-0 tabular-nums">
                          {s.estimatedHours}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-[#FAF6EE] border border-[#DDD3C1] space-y-3">
                    <h4 className="font-serif text-base font-semibold text-[#1C2420]">
                      Unit-Wise Preparation Strategy
                    </h4>
                    <div className="space-y-2">
                      {activeAnalysis.unitWiseStrategy.map((u, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-[#F3ECE0] border border-[#E5DCCB] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold text-[#1C2420]">
                            <span>
                              {u.recommendedOrder}. {u.unit}
                            </span>
                            <span className="font-mono text-[#14532D] tabular-nums">
                              ~{u.focusAllocationHours}h
                            </span>
                          </div>
                          <p className="text-[#4A554E]">{u.strategy}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-[#0F291E] text-[#FAF6EE] border border-[#B08D57]/35 space-y-2">
                    <h4 className="font-serif text-sm font-semibold text-[#E6CFA3]">
                      Last-Minute Revision Strategy
                    </h4>
                    <ul className="space-y-1.5 text-xs text-[#D6E0D9]">
                      {activeAnalysis.lastMinuteRevisionStrategy.map((tip, i) => (
                        <li key={i}>• {tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Expandable Extracted PYQs Audit Log */}
              {activeAnalysis.extractedQuestions.length > 0 && (
                <div className="bg-[#FAF6EE] border border-[#DDD3C1] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowExtractedPYQs(!showExtractedPYQs)}
                    className="w-full p-4 flex items-center justify-between text-xs font-semibold text-[#1C2420] hover:bg-[#F3ECE0] transition-colors"
                  >
                    <span>
                      Extracted Previous-Year Questions Audit ({activeAnalysis.extractedQuestions.length}{' '}
                      questions mapped)
                    </span>
                    {showExtractedPYQs ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {showExtractedPYQs && (
                    <div className="p-4 pt-0 space-y-2 border-t border-[#E5DCCB]">
                      {activeAnalysis.extractedQuestions.map((q, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-[#F3ECE0] text-xs space-y-1"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#5A655E]">
                            <span>
                              {q.sourceFile} · {q.paperYear} · {q.questionRef}
                            </span>
                            <span className="text-[#14532D] font-semibold">
                              {q.mappedTopic} ({q.marksObserved})
                            </span>
                          </div>
                          <div className="text-[#1C2420]">{q.questionText}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: AI PREDICTED PAPER GENERATOR ==================== */}
      {subTab === 'predicted_paper' && (
        <div className="space-y-6">
          {/* Paper Configuration Form */}
          <form
            onSubmit={handleGeneratePredictedPaper}
            className="no-print bg-[#F3ECE0] border border-[#DDD3C1] rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-lg font-semibold text-[#1C2420]">
                  Configure AI Predicted Practice Examination Paper
                </h2>
                <p className="text-xs text-[#4A554E]">
                  Generates a structured exam paper with Answer Key, Model Answers, and per-question regeneration.
                </p>
              </div>
              {predictedPapers.length > 0 && (
                <select
                  value={activePaper?.id || ''}
                  onChange={(e) => setSelectedPaperId(e.target.value)}
                  className="bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-1.5 text-xs text-[#1C2420]"
                  aria-label="Select saved predicted paper"
                >
                  {predictedPapers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.subject} · {p.totalMarks}M ({new Date(p.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">Subject *</label>
                <input
                  id="predicted-paper-subject"
                  type="text"
                  required
                  value={paperSubject}
                  onChange={(e) => setPaperSubject(e.target.value)}
                  placeholder="e.g. Data Structures"
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#1C2420] mb-1">
                  Examination Pattern
                </label>
                <input
                  type="text"
                  value={examPattern}
                  onChange={(e) => setExamPattern(e.target.value)}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">Difficulty</label>
                <select
                  value={paperDifficulty}
                  onChange={(e) => setPaperDifficulty(e.target.value as any)}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 text-[#1C2420]"
                >
                  <option value="easy">Easy / Foundation</option>
                  <option value="moderate">Moderate</option>
                  <option value="exam_standard">Exam Standard</option>
                  <option value="challenging">Challenging / Distinction</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">Total Marks</label>
                <input
                  type="number"
                  min={10}
                  max={200}
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(Number(e.target.value))}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 font-mono text-[#1C2420]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={15}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 font-mono text-[#1C2420]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#1C2420] mb-1">
                  Number of Questions
                </label>
                <input
                  type="number"
                  min={3}
                  max={25}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-[#FAF6EE] border border-[#D4C9B4] rounded-lg px-3 py-2 font-mono text-[#1C2420]"
                />
              </div>
            </div>

            {/* Question Types Selection */}
            <div className="space-y-1.5 text-xs">
              <div className="font-semibold text-[#1C2420]">Question Types to Include</div>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPES.map((qt) => {
                  const active = selectedQuestionTypes.includes(qt);
                  return (
                    <button
                      key={qt}
                      type="button"
                      onClick={() => toggleQuestionType(qt)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        active
                          ? 'bg-[#0F291E] text-[#FAF6EE] border-[#0F291E]'
                          : 'bg-[#FAF6EE] text-[#4A554E] border-[#D4C9B4] hover:border-[#8C6B32]'
                      }`}
                    >
                      {qt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Syllabus Units Selector */}
            {availableUnitsForPaper.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <div className="font-semibold text-[#1C2420]">
                  Units to Include (leave unselected for full syllabus)
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableUnitsForPaper.map((uLabel) => {
                    const checked = selectedUnitNames.includes(uLabel);
                    return (
                      <button
                        key={uLabel}
                        type="button"
                        onClick={() => toggleUnitForPaper(uLabel)}
                        className={`px-3 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                          checked
                            ? 'bg-[#14532D] text-[#FAF6EE] border-[#14532D]'
                            : 'bg-[#FAF6EE] text-[#4A554E] border-[#D4C9B4]'
                        }`}
                      >
                        {uLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {paperError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                {paperError}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#E0D6C4]">
              <button
                id="generate-predicted-paper-btn"
                type="submit"
                disabled={generatingPaper}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#14532D] hover:bg-[#0F3F22] text-[#FAF6EE] text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {generatingPaper ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Examination Paper...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#E6CFA3]" />
                    <span>Generate AI Predicted Paper</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Rendered Printable Examination Paper */}
          {activePaper && (
            <div className="print-paper-sheet bg-[#FAF6EE] border border-[#C9BFA9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
              {/* Mandatory Academic Honesty Disclaimer */}
              <div className="p-3.5 rounded-xl bg-[#FEF9EC] border border-[#E5C98B] text-xs text-[#594A29] flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#8C6B32] mt-0.5 shrink-0" />
                <span>{activePaper.disclaimer}</span>
              </div>

              {/* Paper Masthead */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-[#1C2420]">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#8C6B32] font-semibold">
                    AI-Generated Practice &amp; Predicted Paper
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-[#1C2420] mt-1">
                    {activePaper.subject}
                  </h2>
                  <p className="text-xs text-[#4A554E] mt-0.5">{activePaper.examPattern}</p>
                </div>

                <div className="text-left sm:text-right font-mono text-xs text-[#1C2420] space-y-1 shrink-0 tabular-nums">
                  <div>
                    <strong>Max Marks:</strong> {activePaper.totalMarks}
                  </div>
                  <div>
                    <strong>Duration:</strong> {activePaper.durationMinutes} mins
                  </div>
                  <div className="capitalize">
                    <strong>Level:</strong> {activePaper.difficulty.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* Controls (Hidden in Print) */}
              <div className="no-print flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[#5A655E]">
                  {activePaper.questions.length} questions · Click Regenerate on any question to replace it individually.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAnswers(!showAnswers)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-xs font-semibold text-[#1C2420]"
                  >
                    {showAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showAnswers ? 'Hide Model Answers' : 'Show Answer Key & Model Answers'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F291E] hover:bg-[#173D2D] text-[#FAF6EE] text-xs font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#E6CFA3]" />
                    <span>Print Paper</span>
                  </button>
                </div>
              </div>

              {/* Marks Distribution & Topic Coverage Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F3ECE0] border border-[#E2D8C6]">
                  <div className="font-semibold text-[#1C2420] mb-2">Marks Distribution</div>
                  <div className="space-y-1 font-mono tabular-nums">
                    {activePaper.marksDistribution.map((md, idx) => (
                      <div key={idx} className="flex justify-between text-[#4A554E]">
                        <span>{md.section}</span>
                        <span>
                          {md.questionCount} × {md.marksPerQuestion}M = {md.totalMarks}M
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F3ECE0] border border-[#E2D8C6]">
                  <div className="font-semibold text-[#1C2420] mb-2">Topic Coverage</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[#4A554E]">
                    {activePaper.topicCoverage.map((tc, idx) => (
                      <span key={idx}>
                        {tc.topic} (<strong className="font-mono">{tc.marks}M</strong>)
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {activePaper.questions.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2D8C6] space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#5A655E]">
                        <span className="font-bold text-[#14532D]">{q.section}</span>
                        <span>·</span>
                        <span className="font-bold text-[#1C2420]">{q.questionNumber}</span>
                        <span>·</span>
                        <span>{q.questionType}</span>
                        <span>·</span>
                        <span>{q.unit} — {q.topic}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#8C6B32] tabular-nums">
                          [{q.marks} Marks]
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingleQuestion(q)}
                          disabled={regeneratingQuestionId === q.id}
                          className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F2ECE0] hover:bg-[#E7DEC9] border border-[#DDD3C1] text-[11px] font-medium text-[#1C2420] disabled:opacity-50"
                          title="Regenerate this question only"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${
                              regeneratingQuestionId === q.id ? 'animate-spin' : ''
                            }`}
                          />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-[#1C2420] leading-relaxed font-medium">
                      {q.questionText}
                    </p>

                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2 text-xs text-[#37423B]">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx}>
                            <strong className="font-mono mr-1.5">
                              {String.fromCharCode(65 + oIdx)}.
                            </strong>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-[11px] text-[#6B756F] italic">
                      Practice Basis: {q.basisNote}
                    </div>

                    {showAnswers && (
                      <div className="mt-2 pt-3 border-t border-[#EAE2D3] space-y-2 text-xs">
                        <div>
                          <span className="font-semibold text-[#14532D]">Answer Key: </span>
                          <span className="text-[#1C2420]">{q.answerKey}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#F7F3EA] border border-[#E5DCCB]">
                          <div className="font-semibold text-[#8C6B32] mb-1">
                            Model Answer &amp; Marking Checkpoints
                          </div>
                          <div className="text-[#1C2420] whitespace-pre-line leading-relaxed">
                            {q.modelAnswer}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
