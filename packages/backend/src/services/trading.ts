import { prisma } from "@kabu-trade/shared";
import { getQuote } from "./stocks/index.js";
import type { Market, OrderSide, OrderType, TradeType } from "@prisma/client";

/**
 * 日本株の値幅制限テーブル (東証ルール)
 * 前日終値の価格帯に応じた制限値幅
 */
const JP_PRICE_LIMITS: [number, number][] = [
  [100, 30],
  [200, 50],
  [500, 80],
  [700, 100],
  [1000, 150],
  [1500, 300],
  [2000, 400],
  [3000, 500],
  [5000, 700],
  [7000, 1000],
  [10000, 1500],
  [15000, 3000],
  [20000, 4000],
  [30000, 5000],
  [50000, 7000],
  [70000, 10000],
  [100000, 15000],
  [150000, 30000],
  [200000, 40000],
  [300000, 50000],
  [500000, 70000],
  [700000, 100000],
  [1000000, 150000],
  [1500000, 300000],
  [2000000, 400000],
  [3000000, 500000],
  [5000000, 700000],
  [7000000, 1000000],
  [10000000, 1500000],
  [15000000, 3000000],
  [20000000, 4000000],
  [30000000, 5000000],
  [50000000, 7000000],
  [Infinity, 10000000],
];

/** 前日終値に応じた値幅制限を取得 */
function getPriceLimit(previousClose: number): number {
  for (const [threshold, limit] of JP_PRICE_LIMITS) {
    if (previousClose < threshold) return limit;
  }
  return 10000000;
}

/** 現在価格がストップ高/ストップ安に達しているか判定 */
function checkPriceLimits(
  market: Market,
  currentPrice: number,
  previousClose: number,
  side: OrderSide
): { blocked: boolean; reason?: string } {
  if (market !== "JP") return { blocked: false };
  if (!previousClose || previousClose <= 0) return { blocked: false };

  const limit = getPriceLimit(previousClose);
  const upperLimit = previousClose + limit;
  const lowerLimit = Math.max(1, previousClose - limit);

  if (side === "BUY" && currentPrice >= upperLimit) {
    return {
      blocked: true,
      reason: `ストップ高 (¥${upperLimit.toLocaleString()}) に達しているため買い注文はできません`,
    };
  }
  if (side === "SELL" && currentPrice <= lowerLimit) {
    return {
      blocked: true,
      reason: `ストップ安 (¥${lowerLimit.toLocaleString()}) に達しているため売り注文はできません`,
    };
  }

  return { blocked: false };
}

/**
 * 約定時スリッページを計算する
 * ディレイ価格でのカンニングを防ぐため、成行注文に±0.05〜0.5%のランダム変動を加える
 * - 買い注文: 上方向に滑りやすい (実際の市場と同様)
 * - 売り注文: 下方向に滑りやすい
 */
function applySlippage(price: number, side: OrderSide, market: Market): number {
  // スリッページ率: 0.05% 〜 0.5% (対数正規分布的な偏り)
  const baseRate = 0.0005 + Math.random() * 0.0045; // 0.05% 〜 0.5%
  // 70%の確率で不利な方向、30%で有利な方向
  const direction = Math.random() < 0.7
    ? (side === "BUY" ? 1 : -1)   // 不利 (買いは上、売りは下)
    : (side === "BUY" ? -1 : 1);  // 有利

  const slippedPrice = price * (1 + direction * baseRate);

  // 日本株は整数、米国株は小数2桁
  if (market === "JP") {
    return Math.round(slippedPrice);
  }
  return Math.round(slippedPrice * 100) / 100;
}

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

interface ExecuteFxTradeParams {
  userId: string;
  fromCurrency: "JPY" | "USD";
  toCurrency: "JPY" | "USD";
  amount: number;
}

function getUsdJpyRate(): number {
  const raw = process.env.FX_USDJPY_RATE;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 150;
}

function roundCurrency(amount: number, currency: "JPY" | "USD"): number {
  if (currency === "JPY") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

export function getFxRate() {
  return { pair: "USD/JPY", rate: getUsdJpyRate() };
}

export async function placeOrder(params: PlaceOrderParams) {
  const { userId, symbol, market, side, type, tradeType, quantity, price } = params;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.isActive) throw new Error("アカウントが無効です");

  const quote = await getQuote(symbol, market);

  // S株判定 (日本株で100株未満)
  const isOddLot = market === "JP" && quantity < 100;

  if (isOddLot) {
    // S株ルール: 成行注文のみ
    if (type === "LIMIT") {
      throw new Error("S株（単元未満株）は成行注文のみ対応です");
    }
    // S株ルール: 信用取引不可
    if (tradeType === "MARGIN") {
      throw new Error("S株（単元未満株）は信用取引できません。現物のみ対応です");
    }
  }

  // 値幅制限チェック (日本株のストップ高/ストップ安)
  const limitCheck = checkPriceLimits(market, quote.price, quote.previousClose, side);
  if (limitCheck.blocked) {
    throw new Error(limitCheck.reason!);
  }

  // 約定価格の決定
  let executionPrice: number;
  if (isOddLot) {
    // S株: 前日終値で約定 (SBI証券ルール準拠)
    if (!quote.previousClose || quote.previousClose <= 0) {
      throw new Error("前日終値が取得できないため、S株注文を処理できません");
    }
    executionPrice = quote.previousClose;
  } else if (type === "MARKET") {
    // 通常成行: スリッページ適用
    executionPrice = applySlippage(quote.price, side, market);
  } else {
    // 指値
    executionPrice = price || quote.price;
  }

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
    return executeMarginOrder(user, params, executionPrice);
  }

  return executeSpotOrder(user, params, executionPrice);
}

export async function executeFxTrade(params: ExecuteFxTradeParams) {
  const { userId, fromCurrency, toCurrency, amount } = params;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.isActive) throw new Error("アカウントが無効です");

  const rate = getUsdJpyRate();
  const sourceAmount = roundCurrency(amount, fromCurrency);
  const receiveAmount = fromCurrency === "JPY"
    ? roundCurrency(sourceAmount / rate, "USD")
    : roundCurrency(sourceAmount * rate, "JPY");

  if (receiveAmount <= 0) {
    throw new Error("受取金額が0になるため両替できません");
  }

  const sourceBalance = fromCurrency === "JPY" ? user.balance : user.balanceUsd;
  if (sourceBalance < sourceAmount) {
    throw new Error(`${fromCurrency}残高が不足しています`);
  }

  const sourceField = fromCurrency === "JPY" ? "balance" : "balanceUsd";
  const destinationField = toCurrency === "JPY" ? "balance" : "balanceUsd";
  const tradeLabel = `${fromCurrency}→${toCurrency}`;
  const receiveDisplay = toCurrency === "JPY" ? `¥${receiveAmount.toLocaleString()}` : `$${receiveAmount.toLocaleString()}`;

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        [sourceField]: { decrement: sourceAmount },
        [destinationField]: { increment: receiveAmount },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: "FX",
        amount: -sourceAmount,
        currency: fromCurrency,
        description: `為替両替 ${tradeLabel} 約定 (レート: ${rate.toLocaleString()} / 受取: ${receiveDisplay})`,
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: "FX",
        amount: receiveAmount,
        currency: toCurrency,
        description: `為替両替 ${tradeLabel} 入金 (レート: ${rate.toLocaleString()} / 受取: ${receiveDisplay})`,
      },
    });

    return {
      rate,
      fromCurrency,
      toCurrency,
      sourceAmount,
      receiveAmount,
    };
  });
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
