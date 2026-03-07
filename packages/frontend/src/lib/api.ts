import { appConfig } from '@/config';
import { normalizeSession } from '@/lib/types';
import type { SessionRecord, UploadFormValues, UploadResponse } from '@/lib/types';

const assertJson = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  const payload: any = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : typeof payload?.error === 'string'
          ? payload.error
          : 'Request failed';
    throw new Error(message);
  }

  return payload;
};

const isConnectionRefused = (err: unknown): boolean => {
  if (err instanceof TypeError && err.message?.includes('fetch')) return true;
  if (err instanceof Error && err.message?.toLowerCase().includes('failed to fetch')) return true;
  return false;
};

export const apiConnectionHint =
  'Make sure the API server is running (npm run dev:server or ./run.sh).';

export const wrapApiError = (err: unknown): Error => {
  if (err instanceof Error) {
    if (isConnectionRefused(err)) return new Error(`${err.message}. ${apiConnectionHint}`);
    return err;
  }
  return new Error(String(err));
};

export const uploadChapter = async (values: UploadFormValues): Promise<UploadResponse> => {
  if (!values.file) {
    throw new Error('Choose a chapter file before starting.');
  }

  const formData = new FormData();
  formData.set('file', values.file);
  formData.set('gradeBand', values.gradeBand);
  formData.set('topic', values.topic);
  formData.set('questionCount', String(values.questionCount));
  formData.set('objectiveEmphasis', values.objectiveEmphasis);

  const payload: any = await assertJson(
    await fetch(appConfig.uploadUrl, {
      method: 'POST',
      body: formData,
    }),
  );

  const sessionId =
    typeof payload?.sessionId === 'string'
      ? payload.sessionId
      : typeof payload?.id === 'string'
        ? payload.id
        : undefined;

  if (!sessionId) {
    throw new Error('Upload completed but no session id was returned.');
  }

  return {
    sessionId,
    session: payload.session ? normalizeSession(payload.session) : undefined,
  };
};

export interface PromptsResponse {
  promptsDir: string;
  prompts: {
    experiencePlanner: string;
    sceneBuilder: string;
    sceneBuilderBot: string;
  };
}

export const fetchPrompts = async (): Promise<PromptsResponse> => {
  const payload: any = await assertJson(await fetch(appConfig.promptsUrl));
  return {
    promptsDir: typeof payload.promptsDir === "string" ? payload.promptsDir : "",
    prompts: {
      experiencePlanner: typeof payload.prompts?.experiencePlanner === "string" ? payload.prompts.experiencePlanner : "",
      sceneBuilder: typeof payload.prompts?.sceneBuilder === "string" ? payload.prompts.sceneBuilder : "",
      sceneBuilderBot: typeof payload.prompts?.sceneBuilderBot === "string" ? payload.prompts.sceneBuilderBot : "",
    },
  };
};

export const fetchSession = async (sessionId: string): Promise<SessionRecord> => {
  const payload: any = await assertJson(await fetch(appConfig.sessionUrl(sessionId)));
  return normalizeSession(payload?.session ?? payload);
};

export interface LibraryAlexandriaDemoResponse {
  sessionId: string;
  session?: SessionRecord;
}

/** Start the hardcoded Library of Alexandria demo: render scene and queue session. */
export const startLibraryAlexandriaDemo = async (): Promise<LibraryAlexandriaDemoResponse> => {
  const payload: any = await assertJson(
    await fetch(appConfig.libraryAlexandriaDemoUrl, { method: 'POST' }),
  );
  const sessionId =
    typeof payload?.sessionId === 'string'
      ? payload.sessionId
      : typeof payload?.id === 'string'
        ? payload.id
        : undefined;
  if (!sessionId) {
    throw new Error('Demo started but no session id was returned.');
  }
  return {
    sessionId,
    session: payload.session ? normalizeSession(payload.session) : undefined,
  };
};
