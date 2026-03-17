"use client";

import { useEffect, useRef, useState } from "react";
import type { CandleData } from "@/types";

interface Props {
  candles: CandleData[];
}

export default function FxChart({ candles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then(({ createChart }) => {
      if (!containerRef.current || disposed) return;
      const width = containerRef.current.clientWidth || 600;
      const height = 420;
      const chart = createChart(containerRef.current, {
        width,
        height,
        layout: {
          background: { color: "#0a0e17" },
          textColor: "#94a3b8",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1a1f2e" },
          horzLines: { color: "#1a1f2e" },
        },
        rightPriceScale: {
          borderColor: "#1F2937",
        },
        timeScale: {
          borderColor: "#1F2937",
          timeVisible: false,
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      series.setData(
        candles.map((c) => ({
          time: c.time as never,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

      chart.timeScale().fitContent();
      const resizeObserver = new ResizeObserver(() => {
        if (!containerRef.current) return;
        chart.applyOptions({ width: containerRef.current.clientWidth });
      });
      resizeObserver.observe(containerRef.current);
      cleanup = () => {
        resizeObserver.disconnect();
        chart.remove();
      };
      setLoading(false);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [candles]);

  return (
    <div className="relative h-[420px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
          チャートを読み込み中...
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
