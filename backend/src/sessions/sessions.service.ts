import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  ChatMessage,
  ChatSession,
} from '../chat/schemas/chat-session.schema';
import { PrismaService } from '../prisma/prisma.service';
import { PostConversationService } from '../queue/post-conversation.service';
import { RedisService } from '../redis/redis.service';

export interface SessionState {
  sessionId: string;
  userId: string;
  status: string;
  escalatedToHuman: boolean;
  ticketId?: string;
  category?: string;
  updatedAt: string;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

/**
 * Owns chat-session lifecycle: Mongo transcript persistence, Redis presence
 * state, and the Postgres Ticket record created on human escalation.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(ChatSession.name) private readonly sessionModel: Model<ChatSession>,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly postConversation: PostConversationService,
  ) {}

  async createSession(userId: string, category?: string): Promise<ChatSession> {
    const sessionId = randomUUID();
    const session = await this.sessionModel.create({
      sessionId,
      userId,
      status: 'active',
      category,
      escalatedToHuman: false,
      messages: [],
      startedAt: new Date(),
    });
    await this.refreshState(session);
    this.logger.log(`Session created: ${sessionId} for user ${userId}`);
    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.sessionModel.findOne({ sessionId }).exec();
  }

  async requireSession(sessionId: string): Promise<ChatSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Chat session ${sessionId} not found.`);
    }
    return session;
  }

  async appendMessage(
    sessionId: string,
    msg: Pick<ChatMessage, 'role' | 'content'> &
      Partial<Pick<ChatMessage, 'toolCalls' | 'escalationReason'>>,
  ): Promise<ChatSession> {
    const session = await this.requireSession(sessionId);
    session.messages.push({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(),
      ...(msg.toolCalls ? { toolCalls: msg.toolCalls } : {}),
      ...(msg.escalationReason ? { escalationReason: msg.escalationReason } : {}),
    } as ChatMessage);
    session.markModified('messages');
    await session.save();
    await this.refreshState(session);
    return session;
  }

  /** Last N transcript messages — rebuilt into the agent's context each turn. */
  async getRecentMessages(sessionId: string, limit = 12): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];
    return session.messages.slice(-limit);
  }

  /**
   * Hand off to a human: flip the Mongo session to `escalated`, create a
   * Postgres Ticket (linked via sessionId), and refresh Redis state. Idempotent.
   */
  async escalate(sessionId: string, reason: string): Promise<{ id: string; sessionId: string }> {
    const session = await this.requireSession(sessionId);

    if (session.ticketId) {
      const existing = await this.prisma.ticket.findUnique({
        where: { id: session.ticketId },
      });
      if (existing) {
        return { id: existing.id, sessionId: existing.sessionId };
      }
    }

    session.status = 'escalated';
    session.escalatedToHuman = true;
    session.escalationReason = reason;
    session.escalatedAt = new Date();
    session.messages.push({
      role: 'escalation',
      content: `Escalated to human — ${reason}`,
      timestamp: new Date(),
      escalationReason: reason,
    } as ChatMessage);
    session.markModified('messages');
    await session.save();

    const lastUserMessage = [...session.messages]
      .reverse()
      .find((m) => m.role === 'user');

    const ticket = await this.prisma.ticket.create({
      data: {
        userId: session.userId,
        subject: `Escalation: ${session.category ?? 'general support'}`,
        summary: lastUserMessage ? String(lastUserMessage.content).slice(0, 500) : null,
        status: 'open',
        priority: 'normal',
        sessionId: session.sessionId,
        escalatedAt: new Date(),
      },
    });

    session.ticketId = ticket.id;
    await session.save();
    await this.refreshState(session);
    this.logger.log(`Session ${sessionId} escalated → ticket ${ticket.id}`);
    return { id: ticket.id, sessionId: ticket.sessionId };
  }

  async resolve(sessionId: string): Promise<ChatSession> {
    const session = await this.requireSession(sessionId);
    session.status = 'resolved';
    session.resolvedAt = new Date();
    await session.save();
    await this.refreshState(session);
    await this.enqueuePostConversationProcessing(session, 'resolved');
    return session;
  }

  async close(sessionId: string): Promise<ChatSession> {
    const session = await this.requireSession(sessionId);
    session.status = 'closed';
    session.closedAt = new Date();
    await session.save();
    await this.refreshState(session);
    await this.enqueuePostConversationProcessing(session, 'closed');
    return session;
  }

  /**
   * After a conversation ends (resolved/closed) enqueue a BullMQ job that
   * summarizes the transcript via LLM and writes the summary to MongoDB.
   * Failures here are logged but must never break the core resolve/close flow.
   */
  private async enqueuePostConversationProcessing(
    session: ChatSession,
    terminalStatus: 'resolved' | 'closed',
  ): Promise<void> {
    try {
      await this.postConversation.enqueuePostConversationProcessing({
        sessionId: session.sessionId,
        userId: session.userId,
        terminalStatus,
        ticketId: session.ticketId,
        escalationReason: session.escalationReason,
        endedAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to enqueue post-conversation job for ${session.sessionId}: ${(err as Error).message}`,
      );
    }
  }

  /** Active + escalated sessions for the support dashboard. */
  async listForDashboard() {
    return this.sessionModel
      .find({ status: { $in: ['active', 'escalated'] } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .exec();
  }

  async listByUser(userId: string) {
    return this.sessionModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .exec();
  }

  // ── Redis presence state ────────────────────────────────────────────────
  private async refreshState(session: ChatSession): Promise<void> {
    const state: SessionState = {
      sessionId: session.sessionId,
      userId: session.userId,
      status: session.status,
      escalatedToHuman: session.escalatedToHuman,
      ticketId: session.ticketId,
      category: session.category,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.setJson(`chat:${session.sessionId}`, state, SESSION_TTL_SECONDS);
  }

  async getState(sessionId: string): Promise<SessionState | null> {
    return this.redis.getJson<SessionState>(`chat:${sessionId}`);
  }

  async touch(sessionId: string): Promise<void> {
    await this.redis.expire(`chat:${sessionId}`, SESSION_TTL_SECONDS);
  }
}
