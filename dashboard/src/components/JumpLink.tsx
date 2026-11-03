import { useEffect, useState, type ReactNode } from 'react';

/** Finds a record by its data-id by comparing values, never by building a selector from the id. */
export function findById(id: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>('[data-id]')) {
    if (el.dataset.id === id) return el;
  }
  return null;
}

/** Scrolls to the record carrying this data-id and flashes it, without touching the route. */
export function jumpTo(id: string): void {
  const el = findById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.setAttribute('data-flash', 'true');
  window.setTimeout(() => el.removeAttribute('data-flash'), 1800);
}

/** Reads `id` from the hash query (`#/route?id=...`); null when absent. */
export function hashId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id');
}

/** On mount and whenever the hash id changes, jump to that record. */
export function useJumpToHashId(): void {
  const [id, setId] = useState(hashId);
  useEffect(() => {
    const onHash = () => setId(hashId());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (id) jumpTo(id);
  }, [id]);
}

export function JumpLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#/decisions?id=${encodeURIComponent(id)}`}
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
