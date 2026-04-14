import { useCallback, useState } from 'react';

import { connectionRepository, type SendRequestResult } from '../../../connections/data/ConnectionRepository';
import { logger } from '../../../../lib/logger';

export enum SendRequestProgress {
  Idle = 'idle',
  Sending = 'sending',
  Error = 'error',
  NetworkError = 'network_error',
  Complete = 'complete',
}

export function useSendConnectionRequest() {
  const [sending, setSending] = useState<string | null>(null);
  const [progress, setProgress] = useState<SendRequestProgress>(SendRequestProgress.Idle);

  const sendRequest = useCallback(
    async (receiverId: string, message?: string): Promise<SendRequestResult | null> => {
      try {
        setSending(receiverId);
        setProgress(SendRequestProgress.Sending);
        return await connectionRepository.sendRequest(receiverId, message);
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        const errorCode = axiosError?.response?.data?.error;
        if (errorCode === 'request_already_sent') {
          setProgress(SendRequestProgress.Complete);
          return null; // silently handle duplicate
        }
        logger.warn('useSendConnectionRequest', 'sendRequest failed', errorCode ?? err);
        // Distinguish network errors (no response) from server errors
        if (!axiosError?.response) {
          setProgress(SendRequestProgress.NetworkError);
        } else {
          setProgress(SendRequestProgress.Error);
        }
        return null;
      } finally {
        setSending(null);
      }
    },
    [],
  );

  return { sendRequest, sending, progress };
}
