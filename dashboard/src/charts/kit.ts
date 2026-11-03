import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** useLayoutEffect in the browser, useEffect when rendered to a string (tests), so neither warns. */
export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** 'YYYY-MM-DD' shifted by n calendar days, computed in UTC so the date never drifts. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export type Segment = { key: string; value: number; x: number; width: number };

/**
 * Lays values end to end along `width` px, proportional to `scaleMax`, with a `gap` px
 * surface gap between non-empty segments. Zero values get no segment. Never NaN.
 */
export function stackSegments(
  parts: { key: string; value: number }[],
  scaleMax: number,
  width: number,
  gap = 2,
): Segment[] {
  const shown = parts.filter((p) => p.value > 0);
  const total = shown.reduce((s, p) => s + p.value, 0);
  if (total === 0 || scaleMax <= 0 || width <= 0) return [];
  const barWidth = (width * total) / scaleMax;
  const usable = Math.max(0, barWidth - gap * (shown.length - 1));
  let x = 0;
  return shown.map((p) => {
    const w = (usable * p.value) / total;
    const seg = { key: p.key, value: p.value, x, width: w };
    x += w + gap;
    return seg;
  });
}

/** Whole-number ticks from 0 to at least `max`; one per unit for small counts, else ~4 steps. */
export function countTicks(max: number): number[] {
  if (max <= 0) return [0];
  const step = max <= 6 ? 1 : Math.ceil(max / 4);
  const out: number[] = [];
  for (let v = 0; v < max + step; v += step) out.push(v);
  return out;
}

/** Path for a bar with 4px rounded corners on its data end (right) and a square baseline (left). */
export function hBarPath(x: number, y: number, w: number, h: number, round: boolean, r = 4): string {
  const rr = round ? Math.min(r, w / 2, h / 2) : 0;
  return [
    `M${x},${y}`,
    `H${x + w - rr}`,
    rr ? `A${rr},${rr} 0 0 1 ${x + w},${y + rr}` : '',
    `V${y + h - rr}`,
    rr ? `A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}` : '',
    `H${x}`,
    'Z',
  ].join(' ');
}

/** Path for a column with 4px rounded top corners and a square baseline at the bottom. */
export function vBarPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + rr}`,
    `A${rr},${rr} 0 0 1 ${x + rr},${y}`,
    `H${x + w - rr}`,
    `A${rr},${rr} 0 0 1 ${x + w},${y + rr}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

/** Tracks an element's content width in px; starts at `initial` until measured. */
export function useWidth<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(0, Math.floor(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export const pct = (rate: number) => `${Math.round(rate * 100)}%`;
