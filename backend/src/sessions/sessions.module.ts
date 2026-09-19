import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSession, ChatSessionSchema } from '../chat/schemas/chat-session.schema';
import { Ticket, TicketSchema } from '../mongo/schemas/ticket.schema';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

/**
 * SessionsModule owns the Mongo chat transcripts + tickets and is shared by
 * the agent (escalate tool), the WS gateway, and the REST controllers.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: Ticket.name, schema: TicketSchema },
    ]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService, MongooseModule],
})
export class SessionsModule {}