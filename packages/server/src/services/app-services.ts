import { GeminiClient } from "../gemini/client.js";
import { config } from "../config.js";
import { BotBridgeService } from "./bot-bridge.service.js";
import { DocumentExtractorService } from "./document-extractor.service.js";
import { EventBuffer } from "./event-buffer.js";
import { ExperiencePlannerService } from "./experience-planner.service.js";
import { SessionService } from "./session.service.js";

export const sessionService = new SessionService(config.storageDir);
export const eventBuffer = new EventBuffer(sessionService);
export const botBridgeService = new BotBridgeService(sessionService, eventBuffer);
export const documentExtractorService = new DocumentExtractorService();
export const experiencePlannerService = new ExperiencePlannerService(new GeminiClient());
