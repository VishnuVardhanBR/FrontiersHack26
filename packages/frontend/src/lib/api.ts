import { appConfig } from '@/config';
import { normalizeSession } from '@/lib/types';
import type { SessionRecord, UploadFormValues, UploadResponse } from '@/lib/types';

export const startAquaRomaDemo = async (): Promise<UploadResponse> => {
  const payload: any = await assertJson(
    await fetch(appConfig.demoAquaRomaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }),
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

export const fetchSession = async (sessionId: string): Promise<SessionRecord> => {
  const payload: any = await assertJson(await fetch(appConfig.sessionUrl(sessionId)));
  return normalizeSession(payload?.session ?? payload);
};
