/**
 * One-time import: reads Dehradun_WIC_India_TM_Club.xlsx and seeds Supabase.
 * Run from the project root:
 *   npx tsx scripts/import-from-excel.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS).
 */

import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// Load env vars from .env.local manually (tsx doesn't auto-load them)
import { readFileSync as rf } from 'fs';
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const lines = rf(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      process.env[key] = val;
    }
  } catch {
    console.error('Could not load .env.local');
    process.exit(1);
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'your-service-role-key-here') {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local before running the import.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(\w)\b/g, (c) => c.toUpperCase());
}

/** Derive a short display name from a full name.
 *  "B P Kothiyal" → "Kothiyal", "SAGAR KUSHWAH" → "Sagar", "Ruchika R. Adhikari" → "Ruchika"
 */
function inferDisplayName(fullName: string): string {
  const normalized = toTitleCase(fullName.toLowerCase());
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return normalized;
  // If first word is a single letter or initial (like "B" or "B."), use last word instead
  const first = words[0].replace(/\.$/, '');
  if (first.length <= 2) return words[words.length - 1];
  return first;
}

/** Normalize a name from the Roster to canonical Members List name */
const NAME_ALIASES: Record<string, string> = {
  Anuj: 'Anuj Anuj',
  Ayush: 'Ayush Thapliyal',
  Deepika: 'Deepika Tiwari',
};

function normalizeName(raw: string): string {
  const trimmed = raw.trim();
  return NAME_ALIASES[trimmed] ?? trimmed;
}

// ─── Meeting date inference ───────────────────────────────────────────────────
// Meeting 530 = 2026-03-01 (confirmed in Excel), weekly Sundays thereafter.
const BASE_MEETING = 530;
const BASE_DATE = new Date(Date.UTC(2026, 2, 1)); // 2026-03-01

function meetingDate(number: number): string {
  const weeksOffset = number - BASE_MEETING;
  const d = new Date(BASE_DATE);
  d.setUTCDate(d.getUTCDate() + weeksOffset * 7);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Theme and type overrides ─────────────────────────────────────────────────
const MEETING_THEMES: Record<number, string> = {
  530: 'Instability',
  531: 'My Toastmasters Journey',
  535: 'Toastmasters.org - Your Learning Companion',
  536: 'The Speaker',
  537: 'Speakathon',
  538: 'The Personality Blueprint',
  539: 'Mental Wellness',
};

const SPEAKATHON_MEETINGS = new Set([537]);

// ─── Role key mapping from Roster row labels ──────────────────────────────────
const ROLE_ROW_MAP: Record<string, { key: string; slot: number } | null> = {
  'SAA': null,                         // not tracked in Phase 1
  'PRESIDING OFFICER': null,           // not tracked
  'TMoD': { key: 'tmod', slot: 1 },
  'Featured Speaker 1 ': { key: 'speaker', slot: 1 },
  'Featured Speaker 1': { key: 'speaker', slot: 1 },
  'Featured Speaker 2': { key: 'speaker', slot: 2 },
  'Featured Speaker 3': { key: 'speaker', slot: 3 },
  'Featured Speaker 4': { key: 'speaker', slot: 4 },
  'EVALUATOR 1': { key: 'evaluator', slot: 1 },
  'EVALUATOR 2': { key: 'evaluator', slot: 2 },
  'EVALUATOR  3': { key: 'evaluator', slot: 3 },
  'EVALUATOR  4': { key: 'evaluator', slot: 4 },
  'TABLE TOPICS MASTER': { key: 'ttm', slot: 1 },
  'GENERAL EVALUATOR': { key: 'ge', slot: 1 },
  'GRAMMARIAN': { key: 'grammarian', slot: 1 },
  'AH COUNTER': { key: 'ah_counter', slot: 1 },
  'TIMER': { key: 'timer', slot: 1 },
  'Harkmaster': { key: 'harkmaster', slot: 1 },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const xlsxPath = resolve(process.cwd(), '..', 'Dehradun_WIC_India_TM_Club.xlsx');
  console.log(`Reading: ${xlsxPath}`);

  const workbook = XLSX.readFile(xlsxPath);

  // ── 1. Members ────────────────────────────────────────────────────────────
  console.log('\n=== Importing Members ===');
  const membersSheet = workbook.Sheets['Members List'];
  const membersRaw: unknown[][] = XLSX.utils.sheet_to_json(membersSheet, { header: 1 });

  const memberInserts: {
    membership_no: string;
    name: string;
    display_name: string;
    active: boolean;
  }[] = [];

  for (const row of membersRaw.slice(1)) {
    const r = row as (string | number | undefined)[];
    const membershipNo = String(r[1] ?? '').trim();
    const name = String(r[2] ?? '').trim();
    if (!membershipNo || !name) continue;

    memberInserts.push({
      membership_no: membershipNo,
      name,
      display_name: inferDisplayName(name),
      active: true,
    });
  }

  console.log(`  Inserting ${memberInserts.length} members...`);
  const { error: membersErr } = await supabase
    .from('members')
    .upsert(memberInserts, { onConflict: 'membership_no' });

  if (membersErr) {
    console.error('  Members error:', membersErr);
    process.exit(1);
  }
  console.log('  ✓ Members done');

  // Build name→id lookup
  const { data: allMembers, error: fetchErr } = await supabase
    .from('members')
    .select('id, name');
  if (fetchErr || !allMembers) {
    console.error('Could not fetch members:', fetchErr);
    process.exit(1);
  }
  const nameToId = new Map<string, string>(allMembers.map((m) => [m.name, m.id]));

  // ── 2. Meetings ───────────────────────────────────────────────────────────
  console.log('\n=== Importing Meetings (530–539) ===');
  const meetingInserts = [];
  for (let n = 530; n <= 539; n++) {
    const isSpeakathon = SPEAKATHON_MEETINGS.has(n);
    meetingInserts.push({
      number: n,
      date: meetingDate(n),
      start_time: '10:45:00',
      end_time: '13:00:00',
      theme: MEETING_THEMES[n] ?? null,
      meeting_type: isSpeakathon ? 'speakathon' : 'regular',
      speaker_slots: isSpeakathon ? 4 : 2,
      evaluator_slots: isSpeakathon ? 4 : 2,
    });
  }

  const { error: meetingsErr } = await supabase
    .from('meetings')
    .upsert(meetingInserts, { onConflict: 'number' });

  if (meetingsErr) {
    console.error('  Meetings error:', meetingsErr);
    process.exit(1);
  }
  console.log('  ✓ Meetings done');

  // Build meeting number→id lookup
  const { data: allMeetings, error: mFetchErr } = await supabase
    .from('meetings')
    .select('id, number');
  if (mFetchErr || !allMeetings) {
    console.error('Could not fetch meetings:', mFetchErr);
    process.exit(1);
  }
  const numberToId = new Map<number, string>(allMeetings.map((m) => [m.number, m.id]));

  // ── 3. Role claims from Roster ────────────────────────────────────────────
  console.log('\n=== Importing Historical Role Claims ===');
  const rosterSheet = workbook.Sheets['Roster'];
  const rosterRaw: unknown[][] = XLSX.utils.sheet_to_json(rosterSheet, { header: 1 });

  // Row 4 (index 3) = meeting numbers, cols 1–10
  const meetingNumbers: number[] = [];
  const meetingRow = rosterRaw[3] as (number | undefined)[];
  for (let c = 1; c < meetingRow.length; c++) {
    if (typeof meetingRow[c] === 'number') {
      meetingNumbers[c] = meetingRow[c] as number;
    }
  }

  const claimInserts: {
    meeting_id: string;
    role_key: string;
    slot_index: number;
    member_id: string;
    admin_override: boolean;
  }[] = [];

  const skipped: string[] = [];

  for (const row of rosterRaw.slice(4)) {
    const r = row as (string | undefined)[];
    const rowLabel = String(r[0] ?? '').trim();
    if (!rowLabel || rowLabel === 'Meeting notes ') continue;

    const roleMap = ROLE_ROW_MAP[rowLabel];
    if (roleMap === undefined) {
      // Unknown label — skip silently
      continue;
    }
    if (roleMap === null) continue; // explicitly skipped (SAA, PRESIDING OFFICER)

    for (let c = 1; c < r.length; c++) {
      const meetingNum = meetingNumbers[c];
      if (!meetingNum) continue;

      const rawName = String(r[c] ?? '').trim();
      if (!rawName) continue;

      const canonName = normalizeName(rawName);
      const memberId = nameToId.get(canonName);
      if (!memberId) {
        skipped.push(`${rowLabel} | Meeting ${meetingNum} | "${rawName}" (canonical: "${canonName}") — member not found`);
        continue;
      }

      const meetingId = numberToId.get(meetingNum);
      if (!meetingId) continue;

      claimInserts.push({
        meeting_id: meetingId,
        role_key: roleMap.key,
        slot_index: roleMap.slot,
        member_id: memberId,
        // true = historical data; bypasses the one-role-per-member constraint
        // (Speakathon meetings had members in two roles, e.g. TMoD + speaker)
        admin_override: true,
      });
    }
  }

  console.log(`  Inserting ${claimInserts.length} role claims...`);

  let inserted = 0;
  let failed = 0;
  const BATCH = 50;

  for (let i = 0; i < claimInserts.length; i += BATCH) {
    const batch = claimInserts.slice(i, i + BATCH);
    const { error } = await supabase
      .from('role_claims')
      .upsert(batch, { onConflict: 'meeting_id,role_key,slot_index' });

    if (!error) {
      inserted += batch.length;
      continue;
    }

    // Batch failed — retry row-by-row so one conflict doesn't drop the whole batch
    for (const row of batch) {
      const { error: rowErr } = await supabase
        .from('role_claims')
        .upsert([row], { onConflict: 'meeting_id,role_key,slot_index' });
      if (rowErr) {
        failed++;
        console.warn(`  Skipped: meeting ${row.meeting_id} role ${row.role_key}:${row.slot_index} — ${rowErr.message}`);
      } else {
        inserted++;
      }
    }
  }

  if (failed > 0) console.warn(`  ⚠ ${failed} claims could not be inserted (see above)`);
  console.log(`  ✓ ${inserted} role claims inserted`);

  if (skipped.length) {
    console.warn('\n  Skipped (member not matched):');
    for (const s of skipped) console.warn(`    - ${s}`);
    console.warn('\n  Fix these by editing display_name in Supabase or adjusting NAME_ALIASES in this script.');
  }

  console.log('\n✅ Import complete!');
  console.log(`   Members: ${memberInserts.length}`);
  console.log(`   Meetings: ${meetingInserts.length}`);
  console.log(`   Role claims: ${claimInserts.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
