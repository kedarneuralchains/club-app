import type { MeetingWithClaims, Member, RoleClaim, RoleKey } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic meeting agenda.
//
// Builds the running order from a meeting's role claims, as a "who calls whom"
// flow with member names inline (e.g. "TMoD TM Rishabh calls GE — TM Prakash").
// Roles not yet taken show a fill-in blank so the sheet is usable as roles fill.
//
// It is derived purely from the meeting + its claims, so it updates live as
// roles are claimed/released or speech details change.
//
// Club flow (Dehradun WIC India Toastmasters), in three sections:
//   ① Prepared Speeches — SAA opens → Chair → TMoD → GE introduces the role
//      players (TAGH) → per speaker: Evaluator states the project & criteria,
//      then the Speaker delivers.
//   ② Table Topics — TMoD hands to TTM, who runs the session.
//   ③ Evaluations — GE calls each Evaluator, then the TAGH reports, then the
//      general evaluation; TMoD hands back to the Chair to close.
//
// The clock runs 11:00 AM → 1:00 PM (the club's standard 2-hour meeting),
// independent of the meeting record's stored times. Most steps have fixed
// durations; the TMoD's theme & filler segment flexes to absorb the slack so
// the meeting lands at 1:00 PM for a typical sitting. Times are a guide;
// speeches use their upper (red) time to advance the clock.
// ─────────────────────────────────────────────────────────────────────────────

// Fixed agenda window — 11:00 AM to 1:00 PM, the club's standard meeting.
const AGENDA_START_MIN = 11 * 60;
const AGENDA_END_MIN = 13 * 60;

// The Chair's closing remarks are the final 5 minutes (12:55 → 1:00 PM) for the
// standard 3-speaker meeting, acting as the wrap-up buffer.
const CLOSING_MINUTES = 5;

// The TMoD's closing theme segment flexes within these bounds so the meeting
// lands at 1:00 PM for the club's standard 3-speaker meeting.
const FILLER_MIN_MINUTES = 2;
const FILLER_MAX_MINUTES = 12;

// Shown in place of a member's name when a role hasn't been claimed yet.
const BLANK = 'TM ____________';

export interface AgendaRow {
  time: string;             // running-clock start, e.g. "11:00 AM"
  lead: string;             // the call/action, e.g. "TMoD TM Rishabh calls GE"
  callee?: string | null;   // person called: name string, or null = fill-in blank
  detail?: string | null;   // speech title + path/level/project for speakers
  allotment?: string | null;// timed allotment, e.g. "5–7 min"
  indent?: boolean;         // sub-step under the role player who called it
}

export type AgendaSectionKey = 'prepared' | 'table_topics' | 'evaluations';

export interface AgendaSection {
  key: AgendaSectionKey;
  title: string;
  rows: AgendaRow[];
}

export interface Agenda {
  sections: AgendaSection[];
  startsAt: string;
  endsAt: string;
}

// Auxiliary ("TAGH") role players, in the order they're called.
const TAGH: { key: RoleKey; label: string }[] = [
  { key: 'timer', label: 'Timer' },
  { key: 'ah_counter', label: 'Ah-Counter' },
  { key: 'grammarian', label: 'Grammarian' },
  { key: 'harkmaster', label: 'Harkmaster' },
];

// Level-based default speech allotment. Level 1 (Ice Breaker etc.) runs 4–6 min;
// most other Pathways projects run 5–7 min. Overridable per speaker in the DB.
export function defaultSpeechTime(level: number | null | undefined): { min: number; max: number } {
  if (level === 1) return { min: 4, max: 6 };
  return { min: 5, max: 7 };
}

// Effective allotment for a speaker claim: stored override, else level default.
export function speechTime(claim: RoleClaim): { min: number; max: number } {
  const d = defaultSpeechTime(claim.speech_level);
  return {
    min: claim.speech_min_minutes ?? d.min,
    max: claim.speech_max_minutes ?? d.max,
  };
}

function fmtClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.round(totalMinutes % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// An internal step before times are assigned. `flex` marks the TMoD theme/
// filler segment, whose duration is computed last to land the meeting at 1 PM.
interface Step {
  section: AgendaSectionKey;
  lead: string;
  callee?: string | null;
  detail?: string | null;
  allotment?: string | null;
  indent?: boolean;
  duration: number;
  flex?: boolean;
}

export function buildAgenda(
  meeting: MeetingWithClaims,
  membersById: Map<string, Member>
): Agenda {
  const findClaim = (roleKey: RoleKey, slot = 1): RoleClaim | null =>
    meeting.role_claims.find((c) => c.role_key === roleKey && c.slot_index === slot) ?? null;

  // Member name for a role/slot, or null when the slot is empty.
  const nameOf = (roleKey: RoleKey, slot = 1): string | null => {
    const c = findClaim(roleKey, slot);
    if (!c) return null;
    const m = c.member ?? membersById.get(c.member_id);
    return m ? `TM ${m.display_name}` : null;
  };

  // Caller prefix: short role label, with the member's name appended when known.
  // e.g. "TMoD TM Rishabh", or just "TMoD" when unassigned.
  const caller = (roleKey: RoleKey, label: string): string => {
    const n = nameOf(roleKey);
    return n ? `${label} ${n}` : label;
  };

  const steps: Step[] = [];
  const step = (section: AgendaSectionKey, lead: string, duration: number, extra: Partial<Step> = {}) =>
    steps.push({ section, lead, duration, ...extra });

  // The TMoD weaves the theme through all three sections — opening it, building
  // on it between segments, and concluding it at the end (the conclusion flexes
  // to land the meeting at 1:00 PM).
  // ── ① Prepared Speeches ────────────────────────────────────────────────────
  // SAA and Chair are standing club officers, not per-meeting sign-up roles.
  step('prepared', 'Sergeant-at-Arms calls the meeting to order', 5);
  step('prepared', 'Sergeant-at-Arms calls the Chair (President) for opening remarks', 5);
  step('prepared', 'Chair calls the Toastmaster of the Day', 1, { callee: nameOf('tmod') });
  step('prepared', `${caller('tmod', 'TMoD')} opens & introduces the theme`, 3, {
    detail: 'Theme introduction',
  });
  step('prepared', 'TMoD calls the General Evaluator', 1, { callee: nameOf('ge') });
  step('prepared', `${caller('ge', 'GE')} calls the role players one by one:`, 0);
  for (const { key, label } of TAGH) {
    step('prepared', `${label} comes up & explains the role`, 3, {
      callee: nameOf(key),
      detail: key === 'grammarian' ? 'Introduces the Word of the Day & Idiom of the Day' : null,
      allotment: '2–3 min',
      indent: true,
    });
  }
  step('prepared', 'General Evaluator hands the meeting back to the Toastmaster of the Day', 1);
  step('prepared', 'TMoD builds on the theme, then introduces the prepared speeches', 3);

  for (let i = 1; i <= meeting.speaker_slots; i++) {
    const speakerClaim = findClaim('speaker', i);
    step('prepared', `TMoD calls Evaluator ${i}`, 1, {
      callee: nameOf('evaluator', i),
      detail: 'Shares the speaker’s project & evaluation criteria',
      allotment: '1 min',
    });
    const t = speakerClaim ? speechTime(speakerClaim) : defaultSpeechTime(null);
    step('prepared', `TMoD calls Speaker ${i}`, t.max, {
      callee: nameOf('speaker', i),
      detail: speechDetail(speakerClaim),
      allotment: `${t.min}–${t.max} min`,
    });
  }

  // ── ② Table Topics ─────────────────────────────────────────────────────────
  if (meeting.meeting_type !== 'speakathon') {
    step('table_topics', 'TMoD carries the theme forward, then calls the Table Topics Master', 2,
      { callee: nameOf('ttm') });
    step('table_topics', 'Table Topics Master conducts the session', 18, {
      detail: 'Impromptu speaking for guests & members',
      allotment: '6–8 speakers · 1–2½ min each',
    });
    step('table_topics', 'Table Topics Master hands back to the Toastmaster of the Day', 1);
    step('table_topics', 'TMoD speaks more on the theme', 2);
  }

  // ── ③ Evaluations ──────────────────────────────────────────────────────────
  step('evaluations', 'TMoD calls the General Evaluator', 1, { callee: nameOf('ge') });
  step('evaluations', 'General Evaluator calls the evaluators one by one:', 0);
  for (let i = 1; i <= meeting.evaluator_slots; i++) {
    step('evaluations', `Evaluator ${i} delivers the evaluation`, 3, {
      callee: nameOf('evaluator', i),
      allotment: '2–3 min',
      indent: true,
    });
  }
  step('evaluations', 'General Evaluator calls the role players’ reports:', 0);
  for (const { key, label } of TAGH) {
    step('evaluations', `${label}’s report`, 2, { callee: nameOf(key), allotment: '1–2 min', indent: true });
  }
  step('evaluations', 'General Evaluator gives the general evaluation, then hands back to the TMoD', 3);
  step('evaluations', `${caller('tmod', 'TMoD')} brings the theme to a conclusion`, 2, { flex: true });
  step('evaluations', 'TMoD hands the meeting back to the Chair', 1);
  step('evaluations', 'Chair invites the guests to introduce themselves', 3, {
    detail: 'Guests share their experience of the meeting',
  });
  step('evaluations', 'Members get 2 minutes to submit their votes', 2, {
    detail: 'Cast votes in the app before the ballot closes',
  });
  step('evaluations', 'Chair shares awards, announcements & closing remarks', CLOSING_MINUTES);

  // Size the flexible TMoD theme conclusion so the meeting lands at 1:00 PM,
  // which puts the Chair's 5-minute closing at 12:55 PM (bounded).
  const fixedTotal = steps.reduce((sum, s) => sum + (s.flex ? 0 : s.duration), 0);
  const flexStep = steps.find((s) => s.flex);
  if (flexStep) {
    const target = AGENDA_END_MIN - AGENDA_START_MIN - fixedTotal;
    flexStep.duration = Math.min(FILLER_MAX_MINUTES, Math.max(FILLER_MIN_MINUTES, target));
    flexStep.allotment = `~${flexStep.duration} min`;
  }

  // Assign running-clock times in order.
  let cursor = AGENDA_START_MIN;
  const toRow = (s: Step): AgendaRow => {
    const row: AgendaRow = {
      time: fmtClock(cursor),
      lead: s.lead,
      callee: s.callee,
      detail: s.detail ?? null,
      allotment: s.allotment ?? null,
      indent: s.indent ?? false,
    };
    cursor += s.duration;
    return row;
  };
  const rows = steps.map(toRow);

  const allSections: AgendaSection[] = [
    { key: 'prepared', title: 'Prepared Speeches', rows: rows.filter((_, i) => steps[i].section === 'prepared') },
    { key: 'table_topics', title: 'Table Topics', rows: rows.filter((_, i) => steps[i].section === 'table_topics') },
    { key: 'evaluations', title: 'Evaluations', rows: rows.filter((_, i) => steps[i].section === 'evaluations') },
  ];
  const sections = allSections.filter((s) => s.rows.length > 0);

  return {
    sections,
    startsAt: fmtClock(AGENDA_START_MIN),
    endsAt: fmtClock(cursor),
  };
}

function speechDetail(claim: RoleClaim | null): string | null {
  if (!claim) return null;
  const meta = [
    claim.path,
    claim.speech_level ? `L${claim.speech_level}` : null,
    claim.project,
  ].filter(Boolean);
  const title = claim.speech_title ? `“${claim.speech_title}”` : null;
  return [title, meta.join(' · ') || null].filter(Boolean).join(' — ') || null;
}

// Re-exported so the modal can render the fill-in placeholder consistently.
export { BLANK as ROLE_BLANK };
