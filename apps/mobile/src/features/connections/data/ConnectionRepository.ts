import type {
  ConnectionRequestWithUser,
  SendConnectionAlreadyConnected,
  SendConnectionCreated,
  AcceptConnectionResponse,
  IgnoreConnectionResponse,
  RevokeConnectionResponse,
  SentConnectionRequestWithUser,
  Room,
} from '@rtc/contracts';

import { http } from '../../../foundation/network/http';

// ── Discriminated result for sendRequest ────────────────────────────────────

export type SendRequestResult =
  | { alreadyConnected: true; room: Room }
  | { alreadyConnected: false; requestId: string };

export type AcceptResult = {
  room: Room;
};

interface ConnectionRepository {
  sendRequest(receiverId: string, message?: string): Promise<SendRequestResult>;
  getPending(): Promise<ConnectionRequestWithUser[]>;
  getSent(): Promise<SentConnectionRequestWithUser[]>;
  accept(requestId: string): Promise<AcceptResult>;
  ignore(requestId: string): Promise<void>;
  revoke(requestId: string): Promise<void>;
}

export const connectionRepository: ConnectionRepository = {
  async sendRequest(receiverId: string, message?: string): Promise<SendRequestResult> {
    const { data } = await http.post<SendConnectionAlreadyConnected | SendConnectionCreated>(
      '/connections/request',
      {
        receiverId,
        ...(message ? { message } : {}),
      },
    );

    if ('alreadyConnected' in data && data.alreadyConnected) {
      return { alreadyConnected: true, room: (data as SendConnectionAlreadyConnected).room };
    }
    return {
      alreadyConnected: false,
      requestId: (data as SendConnectionCreated).request.id,
    };
  },

  async getPending(): Promise<ConnectionRequestWithUser[]> {
    const { data } = await http.get<ConnectionRequestWithUser[]>('/connections/pending');
    return data;
  },

  async accept(requestId: string): Promise<AcceptResult> {
    const { data } = await http.post<AcceptConnectionResponse>(
      `/connections/${requestId}/accept`,
    );
    return { room: data.room };
  },

  async ignore(requestId: string): Promise<void> {
    await http.post<IgnoreConnectionResponse>(`/connections/${requestId}/ignore`);
  },

  async getSent(): Promise<SentConnectionRequestWithUser[]> {
    const { data } = await http.get<SentConnectionRequestWithUser[]>('/connections/sent');
    return data;
  },

  async revoke(requestId: string): Promise<void> {
    await http.post<RevokeConnectionResponse>(`/connections/${requestId}/revoke`);
  },
};
