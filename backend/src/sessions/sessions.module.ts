import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSession, ChatSessionSchema } from '../chat/schemas/chat-session.schema';
import { QueueModule } from '../queue/queue.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

/**
 * SessionsModule owns the Mongo chat transcripts + Redis session state and is
 * shared by the agent (escalate tool), the WS gateway, and the REST controllers.
 * Sharing it here avoids a circular dependency between AgentModule and ChatModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
    ]),
    QueueModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService, MongooseModule],
})
export class SessionsModule {}
