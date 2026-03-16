"use client";

import { useState, useEffect, useRef } from "react";

interface MarketStatus {
  label: string;
  isOpen: boolean;
  countdown: string;
  nextEvent: string;
  timeStr: string;
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

function getTzTime(tz: string, now: Date) {
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
  const timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return { h, m, s, dayOfWeek, timeStr };
}

function msUntil(targetH: number, targetM: number, tzH: number, tzM: number, tzS: number): number {
  const targetSec = targetH * 3600 + targetM * 60;
  const currentSec = tzH * 3600 + tzM * 60 + tzS;
  return (targetSec - currentSec) * 1000;
}

function getJPStatus(now: Date): MarketStatus {
  const { h, m, s, dayOfWeek, timeStr } = getTzTime("Asia/Tokyo", now);
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  if (!isWeekday) {
    return { label: "JP", isOpen: false, countdown: "--:--:--", nextEvent: "休場", timeStr };
  }

  const cur = h * 3600 + m * 60 + s;
  const zenbaOpen = 9 * 3600;
  const zenbaClose = 11 * 3600 + 30 * 60;
  const gobaOpen = 12 * 3600 + 30 * 60;
  const gobaClose = 15 * 3600;

  if (cur < zenbaOpen) {
    return { label: "JP", isOpen: false, countdown: formatCountdown(msUntil(9, 0, h, m, s)), nextEvent: "前場まで", timeStr };
  }
  if (cur < zenbaClose) {
    return { label: "JP前場", isOpen: true, countdown: formatCountdown(msUntil(11, 30, h, m, s)), nextEvent: "閉場まで", timeStr };
  }
  if (cur < gobaOpen) {
    return { label: "JP", isOpen: false, countdown: formatCountdown(msUntil(12, 30, h, m, s)), nextEvent: "後場まで", timeStr };
  }
  if (cur < gobaClose) {
    return { label: "JP後場", isOpen: true, countdown: formatCountdown(msUntil(15, 0, h, m, s)), nextEvent: "閉場まで", timeStr };
  }

  return { label: "JP", isOpen: false, countdown: "--:--:--", nextEvent: "閉場", timeStr };
}

function getUSStatus(now: Date): MarketStatus {
  const { h, m, s, dayOfWeek, timeStr } = getTzTime("America/New_York", now);
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  if (!isWeekday) {
    return { label: "US", isOpen: false, countdown: "--:--:--", nextEvent: "休場", timeStr };
  }

  const cur = h * 3600 + m * 60 + s;
  const marketOpen = 9 * 3600 + 30 * 60;
  const marketClose = 16 * 3600;

  if (cur < marketOpen) {
    return { label: "US", isOpen: false, countdown: formatCountdown(msUntil(9, 30, h, m, s)), nextEvent: "開場まで", timeStr };
  }
  if (cur < marketClose) {
    return { label: "US", isOpen: true, countdown: formatCountdown(msUntil(16, 0, h, m, s)), nextEvent: "閉場まで", timeStr };
  }

  return { label: "US", isOpen: false, countdown: "--:--:--", nextEvent: "閉場", timeStr };
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

  return (
    <div className="flex items-center gap-3 text-xs">
      <StatusDot status={jp} />
      <div className="w-px h-3 bg-gray-700" />
      <StatusDot status={us} />
    </div>
  );
}

function StatusDot({ status }: { status: MarketStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          status.isOpen ? "bg-green-400 animate-pulse" : "bg-gray-500"
        }`}
      />
      <span className="text-gray-400">{status.label}</span>
      <span className="font-mono text-gray-300">{status.timeStr}</span>
      <span className={`font-mono font-bold ${status.isOpen ? "text-green-400" : "text-gray-500"}`}>
        {status.countdown}
      </span>
    </div>
  );
}
