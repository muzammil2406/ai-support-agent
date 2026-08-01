import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession } from '../chat/schemas/chat-session.schema';

export interface AnalyticsSummary {
  avgResolutionTimeByCategory: Array<{
    _id: string;
    avgResolutionMs: number;
    sessions: number;
  }>;
  topEscalationReasons: Array<{ _id: string; count: number }>;
  totals: Array<{
    _id: null;
    totalSessions: number;
    escalated: number;
    resolved: number;
  }>;
}

/**
 * Aggregation pipeline over the Mongo chat-sessions collection.
 * A single $facet pipeline computes:
 *   1. average resolution time per category
 *   2. top 5 escalation reasons
 *   3. overall totals
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(ChatSession.name) private readonly sessionModel: Model<ChatSession>,
  ) {}

  async summary(): Promise<AnalyticsSummary> {
    const [result] = await this.sessionModel.aggregate<any>([
      {
        $facet: {
          avgResolutionTimeByCategory: [
            {
              $match: {
                status: { $in: ['resolved', 'closed'] },
                resolvedAt: { $ne: null },
              },
            },
            {
              $project: {
                category: { $ifNull: ['$category', 'uncategorized'] },
                durationMs: {
                  $subtract: [
                    { $ifNull: ['$resolvedAt', '$closedAt'] },
                    '$startedAt',
                  ],
                },
              },
            },
            {
              $group: {
                _id: '$category',
                avgResolutionMs: { $avg: '$durationMs' },
                sessions: { $sum: 1 },
              },
            },
            { $sort: { avgResolutionMs: 1 } },
          ],
          topEscalationReasons: [
            {
              $match: {
                escalatedToHuman: true,
                escalationReason: { $exists: true, $ne: null },
              },
            },
            { $group: { _id: '$escalationReason', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                escalated: {
                  $sum: { $cond: ['$escalatedToHuman', 1, 0] },
                },
                resolved: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]).exec();

    return result as AnalyticsSummary;
  }
}
