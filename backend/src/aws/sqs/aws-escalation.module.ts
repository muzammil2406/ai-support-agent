import { Module } from '@nestjs/common';
import { EscalationPublisherService } from './escalation-publisher.service';

/**
 * Isolated AWS add-on (Part 2). Exposes the optional SQS publisher for
 * human-escalation events. Imported by SessionsModule; controlled entirely by
 * env flags so the core app works without any AWS credentials.
 */
@Module({
  providers: [EscalationPublisherService],
  exports: [EscalationPublisherService],
})
export class AwsEscalationModule {}