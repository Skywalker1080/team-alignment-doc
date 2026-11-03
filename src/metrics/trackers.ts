import type { Task, Theme } from '../model/schemas';
import { compareMeetingIds, type Meeting } from '../model/meeting';
import { dateInTz, daysBetween, isoWeek } from './dates';
import { ageDays, closedOn, firstDeadline, isOpen, meetingsSince } from './tasks';

export type Rate = { kept: number; total: number; rate: number | null };

const toRate = (kept: number, total: number): Rate => ({
  kept,
  total,
  rate: total === 0 ? null : kept / total,
});

export function keptPromises(
  tasks: Task[],
  today: string,
): { week: string; hard: Rate; all: Rate }[] {
  const byWeek = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.status === 'dropped') continue;
    const fd = firstDeadline(t);
    if (fd > today) continue;
    const w = isoWeek(fd);
    byWeek.set(w, [...(byWeek.get(w) ?? []), t]);
  }
  const kept = (t: Task) => {
    const c = closedOn(t);
    return t.status === 'done' && c !== null && c <= firstDeadline(t);
  };
  return [...byWeek.keys()].sort().map((week) => {
    const ts = byWeek.get(week)!;
    const hard = ts.filter((t) => t.deadline.kind === 'hard');
    return {
      week,
      hard: toRate(hard.filter(kept).length, hard.length),
      all: toRate(ts.filter(kept).length, ts.length),
    };
  });
}

/** Open tasks bucketed by how many meetings they have survived. Oldest ties break on lowest id. */
export function carryoverBuckets(
  tasks: Task[],
  meetings: Meeting[],
  today: string,
): {
  onTime: number;
  carried1: number;
  carried2plus: number;
  oldest: { id: string; ageDays: number } | null;
} {
  const out = {
    onTime: 0,
    carried1: 0,
    carried2plus: 0,
    oldest: null as { id: string; ageDays: number } | null,
  };
  for (const t of tasks.filter(isOpen)) {
    const n = meetingsSince(t, meetings, today);
    if (n === 0) out.onTime++;
    else if (n === 1) out.carried1++;
    else out.carried2plus++;
    const age = ageDays(t, today);
    if (!out.oldest || age > out.oldest.ageDays || (age === out.oldest.ageDays && t.id < out.oldest.id)) {
      out.oldest = { id: t.id, ageDays: age };
    }
  }
  return out;
}

export function workload(
  tasks: Task[],
  memberIds: string[],
): { owner: string; p0: number; p1: number; p2: number; total: number }[] {
  return [...memberIds, 'anyone'].map((owner) => {
    const mine = tasks.filter((t) => isOpen(t) && t.owner === owner);
    return {
      owner,
      p0: mine.filter((t) => t.priority === 'p0').length,
      p1: mine.filter((t) => t.priority === 'p1').length,
      p2: mine.filter((t) => t.priority === 'p2').length,
      total: mine.length,
    };
  });
}

const ARCHIVE_AFTER_DAYS = 14;

/** rate = done / (done + open); dropped tasks are ignored. */
export function themeProgress(
  tasks: Task[],
  themes: Theme[],
  today: string,
): { theme: Theme; done: number; open: number; rate: number | null; archived: boolean }[] {
  const recent = (date: string) => daysBetween(date, today) < ARCHIVE_AFTER_DAYS;
  return themes.map((theme) => {
    const mine = tasks.filter((t) => t.theme === theme.id);
    const done = mine.filter((t) => t.status === 'done').length;
    const open = mine.filter(isOpen).length;
    const active =
      open > 0 ||
      recent(theme.created) ||
      mine.some((t) => t.history.some((h) => recent(dateInTz(h.at))));
    return { theme, done, open, rate: done + open === 0 ? null : done / (done + open), archived: !active };
  });
}

export function meetingReview(
  meeting: Meeting,
  prev: Meeting | null,
  tasks: Task[],
): { done: string[]; dropped: string[]; slipped: string[] } {
  const done: string[] = [];
  const dropped: string[] = [];
  const slipped: string[] = [];
  for (const t of tasks) {
    if (compareMeetingIds(t.origin, meeting.id) >= 0) continue;
    const c = closedOn(t);
    const closedInWindow = c !== null && (prev === null || c > prev.date) && c <= meeting.date;
    if (closedInWindow && t.status === 'done') done.push(t.id);
    else if (closedInWindow && t.status === 'dropped') dropped.push(t.id);
    const closedByNow = c !== null && c <= meeting.date;
    if (!closedByNow && t.deadline.date < meeting.date) slipped.push(t.id);
  }
  return { done: done.sort(), dropped: dropped.sort(), slipped: slipped.sort() };
}
