import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

/** Support ticket created on human escalation; links back to the chat session. */
@Schema({ timestamps: true, collection: 'tickets' })
export class Ticket extends Document {
  @Prop({ type: String, required: true, unique: true, default: () => randomUUID() })
  id!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true })
  subject!: string;

  @Prop({ type: String })
  summary?: string;

  @Prop({ type: String, required: true, default: 'open' })
  status!: TicketStatus;

  @Prop({ type: String, required: true, default: 'normal' })
  priority!: Priority;

  /** Mongo chat-session id this ticket was raised from. */
  @Prop({ type: String })
  sessionId?: string;

  @Prop({ type: Date })
  escalatedAt?: Date;

  @Prop({ type: Date })
  resolvedAt?: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);