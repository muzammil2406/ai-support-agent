/**
 * Nova escalation consumer — standalone AWS Lambda (CommonJS, no build step).
 *
 * Triggered by SQS (event source mapping). For each batch of records:
 *   1. Logs the escalation to CloudWatch (the log group is created by the
 *      CloudFormation stack alongside the function).
 *   2. Writes an escalation record to DynamoDB (table `nova-escalations`).
 *   3. Optionally POSTs the escalation back to the Nova backend API if
 *      NOVA_API_CALLBACK_URL is configured (so the live dashboard can react).
 *
 * If a record fails, the whole batch is reported as a failure and SQS retries
 * it (per the queue's redrive policy), exactly how you want for a demo.
 */
'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.ESCALATION_TABLE_NAME ?? 'nova-escalations';
const API_CALLBACK_URL = process.env.NOVA_API_CALLBACK_URL; // optional

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/** Coerce the SQS body into the escalation record shape. */
function parseRecord(body) {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  return {
    ticketId: String(parsed.ticketId ?? 'unknown'),
    sessionId: String(parsed.sessionId ?? ''),
    userId: String(parsed.userId ?? ''),
    reason: String(parsed.reason ?? ''),
    category: parsed.category ? String(parsed.category) : undefined,
    escalatedAt: parsed.escalatedAt ?? new Date().toISOString(),
    source: String(parsed.source ?? 'unknown'),
  };
}

async function writeToDynamoDb(record) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ticketId: record.ticketId,
        sessionId: record.sessionId,
        userId: record.userId,
        reason: record.reason,
        category: record.category ?? 'uncategorized',
        escalatedAt: record.escalatedAt,
        source: record.source,
        receivedAt: new Date().toISOString(),
      },
    }),
  );
}

async function callbackToApi(record) {
  if (!API_CALLBACK_URL) return;
  const res = await fetch(API_CALLBACK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'support_ticket_escalated',
      ticketId: record.ticketId,
      sessionId: record.sessionId,
      reason: record.reason,
      escalatedAt: record.escalatedAt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Nova API callback failed with ${res.status}`);
  }
}

exports.handler = async (event) => {
  const records = event?.Records ?? [];
  console.log(
    JSON.stringify({
      message: 'SQS batch received',
      batchSize: records.length,
      eventSource: event?.Records?.[0]?.eventSource,
      eventSourceArn: event?.Records?.[0]?.eventSourceARN,
    }),
  );

  for (const record of records) {
    if (!record?.body) continue;

    let escalation;
    try {
      escalation = parseRecord(record.body);
    } catch (err) {
      // Malformed message — log loudly and continue; do not poison the batch.
      console.error('Skipping malformed escalation message', {
        body: record.body,
        error: err.message,
      });
      continue;
    }

    console.log(
      JSON.stringify({
        message: 'SUPPORT TICKET ESCALATED TO HUMAN',
        ticketId: escalation.ticketId,
        sessionId: escalation.sessionId,
        userId: escalation.userId,
        reason: escalation.reason,
        escalatedAt: escalation.escalatedAt,
      }),
    );

    try {
      await writeToDynamoDb(escalation);
      console.log(
        JSON.stringify({
          message: 'Escalation stored in DynamoDB',
          table: TABLE_NAME,
          ticketId: escalation.ticketId,
        }),
      );

      await callbackToApi(escalation);
    } catch (err) {
      console.error(
        JSON.stringify({
          message: 'Escalation processing failed',
          ticketId: escalation.ticketId,
          error: err.message,
        }),
      );
      throw err; // lets SQS retry the batch
    }
  }

  return { statusCode: 200, body: 'ok' };
};