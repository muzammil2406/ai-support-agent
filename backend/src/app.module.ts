import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { HealthController } from './health.controller';
import { MongoModule } from './mongo/mongo.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MongoModule,
    RedisModule,
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
