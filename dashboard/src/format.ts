import type { DashboardBundle } from '../../src/bundle/build';
import type { LaneTask } from '../../src/metrics/tasks';
import { daysBetween } from '../../src/metrics/dates';
import type { HistoryEvent } from '../../src/model/schemas';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(d: string): [number, number, number] {
  return d.slice(0, 10).split('-').map(Number) as [number, number, number];
}

/** '2026-11-03' → '3 Nov'. */
export function shortDate(d: string): string {
  const [, m, day] = parts(d);
  return `${day} ${MONTHS[m - 1]}`;
}

/** '2026-11-12' → 'Thu'. Computed in UTC so the calendar date never shifts. */
export function weekday(d: string): string {
  const [y, m, day] = parts(d);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]!;
}

/** '2026-11-10' → 'Tuesday 10 November'. */
export function longDate(d: string): string {
  const [y, m, day] = parts(d);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, day)));
}

/** 'due today', 'due tomorrow', 'due Thu' (within a week), 'due 24 Nov', or '7d overdue'. */
export function dueLabel(t: LaneTask, today: string): string {
  if (t.overdue > 0) return `${t.overdue}d overdue`;
  const ahead = daysBetween(today, t.deadline.date);
  if (ahead === 0) return 'due today';
  if (ahead === 1) return 'due tomorrow';
  if (ahead > 0 && ahead < 7) return `due ${weekday(t.deadline.date)}`;
  return `due ${shortDate(t.deadline.date)}`;
}

/** 'from 3 Nov · 7d overdue'; just the due part when the task was created today. */
export function originBadge(t: LaneTask, today: string): string {
  const originDate = t.origin.slice(0, 10);
  const due = dueLabel(t, today);
  return originDate === today ? due : `from ${shortDate(originDate)} · ${due}`;
}

export function fullName(bundle: Pick<DashboardBundle, 'team'>, ownerId: string): string {
  if (ownerId === 'anyone') return 'Anyone';
  return bundle.team.find((m) => m.id === ownerId)?.name ?? ownerId;
}

export function firstName(bundle: Pick<DashboardBundle, 'team'>, ownerId: string): string {
  if (ownerId === 'anyone') return 'Anyone';
  return bundle.team.find((m) => m.id === ownerId)?.first ?? ownerId;
}

export const STATUS_LABEL: Record<string, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
  dropped: 'Dropped',
};

/** One readable sentence for a history event, e.g. 'Ranjeet moved the deadline from 5 Nov to 9 Nov'. */
export function historyText(bundle: Pick<DashboardBundle, 'team' | 'themes'>, h: HistoryEvent): string {
  const who = firstName(bundle, h.by);
  const note = h.text ? `: ${h.text}` : '';
  const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const val = (s?: string) => (s === undefined ? '' : isDate(s) ? shortDate(s) : s);
  switch (h.event) {
    case 'created':
      return `Created by ${who}${note}`;
    case 'status':
      return `${who} set it to ${(STATUS_LABEL[h.to ?? ''] ?? h.to ?? '').toLowerCase()}${note}`;
    case 'deadline':
      return `${who} moved the deadline from ${val(h.from)} to ${val(h.to)}${note}`;
    case 'owner':
      return `${who} handed it from ${fullName(bundle, h.from ?? '')} to ${fullName(bundle, h.to ?? '')}${note}`;
    case 'priority':
      return `${who} changed priority from ${(h.from ?? '').toUpperCase()} to ${(h.to ?? '').toUpperCase()}${note}`;
    case 'theme': {
      const theme = (id?: string) => bundle.themes.find((t) => t.id === id)?.name ?? id ?? '';
      return `${who} moved it from ${theme(h.from)} to ${theme(h.to)}${note}`;
    }
    case 'note':
      return `${who}${note || ' added a note'}`;
    default:
      return `${who}: ${h.event}${note}`;
  }
}
