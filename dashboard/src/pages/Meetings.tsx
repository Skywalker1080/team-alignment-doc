import type { DashboardBundle } from '../../../src/bundle/build';
import type { Meeting } from '../../../src/model/meeting';
import { compareMeetingIds } from '../../../src/model/meeting';
import { meetingReview } from '../../../src/metrics/trackers';
import { longDate, firstName } from '../format';
import { EmptyState } from '../components/EmptyState';

type Props = { bundle: DashboardBundle };

function Chips({ label, ids, tone }: { label: string; ids: string[]; tone: 'ok' | 'quiet' | 'danger' }) {
  return (
    <div className="chip-row" data-review={label.toLowerCase()}>
      <span className="chip-label">
        {label} <span className="chip-count">{ids.length}</span>
      </span>
      {ids.length === 0 ? (
        <span className="chip-none">none</span>
      ) : (
        ids.map((id) => (
          <a key={id} className={`chip chip-${tone}`} href={`#/tasks?all=1&id=${id}`}>
            {id}
          </a>
        ))
      )}
    </div>
  );
}

export function Meetings({ bundle }: Props) {
  // meetingReview reads only ids, dates and tasks; the bundle just drops file/stray.
  const asc = [...(bundle.meetings as unknown as Meeting[])].sort((a, b) => compareMeetingIds(a.id, b.id));
  const reviews = new Map(asc.map((m, i) => [m.id, meetingReview(m, asc[i - 1] ?? null, bundle.tasks)]));
  const meetings = [...asc].reverse();

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Meetings</h1>
        <p className="counts">{meetings.length} on record, newest first</p>
      </header>
      {meetings.length === 0 ? (
        <EmptyState title="No meetings yet">Meeting summaries will appear here after the first one.</EmptyState>
      ) : (
        <div className="meeting-stack">
          {meetings.map((m) => {
            const review = reviews.get(m.id)!;
            const first = asc[0]?.id === m.id;
            return (
              <article key={m.id} className="card meeting" data-id={m.id}>
                <header className="meeting-head">
                  <h2 className="meeting-title">{longDate(m.date)}</h2>
                  <p className="meeting-attendees">{m.attendees.map((a) => firstName(bundle, a)).join(', ')}</p>
                </header>
                {m.principle ? <p className="principle">{m.principle}</p> : null}
                <div className="tldr">
                  {m.sections.map((s) => (
                    <section key={s.heading} className="tldr-section">
                      <h3 className="tldr-head">{s.heading}</h3>
                      <ul className="tldr-list">
                        {s.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
                <section className="since" aria-label="Since last meeting">
                  <h3 className="tldr-head">Since last meeting</h3>
                  {first ? (
                    <p className="chip-none">First meeting on record.</p>
                  ) : (
                    <>
                      <Chips label="Done" ids={review.done} tone="ok" />
                      <Chips label="Dropped" ids={review.dropped} tone="quiet" />
                      <Chips label="Slipped" ids={review.slipped} tone="danger" />
                    </>
                  )}
                </section>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
