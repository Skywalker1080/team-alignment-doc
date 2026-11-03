import { useRef } from 'react';
import type { DashboardBundle } from '../../../src/bundle/build';
import type { Task } from '../../../src/model/schemas';
import { closedOn, firstDeadline, isOpen } from '../../../src/metrics/tasks';
import { daysBetween } from '../../../src/metrics/dates';
import { firstName, shortDate } from '../format';
import { EmptyState } from '../components/EmptyState';
import { addDays, useIsoLayoutEffect, useWidth } from './kit';

const BACK = 14;
const AHEAD = 21;

export function timelineWindow(today: string) {
  const start = addDays(today, -BACK);
  const end = addDays(today, AHEAD);
  return { start, end, days: daysBetween(start, end) + 1 };
}

export type TimelineRow = {
  task: Task;
  /** IST date the task came from (the origin meeting's date). */
  start: string;
  /** Current deadline. */
  end: string;
  state: 'open' | 'done' | 'dropped';
  closed: string | null;
  /** First deadline to today (open) or to the close date, when the first deadline was missed. */
  slip: { from: string; to: string } | null;
};

/** Open tasks plus tasks closed in the last 14 days, earliest deadline first. */
export function timelineRows(tasks: Task[], today: string): TimelineRow[] {
  const since = addDays(today, -BACK);
  const rows: TimelineRow[] = [];
  for (const t of tasks) {
    const closed = closedOn(t);
    const open = isOpen(t);
    if (!open && (closed === null || closed < since || closed > today)) continue;
    const first = firstDeadline(t);
    const until = open ? today : closed!;
    rows.push({
      task: t,
      start: t.origin.slice(0, 10),
      end: t.deadline.date,
      state: open ? 'open' : (t.status as 'done' | 'dropped'),
      closed: open ? null : closed,
      slip: first < until && !(t.status === 'dropped') ? { from: first, to: until } : null,
    });
  }
  return rows.sort((a, b) => a.end.localeCompare(b.end) || a.task.id.localeCompare(b.task.id));
}

const ROW = 40;
const HEAD = 30;
const MIN_DAY = 22;
const STATE_LABEL = { open: 'open', done: 'done', dropped: 'dropped' } as const;

function describe(r: TimelineRow, owner: string): string {
  const kind = r.task.deadline.kind === 'hard' ? 'hard' : 'soft';
  const first = firstDeadline(r.task);
  const moved = first !== r.end ? ` (first ${shortDate(first)})` : '';
  const closed = r.closed ? ` on ${shortDate(r.closed)}` : '';
  const slip = r.slip ? `, slipped ${daysBetween(r.slip.from, r.slip.to)}d` : '';
  return `${r.task.id} ${r.task.title} · ${owner} · from ${shortDate(r.start)}, ${kind} deadline ${shortDate(
    r.end,
  )}${moved} · ${STATE_LABEL[r.state]}${closed}${slip}`;
}

export function TimelineChart({ bundle, today }: { bundle: DashboardBundle; today: string }) {
  const rows = timelineRows(bundle.tasks, today);
  const [frameRef, frameW] = useWidth<HTMLDivElement>();
  const scrolled = useRef(false);
  const win = timelineWindow(today);
  const dayW = Math.max(MIN_DAY, frameW / win.days);
  const plotW = Math.round(dayW * win.days);
  const height = HEAD + rows.length * ROW;
  const xOf = (d: string) => Math.min(plotW, Math.max(0, (daysBetween(win.start, d) + 0.5) * dayW));
  const inWindow = (d: string) => d >= win.start && d <= win.end;
  const todayX = xOf(today);

  // On narrow screens open the scroller with today in view.
  useIsoLayoutEffect(() => {
    const el = frameRef.current;
    if (!el || scrolled.current || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, todayX - el.clientWidth * 0.4);
    scrolled.current = true;
  });

  if (rows.length === 0) {
    return (
      <div data-chart="timeline">
        <EmptyState title="No open or recently closed tasks">The timeline fills in as tasks are added.</EmptyState>
      </div>
    );
  }

  const mondays: string[] = [];
  for (let i = 0; i < win.days; i++) {
    const d = addDays(win.start, i);
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === 1) mondays.push(d);
  }

  return (
    <div data-chart="timeline" className="chart">
      <ul className="legend" aria-hidden="true">
        <li><span className="key-diamond" />Hard</li>
        <li><span className="key-circle" />Soft</li>
        <li><span className="swatch swatch-open" />Open</li>
        <li><span className="swatch swatch-done" />Done</li>
        <li><span className="swatch swatch-dropped" />Dropped</li>
        <li><span className="swatch swatch-slip" />Slipped</li>
        <li><span className="key-today" />Today</li>
      </ul>
      <div className="timeline">
        <ol className="timeline-labels" style={{ paddingTop: HEAD }} aria-hidden="true">
          {rows.map((r) => (
            <li key={r.task.id} className="timeline-label" style={{ height: ROW }} title={r.task.title}>
              <span className="timeline-title">{r.task.title}</span>
              <span className="timeline-sub">
                {r.task.id} · {firstName(bundle, r.task.owner)}
              </span>
            </li>
          ))}
        </ol>
        <div ref={frameRef} className="timeline-scroll" tabIndex={0} role="region" aria-label="Deadline timeline, scrolls sideways">
          <svg width={plotW} height={height} role="img" aria-labelledby="timeline-title timeline-desc">
            <title id="timeline-title">
              Deadline timeline from {shortDate(win.start)} to {shortDate(win.end)}, today {shortDate(today)}
            </title>
            <desc id="timeline-desc">
              {rows.map((r) => describe(r, firstName(bundle, r.task.owner))).join('. ')}
            </desc>
            {mondays.map((d) => (
              <g key={d}>
                <line className="chart-grid" x1={xOf(d)} x2={xOf(d)} y1={HEAD - 6} y2={height} />
                {xOf(d) + 44 <= plotW ? (
                  <text className="chart-tick" x={xOf(d) + 4} y={14}>
                    {shortDate(d)}
                  </text>
                ) : null}
              </g>
            ))}
            {rows.map((r, i) => {
              const cy = HEAD + i * ROW + ROW / 2;
              const x1 = xOf(r.start < r.end ? r.start : r.end);
              const x2 = xOf(r.start < r.end ? r.end : r.start);
              const hard = r.task.deadline.kind === 'hard';
              const cls = `tl-${r.state}`;
              return (
                <g key={r.task.id} className={`chart-hit ${cls}`}>
                  <title>{describe(r, firstName(bundle, r.task.owner))}</title>
                  <rect x={0} y={cy - ROW / 2} width={plotW} height={ROW} fill="transparent" />
                  <line className="chart-row" x1={0} x2={plotW} y1={cy + ROW / 2} y2={cy + ROW / 2} />
                  {x2 > x1 ? (
                    <line
                      className={`tl-bar ${hard ? 'tl-hard' : 'tl-soft'}`}
                      x1={x1}
                      x2={x2}
                      y1={cy}
                      y2={cy}
                    />
                  ) : null}
                  {r.slip ? <line className="tl-slip" x1={xOf(r.slip.from)} x2={xOf(r.slip.to)} y1={cy} y2={cy} /> : null}
                  {inWindow(r.end) ? (
                    hard ? (
                      <path className="tl-mark tl-mark-hard" d={`M${xOf(r.end)},${cy - 6} l6,6 l-6,6 l-6,-6 Z`} />
                    ) : (
                      <circle className="tl-mark tl-mark-soft" cx={xOf(r.end)} cy={cy} r={5} />
                    )
                  ) : null}
                </g>
              );
            })}
            <line className="tl-today" x1={todayX} x2={todayX} y1={HEAD - 8} y2={height} />
          </svg>
        </div>
      </div>
    </div>
  );
}
