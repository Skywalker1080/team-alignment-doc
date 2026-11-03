import { useId, useState } from 'react';
import type { DashboardBundle } from '../../../src/bundle/build';
import type { LaneTask } from '../../../src/metrics/tasks';
import { dateInTz } from '../../../src/metrics/dates';
import { fullName, historyText, originBadge, shortDate, STATUS_LABEL } from '../format';

type Props = { task: LaneTask; bundle: DashboardBundle; today: string };

function badgeTone(t: LaneTask, today: string): 'danger' | 'warn' | 'quiet' {
  if (t.overdue > 0) return 'danger';
  if (t.deadline.date === today) return 'warn';
  return 'quiet';
}

export function TaskCard({ task: t, bundle, today }: Props) {
  const [open, setOpen] = useState(false);
  const historyId = useId();
  const theme = bundle.themes.find((th) => th.id === t.theme)?.name ?? t.theme;
  const hard = t.deadline.kind === 'hard';

  return (
    <article
      className="card"
      data-id={t.id}
      data-status={t.status}
      data-owner={t.owner}
      data-expanded={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className="card-main"
        aria-expanded={open}
        aria-controls={historyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="card-top">
          <span className={`prio prio-${t.priority}`} title={`Priority ${t.priority.toUpperCase()}`}>
            {t.priority.toUpperCase()}
          </span>
          {t.status === 'doing' ? <span className="state">{STATUS_LABEL.doing}</span> : null}
          <span className={`badge badge-${badgeTone(t, today)}`}>{originBadge(t, today)}</span>
        </span>
        <span className="card-title">{t.title}</span>
        {t.description ? <span className="card-desc">{t.description}</span> : null}
        <span className="card-meta">
          <span
            className={`deadline deadline-${t.deadline.kind}`}
            title={`${hard ? 'Hard' : 'Soft'} deadline`}
          >
            <span aria-hidden="true">{hard ? '◆' : '○'}</span>
            <span className="sr-only">{hard ? 'Hard deadline' : 'Soft deadline'}</span>
            {shortDate(t.deadline.date)}
          </span>
          <span className="meta-item">{theme}</span>
          <span className="meta-item">{fullName(bundle, t.owner)}</span>
          <span className="expand-hint" aria-hidden="true">
            {open ? 'Hide history' : 'History'}
          </span>
        </span>
      </button>
      <div id={historyId} className="history" hidden={!open}>
        <ol className="history-list">
          {t.history.map((h, i) => (
            <li key={i} className="history-item">
              <time className="history-date" dateTime={h.at}>
                {shortDate(dateInTz(h.at))}
              </time>
              <span>{historyText(bundle, h)}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
