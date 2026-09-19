import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Post-conversation summaries written when a session ends (resolved/closed).
 * Kept as a separate collection (not merged into `chat_sessions`) so the
 * existing chat-session schema/docs are untouched and summaries can be
 * demoed/looked up independently.
 */
@Schema({ timestamps: true, collection: 'conversation_summaries' })
export class ConversationSummary extends Document {
  /** Mongo chat-session id this summary belongs to. */
  @Prop({ type: String, required: true, unique: true, index: true })
  sessionId!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /** Terminal status that ended the conversation (resolved | closed). */
  @Prop({ type: String, required: true, default: 'resolved' })
  terminalStatus!: string;

  @Prop({ type: String })
  ticketId?: string;

  @Prop({ type: String })
  escalationReason?: string;

  /** Number of transcript messages that were summarized. */
  @Prop({ type: Number, default: 0 })
  messageCount!: number;

  @Prop({ type: String, required: true })
  summary!: string;

  /** Topical tags produced by the LLM together with the summary. */
  @Prop({ type: [String], default: [] })
  topics!: string[];

  /** What ended the conversation (escalated | resolved | closed). */
  @Prop({ type: String })
  outcome?: string;
}

export const ConversationSummarySchema =
  SchemaFactory.createForClass(ConversationSummary);