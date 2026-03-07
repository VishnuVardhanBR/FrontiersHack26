import type { Bot } from "mineflayer";

import { QuestionPlan } from "../contracts.js";
import { Narrator } from "./narrator.js";

export class QuestionAsker {
  constructor(private readonly narrator: Narrator) {}

  async ask(bot: Bot, question: QuestionPlan): Promise<void> {
    await this.narrator.say(bot, `Question: ${question.prompt}`);
    await this.narrator.say(bot, "Type your answer in chat when you're ready.");
  }
}
