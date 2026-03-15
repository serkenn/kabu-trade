export interface StockQuote {
  symbol: string;
  market: "JP" | "US";
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume?: number;
  timestamp: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Holding {
  id: string;
  symbol: string;
  market: "JP" | "US";
  quantity: number;
  avgCost: number;
}

export interface Order {
  id: string;
  symbol: string;
  market: "JP" | "US";
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  tradeType: "SPOT" | "MARGIN";
  quantity: number;
  price: number | null;
  filledPrice: number | null;
  filledQty: number;
  status: "PENDING" | "FILLED" | "PARTIALLY_FILLED" | "CANCELLED";
  createdAt: string;
}

export interface MarginPosition {
  id: string;
  symbol: string;
  market: "JP" | "US";
  side: "LONG" | "SHORT";
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  margin: number;
  status: "OPEN" | "CLOSED" | "LIQUIDATED";
  createdAt: string;
  closedAt: string | null;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
}
