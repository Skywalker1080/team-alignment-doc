import type { DashboardBundle } from '../../../src/bundle/build';
import type { Meeting } from '../../../src/model/meeting';
import { carryoverBuckets } from '../../../src/metrics/trackers';
import { meetingsSince } from '../../../src/metrics/tasks';
import { firstName } from '../format';
import { EmptyState } from '../components/EmptyState';
import { hBarPath, stackSegments, useWidth } from './kit';

const BUCKETS = [
  { key: 'onTime', label: 'Not carried yet', cls: 'co-0' },
  { key: 'carried1', label: 'Carried once', cls: 'co-1' },
  { key: 'carried2plus', label: 'Carried 2+ times', cls: 'co-2' },
] as const;

const BAR_H = 24;

export function CarryoverChart({ bundle, today }: { bundle: DashboardBundle; today: string }) {
  // carryoverBuckets reads only meeting id and date; the bundle drops file/stray.
  const meetings = bundle.meetings as unknown as Meeting[];
  const c = carryoverBuckets(bundle.tasks, meetings, today);
  const [ref, width] = useWidth<HTMLDivElement>();
  const total = c.onTime + c.carried1 + c.carried2plus;

  if (total === 0) {
    return (
      <div data-chart="carryover">
        <EmptyState title="No open tasks">Nothing is being carried from one meeting to the next.</EmptyState>
      </div>
    );
  }

  const parts = BUCKETS.map((b) => ({ key: b.key, value: c[b.key] }));
  const segs = stackSegments(parts, total, width);
  const oldest = c.oldest ? bundle.tasks.find((t) => t.id === c.oldest!.id) : undefined;
  const oldestMeetings = oldest ? meetingsSince(oldest, meetings, today) : 0;
  const summary = BUCKETS.map((b) => `${b.label}: ${c[b.key]}`).join(', ');

  return (
    <div data-chart="carryover" className="chart">
      <div ref={ref} className="chart-frame">
        <svg width={width} height={BAR_H} role="img" aria-labelledby="carryover-title">
          <title id="carryover-title">{`${total} open tasks by meetings survived. ${summary}.`}</title>
          {segs.map((s, i) => {
            const b = BUCKETS.find((x) => x.key === s.key)!;
            return (
              <g key={s.key} className="chart-hit">
                <title>{`${b.label}: ${s.value} of ${total}`}</title>
                <path
                  className={b.cls}
                  d={hBarPath(s.x, 0, s.width, BAR_H, i === segs.length - 1)}
                />
                {s.width >= 28 ? (
                  <text className="chart-inlabel" x={s.x + s.width / 2} y={BAR_H / 2 + 4} textAnchor="middle">
                    {s.value}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="legend legend-counts">
        {BUCKETS.map((b) => (
          <li key={b.key}>
            <span className={`swatch swatch-${b.cls}`} aria-hidden="true" />
            {b.label} <strong>{c[b.key]}</strong>
          </li>
        ))}
      </ul>
      {oldest && c.oldest ? (
        <div className="callout">
          <p className="callout-figure">
            {c.oldest.ageDays}
            <span className="callout-unit">{c.oldest.ageDays === 1 ? 'day' : 'days'}</span>
          </p>
          <div className="callout-text">
            <p className="callout-label">Oldest open task</p>
            <p className="callout-title">{oldest.title}</p>
            <p className="callout-meta">
              {oldest.id} · {firstName(bundle, oldest.owner)} · carried through {oldestMeetings}{' '}
              {oldestMeetings === 1 ? 'meeting' : 'meetings'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
