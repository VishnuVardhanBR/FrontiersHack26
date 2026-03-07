import { EventEmitter } from "node:events";

import { type SSEEvent } from "@quizcraft/shared";

import { SessionService } from "./session.service.js";

interface Channel {
  emitter: EventEmitter;
  events: SSEEvent[];
  hydrated: boolean;
}

export class EventBuffer {
  private readonly channels = new Map<string, Channel>();

  constructor(private readonly sessionService: SessionService, private readonly maxEvents = 250) {}

  private getChannel(sessionId: string): Channel {
    const current = this.channels.get(sessionId);
    if (current) {
      return current;
    }

    const channel: Channel = {
      emitter: new EventEmitter(),
      events: [],
      hydrated: false,
    };

    this.channels.set(sessionId, channel);
    return channel;
  }

  private async hydrate(sessionId: string): Promise<Channel> {
    const channel = this.getChannel(sessionId);
    if (!channel.hydrated) {
      channel.events = await this.sessionService.readEvents(sessionId);
      channel.hydrated = true;
    }
    return channel;
  }

  async getRecentEvents(sessionId: string): Promise<SSEEvent[]> {
    const channel = await this.hydrate(sessionId);
    return [...channel.events];
  }

  async publish(sessionId: string, event: SSEEvent): Promise<void> {
    const channel = await this.hydrate(sessionId);
    channel.events.push(event);
    if (channel.events.length > this.maxEvents) {
      channel.events.splice(0, channel.events.length - this.maxEvents);
    }
    await this.sessionService.appendEvent(sessionId, event);
    channel.emitter.emit("event", event);
  }

  async subscribe(sessionId: string, listener: (event: SSEEvent) => void): Promise<() => void> {
    const channel = await this.hydrate(sessionId);
    channel.emitter.on("event", listener);
    return () => {
      channel.emitter.off("event", listener);
    };
  }
}
