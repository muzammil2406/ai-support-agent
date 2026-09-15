import { io, Socket } from 'socket.io-client';
import { getWsToken } from './api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

export type ChatSocket = Socket;

/** Create a socket.io connection authenticated with the ephemeral JWT. */
export async function createChatSocket(): Promise<ChatSocket> {
  const token = await getWsToken();
  return io(WS_URL, {
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
}