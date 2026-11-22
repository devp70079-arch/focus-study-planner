import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

export const PROMPT_VERSION = "2026.1";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export function withTimeout<T>(promise: Promise<T>, ms = 45000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export function safeParseJson(rawText: string | undefined): any {
  if (!rawText) return {};
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (_err) {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      return JSON.parse(match[1]);
    }
    throw new Error(`Failed to parse AI JSON output: ${cleaned.slice(0, 120)}...`);
  }
}

export async function generateWithGemini(params: {
  contents: any;
  config?: any;
  timeoutMs?: number;
}) {
  const timeoutMs = params.timeoutMs || 45000;
  const candidateModels = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }

  for (const model of candidateModels) {
    try {
      const mergedConfig = { ...(params.config || {}) };
      if (!mergedConfig.thinkingConfig) {
        mergedConfig.thinkingConfig = {
          thinkingLevel:
            model === "gemini-3.1-flash-lite"
              ? ThinkingLevel.MINIMAL
              : ThinkingLevel.LOW,
        };
      }

      return await withTimeout(
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: mergedConfig,
        }),
        timeoutMs
      );
    } catch (err: any) {
      lastError = err;
      const is503 =
        err?.status === 503 ||
        err?.code === 503 ||
        String(err?.message || "").includes("503") ||
        String(err?.message || "").includes("high demand");
      const isTimeout = String(err?.message || "").includes("Timeout");

      console.warn(
        `Gemini model ${model} failed (${
          is503 ? "503 high demand" : isTimeout ? "timed out" : err.message || "error"
        }), attempting next fallback...`
      );

      if (is503) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }

  throw lastError || new Error("All Gemini models failed or timed out");
}

export interface UploadedFileInput {
  name: string;
  mimeType: string;
  category:
    | "syllabus"
    | "previous_year_paper"
    | "sample_paper"
    | "model_paper"
    | "exam_pattern"
    | "study_notes";
  paperYear?: string;
  base64Data?: string;
  textContent?: string;
}

const SUPPORTED_INLINE_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function buildMultimodalDocumentParts(files: UploadedFileInput[]): {
  parts: any[];
  skippedNotes: string[];
} {
  const parts: any[] = [];
  const skippedNotes: string[] = [];

  for (const file of files) {
    const label = `[DOCUMENT: "${file.name}" | category=${file.category} | paperYear=${
      file.paperYear || "not specified"
    }]`;

    if (file.textContent && file.textContent.trim().length > 0) {
      parts.push({
        text: `${label}\n${file.textContent.slice(0, 40000)}`,
      });
      continue;
    }

    if (file.base64Data) {
      const normalizedMime = file.mimeType === "image/jpg" ? "image/jpeg" : file.mimeType;
      if (SUPPORTED_INLINE_MIMES.has(normalizedMime)) {
        parts.push({ text: label });
        parts.push({
          inlineData: {
            mimeType: normalizedMime,
            data: file.base64Data,
          },
        });
      } else if (
        normalizedMime.startsWith("text/") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".md")
      ) {
        const decoded = Buffer.from(file.base64Data, "base64").toString("utf-8");
        parts.push({ text: `${label}\n${decoded.slice(0, 40000)}` });
      } else {
        skippedNotes.push(
          `File "${file.name}" (${file.mimeType}) could not be parsed directly; upload PDF, PNG/JPG/WebP, or TXT/MD.`
        );
      }
    }
  }

  return { parts, skippedNotes };
}

export async function analyzeAcademicDocuments(input: {
  universityOrBoard: string;
  courseAndSemester: string;
  subject: string;
  examYear: string;
  upcomingExamDate: string;
  dailyAvailableHours: number;
  preparationLevel: string;
  pastedNotes?: string;
  files: UploadedFileInput[];
}) {
  const paperCategories = new Set(["previous_year_paper", "sample_paper", "model_paper"]);
  const uploadedPaperCount = input.files.filter((f) => paperCategories.has(f.category)).length;
  const hasSyllabusFile = input.files.some((f) => f.category === "syllabus");

  const { parts, skippedNotes } = buildMultimodalDocumentParts(input.files);

  const systemInstruction = `You are the AI Master Academic Strategist (Prompt v${PROMPT_VERSION}).
You analyze REAL student-uploaded syllabi, previous-year question papers, sample/model papers, exam patterns, and study notes.

STRICT ACADEMIC INTEGRITY & ANTI-HALLUCINATION RULES:
1. NEVER invent previous-year questions, examination years, marks, or frequency statistics.
2. Every frequency count in topicFrequencyTable MUST come strictly from the uploaded papers provided in this request (totalUploadedPapers = ${uploadedPaperCount}).
3. If a topic appears in N out of M uploaded papers, write frequencySummary as "Appeared in N of M uploaded papers — X% observed recurrence." and set basis = "verified_from_uploaded_papers".
4. If NO previous-year/sample/model papers were uploaded (totalUploadedPapers = 0), OR a syllabus topic did not appear in the uploaded papers, set papersMatchedCount = 0, yearsAppeared = [], marksObserved = "Not observed in uploaded papers", basis = "ai_estimated_from_syllabus", and explicitly explain that importance is AI-estimated from syllabus structure rather than verified PYQ recurrence.
5. Every extracted question in extractedQuestions MUST cite its exact sourceFile, paperYear (or "Unspecified"), and questionRef (e.g., "Q1(a)", "Section B Q4", "Page 2").
6. If documents are incomplete, blurry, truncated, or missing PYQs/syllabus, explicitly list every limitation in limitationsAndWarnings.
7. Optimize the preparation plan for the student's available time WITHOUT suggesting that lower-priority topics can safely be ignored. Frame lower-priority topics as "review fundamentals & short definitions after high-priority mastery".
8. Produce a concise sourceContextDigest (max 2500 chars) summarizing exact syllabus units, key concepts, and verified PYQ patterns from the uploaded files so the Study Assistant can stay grounded in these materials.`;

  const contextBlock = `STUDENT ACADEMIC CONTEXT:
- University / Board: ${input.universityOrBoard || "Not specified"}
- Course & Semester: ${input.courseAndSemester || "Not specified"}
- Subject: ${input.subject}
- Target Exam Year: ${input.examYear || "Not specified"}
- Upcoming Exam Date: ${input.upcomingExamDate || "Not specified"}
- Available Study Hours / Day: ${input.dailyAvailableHours || 4} hours
- Current Preparation Level: ${input.preparationLevel || "intermediate"}
- Uploaded Files Count: ${input.files.length} (Syllabus uploaded: ${hasSyllabusFile ? "Yes" : "No"}, Past/Sample/Model Papers uploaded: ${uploadedPaperCount})
${input.pastedNotes ? `\nADDITIONAL STUDENT-PROVIDED SYLLABUS / PAPER TEXT:\n${input.pastedNotes.slice(0, 25000)}` : ""}

Analyze all attached documents thoroughly and return the exact structured JSON.`;

  const contents = [{ role: "user", parts: [{ text: contextBlock }, ...parts] }];

  const response = await generateWithGemini({
    contents,
    timeoutMs: 65000,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          limitationsAndWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          extractedSyllabusUnits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                unitNumber: { type: Type.INTEGER },
                title: { type: Type.STRING },
                topics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      subtopics: { type: Type.ARRAY, items: { type: Type.STRING } },
                      estimatedMinutes: { type: Type.INTEGER },
                      difficulty: { type: Type.STRING },
                      priority: { type: Type.STRING },
                      prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
                      keyFormulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                      keyDefinitions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: [
                      "title",
                      "subtopics",
                      "estimatedMinutes",
                      "difficulty",
                      "priority",
                      "prerequisites",
                    ],
                  },
                },
              },
              required: ["unitNumber", "title", "topics"],
            },
          },
          extractedQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionText: { type: Type.STRING },
                sourceFile: { type: Type.STRING },
                paperYear: { type: Type.STRING },
                questionRef: { type: Type.STRING },
                mappedUnit: { type: Type.STRING },
                mappedTopic: { type: Type.STRING },
                marksObserved: { type: Type.STRING },
                questionType: { type: Type.STRING },
              },
              required: [
                "questionText",
                "sourceFile",
                "paperYear",
                "questionRef",
                "mappedUnit",
                "mappedTopic",
                "marksObserved",
                "questionType",
              ],
            },
          },
          topicFrequencyTable: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                unit: { type: Type.STRING },
                yearsAppeared: { type: Type.ARRAY, items: { type: Type.STRING } },
                papersMatchedCount: { type: Type.INTEGER },
                totalPapersUploaded: { type: Type.INTEGER },
                frequencySummary: { type: Type.STRING },
                marksObserved: { type: Type.STRING },
                priority: { type: Type.STRING },
                confidence: { type: Type.STRING },
                evidenceSourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } },
                basis: { type: Type.STRING },
              },
              required: [
                "topic",
                "unit",
                "yearsAppeared",
                "papersMatchedCount",
                "totalPapersUploaded",
                "frequencySummary",
                "marksObserved",
                "priority",
                "confidence",
                "evidenceSourceRefs",
                "basis",
              ],
            },
          },
          highPriorityTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          mediumPriorityTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          lowerPriorityTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          frequentlyRepeatedQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pattern: { type: Type.STRING },
                occurrences: { type: Type.STRING },
                sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } },
                basis: { type: Type.STRING },
              },
              required: ["pattern", "occurrences", "sourceRefs", "basis"],
            },
          },
          importantDerivationsAndDiagrams: { type: Type.ARRAY, items: { type: Type.STRING } },
          importantNumericalProblems: { type: Type.ARRAY, items: { type: Type.STRING } },
          unitWiseStrategy: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                unit: { type: Type.STRING },
                recommendedOrder: { type: Type.INTEGER },
                focusAllocationHours: { type: Type.NUMBER },
                strategy: { type: Type.STRING },
                prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: [
                "unit",
                "recommendedOrder",
                "focusAllocationHours",
                "strategy",
                "prerequisites",
              ],
            },
          },
          recommendedStudySequence: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                step: { type: Type.INTEGER },
                topic: { type: Type.STRING },
                unit: { type: Type.STRING },
                reason: { type: Type.STRING },
                estimatedHours: { type: Type.NUMBER },
              },
              required: ["step", "topic", "unit", "reason", "estimatedHours"],
            },
          },
          lastMinuteRevisionStrategy: { type: Type.ARRAY, items: { type: Type.STRING } },
          personalizedExamPlanSummary: { type: Type.STRING },
          sourceContextDigest: { type: Type.STRING },
        },
        required: [
          "limitationsAndWarnings",
          "extractedSyllabusUnits",
          "extractedQuestions",
          "topicFrequencyTable",
          "highPriorityTopics",
          "mediumPriorityTopics",
          "lowerPriorityTopics",
          "frequentlyRepeatedQuestions",
          "importantDerivationsAndDiagrams",
          "importantNumericalProblems",
          "unitWiseStrategy",
          "recommendedStudySequence",
          "lastMinuteRevisionStrategy",
          "personalizedExamPlanSummary",
          "sourceContextDigest",
        ],
      },
    },
  });

  const parsed = safeParseJson(response.text);

  // Post-validation guardrails to guarantee honesty even if model drifts
  const limitations: string[] = Array.isArray(parsed.limitationsAndWarnings)
    ? [...parsed.limitationsAndWarnings]
    : [];
  if (skippedNotes.length > 0) limitations.push(...skippedNotes);
  if (uploadedPaperCount === 0) {
    const hasNotice = limitations.some((l) => l.toLowerCase().includes("previous-year"));
    if (!hasNotice) {
      limitations.push(
        "No previous-year, sample, or model papers were uploaded. Priority rankings below are AI-estimated from syllabus structure rather than verified exam recurrence."
      );
    }
  } else if (uploadedPaperCount < 3) {
    limitations.push(
      `Only ${uploadedPaperCount} question paper${
        uploadedPaperCount === 1 ? " was" : "s were"
      } uploaded. Upload 3–5 past papers for higher statistical confidence in topic recurrence.`
    );
  }

  const normalizedFrequencyTable = (parsed.topicFrequencyTable || []).map((row: any) => {
    const matched = Math.min(
      uploadedPaperCount,
      Math.max(0, Number(row.papersMatchedCount) || 0)
    );
    const basis =
      uploadedPaperCount > 0 && matched > 0
        ? "verified_from_uploaded_papers"
        : "ai_estimated_from_syllabus";
    const pct = uploadedPaperCount > 0 ? Math.round((matched / uploadedPaperCount) * 100) : 0;
    return {
      topic: String(row.topic || "Untitled Topic"),
      unit: String(row.unit || "General"),
      yearsAppeared:
        basis === "verified_from_uploaded_papers" && Array.isArray(row.yearsAppeared)
          ? row.yearsAppeared
          : [],
      papersMatchedCount: matched,
      totalPapersUploaded: uploadedPaperCount,
      frequencySummary:
        basis === "verified_from_uploaded_papers"
          ? `Appeared in ${matched} of ${uploadedPaperCount} uploaded paper${
              uploadedPaperCount === 1 ? "" : "s"
            } — ${pct}% observed recurrence.`
          : uploadedPaperCount === 0
          ? "AI-estimated importance (0 past papers uploaded)"
          : `Not observed in ${uploadedPaperCount} uploaded paper${
              uploadedPaperCount === 1 ? "" : "s"
            } (AI-estimated from syllabus)`,
      marksObserved:
        basis === "verified_from_uploaded_papers"
          ? String(row.marksObserved || "Unspecified marks")
          : "Not observed in uploaded papers",
      priority: ["critical", "high", "medium", "low"].includes(row.priority)
        ? row.priority
        : "medium",
      confidence: ["high", "medium", "low"].includes(row.confidence) ? row.confidence : "medium",
      evidenceSourceRefs: Array.isArray(row.evidenceSourceRefs) ? row.evidenceSourceRefs : [],
      basis,
    };
  });

  return {
    id: `analysis-${Date.now()}`,
    createdAt: new Date().toISOString(),
    subject: input.subject,
    universityOrBoard: input.universityOrBoard || "General",
    courseAndSemester: input.courseAndSemester || "General",
    totalUploadedPapers: uploadedPaperCount,
    documentsAnalyzed: input.files.map((f) => ({
      name: f.name,
      category: f.category,
      paperYear: f.paperYear,
    })),
    limitationsAndWarnings: limitations,
    extractedSyllabusUnits: parsed.extractedSyllabusUnits || [],
    extractedQuestions: uploadedPaperCount > 0 ? parsed.extractedQuestions || [] : [],
    topicFrequencyTable: normalizedFrequencyTable,
    highPriorityTopics: parsed.highPriorityTopics || [],
    mediumPriorityTopics: parsed.mediumPriorityTopics || [],
    lowerPriorityTopics: parsed.lowerPriorityTopics || [],
    frequentlyRepeatedQuestions: parsed.frequentlyRepeatedQuestions || [],
    importantDerivationsAndDiagrams: parsed.importantDerivationsAndDiagrams || [],
    importantNumericalProblems: parsed.importantNumericalProblems || [],
    unitWiseStrategy: parsed.unitWiseStrategy || [],
    recommendedStudySequence: parsed.recommendedStudySequence || [],
    lastMinuteRevisionStrategy: parsed.lastMinuteRevisionStrategy || [],
    personalizedExamPlanSummary:
      parsed.personalizedExamPlanSummary ||
      "Follow the recommended study sequence starting with prerequisite high-priority topics.",
    sourceContextDigest: String(parsed.sourceContextDigest || "").slice(0, 3500),
  };
}

export async function generatePredictedPaper(input: {
  subject: string;
  examPattern: string;
  totalMarks: number;
  durationMinutes: number;
  units: string[];
  difficulty: "easy" | "moderate" | "challenging" | "exam_standard";
  questionCount: number;
  questionTypes: string[];
  syllabusContext?: string;
  frequencySummary?: string;
}) {
  const prompt = `You are an expert university examiner generating an AI-GENERATED PRACTICE / PREDICTED EXAMINATION PAPER (Prompt v${PROMPT_VERSION}).

SPECIFICATIONS:
- Subject: ${input.subject}
- Examination Pattern: ${input.examPattern}
- Total Marks: ${input.totalMarks}
- Duration: ${input.durationMinutes} minutes
- Units to Include: ${input.units.length > 0 ? input.units.join(", ") : "All available syllabus units"}
- Difficulty Level: ${input.difficulty}
- Target Number of Questions: ${input.questionCount}
- Allowed Question Types: ${input.questionTypes.join(", ")}

SOURCE MATERIAL CONTEXT (Uploaded Syllabus & Observed PYQ Patterns):
${input.syllabusContext || "No uploaded syllabus provided; align with standard university curriculum for this subject and note this in basisNote."}
${input.frequencySummary ? `\nOBSERVED TOPIC RECURRENCE:\n${input.frequencySummary}` : ""}

STRICT RULES:
1. Generate exactly ${input.questionCount} well-crafted exam questions whose marks sum closely to ${input.totalMarks}.
2. Organize into clean sections (e.g. Section A - Short/MCQ, Section B - Medium/Derivations, Section C - Long/Numericals) matching the requested exam pattern.
3. For MCQ questions, include 4 clear options in the options array. For non-MCQ questions, return an empty options array [].
4. Provide BOTH a concise answerKey AND a thorough step-by-step modelAnswer (with marking checkpoints/formulas) for every question.
5. In basisNote, explain whether the question draws from high-recurrence uploaded PYQ topics or general syllabus coverage.
6. NEVER claim or guarantee that any question will appear in the actual examination.`;

  const response = await generateWithGemini({
    contents: prompt,
    timeoutMs: 32000,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          marksDistribution: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                section: { type: Type.STRING },
                questionCount: { type: Type.INTEGER },
                marksPerQuestion: { type: Type.NUMBER },
                totalMarks: { type: Type.NUMBER },
              },
              required: ["section", "questionCount", "marksPerQuestion", "totalMarks"],
            },
          },
          topicCoverage: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                unit: { type: Type.STRING },
                marks: { type: Type.NUMBER },
              },
              required: ["topic", "unit", "marks"],
            },
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                section: { type: Type.STRING },
                questionNumber: { type: Type.STRING },
                unit: { type: Type.STRING },
                topic: { type: Type.STRING },
                questionType: { type: Type.STRING },
                marks: { type: Type.NUMBER },
                difficulty: { type: Type.STRING },
                questionText: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answerKey: { type: Type.STRING },
                modelAnswer: { type: Type.STRING },
                basisNote: { type: Type.STRING },
              },
              required: [
                "section",
                "questionNumber",
                "unit",
                "topic",
                "questionType",
                "marks",
                "difficulty",
                "questionText",
                "answerKey",
                "modelAnswer",
                "basisNote",
              ],
            },
          },
        },
        required: ["marksDistribution", "topicCoverage", "questions"],
      },
    },
  });

  const parsed = safeParseJson(response.text);
  const questions = (parsed.questions || []).map((q: any, idx: number) => ({
    ...q,
    id: `pq-${Date.now()}-${idx + 1}`,
    options: Array.isArray(q.options) && q.options.length > 0 ? q.options : undefined,
  }));

  return {
    id: `paper-${Date.now()}`,
    createdAt: new Date().toISOString(),
    subject: input.subject,
    examPattern: input.examPattern,
    totalMarks: input.totalMarks,
    durationMinutes: input.durationMinutes,
    difficulty: input.difficulty,
    includedUnits: input.units,
    disclaimer:
      "AI-Generated Practice & Predicted Paper — Created for exam preparation based on your uploaded materials and syllabus patterns. No question is guaranteed to appear in the actual examination.",
    marksDistribution: parsed.marksDistribution || [],
    topicCoverage: parsed.topicCoverage || [],
    questions,
  };
}

export async function regenerateSingleQuestion(input: {
  subject: string;
  section: string;
  questionNumber: string;
  unit: string;
  topic: string;
  questionType: string;
  marks: number;
  difficulty: string;
  previousQuestionText: string;
  syllabusContext?: string;
}) {
  const prompt = `Regenerate ONE fresh exam-style AI practice question to replace an existing question without changing the paper structure.

Subject: ${input.subject}
Section: ${input.section}
Question Number: ${input.questionNumber}
Unit: ${input.unit}
Topic: ${input.topic}
Question Type: ${input.questionType}
Marks: ${input.marks}
Difficulty: ${input.difficulty}

DO NOT repeat this previous question:
"${input.previousQuestionText}"

Source Context:
${input.syllabusContext || "Standard university curriculum for this topic."}

Return a distinct, fresh question of the exact same marks, section, and question type, with answerKey, thorough modelAnswer, and honest basisNote.`;

  const response = await generateWithGemini({
    contents: prompt,
    timeoutMs: 22000,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          unit: { type: Type.STRING },
          topic: { type: Type.STRING },
          questionType: { type: Type.STRING },
          marks: { type: Type.NUMBER },
          difficulty: { type: Type.STRING },
          questionText: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answerKey: { type: Type.STRING },
          modelAnswer: { type: Type.STRING },
          basisNote: { type: Type.STRING },
        },
        required: [
          "unit",
          "topic",
          "questionType",
          "marks",
          "difficulty",
          "questionText",
          "answerKey",
          "modelAnswer",
          "basisNote",
        ],
      },
    },
  });

  const parsed = safeParseJson(response.text);
  return {
    id: `pq-${Date.now()}-regen`,
    section: input.section,
    questionNumber: input.questionNumber,
    unit: parsed.unit || input.unit,
    topic: parsed.topic || input.topic,
    questionType: parsed.questionType || input.questionType,
    marks: parsed.marks || input.marks,
    difficulty: parsed.difficulty || input.difficulty,
    questionText: parsed.questionText,
    options: Array.isArray(parsed.options) && parsed.options.length > 0 ? parsed.options : undefined,
    answerKey: parsed.answerKey,
    modelAnswer: parsed.modelAnswer,
    basisNote: parsed.basisNote || "AI-generated replacement practice question",
  };
}

export async function askStudyAssistant(input: {
  question: string;
  style: "beginner" | "simple" | "detailed" | "exam_oriented" | "quick_revision";
  subject?: string;
  topic?: string;
  sourceContextDigest?: string;
  syllabusTopicsList?: string[];
  recentMistakes?: string[];
}) {
  const styleGuides: Record<string, string> = {
    beginner: "Teach from first principles using everyday analogies and zero assumed jargon.",
    simple: "Explain cleanly in short, plain sentences with minimal notation.",
    detailed: "Provide thorough academic depth, formal definitions, derivations, and edge cases.",
    exam_oriented:
      "Focus on what examiners award marks for: keywords, scoring steps, diagrams to draw, and common pitfalls.",
    quick_revision: "Ultra-concise bullet points, memory hooks, and essential formulas for rapid recall.",
  };

  const hasSource = Boolean(
    (input.sourceContextDigest && input.sourceContextDigest.trim().length > 20) ||
      (input.syllabusTopicsList && input.syllabusTopicsList.length > 0)
  );

  const prompt = `You are the AI Study Assistant inside the AI Academic Command Center (Prompt v${PROMPT_VERSION}).

STUDENT QUESTION:
"${input.question}"

CONTEXT:
- Subject: ${input.subject || "General"}
- Topic Focus: ${input.topic || "Not specified"}
- Requested Explanation Style: ${input.style} (${styleGuides[input.style] || styleGuides.simple})
- Uploaded Syllabus / Source Digest Available: ${hasSource ? "YES" : "NO"}
${input.sourceContextDigest ? `\nUPLOADED SOURCE DIGEST:\n${input.sourceContextDigest.slice(0, 3500)}` : ""}
${
  input.syllabusTopicsList && input.syllabusTopicsList.length > 0
    ? `\nSTUDENT SYLLABUS TOPICS:\n${input.syllabusTopicsList.slice(0, 40).join("; ")}`
    : ""
}
${
  input.recentMistakes && input.recentMistakes.length > 0
    ? `\nRECENT MISTAKES TO ADDRESS:\n${input.recentMistakes.slice(0, 5).join(" | ")}`
    : ""
}

TRANSPARENCY RULE:
- In sourceGroundedSection: ONLY summarize what directly connects to the student's uploaded syllabus/source digest above. If no uploaded material covers this question, explicitly write: "No uploaded syllabus or study material was found covering this specific query."
- In generalExplanationSection: Provide your clear teaching answer in the requested style (${input.style}).
- Include stepByStepFormulas (array of key formulas/steps), workedExample (one clear solved example), and 2 quick practiceQuestions with hints.`;

  const response = await generateWithGemini({
    contents: prompt,
    timeoutMs: 22000,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sourceGroundedSection: { type: Type.STRING },
          generalExplanationSection: { type: Type.STRING },
          stepByStepFormulas: { type: Type.ARRAY, items: { type: Type.STRING } },
          workedExample: { type: Type.STRING },
          practiceQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                hint: { type: Type.STRING },
              },
              required: ["question", "hint"],
            },
          },
          sourceCitationNote: { type: Type.STRING },
        },
        required: [
          "sourceGroundedSection",
          "generalExplanationSection",
          "stepByStepFormulas",
          "workedExample",
          "practiceQuestions",
          "sourceCitationNote",
        ],
      },
    },
  });

  return safeParseJson(response.text);
}

export async function generateTopicRevisionKit(input: {
  subject: string;
  unitName: string;
  topicTitle: string;
  difficulty: string;
  subtopics?: string[];
  sourceContextDigest?: string;
}) {
  const prompt = `Create an exam-focused Active Recall Revision Kit for a student (Prompt v${PROMPT_VERSION}).

Subject: ${input.subject}
Unit: ${input.unitName}
Topic: ${input.topicTitle}
Difficulty: ${input.difficulty}
Subtopics: ${(input.subtopics || []).join(", ") || "Standard scope"}
${input.sourceContextDigest ? `\nUploaded Source Context:\n${input.sourceContextDigest.slice(0, 2000)}` : ""}

Generate:
1. keyFormulas: 3-5 essential formulas, laws, or core syntax rules for this topic.
2. keyDefinitions: 3-4 crisp, exam-scoring definitions.
3. flashcards: 4 high-yield flashcards (front, back, kind: 'concept' | 'formula' | 'definition').
4. quizQuestions: 4 multiple-choice active recall questions (each with 4 distinct options, exact 0-based correctIndex, clear explanation, difficulty, and mistakeTypeHint from ['conceptual_gap', 'formula_error', 'calculation_slip', 'misread_question', 'incomplete_steps', 'memory_lapse']).`;

  const response = await generateWithGemini({
    contents: prompt,
    timeoutMs: 25000,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          keyFormulas: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyDefinitions: { type: Type.ARRAY, items: { type: Type.STRING } },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING },
                kind: { type: Type.STRING },
              },
              required: ["front", "back", "kind"],
            },
          },
          quizQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                mistakeTypeHint: { type: Type.STRING },
                difficulty: { type: Type.STRING },
              },
              required: [
                "question",
                "options",
                "correctIndex",
                "explanation",
                "mistakeTypeHint",
                "difficulty",
              ],
            },
          },
        },
        required: ["keyFormulas", "keyDefinitions", "flashcards", "quizQuestions"],
      },
    },
  });

  const parsed = safeParseJson(response.text);
  const validMistakeTypes = new Set([
    "conceptual_gap",
    "formula_error",
    "calculation_slip",
    "misread_question",
    "incomplete_steps",
    "memory_lapse",
  ]);

  return {
    keyFormulas: parsed.keyFormulas || [],
    keyDefinitions: parsed.keyDefinitions || [],
    flashcards: (parsed.flashcards || []).map((f: any, i: number) => ({
      id: `fc-${Date.now()}-${i}`,
      front: String(f.front || ""),
      back: String(f.back || ""),
      kind: ["concept", "formula", "definition"].includes(f.kind) ? f.kind : "concept",
    })),
    quizQuestions: (parsed.quizQuestions || []).map((q: any, i: number) => {
      const opts = Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 4) : ["Option A", "Option B", "Option C", "Option D"];
      const safeIdx = Math.max(0, Math.min(opts.length - 1, Number(q.correctIndex) || 0));
      return {
        id: `qq-${Date.now()}-${i}`,
        question: String(q.question || ""),
        options: opts,
        correctIndex: safeIdx,
        explanation: String(q.explanation || ""),
        mistakeTypeHint: validMistakeTypes.has(q.mistakeTypeHint)
          ? q.mistakeTypeHint
          : "conceptual_gap",
        difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
      };
    }),
  };
}
