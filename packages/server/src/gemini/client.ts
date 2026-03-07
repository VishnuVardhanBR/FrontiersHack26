import { GoogleGenerativeAI } from "@google/generative-ai";
import { z, ZodFirstPartyTypeKind, type ZodTypeAny } from "zod";

import { config } from "../config.js";

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
        required: Object.keys(shape),
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

  async generateJSON<T>(
    systemInstruction: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    let lastError: GeminiRequestError | null = null;

    for (let attempt = 1; attempt <= config.geminiMaxAttempts; attempt += 1) {
      try {
        const model = this.client.getGenerativeModel({
          model: config.geminiModel,
          systemInstruction,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: zodToGeminiSchema(schema as unknown as ZodTypeAny),
            temperature: 0.6,
          } as unknown as Record<string, unknown>,
        });

        const result = await withTimeout(
          model.generateContent(userPrompt),
          config.geminiTimeoutMs,
          "Gemini generateContent",
        );
        const text = stripJsonFences(result.response.text());
        const json = JSON.parse(text) as unknown;
        return schema.parse(json);
      } catch (error) {
        lastError = normalizeGeminiError(error, config.geminiModel);
        console.error(`[Gemini] attempt ${attempt}/${config.geminiMaxAttempts} failed: ${lastError.message}`);

        if (lastError.rawMessage) {
          console.error(`[Gemini] upstream detail: ${lastError.rawMessage}`);
        }

        if (!lastError.retryable || attempt >= config.geminiMaxAttempts) {
          break;
        }

        if (attempt < config.geminiMaxAttempts) {
          await delay(attempt * 500);
        }
      }
    }

    throw lastError ?? new GeminiRequestError("Gemini generation failed.", "unknown", false);
  }
}
