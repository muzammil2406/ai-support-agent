import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * LangChain tool: order-status lookup against Postgres.
 * The agent only calls this with a real order number — it never fabricates
 * order details (enforced by the system prompt + this tool's own lookup).
 */
export function createOrderStatusTool(
  prisma: PrismaService,
  userId?: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_order_status',
    description:
      'Look up a customer order by its order number (e.g. "ORD-1042") and return its current status, item count, total and placed date. Use whenever the customer asks about an order or delivery status.',
    schema: z.object({
      orderNumber: z.string().describe('The order number, e.g. ORD-1042'),
    }),
    func: async ({ orderNumber }) => {
      const order = await prisma.order.findFirst({
        where: userId ? { orderNumber, userId } : { orderNumber },
        include: { user: { select: { email: true } } },
      });

      if (!order) {
        return JSON.stringify({
          found: false,
          message: `No order was found for "${orderNumber}". Ask the customer to double-check the order number.`,
        });
      }

      return JSON.stringify(
        {
          found: true,
          orderNumber: order.orderNumber,
          status: order.status,
          itemCount: order.itemCount,
          total: Number(order.total).toFixed(2),
          placedAt: order.createdAt.toISOString(),
          customerEmail: order.user?.email ?? null,
        },
        null,
        2,
      );
    },
  });
}
