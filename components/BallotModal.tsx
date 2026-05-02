'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Ballot, MeetingWithClaims, Member } from '@/lib/types';
import { ROLE_META } from '@/lib/types';
import type { RoleKey } from '@/lib/types';

interface Props {
  ballot: Ballot;
  meeting: MeetingWithClaims;
  allMembers: Member[];
  memberId: string;
  deviceId: string;
  onClose: () => void;
}

interface Candidate {
  id: string;       // member UUID or "guest-{id}" for TT guests
  label: string;    // what to display on the button
  memberId: string | null;   // null for guests
  guestName: string | null;  // set for guests
}

type VoteCategory = 'speaker' | 'evaluator' | 'table_topics' | 'role_player' | 'aux_role';

const CAT_META: Record<VoteCategory, { label: string; emoji: string }> = {
  speaker:      { label: 'Best Speaker',               emoji: '🎙️' },
  evaluator:    { label: 'Best Evaluator',              emoji: '⚖️' },
  table_topics: { label: 'Best Table Topics Speaker',   emoji: '💬' },
  role_player:  { label: 'Best Role Player',            emoji: '🎤' },
  aux_role:     { label: 'Best Auxiliary Role Player',  emoji: '⏱️' },
};

const ROLE_PLAYER_KEYS: RoleKey[] = ['tmod', 'ge', 'ttm'];
const AUX_ROLE_KEYS:    RoleKey[] = ['timer', 'grammarian', 'ah_counter', 'harkmaster'];

export function BallotModal({ ballot, meeting, allMembers, memberId, deviceId, onClose }: Props) {
  const supabase = createClient();

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [voteCount, setVoteCount] = useState<number | null>(null);

  const fetchVoteCount = useCallback(async () => {
    const { data } = await supabase.rpc('get_vote_count', { p_ballot_id: ballot.id });
    setVoteCount(data ?? 0);
  }, [ballot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!submitted && !alreadyVoted) return;
    fetchVoteCount();
    const id = setInterval(fetchVoteCount, 10_000);
    return () => clearInterval(id);
  }, [submitted, alreadyVoted, fetchVoteCount]);

  // Build candidate lists
  const speakerCandidates: Candidate[] = meeting.role_claims
    .filter(c => c.role_key === 'speaker')
    .map(c => ({ id: c.member_id, label: `TM ${c.member?.display_name ?? '?'}`, memberId: c.member_id, guestName: null }));

  const evaluatorCandidates: Candidate[] = meeting.role_claims
    .filter(c => c.role_key === 'evaluator')
    .map(c => ({ id: c.member_id, label: `TM ${c.member?.display_name ?? '?'}`, memberId: c.member_id, guestName: null }));

  const ttCandidates: Candidate[] = ballot.table_topics_speakers.map(s => ({
    id: s.id,
    label: s.is_guest ? `${s.name} (Guest)` : `TM ${s.name}`,
    memberId: s.is_guest ? null : s.id,
    guestName: s.is_guest ? s.name : null,
  }));

  const roleCandidates: Candidate[] = ROLE_PLAYER_KEYS.flatMap(roleKey =>
    meeting.role_claims
      .filter(c => c.role_key === roleKey)
      .map(c => ({
        id: c.member_id + ':' + roleKey,
        label: `TM ${c.member?.display_name ?? '?'} · ${ROLE_META[roleKey].label}`,
        memberId: c.member_id,
        guestName: null,
      }))
  );

  const auxCandidates: Candidate[] = AUX_ROLE_KEYS.flatMap(roleKey =>
    meeting.role_claims
      .filter(c => c.role_key === roleKey)
      .map(c => ({
        id: c.member_id + ':' + roleKey,
        label: `TM ${c.member?.display_name ?? '?'} · ${ROLE_META[roleKey].label}`,
        memberId: c.member_id,
        guestName: null,
      }))
  );

  const categories: { key: VoteCategory; candidates: Candidate[] }[] = (
    [
      { key: 'speaker'      as VoteCategory, candidates: speakerCandidates },
      { key: 'evaluator'    as VoteCategory, candidates: evaluatorCandidates },
      { key: 'table_topics' as VoteCategory, candidates: ttCandidates },
      { key: 'role_player'  as VoteCategory, candidates: roleCandidates },
      { key: 'aux_role'     as VoteCategory, candidates: auxCandidates },
    ] as { key: VoteCategory; candidates: Candidate[] }[]
  ).filter(c => c.candidates.length > 0);

  const allSelected = categories.every(c => !!selections[c.key]);

  async function handleSubmit() {
    if (!allSelected || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    const rows = categories.map(c => {
      const candidate = c.candidates.find(cand => cand.id === selections[c.key])!;
      return {
        ballot_id: ballot.id,
        device_uuid: deviceId,
        voter_member_id: memberId === 'guest' ? null : memberId,
        category: c.key,
        voted_for_member_id: candidate.memberId ?? null,
        voted_for_name: candidate.guestName ?? null,
      };
    });

    const { error } = await supabase.from('votes').insert(rows);
    if (error) {
      if (error.code === '23505') {
        setAlreadyVoted(true);
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } else {
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  function voteCountLabel(count: number) {
    return ballot.voter_count
      ? `${count} / ${ballot.voter_count} votes`
      : `${count} ${count === 1 ? 'vote' : 'votes'} submitted`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-maroon-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-white text-lg">Meeting #{meeting.number} — Ballot</h2>
            <p className="text-xs text-white/60 mt-0.5">Select one in each category, then submit</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl tap-target px-2">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">

          {/* ── Already voted (from DB constraint) ── */}
          {alreadyVoted && (
            <div className="text-center py-6 space-y-2">
              <div className="text-4xl">✓</div>
              <p className="font-semibold text-stone-800">Your vote is already recorded</p>
              <p className="text-sm text-stone-400">Results revealed when voting closes.</p>
              {voteCount !== null && (
                <p className="text-sm font-medium text-stone-500">{voteCountLabel(voteCount)}</p>
              )}
            </div>
          )}

          {/* ── Submitted ── */}
          {submitted && !alreadyVoted && (
            <div className="text-center py-6 space-y-2">
              <div className="text-4xl">✓</div>
              <p className="font-semibold text-stone-800">Vote submitted!</p>
              <p className="text-sm text-stone-400">Results revealed when voting closes.</p>
              {voteCount !== null && (
                <p className="text-sm font-medium text-stone-500">{voteCountLabel(voteCount)}</p>
              )}
            </div>
          )}

          {/* ── Ballot form ── */}
          {!submitted && !alreadyVoted && (
            <>
              {categories.map(cat => {
                const meta = CAT_META[cat.key];
                return (
                  <div key={cat.key}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
                      {meta.emoji} {meta.label}
                    </p>
                    <div className="space-y-1.5">
                      {cat.candidates.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelections(s => ({ ...s, [cat.key]: c.id }))}
                          className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border
                            ${selections[cat.key] === c.id
                              ? 'bg-maroon-700 text-white border-maroon-700'
                              : 'bg-stone-50 text-stone-700 border-stone-100 hover:border-maroon-300 hover:bg-maroon-50'
                            }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {submitError && <p className="text-sm text-red-500">{submitError}</p>}

              <button
                onClick={handleSubmit}
                disabled={!allSelected || submitting}
                className="w-full bg-maroon-700 text-white py-3.5 rounded-xl font-semibold text-base
                           disabled:opacity-40 disabled:cursor-not-allowed hover:bg-maroon-800 transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit Ballot'}
              </button>
              {!allSelected && (
                <p className="text-xs text-stone-400 text-center -mt-4">
                  Select one per category to enable submit
                </p>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
