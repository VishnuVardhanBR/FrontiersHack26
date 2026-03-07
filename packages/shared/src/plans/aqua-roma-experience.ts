/**
 * Hardcoded ExperiencePackage for Aqua Roma demo.
 * Use in demo mode instead of Gemini experience planner.
 * See docs/AQUA_ROMA_SPEC.md for full spec.
 */

import { ExperiencePackageSchema, type ExperiencePackage } from "../schemas/experience-package.js";

export const AQUA_ROMA_EXPERIENCE_ID = "aqua_roma_demo";

export const AQUA_ROMA_EXPERIENCE: ExperiencePackage = ExperiencePackageSchema.parse({
  experienceId: AQUA_ROMA_EXPERIENCE_ID,
  title: "Aqua Roma",
  gradeBand: "middle_school",
  durationMinutes: 5,
  learningObjectives: [
    "Understand that aqueducts moved water using gravity.",
    "Recognize that Roman engineers used arches for strength and support.",
    "See Roman infrastructure as a system: source, channel, supports, city delivery.",
  ],
  historicalSummary:
    "Roman aqueducts carried water long distances using a gentle downhill slope. Arches supported the channel; water flowed to cities for baths, fountains, and homes. Maintenance and careful design kept the system working.",
  creativeLicense: {
    enabled: true,
    notes: "Symbolic Roman aqueduct scene for teaching engineering concepts. Puzzle reinforces gravity and system design.",
  },
  sceneSpec: {
    theme: "Roman aqueduct",
    size: "small",
    regions: [
      {
        id: "spawn_courtyard",
        title: "Spawn courtyard",
        purpose: "introduction",
        description: "Small Roman inspection yard where the tour begins.",
        anchorHint: "Spawn near signage; guide bot starts here.",
        navigationCue: "Follow the guide to the first stop.",
        buildDirectives: ["Compact courtyard", "1–2 signs: Aqua Roma, Follow the guide"],
      },
      {
        id: "arch",
        title: "The arch",
        purpose: "context",
        description: "Aqueduct arch that supports the channel above.",
        anchorHint: "One or two visible arches; optional broken vs intact.",
        navigationCue: "Walk to the arch.",
        buildDirectives: ["Stone brick arch(es)", "Clear focal point"],
      },
      {
        id: "channel",
        title: "The channel",
        purpose: "context",
        description: "Elevated water channel with a slight slope; one section can be blocked or broken.",
        anchorHint: "Visible trough; blocked or dry section; lever or gate.",
        navigationCue: "Follow to the channel section.",
        buildDirectives: ["Elevated trough", "One lever or gate", "Blocked/dry segment possible"],
      },
      {
        id: "city_basin",
        title: "City delivery point",
        purpose: "climax",
        description: "Basin or fountain where water arrives for the city.",
        anchorHint: "Empty fountain or cistern; endpoint for water flow.",
        navigationCue: "Head to the city basin.",
        buildDirectives: ["Small basin/fountain", "Clear endpoint for water"],
      },
      {
        id: "maintenance",
        title: "Maintenance corner",
        purpose: "challenge",
        description: "Area with lever or block to repair the system.",
        anchorHint: "Lever to open sluice; optional placeable block.",
        navigationCue: "Find the lever or repair spot to restore water.",
        buildDirectives: ["Lever(s)", "Optional one block to place"],
      },
    ],
  },
  studentObjective: {
    type: "reach_location",
    itemName: "water_flow",
    narrativeLabel: "restored water",
    placementRule:
      "Complete the puzzle: open the sluice gate or repair the channel so water reaches the city basin. Use the lever or place the missing block.",
  },
  dialoguePlan: [
    {
      id: "dialogue_greet",
      regionId: "spawn_courtyard",
      lines: [
        "Welcome to Aqua Roma. Today I'll show you how Roman engineers moved water across long distances.",
      ],
      narrationStyle: "warm",
      waitForReadyChat: false,
    },
    {
      id: "dialogue_arch",
      regionId: "arch",
      lines: [
        "This arch helps hold up the channel above it. Arches spread weight better than a flat gap.",
        "Why not just build a flat wall everywhere? Think about it as we move on.",
      ],
      narrationStyle: "warm",
      waitForReadyChat: false,
    },
    {
      id: "dialogue_channel",
      regionId: "channel",
      lines: [
        "Water doesn't need pumps here. It moves because the channel slopes very slightly downhill.",
        "Too steep is bad, too flat is bad. Romans got the slope just right.",
      ],
      narrationStyle: "warm",
      waitForReadyChat: false,
    },
    {
      id: "dialogue_basin",
      regionId: "city_basin",
      lines: [
        "Roman engineers weren't just building structures. They were building systems that served whole cities.",
        "This basin is where the water finally arrived for baths, fountains, and homes.",
      ],
      narrationStyle: "warm",
      waitForReadyChat: false,
    },
    {
      id: "dialogue_puzzle_intro",
      regionId: "maintenance",
      lines: [
        "The system is broken. The city fountain is dry. Can you restore the water?",
        "One gate might be closed, or one section blocked. See if you can fix it.",
      ],
      narrationStyle: "urgent",
      waitForReadyChat: false,
    },
    {
      id: "dialogue_success",
      regionId: "city_basin",
      lines: [
        "Well done. Roman aqueducts depended on careful design, steady slope, and constant maintenance.",
        "You used three ideas Roman engineers relied on: strong supports, controlled flow, and system design.",
      ],
      narrationStyle: "reflective",
      waitForReadyChat: false,
    },
  ],
  questionPlan: [
    {
      id: "question_arch",
      regionId: "arch",
      prompt: "Why not just build a flat wall everywhere? (No wrong answer — just think about it.)",
      acceptableAnswers: ["arches", "strong", "weight", "support", "gravity", "skip", "ready"],
      concepts: ["arch", "support", "weight"],
      hints: ["Arches spread the weight. Flat walls would need more material."],
      explanation: "Arches carry weight efficiently and let the channel pass over uneven ground.",
      difficulty: "easy",
    },
    {
      id: "question_channel",
      regionId: "channel",
      prompt: "What makes the water move in this channel?",
      acceptableAnswers: ["gravity", "slope", "downhill", "down"],
      concepts: ["gravity", "slope", "channel"],
      hints: ["Think about which way the channel goes.", "No pumps — just one natural force."],
      explanation: "Water moves because the channel slopes very slightly downhill. Gravity does the work.",
      difficulty: "easy",
    },
    {
      id: "question_final",
      regionId: "city_basin",
      prompt: "What made the water move? A: Magic  B: Gravity  C: Fire",
      acceptableAnswers: ["b", "gravity", "B"],
      concepts: ["gravity"],
      hints: ["Remember the channel — it sloped downhill."],
      explanation: "Gravity. The Romans used a gentle slope so water flowed from source to city.",
      difficulty: "easy",
    },
  ],
  triggerPlan: [
    {
      id: "trigger_spawn",
      type: "player_near_spawn",
      radius: 10,
      condition: "Player is near the spawn courtyard.",
    },
    {
      id: "trigger_puzzle_done",
      type: "objective_found",
      regionId: "city_basin",
      condition: "Player has restored water (lever flipped / block placed); water reaches basin.",
    },
  ],
  successConditions: [
    {
      id: "restore_water",
      description: "Restore the water flow to the city basin.",
    },
    {
      id: "follow_tour",
      description: "Complete the guided tour and understand the three main ideas.",
    },
  ],
  fallbackHints: [
    "Look for a lever that opens the water gate.",
    "Or a missing block in the channel wall. Place it to repair the flow.",
    "Use the lever to send water toward the city, not the waste channel.",
  ],
  sourceExcerpt:
    "Roman aqueducts moved water using gravity along a slight slope. Arches supported the channel; the system served entire cities.",
});
