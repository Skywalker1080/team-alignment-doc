import type { Task } from '../../../src/model/schemas';
import { keptPromises, type Rate } from '../../../src/metrics/trackers';
import { isoWeek, weekRange } from '../../../src/metrics/dates';
import { shortDate } from '../format';
import { EmptyState } from '../components/EmptyState';
import { addDays, pct, useWidth, vBarPath } from './kit';

export type PromiseWeek = { week: string; start: string; hard: Rate; all: Rate };

const EMPTY: Rate = { kept: 0, total: 0, rate: null };

/** The last `n` ISO weeks ending with today's, each with its kept-promise rates (empty weeks filled). */
export function promiseWeeks(tasks: Task[], today: string, n = 8): PromiseWeek[] {
  const rates = new Map(keptPromises(tasks, today).map((r) => [r.week, r]));
  const thisMonday = weekRange(isoWeek(today)).start;
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(thisMonday, -7 * (n - 1 - i));
    const week = isoWeek(start);
    const r = rates.get(week);
    return { week, start, hard: r?.hard ?? EMPTY, all: r?.all ?? EMPTY };
  });
}

const H = 180; // plot height
const TOP = 22; // room for the % labels
const AXIS = 26; // x-axis band
const LEFT = 36; // y-axis labels

function rateText(label: string, r: Rate): string {
  return r.rate === null ? `${label}: no deadlines` : `${label}: ${r.kept} of ${r.total} kept (${pct(r.rate)})`;
}

export function PromisesChart({ tasks, today }: { tasks: Task[]; today: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const weeks = promiseWeeks(tasks, today);
  const hasData = weeks.some((w) => w.all.total > 0);

  if (!hasData) {
    return (
      <div data-chart="promises">
        <EmptyState title="No deadlines have come due yet">
          Bars appear once tasks reach their first deadline.
        </EmptyState>
      </div>
    );
  }

  const plotW = Math.max(0, width - LEFT);
  const groupW = plotW / weeks.length;
  const barW = Math.max(4, Math.min(24, (groupW - 14) / 2));
  const roomy = groupW >= 56; // room for a % label on both bars
  const y = (rate: number) => TOP + H * (1 - rate);
  const totalH = TOP + H + AXIS;
  const summary = weeks
    .filter((w) => w.all.total > 0)
    .map((w) => `Week of ${shortDate(w.start)}: ${rateText('hard', w.hard)}, ${rateText('all', w.all)}`)
    .join('. ');

  /** A column plus its % label. With both labels shown they splay outward from the pair's centre. */
  const bar = (r: Rate, x: number, cls: string, label: 'center' | 'left' | 'right' | null) => {
    if (r.rate === null) return null;
    const top = y(r.rate);
    const h = TOP + H - top;
    const lx = label === 'left' ? x + barW - 1 : label === 'right' ? x + 1 : x + barW / 2;
    const anchor = label === 'left' ? 'end' : label === 'right' ? 'start' : 'middle';
    return (
      <>
        {h >= 1 ? (
          <path className={cls} d={vBarPath(x, top, barW, h)} />
        ) : (
          <rect className={cls} x={x} y={TOP + H - 2} width={barW} height={2} />
        )}
        {label ? (
          <text className="chart-value" x={lx} y={top - 6} textAnchor={anchor}>
            {pct(r.rate)}
          </text>
        ) : null}
      </>
    );
  };

  return (
    <div data-chart="promises" className="chart">
      <ul className="legend" aria-hidden="true">
        <li><span className="swatch swatch-hard" />Hard deadlines</li>
        <li><span className="swatch swatch-all" />All deadlines</li>
      </ul>
      <div ref={ref} className="chart-frame">
        <svg width={width} height={totalH} role="img" aria-labelledby="promises-title promises-desc">
          <title id="promises-title">Kept promises per week, last 8 weeks</title>
          <desc id="promises-desc">{summary}</desc>
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line className="chart-grid" x1={LEFT} x2={width} y1={y(v)} y2={y(v)} />
              <text className="chart-tick" x={LEFT - 8} y={y(v) + 4} textAnchor="end">
                {pct(v)}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const gx = LEFT + i * groupW;
            const x1 = gx + groupW / 2 - barW - 1;
            const x2 = gx + groupW / 2 + 1;
            const showTick = groupW >= 44 || (weeks.length - 1 - i) % 2 === 0;
            return (
              <g key={w.week} className="chart-hit">
                <title>
                  {`Week of ${shortDate(w.start)}. ${rateText('Hard', w.hard)}. ${rateText('All', w.all)}.`}
                </title>
                <rect x={gx} y={0} width={groupW} height={TOP + H} fill="transparent" />
                {bar(w.hard, x1, 'mark-hard', w.all.rate !== null && roomy ? 'left' : 'center')}
                {bar(w.all, x2, 'mark-all', w.hard.rate === null ? 'center' : roomy ? 'right' : null)}
                {w.all.total === 0 ? (
                  <text className="chart-tick" x={gx + groupW / 2} y={TOP + H - 6} textAnchor="middle">
                    –
                  </text>
                ) : null}
                {showTick ? (
                  <text className="chart-tick" x={gx + groupW / 2} y={TOP + H + 18} textAnchor="middle">
                    {shortDate(w.start)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
