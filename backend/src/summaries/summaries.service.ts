import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { ChatMessage } from '../chat/schemas/chat-session.schema';
import { ConversationSummarizer } from './conversation-summarizer.service';
import { ConversationSummary } from './schemas/conversation-summary.schema';

export interface SummarizeSessionInput {
  sessionId: string;
  userId: string;
  terminalStatus: 'resolved' | 'closed';
  ticketId?: string;
  escalationReason?: string;
}

/**
 * Summarizes an ended conversation and stores the result in MongoDB.
 *
 * This replaced the BullMQ post-conversation worker: since summarization must
 * never block the resolve/close flow, callers invoke
 * `summarizeAndStore(...)` without awaiting it — failures are caught and
 * logged here instead of crashing the response path.
 */
@Injectable()
export class SummariesService {
  private readonly logger = new Logger(SummariesService.name);

  constructor(
    @InjectModel(ConversationSummary.name)
    private readonly summaryModel: Model<ConversationSummary>,
    private readonly summarizer: ConversationSummarizer,
  ) {}

  async summarizeAndStore(
    input: SummarizeSessionInput,
    messages: Array<{ role: ChatMessage['role']; content: unknown }>,
  ): Promise<{ summaryId: string }> {
    try {
      const result = await this.summarizer.summarize(messages);

      const saved = await this.summaryModel
        .findOneAndUpdate(
          { sessionId: input.sessionId },
          {
            $set: {
              userId: input.userId,
              terminalStatus: input.terminalStatus,
              ticketId: input.ticketId,
              escalationReason: input.escalationReason,
              messageCount: messages.length,
              summary: result.summary,
              topics: result.topics,
              outcome: result.outcome,
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true, new: true },
        )
        .exec();

      this.logger.log(
        `Summary stored for session ${input.sessionId} → ${saved.id} (${result.summary.length} chars)`,
      );
      return { summaryId: saved.id };
    } catch (err) {
      this.logger.error(
        `Failed to summarize session ${input.sessionId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}