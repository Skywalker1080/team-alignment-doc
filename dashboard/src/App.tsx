import { useEffect, useState } from 'react';
import type { DashboardBundle } from '../../src/bundle/build';
import { todayIso } from '../../src/metrics/dates';
import raw from './generated/bundle.json';
import { Nav, ROUTES, type Route } from './components/Nav';
import { Today } from './pages/Today';
import { Trackers } from './pages/Trackers';
import { Decisions } from './pages/Decisions';
import { Assumptions } from './pages/Assumptions';
import { Meetings } from './pages/Meetings';
import { Tasks } from './pages/Tasks';

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

  return (
    <>
      <Nav current={route} />
      <main className="page">
        {route === 'today' ? (
          <Today bundle={bundle} today={today} />
        ) : route === 'trackers' ? (
          <Trackers bundle={bundle} today={today} />
        ) : route === 'decisions' ? (
          <Decisions bundle={bundle} />
        ) : route === 'assumptions' ? (
          <Assumptions bundle={bundle} today={today} />
        ) : route === 'meetings' ? (
          <Meetings bundle={bundle} />
        ) : (
          <Tasks bundle={bundle} today={today} />
        )}
      </main>
    </>
  );
}
