'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { RoleClaim, RoleKey } from '@/lib/types';
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
  onChanged: () => void;
}

export function RoleSlot({
  meetingId, roleKey, slotIndex, claim, memberId, memberExistingRoles,
  isLocked, isPast, isAdmin, onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const meta = ROLE_META[roleKey];

  const isOwn = claim ? claim.member_id === memberId : false;
  const canRelease = claim && (isOwn || isAdmin) && (!isLocked || isAdmin);

  const blockReason = (!claim && memberId && !isAdmin)
    ? roleClaimBlocked(roleKey, memberExistingRoles)
    : null;
  const canClaim = !claim && memberId && (!isLocked || isAdmin) && !blockReason;
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

  const claimantName = claim?.member?.display_name
    ? `TM ${claim.member.display_name}`
    : claim?.member?.name ?? '…';

  if (isPast || (isLocked && !isAdmin)) {
    // Read-only display
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

  // Empty slot — blocked by role-pair rules
  if (blockReason) {
    return (
      <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-stone-100 opacity-50">
        <span className="text-base shrink-0">{meta.emoji}</span>
        <span className="text-sm text-stone-400 font-medium shrink-0">{meta.label}</span>
        <span className="ml-auto text-xs text-stone-300 italic">{blockReason}</span>
      </div>
    );
  }

  // Empty claimable slot
  return (
    <button
      onClick={handleClaim}
      disabled={busy || !memberId}
      className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed
                 border-stone-200 hover:border-maroon-300 hover:bg-maroon-50
                 active:scale-[0.98] transition-all tap-target
                 disabled:opacity-40 disabled:cursor-not-allowed text-left group"
    >
      <span className="text-base shrink-0 opacity-50 group-hover:opacity-100">{meta.emoji}</span>
      <span className="text-sm text-stone-400 font-medium shrink-0 group-hover:text-maroon-700">{meta.label}</span>
      {memberId ? (
        <span className="ml-auto text-xs text-maroon-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
          {busy ? 'Claiming…' : 'Tap to claim'}
        </span>
      ) : (
        <span className="ml-auto text-xs text-stone-300">Pick your name first</span>
      )}
    </button>
  );
}
