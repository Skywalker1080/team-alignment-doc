import type { DashboardBundle } from '../../../src/bundle/build';
import { workload } from '../../../src/metrics/trackers';
import { firstName } from '../format';
import { EmptyState } from '../components/EmptyState';
import { countTicks, hBarPath, stackSegments, useWidth } from './kit';

const PRIORITIES = ['p0', 'p1', 'p2'] as const;
const ROW = 36;
const BAR_H = 18;
const LABEL = 76; // owner names
const TIP = 28; // room for the total at the bar end
const AXIS = 22;

export function WorkloadChart({ bundle }: { bundle: DashboardBundle }) {
  const rows = workload(
    bundle.tasks,
    bundle.team.map((m) => m.id),
  );
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(0, ...rows.map((r) => r.total));

  if (max === 0) {
    return (
      <div data-chart="workload">
        <EmptyState title="No open tasks">Everyone's plate is clear.</EmptyState>
      </div>
    );
  }

  const ticks = countTicks(max);
  const scaleMax = ticks.at(-1)!;
  const plotW = Math.max(0, width - LABEL - TIP);
  const xOf = (v: number) => LABEL + (plotW * v) / scaleMax;
  const height = rows.length * ROW + AXIS;

  return (
    <div data-chart="workload" className="chart">
      <ul className="legend" aria-hidden="true">
        {PRIORITIES.map((p) => (
          <li key={p}>
            <span className={`swatch swatch-wl-${p}`} />
            {p.toUpperCase()}
          </li>
        ))}
      </ul>
      <div ref={ref} className="chart-frame">
        <svg width={width} height={height} role="img" aria-labelledby="workload-title">
          <title id="workload-title">
            {`Open tasks per person by priority. ${rows
              .map((r) => `${firstName(bundle, r.owner)}: ${r.total} (P0 ${r.p0}, P1 ${r.p1}, P2 ${r.p2})`)
              .join('; ')}.`}
          </title>
          <defs>
            <pattern id="wl-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2" height="5" fill="var(--surface)" />
            </pattern>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line className="chart-grid" x1={xOf(v)} x2={xOf(v)} y1={0} y2={rows.length * ROW} />
              <text className="chart-tick" x={xOf(v)} y={rows.length * ROW + 16} textAnchor="middle">
                {v}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = i * ROW + (ROW - BAR_H) / 2;
            const name = firstName(bundle, r.owner);
            const segs = stackSegments(
              PRIORITIES.map((p) => ({ key: p, value: r[p] })),
              scaleMax,
              plotW,
            );
            const end = segs.length ? LABEL + segs.at(-1)!.x + segs.at(-1)!.width : LABEL;
            return (
              <g key={r.owner} className="chart-hit">
                <title>{`${name}: ${r.total} open (P0 ${r.p0}, P1 ${r.p1}, P2 ${r.p2})`}</title>
                <rect x={0} y={i * ROW} width={width} height={ROW} fill="transparent" />
                <text className="chart-label" x={0} y={y + BAR_H / 2 + 5}>
                  {name}
                </text>
                {segs.map((s, j) => {
                  const d = hBarPath(LABEL + s.x, y, s.width, BAR_H, j === segs.length - 1);
                  return (
                    <g key={s.key}>
                      <path className={`wl-${s.key}`} d={d} />
                      {s.key === 'p2' ? <path className="wl-hatch" d={d} /> : null}
                      {s.width >= 20 ? (
                        <text
                          className={`wl-count wl-count-${s.key}`}
                          x={LABEL + s.x + s.width / 2}
                          y={y + BAR_H / 2 + 4}
                          textAnchor="middle"
                        >
                          {r[s.key as (typeof PRIORITIES)[number]]}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                <text className="chart-value" x={end + 6} y={y + BAR_H / 2 + 4}>
                  {r.total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
