import { z } from "zod";

import { BuildPlanSchema } from "./build-plan.js";
import { ExperiencePackageSchema } from "./experience-package.js";

export const SessionStatusSchema = z.enum([
  "planning",
  "planned",
  "queued",
  "building_scene",
  "waiting_for_player",
  "introducing",
  "escorting",
  "narrating",
  "asking_question",
  "evaluating_answer",
  "monitoring_objective",
  "climax_recap",
  "completed",
  "error",
]);

export const TeacherOptionsSchema = z.object({
  gradeLevel: z.string().min(1).default("6-8"),
  topic: z.string().min(1).default("History"),
  questionCount: z.number().int().min(3).max(5).default(4),
  objectiveEmphasis: z.string().min(1).default("artifact hunt"),
});

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  speaker: z.enum(["bot", "student", "system"]),
  username: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
});

export const BuildProgressSchema = z.object({
  completedCommands: z.number().int().nonnegative().default(0),
  totalCommands: z.number().int().nonnegative().default(0),
  percent: z.number().min(0).max(100).default(0),
  currentStep: z.string().min(1).default("Waiting to build"),
});

export const QuestionAttemptSchema = z.object({
  questionId: z.string().min(1),
  attempts: z.number().int().min(0).default(0),
  hintsUsed: z.number().int().min(0).default(0),
  correct: z.boolean().default(false),
  lastAnswer: z.string().min(1).optional(),
  explanation: z.string().min(1).optional(),
});

export const SessionSummarySchema = z.object({
  score: z.number().min(0).max(100),
  correctAnswers: z.number().int().nonnegative(),
  totalQuestions: z.number().int().positive(),
  totalHintsUsed: z.number().int().nonnegative(),
  totalDurationSeconds: z.number().int().nonnegative(),
  questionBreakdown: z.array(QuestionAttemptSchema),
  recap: z.string().min(1),
});

export const SessionStateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).default("Untitled QuizCraft Session"),
  sourceFileName: z.string().min(1),
  sourceFileType: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: SessionStatusSchema.default("planning"),
  teacherOptions: TeacherOptionsSchema,
  sourceTextPath: z.string().min(1).optional(),
  experiencePackage: ExperiencePackageSchema.nullable().default(null),
  buildPlan: BuildPlanSchema.nullable().default(null),
  buildProgress: BuildProgressSchema.default({}),
  currentRegionId: z.string().min(1).nullable().default(null),
  activeQuestionIndex: z.number().int().nonnegative().default(0),
  objectiveFound: z.boolean().default(false),
  questionAttempts: z.array(QuestionAttemptSchema).default([]),
  chatLog: z.array(ChatMessageSchema).default([]),
  summary: SessionSummarySchema.nullable().default(null),
  errorMessage: z.string().min(1).nullable().default(null),
  claimedBy: z.string().min(1).nullable().default(null),
  lastHeartbeatAt: z.string().datetime().nullable().default(null),
});

export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type TeacherOptions = z.infer<typeof TeacherOptionsSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type BuildProgress = z.infer<typeof BuildProgressSchema>;
export type QuestionAttempt = z.infer<typeof QuestionAttemptSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
