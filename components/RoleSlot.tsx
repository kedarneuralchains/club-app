'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Member, RoleClaim, RoleKey } from '@/lib/types';
import { ROLE_META } from '@/lib/types';
import { roleClaimBlocked } from '@/lib/utils';

interface Props {
  meetingId: string;
  roleKey: RoleKey;
  slotIndex: number;
  claim: RoleClaim | null;
  memberId: string | null;
  memberExistingRoles: RoleKey[];
  isLocked: boolean;
  isPast: boolean;
  isAdmin: boolean;
  allMembers?: Member[];
  onChanged: () => void;
}

export function RoleSlot({
  meetingId, roleKey, slotIndex, claim, memberId, memberExistingRoles,
  isLocked, isPast, isAdmin, allMembers = [], onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const supabase = createClient();
  const meta = ROLE_META[roleKey];

  const isOwn = claim ? claim.member_id === memberId : false;
  const canRelease = claim && (isOwn || isAdmin) && (!isLocked || isAdmin);

  const isGuest = memberId === 'guest';
  const blockReason = (!claim && memberId && !isGuest && !isAdmin)
    ? roleClaimBlocked(roleKey, memberExistingRoles)
    : null;
  const canClaim = !claim && memberId && !isGuest && (!isLocked || isAdmin) && !blockReason;
  const isMultiRole = memberExistingRoles.length > 0;

  async function handleClaim() {
    if (!memberId || !canClaim || busy) return;
    setBusy(true);
    await supabase.from('role_claims').insert({
      meeting_id: meetingId,
      role_key: roleKey,
      slot_index: slotIndex,
      member_id: memberId,
      admin_override: isMultiRole,
    });
    setBusy(false);
    onChanged();
  }

  async function handleRelease() {
    if (!claim || !canRelease || busy) return;
    setBusy(true);
    await supabase.from('role_claims').delete().eq('id', claim.id);
    setBusy(false);
    onChanged();
  }

  async function handleAdminAssign(selectedId: string) {
    if (!selectedId || busy) return;
    setBusy(true);
    await supabase.from('role_claims').insert({
      meeting_id: meetingId,
      role_key: roleKey,
      slot_index: slotIndex,
      member_id: selectedId,
      admin_override: true,
    });
    setBusy(false);
    setAssigning(false);
    onChanged();
  }

  const claimantName = claim?.member?.display_name
    ? `TM ${claim.member.display_name}`
    : claim?.member?.name ?? '…';

  // ── Read-only (past or locked for non-admin) ─────────────────────────────
  if (isPast || (isLocked && !isAdmin)) {
    return (
      <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-stone-50">
        <span className="text-base shrink-0">{meta.emoji}</span>
        <span className="text-sm text-stone-500 font-medium shrink-0">{meta.label}</span>
        <span className="text-sm text-stone-800 ml-auto truncate max-w-[160px]">
          {claim ? claimantName : <span className="text-stone-300">—</span>}
        </span>
      </div>
    );
  }

  // ── Slot filled ───────────────────────────────────────────────────────────
  if (claim) {
    return (
      <div className={`flex items-center gap-2 py-2.5 px-3 rounded-xl transition-colors
        ${isOwn ? 'bg-maroon-50 border border-maroon-200' : 'bg-stone-50'}`}
      >
        <span className="text-base shrink-0">{meta.emoji}</span>
        <span className="text-sm text-stone-500 font-medium shrink-0">{meta.label}</span>
        <span className={`text-sm font-semibold ml-auto truncate max-w-[140px] ${isOwn ? 'text-maroon-700' : 'text-stone-800'}`}>
          {claimantName}
          {isOwn && <span className="text-xs font-normal text-maroon-400 ml-1">(you)</span>}
        </span>
        {canRelease && (
          <button
            onClick={handleRelease}
            disabled={busy}
            className="shrink-0 ml-1 text-xs text-stone-400 hover:text-red-500 tap-target
                       px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            aria-label={`Release ${meta.label}`}
          >
            {busy ? '…' : '✕'}
          </button>
        )}
      </div>
    );
  }

  // ── Admin: assign member ──────────────────────────────────────────────────
  if (isAdmin) {
    if (assigning) {
      return (
        <div className="flex items-center gap-2 py-2 px-3 rounded-xl border border-maroon-200 bg-maroon-50">
          <span className="text-base shrink-0">{meta.emoji}</span>
          <span className="text-sm text-stone-500 font-medium shrink-0">{meta.label}</span>
          <select
            className="ml-auto flex-1 min-w-0 text-sm border border-stone-200 rounded-lg px-2 py-1.5
                       focus:outline-none focus:ring-1 focus:ring-maroon-400 bg-white text-stone-800"
            defaultValue=""
            onChange={(e) => e.target.value && handleAdminAssign(e.target.value)}
            disabled={busy}
            autoFocus
          >
            <option value="" disabled>Pick member…</option>
            {allMembers.map((m) => (
              <option key={m.id} value={m.id}>TM {m.display_name}</option>
            ))}
          </select>
          <button
            onClick={() => setAssigning(false)}
            className="shrink-0 text-xs text-stone-400 hover:text-stone-600 tap-target px-1"
          >✕</button>
        </div>
      );
    }
    return (
      <button
        onClick={() => setAssigning(true)}
        className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed
                   border-stone-200 hover:border-maroon-300 hover:bg-maroon-50
                   active:scale-[0.98] transition-all tap-target text-left group"
      >
        <span className="text-base shrink-0 opacity-40 group-hover:opacity-100">{meta.emoji}</span>
        <span className="text-sm text-stone-400 font-medium shrink-0 group-hover:text-maroon-700">{meta.label}</span>
        <span className="ml-auto text-xs text-maroon-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
          Assign
        </span>
      </button>
    );
  }

  // ── Blocked by role-pair rules ────────────────────────────────────────────
  if (blockReason) {
    return (
      <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-stone-100 opacity-50">
        <span className="text-base shrink-0">{meta.emoji}</span>
        <span className="text-sm text-stone-400 font-medium shrink-0">{meta.label}</span>
        <span className="ml-auto text-xs text-stone-300 italic">{blockReason}</span>
      </div>
    );
  }

  // ── Empty claimable slot ──────────────────────────────────────────────────
  return (
    <button
      onClick={handleClaim}
      disabled={busy || !memberId || isGuest}
      className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed
                 border-stone-200 hover:border-maroon-300 hover:bg-maroon-50
                 active:scale-[0.98] transition-all tap-target
                 disabled:opacity-40 disabled:cursor-not-allowed text-left group"
    >
      <span className="text-base shrink-0 opacity-50 group-hover:opacity-100">{meta.emoji}</span>
      <span className="text-sm text-stone-400 font-medium shrink-0 group-hover:text-maroon-700">{meta.label}</span>
      {memberId && !isGuest ? (
        <span className="ml-auto text-xs text-maroon-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
          {busy ? 'Claiming…' : 'Tap to claim'}
        </span>
      ) : (
        <span className="ml-auto text-xs text-stone-300">Sign in to claim</span>
      )}
    </button>
  );
}
