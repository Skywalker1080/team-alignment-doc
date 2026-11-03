import { useEffect, useState } from 'react';
import type { DashboardBundle } from '../../../src/bundle/build';
import type { Meeting } from '../../../src/model/meeting';
import { ageDays, isOpen, meetingsSince, overdueDays, type LaneTask } from '../../../src/metrics/tasks';
import { firstName, STATUS_LABEL } from '../format';
import { EmptyState } from '../components/EmptyState';
import { TaskCard } from '../components/TaskCard';
import { useJumpToHashId } from '../components/JumpLink';

type Props = { bundle: DashboardBundle; today: string };
type Filters = { owner: string; theme: string; status: string; priority: string };

const OPEN = 'open';

/** Reads `#/tasks?all=1&id=T-0003`: all=1 clears the status filter; id picks a row to highlight. */
function readQuery(): { all: boolean } {
  if (typeof window === 'undefined') return { all: false };
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  return { all: params.get('all') === '1' };
}

function initialFilters(): Filters {
  return { owner: '', theme: '', status: readQuery().all ? '' : OPEN, priority: '' };
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  all: string;
}) {
  return (
    <label className="filter">
      <span className="filter-label">{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">{props.all}</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tasks({ bundle, today }: Props) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const set = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));

  // Following a link such as #/tasks?all=1 while already here resets the filters to match it.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash.startsWith('#/tasks')) setFilters(initialFilters());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const meetings = bundle.meetings as unknown as Meeting[];
  const rows: LaneTask[] = bundle.tasks
    .filter((t) => {
      if (filters.owner && t.owner !== filters.owner) return false;
      if (filters.theme && t.theme !== filters.theme) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.status === OPEN) return isOpen(t);
      return !filters.status || t.status === filters.status;
    })
    .map((t) => ({
      ...t,
      overdue: overdueDays(t, today),
      ageDays: ageDays(t, today),
      meetingsSince: meetingsSince(t, meetings, today),
    }))
    .sort(
      (a, b) =>
        b.overdue - a.overdue ||
        a.deadline.date.localeCompare(b.deadline.date) ||
        a.priority.localeCompare(b.priority) ||
        a.id.localeCompare(b.id),
    );

  useJumpToHashId();

  const filtered = Object.values(filters).some(Boolean);
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">All tasks</h1>
        <p className="counts">
          {rows.length} of {bundle.tasks.length} shown
        </p>
      </header>
      <form className="filters" aria-label="Filter tasks" onSubmit={(e) => e.preventDefault()}>
        <Select
          label="Owner"
          value={filters.owner}
          onChange={set('owner')}
          all="Everyone"
          options={[...bundle.team.map((m) => m.id), 'anyone'].map((id) => ({
            value: id,
            label: firstName(bundle, id),
          }))}
        />
        <Select
          label="Theme"
          value={filters.theme}
          onChange={set('theme')}
          all="All themes"
          options={bundle.themes.map((t) => ({ value: t.id, label: t.name }))}
        />
        <label className="filter">
          <span className="filter-label">Status</span>
          <select value={filters.status} onChange={(e) => set('status')(e.target.value)}>
            <option value="">All statuses</option>
            <option value={OPEN}>Open (to do or in progress)</option>
            {(['todo', 'doing', 'done', 'dropped'] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <Select
          label="Priority"
          value={filters.priority}
          onChange={set('priority')}
          all="All priorities"
          options={['p0', 'p1', 'p2'].map((p) => ({ value: p, label: p.toUpperCase() }))}
        />
      </form>
      {bundle.tasks.length === 0 ? (
        <EmptyState title="No tasks yet">Tasks agreed in meetings will be listed here.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title="No tasks match these filters">
          {filtered ? 'Try widening a filter, or choose All statuses to include finished work.' : ''}
        </EmptyState>
      ) : (
        <div className="task-list">
          {rows.map((t) => (
            <TaskCard key={t.id} task={t} bundle={bundle} today={today} />
          ))}
        </div>
      )}
    </>
  );
}
