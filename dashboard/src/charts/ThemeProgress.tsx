import { useId, useState } from 'react';
import type { DashboardBundle } from '../../../src/bundle/build';
import { themeProgress } from '../../../src/metrics/trackers';
import { EmptyState } from '../components/EmptyState';
import { pct } from './kit';

type Row = ReturnType<typeof themeProgress>[number];

function ThemeRow({ row }: { row: Row }) {
  const { theme, done, open, rate } = row;
  const text =
    rate === null ? 'No tasks yet' : `${done} of ${done + open} done · ${pct(rate)}`;
  return (
    <li className="theme-row" data-theme-id={theme.id}>
      <div className="theme-head">
        <span className="theme-name">{theme.name}</span>
        <span className="theme-count">{text}</span>
      </div>
      <svg className="meter" width="100%" height="10" role="img" aria-label={`${theme.name}: ${text}`}>
        <title>{`${theme.name}: ${text}${open ? `, ${open} open` : ''}`}</title>
        <rect className="meter-track" x="0" y="0" width="100%" height="10" rx="5" />
        {rate !== null && rate > 0 ? (
          <rect className="meter-fill" x="0" y="0" width={`${(rate * 100).toFixed(2)}%`} height="10" rx="5" />
        ) : null}
      </svg>
    </li>
  );
}

export function ThemeProgress({ bundle, today }: { bundle: DashboardBundle; today: string }) {
  const rows = themeProgress(bundle.tasks, bundle.themes, today);
  const [showArchived, setShowArchived] = useState(false);
  const archivedId = useId();
  const active = rows.filter((r) => !r.archived);
  const archived = rows.filter((r) => r.archived);

  if (rows.length === 0) {
    return (
      <div data-chart="themes">
        <EmptyState title="No themes yet">Themes appear here once they are added.</EmptyState>
      </div>
    );
  }

  return (
    <div data-chart="themes" className="chart">
      {active.length ? (
        <ul className="theme-list">
          {active.map((r) => (
            <ThemeRow key={r.theme.id} row={r} />
          ))}
        </ul>
      ) : (
        <EmptyState title="No active themes">Every theme has been quiet for two weeks.</EmptyState>
      )}
      {archived.length ? (
        <>
          <button
            type="button"
            className="toggle"
            aria-expanded={showArchived}
            aria-controls={archivedId}
            onClick={() => setShowArchived((s) => !s)}
          >
            {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
          </button>
          <ul id={archivedId} className="theme-list theme-archived" hidden={!showArchived}>
            {archived.map((r) => (
              <ThemeRow key={r.theme.id} row={r} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
