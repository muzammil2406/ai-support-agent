import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Model } from 'mongoose';
import { Order } from '../../mongo/schemas/order.schema';

/**
 * LangChain tool: order lookup scoped to the authenticated customer.
 *
 * The tool is bound to the logged-in user's ID (injected from the JWT at the
 * start of every agent invocation — never parsed out of the chat message).
 * Behaviour:
 *  - No orderNumber given + exactly 1 order        → return that order in full.
 *  - No orderNumber given + multiple orders        → short list, ask which one.
 *  - No orderNumber given + zero orders            → clearly "no orders".
 *  - orderNumber given                             → that order, if owned by user.
 *  - No user context (support/admin/anonymous)     → global lookup by orderNumber.
 */
export function createOrderStatusTool(
  orderModel: Model<Order>,
  userId?: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_order_status',
    description:
      'Look up the customer\'s orders and their current status. Call this whenever the customer asks about an order, delivery or "my orders" — you may call it without an order number. If the customer has several orders it returns a short list; ask which order they mean before continuing. An optional orderNumber narrows the lookup to one order.',
    schema: z.object({
      orderNumber: z
        .string()
        .optional()
        .describe('Optional order number, e.g. ORD-1042, to narrow to one order'),
    }),
    func: async ({ orderNumber }) => {
      if (userId) {
        const ownedOrders = await orderModel
          .find({ userId })
          .sort({ createdAt: 'desc' })
          .lean()
          .exec();

        if (orderNumber) {
          const order = ownedOrders.find((o) => o.orderNumber === orderNumber);
          if (!order) {
            return JSON.stringify({
              found: false,
              message: `You don't have an order matching "${orderNumber}".`,
            });
          }
          return JSON.stringify(formatOrder(order), null, 2);
        }

        if (ownedOrders.length === 0) {
          return JSON.stringify({
            found: false,
            orders: [],
            message:
              'No orders were found for your account. Tell the customer there are no orders and offer to help with something else.',
          });
        }

        if (ownedOrders.length === 1) {
          return JSON.stringify(formatOrder(ownedOrders[0]), null, 2);
        }

        return JSON.stringify(
          {
            found: true,
            multiple: true,
            orders: ownedOrders.map((o) => ({
              orderNumber: o.orderNumber,
              itemName: o.itemName,
              status: o.status,
            })),
            message:
              'The customer has multiple orders. Ask which order they are asking about before giving status details.',
          },
          null,
          2,
        );
      }

      if (!orderNumber) {
        return JSON.stringify({
          found: false,
          message: 'No customer context — provide an order number to look up.',
        });
      }

      const order = await orderModel.findOne({ orderNumber }).lean().exec();
      if (!order) {
        return JSON.stringify({
          found: false,
          message: `No order was found for "${orderNumber}".`,
        });
      }
      return JSON.stringify(formatOrder(order), null, 2);
    },
  });
}

function formatOrder(order: {
  orderNumber: string;
  status: string;
  itemCount: number;
  itemName: string | null;
  total: number;
  createdAt: Date;
}): Record<string, unknown> {
  return {
    found: true,
    orderNumber: order.orderNumber,
    status: order.status,
    itemCount: order.itemCount,
    itemName: order.itemName,
    total: Number(order.total).toFixed(2),
    placedAt: order.createdAt.toISOString(),
  };
}