import type { DashboardBundle } from '../../../src/bundle/build';
import type { Meeting } from '../../../src/model/meeting';
import { isOpen, overdueDays, todayLanes } from '../../../src/metrics/tasks';
import { dateInTz } from '../../../src/metrics/dates';
import { longDate, shortDate } from '../format';
import { Lane } from '../components/Lane';

type Props = { bundle: DashboardBundle; today: string };

export function Today({ bundle, today }: Props) {
  // meetingsSince reads only id and date; the bundle drops file/stray, which todayLanes never touches.
  const meetings = bundle.meetings as unknown as Meeting[];
  const lanes = todayLanes(
    bundle.tasks,
    bundle.team.map((m) => m.id),
    meetings,
    today,
  );
  const open = bundle.tasks.filter(isOpen);
  const overdue = open.filter((t) => overdueDays(t, today) > 0).length;
  const dueToday = open.filter((t) => t.deadline.date === today).length;
  const builtAt = new Date(bundle.builtAt);
  const updated = Number.isNaN(builtAt.getTime())
    ? null
    : `${shortDate(dateInTz(builtAt))}, ${builtAt.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      })}`;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">{longDate(today)}</h1>
        <p className="counts" data-testid="counts">
          {open.length} open · <span className={overdue > 0 ? 'count-danger' : undefined}>{overdue} overdue</span>
          {' · '}
          <span className={dueToday > 0 ? 'count-warn' : undefined}>{dueToday} due today</span>
        </p>
      </header>
      <div className="lanes">
        {lanes.map((l) => (
          <Lane key={l.owner} owner={l.owner} tasks={l.tasks} bundle={bundle} today={today} />
        ))}
      </div>
      {updated ? <p className="updated">Data as of {updated} IST</p> : null}
    </>
  );
}
