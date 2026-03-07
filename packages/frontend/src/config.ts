const normalizeBaseUrl = (value: string | undefined) => value?.replace(/\/$/, '') || 'http://localhost:3000';

export const appConfig = {
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
  get uploadUrl() {
    return `${this.apiBaseUrl}/api/upload`;
  },
  get demoAquaRomaUrl() {
    return `${this.apiBaseUrl}/api/demo/aqua-roma`;
  },
  sessionUrl(sessionId: string) {
    return `${this.apiBaseUrl}/api/sessions/${sessionId}`;
  },
  streamUrl(sessionId: string) {
    return `${this.apiBaseUrl}/api/sessions/${sessionId}/stream`;
  },
};
