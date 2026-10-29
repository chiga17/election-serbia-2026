"use client";

import { useEffect, useRef, useState } from "react";
import { formatInt, formatPct } from "@/lib/format";
import type { ElectionList, Station } from "@/lib/types";

type Props = {
  stations: Station[];
  cities: string[];
  lists: ElectionList[];
  listsOn: boolean[];
  xMin: number;
};

type Hit = {
  station: Station;
  list: number;
  x: number;
  y: number;
};

export function ScatterChart({ stations, cities, lists, listsOn, xMin }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hit | null>(null);
  const [size, setSize] = useState({ w: 920, h: 420 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setSize({ w: Math.max(320, w), h: w < 700 ? 340 : 420 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(size.w * dpr);
    canvas.height = Math.floor(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const M = { l: 46, r: 16, t: 14, b: 32 };
    const plotW = size.w - M.l - M.r;
    const plotH = size.h - M.t - M.b;
    const xMax = 100;
    const yMax = 100;
    const xOf = (t: number) => M.l + ((t - xMin) / (xMax - xMin)) * plotW;
    const yOf = (p: number) => M.t + plotH - (p / yMax) * plotH;

    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, size.w, size.h);

    ctx.strokeStyle = "#e6dccb";
    ctx.fillStyle = "#5e574e";
    ctx.font = "12px Source Sans 3, sans-serif";
    ctx.lineWidth = 1;
    for (let p = 0; p <= 100; p += 20) {
      const y = yOf(p);
      ctx.beginPath();
      ctx.moveTo(M.l, y);
      ctx.lineTo(size.w - M.r, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p), M.l - 8, y);
    }
    const xStep = size.w < 640 ? 20 : 10;
    for (let t = xMin; t <= xMax; t += xStep) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(t), xOf(t), size.h - M.b + 8);
    }
    ctx.strokeStyle = "#1f1a14";
    ctx.beginPath();
    ctx.moveTo(M.l, M.t);
    ctx.lineTo(M.l, M.t + plotH);
    ctx.lineTo(size.w - M.r, M.t + plotH);
    ctx.stroke();

    const order = lists.map((_, i) => i).reverse();
    for (const i of order) {
      if (!listsOn[i]) continue;
      ctx.fillStyle = hexAlpha(lists[i].color, 0.38);
      for (const s of stations) {
        if (s.valid <= 0) continue;
        const turnout = s.turnoutHp / 100;
        if (turnout < xMin || turnout > xMax) continue;
        const share = (s.votes[i] / s.valid) * 100;
        const r = Math.min(5.2, 1.15 + Math.sqrt(s.registered) / 22);
        ctx.beginPath();
        ctx.arc(xOf(turnout), yOf(share), r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [stations, lists, listsOn, xMin, size]);

  function lookup(event: React.MouseEvent<HTMLCanvasElement>): Hit | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const M = { l: 46, r: 16, t: 14, b: 32 };
    const plotW = size.w - M.l - M.r;
    const plotH = size.h - M.t - M.b;
    const xMax = 100;
    const yMax = 100;
    let best: Hit | null = null;
    let bestD = 12 * 12;
    for (let i = 0; i < lists.length; i++) {
      if (!listsOn[i]) continue;
      for (const s of stations) {
        if (s.valid <= 0) continue;
        const turnout = s.turnoutHp / 100;
        if (turnout < xMin || turnout > xMax) continue;
        const share = (s.votes[i] / s.valid) * 100;
        const x = M.l + ((turnout - xMin) / (xMax - xMin)) * plotW;
        const y = M.t + plotH - (share / yMax) * plotH;
        const d = (x - px) ** 2 + (y - py) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { station: s, list: i, x, y };
        }
      }
    }
    return best;
  }

  return (
    <div ref={wrapRef} className="relative">
      <canvas
        ref={canvasRef}
        onMouseMove={(event) => setHover(lookup(event))}
        onMouseLeave={() => setHover(null)}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm"
          style={{
            left: Math.min(hover.x + 12, size.w - 270),
            top: Math.max(8, hover.y - 72),
          }}
        >
          <div className="font-medium">{cities[hover.station.city] ?? "Polling station"}</div>
          <div className="text-muted-foreground tabular-nums">
            {formatInt(hover.station.registered)} registered ·{" "}
            {(hover.station.turnoutHp / 100).toFixed(1)}% turnout
          </div>
          <ul className="mt-1 space-y-0.5">
            {lists.map((list, i) => (
              <li key={list.short} className="flex justify-between tabular-nums">
                <span className={i === hover.list ? "font-medium" : "text-muted-foreground"}>
                  {list.short}
                </span>
                <span>
                  {formatInt(hover.station.votes[i] ?? 0)}
                  <span className="ml-1.5 text-muted-foreground">
                    {hover.station.valid
                      ? formatPct((hover.station.votes[i] ?? 0) / hover.station.valid)
                      : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
