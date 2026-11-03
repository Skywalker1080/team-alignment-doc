import type { DashboardBundle } from '../../../src/bundle/build';
import type { LaneTask } from '../../../src/metrics/tasks';
import { firstName } from '../format';
import { EmptyState } from './EmptyState';
import { TaskCard } from './TaskCard';

type Props = { owner: string; tasks: LaneTask[]; bundle: DashboardBundle; today: string };

export function Lane({ owner, tasks, bundle, today }: Props) {
  const headingId = `lane-${owner}`;
  const overdue = tasks.filter((t) => t.overdue > 0).length;
  return (
    <section className="lane" aria-labelledby={headingId} data-lane={owner}>
      <header className="lane-head">
        <h2 id={headingId} className="lane-name">
          {firstName(bundle, owner)}
        </h2>
        <span className="lane-count">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          {overdue > 0 ? <span className="lane-overdue">, {overdue} overdue</span> : null}
        </span>
      </header>
      {tasks.length === 0 ? (
        <EmptyState title="Nothing due or in progress" />
      ) : (
        <div className="card-grid">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} bundle={bundle} today={today} />
          ))}
        </div>
      )}
    </section>
  );
}
