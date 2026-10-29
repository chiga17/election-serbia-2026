export function niceStep(x: number): number {
  if (x <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(x));
  const n = x / pow;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return f * pow;
}

export function axisMax(value: number, ticks = 4): { max: number; step: number } {
  const rough = Math.max(value, 1) * 1.08;
  const step = niceStep(rough / ticks);
  const max = Math.ceil(rough / step) * step;
  return { max, step };
}

export function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  const count = Math.round((end - start) / step);
  for (let i = 0; i <= count; i++) out.push(start + i * step);
  return out;
}
