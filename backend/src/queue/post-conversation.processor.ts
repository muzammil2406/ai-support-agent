import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { ChatSession } from '../chat/schemas/chat-session.schema';
import { ConversationSummarizer } from './conversation-summarizer.service';
import {
  POST_CONVERSATION_QUEUE,
  PostConversationJobData,
} from './queue.constants';
import { ConversationSummary } from './schemas/conversation-summary.schema';

/**
 * BullMQ consumer for the post-conversation-processing queue.
 *
 * Loads the ended session's transcript from MongoDB, summarizes it through the
 * existing LLM call, and writes a `ConversationSummary` document back to Mongo.
 *
 * Retry policy: attempts + exponential backoff are set at enqueue time (see
 * PostConversationService.enqueuePostConversationProcessing).
 */
@Processor(POST_CONVERSATION_QUEUE)
@Injectable()
export class PostConversationProcessor extends WorkerHost {
  private readonly logger = new Logger(PostConversationProcessor.name);

  constructor(
    @InjectModel(ChatSession.name) private readonly sessionModel: Model<ChatSession>,
    @InjectModel(ConversationSummary.name)
    private readonly summaryModel: Model<ConversationSummary>,
    private readonly summarizer: ConversationSummarizer,
  ) {
    super();
  }

  override async process(
    job: Job<PostConversationJobData, unknown, string>,
  ): Promise<{ summaryId: string }> {
    const data = job.data;
    this.logger.log(
      `Processing post-conversation job ${job.id} (attempt ${job.attemptsMade + 1}) for session ${data.sessionId}`,
    );

    const session = await this.sessionModel
      .findOne({ sessionId: data.sessionId })
      .exec();
    if (!session) {
      // Fail so retries run (the transcript may just not be flushed yet); if it
      // never appears the job ends up in 'failed' and is logged by onFailed.
      throw new Error(
        `Session ${data.sessionId} not found — cannot summarize a conversation that does not exist.`,
      );
    }

    const messages = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await this.summarizer.summarize(messages);

    const saved = await this.summaryModel
      .findOneAndUpdate(
        { sessionId: session.sessionId },
        {
          $set: {
            userId: session.userId,
            terminalStatus: data.terminalStatus,
            ticketId: data.ticketId ?? session.ticketId ?? undefined,
            escalationReason:
              data.escalationReason ?? session.escalationReason ?? undefined,
            messageCount: messages.length,
            attemptsMade: job.attemptsMade,
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
      `Summary stored for session ${session.sessionId} → ${saved.id} (${result.summary.length} chars)`,
    );
    return { summaryId: saved.id };
  }

  /**
   * Failed-job handler: logs any job that exhausted all of its retries.
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Post-conversation job ${job?.id ?? '?'} FAILED after ${job?.attemptsMade ?? 0} attempt(s): ${error.message}`,
    );
    this.logger.error(`Failed job payload: ${JSON.stringify(job?.data ?? {})}`);
  }
}
