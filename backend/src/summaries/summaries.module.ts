import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationSummarizer } from './conversation-summarizer.service';
import {
  ConversationSummary,
  ConversationSummarySchema,
} from './schemas/conversation-summary.schema';
import { SummariesService } from './summaries.service';

/**
 * Post-conversation summarization.
 *
 * Runs inline (no BullMQ/Redis) — sessions call `summarizeAndStore` fire-and-
 * forget when a conversation ends; failures are logged, never thrown to the
 * caller.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationSummary.name, schema: ConversationSummarySchema },
    ]),
  ],
  providers: [ConversationSummarizer, SummariesService],
  exports: [SummariesService],
})
export class SummariesModule {}