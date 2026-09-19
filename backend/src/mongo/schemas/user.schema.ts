import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type UserRole = 'customer' | 'support_agent' | 'admin';

@Schema({ timestamps: true, collection: 'users' })
export class User extends Document {
  /** Public string id (mirrors the old Prisma cuid) — referenced by JWT sub, sessions, orders, tickets. */
  @Prop({ type: String, required: true, unique: true, default: () => randomUUID() })
  id!: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true })
  email!: string;

  @Prop({ type: String })
  name?: string;

  /** bcrypt hash — never store plaintext */
  @Prop({ type: String, required: true })
  password!: string;

  @Prop({ type: String, required: true, default: 'customer' })
  role!: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);