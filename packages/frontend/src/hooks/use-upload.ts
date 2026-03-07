import { uploadChapter } from '@/lib/api';
import type { UploadFormValues } from '@/lib/types';
import { useQuizcraftStore } from '@/store';

export const useUpload = () => {
  const setCurrentSessionId = useQuizcraftStore((store) => store.setCurrentSessionId);
  const mergeSession = useQuizcraftStore((store) => store.mergeSession);
  const setUploadError = useQuizcraftStore((store) => store.setUploadError);
  const uploadError = useQuizcraftStore((store) => store.uploadError);

  const upload = async (values: UploadFormValues) => {
    setUploadError(null);

    try {
      const response = await uploadChapter(values);
      setCurrentSessionId(response.sessionId);

      if (response.session) {
        mergeSession(response.session);
      }

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(message);
      throw error;
    }
  };

  return {
    upload,
    uploadError,
    clearUploadError: () => setUploadError(null),
  };
};
