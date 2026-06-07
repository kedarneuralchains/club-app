-- Speaker speech time allotment (minutes), used by the dynamic meeting agenda.
-- Null = fall back to the level-based default in lib/agenda.ts
-- (Level 1 = 4-6 min, Levels 2-5 = 5-7 min). Only meaningful when
-- role_key = 'speaker'. Lets speakers/admins override the auto-timed agenda.
alter table role_claims
  add column if not exists speech_min_minutes integer
    check (speech_min_minutes between 1 and 60),
  add column if not exists speech_max_minutes integer
    check (speech_max_minutes between 1 and 60);
