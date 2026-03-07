import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_QUESTION_COUNT,
  ExperiencePackageSchema,
  MIN_QUESTION_COUNT,
  type ExperiencePackage,
  type TeacherOptions,
} from "@quizcraft/shared";

import { config } from "../config.js";
import { GeminiClient } from "../gemini/client.js";

export interface PlanExperienceInput {
  sessionId: string;
  chapterText: string;
  teacherOptions: TeacherOptions;
}

const sentenceSplit = (text: string): string[] =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const pickKeywords = (text: string): string[] => {
  const counts = new Map<string, number>();

  for (const word of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (new Set(["that", "with", "from", "were", "into", "their", "about", "there"]).has(word)) {
      continue;
    }
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([word]) => word);
};

const startCase = (value: string): string =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const fallbackExperiencePackage = ({
  sessionId,
  chapterText,
  teacherOptions,
}: PlanExperienceInput): ExperiencePackage => {
  const sentences = sentenceSplit(chapterText);
  const excerpt = sentences.slice(0, 5).join(" ").slice(0, 1200) || chapterText.slice(0, 1200);
  const keywords = pickKeywords(chapterText);
  const leadKeyword = startCase(keywords[0] ?? teacherOptions.topic);
  const secondaryKeyword = startCase(keywords[1] ?? "Daily Life");
  const theme = teacherOptions.topic || leadKeyword;
  const questionCount = Math.max(
    MIN_QUESTION_COUNT,
    Math.min(teacherOptions.questionCount ?? DEFAULT_QUESTION_COUNT, 5),
  );
  const regionNames = [
    `${leadKeyword} Arrival`,
    `${secondaryKeyword} Crossroads`,
    `${leadKeyword} Turning Point`,
  ];

  const regions = regionNames.map((title, index) => ({
    id: ["entry_street", "market_area", "climax_ridge"][index] ?? `region_${index + 1}`,
    title,
    purpose: (["introduction", "context", "climax"] as const)[index] ?? "context",
    description: [
      `A compact introduction area that visually establishes ${theme} with symbolic Minecraft details.`,
      `A central storytelling space that highlights how people experienced ${theme.toLowerCase()} in daily life.`,
      `A dramatic final overlook that reinforces the most important consequences and takeaways.`,
    ][index] ?? `A teaching region about ${theme}.`,
    anchorHint: [
      "Spawn near a stone road with a welcome sign.",
      "Open into a plaza with one damaged building and a story sign.",
      "Raise the terrain slightly and show urgent visual cues.",
    ][index],
    navigationCue: [
      "Follow the lantern path.",
      "Cross the central square.",
      "Climb the short ridge path.",
    ][index],
    buildDirectives: [
      "Keep the footprint compact and readable.",
      "Use modular props to imply the setting.",
      "Reserve space for a final recap moment.",
    ],
  }));

  const questions = Array.from({ length: questionCount }, (_, index) => {
    const concept = startCase(keywords[index] ?? keywords[0] ?? "the main event");
    const fallbackSentence = sentences[index + 1] ?? sentences[0] ?? chapterText.slice(0, 200);
    return {
      id: `question_${index + 1}`,
      regionId: index < questionCount - 1 ? regions[Math.min(index, regions.length - 1)]!.id : "climax_ridge",
      prompt:
        index === questionCount - 1
          ? `Before we finish, what is one important thing students should remember about ${theme}?`
          : `What does this scene tell us about ${concept.toLowerCase()} in ${theme.toLowerCase()}?`,
      acceptableAnswers: [concept, teacherOptions.topic, ...(keywords.slice(index, index + 2))].filter(Boolean),
      concepts: [concept, ...keywords.slice(index, index + 2)].filter(Boolean).slice(0, 3),
      hints: [
        `Think about the idea behind ${concept.toLowerCase()}.`,
        "Use details from the narration and the environment together.",
        "It helps to mention both the historical fact and why it mattered.",
      ],
      explanation: fallbackSentence,
      difficulty: index === questionCount - 1 ? "stretch" : index === 0 ? "easy" : "medium",
    };
  });

  return ExperiencePackageSchema.parse({
    experienceId: slugify(`${teacherOptions.topic || "history"}_${sessionId}`),
    title: `${startCase(theme)} Quest`,
    gradeBand: "middle_school",
    durationMinutes: 6,
    learningObjectives: [
      `Identify the central events in ${theme}.`,
      `Explain how people were affected during ${theme.toLowerCase()}.`,
      `Use scene evidence to recall at least ${questionCount} key ideas.`,
    ],
    historicalSummary: excerpt,
    creativeLicense: {
      enabled: true,
      notes: "Use symbolic Minecraft builds while staying aligned to the chapter's main facts.",
    },
    sceneSpec: {
      theme,
      size: "medium",
      regions,
    },
    studentObjective: {
      type: "find_item",
      itemName: "diamond",
      narrativeLabel: "preserved artifact",
      placementRule: "Hide it in the final region inside an accessible chest near a landmark.",
    },
    dialoguePlan: regions.map((region, index) => ({
      id: `dialogue_${region.id}`,
      regionId: region.id,
      lines: [
        `Welcome to ${region.title}.`,
        sentences[index] ?? `This part of the world helps us understand ${theme}.`,
        `Look around for clues before we tackle the next question.`,
      ],
      narrationStyle: index === regions.length - 1 ? "urgent" : "warm",
      waitForReadyChat: index === 0,
    })),
    questionPlan: questions,
    triggerPlan: [
      {
        id: "trigger_spawn",
        type: "player_near_spawn",
        radius: 10,
        condition: "Student is near the spawn platform.",
      },
      {
        id: "trigger_ready",
        type: "ready_chat",
        condition: "Student types ready in chat after the introduction.",
      },
      {
        id: "trigger_objective",
        type: "objective_found",
        regionId: "climax_ridge",
        condition: "Student finds the preserved artifact chest.",
      },
    ],
    successConditions: [
      {
        id: "complete_questions",
        description: `Answer ${Math.max(2, questionCount - 1)} questions with evidence from the scene.`,
      },
      {
        id: "find_artifact",
        description: "Find the preserved artifact before the final recap.",
      },
    ],
    fallbackHints: [
      "Use both the bot's narration and the blocks around you as clues.",
      "If a question feels tricky, focus on cause, effect, and why people cared.",
      "Follow the lit path between regions if you are unsure where to go next.",
    ],
    sourceExcerpt: excerpt,
  }) as ExperiencePackage;
};

export class ExperiencePlannerService {
  private readonly promptPath = path.join(config.promptsDir, "experience-planner.txt");
  private promptCache: string | null = null;

  constructor(private readonly geminiClient: GeminiClient) {}

  private async loadPrompt(): Promise<string> {
    if (!this.promptCache) {
      this.promptCache = await fs.readFile(this.promptPath, "utf8");
    }
    return this.promptCache;
  }

  async planExperience(input: PlanExperienceInput): Promise<ExperiencePackage> {
    if (!config.geminiApiKey || config.disableGemini) {
      return fallbackExperiencePackage(input);
    }

    const systemInstruction = await this.loadPrompt();
    const userPrompt = [
      `Topic: ${input.teacherOptions.topic}`,
      `Grade level: ${input.teacherOptions.gradeLevel}`,
      `Preferred question count: ${input.teacherOptions.questionCount}`,
      `Objective emphasis: ${input.teacherOptions.objectiveEmphasis}`,
      "",
      "Chapter text:",
      input.chapterText.slice(0, 12000),
    ].join("\n");

    return await this.geminiClient.generateJSON(
      systemInstruction,
      userPrompt,
      ExperiencePackageSchema,
    ) as ExperiencePackage;
  }
}
