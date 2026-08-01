import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

export type ChatSocket = Socket;

/** Create a socket.io connection authenticated with the JWT. */
export function createChatSocket(): ChatSocket {
  return io(WS_URL, {
    auth: { token: getToken() },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
}
