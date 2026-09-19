import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

@Schema({ timestamps: true, collection: 'orders' })
export class Order extends Document {
  @Prop({ type: String, required: true, unique: true, default: () => randomUUID() })
  id!: string;

  @Prop({ type: String, required: true, unique: true })
  orderNumber!: string;

  /** users.id the order belongs to (null for guest/anonymous) */
  @Prop({ type: String, index: true })
  userId?: string;

  @Prop({ type: String, required: true })
  status!: OrderStatus;

  @Prop({ type: Number, required: true })
  total!: number;

  @Prop({ type: Number, default: 1 })
  itemCount!: number;

  @Prop({ type: String })
  itemName?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);