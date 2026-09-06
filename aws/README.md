# AWS add-on — escalation fan-out: SQS → Lambda → DynamoDB (+ CloudWatch)

**Part 2 of the Nova enhancements — fully isolated from the core app.** It does
not touch the main NestJS API, your existing Postgres/Mongo/Redis, or the
BullMQ work in Part 1. You can deploy or tear it down without affecting Nova.

```
Nova backend
  └─ SessionsService.escalate(ticket)                    (only when the env flag is on)
        └─ EscalationPublisherService ──► SQS nova-escalations
                                              │  (event source mapping)
                                              ▼
                                        Lambda nova-escalation-consumer
                                              │  ├─ logs to CloudWatch (/aws/lambda/nova-escalation-consumer)
                                              │  └─ writes DynamoDB table nova-escalations
                                              └─ (optional) POSTs back to your Nova API
        plus CloudWatch alarm: alert on SQS queue depth > 10 → nova-escalation-queue-depth
```

## Folder layout

| Path | What it is |
|---|---|
| `lambda/index.js` | Standalone Node Lambda (CommonJS, no build step) |
| `lambda/package.json` | Lambda deps (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) |
| `lambda/scripts/package.js` | Creates `lambda/function.zip` |
| `infrastructure/template.yaml` | One CloudFormation stack: SQS + DLQ + DynamoDB + Lambda + log group + alarm (+ SNS if `AlarmEmail` provided) |
| `scripts/deploy.ps1` | One-command build → upload → deploy → print outputs |

## What the backend does (the only code hook in the NestJS app)

In `backend/src/sessions/sessions.service.ts`, `escalate()` calls
`EscalationPublisherService.publishEscalation({...})` after creating the
ticket. The publisher (`backend/src/aws/sqs/escalation-publisher.service.ts`)
is a no-op unless the flag is on, so the core app behaves identically when
this add-on is disabled.

```env
# backend/.env
AWS_SQS_ESCALATIONS_ENABLED=true
AWS_REGION=us-east-1
AWS_SQS_ESCALATION_QUEUE_URL=<from stack output EscalationQueueUrl>
# or, alternatively:
# AWS_SQS_ESCALATION_QUEUE_URL=
# AWS_SQS_ESCALATION_QUEUE_NAME=nova-escalations
```

## Deploy (Windows / PowerShell)

```powershell
cd aws
# optional: custom names / SNS email for the alarm
$Env:NOVA_ALARM_EMAIL = 'ops@example.com'
# optional: have the Lambda POST escalations back into Nova
$Env:NOVA_API_CALLBACK_URL = 'https://<your-nova-backend>/api/aws/escalations'

powershell -ExecutionPolicy Bypass -File ./scripts/deploy.ps1
```

The script will `npm ci` the Lambda, package `function.zip`, upload it to an
S3 artifact bucket, and run `aws cloudformation deploy`. At the end it prints
`EscalationQueueUrl`, `EscalationLambdaFunctionName`, `EscalationLambdaLogGroup`
and `EscalationQueueDepthAlarmName`.

### Requirements
- AWS CLI v2 configured (`aws configure`).
- Default region, or pass `-Region us-east-1`.

## Demo flow

1. Start the Nova backend with the `AWS_SQS_ESCALATIONS_ENABLED=true` env vars.
2. In the chat widget, escalate ("I want a refund") → the backend creates the
   ticket and publishes to SQS.
3. Watch it flow through:
   - **SQS console** → `nova-escalations` → "Messages available" spikes then drops.
   - **CloudWatch Logs** → `/aws/lambda/nova-escalation-consumer` → the log line
     `"SUPPORT TICKET ESCALATED TO HUMAN"` with the ticket id.
   - **DynamoDB** → table `nova-escalations` → item per escalated ticket.
4. **Alarm:** send >10 messages without letting Lambda pick them up (pause the
   event source, or flood with a small script) and watch
   `nova-escalation-queue-depth` go to `ALARM` in ~5 minutes.

## Tear down

```powershell
aws cloudformation delete-stack --stack-name nova-escalations
```

This removes the queue, Lambda, log group, DynamoDB table and alarm. Optionally
delete the S3 artifact bucket too.

## Manual alternative (no script)

```bash
cd lambda && npm ci --omit=dev && node scripts/package.js
aws s3 cp function.zip s3://<bucket>/escalations/lambda/function.zip
aws cloudformation deploy \
  --template-file infrastructure/template.yaml \
  --stack-name nova-escalations \
  --parameter-overrides ArtifactBucket=<bucket> ArtifactKey=escalations/lambda/function.zip \
  --capabilities CAPABILITY_IAM
```