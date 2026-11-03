import { z } from 'zod';

export const ID_RE = {
  T: /^T-\d{4}$/,
  D: /^D-\d{4}$/,
  A: /^A-\d{4}$/,
} as const;
export const MEETING_ID_RE = /^\d{4}-\d{2}-\d{2}(-\d+)?$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 8601 timestamp that must carry an offset (Z or +HH:MM). */
export const TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
export const SECTION_ORDER = ['Discussion', 'Decisions', 'Tasks', 'Assumptions'] as const;

const dateString = z.string().regex(DATE_RE, 'expected YYYY-MM-DD');
const timestamp = z.string().regex(TIMESTAMP_RE, 'expected ISO 8601 timestamp with offset');
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'expected lowercase slug');
const meetingId = z.string().regex(MEETING_ID_RE, 'expected meeting id (YYYY-MM-DD[-n])');
const taskId = z.string().regex(ID_RE.T, 'expected T-NNNN');
const decisionId = z.string().regex(ID_RE.D, 'expected D-NNNN');
const assumptionId = z.string().regex(ID_RE.A, 'expected A-NNNN');
/** Member id from team.yaml, or the literal "anyone". Membership is checked by the validator. */
const memberRef = slug;

export const MemberSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    emails: z.array(z.string().min(1)),
  })
  .strict();
export type Member = z.infer<typeof MemberSchema>;

export const TeamSchema = z.object({ members: z.array(MemberSchema) }).strict();
export type Team = z.infer<typeof TeamSchema>;

export const ThemeSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    created: dateString,
  })
  .strict();
export type Theme = z.infer<typeof ThemeSchema>;

export const ThemesSchema = z.object({ themes: z.array(ThemeSchema) }).strict();
export type Themes = z.infer<typeof ThemesSchema>;

export const HistoryEventSchema = z
  .object({
    at: timestamp,
    by: memberRef,
    event: z.enum([
      'created',
      'status',
      'note',
      'deadline',
      'owner',
      'priority',
      'theme',
      'superseded',
      'reversed',
      'evidence',
    ]),
    from: z.string().optional(),
    to: z.string().optional(),
    text: z.string().optional(),
  })
  .strict();
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;

export const TaskSchema = z
  .object({
    id: taskId,
    title: z.string().min(1),
    description: z.string(),
    owner: memberRef,
    priority: z.enum(['p0', 'p1', 'p2']),
    theme: slug,
    deadline: z
      .object({
        date: dateString,
        kind: z.enum(['hard', 'soft']),
        defaulted: z.boolean().optional(),
      })
      .strict(),
    status: z.enum(['todo', 'doing', 'done', 'dropped']),
    origin: meetingId,
    history: z.array(HistoryEventSchema),
  })
  .strict();
export type Task = z.infer<typeof TaskSchema>;

export const DecisionSchema = z
  .object({
    id: decisionId,
    text: z.string().min(1),
    why: z.string().optional(),
    made: meetingId,
    theme: slug,
    status: z.enum(['active', 'superseded', 'reversed']),
    superseded_by: decisionId.optional(),
    history: z.array(HistoryEventSchema),
  })
  .strict();
export type Decision = z.infer<typeof DecisionSchema>;

export const AssumptionSchema = z
  .object({
    id: assumptionId,
    text: z.string().min(1),
    made: meetingId,
    theme: slug,
    status: z.enum(['untested', 'confirmed', 'rejected']),
    evidence: z.string(),
    history: z.array(HistoryEventSchema),
  })
  .strict();
export type Assumption = z.infer<typeof AssumptionSchema>;

export const MeetingFrontSchema = z
  .object({
    id: meetingId,
    date: dateString,
    attendees: z.array(memberRef),
    notes_by: memberRef,
    raw: z.string().min(1),
    principle: z.string().optional(),
    tasks_created: z.array(taskId).default([]),
    decisions_made: z.array(decisionId).default([]),
    assumptions_made: z.array(assumptionId).default([]),
  })
  .strict();
export type MeetingFront = z.infer<typeof MeetingFrontSchema>;
