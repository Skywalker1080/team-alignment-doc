import type { ReactNode } from 'react';

/** Scrolls to the record carrying this data-id and flashes it, without touching the route. */
export function jumpTo(id: string): void {
  const el = document.querySelector<HTMLElement>(`[data-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.setAttribute('data-flash', 'true');
  window.setTimeout(() => el.removeAttribute('data-flash'), 1800);
}

export function JumpLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#/decisions?id=${id}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        jumpTo(id);
      }}
    >
      {children}
    </a>
  );
}
