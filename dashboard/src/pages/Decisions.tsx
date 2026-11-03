import type { DashboardBundle } from '../../../src/bundle/build';
import { compareMeetingIds } from '../../../src/model/meeting';
import { shortDate } from '../format';
import { EmptyState } from '../components/EmptyState';
import { JumpLink } from '../components/JumpLink';

type Props = { bundle: DashboardBundle };

const STATUS_NOTE: Record<string, string> = { superseded: 'Superseded', reversed: 'Reversed' };

export function Decisions({ bundle }: Props) {
  const decisions = [...bundle.decisions].sort(
    (a, b) => compareMeetingIds(b.made, a.made) || b.id.localeCompare(a.id),
  );
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Decisions</h1>
        <p className="counts">
          {decisions.filter((d) => d.status === 'active').length} active · {decisions.length} in total
        </p>
      </header>
      {decisions.length === 0 ? (
        <EmptyState title="No decisions yet">Decisions made in meetings will appear here, newest first.</EmptyState>
      ) : (
        <ol className="dtimeline">
          {decisions.map((d) => {
            const theme = bundle.themes.find((t) => t.id === d.theme)?.name ?? d.theme;
            const inactive = d.status !== 'active';
            return (
              <li key={d.id} className="dt-item" data-id={d.id} data-status={d.status} data-dim={inactive}>
                <div className="dt-top">
                  <time className="dt-date" dateTime={d.made.slice(0, 10)}>
                    {shortDate(d.made)}
                  </time>
                  <span className="dt-id">{d.id}</span>
                  <span className="meta-item">{theme}</span>
                  {inactive ? <span className="status-pill">{STATUS_NOTE[d.status]}</span> : null}
                </div>
                <p className="dt-text">{d.text}</p>
                {d.why ? <p className="dt-why">Why: {d.why}</p> : null}
                {d.superseded_by ? (
                  <p className="dt-link">
                    <JumpLink id={d.superseded_by}>→ {d.superseded_by}</JumpLink>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
