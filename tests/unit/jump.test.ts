import { describe, it, expect, afterEach, vi } from 'vitest';
import { findById, jumpTo } from '../../dashboard/src/components/JumpLink';

function fakeEl(id: string) {
  const attrs: Record<string, string> = {};
  return {
    dataset: { id },
    scrollIntoView: vi.fn(),
    setAttribute: (k: string, v: string) => (attrs[k] = v),
    removeAttribute: (k: string) => delete attrs[k],
    attrs,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('jumpTo', () => {
  it('never throws on a hostile id and finds nothing', () => {
    const el = fakeEl('T-0001');
    // Like a real DOM, a selector built from untrusted text would throw here.
    vi.stubGlobal('document', {
      querySelector: () => {
        throw new SyntaxError('invalid selector');
      },
      querySelectorAll: () => [el],
    });
    vi.stubGlobal('window', { setTimeout: vi.fn() });
    for (const bad of ['a"]', '"] , body', "x'\\", '']) expect(() => jumpTo(bad)).not.toThrow();
    expect(findById('a"]')).toBeNull();
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls to and flashes the matching record', () => {
    const el = fakeEl('T-0003');
    vi.stubGlobal('document', { querySelectorAll: () => [fakeEl('T-0001'), el] });
    vi.stubGlobal('window', { setTimeout: vi.fn() });
    jumpTo('T-0003');
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.attrs['data-flash']).toBe('true');
  });
});
