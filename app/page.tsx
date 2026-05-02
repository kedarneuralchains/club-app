'use client';
import { useState } from 'react';
import { useMeetings } from '@/hooks/useMeetings';
import { useIdentity } from '@/hooks/useIdentity';
import { MeetingCard } from '@/components/MeetingCard';
import { MemberPicker } from '@/components/MemberPicker';
import { SiteFooter } from '@/components/SiteFooter';
import { isMeetingPast } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

type Tab = 'next' | 'upcoming' | 'past';

const TABS: { id: Tab; label: string }[] = [
  { id: 'next',     label: 'Upcoming Meeting' },
  { id: 'upcoming', label: 'Future Meetings' },
  { id: 'past',     label: 'Past' },
];

export default function Home() {
  const { meetings, members, ballots, loading, refetch } = useMeetings();
  const { memberId, deviceId, loaded, identify, clearIdentity } = useIdentity();
  const [activeTab, setActiveTab] = useState<Tab>('next');

  const isGuest = memberId === 'guest';
  const currentMember = isGuest ? null : members.find((m) => m.id === memberId);

  const future = meetings
    .filter((m) => !isMeetingPast(m))
    .sort((a, b) => a.number - b.number);

  const past = meetings
    .filter((m) => isMeetingPast(m))
    .sort((a, b) => b.number - a.number);

  const nextMeeting = future[0] ?? null;
  const upcomingMeetings = future.slice(1);

  const tabContent: Record<Tab, typeof meetings> = {
    next:     nextMeeting ? [nextMeeting] : [],
    upcoming: upcomingMeetings,
    past,
  };

  const emptyState: Record<Tab, { text: string; cta?: string }> = {
    next:     { text: 'No upcoming meeting scheduled.', cta: 'Schedule one in Admin →' },
    upcoming: { text: 'No future meetings scheduled yet.', cta: 'Add meetings in Admin →' },
    past:     { text: 'No past meetings yet.' },
  };

  const showPicker = loaded && !memberId && members.length > 0;
  function handleGuest() { identify('guest'); }

  return (
    <div className="min-h-screen bg-navy-600">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-maroon-700 shadow-md">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          {/* Left: logo + club info */}
          <div className="flex flex-col items-start justify-center gap-0.5 flex-1 min-w-0 overflow-hidden">
            <div className="bg-white rounded-md px-1.5 py-0.5 shadow-sm shrink-0">
              <Image src="/logo.png" alt="Toastmasters International" width={100} height={24} className="h-6 w-auto" priority />
            </div>
            <p className="text-[10px] font-bold text-white leading-tight w-full truncate">Dehradun WIC India Toastmasters Club</p>
            <p className="text-[8px] text-white/55 leading-none w-full truncate">No. 03295206 · Area 03 · Division I · District 41</p>
          </div>

          {/* Right: identity controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {currentMember && (
              <span className="text-xs font-semibold text-yellow-200 truncate max-w-[80px]">
                {currentMember.display_name}
              </span>
            )}
            {isGuest && (
              <span className="text-xs text-white/40 truncate max-w-[60px]">Guest</span>
            )}
            {loaded && (
              <button
                onClick={clearIdentity}
                className="text-xs text-white/60 hover:text-white tap-target px-2 py-1 transition-colors"
              >
                {memberId ? 'Switch' : 'Sign in'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="sticky top-16 z-30 bg-navy-700 border-b border-white/5 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="flex gap-1 bg-white/10 rounded-xl p-1">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === id
                    ? 'bg-white text-navy-700 shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white/10 rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        ) : tabContent[activeTab].length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-white/40">{emptyState[activeTab].text}</p>
            {emptyState[activeTab].cta && (
              <Link href="/amiadmin" className="text-sm text-yellow-200 inline-block">
                {emptyState[activeTab].cta}
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {tabContent[activeTab].map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                allMembers={members}
                memberId={memberId}
                deviceId={deviceId}
                ballot={ballots.get(m.id)}
                isAdmin={false}
                hideWhatsApp={activeTab !== 'next'}
                onChanged={refetch}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />

      {/* Member picker overlay */}
      {showPicker && <MemberPicker members={members} onSelect={identify} onGuest={handleGuest} />}
    </div>
  );
}
