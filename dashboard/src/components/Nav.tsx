import { useEffect, useRef } from 'react';

export const ROUTES = [
  { id: 'today', label: 'Today' },
  { id: 'trackers', label: 'Trackers' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'tasks', label: 'Tasks' },
] as const;

export type Route = (typeof ROUTES)[number]['id'];

export function Nav({ current }: { current: Route }) {
  const navRef = useRef<HTMLElement>(null);

  // On narrow screens the links scroll sideways; keep the current one in view.
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !link) return;
    const overflowLeft = link.offsetLeft < nav.scrollLeft;
    const overflowRight = link.offsetLeft + link.offsetWidth > nav.scrollLeft + nav.clientWidth - 28;
    if (overflowLeft || overflowRight) nav.scrollLeft = link.offsetLeft - 16;
  }, [current]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="wordmark" href="#/today">
          Alignment
        </a>
        <nav ref={navRef} className="nav" aria-label="Sections">
          {ROUTES.map((r) => (
            <a
              key={r.id}
              href={`#/${r.id}`}
              className="nav-link"
              aria-current={r.id === current ? 'page' : undefined}
            >
              {r.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
