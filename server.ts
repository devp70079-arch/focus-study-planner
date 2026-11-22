import express from "express";
import path from "path";
import dotenv from "dotenv";
import { Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  generateWithGemini,
  safeParseJson,
  analyzeAcademicDocuments,
  generatePredictedPaper,
  regenerateSingleQuestion,
  askStudyAssistant,
  generateTopicRevisionKit,
} from "./server/aiOrchestrator";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "35mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "Its Last Chance For Focus — AI Academic Command Center" });
});

// Voice Assistant Parsing Endpoint (Bilingual: English + Hindi/Hinglish)
app.post("/api/voice/process", async (req, res) => {
  try {
    const { transcript, currentContext } = req.body;
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ error: "Transcript is required" });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const currentDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const prompt = `You are the bilingual AI voice assistant for "Its Last Chance For Focus" study management app.
The user is a dedicated student speaking either in English, Hindi, or Hinglish (mix of Hindi & English).
Today is ${currentDayName}, date is ${todayStr}.

Student's Spoken Input: "${transcript}"
Current app context: ${JSON.stringify(currentContext || {})}

Analyze the student's voice command and extract structured actions for study scheduling, task management, night planning, or status updates.

Expected Intent can be one of:
- "ADD_TASK": create one or more study tasks / assignments / revision items
- "ADD_SCHEDULE_BLOCK": schedule a time slot in the weekly schedule (e.g. tomorrow at 6am, Wednesday 4pm)
- "NIGHT_PLAN": prepare tomorrow's night schedule, setting MITs (Most Important Tasks), wake up time, or kickoff
- "MARK_TASK_COMPLETE": mark a specific subject/task as completed
- "FOCUS_START": command to start a study focus session
- "MOTIVATION_COACH": student is asking for motivation, complaining about distraction, or asking for study advice
- "GENERAL_QUERY": general study question or request

Provide:
1. intent: string
2. detectedLanguage: "Hindi" | "English" | "Hinglish"
3. naturalVoiceReply: A short (1-2 sentences), highly encouraging, firm, supportive response in the same language the student spoke (English, Hindi, or Hinglish). Remind them that focus is their superpower.
4. extractedTasks: array of tasks to add (title, subject, estimatedMinutes, dueDate in YYYY-MM-DD or 'today'/'tomorrow', priority: 'critical'|'high'|'medium')
5. extractedScheduleBlocks: array of weekly schedule blocks (dayOfWeek: 0-6 where 0 is Sunday, 1 is Monday... or day name, startTime: 'HH:MM' 24hr format, endTime: 'HH:MM', subject: string, topic: string)
6. nightPlanData: optional object { top3MITs: string[], wakeUpTime: string, sleepTime: string, kickoffTask: string }
7. focusRequest: optional object { subject: string, durationMinutes: number, mode: string }`;

    try {
      const response = await generateWithGemini({
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              detectedLanguage: { type: Type.STRING },
              naturalVoiceReply: { type: Type.STRING },
              extractedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    estimatedMinutes: { type: Type.INTEGER },
                    dueDate: { type: Type.STRING },
                    priority: { type: Type.STRING },
                  },
                  required: ["title", "subject", "estimatedMinutes", "priority"],
                },
              },
              extractedScheduleBlocks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayOfWeek: { type: Type.INTEGER, description: "0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat" },
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    topic: { type: Type.STRING },
                  },
                  required: ["dayOfWeek", "startTime", "endTime", "subject"],
                },
              },
              nightPlanData: {
                type: Type.OBJECT,
                properties: {
                  top3MITs: { type: Type.ARRAY, items: { type: Type.STRING } },
                  wakeUpTime: { type: Type.STRING },
                  sleepTime: { type: Type.STRING },
                  kickoffTask: { type: Type.STRING },
                },
              },
              focusRequest: {
                type: Type.OBJECT,
                properties: {
                  subject: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER },
                  mode: { type: Type.STRING },
                },
              },
            },
            required: ["intent", "detectedLanguage", "naturalVoiceReply"],
          },
        },
      });

      const parsed = safeParseJson(response.text);
      if (Array.isArray(parsed?.extractedScheduleBlocks)) {
        parsed.extractedScheduleBlocks = parsed.extractedScheduleBlocks.map((b: any) => ({
          ...b,
          dayOfWeek: b.dayOfWeek === 7 ? 0 : b.dayOfWeek,
        }));
      }
      return res.json({ success: true, data: parsed });
    } catch (aiErr: any) {
      console.error("AI processing error in /api/voice/process:", aiErr);
      const status = aiErr?.status === 400 || aiErr?.status === 403 ? aiErr.status : 502;
      return res.status(status).json({
        success: false,
        error: aiErr?.message || "Failed to process voice command via AI service",
      });
    }
  } catch (error: any) {
    console.error("Error in /api/voice/process:", error);
    res.status(500).json({ error: error.message || "Failed to process voice command" });
  }
});

// AI Weekly Schedule Generator
app.post("/api/ai/generate-week-schedule", async (req, res) => {
  try {
    const { subjects, targetWeeklyHours, weakSubjects, examCountdownDays, preferredStudyTimes } = req.body;

    const prompt = `You are a world-class academic study coach designing a realistic, high-yield weekly study timetable for a student.
Target weekly study hours: ${targetWeeklyHours || 35} hours.
Subjects to balance: ${JSON.stringify(subjects || ["Mathematics", "Physics", "Chemistry", "Biology", "English"])}.
Weak / Priority subjects that need extra attention: ${JSON.stringify(weakSubjects || [])}.
Upcoming exam countdown: ${examCountdownDays || "14"} days.
Preferred study times: ${preferredStudyTimes || "Morning 6-9 AM and Evening 5-9 PM"}.

Create an optimal, balanced 7-day schedule (Monday to Sunday) distributing study blocks cleanly.
Include short breaks. Total scheduled hours should match approximately ${targetWeeklyHours || 35} hours.
Make sure weak subjects receive prime morning slots or deeper focus blocks.

Output format should contain:
- scheduleBlocks: array of blocks (dayOfWeek: 0 for Sunday, 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday; dayName, startTime 'HH:MM', endTime 'HH:MM', subject, topic, tip)
- strategySummary: 2-3 sentences explaining why this distribution guarantees maximum retention and anti-burnout.
- dailyHourBreakdown: object with daily allocated hours.`;

    try {
      const response = await generateWithGemini({
        contents: prompt,
        timeoutMs: 45000,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategySummary: { type: Type.STRING },
              scheduleBlocks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayOfWeek: { type: Type.INTEGER, description: "0 for Sun, 1 for Mon, 2 for Tue, ... 6 for Sat" },
                    dayName: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    tip: { type: Type.STRING },
                  },
                  required: ["dayOfWeek", "dayName", "startTime", "endTime", "subject", "topic"],
                },
              },
              dailyHourBreakdown: {
                type: Type.OBJECT,
                properties: {
                  Monday: { type: Type.NUMBER },
                  Tuesday: { type: Type.NUMBER },
                  Wednesday: { type: Type.NUMBER },
                  Thursday: { type: Type.NUMBER },
                  Friday: { type: Type.NUMBER },
                  Saturday: { type: Type.NUMBER },
                  Sunday: { type: Type.NUMBER },
                },
              },
            },
            required: ["strategySummary", "scheduleBlocks"],
          },
        },
      });

      const parsed = safeParseJson(response.text);
      if (Array.isArray(parsed?.scheduleBlocks)) {
        parsed.scheduleBlocks = parsed.scheduleBlocks.map((b: any) => ({
          ...b,
          dayOfWeek: b.dayOfWeek === 7 ? 0 : b.dayOfWeek,
        }));
      }
      return res.json({ success: true, data: parsed });
    } catch (aiErr: any) {
      console.error("AI generation failed for week schedule:", aiErr);
      const status = aiErr?.status === 400 || aiErr?.status === 403 ? aiErr.status : 502;
      return res.status(status).json({
        success: false,
        error: aiErr?.message || "Failed to generate weekly study schedule via AI service",
      });
    }
  } catch (error: any) {
    console.error("Error in /api/ai/generate-week-schedule:", error);
    res.status(500).json({ error: error.message || "Failed to generate week schedule" });
  }
});

// AI Night Review & Tomorrow Battle Plan Generator
app.post("/api/ai/night-plan-assist", async (req, res) => {
  try {
    const { completedTasks, incompletedTasks, hoursStudiedToday, targetTomorrowHours, userNotes } = req.body;

    const prompt = `You are an intensive academic performance mentor running the Night Prep Ritual for "Its Last Chance For Focus".
The student is planning their next day before sleeping.

Today's summary:
- Hours studied today: ${hoursStudiedToday || 0} hours
- Completed tasks: ${JSON.stringify(completedTasks || [])}
- Incomplete / pending tasks: ${JSON.stringify(incompletedTasks || [])}
- Student's reflection/notes: "${userNotes || "I got distracted by phone in the afternoon"}"
- Target tomorrow hours: ${targetTomorrowHours || 6} hours

Generate an empowering, sharp Night Battle Plan for tomorrow:
1. diagnosticInsight: 2 sentences analyzing what went right and why pending tasks fell behind (e.g. phone dopamine trap, poor friction management).
2. top3MITs: The exact top 3 Most Important Tasks that must be conquered tomorrow.
3. morningKickoffTask: The 15-minute low-friction launch task right after waking up to get into flow state before touching mobile phone.
4. wakeUpGoal: Recommended wake up time string (e.g., "06:00 AM").
5. sleepCurfewGoal: Recommended lights-out sleep time (e.g., "11:00 PM").
6. antiDistractionRule: One strict, custom rule for tomorrow (e.g., "No Instagram or WhatsApp until the 2-hour Math block is completed").
7. motivationalQuoteHindiEnglish: A gritty bilingual punchline ("Kal subah procrastination ko haar manni padegi. Stay focused!").`;

    try {
      const response = await generateWithGemini({
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diagnosticInsight: { type: Type.STRING },
              top3MITs: { type: Type.ARRAY, items: { type: Type.STRING } },
              morningKickoffTask: { type: Type.STRING },
              wakeUpGoal: { type: Type.STRING },
              sleepCurfewGoal: { type: Type.STRING },
              antiDistractionRule: { type: Type.STRING },
              motivationalQuoteHindiEnglish: { type: Type.STRING },
            },
            required: [
              "diagnosticInsight",
              "top3MITs",
              "morningKickoffTask",
              "wakeUpGoal",
              "sleepCurfewGoal",
              "antiDistractionRule",
              "motivationalQuoteHindiEnglish",
            ],
          },
        },
      });

      const parsed = safeParseJson(response.text);
      return res.json({ success: true, data: parsed });
    } catch (aiErr: any) {
      console.error("AI generation failed for night plan:", aiErr);
      const status = aiErr?.status === 400 || aiErr?.status === 403 ? aiErr.status : 502;
      return res.status(status).json({
        success: false,
        error: aiErr?.message || "Failed to generate night plan via AI service",
      });
    }
  } catch (error: any) {
    console.error("Error in /api/ai/night-plan-assist:", error);
    res.status(500).json({ error: error.message || "Failed to generate night plan" });
  }
});

// AI Focus Coach Advice Endpoint (Called by CoachAdviceModal)
app.post("/api/ai/coach-advice", async (req, res) => {
  try {
    const { distractionTrigger, currentMood, hoursStudiedToday, remainingExamDays } = req.body;

    const prompt = `You are the intense, loving, no-excuses Focus Coach for "Its Last Chance For Focus".
A student is currently facing a distraction impulse and about to abandon their study session.
Distraction trigger: ${distractionTrigger || "Instagram Reels / YouTube Shorts"}
Current mood: ${currentMood || "Procrastinating and overwhelmed"}
Hours studied today: ${hoursStudiedToday || 0} hours
Remaining exam days: ${remainingExamDays || 14} days

Provide:
1. mindsetInterventionHindiEnglish: A powerful, compassionate but razor-sharp 2-3 sentence reality check in natural conversational Hindi/English (Hinglish). Remind them that short dopamine steals long-term rank and self-respect.
2. twoMinuteMicroAction: Exactly ONE immediate physical action they can do in 120 seconds to break the trance (e.g. "Put your phone in another room, drink 1 glass of cold water, open page 42").
3. speechVoiceScript: A concise, impactful spoken script (max 30 words) in Hinglish designed to be read out loud to immediately ground the student.`;

    try {
      const response = await generateWithGemini({
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mindsetInterventionHindiEnglish: { type: Type.STRING },
              twoMinuteMicroAction: { type: Type.STRING },
              speechVoiceScript: { type: Type.STRING },
            },
            required: ["mindsetInterventionHindiEnglish", "twoMinuteMicroAction", "speechVoiceScript"],
          },
        },
      });

      const parsed = safeParseJson(response.text);
      return res.json({ success: true, data: parsed });
    } catch (aiErr: any) {
      console.error("AI generation failed for coach advice:", aiErr);
      const status = aiErr?.status === 400 || aiErr?.status === 403 ? aiErr.status : 502;
      return res.status(status).json({
        success: false,
        error: aiErr?.message || "Failed to generate coaching advice via AI service",
      });
    }
  } catch (error: any) {
    console.error("Error in /api/ai/coach-advice:", error);
    res.status(500).json({ error: error.message || "Failed to generate coaching advice" });
  }
});

// AI Distraction Rescue & Focus Coach Advice
app.post("/api/ai/focus-coach", async (req, res) => {
  try {
    const { subject, currentStreak, distractionCount, feeling, language } = req.body;

    const prompt = `The student is currently in a study session of "Its Last Chance For Focus" and needs instant anti-distraction intervention.
Subject: ${subject || "General Study"}
Current streak: ${currentStreak || 0} days
Distraction incidents recorded today: ${distractionCount || 0}
Student's current obstacle/feeling: "${feeling || "Urge to check mobile notification"}"
Preferred language: ${language || "bilingual"} (Hindi + English)

Give a short (60-80 words), high-impact focus reset coaching message.
Remind them that giving up 10 minutes to phone scrolling steals their dreams.
Give 1 concrete physical action (e.g., take 3 deep breaths, place phone in another room, write down the single next equation to solve).`;

    try {
      const response = await generateWithGemini({
        contents: prompt,
      });

      res.json({ success: true, advice: response.text });
    } catch (aiErr: any) {
      const status = aiErr?.status === 400 || aiErr?.status === 403 ? aiErr.status : 502;
      res.status(status).json({
        success: false,
        error: aiErr?.message || "Failed to generate focus coach advice via AI service",
      });
    }
  } catch (error: any) {
    console.error("Error in /api/ai/focus-coach:", error);
    res.status(500).json({ error: error.message || "Failed to generate advice" });
  }
});

// ============================================================================
// AI ACADEMIC COMMAND CENTER ENDPOINTS
// ============================================================================

// 1. AI Master Strategist — Multimodal Document Analysis (PDFs, Images, Notes)
app.post("/api/academic/analyze-documents", async (req, res) => {
  try {
    const {
      universityOrBoard,
      courseAndSemester,
      subject,
      examYear,
      upcomingExamDate,
      dailyAvailableHours,
      preparationLevel,
      pastedNotes,
      files,
    } = req.body || {};

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({ success: false, error: "Subject name is required." });
    }

    const safeFiles = Array.isArray(files) ? files : [];
    const hasNotes = typeof pastedNotes === "string" && pastedNotes.trim().length >= 20;
    if (safeFiles.length === 0 && !hasNotes) {
      return res.status(400).json({
        success: false,
        error: "Upload at least one PDF, image, or text document (or paste syllabus/paper text).",
      });
    }

    if (safeFiles.length > 8) {
      return res.status(400).json({
        success: false,
        error: "Please upload up to 8 documents per analysis batch.",
      });
    }

    const data = await analyzeAcademicDocuments({
      universityOrBoard: String(universityOrBoard || ""),
      courseAndSemester: String(courseAndSemester || ""),
      subject: subject.trim(),
      examYear: String(examYear || ""),
      upcomingExamDate: String(upcomingExamDate || ""),
      dailyAvailableHours: Number(dailyAvailableHours) || 4,
      preparationLevel: String(preparationLevel || "intermediate"),
      pastedNotes: typeof pastedNotes === "string" ? pastedNotes : "",
      files: safeFiles,
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in /api/academic/analyze-documents:", err);
    const status = err?.status === 400 || err?.status === 403 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err?.message || "Failed to analyze academic documents.",
    });
  }
});

// 2. AI Predicted Examination Paper Generator
app.post("/api/academic/predict-paper", async (req, res) => {
  try {
    const {
      subject,
      examPattern,
      totalMarks,
      durationMinutes,
      units,
      difficulty,
      questionCount,
      questionTypes,
      syllabusContext,
      frequencySummary,
    } = req.body || {};

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({ success: false, error: "Subject is required." });
    }

    const data = await generatePredictedPaper({
      subject: subject.trim(),
      examPattern: String(examPattern || "University Semester Exam (Sections A, B, C)"),
      totalMarks: Math.max(10, Math.min(200, Number(totalMarks) || 70)),
      durationMinutes: Math.max(15, Math.min(240, Number(durationMinutes) || 180)),
      units: Array.isArray(units) ? units : [],
      difficulty: ["easy", "moderate", "challenging", "exam_standard"].includes(difficulty)
        ? difficulty
        : "exam_standard",
      questionCount: Math.max(3, Math.min(25, Number(questionCount) || 10)),
      questionTypes:
        Array.isArray(questionTypes) && questionTypes.length > 0
          ? questionTypes
          : ["Short Answer", "Long Answer", "Derivation", "Numerical"],
      syllabusContext: typeof syllabusContext === "string" ? syllabusContext : undefined,
      frequencySummary: typeof frequencySummary === "string" ? frequencySummary : undefined,
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in /api/academic/predict-paper:", err);
    const status = err?.status === 400 || err?.status === 403 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err?.message || "Failed to generate predicted paper.",
    });
  }
});

// 3. Regenerate Single Question in Predicted Paper
app.post("/api/academic/regenerate-question", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.subject || !body.previousQuestionText) {
      return res.status(400).json({
        success: false,
        error: "Subject and previousQuestionText are required.",
      });
    }

    const data = await regenerateSingleQuestion({
      subject: String(body.subject),
      section: String(body.section || "Section A"),
      questionNumber: String(body.questionNumber || "Q1"),
      unit: String(body.unit || "General"),
      topic: String(body.topic || "General"),
      questionType: String(body.questionType || "Short Answer"),
      marks: Number(body.marks) || 5,
      difficulty: String(body.difficulty || "medium"),
      previousQuestionText: String(body.previousQuestionText),
      syllabusContext: typeof body.syllabusContext === "string" ? body.syllabusContext : undefined,
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in /api/academic/regenerate-question:", err);
    const status = err?.status === 400 || err?.status === 403 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err?.message || "Failed to regenerate question.",
    });
  }
});

// 4. Grounded AI Study Assistant (5 explanation styles)
app.post("/api/academic/study-assistant", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.question || typeof body.question !== "string" || !body.question.trim()) {
      return res.status(400).json({ success: false, error: "Question is required." });
    }

    const validStyles = ["beginner", "simple", "detailed", "exam_oriented", "quick_revision"];
    const style = validStyles.includes(body.style) ? body.style : "exam_oriented";

    const data = await askStudyAssistant({
      question: body.question.trim(),
      style,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      topic: typeof body.topic === "string" ? body.topic : undefined,
      sourceContextDigest:
        typeof body.sourceContextDigest === "string" ? body.sourceContextDigest : undefined,
      syllabusTopicsList: Array.isArray(body.syllabusTopicsList) ? body.syllabusTopicsList : [],
      recentMistakes: Array.isArray(body.recentMistakes) ? body.recentMistakes : [],
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in /api/academic/study-assistant:", err);
    const status = err?.status === 400 || err?.status === 403 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err?.message || "Failed to answer study question.",
    });
  }
});

// 5. AI Topic Revision Kit (Flashcards + Quick Recall Quiz + Formulas)
app.post("/api/academic/generate-revision-kit", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.subject || !body.topicTitle) {
      return res.status(400).json({
        success: false,
        error: "Subject and topicTitle are required.",
      });
    }

    const data = await generateTopicRevisionKit({
      subject: String(body.subject),
      unitName: String(body.unitName || "General"),
      topicTitle: String(body.topicTitle),
      difficulty: String(body.difficulty || "medium"),
      subtopics: Array.isArray(body.subtopics) ? body.subtopics : [],
      sourceContextDigest:
        typeof body.sourceContextDigest === "string" ? body.sourceContextDigest : undefined,
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in /api/academic/generate-revision-kit:", err);
    const status = err?.status === 400 || err?.status === 403 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err?.message || "Failed to generate topic revision kit.",
    });
  }
});

// Vite middleware / static serve
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
