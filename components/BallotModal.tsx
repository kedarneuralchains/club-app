'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Ballot, MeetingWithClaims, Member } from '@/lib/types';

interface Props {
  ballot: Ballot;
  meeting: MeetingWithClaims;
  allMembers: Member[];
  memberId: string;
  deviceId: string;
  onClose: () => void;
}

type VoteCategory = 'speaker' | 'evaluator' | 'table_topics';

interface Candidate { id: string; name: string }

export function BallotModal({ ballot, meeting, allMembers, memberId, deviceId, onClose }: Props) {
  const supabase = createClient();

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);

  const [checking, setChecking] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  const [selections, setSelections] = useState<Record<VoteCategory, string>>({
    speaker: '', evaluator: '', table_topics: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [voteCount, setVoteCount] = useState<number | null>(null);

  const fetchVoteCount = useCallback(async () => {
    const { data } = await supabase.rpc('get_vote_count', { p_ballot_id: ballot.id });
    setVoteCount(data ?? 0);
  }, [ballot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once code is verified, check if this device already voted
  useEffect(() => {
    if (!codeVerified) return;
    setChecking(true);
    supabase
      .rpc('has_device_voted', { p_ballot_id: ballot.id, p_device_uuid: deviceId })
      .then(({ data }) => {
        setAlreadyVoted(!!data);
        setChecking(false);
      });
  }, [codeVerified]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll vote count once submitted / already voted
  useEffect(() => {
    if (!submitted && !alreadyVoted) return;
    fetchVoteCount();
    const id = setInterval(fetchVoteCount, 10_000);
    return () => clearInterval(id);
  }, [submitted, alreadyVoted, fetchVoteCount]);

  function verifyCode() {
    if (code.trim() === ballot.meeting_code) {
      setCodeVerified(true);
      setCodeError('');
    } else {
      setCodeError('Wrong code. Ask the admin for today\'s 4-digit code.');
    }
  }

  // Build candidate lists
  const speakerCandidates: Candidate[] = meeting.role_claims
    .filter(c => c.role_key === 'speaker' && c.member_id !== memberId)
    .map(c => ({ id: c.member_id, name: c.member?.display_name ?? c.member?.name ?? 'Unknown' }));

  const evaluatorCandidates: Candidate[] = meeting.role_claims
    .filter(c => c.role_key === 'evaluator' && c.member_id !== memberId)
    .map(c => ({ id: c.member_id, name: c.member?.display_name ?? c.member?.name ?? 'Unknown' }));

  const isRegular = meeting.meeting_type === 'regular';
  const ttCandidates: Candidate[] = isRegular
    ? allMembers.filter(m => m.id !== memberId).map(m => ({ id: m.id, name: m.display_name }))
    : [];

  type CategoryDef = { key: VoteCategory; label: string; emoji: string; candidates: Candidate[] };
  const categories: CategoryDef[] = [
    { key: 'speaker',      label: 'Best Speaker',      emoji: '🎙️', candidates: speakerCandidates },
    { key: 'evaluator',    label: 'Best Evaluator',    emoji: '⚖️', candidates: evaluatorCandidates },
    ...(isRegular ? [{ key: 'table_topics' as VoteCategory, label: 'Best Table Topics', emoji: '💬', candidates: ttCandidates }] : []),
  ];

  const allSelected = categories.every(c => selections[c.key] !== '');

  async function handleSubmit() {
    if (!allSelected || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    const rows = categories.map(c => ({
      ballot_id: ballot.id,
      device_uuid: deviceId,
      voter_member_id: memberId,
      category: c.key,
      voted_for_member_id: selections[c.key],
    }));

    const { error } = await supabase.from('votes').insert(rows);
    if (error) {
      if (error.code === '23505') {
        // Unique constraint — this device already voted
        setAlreadyVoted(true);
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } else {
      setSubmitted(true);
    }
    setSubmitting(false);
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
            <p className="text-xs text-white/60 mt-0.5">One vote per device per category</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl tap-target px-2">✕</button>
        </div>

        <div className="p-5 overflow-y-auto">

          {/* ── Code gate ── */}
          {!codeVerified && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600">
                Enter the 4-digit code displayed by the admin to unlock the ballot.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && verifyCode()}
                  placeholder="0000"
                  className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-2xl tracking-[0.4em] text-center font-bold focus:outline-none focus:border-maroon-400"
                  autoFocus
                />
                <button
                  onClick={verifyCode}
                  className="bg-maroon-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-maroon-800 transition-colors"
                >
                  Enter
                </button>
              </div>
              {codeError && <p className="text-sm text-red-500">{codeError}</p>}
            </div>
          )}

          {/* ── Checking ── */}
          {codeVerified && checking && (
            <div className="py-10 text-center text-stone-400 text-sm">Checking…</div>
          )}

          {/* ── Already voted ── */}
          {codeVerified && !checking && alreadyVoted && !submitted && (
            <div className="text-center py-8 space-y-3">
              <div className="text-5xl">✓</div>
              <p className="text-base font-semibold text-stone-800">Your vote is already recorded</p>
              <p className="text-sm text-stone-400">Results will be revealed when the admin closes voting.</p>
              {voteCount !== null && (
                <p className="text-sm font-medium text-stone-500">{voteCount} {voteCount === 1 ? 'vote' : 'votes'} submitted so far</p>
              )}
            </div>
          )}

          {/* ── Ballot form ── */}
          {codeVerified && !checking && !alreadyVoted && !submitted && (
            <div className="space-y-6">
              {categories.map(cat => (
                <div key={cat.key}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
                    {cat.emoji} {cat.label}
                  </p>
                  {cat.candidates.length === 0 ? (
                    <p className="text-sm text-stone-300 italic">No candidates in this category</p>
                  ) : (
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
                          TM {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

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
                <p className="text-xs text-stone-400 text-center -mt-3">
                  Select one name in each category to enable submit
                </p>
              )}
            </div>
          )}

          {/* ── Submitted ── */}
          {submitted && (
            <div className="text-center py-8 space-y-3">
              <div className="text-5xl">✓</div>
              <p className="text-base font-semibold text-stone-800">Vote submitted!</p>
              <p className="text-sm text-stone-400">Results will be revealed when the admin closes voting.</p>
              {voteCount !== null && (
                <p className="text-sm font-medium text-stone-500">{voteCount} {voteCount === 1 ? 'vote' : 'votes'} submitted so far</p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
