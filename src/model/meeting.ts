import type { MeetingFront } from './schemas';

export type Section = { heading: string; bullets: string[] };
export type Meeting = MeetingFront & { sections: Section[]; stray: string[]; file: string };

/**
 * Parses the markdown body of a meeting file (a leading frontmatter block is skipped if present).
 * `## ` starts a section, `- ` adds a bullet to the current section. Any other
 * non-blank line (including bullets before the first heading) goes to `stray`.
 */
export function parseMeetingBody(md: string): { sections: Section[]; stray: string[] } {
  const sections: Section[] = [];
  const stray: string[] = [];
  let current: Section | null = null;
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) lines.splice(0, end + 1);
  }
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '') continue;
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), bullets: [] };
      sections.push(current);
    } else if (line.startsWith('- ') && current) {
      current.bullets.push(line.slice(2).trim());
    } else {
      stray.push(line.trim());
    }
  }
  return { sections, stray };
}

/** Orders meeting ids by date, then by numeric suffix (no suffix = first of the day). */
export function compareMeetingIds(a: string, b: string): number {
  const split = (id: string): [string, number] => {
    const m = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?$/.exec(id);
    return m ? [m[1]!, m[2] ? Number(m[2]) : 1] : [id, 1];
  };
  const [da, na] = split(a);
  const [db, nb] = split(b);
  if (da !== db) return da < db ? -1 : 1;
  return na - nb;
}
