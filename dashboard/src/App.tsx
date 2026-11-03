import { useEffect, useState } from 'react';
import type { DashboardBundle } from '../../src/bundle/build';
import { todayIso } from '../../src/metrics/dates';
import raw from './generated/bundle.json';
import { Nav, ROUTES, type Route } from './components/Nav';
import { EmptyState } from './components/EmptyState';
import { Today } from './pages/Today';

const bundle = raw as unknown as DashboardBundle;

function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return ROUTES.find((r) => r.id === name)?.id ?? 'today';
}

/** Today's IST date; `?today=YYYY-MM-DD` pins it for previews and fixture checks. */
function resolveToday(): string {
  const pinned = new URLSearchParams(window.location.search).get('today');
  return pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned) ? pinned : todayIso();
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  const [today] = useState(resolveToday);

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const label = ROUTES.find((r) => r.id === route)!.label;
  return (
    <>
      <Nav current={route} />
      <main className="page">
        {route === 'today' ? (
          <Today bundle={bundle} today={today} />
        ) : (
          <>
            <header className="page-head">
              <h1 className="page-title">{label}</h1>
            </header>
            <EmptyState title="Coming soon">This view is being built.</EmptyState>
          </>
        )}
      </main>
    </>
  );
}
