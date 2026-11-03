import type { ReactNode } from 'react';
import type { DashboardBundle } from '../../../src/bundle/build';
import { longDate } from '../format';
import { PromisesChart } from '../charts/PromisesChart';
import { TimelineChart } from '../charts/TimelineChart';
import { CarryoverChart } from '../charts/CarryoverChart';
import { WorkloadChart } from '../charts/WorkloadChart';
import { ThemeProgress } from '../charts/ThemeProgress';

type Props = { bundle: DashboardBundle; today: string };

function Card({ id, title, caption, children }: { id: string; title: string; caption: string; children: ReactNode }) {
  return (
    <section className="chart-card" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="chart-heading">
        {title}
      </h2>
      <p className="chart-caption">{caption}</p>
      {children}
    </section>
  );
}

export function Trackers({ bundle, today }: Props) {
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Trackers</h1>
        <p className="counts">As of {longDate(today)}</p>
      </header>
      <div className="chart-stack">
        <Card
          id="promises"
          title="Kept promises"
          caption="Share of tasks finished by their first deadline, week by week."
        >
          <PromisesChart tasks={bundle.tasks} today={today} />
        </Card>
        <Card
          id="timeline"
          title="Deadline timeline"
          caption="Each open or recently closed task, from the meeting it came from to its deadline."
        >
          <TimelineChart bundle={bundle} today={today} />
        </Card>
        <Card
          id="carryover"
          title="Carry-over age"
          caption="Open tasks by how many meetings they have stayed open through."
        >
          <CarryoverChart bundle={bundle} today={today} />
        </Card>
        <Card id="workload" title="Workload" caption="Open tasks per person, split by priority.">
          <WorkloadChart bundle={bundle} />
        </Card>
        <Card
          id="themes"
          title="Theme progress"
          caption="How much of each theme's work is done; dropped tasks are left out."
        >
          <ThemeProgress bundle={bundle} today={today} />
        </Card>
      </div>
    </>
  );
}
