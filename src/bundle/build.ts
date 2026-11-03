import type { RepoData, Meeting } from '../model/load';
import type { Theme, Task, Decision, Assumption } from '../model/schemas';

export type BundleMeeting = Omit<Meeting, 'file' | 'stray'>;

export interface DashboardBundle {
  builtAt: string;
  team: { id: string; name: string; first: string }[];
  themes: Theme[];
  tasks: Task[];
  decisions: Decision[];
  assumptions: Assumption[];
  meetings: BundleMeeting[];
}

/** Builds the sanitized dashboard payload: no emails, no file paths, no stray meeting text. */
export function buildBundle(data: RepoData, builtAt: string): DashboardBundle {
  return {
    builtAt,
    team: data.team.members.map((m) => ({
      id: m.id,
      name: m.name,
      first: m.name.trim().split(/\s+/)[0] ?? m.name,
    })),
    themes: data.themes,
    tasks: data.tasks,
    decisions: data.decisions,
    assumptions: data.assumptions,
    meetings: data.meetings.map(({ file: _file, stray: _stray, ...rest }) => rest),
  };
}
