import type { Bot } from "mineflayer";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Narrator {
  async say(bot: Bot, message: string, pauseMs = 700): Promise<void> {
    const chunks = this.chunk(message);
    for (const chunk of chunks) {
      bot.chat(chunk);
      await delay(pauseMs);
    }
  }

  async sayLines(bot: Bot, lines: string[], pauseMs = 800): Promise<void> {
    for (const line of lines) {
      if (line.trim()) {
        await this.say(bot, line, pauseMs);
      }
    }
  }

  private chunk(message: string, maxLength = 95): string[] {
    const sentences = message
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const chunks: string[] = [];

    for (const sentence of sentences.length ? sentences : [message]) {
      if (sentence.length <= maxLength) {
        chunks.push(sentence);
        continue;
      }

      const words = sentence.split(" ");
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxLength) {
          if (current) {
            chunks.push(current);
          }
          current = word;
        } else {
          current = candidate;
        }
      }

      if (current) {
        chunks.push(current);
      }
    }

    return chunks;
  }
}
