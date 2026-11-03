# basic fixture

Reused by later tasks. "Today" in tests is 2026-11-10 (Asia/Kolkata). Emails are fake and appear only in team.yaml.

Members: yogesh (Yogesh Sahu), ranjeet (Ranjeet Ratan), pranav (Pranav Darekar).
Themes: outreach, lead-generation, team-process (all created 2026-11-03).

## Meetings
| id | notes_by | attendees | tasks | decisions | assumptions |
|---|---|---|---|---|---|
| 2026-11-03 | pranav | all 3 | T-0001, T-0002, T-0003 | D-0001 | A-0001 |
| 2026-11-03-2 | yogesh | yogesh, ranjeet | T-0004, T-0005, T-0006 | none | A-0002 |
| 2026-11-06 | ranjeet | all 3 | T-0007, T-0008 | D-0002 | none |

2026-11-03 has a principle and a 4-bullet Discussion. Sort order: 2026-11-03, 2026-11-03-2, 2026-11-06.

## Tasks
| id | owner | prio | theme | deadline (kind) | status | origin | notes |
|---|---|---|---|---|---|---|---|
| T-0001 | ranjeet | p0 | lead-generation | 2026-11-03 (hard) | todo | 2026-11-03 | 7d overdue on 11-10 |
| T-0002 | pranav | p1 | outreach | 2026-11-12 (soft) | doing | 2026-11-03 | doing since 11-05 |
| T-0003 | ranjeet | p0 | lead-generation | 2026-11-09 (hard) | done | 2026-11-03 | deadline moved 11-05 to 11-09 (event 11-05), done 2026-11-08T17:45; first deadline 11-05 was missed |
| T-0004 | anyone | p2 | team-process | 2026-11-10 (soft) | todo | 2026-11-03-2 | due exactly today |
| T-0005 | yogesh | p1 | team-process | 2026-11-07 (hard) | done | 2026-11-03-2 | done 2026-11-06T12:15, on time |
| T-0006 | pranav | p2 | outreach | 2026-11-08 (soft) | dropped | 2026-11-03-2 | dropped 2026-11-07T11:00 with reason |
| T-0007 | yogesh | p1 | lead-generation | 2026-11-14 (hard) | todo | 2026-11-06 | |
| T-0008 | pranav | p0 | outreach | 2026-11-11 (soft) | doing | 2026-11-06 | doing since 11-09 |

Counts: todo 3 (T-0001, T-0004, T-0007), doing 2 (T-0002, T-0008), done 2 (T-0003, T-0005), dropped 1 (T-0006).
Every history starts with a `created` event by a member. Creators: T-0001 yogesh, T-0002 pranav, T-0003 ranjeet, T-0004..T-0006 yogesh, T-0007 and T-0008 ranjeet.

## Decisions
- D-0001: made 2026-11-03, team-process, superseded_by D-0002 (superseded event 2026-11-06T19:10).
- D-0002: made 2026-11-06, team-process, active.

## Assumptions
- A-0001: made 2026-11-03, outreach, untested, no evidence.
- A-0002: made 2026-11-03-2, lead-generation, confirmed 2026-11-08T17:50 with evidence.

Raw notes: meetings/raw/<meeting id>.md exist for all three meetings.
