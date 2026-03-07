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

export const uploadChapter = async (values: UploadFormValues): Promise<UploadResponse> => {
  if (!values.chapterText.trim()) {
    throw new Error('Paste chapter text before starting.');
  }

  const payload: any = await assertJson(
    await fetch(appConfig.uploadUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        chapterText: values.chapterText,
        gradeBand: values.gradeBand,
        topic: values.topic,
        questionCount: values.questionCount,
        objectiveEmphasis: values.objectiveEmphasis,
      }),
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

export const resetServerForNewLesson = async (): Promise<void> => {
  await assertJson(
    await fetch(appConfig.resetUrl, {
      method: 'POST',
    }),
  );
};

export const fetchSession = async (sessionId: string): Promise<SessionRecord> => {
  const payload: any = await assertJson(await fetch(appConfig.sessionUrl(sessionId)));
  return normalizeSession(payload?.session ?? payload);
};
