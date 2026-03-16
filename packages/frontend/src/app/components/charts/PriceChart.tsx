"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CandleData } from "@/types";

interface OrderMarker {
  time: number;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
}

interface DrawLine {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
}

interface Props {
  symbol: string;
  market: "JP" | "US";
}

type DrawingTool = "none" | "trendline" | "hline" | "crosshair-toggle";

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
  const [days, setDays] = useState(90);
  const [orders, setOrders] = useState<OrderMarker[]>([]);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useState<DrawLine[]>([]);
  const drawingStartRef = useRef<{ x: number; y: number } | null>(null);
  const [tempLine, setTempLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Fetch candles
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetch(`/api/stocks/candles?symbol=${symbol}&market=${market}&days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCandles(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol, market, days]);

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

    import("lightweight-charts").then(({ createChart }) => {
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
        crosshair: { mode: 0 },
        rightPriceScale: {
          borderColor: "#1F2937",
          scaleMargins: { top: 0.05, bottom: 0.2 },
        },
        timeScale: {
          borderColor: "#1F2937",
          timeVisible: false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true },
      });

      chartRef.current = chart;

      const candleSeries = chart.addCandlestickSeries({
        upColor: market === "JP" ? "#EF4444" : "#22C55E",
        downColor: market === "JP" ? "#22C55E" : "#EF4444",
        borderUpColor: market === "JP" ? "#EF4444" : "#22C55E",
        borderDownColor: market === "JP" ? "#22C55E" : "#EF4444",
        wickUpColor: market === "JP" ? "#EF4444" : "#22C55E",
        wickDownColor: market === "JP" ? "#22C55E" : "#EF4444",
      });

      candleSeriesRef.current = candleSeries;

      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as never,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
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

      const volumeSeries = chart.addHistogramSeries({
        color: "#3B82F680",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      volumeSeries.setData(
        candles.map((c) => ({
          time: c.time as never,
          value: c.volume,
          color: c.close >= c.open
            ? (market === "JP" ? "#EF444460" : "#22C55E60")
            : (market === "JP" ? "#22C55E60" : "#EF444460"),
        }))
      );

      chart.timeScale().fitContent();

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
  }, [candles, market, orders]);

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

    // Draw saved lines
    for (const line of drawings) {
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    }

    // Draw temp line
    if (tempLine) {
      ctx.strokeStyle = "#F59E0B80";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(tempLine.x1, tempLine.y1);
      ctx.lineTo(tempLine.x2, tempLine.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [drawings, tempLine]);

  useEffect(() => {
    syncCanvas();
  }, [syncCanvas]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (drawingTool === "none") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawingTool === "hline") {
      // Horizontal line across full width
      setDrawings((prev) => [...prev, { id: crypto.randomUUID(), x1: 0, y1: y, x2: rect.width, y2: y }]);
      syncCanvas();
      return;
    }

    drawingStartRef.current = { x, y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!drawingStartRef.current || drawingTool !== "trendline") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTempLine({ x1: drawingStartRef.current.x, y1: drawingStartRef.current.y, x2: x, y2: y });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!drawingStartRef.current || drawingTool !== "trendline") {
      drawingStartRef.current = null;
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const start = drawingStartRef.current;

    if (Math.abs(x - start.x) > 5 || Math.abs(y - start.y) > 5) {
      setDrawings((prev) => [...prev, { id: crypto.randomUUID(), x1: start.x, y1: start.y, x2: x, y2: y }]);
    }

    drawingStartRef.current = null;
    setTempLine(null);
  };

  const clearDrawings = () => {
    setDrawings([]);
    setTempLine(null);
    setDrawingTool("none");
  };

  const periods = [
    { label: "1M", value: 30 },
    { label: "3M", value: 90 },
    { label: "6M", value: 180 },
    { label: "1Y", value: 365 },
  ];

  const tools: { id: DrawingTool; label: string; icon: string }[] = [
    { id: "trendline", label: "トレンドライン", icon: "╲" },
    { id: "hline", label: "水平線", icon: "─" },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0e17] relative">
      {/* Toolbar overlay */}
      <div className="absolute top-2 left-3 z-10 flex gap-1 items-center">
        {/* Period buttons */}
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setDays(p.value)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              days === p.value
                ? "bg-brand-600 text-white"
                : "bg-gray-800/80 text-gray-400 hover:bg-gray-700/80 hover:text-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-700 mx-1" />

        {/* Drawing tools */}
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setDrawingTool(drawingTool === t.id ? "none" : t.id)}
            title={t.label}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors ${
              drawingTool === t.id
                ? "bg-yellow-600 text-white"
                : "bg-gray-800/80 text-gray-400 hover:bg-gray-700/80 hover:text-gray-200"
            }`}
          >
            {t.icon}
          </button>
        ))}

        {drawings.length > 0 && (
          <button
            onClick={clearDrawings}
            title="描画をクリア"
            className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800/80 text-red-400 hover:bg-red-600/30 transition-colors"
          >
            消去
          </button>
        )}
      </div>

      {/* Chart area */}
      <div ref={wrapperRef} className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
          </div>
        ) : candles.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 text-sm">
            データがありません
          </div>
        ) : (
          <>
            <div ref={containerRef} className="h-full" />
            {/* Drawing overlay canvas */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 z-[2] ${
                drawingTool !== "none" ? "cursor-crosshair" : "pointer-events-none"
              }`}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            />
          </>
        )}
      </div>
    </div>
  );
}
