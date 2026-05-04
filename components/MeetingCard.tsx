'use client';
import { useState } from 'react';
import type { Ballot, MeetingWithClaims, Member, RoleKey } from '@/lib/types';
import { getMeetingRoles } from '@/lib/types';
import { formatMeetingDate, formatTime, isMeetingLocked, isMeetingPast } from '@/lib/utils';
import { RoleSlot } from './RoleSlot';
import { WhatsAppCopyButton } from './WhatsAppCopyButton';
import { BallotModal } from './BallotModal';

interface Props {
  meeting: MeetingWithClaims;
  allMembers: Member[];
  memberId: string | null;
  deviceId?: string | null;
  ballot?: Ballot;
  isAdmin: boolean;
  hideWhatsApp?: boolean;
  onChanged: () => void;
}

export function MeetingCard({ meeting, allMembers, memberId, deviceId, ballot, isAdmin, hideWhatsApp, onChanged }: Props) {
  const [showBallot, setShowBallot] = useState(false);
  const locked = isMeetingLocked(meeting);
  const past = isMeetingPast(meeting);

  const claimsMap = new Map(
    meeting.role_claims.map((c) => [`${c.role_key}:${c.slot_index}`, c])
  );

  const memberExistingRoles: RoleKey[] = memberId
    ? meeting.role_claims.filter((c) => c.member_id === memberId).map((c) => c.role_key)
    : [];

  const roles = getMeetingRoles(meeting);

  const speakerRoles = roles.filter((r) => r.roleKey === 'speaker');
  const evaluatorRoles = roles.filter((r) => r.roleKey === 'evaluator');
  const mainRoles = roles.filter((r) =>
    ['tmod', 'ttm', 'ge'].includes(r.roleKey)
  );
  const tagRoles = roles.filter((r) =>
    ['grammarian', 'ah_counter', 'timer', 'harkmaster'].includes(r.roleKey)
  );

  return (
    <>
    <article className={`bg-white rounded-2xl shadow-sm border overflow-hidden
      ${past ? 'border-stone-100 opacity-75' : 'border-stone-200'}`}
    >
      {/* Header */}
      <div className={`px-4 pt-4 pb-3 border-b ${past ? 'bg-stone-50 border-stone-100' : 'bg-white border-stone-100'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-lg font-bold text-stone-900">
                Meeting #{meeting.number}
              </h2>
              {meeting.meeting_type === 'speakathon' && (
                <span className="text-xs font-semibold uppercase tracking-wide
                                 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Speakathon
                </span>
              )}
              {past && (
                <span className="text-xs font-medium text-stone-400 bg-stone-100
                                 px-2 py-0.5 rounded-full">Past</span>
              )}
              {!past && locked && !isAdmin && (
                <span className="text-xs font-medium text-red-500 bg-red-50
                                 px-2 py-0.5 rounded-full">Locked</span>
              )}
            </div>
            <p className="text-sm text-stone-500 mt-0.5">
              {formatMeetingDate(meeting.date)}&nbsp;·&nbsp;<span className="whitespace-nowrap">{formatTime(meeting.start_time)}–{formatTime(meeting.end_time)} IST</span>
            </p>
            {meeting.theme && (
              <p className="text-sm font-medium text-stone-700 mt-0.5">🌐 {meeting.theme}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {ballot?.status === 'open' && memberId && deviceId && (
              <button
                onClick={() => setShowBallot(true)}
                className="bg-yellow-400 hover:bg-yellow-300 text-navy-800 font-bold text-xs px-3 py-1.5
                           rounded-full transition-colors shadow-sm shrink-0"
              >
                Vote Now
              </button>
            )}
            {ballot?.status === 'closed' && (
              <button
                onClick={() => setShowBallot(true)}
                className="bg-navy-700 hover:bg-navy-600 text-yellow-200 font-bold text-xs px-3 py-1.5
                           rounded-full transition-colors shadow-sm shrink-0"
              >
                🏆 View Results
              </button>
            )}
            {!past && !hideWhatsApp && ballot?.status !== 'open' && ballot?.status !== 'closed' && (
              <WhatsAppCopyButton meeting={meeting} members={allMembers} />
            )}
          </div>
        </div>

        {!past && !locked && (
          <p className="text-xs text-stone-400 mt-2">
            Roles lock at {formatTime(meeting.start_time)} IST on meeting day.
          </p>
        )}
      </div>

      {/* Role slots */}
      <div className="p-4 space-y-4">
        <RoleSection label="🎙️ Prepared Speakers">
          {speakerRoles.map(({ roleKey, slot }) => (
            <RoleSlot
              key={`${roleKey}:${slot}`}
              meetingId={meeting.id}
              roleKey={roleKey as RoleKey}
              slotIndex={slot}
              claim={claimsMap.get(`${roleKey}:${slot}`) ?? null}
              memberId={memberId}
              memberExistingRoles={memberExistingRoles}
              isLocked={locked}
              isPast={past}
              isAdmin={isAdmin}
              allMembers={allMembers}
              onChanged={onChanged}
            />
          ))}
        </RoleSection>

        <RoleSection label="⚖️ Evaluators">
          {evaluatorRoles.map(({ roleKey, slot }) => (
            <RoleSlot
              key={`${roleKey}:${slot}`}
              meetingId={meeting.id}
              roleKey={roleKey as RoleKey}
              slotIndex={slot}
              claim={claimsMap.get(`${roleKey}:${slot}`) ?? null}
              memberId={memberId}
              memberExistingRoles={memberExistingRoles}
              isLocked={locked}
              isPast={past}
              isAdmin={isAdmin}
              allMembers={allMembers}
              onChanged={onChanged}
            />
          ))}
        </RoleSection>

        <RoleSection label="Main Roles">
          {mainRoles.map(({ roleKey, slot }) => (
            <RoleSlot
              key={`${roleKey}:${slot}`}
              meetingId={meeting.id}
              roleKey={roleKey as RoleKey}
              slotIndex={slot}
              claim={claimsMap.get(`${roleKey}:${slot}`) ?? null}
              memberId={memberId}
              memberExistingRoles={memberExistingRoles}
              isLocked={locked}
              isPast={past}
              isAdmin={isAdmin}
              allMembers={allMembers}
              onChanged={onChanged}
            />
          ))}
        </RoleSection>

        <RoleSection label="Auxiliary Roles">
          {tagRoles.map(({ roleKey, slot }) => (
            <RoleSlot
              key={`${roleKey}:${slot}`}
              meetingId={meeting.id}
              roleKey={roleKey as RoleKey}
              slotIndex={slot}
              claim={claimsMap.get(`${roleKey}:${slot}`) ?? null}
              memberId={memberId}
              memberExistingRoles={memberExistingRoles}
              isLocked={locked}
              isPast={past}
              isAdmin={isAdmin}
              allMembers={allMembers}
              onChanged={onChanged}
            />
          ))}
        </RoleSection>
      </div>
    </article>

    {showBallot && ballot && (ballot.status === 'closed' || (memberId && deviceId)) && (
      <BallotModal
        ballot={ballot}
        meeting={meeting}
        allMembers={allMembers}
        memberId={memberId ?? null}
        deviceId={deviceId ?? null}
        isAdmin={isAdmin}
        onClose={() => setShowBallot(false)}
      />
    )}
    </>
  );
}

function RoleSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
        {label}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
