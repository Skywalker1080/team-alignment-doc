import { describe, it, expect, vi } from 'vitest';
import { dateInTz, daysBetween, isoWeek, weekRange, todayIso, TZ } from '../../src/metrics/dates';

describe('dates', () => {
  it('TZ is Asia/Kolkata', () => expect(TZ).toBe('Asia/Kolkata'));
  it('dateInTz converts UTC to IST date', () => {
    expect(dateInTz('2026-11-04T19:00:00Z')).toBe('2026-11-05');
  });
  it('dateInTz keeps the IST date for an offset timestamp', () => {
    expect(dateInTz('2026-11-05T00:30:00+05:30')).toBe('2026-11-05');
  });
  it('dateInTz builds the date from formatToParts, not a locale-formatted string', () => {
    // A locale whose format() is not YYYY-MM-DD must not change the result.
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'format', 'get')
      .mockReturnValue(() => '11/05/2026');
    try {
      expect(dateInTz('2026-11-04T19:00:00Z')).toBe('2026-11-05');
    } finally {
      spy.mockRestore();
    }
  });
  it('todayIso uses IST', () => {
    expect(todayIso(new Date('2026-11-04T19:00:00Z'))).toBe('2026-11-05');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-10-14', '2026-11-03')).toBe(20);
    expect(daysBetween('2026-11-03', '2026-11-03')).toBe(0);
    expect(daysBetween('2026-11-10', '2026-11-03')).toBe(-7);
  });
  it('isoWeek', () => {
    expect(isoWeek('2026-11-03')).toBe('2026-W45');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(isoWeek('2026-11-08')).toBe('2026-W45');
    expect(isoWeek('2026-11-09')).toBe('2026-W46');
  });
  it('weekRange', () => {
    expect(weekRange('2026-W45')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(weekRange('2026-W53')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
});
