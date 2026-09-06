import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSession, ChatSessionSchema } from '../chat/schemas/chat-session.schema';
import { ConversationSummarizer } from './conversation-summarizer.service';
import { PostConversationProcessor } from './post-conversation.processor';
import { PostConversationService } from './post-conversation.service';
import { QueueMonitorController } from './queue-monitor.controller';
import { BullRedisConfig } from './queue-redis.config';
import { POST_CONVERSATION_QUEUE } from './queue.constants';
import {
  ConversationSummary,
  ConversationSummarySchema,
} from './schemas/conversation-summary.schema';

/**
 * Post-conversation background jobs.
 *
 * Registers:
 *  - a BullMQ queue (POST_CONVERSATION_QUEUE) on a real socket Redis connection
 *  - the worker/consumer + failed-job logger
 *  - the queue-status monitor endpoint
 *
 * The MONGODB models here are registered locally so this module is self-contained
 * and can be demoed independently of SessionsModule.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [BullRedisConfig],
      useFactory: (cfg: BullRedisConfig) => cfg.resolver(),
    }),
    BullModule.registerQueue({ name: POST_CONVERSATION_QUEUE }),
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ConversationSummary.name, schema: ConversationSummarySchema },
    ]),
  ],
  controllers: [QueueMonitorController],
  providers: [
    BullRedisConfig,
    ConversationSummarizer,
    PostConversationProcessor,
    PostConversationService,
  ],
  exports: [
    BullRedisConfig,
    PostConversationService,
    PostConversationProcessor,
    BullModule,
  ],
})
export class QueueModule {}
