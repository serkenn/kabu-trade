"use client";

import { useEffect, useRef, useState } from "react";
import type { CandleData } from "@/types";

interface Props {
  symbol: string;
  market: "JP" | "US";
}

export default function PriceChart({ symbol, market }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    if (!containerRef.current || candles.length === 0) return;

    let chart: ReturnType<typeof import("lightweight-charts").createChart>;

    import("lightweight-charts").then(({ createChart }) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { color: "#111827" },
          textColor: "#9CA3AF",
        },
        grid: {
          vertLines: { color: "#1F2937" },
          horzLines: { color: "#1F2937" },
        },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: "#374151" },
        timeScale: { borderColor: "#374151" },
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
        color: "#3B82F6",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      volumeSeries.setData(
        candles.map((c) => ({
          time: c.time as never,
          value: c.volume,
          color: c.close >= c.open ? "#EF444480" : "#22C55E80",
        }))
      );

      chart.timeScale().fitContent();

      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        chart.remove();
      };
    });

    return () => {
      if (chart) chart.remove();
    };
  }, [candles, market]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">チャート</h3>
        <div className="flex gap-1">
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                days === d
                  ? "bg-brand-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {d}日
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : candles.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center text-gray-500">
          データがありません
        </div>
      ) : (
        <div ref={containerRef} />
      )}
    </div>
  );
}
