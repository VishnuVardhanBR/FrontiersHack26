import { GoogleGenerativeAI } from "@google/generative-ai";
import { z, ZodFirstPartyTypeKind, type ZodTypeAny } from "zod";

import { config } from "../config.js";
import { log, warn, err } from "../log.js";

type GeminiSchema = Record<string, unknown>;
type GeminiErrorKind = "auth" | "invalid_request" | "model" | "quota" | "timeout" | "unknown";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const unwrapSchema = (schema: ZodTypeAny): ZodTypeAny => {
  const typeName = schema._def.typeName;

  if (
    typeName === ZodFirstPartyTypeKind.ZodOptional ||
    typeName === ZodFirstPartyTypeKind.ZodNullable ||
    typeName === ZodFirstPartyTypeKind.ZodDefault ||
    typeName === ZodFirstPartyTypeKind.ZodEffects
  ) {
    return unwrapSchema((schema as unknown as { _def: { innerType?: ZodTypeAny; schema?: ZodTypeAny } })._def.innerType
      ?? (schema as unknown as { _def: { schema?: ZodTypeAny } })._def.schema
      ?? schema);
  }

  return schema;
};

const isRequiredField = (schema: ZodTypeAny): boolean => {
  const typeName = schema._def.typeName;

  if (
    typeName === ZodFirstPartyTypeKind.ZodOptional ||
    typeName === ZodFirstPartyTypeKind.ZodDefault
  ) {
    return false;
  }

  if (typeName === ZodFirstPartyTypeKind.ZodEffects) {
    return isRequiredField(
      ((schema as unknown as { _def: { schema?: ZodTypeAny } })._def.schema ?? schema) as ZodTypeAny,
    );
  }

  return true;
};

const zodToGeminiSchema = (schema: ZodTypeAny): GeminiSchema => {
  const current = unwrapSchema(schema);
  const typeName = current._def.typeName;

  switch (typeName) {
    case ZodFirstPartyTypeKind.ZodObject: {
      const shape = (current as z.AnyZodObject).shape;
      const properties = Object.fromEntries(
        Object.entries(shape).map(([key, value]) => [key, zodToGeminiSchema(value as ZodTypeAny)]),
      );
      return {
        type: "OBJECT",
        properties,
        required: Object.entries(shape)
          .filter(([, value]) => isRequiredField(value as ZodTypeAny))
          .map(([key]) => key),
      };
    }
    case ZodFirstPartyTypeKind.ZodArray:
      return {
        type: "ARRAY",
        items: zodToGeminiSchema((current as z.ZodArray<ZodTypeAny>).element),
      };
    case ZodFirstPartyTypeKind.ZodEnum:
      return {
        type: "STRING",
        enum: (current as z.ZodEnum<[string, ...string[]]>)._def.values,
      };
    case ZodFirstPartyTypeKind.ZodBoolean:
      return { type: "BOOLEAN" };
    case ZodFirstPartyTypeKind.ZodNumber:
      return { type: "NUMBER" };
    case ZodFirstPartyTypeKind.ZodString:
      return { type: "STRING" };
    default:
      return { type: "STRING" };
  }
};

const stripJsonFences = (value: string) => value.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

export class GeminiRequestError extends Error {
  readonly name = "GeminiRequestError";

  constructor(
    message: string,
    readonly kind: GeminiErrorKind,
    readonly retryable: boolean,
    readonly statusCode?: number,
    readonly rawMessage?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

const extractStatusCode = (message: string): number | undefined => {
  const match = message.match(/\[(\d{3})[^\]]*\]/);
  return match ? Number(match[1]) : undefined;
};

const normalizeGeminiError = (error: unknown, model: string): GeminiRequestError => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const statusCode = extractStatusCode(rawMessage);

  if (/timed out/i.test(rawMessage)) {
    return new GeminiRequestError(
      `Gemini timed out while planning the lesson with ${model}.`,
      "timeout",
      true,
      statusCode,
      rawMessage,
      { cause: error },
    );
  }

  if (statusCode === 429 && /quota/i.test(rawMessage)) {
    return new GeminiRequestError(
      `Gemini quota exceeded for ${model}. This API project has exhausted its current request allowance. Use a project with available quota or wait for the quota window to reset, then try again.`,
      "quota",
      false,
      statusCode,
      rawMessage,
      { cause: error },
    );
  }

  if (statusCode === 400 && /model/i.test(rawMessage)) {
    return new GeminiRequestError(
      `Gemini model ${model} is not available for this API project or request format.`,
      "model",
      false,
      statusCode,
      rawMessage,
      { cause: error },
    );
  }

  if (statusCode === 400) {
    return new GeminiRequestError(
      `Gemini rejected the planning request for ${model}. Check the model configuration and structured output schema.`,
      "invalid_request",
      false,
      statusCode,
      rawMessage,
      { cause: error },
    );
  }

  if (statusCode === 401 || statusCode === 403 || /api key|permission|unauthorized|forbidden/i.test(rawMessage)) {
    return new GeminiRequestError(
      "Gemini rejected the API credentials for this request.",
      "auth",
      false,
      statusCode,
      rawMessage,
      { cause: error },
    );
  }

  return new GeminiRequestError(
    `Gemini request failed for ${model}.`,
    "unknown",
    statusCode === undefined || statusCode >= 500,
    statusCode,
    rawMessage,
    { cause: error },
  );
};

export class GeminiClient {
  private readonly client = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;

  async generateRawJSON(
    systemInstruction: string,
    userPrompt: string,
    schema: ZodTypeAny,
    model?: string,
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const modelName = model ?? config.geminiModelPlanner;
    let lastError: GeminiRequestError | null = null;

    for (let attempt = 1; attempt <= config.geminiMaxAttempts; attempt += 1) {
      log("gemini", `generateJSON attempt ${attempt}/${config.geminiMaxAttempts} model=${modelName}`);
      const t0 = Date.now();
      try {
        const generativeModel = this.client.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: zodToGeminiSchema(schema as unknown as ZodTypeAny),
            temperature: 0.6,
          } as unknown as Record<string, unknown>,
        });

        const result = await withTimeout(
          generativeModel.generateContent(userPrompt),
          config.geminiTimeoutMs,
          "Gemini generateContent",
        );
        const text = stripJsonFences(result.response.text());
        log("gemini", `generateJSON ok (${Date.now() - t0}ms) | response: ${text.length} chars`);
        return JSON.parse(text) as unknown;
      } catch (error) {
        lastError = normalizeGeminiError(error, modelName);
        warn("gemini", `attempt ${attempt} failed (${Date.now() - t0}ms): ${lastError.message}`);

        if (lastError.rawMessage && lastError.rawMessage !== lastError.message) {
          err("gemini", "upstream:", lastError.rawMessage);
        }

        if (!lastError.retryable || attempt >= config.geminiMaxAttempts) {
          break;
        }

        await delay(attempt * 500);
      }
    }

    throw lastError ?? new GeminiRequestError("Gemini generation failed.", "unknown", false);
  }

  async generateJSON<T>(
    systemInstruction: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
    model?: string,
  ): Promise<T> {
    const json = await this.generateRawJSON(
      systemInstruction,
      userPrompt,
      schema as unknown as ZodTypeAny,
      model,
    );

    return schema.parse(json);
  }

  async generateTTS(text: string): Promise<Buffer> {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    log("gemini", `tts: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}" | model: ${config.geminiModelVoice}`);
    const t0 = Date.now();

    const ttsModel = this.client.getGenerativeModel({
      model: config.geminiModelVoice,
    });

    const result = await withTimeout(
      ttsModel.generateContent({
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede",
              },
            },
          },
        } as unknown as Record<string, unknown>,
      }),
      config.geminiTimeoutMs,
      "Gemini TTS generateContent",
    );

    const candidate = result.response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find(
      (part) => (part as unknown as { inlineData?: { data: string; mimeType: string } }).inlineData,
    ) as unknown as { inlineData?: { data: string; mimeType: string } } | undefined;

    if (!audioPart?.inlineData?.data) {
      throw new Error("No audio data returned from TTS model.");
    }

    const buf = Buffer.from(audioPart.inlineData.data, "base64");
    log("gemini", `tts ok (${Date.now() - t0}ms) | audio: ${(buf.length / 1024).toFixed(1)} KB`);
    return buf;
  }
}
