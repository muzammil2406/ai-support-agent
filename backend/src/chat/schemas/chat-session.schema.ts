// Mongoose chat-session schema — primary DB (MongoDB Atlas).
// Stores chat transcripts + session lifecycle. User/order/ticket data live in
// Mongo too (see src/mongo/schemas); the session links back via `userId` /
// `ticketId`.

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'escalation';

export interface ToolCallRecord {
  /** Tool name, e.g. 'get_order_status' | 'faq_lookup' | 'escalate_to_human' */
  name: string;
  /** Serialized arguments the agent passed to the tool */
  args: Record<string, unknown>;
  /** Tool output (kept out of the visible transcript, but useful for audit) */
  result?: unknown;
}

@Schema({ _id: false })
export class ChatMessage {
  @Prop({ type: String, required: true, enum: ['user', 'assistant', 'system', 'escalation'] })
  role!: ChatMessageRole;

  @Prop({ type: String, required: true })
  content!: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  timestamp!: Date;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  toolCalls?: ToolCallRecord[];

  @Prop({ type: String })
  escalationReason?: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

export type ChatSessionStatus =
  | 'active' // AI agent handling
  | 'escalated' // handed off to a human support agent
  | 'resolved'
  | 'closed';

@Schema({ timestamps: true, collection: 'chat_sessions' })
export class ChatSession extends Document {
  /** Stable public id shared with the client + Redis session key */
  @Prop({ type: String, required: true, unique: true, index: true })
  sessionId!: string;

  /** mongo users.id */
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /** mongo tickets.id, set when escalated */
  @Prop({ type: String })
  ticketId?: string;

  @Prop({ type: String, required: true, default: 'active', index: true })
  status!: ChatSessionStatus;

  /** Best-guess intent/topic, e.g. 'shipping' | 'returns' | 'billing' */
  @Prop({ type: String })
  category?: string;

  @Prop({ type: Boolean, default: false })
  escalatedToHuman!: boolean;

  @Prop({ type: String })
  escalationReason?: string;

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages!: ChatMessage[];

  @Prop({ type: Date, default: () => new Date() })
  startedAt!: Date;

  @Prop({ type: Date })
  escalatedAt?: Date;

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop({ type: Date })
  closedAt?: Date;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

// Indexes tuned for the analytics aggregation + dashboard queries.
ChatSessionSchema.index({ status: 1, escalatedToHuman: 1 });
ChatSessionSchema.index({ 'messages.role': 1 });
