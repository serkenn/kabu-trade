"use client";

import { useState, useEffect, useRef } from "react";

interface MarketStatus {
  label: string;
  isOpen: boolean;
  countdown: string;
  nextEvent: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return "00:00:00";
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** タイムゾーン内の現在時刻情報を取得 */
function getTzTime(tz: string, now: Date) {
  // Intl で各パーツを取得
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  const h = parseInt(parts.hour);
  const m = parseInt(parts.minute);
  const s = parseInt(parts.second);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayMap[parts.weekday] ?? 0;
  return { h, m, s, dayOfWeek };
}

/** 「今のタイムゾーン時刻」から「ターゲットHH:MM:00」までの残りミリ秒を計算 */
function msUntil(targetH: number, targetM: number, tzH: number, tzM: number, tzS: number): number {
  const targetSec = targetH * 3600 + targetM * 60;
  const currentSec = tzH * 3600 + tzM * 60 + tzS;
  return (targetSec - currentSec) * 1000;
}

function getJPStatus(now: Date): MarketStatus {
  const { h, m, s, dayOfWeek } = getTzTime("Asia/Tokyo", now);
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  if (!isWeekday) {
    return { label: "日本株", isOpen: false, countdown: "--:--:--", nextEvent: "休場（週末）" };
  }

  const cur = h * 3600 + m * 60 + s;
  const zenbaOpen = 9 * 3600;
  const zenbaClose = 11 * 3600 + 30 * 60;
  const gobaOpen = 12 * 3600 + 30 * 60;
  const gobaClose = 15 * 3600;

  if (cur < zenbaOpen) {
    return { label: "日本株", isOpen: false, countdown: formatCountdown(msUntil(9, 0, h, m, s)), nextEvent: "前場 開場まで" };
  }
  if (cur < zenbaClose) {
    return { label: "日本株 前場", isOpen: true, countdown: formatCountdown(msUntil(11, 30, h, m, s)), nextEvent: "前場 閉場まで" };
  }
  if (cur < gobaOpen) {
    return { label: "日本株", isOpen: false, countdown: formatCountdown(msUntil(12, 30, h, m, s)), nextEvent: "後場 開場まで" };
  }
  if (cur < gobaClose) {
    return { label: "日本株 後場", isOpen: true, countdown: formatCountdown(msUntil(15, 0, h, m, s)), nextEvent: "後場 閉場まで" };
  }

  return { label: "日本株", isOpen: false, countdown: "--:--:--", nextEvent: "閉場" };
}

function getUSStatus(now: Date): MarketStatus {
  const { h, m, s, dayOfWeek } = getTzTime("America/New_York", now);
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  if (!isWeekday) {
    return { label: "米国株", isOpen: false, countdown: "--:--:--", nextEvent: "休場（週末）" };
  }

  const cur = h * 3600 + m * 60 + s;
  const marketOpen = 9 * 3600 + 30 * 60;
  const marketClose = 16 * 3600;

  if (cur < marketOpen) {
    return { label: "米国株", isOpen: false, countdown: formatCountdown(msUntil(9, 30, h, m, s)), nextEvent: "開場まで" };
  }
  if (cur < marketClose) {
    return { label: "米国株", isOpen: true, countdown: formatCountdown(msUntil(16, 0, h, m, s)), nextEvent: "閉場まで" };
  }

  return { label: "米国株", isOpen: false, countdown: "--:--:--", nextEvent: "閉場" };
}

export default function MarketClock() {
  const [now, setNow] = useState(() => new Date());
  const rafRef = useRef<number>(0);
  const lastSecRef = useRef<number>(-1);

  useEffect(() => {
    function tick() {
      const d = new Date();
      const sec = d.getSeconds();
      if (sec !== lastSecRef.current) {
        lastSecRef.current = sec;
        setNow(d);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const jp = getJPStatus(now);
  const us = getUSStatus(now);

  const dateStr = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  const timeStr = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  });

  const dayStr = now.toLocaleDateString("ja-JP", {
    weekday: "short",
    timeZone: "Asia/Tokyo",
  });

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      {/* 現在時刻 */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">日時</div>
        <div className="text-white font-mono font-bold text-base">
          {dateStr}
          <span className="text-gray-400 ml-1 text-sm">({dayStr})</span>
          <span className="ml-3">{timeStr}</span>
        </div>
      </div>

      <div className="w-px h-8 bg-gray-700 hidden sm:block" />

      {/* 日本株 */}
      <MarketStatusBadge status={jp} />

      <div className="w-px h-8 bg-gray-700 hidden sm:block" />

      {/* 米国株 */}
      <MarketStatusBadge status={us} />
    </div>
  );
}

function MarketStatusBadge({ status }: { status: MarketStatus }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          status.isOpen ? "bg-green-400 animate-pulse" : "bg-gray-500"
        }`}
      />
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
          {status.label}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-medium text-xs ${
              status.isOpen ? "text-green-400" : "text-gray-400"
            }`}
          >
            {status.isOpen ? "取引中" : "休場"}
          </span>
          <span className="text-gray-500 text-xs">{status.nextEvent}</span>
          <span className="font-mono text-white font-bold text-sm">
            {status.countdown}
          </span>
        </div>
      </div>
    </div>
  );
}
