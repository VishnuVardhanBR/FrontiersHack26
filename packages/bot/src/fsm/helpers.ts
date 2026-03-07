import { asVec3, ExperiencePackage, QuestionPlan, SceneRegion, SessionState, TutorStateName } from "../contracts.js";
import { TutorContext } from "./tutor-fsm.js";

export const transition = (to: TutorStateName, patch?: Partial<TutorContext["memory"]>) => ({
  to,
  patch,
});

export const getRegions = (session: SessionState): SceneRegion[] => session.experiencePackage.sceneSpec.regions;

export const getCurrentRegion = (ctx: TutorContext): SceneRegion | undefined => getRegions(ctx.session)[ctx.memory.regionIndex];

export const getQuestionForRegion = (experience: ExperiencePackage, regionId: string | undefined): QuestionPlan | undefined =>
  experience.questionPlan.find((question) => question.regionId === regionId);

export const getCurrentQuestion = (ctx: TutorContext): QuestionPlan | undefined =>
  getQuestionForRegion(ctx.session.experiencePackage, getCurrentRegion(ctx)?.id);

export const getRegionCenter = (ctx: TutorContext, regionId: string | undefined) => {
  if (!regionId) {
    return null;
  }

  const buildCenter = ctx.session.buildPlan?.regionCenters[regionId];
  if (buildCenter) {
    return asVec3(buildCenter);
  }

  const region = ctx.session.experiencePackage.sceneSpec.regions.find((item) => item.id === regionId);
  return region?.center ? asVec3(region.center) : null;
};

export const isLastRegion = (ctx: TutorContext): boolean =>
  ctx.memory.regionIndex >= ctx.session.experiencePackage.sceneSpec.regions.length - 1;

export const say = async (ctx: TutorContext, message: string): Promise<void> => {
  await ctx.narrator.say(ctx.bot, message);
  await ctx.appendChatMessage("bot", ctx.config.botUsername, message);
};

export const sayLines = async (ctx: TutorContext, lines: string[]): Promise<void> => {
  for (const line of lines) {
    if (line.trim()) {
      await say(ctx, line);
    }
  }
};
