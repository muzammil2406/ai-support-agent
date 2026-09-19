import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FaqEntry, FaqEntrySchema } from '../mongo/schemas/faq-entry.schema';
import { Order, OrderSchema } from '../mongo/schemas/order.schema';
import { SessionsModule } from '../sessions/sessions.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: FaqEntry.name, schema: FaqEntrySchema },
    ]),
    SessionsModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}