import { z } from "zod";

import { BuildPlanSchema } from "./build-plan.js";
import {
  BuildProgressSchema,
  ChatMessageSchema,
  SessionStatusSchema,
  SessionSummarySchema,
} from "./session-state.js";
import { ExperiencePackageSchema } from "./experience-package.js";

const EventBaseSchema = z.object({
  timestamp: z.string().datetime(),
});

export const StatusEventSchema = EventBaseSchema.extend({
  type: z.literal("status"),
  data: z.object({
    status: SessionStatusSchema,
    message: z.string().min(1),
  }),
});

export const ChatEventSchema = EventBaseSchema.extend({
  type: z.literal("chat"),
  data: ChatMessageSchema,
});

export const BuildProgressEventSchema = EventBaseSchema.extend({
  type: z.literal("build_progress"),
  data: BuildProgressSchema,
});

export const ExperienceReadyEventSchema = EventBaseSchema.extend({
  type: z.literal("experience_ready"),
  data: z.object({
    experiencePackage: ExperiencePackageSchema,
  }),
});

export const BuildPlanEventSchema = EventBaseSchema.extend({
  type: z.literal("build_plan_ready"),
  data: z.object({
    buildPlan: BuildPlanSchema,
  }),
});

export const QuestionResultEventSchema = EventBaseSchema.extend({
  type: z.literal("question_result"),
  data: z.object({
    questionId: z.string().min(1),
    correct: z.boolean(),
    feedback: z.string().min(1),
    scoreDelta: z.number(),
  }),
});

export const SessionCompleteEventSchema = EventBaseSchema.extend({
  type: z.literal("session_complete"),
  data: SessionSummarySchema,
});

export const ErrorEventSchema = EventBaseSchema.extend({
  type: z.literal("error"),
  data: z.object({
    message: z.string().min(1),
  }),
});

export const SSEEventSchema = z.discriminatedUnion("type", [
  StatusEventSchema,
  ChatEventSchema,
  BuildProgressEventSchema,
  ExperienceReadyEventSchema,
  BuildPlanEventSchema,
  QuestionResultEventSchema,
  SessionCompleteEventSchema,
  ErrorEventSchema,
]);

export type StatusEvent = z.infer<typeof StatusEventSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
export type BuildProgressEvent = z.infer<typeof BuildProgressEventSchema>;
export type ExperienceReadyEvent = z.infer<typeof ExperienceReadyEventSchema>;
export type BuildPlanEvent = z.infer<typeof BuildPlanEventSchema>;
export type QuestionResultEvent = z.infer<typeof QuestionResultEventSchema>;
export type SessionCompleteEvent = z.infer<typeof SessionCompleteEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
