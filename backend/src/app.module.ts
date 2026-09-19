import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { HealthController } from './health.controller';
import { MongoModule } from './mongo/mongo.module';
import { RatelimitModule } from './ratelimit/ratelimit.module';
import { SessionsModule } from './sessions/sessions.module';
import { SummariesModule } from './summaries/summaries.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoModule,
    RatelimitModule,
    SummariesModule,
    EmbeddingsModule,
    AuthModule,
    UsersModule,
    SessionsModule,
    AgentModule,
    ChatModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}