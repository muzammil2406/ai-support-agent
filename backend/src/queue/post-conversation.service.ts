import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  POST_CONVERSATION_JOB,
  POST_CONVERSATION_QUEUE,
  PostConversationJobData,
} from './queue.constants';

const RETRY_ATTEMPTS = 3;
const BACKOFF = { type: 'exponential' as const, delay: 2000 };

export interface QueueStatus {
  queue: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  retryPolicy: { attempts: number; backoff: string };
}

/**
 * Send-side facade for the post-conversation queue.
 * - enqueuePostConversationProcessing() adds jobs with retry + exponential backoff
 * - status() reads lifecycle counts from BullMQ/Redis for the monitor endpoint
 */
@Injectable()
export class PostConversationService {
  private readonly logger = new Logger(PostConversationService.name);

  constructor(
    @InjectQueue(POST_CONVERSATION_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueuePostConversationProcessing(data: PostConversationJobData): Promise<string> {
    const job = await this.queue.add(POST_CONVERSATION_JOB, data, {
      attempts: RETRY_ATTEMPTS,
      backoff: BACKOFF,
      removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
      removeOnFail: { age: 60 * 60 * 24 * 7 },
    });
    this.logger.log(
      `Enqueued post-conversation job ${job.id} for session ${data.sessionId} (${data.terminalStatus})`,
    );
    return job.id ?? 'unknown';
  }

  async status(): Promise<QueueStatus> {
    const counts = await this.queue.getJobCounts();

    return {
      queue: POST_CONVERSATION_QUEUE,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: counts.paused ?? 0,
      },
      retryPolicy: { attempts: RETRY_ATTEMPTS, backoff: 'exponential (2s base)' },
    };
  }
}
