"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CandleData } from "@/types";

interface OrderMarker {
  time: number;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
}

interface Drawing {
  id: string;
  type: DrawingTool;
  x1: number; y1: number;
  x2: number; y2: number;
  color?: string;
}

interface Props {
  symbol: string;
  market: "JP" | "US";
}

type DrawingTool = "none" | "trendline" | "ray" | "hline" | "vline" | "channel" | "rect" | "fib";
type OverlayIndicator = "sma" | "bb" | "ichimoku";
type SubIndicator = "volume" | "macd" | "rsi";

// ==================== 計算ユーティリティ ====================

function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

function calcBollingerBands(data: number[], period: number = 20, mult: number = 2) {
  const sma = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) { upper.push(null); lower.push(null); continue; }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (data[j] - sma[i]!) ** 2;
    const stdDev = Math.sqrt(sumSq / period);
    upper.push(sma[i]! + mult * stdDev);
    lower.push(sma[i]! - mult * stdDev);
  }
  return { middle: sma, upper, lower };
}

function calcRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [null];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
    if (i < period) { result.push(null); continue; }
    if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
    } else {
      const prevRsi = result[i - 1]!;
      const prevAvgGain = (100 / (100 - prevRsi) - 1) > 0
        ? (100 - prevRsi) !== 0 ? gains[i - 1] : 0
        : 0;
      // Simplified Wilder's smoothing
      const avgGain = (gains.slice(Math.max(0, i - period), i).reduce((a, b) => a + b, 0)) / period;
      const avgLoss = (losses.slice(Math.max(0, i - period), i).reduce((a, b) => a + b, 0)) / period;
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
      void prevAvgGain;
    }
  }
  return result;
}

function calcMACD(data: number[], fast: number = 12, slow: number = 26, signal: number = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) { macdLine.push(null); continue; }
    macdLine.push(emaFast[i]! - emaSlow[i]!);
  }
  const macdValues = macdLine.filter((v): v is number => v !== null);
  const signalLine = calcEMA(macdValues, signal);
  // Align signal line with macd line
  const result: { macd: number | null; signal: number | null; histogram: number | null }[] = [];
  let si = 0;
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null) {
      result.push({ macd: null, signal: null, histogram: null });
    } else {
      const s = signalLine[si] ?? null;
      result.push({
        macd: macdLine[i],
        signal: s,
        histogram: s !== null ? macdLine[i]! - s : null,
      });
      si++;
    }
  }
  return result;
}

function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[j];
      result.push(sum / period);
    } else {
      result.push(data[i] * k + (result[i - 1] ?? data[i]) * (1 - k));
    }
  }
  return result;
}

// 一目均衡表
function calcIchimoku(candles: CandleData[]) {
  const tenkan: (number | null)[] = [];
  const kijun: (number | null)[] = [];
  const senkouA: (number | null)[] = [];
  const senkouB: (number | null)[] = [];
  const chikou: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    // 転換線 (9)
    if (i >= 8) {
      let h = -Infinity, l = Infinity;
      for (let j = i - 8; j <= i; j++) { h = Math.max(h, candles[j].high); l = Math.min(l, candles[j].low); }
      tenkan.push((h + l) / 2);
    } else { tenkan.push(null); }

    // 基準線 (26)
    if (i >= 25) {
      let h = -Infinity, l = Infinity;
      for (let j = i - 25; j <= i; j++) { h = Math.max(h, candles[j].high); l = Math.min(l, candles[j].low); }
      kijun.push((h + l) / 2);
    } else { kijun.push(null); }

    // 先行スパンA (転換+基準)/2 → 26期間先
    if (tenkan[i] !== null && kijun[i] !== null) {
      senkouA.push((tenkan[i]! + kijun[i]!) / 2);
    } else { senkouA.push(null); }

    // 先行スパンB (52期間高安)/2 → 26期間先
    if (i >= 51) {
      let h = -Infinity, l = Infinity;
      for (let j = i - 51; j <= i; j++) { h = Math.max(h, candles[j].high); l = Math.min(l, candles[j].low); }
      senkouB.push((h + l) / 2);
    } else { senkouB.push(null); }

    // 遅行スパン = 終値を26期間前に表示
    chikou.push(candles[i].close);
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ==================== メインコンポーネント ====================

export default function PriceChart({ symbol, market }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleSeriesRef = useRef<any>(null);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [interval, setInterval] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderMarker[]>([]);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("none");
  const [drawingColor, setDrawingColor] = useState("#F59E0B");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const drawingStartRef = useRef<{ x: number; y: number } | null>(null);
  const [tempLine, setTempLine] = useState<{ type: DrawingTool; x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Indicator toggles
  const [overlayIndicators, setOverlayIndicators] = useState<Set<OverlayIndicator>>(() => new Set<OverlayIndicator>(["sma"]));
  const [subIndicators, setSubIndicators] = useState<Set<SubIndicator>>(() => new Set<SubIndicator>(["volume"]));
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  // OHLC legend
  const [legendData, setLegendData] = useState<{
    time: string; open: number; high: number; low: number; close: number; change: number; changePercent: number;
    sma5?: number; sma25?: number; sma75?: number;
  } | null>(null);

  const toggleOverlay = (ind: OverlayIndicator) => {
    setOverlayIndicators(prev => {
      const next = new Set(prev);
      next.has(ind) ? next.delete(ind) : next.add(ind);
      return next;
    });
  };

  const toggleSub = (ind: SubIndicator) => {
    setSubIndicators(prev => {
      const next = new Set(prev);
      next.has(ind) ? next.delete(ind) : next.add(ind);
      return next;
    });
  };

  // Fetch candles
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setChartError(null);
    const params = new URLSearchParams({ symbol, market, days: String(days) });
    if (interval) params.set("interval", interval);
    fetch(`/api/stocks/candles?${params}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          if (data.length === 0) setChartError("チャートデータが取得できませんでした");
          setCandles(data);
        } else {
          setChartError(data?.error || "不正なデータ形式");
        }
      })
      .catch((e) => setChartError(e.message || "チャートデータの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [symbol, market, days, interval]);

  // Fetch orders for markers
  useEffect(() => {
    if (!symbol) return;
    fetch(`/api/trade/orders?limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const markers: OrderMarker[] = data
          .filter((o: { symbol: string; status: string; filledPrice: number | null }) =>
            o.symbol === symbol && o.status === "FILLED" && o.filledPrice
          )
          .map((o: { createdAt: string; side: "BUY" | "SELL"; filledPrice: number; filledQty: number }) => ({
            time: Math.floor(new Date(o.createdAt).getTime() / 1000 / 86400) * 86400,
            side: o.side,
            price: o.filledPrice,
            quantity: o.filledQty,
          }));
        setOrders(markers);
      })
      .catch(() => {});
  }, [symbol]);

  // Build chart
  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current || candles.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    let resizeObserver: ResizeObserver;

    const closes = candles.map(c => c.close);

    // SMA計算
    const sma5 = overlayIndicators.has("sma") ? calcSMA(closes, 5) : null;
    const sma25 = overlayIndicators.has("sma") ? calcSMA(closes, 25) : null;
    const sma75 = overlayIndicators.has("sma") ? calcSMA(closes, 75) : null;

    // ボリンジャーバンド
    const bb = overlayIndicators.has("bb") ? calcBollingerBands(closes, 20, 2) : null;

    // 一目均衡表
    const ichimoku = overlayIndicators.has("ichimoku") ? calcIchimoku(candles) : null;

    // RSI
    const rsi = subIndicators.has("rsi") ? calcRSI(closes, 14) : null;

    // MACD
    const macd = subIndicators.has("macd") ? calcMACD(closes) : null;

    // 色設定 (日本慣例: 陽線=赤, 陰線=青)
    const upColor = market === "JP" ? "#EF4444" : "#22C55E";
    const downColor = market === "JP" ? "#2563EB" : "#EF4444";

    // サブチャートの高さ計算
    const subCount = (subIndicators.has("volume") ? 1 : 0) + (subIndicators.has("rsi") ? 1 : 0) + (subIndicators.has("macd") ? 1 : 0);
    const mainBottom = subCount > 0 ? 0.08 + subCount * 0.12 : 0.05;

    import("lightweight-charts").then(({ createChart, CrosshairMode, LineStyle }) => {
      if (!containerRef.current || !wrapperRef.current) return;
      containerRef.current.innerHTML = "";

      const rect = wrapperRef.current.getBoundingClientRect();

      chart = createChart(containerRef.current, {
        width: rect.width,
        height: rect.height,
        layout: {
          background: { color: "#0a0e17" },
          textColor: "#6B7280",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1a1f2e" },
          horzLines: { color: "#1a1f2e" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#4B5563", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#374151" },
          horzLine: { color: "#4B5563", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#374151" },
        },
        rightPriceScale: {
          borderColor: "#1F2937",
          scaleMargins: { top: 0.02, bottom: mainBottom },
        },
        timeScale: {
          borderColor: "#1F2937",
          timeVisible: !!interval,
          secondsVisible: false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true },
      });

      chartRef.current = chart;

      // ==================== ローソク足 ====================
      const candleSeries = chart.addCandlestickSeries({
        upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
      candleSeriesRef.current = candleSeries;

      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as never,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }))
      );

      // Order markers
      if (orders.length > 0) {
        const markers = orders.map((o) => ({
          time: o.time as never,
          position: o.side === "BUY" ? "belowBar" as const : "aboveBar" as const,
          color: o.side === "BUY" ? "#EF4444" : "#22C55E",
          shape: o.side === "BUY" ? "arrowUp" as const : "arrowDown" as const,
          text: `${o.side === "BUY" ? "買" : "売"} ${o.quantity}@${o.price.toLocaleString()}`,
        }));
        candleSeries.setMarkers(markers.sort((a: { time: number }, b: { time: number }) => a.time - b.time));
      }

      // ==================== SMA ====================
      if (sma5) {
        const smaSeries5 = chart.addLineSeries({ color: "#F59E0B", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        smaSeries5.setData(candles.map((c, i) => sma5[i] !== null ? { time: c.time as never, value: sma5[i] } : null).filter(Boolean));
      }
      if (sma25) {
        const smaSeries25 = chart.addLineSeries({ color: "#EC4899", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        smaSeries25.setData(candles.map((c, i) => sma25[i] !== null ? { time: c.time as never, value: sma25[i] } : null).filter(Boolean));
      }
      if (sma75) {
        const smaSeries75 = chart.addLineSeries({ color: "#8B5CF6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        smaSeries75.setData(candles.map((c, i) => sma75[i] !== null ? { time: c.time as never, value: sma75[i] } : null).filter(Boolean));
      }

      // ==================== ボリンジャーバンド ====================
      if (bb) {
        const bbMiddle = chart.addLineSeries({ color: "#6366F1", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        bbMiddle.setData(candles.map((c, i) => bb.middle[i] !== null ? { time: c.time as never, value: bb.middle[i] } : null).filter(Boolean));

        const bbUpper = chart.addLineSeries({ color: "#6366F180", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
        bbUpper.setData(candles.map((c, i) => bb.upper[i] !== null ? { time: c.time as never, value: bb.upper[i] } : null).filter(Boolean));

        const bbLower = chart.addLineSeries({ color: "#6366F180", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
        bbLower.setData(candles.map((c, i) => bb.lower[i] !== null ? { time: c.time as never, value: bb.lower[i] } : null).filter(Boolean));
      }

      // ==================== 一目均衡表 ====================
      if (ichimoku) {
        const tenkanSeries = chart.addLineSeries({ color: "#EF4444", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        tenkanSeries.setData(candles.map((c, i) => ichimoku.tenkan[i] !== null ? { time: c.time as never, value: ichimoku.tenkan[i] } : null).filter(Boolean));

        const kijunSeries = chart.addLineSeries({ color: "#3B82F6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        kijunSeries.setData(candles.map((c, i) => ichimoku.kijun[i] !== null ? { time: c.time as never, value: ichimoku.kijun[i] } : null).filter(Boolean));

        // 先行スパンA (26期間先にシフト) — 描画可能範囲のみ
        const senkouAData = candles.map((c, i) => ichimoku.senkouA[i] !== null ? { time: c.time as never, value: ichimoku.senkouA[i] } : null).filter(Boolean);
        const senkouASeries = chart.addLineSeries({ color: "#22C55E80", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        senkouASeries.setData(senkouAData);

        // 先行スパンB
        const senkouBData = candles.map((c, i) => ichimoku.senkouB[i] !== null ? { time: c.time as never, value: ichimoku.senkouB[i] } : null).filter(Boolean);
        const senkouBSeries = chart.addLineSeries({ color: "#EF444480", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        senkouBSeries.setData(senkouBData);

        // 遅行スパン (26期間前にシフト)
        const chikouData = candles.slice(0, -26).map((c, i) => ({ time: c.time as never, value: ichimoku.chikou[i + 26] }));
        if (chikouData.length > 0) {
          const chikouSeries = chart.addLineSeries({ color: "#A855F7", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          chikouSeries.setData(chikouData);
        }
      }

      // ==================== 出来高 (サブパネル) ====================
      if (subIndicators.has("volume")) {
        const volTop = 1 - mainBottom + 0.02;
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: "volume" },
          priceScaleId: "vol",
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: volTop, bottom: subCount > 1 ? 0.02 + (subCount - 1) * 0.12 : 0.02 },
        });
        volumeSeries.setData(
          candles.map((c) => ({
            time: c.time as never,
            value: c.volume,
            color: c.close >= c.open ? upColor + "60" : downColor + "60",
          }))
        );
      }

      // ==================== RSI (サブパネル) ====================
      if (rsi) {
        const rsiSeries = chart.addLineSeries({
          color: "#F59E0B",
          lineWidth: 1.5,
          priceScaleId: "rsi",
          priceLineVisible: false,
          lastValueVisible: false,
        });
        rsiSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.88, bottom: 0.02 },
        });
        rsiSeries.setData(
          candles.map((c, i) => rsi[i] !== null ? { time: c.time as never, value: rsi[i] } : null).filter(Boolean)
        );
        // 70/30ライン
        const rsi70 = chart.addLineSeries({
          color: "#EF444440", lineWidth: 1, lineStyle: LineStyle.Dashed,
          priceScaleId: "rsi", priceLineVisible: false, lastValueVisible: false,
        });
        rsi70.setData(candles.map((c) => ({ time: c.time as never, value: 70 })));
        const rsi30 = chart.addLineSeries({
          color: "#22C55E40", lineWidth: 1, lineStyle: LineStyle.Dashed,
          priceScaleId: "rsi", priceLineVisible: false, lastValueVisible: false,
        });
        rsi30.setData(candles.map((c) => ({ time: c.time as never, value: 30 })));
      }

      // ==================== MACD (サブパネル) ====================
      if (macd) {
        const macdLine = chart.addLineSeries({
          color: "#3B82F6", lineWidth: 1.5, priceScaleId: "macd",
          priceLineVisible: false, lastValueVisible: false,
        });
        macdLine.priceScale().applyOptions({
          scaleMargins: { top: 0.88, bottom: 0.02 },
        });
        macdLine.setData(
          candles.map((c, i) => macd[i].macd !== null ? { time: c.time as never, value: macd[i].macd } : null).filter(Boolean)
        );

        const signalLine = chart.addLineSeries({
          color: "#EF4444", lineWidth: 1, priceScaleId: "macd",
          priceLineVisible: false, lastValueVisible: false,
        });
        signalLine.setData(
          candles.map((c, i) => macd[i].signal !== null ? { time: c.time as never, value: macd[i].signal } : null).filter(Boolean)
        );

        const histogramSeries = chart.addHistogramSeries({
          priceScaleId: "macd",
        });
        histogramSeries.setData(
          candles.map((c, i) => macd[i].histogram !== null ? {
            time: c.time as never,
            value: macd[i].histogram,
            color: macd[i].histogram! >= 0 ? "#22C55E80" : "#EF444480",
          } : null).filter(Boolean)
        );
      }

      chart.timeScale().fitContent();

      // ==================== クロスヘア凡例 ====================
      chart.subscribeCrosshairMove((param: { time?: unknown; seriesData?: Map<unknown, unknown> }) => {
        if (!param.time) {
          // 最新データを表示
          const last = candles[candles.length - 1];
          if (last) {
            const prev = candles.length > 1 ? candles[candles.length - 2].close : last.open;
            setLegendData({
              time: typeof last.time === "string" ? last.time : new Date(last.time * 1000).toLocaleDateString("ja-JP"),
              open: last.open, high: last.high, low: last.low, close: last.close,
              change: last.close - prev,
              changePercent: prev ? ((last.close - prev) / prev) * 100 : 0,
              sma5: sma5 ? sma5[candles.length - 1] ?? undefined : undefined,
              sma25: sma25 ? sma25[candles.length - 1] ?? undefined : undefined,
              sma75: sma75 ? sma75[candles.length - 1] ?? undefined : undefined,
            });
          }
          return;
        }
        const candleData = param.seriesData?.get(candleSeries);
        if (candleData && typeof candleData === "object" && "close" in candleData) {
          const d = candleData as { open: number; high: number; low: number; close: number };
          const idx = candles.findIndex(c => c.time === param.time);
          const prev = idx > 0 ? candles[idx - 1].close : d.open;
          setLegendData({
            time: typeof param.time === "string" ? param.time : new Date((param.time as number) * 1000).toLocaleDateString("ja-JP"),
            open: d.open, high: d.high, low: d.low, close: d.close,
            change: d.close - prev,
            changePercent: prev ? ((d.close - prev) / prev) * 100 : 0,
            sma5: sma5 && idx >= 0 ? sma5[idx] ?? undefined : undefined,
            sma25: sma25 && idx >= 0 ? sma25[idx] ?? undefined : undefined,
            sma75: sma75 && idx >= 0 ? sma75[idx] ?? undefined : undefined,
          });
        }
      });

      // 初期凡例
      if (candles.length > 0) {
        const last = candles[candles.length - 1];
        const prev = candles.length > 1 ? candles[candles.length - 2].close : last.open;
        setLegendData({
          time: typeof last.time === "string" ? last.time : new Date(last.time * 1000).toLocaleDateString("ja-JP"),
          open: last.open, high: last.high, low: last.low, close: last.close,
          change: last.close - prev,
          changePercent: prev ? ((last.close - prev) / prev) * 100 : 0,
          sma5: sma5 ? sma5[candles.length - 1] ?? undefined : undefined,
          sma25: sma25 ? sma25[candles.length - 1] ?? undefined : undefined,
          sma75: sma75 ? sma75[candles.length - 1] ?? undefined : undefined,
        });
      }

      resizeObserver = new ResizeObserver(() => {
        if (wrapperRef.current) {
          const r = wrapperRef.current.getBoundingClientRect();
          chart.applyOptions({ width: r.width, height: r.height });
          syncCanvas();
        }
      });
      resizeObserver.observe(wrapperRef.current);
    });

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (chart) chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, market, orders, interval, overlayIndicators, subIndicators]);

  // Draw a single shape on the canvas
  const drawShape = useCallback((ctx: CanvasRenderingContext2D, d: Drawing | { type: DrawingTool; x1: number; y1: number; x2: number; y2: number; color?: string }, w: number, h: number, isTemp: boolean) => {
    const color = d.color || "#F59E0B";
    ctx.strokeStyle = isTemp ? color + "80" : color;
    ctx.fillStyle = color + "15";
    ctx.lineWidth = 1.5;
    ctx.setLineDash(isTemp ? [4, 4] : []);
    ctx.font = "10px monospace";

    switch (d.type) {
      case "trendline":
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();
        break;

      case "ray": {
        // 延長線: 始点→終点方向に画面端まで延長
        const dx = d.x2 - d.x1;
        const dy = d.y2 - d.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) break;
        const scale = Math.max(w, h) * 2 / len;
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x1 + dx * scale, d.y1 + dy * scale);
        ctx.stroke();
        break;
      }

      case "hline":
        ctx.beginPath();
        ctx.moveTo(0, d.y1);
        ctx.lineTo(w, d.y1);
        ctx.stroke();
        break;

      case "vline":
        ctx.beginPath();
        ctx.moveTo(d.x1, 0);
        ctx.lineTo(d.x1, h);
        ctx.stroke();
        break;

      case "channel": {
        // 平行チャネル: トレンドラインとその平行線
        const cdx = d.x2 - d.x1;
        const cdy = d.y2 - d.y1;
        const clen = Math.sqrt(cdx * cdx + cdy * cdy);
        if (clen === 0) break;
        // チャネル幅は描画時のy差分で決定 (ドラッグの垂直距離の半分)
        const perpX = -cdy / clen * 30;
        const perpY = cdx / clen * 30;
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d.x1 + perpX, d.y1 + perpY);
        ctx.lineTo(d.x2 + perpX, d.y2 + perpY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d.x1 - perpX, d.y1 - perpY);
        ctx.lineTo(d.x2 - perpX, d.y2 - perpY);
        ctx.stroke();
        // 塗りつぶし
        ctx.beginPath();
        ctx.moveTo(d.x1 + perpX, d.y1 + perpY);
        ctx.lineTo(d.x2 + perpX, d.y2 + perpY);
        ctx.lineTo(d.x2 - perpX, d.y2 - perpY);
        ctx.lineTo(d.x1 - perpX, d.y1 - perpY);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case "rect": {
        const rx = Math.min(d.x1, d.x2);
        const ry = Math.min(d.y1, d.y2);
        const rw = Math.abs(d.x2 - d.x1);
        const rh = Math.abs(d.y2 - d.y1);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.fillRect(rx, ry, rw, rh);
        break;
      }

      case "fib": {
        // フィボナッチ・リトレースメント
        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const fibColors = ["#EF4444", "#F59E0B", "#22C55E", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444"];
        const top = Math.min(d.y1, d.y2);
        const bottom = Math.max(d.y1, d.y2);
        const range = bottom - top;
        const left = Math.min(d.x1, d.x2);
        const right = Math.max(d.x1, d.x2);

        for (let i = 0; i < fibLevels.length; i++) {
          const y = d.y1 < d.y2 ? top + range * fibLevels[i] : bottom - range * fibLevels[i];
          ctx.strokeStyle = isTemp ? fibColors[i] + "80" : fibColors[i];
          ctx.lineWidth = fibLevels[i] === 0 || fibLevels[i] === 1 ? 1.5 : 1;
          ctx.setLineDash(fibLevels[i] === 0.5 ? [] : [3, 3]);
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(right, y);
          ctx.stroke();
          // ラベル
          ctx.fillStyle = isTemp ? fibColors[i] + "80" : fibColors[i];
          ctx.fillText(`${(fibLevels[i] * 100).toFixed(1)}%`, right + 4, y + 3);
        }
        // 背景
        ctx.fillStyle = color + "08";
        ctx.fillRect(left, top, right - left, range);
        break;
      }
    }
    ctx.setLineDash([]);
  }, []);

  // Draw overlay canvas
  const syncCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const d of drawings) {
      drawShape(ctx, d, canvas.width, canvas.height, false);
    }
    if (tempLine) {
      drawShape(ctx, tempLine, canvas.width, canvas.height, true);
    }
  }, [drawings, tempLine, drawShape]);

  useEffect(() => { syncCanvas(); }, [syncCanvas]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (drawingTool === "none") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 1クリックで完了するツール
    if (drawingTool === "hline") {
      setDrawings((prev) => [...prev, { id: crypto.randomUUID(), type: "hline", x1: 0, y1: y, x2: rect.width, y2: y, color: drawingColor }]);
      syncCanvas();
      return;
    }
    if (drawingTool === "vline") {
      setDrawings((prev) => [...prev, { id: crypto.randomUUID(), type: "vline", x1: x, y1: 0, x2: x, y2: rect.height, color: drawingColor }]);
      syncCanvas();
      return;
    }
    // 2点ドラッグのツール
    drawingStartRef.current = { x, y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!drawingStartRef.current) return;
    if (drawingTool === "none" || drawingTool === "hline" || drawingTool === "vline") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTempLine({
      type: drawingTool,
      x1: drawingStartRef.current.x, y1: drawingStartRef.current.y,
      x2: e.clientX - rect.left, y2: e.clientY - rect.top,
    });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!drawingStartRef.current) return;
    if (drawingTool === "none" || drawingTool === "hline" || drawingTool === "vline") {
      drawingStartRef.current = null;
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const start = drawingStartRef.current;
    if (Math.abs(x - start.x) > 5 || Math.abs(y - start.y) > 5) {
      setDrawings((prev) => [...prev, {
        id: crypto.randomUUID(), type: drawingTool,
        x1: start.x, y1: start.y, x2: x, y2: y,
        color: drawingColor,
      }]);
    }
    drawingStartRef.current = null;
    setTempLine(null);
  };

  const undoDrawing = () => { setDrawings((prev) => prev.slice(0, -1)); };
  const clearDrawings = () => { setDrawings([]); setTempLine(null); setDrawingTool("none"); };

  const intradayPeriods = market === "JP" ? [
    { label: "1分", iv: "1m" },
    { label: "5分", iv: "5m" },
    { label: "15分", iv: "15m" },
    { label: "1時間", iv: "1h" },
  ] : [];

  const dailyPeriods = [
    { label: "1M", value: 30 },
    { label: "3M", value: 90 },
    { label: "6M", value: 180 },
    { label: "1Y", value: 365 },
  ];

  const tools: { id: DrawingTool; label: string; icon: string }[] = [
    { id: "trendline", label: "トレンドライン", icon: "╲" },
    { id: "ray", label: "延長線", icon: "↗" },
    { id: "hline", label: "水平線", icon: "─" },
    { id: "vline", label: "垂直線", icon: "│" },
    { id: "channel", label: "平行チャネル", icon: "⫽" },
    { id: "rect", label: "矩形", icon: "▭" },
    { id: "fib", label: "フィボナッチ", icon: "F" },
  ];

  const drawingColors = ["#F59E0B", "#EF4444", "#3B82F6", "#22C55E", "#A855F7", "#EC4899", "#FFFFFF"];

  const isJP = market === "JP";
  const currency = isJP ? "¥" : "$";
  const fmtPrice = (v: number) => isJP ? v.toLocaleString() : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="h-full flex flex-col bg-[#0a0e17] relative">
      {/* ==================== ツールバー ==================== */}
      <div className="absolute top-1 md:top-2 left-1 md:left-3 z-10 flex gap-0.5 md:gap-1 items-center flex-wrap max-w-[calc(100%-8px)]">
        {/* 日中足 */}
        {intradayPeriods.map((p) => (
          <button
            key={p.iv}
            onClick={() => setInterval(p.iv)}
            className={`px-1.5 md:px-2 py-1 md:py-0.5 rounded text-[9px] md:text-[10px] font-bold transition-colors ${
              interval === p.iv ? "bg-brand-600 text-white" : "bg-gray-800/80 text-gray-400 hover:bg-gray-700/80"
            }`}
          >
            {p.label}
          </button>
        ))}
        {intradayPeriods.length > 0 && <div className="w-px h-4 bg-gray-700 mx-0.5" />}

        {/* 日足期間 */}
        {dailyPeriods.map((p) => (
          <button
            key={p.value}
            onClick={() => { setInterval(null); setDays(p.value); }}
            className={`px-1.5 md:px-2 py-1 md:py-0.5 rounded text-[9px] md:text-[10px] font-bold transition-colors ${
              interval === null && days === p.value ? "bg-brand-600 text-white" : "bg-gray-800/80 text-gray-400 hover:bg-gray-700/80"
            }`}
          >
            {p.label}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-700 mx-0.5 hidden md:block" />

        {/* テクニカル指標 */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              showIndicatorMenu ? "bg-brand-600 text-white" : "bg-gray-800/80 text-gray-400 hover:bg-gray-700/80"
            }`}
          >
            指標
          </button>
          {showIndicatorMenu && (
            <div className="absolute top-7 left-0 bg-gray-800 border border-gray-700 rounded shadow-xl p-2 w-44 z-50 space-y-1">
              <div className="text-[9px] text-gray-500 font-bold mb-1">メインチャート</div>
              {([
                ["sma", "移動平均線 (5/25/75)"],
                ["bb", "ボリンジャーバンド"],
                ["ichimoku", "一目均衡表"],
              ] as [OverlayIndicator, string][]).map(([key, label]) => (
                <button key={key} onClick={() => toggleOverlay(key)}
                  className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors ${
                    overlayIndicators.has(key) ? "bg-brand-600/20 text-brand-400" : "text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {overlayIndicators.has(key) ? "✓ " : "　"}{label}
                </button>
              ))}
              <div className="border-t border-gray-700 my-1" />
              <div className="text-[9px] text-gray-500 font-bold mb-1">サブチャート</div>
              {([
                ["volume", "出来高"],
                ["rsi", "RSI (14)"],
                ["macd", "MACD"],
              ] as [SubIndicator, string][]).map(([key, label]) => (
                <button key={key} onClick={() => toggleSub(key)}
                  className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors ${
                    subIndicators.has(key) ? "bg-brand-600/20 text-brand-400" : "text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {subIndicators.has(key) ? "✓ " : "　"}{label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-700 mx-0.5 hidden md:block" />

        {/* 描画ツール */}
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setDrawingTool(drawingTool === t.id ? "none" : t.id)}
            title={t.label}
            className={`hidden md:inline-block px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors ${
              drawingTool === t.id ? "bg-yellow-600 text-white" : "bg-gray-800/80 text-gray-400 hover:bg-gray-700/80"
            }`}
          >
            {t.icon}
          </button>
        ))}

        {/* 描画色 */}
        {drawingTool !== "none" && (
          <div className="hidden md:flex items-center gap-0.5 ml-0.5">
            {drawingColors.map((c) => (
              <button
                key={c}
                onClick={() => setDrawingColor(c)}
                className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                  drawingColor === c ? "border-white scale-125" : "border-gray-600"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        {drawings.length > 0 && (
          <>
            <button onClick={undoDrawing} title="1つ戻す"
              className="hidden md:inline-block px-1.5 py-0.5 rounded text-[10px] bg-gray-800/80 text-gray-400 hover:bg-gray-700/80 transition-colors"
            >
              戻す
            </button>
            <button onClick={clearDrawings} title="描画をクリア"
              className="hidden md:inline-block px-1.5 py-0.5 rounded text-[10px] bg-gray-800/80 text-red-400 hover:bg-red-600/30 transition-colors"
            >
              全消去
            </button>
          </>
        )}
      </div>

      {/* ==================== OHLC凡例 ==================== */}
      {legendData && (
        <div className="absolute top-8 md:top-9 left-1 md:left-3 z-10 flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] pointer-events-none flex-wrap">
          <span className="text-gray-500">{legendData.time}</span>
          <span className="text-gray-400">始<span className="font-mono text-white ml-0.5">{currency}{fmtPrice(legendData.open)}</span></span>
          <span className="text-gray-400">高<span className="font-mono text-red-400 ml-0.5">{currency}{fmtPrice(legendData.high)}</span></span>
          <span className="text-gray-400">安<span className={`font-mono ml-0.5 ${isJP ? "text-blue-400" : "text-red-400"}`}>{currency}{fmtPrice(legendData.low)}</span></span>
          <span className="text-gray-400">終<span className="font-mono text-white ml-0.5">{currency}{fmtPrice(legendData.close)}</span></span>
          <span className={`font-mono font-bold ${
            isJP
              ? legendData.change >= 0 ? "text-red-400" : "text-blue-400"
              : legendData.change >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            {legendData.change >= 0 ? "+" : ""}{fmtPrice(legendData.change)} ({legendData.change >= 0 ? "+" : ""}{legendData.changePercent.toFixed(2)}%)
          </span>
          {overlayIndicators.has("sma") && (
            <span className="hidden md:inline">
              {legendData.sma5 != null && <span className="ml-1"><span className="text-yellow-500">MA5</span> <span className="font-mono text-yellow-400">{fmtPrice(legendData.sma5)}</span></span>}
              {legendData.sma25 != null && <span className="ml-1"><span className="text-pink-500">MA25</span> <span className="font-mono text-pink-400">{fmtPrice(legendData.sma25)}</span></span>}
              {legendData.sma75 != null && <span className="ml-1"><span className="text-purple-500">MA75</span> <span className="font-mono text-purple-400">{fmtPrice(legendData.sma75)}</span></span>}
            </span>
          )}
        </div>
      )}

      {/* ==================== チャートエリア ==================== */}
      <div ref={wrapperRef} className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
          </div>
        ) : candles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 text-sm gap-2">
            <span>{chartError || "データがありません"}</span>
            {chartError && (
              <button onClick={() => setDays(days)} className="text-xs text-brand-400 hover:text-brand-300">再試行</button>
            )}
          </div>
        ) : (
          <>
            <div ref={containerRef} className="h-full" />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 z-[2] ${drawingTool !== "none" ? "cursor-crosshair" : "pointer-events-none"}`}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            />
          </>
        )}
      </div>

      {/* 指標メニューを閉じるオーバーレイ */}
      {showIndicatorMenu && (
        <div className="fixed inset-0 z-[9]" onClick={() => setShowIndicatorMenu(false)} />
      )}
    </div>
  );
}
