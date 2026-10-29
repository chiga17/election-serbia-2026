"use client";

import { useMemo, useState } from "react";
import { formatAxis, formatInt, formatPct } from "@/lib/format";
import { bellAt, invalidInBin, othersInBin } from "@/lib/model";
import { axisMax, range } from "@/lib/scale";
import type { Analysis, ElectionList } from "@/lib/types";

const W = 920;
const H = 440;
const M = { l: 58, r: 18, t: 18, b: 36 };

export type SeriesVisibility = {
  lists: boolean[];
  others: boolean;
  invalid: boolean;
  total: boolean;
  bell: boolean;
};

type Props = {
  analysis: Analysis;
  lists: ElectionList[];
  visibility: SeriesVisibility;
  xMin: number;
};

const OTHER = "#6f6a62";
const INVALID = "#c4bbae";
const INK = "#1f1a14";

export function TurnoutChart({ analysis, lists, visibility, xMin }: Props) {
  const xMax = 100;
  const [hover, setHover] = useState<number | null>(null);
  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;

  const axis = useMemo(() => {
    let peak = 0;
    for (let t = xMin; t <= xMax; t++) {
      const bin = analysis.bins[t];
      if (visibility.total) peak = Math.max(peak, bin.cast);
      if (visibility.invalid) peak = Math.max(peak, bin.cast - bin.valid);
      if (visibility.others) peak = Math.max(peak, othersInBin(bin));
      bin.votes.forEach((v, i) => {
        if (visibility.lists[i]) peak = Math.max(peak, v);
      });
      if (visibility.bell && analysis.bell) peak = Math.max(peak, bellAt(analysis.bell, t));
    }
    return axisMax(peak);
  }, [analysis, visibility, xMin]);

  const yMax = axis.max;
  const yTicks = range(0, yMax, axis.step);
  const xOf = (t: number) => M.l + ((t - xMin) / (xMax - xMin)) * plotW;
  const yOf = (v: number) => M.t + plotH - (v / yMax) * plotH;

  const series = useMemo(() => {
    const rows: { key: string; color: string; values: number[]; fill: boolean }[] = [];
    if (visibility.invalid) {
      rows.push({
        key: "invalid",
        color: INVALID,
        values: analysis.bins.map((b) => b.cast - b.valid),
        fill: true,
      });
    }
    if (visibility.others) {
      rows.push({
        key: "others",
        color: OTHER,
        values: analysis.bins.map(othersInBin),
        fill: true,
      });
    }
    for (let i = lists.length - 1; i >= 0; i--) {
      if (!visibility.lists[i]) continue;
      rows.push({
        key: lists[i].short,
        color: lists[i].color,
        values: analysis.bins.map((b) => b.votes[i] ?? 0),
        fill: true,
      });
    }
    return rows;
  }, [analysis.bins, lists, visibility]);

  function pathFor(values: number[], close: boolean): string {
    let d = "";
    for (let t = xMin; t <= xMax; t++) {
      const cmd = t === xMin ? "M" : "L";
      d += `${cmd}${xOf(t).toFixed(2)},${yOf(values[t]).toFixed(2)}`;
    }
    if (close) {
      d += `L${xOf(xMax).toFixed(2)},${yOf(0).toFixed(2)}L${xOf(xMin).toFixed(2)},${yOf(0).toFixed(2)}Z`;
    }
    return d;
  }

  let bellPath = "";
  if (analysis.bell) {
    for (let t = xMin; t <= xMax; t += 0.5) {
      const cmd = t === xMin ? "M" : "L";
      bellPath += `${cmd}${xOf(t).toFixed(2)},${yOf(bellAt(analysis.bell, t)).toFixed(2)}`;
    }
  }

  const hoverBin = hover == null ? null : analysis.bins[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[680px] font-sans"
        role="img"
        aria-label="Votes by turnout"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke={tick === 0 ? INK : "#e6dccb"}
              strokeWidth={tick === 0 ? 1 : 1}
            />
            <text
              x={M.l - 8}
              y={yOf(tick) + 4}
              textAnchor="end"
              fontSize="12"
              fill="#5e574e"
            >
              {formatAxis(tick)}
            </text>
          </g>
        ))}
        {range(xMin, xMax, 5).map((t) => (
          <text
            key={t}
            x={xOf(t)}
            y={H - 12}
            textAnchor="middle"
            fontSize="12"
            fill="#5e574e"
          >
            {t}
          </text>
        ))}
        {analysis.bell && visibility.bell && (
          <rect
            x={xOf(analysis.bell.anchor)}
            y={M.t}
            width={Math.max(0, xOf(analysis.bell.fitEnd) - xOf(analysis.bell.anchor))}
            height={plotH}
            fill="#1f1a14"
            opacity={0.045}
          />
        )}
        {series.map((s) => (
          <path
            key={`${s.key}-fill`}
            d={pathFor(s.values, true)}
            fill={s.color}
            opacity={0.16}
          />
        ))}
        {visibility.total && (
          <path
            d={pathFor(
              analysis.bins.map((b) => b.cast),
              false,
            )}
            fill="none"
            stroke={INK}
            strokeWidth={1.4}
          />
        )}
        {series.map((s) => (
          <path
            key={`${s.key}-line`}
            d={pathFor(s.values, false)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {visibility.bell && analysis.bell && (
          <path
            d={bellPath}
            fill="none"
            stroke={INK}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            opacity={0.75}
          />
        )}
        {analysis.bell && (
          <g>
            <line
              x1={xOf(analysis.bell.mu)}
              x2={xOf(analysis.bell.mu)}
              y1={M.t}
              y2={M.t + plotH}
              stroke={INK}
              strokeDasharray="2 3"
              opacity={0.45}
            />
            <text
              x={xOf(analysis.bell.mu) + 6}
              y={M.t + 14}
              fontSize="12"
              fill="#1f1a14"
            >
              hilltop {analysis.bell.mu.toFixed(1)}%
            </text>
          </g>
        )}
        {hover != null && hover >= xMin && hover <= xMax && (
          <line
            x1={xOf(hover)}
            x2={xOf(hover)}
            y1={M.t}
            y2={M.t + plotH}
            stroke="#1f1a14"
            strokeWidth={1}
            opacity={0.35}
          />
        )}
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
      {hoverBin && hover != null && (
        <div
          className="pointer-events-none absolute top-3 z-10 w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm"
          style={{
            left: hover > (xMin + xMax) / 2 ? "1rem" : "auto",
            right: hover > (xMin + xMax) / 2 ? "auto" : "1rem",
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium tabular-nums">{hover}% turnout</span>
            <span className="text-muted-foreground tabular-nums">
              {formatInt(hoverBin.stations)} stations
            </span>
          </div>
          <dl className="mt-1.5 space-y-0.5">
            <Row label="Ballots cast" value={formatInt(hoverBin.cast)} />
            {lists.map((list, i) => (
              <Row
                key={list.short}
                label={list.short}
                value={formatInt(hoverBin.votes[i] ?? 0)}
                share={
                  hoverBin.valid > 0
                    ? formatPct((hoverBin.votes[i] ?? 0) / hoverBin.valid)
                    : "—"
                }
                swatch={list.color}
              />
            ))}
            <Row
              label="Other lists"
              value={formatInt(othersInBin(hoverBin))}
              swatch={OTHER}
            />
            <Row
              label="Invalid"
              value={formatInt(invalidInBin(hoverBin))}
              swatch={INVALID}
            />
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  share,
  swatch,
}: {
  label: string;
  value: string;
  share?: string;
  swatch?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 tabular-nums">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {swatch && (
          <span className="size-2 rounded-full" style={{ background: swatch }} />
        )}
        {label}
      </dt>
      <dd>
        {value}
        {share && <span className="ml-1.5 text-muted-foreground">{share}</span>}
      </dd>
    </div>
  );
}
