import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  ChatMessage,
  ChatSession,
} from '../chat/schemas/chat-session.schema';
import { Ticket, TicketStatus, Priority } from '../mongo/schemas/ticket.schema';
import { SummariesService } from '../summaries/summaries.service';

/**
 * Owns chat-session lifecycle: Mongo transcript persistence + presence state,
 * and the Mongo Ticket record created on human escalation. No Redis, no queue.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(ChatSession.name) private readonly sessionModel: Model<ChatSession>,
    @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
    private readonly summaries: SummariesService,
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
    return session;
  }

  /** Last N transcript messages — rebuilt into the agent's context each turn. */
  async getRecentMessages(sessionId: string, limit = 12): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];
    return session.messages.slice(-limit);
  }

  /**
   * Hand off to a human: flip the Mongo session to `escalated` and create a
   * Mongo Ticket (linked via sessionId). Idempotent.
   */
  async escalate(sessionId: string, reason: string): Promise<{ id: string; sessionId: string }> {
    const session = await this.requireSession(sessionId);

    if (session.ticketId) {
      const existing = await this.ticketModel.findOne({ id: session.ticketId }).exec();
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

    const subject = `Escalation: ${session.category ?? 'general support'}`;
    const ticket = await this.ticketModel.create({
      userId: session.userId,
      subject,
      summary: lastUserMessage ? String(lastUserMessage.content).slice(0, 500) : null,
      status: 'open' as TicketStatus,
      priority: 'normal' as Priority,
      sessionId: session.sessionId,
      escalatedAt: new Date(),
    });

    session.ticketId = ticket.id;
    await session.save();
    this.logger.log(`Session ${sessionId} escalated → ticket ${ticket.id}`);
    return { id: ticket.id, sessionId: ticket.sessionId };
  }

  async resolve(sessionId: string): Promise<ChatSession> {
    const session = await this.requireSession(sessionId);
    session.status = 'resolved';
    session.resolvedAt = new Date();
    await session.save();
    await this.summarizeInBackground(session, 'resolved');
    return session;
  }

  async close(sessionId: string): Promise<ChatSession> {
    const session = await this.requireSession(sessionId);
    session.status = 'closed';
    session.closedAt = new Date();
    await session.save();
    await this.summarizeInBackground(session, 'closed');
    return session;
  }

  /**
   * Summarize the ended conversation in the background (fire-and-forget, never
   * blocking resolve/close). Replaces the old BullMQ worker — failures are
   * caught and logged by SummariesService.
   */
  private async summarizeInBackground(
    session: ChatSession,
    terminalStatus: 'resolved' | 'closed',
  ): Promise<void> {
    const messages = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    void this.summaries.summarizeAndStore(
      {
        sessionId: session.sessionId,
        userId: session.userId,
        terminalStatus,
        ticketId: session.ticketId,
        escalationReason: session.escalationReason,
      },
      messages,
    );
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
}