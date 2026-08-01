import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AgentService } from '../agent/agent.service';
import { ToolCallRecord } from '../agent/agent.service';
import { RedisService } from '../redis/redis.service';
import { RateLimitService } from '../redis/rate-limit.service';
import { SessionsService } from '../sessions/sessions.service';
import { ChatMessageDto } from './dto/message.dto';

const CHAT_MESSAGE_LIMIT = 30; // per window
const CHAT_WINDOW_SECONDS = 60;

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
    private readonly agent: AgentService,
    private readonly rateLimit: RateLimitService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  afterInit(): void {
    this.logger.log('Chat gateway initialized');
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────
  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string) ??
      (client.handshake.query?.token as string);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<{ sub: string; email: string; role: string }>(token);
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.role = payload.role;
      await client.join(`user:${payload.sub}`);
      if (payload.role === 'support_agent' || payload.role === 'admin') {
        await client.join('dashboard');
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const { sessionId } = client.data;
    if (sessionId) {
      await this.redis.setJson(
        `presence:${sessionId}`,
        { online: false, disconnectedAt: new Date().toISOString() },
        60 * 10,
      );
    }
  }

  // ── Join / resume a session (idempotent — safe across reconnects) ───────
  @SubscribeMessage('chat.join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string },
  ): Promise<{ ok: boolean; sessionId: string }> {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('Unauthorized.');

    let sessionId = payload?.sessionId;
    if (sessionId) {
      const existing = await this.sessions.getSession(sessionId);
      if (!existing || existing.userId !== userId) {
        throw new WsException('Session not found or not owned by this user.');
      }
    } else {
      const created = await this.sessions.createSession(userId);
      sessionId = created.sessionId;
      this.server.to('dashboard').emit('session.open', {
        sessionId: created.sessionId,
        userId,
        status: 'active',
      });
    }

    client.data.sessionId = sessionId;
    await client.join(`session:${sessionId}`);
    await this.redis.setJson(
      `presence:${sessionId}`,
      { online: true, connectedAt: new Date().toISOString() },
      60 * 60,
    );

    const session = await this.sessions.requireSession(sessionId);
    client.emit('session.ready', {
      sessionId,
      status: session.status,
      escalatedToHuman: session.escalatedToHuman,
      ticketId: session.ticketId,
      messages: session.messages,
    });

    return { ok: true, sessionId };
  }

  // ── User sends a message → agent runs, tokens stream back ────────────────
  @SubscribeMessage('chat.send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatMessageDto,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('Unauthorized.');

    const limit = await this.rateLimit.checkLimit(
      `chat:${userId}`,
      CHAT_MESSAGE_LIMIT,
      CHAT_WINDOW_SECONDS,
    );
    if (!limit.allowed) {
      client.emit('rate_limited', { retryAfterMs: limit.retryAfterMs });
      return;
    }

    // Ensure a session exists (first message auto-creates one).
    let sessionId = client.data.sessionId as string | undefined;
    if (!sessionId) {
      const created = await this.sessions.createSession(userId);
      sessionId = created.sessionId;
      client.data.sessionId = sessionId;
      await client.join(`session:${sessionId}`);
      client.emit('session.ready', {
        sessionId,
        status: 'active',
        escalatedToHuman: false,
        messages: [],
      });
      this.server.to('dashboard').emit('session.open', { sessionId, userId, status: 'active' });
    }

    await this.sessions.appendMessage(sessionId, {
      role: 'user',
      content: payload.content,
    });
    this.server
      .to('dashboard')
      .emit('session.updated', { sessionId, lastMessage: payload.content });

    let fullReply = '';
    let toolCalls: ToolCallRecord[] = [];
    try {
      const result = await this.agent.streamResponse(
        payload.content,
        { sessionId, userId },
        {
          onToken: (text) => client.emit('agent.token', { sessionId, text }),
          onToolCall: (name, result) =>
            client.emit('agent.tool_call', { sessionId, name, result }),
        },
      );
      fullReply = result.reply;
      toolCalls = result.toolCalls;
    } catch (err) {
      this.logger.error(`Agent run failed: ${(err as Error).message}`);
      client.emit('agent.error', {
        message: 'Sorry, I hit an unexpected error. Please try again.',
      });
      return;
    }

    if (fullReply.trim()) {
      await this.sessions.appendMessage(sessionId, {
        role: 'assistant',
        content: fullReply,
        toolCalls,
      });
      client.emit('agent.message', { sessionId, content: fullReply, toolCalls });
      this.server
        .to('dashboard')
        .emit('session.updated', { sessionId, lastMessage: fullReply });
    }
  }

  // ── User requests a human ────────────────────────────────────────────────
  @SubscribeMessage('escalate')
  async handleEscalate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { reason?: string },
  ): Promise<{ ok: boolean; ticketId: string }> {
    const userId = client.data.userId as string | undefined;
    const sessionId = client.data.sessionId as string | undefined;
    if (!userId || !sessionId) throw new WsException('No active session.');

    const reason = (payload?.reason ?? 'Customer requested a human').slice(0, 500);
    const ticket = await this.sessions.escalate(sessionId, reason);

    client.emit('escalated', { sessionId, ticketId: ticket.id, reason });
    this.server.to('dashboard').emit('session.escalated', {
      sessionId,
      ticketId: ticket.id,
      reason,
    });
    return { ok: true, ticketId: ticket.id };
  }

  // ── Support agent resolves a session ─────────────────────────────────────
  @SubscribeMessage('chat.resolve')
  async handleResolve(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ): Promise<{ ok: boolean }> {
    const role = client.data.role as string | undefined;
    if (role !== 'support_agent' && role !== 'admin') {
      throw new WsException('Forbidden.');
    }
    await this.sessions.resolve(payload.sessionId);
    this.server
      .to(`session:${payload.sessionId}`)
      .emit('session.resolved', { sessionId: payload.sessionId });
    this.server.to('dashboard').emit('session.updated', {
      sessionId: payload.sessionId,
      status: 'resolved',
    });
    return { ok: true };
  }
}
