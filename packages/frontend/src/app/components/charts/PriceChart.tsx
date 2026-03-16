"use client";

import { useEffect, useRef, useState } from "react";
import type { CandleData } from "@/types";

interface Props {
  symbol: string;
  market: "JP" | "US";
}

export default function PriceChart({ symbol, market }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(90);

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
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: market === "JP" ? "#EF4444" : "#22C55E",
        downColor: market === "JP" ? "#22C55E" : "#EF4444",
        borderUpColor: market === "JP" ? "#EF4444" : "#22C55E",
        borderDownColor: market === "JP" ? "#22C55E" : "#EF4444",
        wickUpColor: market === "JP" ? "#EF4444" : "#22C55E",
        wickDownColor: market === "JP" ? "#22C55E" : "#EF4444",
      });

      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as never,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

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
        }
      });
      resizeObserver.observe(wrapperRef.current);
    });

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (chart) chart.remove();
    };
  }, [candles, market]);

  const periods = [
    { label: "1M", value: 30 },
    { label: "3M", value: 90 },
    { label: "6M", value: 180 },
    { label: "1Y", value: 365 },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0e17] relative">
      {/* Period buttons overlay */}
      <div className="absolute top-2 left-3 z-10 flex gap-1">
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
      </div>

      {/* Chart */}
      <div ref={wrapperRef} className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
          </div>
        ) : candles.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 text-sm">
            データがありません
          </div>
        ) : (
          <div ref={containerRef} className="h-full" />
        )}
      </div>
    </div>
  );
}
