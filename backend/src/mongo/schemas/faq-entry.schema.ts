import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

/**
 * FAQ knowledge base.
 *
 * Embeddings (768-dim) are stored as a plain number[] and searched with
 * brute-force cosine similarity in application memory — the FAQ set is small
 * (~20 entries), so this is cheap and needs no external vector index.
 */
@Schema({ timestamps: true, collection: 'faq_entries' })
export class FaqEntry extends Document {
  @Prop({ type: String, required: true, unique: true, default: () => randomUUID() })
  id!: string;

  @Prop({ type: String, required: true })
  question!: string;

  @Prop({ type: String, required: true })
  answer!: string;

  @Prop({ type: String, required: true, index: true })
  category!: string;

  @Prop({ type: [Number], default: undefined })
  embedding?: number[];
}

export const FaqEntrySchema = SchemaFactory.createForClass(FaqEntry);