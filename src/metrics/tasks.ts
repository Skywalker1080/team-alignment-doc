import type { Task } from '../model/schemas';
import { compareMeetingIds, type Meeting } from '../model/meeting';
import { dateInTz, daysBetween } from './dates';

export function isOpen(t: Task): boolean {
  return t.status === 'todo' || t.status === 'doing';
}

export function overdueDays(t: Task, today: string): number {
  if (!isOpen(t) || t.deadline.date >= today) return 0;
  return daysBetween(t.deadline.date, today);
}

/** The deadline before any move: `from` of the earliest deadline event, else the current one. */
export function firstDeadline(t: Task): string {
  const ev = t.history.find((h) => h.event === 'deadline' && h.from);
  return ev?.from ?? t.deadline.date;
}

/** IST date of the last status event to done/dropped, or null. */
export function closedOn(t: Task): string | null {
  for (let i = t.history.length - 1; i >= 0; i--) {
    const h = t.history[i]!;
    if (h.event === 'status' && (h.to === 'done' || h.to === 'dropped')) return dateInTz(h.at);
  }
  return null;
}

/** Days since the task was created (IST date of its first history event). */
export function ageDays(t: Task, today: string): number {
  const created = t.history[0];
  return created ? daysBetween(dateInTz(created.at), today) : 0;
}

export function meetingsSince(t: Task, meetings: Meeting[], today: string): number {
  return meetings.filter((m) => compareMeetingIds(m.id, t.origin) > 0 && m.date <= today).length;
}

export type LaneTask = Task & { overdue: number; ageDays: number; meetingsSince: number };

export function todayLanes(
  tasks: Task[],
  memberIds: string[],
  meetings: Meeting[],
  today: string,
): { owner: string; tasks: LaneTask[] }[] {
  const owners = [...memberIds, 'anyone'];
  return owners.map((owner) => ({
    owner,
    tasks: tasks
      .filter((t) => t.owner === owner && isOpen(t) && (t.status === 'doing' || t.deadline.date <= today))
      .map((t) => ({
        ...t,
        overdue: overdueDays(t, today),
        ageDays: ageDays(t, today),
        meetingsSince: meetingsSince(t, meetings, today),
      }))
      .sort(
        (a, b) =>
          b.overdue - a.overdue ||
          a.priority.localeCompare(b.priority) ||
          a.deadline.date.localeCompare(b.deadline.date),
      ),
  }));
}
