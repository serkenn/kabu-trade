import { prisma } from "@kabu-trade/shared";
import { getQuote } from "./stocks/index.js";
import type { Market, OrderSide, OrderType, TradeType } from "@prisma/client";

interface PlaceOrderParams {
  userId: string;
  symbol: string;
  market: Market;
  side: OrderSide;
  type: OrderType;
  tradeType: TradeType;
  quantity: number;
  price?: number;
}

export async function placeOrder(params: PlaceOrderParams) {
  const { userId, symbol, market, side, type, tradeType, quantity, price } = params;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.isActive) throw new Error("アカウントが無効です");

  const quote = await getQuote(symbol, market);
  const executionPrice = type === "MARKET" ? quote.price : (price || quote.price);

  if (type === "LIMIT") {
    const canExecute =
      (side === "BUY" && quote.price <= executionPrice) ||
      (side === "SELL" && quote.price >= executionPrice);

    if (!canExecute) {
      return prisma.order.create({
        data: {
          userId, symbol, market, side, type, tradeType, quantity,
          price: executionPrice, status: "PENDING",
        },
      });
    }
  }

  if (tradeType === "MARGIN") {
    return executeMarginOrder(user, params, quote.price);
  }

  return executeSpotOrder(user, params, quote.price);
}

async function executeSpotOrder(
  user: { id: string; balance: number; balanceUsd: number },
  params: PlaceOrderParams,
  currentPrice: number
) {
  const { symbol, market, side, type, tradeType, quantity } = params;
  const totalCost = currentPrice * quantity;
  const balanceField = market === "US" ? "balanceUsd" : "balance";
  const currentBalance = market === "US" ? user.balanceUsd : user.balance;

  if (side === "BUY") {
    if (currentBalance < totalCost) throw new Error("残高不足です");

    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { [balanceField]: { decrement: totalCost } },
      });

      const existing = await tx.holding.findUnique({
        where: { userId_symbol_market: { userId: user.id, symbol, market } },
      });

      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvgCost = (existing.avgCost * existing.quantity + totalCost) / newQty;
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgCost: newAvgCost },
        });
      } else {
        await tx.holding.create({
          data: { userId: user.id, symbol, market, quantity, avgCost: currentPrice },
        });
      }

      await tx.transaction.create({
        data: {
          userId: user.id, type: "TRADE_PNL", amount: -totalCost,
          currency: market === "US" ? "USD" : "JPY",
          description: `${symbol} ${quantity}株 買付 @${currentPrice}`,
        },
      });

      return tx.order.create({
        data: {
          userId: user.id, symbol, market, side, type, tradeType, quantity,
          filledPrice: currentPrice, filledQty: quantity, status: "FILLED",
        },
      });
    });
  }

  // SELL
  const holding = await prisma.holding.findUnique({
    where: { userId_symbol_market: { userId: user.id, symbol, market } },
  });

  if (!holding || holding.quantity < quantity) {
    throw new Error("保有株数が不足しています");
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { [balanceField]: { increment: totalCost } },
    });

    const newQty = holding.quantity - quantity;
    if (newQty === 0) {
      await tx.holding.delete({ where: { id: holding.id } });
    } else {
      await tx.holding.update({ where: { id: holding.id }, data: { quantity: newQty } });
    }

    const pnl = (currentPrice - holding.avgCost) * quantity;
    await tx.transaction.create({
      data: {
        userId: user.id, type: "TRADE_PNL", amount: totalCost,
        currency: market === "US" ? "USD" : "JPY",
        description: `${symbol} ${quantity}株 売却 @${currentPrice} (損益: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(0)})`,
      },
    });

    return tx.order.create({
      data: {
        userId: user.id, symbol, market, side, type, tradeType, quantity,
        filledPrice: currentPrice, filledQty: quantity, status: "FILLED",
      },
    });
  });
}

async function executeMarginOrder(
  user: { id: string; balance: number; balanceUsd: number; marginRate?: number },
  params: PlaceOrderParams,
  currentPrice: number
) {
  const { userId, symbol, market, side, quantity } = params;
  const marginRate = (user as { marginRate: number }).marginRate || 3.0;
  const totalValue = currentPrice * quantity;
  const requiredMargin = totalValue / marginRate;
  const balanceField = market === "US" ? "balanceUsd" : "balance";
  const currentBalance = market === "US" ? user.balanceUsd : user.balance;

  if (currentBalance < requiredMargin) {
    throw new Error(`証拠金不足です (必要: ${requiredMargin.toFixed(0)})`);
  }

  const marginSide = side === "BUY" ? "LONG" : "SHORT";

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { [balanceField]: { decrement: requiredMargin } },
    });

    await tx.marginPosition.create({
      data: {
        userId, symbol, market, side: marginSide as "LONG" | "SHORT",
        quantity, entryPrice: currentPrice, margin: requiredMargin, status: "OPEN",
      },
    });

    await tx.transaction.create({
      data: {
        userId, type: "MARGIN_PNL", amount: -requiredMargin,
        currency: market === "US" ? "USD" : "JPY",
        description: `${symbol} 信用${marginSide === "LONG" ? "買い" : "売り"} ${quantity}株 @${currentPrice} (証拠金: ${requiredMargin.toFixed(0)})`,
      },
    });

    return tx.order.create({
      data: {
        userId, symbol, market, side, type: params.type, tradeType: "MARGIN",
        quantity, filledPrice: currentPrice, filledQty: quantity, status: "FILLED",
      },
    });
  });
}

export async function closeMarginPosition(userId: string, positionId: string) {
  const position = await prisma.marginPosition.findUniqueOrThrow({
    where: { id: positionId },
    include: { user: true },
  });

  if (position.userId !== userId && position.user.role !== "ADMIN") {
    throw new Error("権限がありません");
  }
  if (position.status !== "OPEN") {
    throw new Error("このポジションは既に決済されています");
  }

  const quote = await getQuote(position.symbol, position.market);
  const currentPrice = quote.price;

  const pnl = position.side === "LONG"
    ? (currentPrice - position.entryPrice) * position.quantity
    : (position.entryPrice - currentPrice) * position.quantity;

  const balanceField = position.market === "US" ? "balanceUsd" : "balance";
  const returnAmount = position.margin + pnl;

  return prisma.$transaction(async (tx) => {
    await tx.marginPosition.update({
      where: { id: positionId },
      data: { status: "CLOSED", exitPrice: currentPrice, closedAt: new Date() },
    });

    await tx.user.update({
      where: { id: position.userId },
      data: { [balanceField]: { increment: Math.max(0, returnAmount) } },
    });

    await tx.transaction.create({
      data: {
        userId: position.userId, type: "MARGIN_PNL", amount: returnAmount,
        currency: position.market === "US" ? "USD" : "JPY",
        description: `${position.symbol} 信用${position.side === "LONG" ? "買い" : "売り"}決済 @${currentPrice} (損益: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(0)})`,
      },
    });

    return { pnl, returnAmount, exitPrice: currentPrice };
  });
}
