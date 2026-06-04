'use client';
import type { Member, MeetingWithClaims, RoleKey } from '@/lib/types';
import { ROLE_META } from '@/lib/types';
import { getMemberRecentRoles, formatMeetingDate } from '@/lib/utils';

interface Props {
  member: Member;
  meetings: MeetingWithClaims[];
  onClose: () => void;
}

// Shown when a member's identity becomes active — gives them a snapshot of
// their recent roles and nudges them to keep rotating. Also states the
// no-repeat-in-consecutive-meetings rule (Evaluator exempt).
export function MemberAdviceModal({ member, meetings, onClose }: Props) {
  const recent = getMemberRecentRoles(meetings, member.id, 5);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5 sm:hidden" />

        <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">
          Hi TM {member.display_name} 👋
        </h2>
        <p className="text-stone-500 text-sm mb-4">Here&apos;s how your roles have been rotating.</p>

        {/* Recent roles */}
        {recent.length > 0 ? (
          <div className="space-y-2 mb-5">
            {recent.map(({ meeting, roles }) => (
              <div
                key={meeting.id}
                className="flex items-start gap-3 py-2 px-3 rounded-xl bg-stone-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-800">Meeting #{meeting.number}</p>
                  <p className="text-xs text-stone-400">{formatMeetingDate(meeting.date)}</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                  {roles.map((r: RoleKey, i: number) => (
                    <span
                      key={`${r}-${i}`}
                      className="text-xs font-medium text-maroon-700 bg-maroon-50
                                 border border-maroon-100 rounded-full px-2 py-0.5 whitespace-nowrap"
                    >
                      {ROLE_META[r].emoji} {ROLE_META[r].label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-5 py-4 px-3 rounded-xl bg-stone-50 text-center">
            <p className="text-sm text-stone-500">No roles on record yet.</p>
            <p className="text-xs text-stone-400 mt-0.5">Claim one below to get started!</p>
          </div>
        )}

        {/* Advice */}
        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 mb-3">
          <p className="text-sm text-stone-700 leading-relaxed">
            🔄 <strong>Keep rotating your roles.</strong> Taking a variety of roles helps you grow
            across every Toastmasters skill — speaking, evaluating, and the supporting roles.
          </p>
        </div>

        {/* Rule note */}
        <div className="rounded-xl bg-maroon-50 border border-maroon-100 p-3 mb-5">
          <p className="text-sm text-stone-700 leading-relaxed">
            ⚠️ You can&apos;t take the <strong>same role in two consecutive meetings</strong>.
            Roles you held in the meeting just before or after will be greyed out.
          </p>
          <p className="text-xs text-stone-500 mt-1.5">
            The one exception is <strong>Evaluator</strong> — feel free to evaluate back-to-back,
            we always need more!
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-maroon-700 text-white rounded-xl py-3.5 text-base font-semibold
                     tap-target active:scale-95 transition-transform"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
