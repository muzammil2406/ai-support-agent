import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetQueueUrlCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';

export interface EscalationMessage {
  ticketId: string;
  sessionId: string;
  userId: string;
  reason: string;
  category?: string;
  escalatedAt: string;
  source: 'agent_tool' | 'ws_endpoint';
}

/**
 * Optional AWS SQS publisher for human-escalation events (Part 2, isolated).
 *
 * Purely additive: when `AWS_SQS_ESCALATIONS_ENABLED === 'true'` AND either
 * `AWS_SQS_ESCALATION_QUEUE_URL` (full URL) or `AWS_SQS_ESCALATION_QUEUE_NAME`
 * is set, every ticket created by the escalation flow is fanned out to SQS.
 * When those env vars are absent the service silently becomes a no-op so the
 * core app never depends on AWS.
 *
 * The SQS queue, Lambda consumer, CloudWatch log group and alarm live in the
 * standalone CloudFormation stack under `aws/` (see aws/README.md).
 */
@Injectable()
export class EscalationPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscalationPublisherService.name);

  private client: SQSClient | null = null;
  private queueUrl: string | undefined;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const flag = this.config.get<string>('AWS_SQS_ESCALATIONS_ENABLED');
    if (flag !== 'true') {
      this.logger.log(
        'AWS_SQS_ESCALATIONS_ENABLED != "true" — escalation→SQS publishing is OFF.',
      );
      return;
    }

    const region = this.config.get<string>('AWS_REGION', 'us-east-1');
    this.client = new SQSClient({ region });

    const queueUrl = this.config.get<string>('AWS_SQS_ESCALATION_QUEUE_URL');
    if (queueUrl) {
      this.queueUrl = queueUrl;
      this.enabled = true;
      this.logger.log('Escalation→SQS publisher enabled (queue URL from env).');
      return;
    }

    const queueName = this.config.get<string>('AWS_SQS_ESCALATION_QUEUE_NAME');
    if (queueName) {
      try {
        const out = await this.client.send(
          new GetQueueUrlCommand({ QueueName: queueName }),
        );
        this.queueUrl = out.QueueUrl;
        this.enabled = true;
        this.logger.log(
          `Escalation→SQS publisher enabled (resolved queue "${queueName}").`,
        );
      } catch (err) {
        this.enabled = false;
        this.logger.warn(
          `Could not resolve SQS queue "${queueName}": ${(err as Error).message}`,
        );
      }
      return;
    }

    this.enabled = false;
    this.logger.warn(
      'AWS_SQS_ESCALATIONS_ENABLED=true but neither AWS_SQS_ESCALATION_QUEUE_URL nor AWS_SQS_ESCALATION_QUEUE_NAME is set — publisher stays OFF.',
    );
  }

  /**
   * Publish an escalation message. Never throws into the calling flow — any
   * AWS failure is logged and swallowed so escalation still works offline.
   */
  async publishEscalation(message: EscalationMessage): Promise<void> {
    if (!this.enabled || !this.client || !this.queueUrl) {
      return;
    }

    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(message),
          MessageAttributes: {
            event: {
              DataType: 'String',
              StringValue: 'support_ticket_escalated',
            },
            ticketId: { DataType: 'String', StringValue: message.ticketId },
          },
        }),
      );
      this.logger.log(
        `Published escalation to SQS: ticket=${message.ticketId} session=${message.sessionId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to publish escalation to SQS: ${(err as Error).message}`,
      );
    }
  }

  onModuleDestroy(): void {
    if (this.client) {
      void this.client.destroy();
      this.client = null;
    }
  }
}