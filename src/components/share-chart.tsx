"use client";

import { useState } from "react";
import { formatInt, formatPct } from "@/lib/format";
import { range } from "@/lib/scale";
import type { Analysis, ElectionList } from "@/lib/types";

const W = 920;
const H = 300;
const M = { l: 48, r: 18, t: 16, b: 32 };
const SOLID = 1500;

type Props = {
  analysis: Analysis;
  lists: ElectionList[];
  listsOn: boolean[];
  xMin: number;
};

export function ShareChart({ analysis, lists, listsOn, xMin }: Props) {
  const xMax = 100;
  const [hover, setHover] = useState<number | null>(null);
  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;

  let yMax = 40;
  for (let t = xMin; t <= xMax; t++) {
    const bin = analysis.bins[t];
    if (bin.cast < SOLID || bin.valid <= 0) continue;
    lists.forEach((_, i) => {
      if (!listsOn[i]) return;
      yMax = Math.max(yMax, (bin.votes[i] / bin.valid) * 100);
    });
  }
  yMax = Math.min(100, Math.ceil((yMax + 4) / 10) * 10);

  const xOf = (t: number) => M.l + ((t - xMin) / (xMax - xMin)) * plotW;
  const yOf = (pct: number) => M.t + plotH - (pct / yMax) * plotH;

  function line(index: number): { solid: string; dots: { x: number; y: number }[] } {
    let solid = "";
    let drawing = false;
    const dots: { x: number; y: number }[] = [];
    for (let t = xMin; t <= xMax; t++) {
      const bin = analysis.bins[t];
      if (bin.valid <= 0 || bin.cast < 200) {
        drawing = false;
        continue;
      }
      const pct = (bin.votes[index] / bin.valid) * 100;
      const x = xOf(t);
      const y = yOf(pct);
      if (bin.cast < SOLID) {
        dots.push({ x, y });
        drawing = false;
        continue;
      }
      solid += drawing ? `L${x.toFixed(2)},${y.toFixed(2)}` : `M${x.toFixed(2)},${y.toFixed(2)}`;
      drawing = true;
    }
    return { solid, dots };
  }

  const hoverBin = hover == null ? null : analysis.bins[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[680px] font-sans"
        role="img"
        aria-label="List share by turnout"
      >
        {range(0, yMax, yMax > 60 ? 20 : 10).map((tick) => (
          <g key={tick}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke={tick === 0 ? "#1f1a14" : "#e6dccb"}
            />
            <text x={M.l - 8} y={yOf(tick) + 4} textAnchor="end" fontSize="12" fill="#5e574e">
              {tick}
            </text>
          </g>
        ))}
        {range(xMin, xMax, 10).map((t) => (
          <text key={t} x={xOf(t)} y={H - 10} textAnchor="middle" fontSize="12" fill="#5e574e">
            {t}
          </text>
        ))}
        {analysis.bell &&
          lists.map((list, i) =>
            listsOn[i] ? (
              <line
                key={`ref-${list.short}`}
                x1={xOf(xMin)}
                x2={xOf(xMax)}
                y1={yOf(analysis.balances[i]?.leftShare * 100 || 0)}
                y2={yOf(analysis.balances[i]?.leftShare * 100 || 0)}
                stroke={list.color}
                strokeDasharray="4 4"
                opacity={0.55}
              />
            ) : null,
          )}
        {lists.map((list, i) => {
          if (!listsOn[i]) return null;
          const { solid, dots } = line(i);
          return (
            <g key={list.short}>
              <path d={solid} fill="none" stroke={list.color} strokeWidth={2.25} strokeLinejoin="round" />
              {dots.map((d, k) => (
                <circle key={k} cx={d.x} cy={d.y} r={2.2} fill={list.color} opacity={0.45} />
              ))}
            </g>
          );
        })}
        {range(xMin, xMax, 1).map((t) => (
          <rect
            key={t}
            x={xOf(t - 0.5)}
            y={M.t}
            width={plotW / (xMax - xMin)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(t)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hoverBin && hover != null && hoverBin.valid > 0 && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-56 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm"
          style={{
            left: hover > (xMin + xMax) / 2 ? "1rem" : "auto",
            right: hover > (xMin + xMax) / 2 ? "auto" : "1rem",
          }}
        >
          <div className="font-medium tabular-nums">{hover}% turnout</div>
          <div className="text-muted-foreground tabular-nums">
            {formatInt(hoverBin.cast)} ballots
          </div>
          <ul className="mt-1 space-y-0.5">
            {lists.map((list, i) => (
              <li key={list.short} className="flex justify-between gap-3 tabular-nums">
                <span className="text-muted-foreground">{list.short}</span>
                <span>{formatPct(hoverBin.votes[i] / hoverBin.valid)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
