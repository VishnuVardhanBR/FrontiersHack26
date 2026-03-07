import { z } from "zod";

import { DEFAULT_SESSION_DURATION_MINUTES } from "../constants/limits.js";

export const RegionPurposeSchema = z.enum([
  "introduction",
  "context",
  "challenge",
  "climax",
  "recap",
]);

export const GradeBandSchema = z.enum([
  "middle_school",
]);

export const CreativeLicenseSchema = z.object({
  enabled: z.boolean().default(true),
  notes: z.string().min(1),
});

export const SceneRegionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: RegionPurposeSchema,
  description: z.string().min(1),
  anchorHint: z.string().min(1).optional(),
  navigationCue: z.string().min(1).optional(),
  buildDirectives: z.array(z.string().min(1)).default([]),
});

export const StudentObjectiveSchema = z.object({
  type: z.enum(["find_item", "reach_location", "inspect_sign"]),
  itemName: z.string().min(1),
  narrativeLabel: z.string().min(1),
  placementRule: z.string().min(1),
});

export const DialogueBeatSchema = z.object({
  id: z.string().min(1),
  regionId: z.string().min(1),
  lines: z.array(z.string().min(1)).min(1),
  narrationStyle: z.enum(["warm", "urgent", "reflective"]).default("warm"),
  waitForReadyChat: z.boolean().default(false),
});

export const QuestionPlanSchema = z.object({
  id: z.string().min(1),
  regionId: z.string().min(1),
  prompt: z.string().min(1),
  acceptableAnswers: z.array(z.string().min(1)).min(1),
  concepts: z.array(z.string().min(1)).min(1),
  hints: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "stretch"]).default("medium"),
});

export const TriggerPlanSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "player_near_spawn",
    "ready_chat",
    "enter_region",
    "answer_submitted",
    "objective_found",
  ]),
  regionId: z.string().min(1).optional(),
  radius: z.number().int().positive().optional(),
  condition: z.string().min(1),
});

export const SuccessConditionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
});

export const SceneSpecSchema = z.object({
  theme: z.string().min(1),
  size: z.enum(["small", "medium", "large"]).default("medium"),
  regions: z.array(SceneRegionSchema).min(3).max(5),
});

export const ExperiencePackageSchema = z.object({
  experienceId: z.string().min(1),
  title: z.string().min(1),
  gradeBand: GradeBandSchema.default("middle_school"),
  durationMinutes: z.number().int().min(5).max(7).default(DEFAULT_SESSION_DURATION_MINUTES),
  learningObjectives: z.array(z.string().min(1)).min(2).max(5),
  historicalSummary: z.string().min(1),
  creativeLicense: CreativeLicenseSchema,
  sceneSpec: SceneSpecSchema,
  studentObjective: StudentObjectiveSchema,
  dialoguePlan: z.array(DialogueBeatSchema).min(3),
  questionPlan: z.array(QuestionPlanSchema).min(3).max(5),
  triggerPlan: z.array(TriggerPlanSchema).min(2),
  successConditions: z.array(SuccessConditionSchema).min(2),
  fallbackHints: z.array(z.string().min(1)).min(2),
  sourceExcerpt: z.string().min(1),
});

export type RegionPurpose = z.infer<typeof RegionPurposeSchema>;
export type SceneRegion = z.infer<typeof SceneRegionSchema>;
export type StudentObjective = z.infer<typeof StudentObjectiveSchema>;
export type DialogueBeat = z.infer<typeof DialogueBeatSchema>;
export type QuestionPlan = z.infer<typeof QuestionPlanSchema>;
export type TriggerPlan = z.infer<typeof TriggerPlanSchema>;
export type SceneSpec = z.infer<typeof SceneSpecSchema>;
export type ExperiencePackage = z.infer<typeof ExperiencePackageSchema>;
