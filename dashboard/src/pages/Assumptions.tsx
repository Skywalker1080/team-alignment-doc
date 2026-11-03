import type { DashboardBundle } from '../../../src/bundle/build';
import { daysBetween } from '../../../src/metrics/dates';
import type { Assumption } from '../../../src/model/schemas';
import { compareMeetingIds } from '../../../src/model/meeting';
import { shortDate } from '../format';
import { EmptyState } from '../components/EmptyState';

type Props = { bundle: DashboardBundle; today: string };

const COLUMNS: { status: Assumption['status']; title: string; empty: string }[] = [
  { status: 'untested', title: 'Untested', empty: 'Nothing waiting to be tested' },
  { status: 'confirmed', title: 'Confirmed', empty: 'Nothing confirmed yet' },
  { status: 'rejected', title: 'Rejected', empty: 'Nothing rejected yet' },
];

export function Assumptions({ bundle, today }: Props) {
  const all = bundle.assumptions;
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Assumptions</h1>
        <p className="counts">
          {all.filter((a) => a.status === 'untested').length} untested · {all.length} in total
        </p>
      </header>
      {all.length === 0 ? (
        <EmptyState title="No assumptions yet">Assumptions the team is betting on will be tracked here.</EmptyState>
      ) : (
        <div className="board">
          {COLUMNS.map((col) => {
            const items = all
              .filter((a) => a.status === col.status)
              .sort((a, b) => compareMeetingIds(b.made, a.made) || b.id.localeCompare(a.id));
            return (
              <section key={col.status} className="board-col" aria-labelledby={`as-${col.status}`} data-column={col.status}>
                <h2 id={`as-${col.status}`} className="board-head">
                  {col.title} <span className="lane-count">{items.length}</span>
                </h2>
                {items.length === 0 ? (
                  <EmptyState title={col.empty} />
                ) : (
                  <div className="board-list">
                    {items.map((a) => {
                      const theme = bundle.themes.find((t) => t.id === a.theme)?.name ?? a.theme;
                      return (
                        <article key={a.id} className="card as-card" data-id={a.id} data-status={a.status}>
                          <p className="as-text">{a.text}</p>
                          {a.evidence ? <p className="dt-why">Evidence: {a.evidence}</p> : null}
                          <p className="card-meta">
                            <span className="dt-id">{a.id}</span>
                            <span className="meta-item">{theme}</span>
                            <span className="meta-item">from {shortDate(a.made)}</span>
                            {a.status === 'untested' ? (
                              <span className="badge badge-quiet">
                                {daysBetween(a.made.slice(0, 10), today)}d untested
                              </span>
                            ) : null}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
