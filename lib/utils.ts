import type { Meeting, MeetingWithClaims, Member, RoleKey } from './types';

const VALID_PAIRS = new Set([
  'speaker:evaluator',
  'evaluator:speaker',
  'evaluator:ge',
  'ge:evaluator',
]);

export function roleClaimBlocked(
  targetRole: RoleKey,
  existingRoles: RoleKey[]
): string | null {
  if (existingRoles.length === 0) return null;
  if (existingRoles.includes('tmod')) return 'TMoD cannot take another role';
  if (targetRole === 'tmod') return 'TMoD cannot be combined with other roles';
  for (const existing of existingRoles) {
    if (!VALID_PAIRS.has(`${existing}:${targetRole}`)) return 'This pair is not allowed';
  }
  return null;
}

// IST = UTC+5:30. Meeting deadline is start_time IST on meeting date.
// start_time stored as "HH:MM:SS".
export function getMeetingDeadlineUTC(meeting: Meeting): Date {
  const [h, m] = meeting.start_time.split(':').map(Number);
  const istOffsetMin = 5 * 60 + 30;
  // Convert HH:MM IST to UTC minutes
  const utcMinutes = h * 60 + m - istOffsetMin;
  const utcH = Math.floor(((utcMinutes % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const utcM = ((utcMinutes % 60) + 60) % 60;
  const utcDay = utcMinutes < 0 ? -1 : 0; // previous UTC day if IST crosses midnight

  const [year, month, day] = meeting.date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + utcDay, utcH, utcM, 0));
}

export function isMeetingLocked(meeting: Meeting): boolean {
  return Date.now() >= getMeetingDeadlineUTC(meeting).getTime();
}

// Meeting is "past" if its date in IST is before today in IST
export function isMeetingPast(meeting: Meeting): boolean {
  const now = new Date();
  // Get current date in IST
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const [y, m, d] = meeting.date.split('-').map(Number);
  const meetingDate = new Date(y, m - 1, d);
  const todayIST = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
  return meetingDate < todayIST;
}

// Format as ordinal: 3 → "3rd", 21 → "21st"
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Format "2026-05-03" → "Sunday, 3rd May"
export function formatMeetingDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  // Use UTC to avoid timezone shifts on the date itself
  const date = new Date(Date.UTC(y, mo - 1, d));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const month = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${weekday}, ${ordinal(d)} ${month}`;
}

// Format "13:00:00" → "1:00 PM", "10:45:00" → "10:45 AM"
export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Build the WhatsApp agenda text from a meeting + members index
export function buildWhatsAppAgenda(
  meeting: MeetingWithClaims,
  membersById: Map<string, Member>
): string {
  const getClaimName = (roleKey: RoleKey, slot: number): string => {
    const claim = meeting.role_claims.find(
      (c) => c.role_key === roleKey && c.slot_index === slot
    );
    if (!claim) return '';
    const m = membersById.get(claim.member_id);
    return m ? `TM ${m.display_name}` : '';
  };

  const lines: string[] = [];

  lines.push('Please come forward to take the roles in the next meeting:');
  lines.push(`WIC INDIA TOASTMASTERS Meeting #${meeting.number}`);
  lines.push('Speak, Lead, Inspire');
  lines.push(
    `🗓️ ${formatMeetingDate(meeting.date)}, ${formatTime(meeting.start_time)}- ${formatTime(meeting.end_time)} IST`
  );
  if (meeting.theme) lines.push(`🌐 Theme: ${meeting.theme}`);
  lines.push('');

  // Prepared Speakers
  lines.push('🎙️ Prepared Speakers:');
  for (let i = 1; i <= meeting.speaker_slots; i++) {
    const name = getClaimName('speaker', i);
    lines.push(` ${i}. ${name}`);
  }
  lines.push('');

  // Evaluators
  lines.push('⚖️Evaluators:');
  for (let i = 1; i <= meeting.evaluator_slots; i++) {
    const name = getClaimName('evaluator', i);
    lines.push(` ${i}. ${name}`);
  }
  lines.push('');
  lines.push('');

  // Main Roles
  lines.push('Main Roles:');
  lines.push(`🎤 TMoD- ${getClaimName('tmod', 1)}`);
  if (meeting.meeting_type !== 'speakathon') {
    lines.push(`💬 TTM- ${getClaimName('ttm', 1)}`);
  }
  lines.push(`📋 GE- ${getClaimName('ge', 1)}`);

  // Tag Roles
  lines.push('Tag Roles:');
  lines.push(`📚 Grammarian- ${getClaimName('grammarian', 1)}`);
  lines.push(`🔍 Ah-Counter- ${getClaimName('ah_counter', 1)}`);
  lines.push(`⌛️ Timer- ${getClaimName('timer', 1)}`);
  lines.push(`👂 Harkmaster- ${getClaimName('harkmaster', 1)}`);

  return lines.join('\n');
}
