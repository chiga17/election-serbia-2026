export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

export function formatSigned(n: number): string {
  const v = Math.round(n);
  const body = Math.abs(v).toLocaleString("en-GB");
  if (v > 0) return `+${body}`;
  if (v < 0) return `−${body}`;
  return "0";
}

export function formatPct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatAxis(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const m = v / 1_000_000;
    return `${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}m`;
  }
  if (abs >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
}

/** Clock time in Europe/Belgrade, with the zone named for the reader. */
export function formatBelgrade(iso: string): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return `${time} Belgrade time, ${date}`;
}
