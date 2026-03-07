/**
 * Hardcoded experience package for the Lost Library of Alexandria demo.
 * Satisfies ExperiencePackageSchema for session persistence.
 */

import { ExperiencePackageSchema } from "../schemas/experience-package.js";

export const LIBRARY_ALEXANDRIA_EXPERIENCE_ID = "library_alexandria_demo";

export const LIBRARY_ALEXANDRIA_EXPERIENCE = ExperiencePackageSchema.parse({
  experienceId: LIBRARY_ALEXANDRIA_EXPERIENCE_ID,
  title: "Lost Library of Alexandria",
  gradeBand: "middle_school",
  durationMinutes: 5,
  learningObjectives: [
    "Ancient libraries stored and organized written knowledge.",
    "Texts had to be copied by hand to survive and spread.",
    "Preserving knowledge allows later generations to build on past ideas.",
  ],
  historicalSummary:
    "The Library of Alexandria was one of the largest libraries of the ancient world. Knowledge was preserved by copying texts by hand.",
  creativeLicense: { enabled: true, notes: "Symbolic library scene for guided discovery." },
  sceneSpec: {
    theme: "ancient library, preserved knowledge",
    size: "small",
    regions: [
      { id: "entry_foyer", title: "Entry Foyer", purpose: "introduction", description: "Compact stone landing with columns framing the hall ahead." },
      { id: "main_stacks", title: "Main Stacks", purpose: "context", description: "Aisles of shelves and lecterns where knowledge was stored and copied." },
      { id: "restoration_nook", title: "Restoration Nook", purpose: "challenge", description: "Central pedestal and sealed archive door." },
      { id: "knowledge_chamber", title: "Knowledge Chamber", purpose: "climax", description: "Glowing chamber revealed when the scroll is restored." },
    ],
  },
  studentObjective: {
    type: "find_item",
    itemName: "paper",
    narrativeLabel: "scroll",
    placementRule: "Place the scroll on the archive pedestal to unlock the chamber.",
  },
  dialoguePlan: [
    { id: "d1", regionId: "entry_foyer", lines: ["Welcome to the Lost Library. Here, knowledge was precious because every text had to be preserved by people, one copy at a time."] },
    { id: "d2", regionId: "main_stacks", lines: ["Libraries were more than buildings full of books. They were places where ideas were stored, organized, and copied so they would not disappear.", "If even one important text was lost, future readers might never recover it."] },
    { id: "d3", regionId: "restoration_nook", lines: ["This archive is sealed because one key scroll is missing. Restore it to the pedestal and the chamber will open.", "Take the scroll from the chest and place it here."] },
    { id: "d4", regionId: "knowledge_chamber", lines: ["Well done. Preserving knowledge let later generations build on earlier discoveries instead of starting over.", "That is why libraries mattered so much. They protected memory, learning, and the spread of ideas."] },
  ],
  questionPlan: [
    {
      id: "why_copy_texts",
      regionId: "main_stacks",
      prompt: "Why did ancient texts need to be copied by hand?",
      acceptableAnswers: ["to preserve them", "so they would survive", "to make more copies", "because there were no printers", "preservation", "survival"],
      concepts: ["preservation", "survival of texts", "sharing knowledge"],
      hints: ["Think about what happens if a book is lost.", "Copying helped texts survive."],
      explanation: "Without printing, a text could vanish unless someone copied it carefully.",
    },
    {
      id: "why_libraries_matter",
      regionId: "knowledge_chamber",
      prompt: "What did libraries help preserve — only objects, or ideas too?",
      acceptableAnswers: ["ideas too", "ideas", "knowledge", "both", "memory"],
      concepts: ["ideas", "knowledge", "memory of civilizations"],
      hints: ["Books carry more than paper.", "Libraries stored written works."],
      explanation: "Libraries preserved ideas by storing and organizing written works.",
    },
    {
      id: "what_restore_means",
      regionId: "restoration_nook",
      prompt: "What does restoring the scroll symbolize?",
      acceptableAnswers: ["preserving knowledge", "preserving ideas", "saving texts", "restoring the archive"],
      concepts: ["preservation", "restoration", "symbolism"],
      hints: ["Think about what the scroll represents.", "Restoring one scroll opens the chamber."],
      explanation: "Restoring the scroll symbolizes preserving and rediscovering knowledge.",
    },
  ],
  triggerPlan: [
    { id: "t1", type: "player_near_spawn", condition: "player within 4 blocks of spawn" },
    { id: "t2", type: "objective_found", condition: "scroll placed on pedestal" },
  ],
  successConditions: [
    { id: "s1", description: "Scroll restored to pedestal" },
    { id: "s2", description: "Archive chamber opened" },
  ],
  fallbackHints: [
    "The scroll you need is in the chest beside the pedestal.",
    "Place the scroll on the central pedestal to restore the archive.",
  ],
  sourceExcerpt: "The Library of Alexandria preserved countless scrolls. Scribes copied texts by hand so that knowledge could survive and spread.",
});
