'use client';
import { useMeetings } from '@/hooks/useMeetings';
import { useIdentity } from '@/hooks/useIdentity';
import { MeetingCard } from '@/components/MeetingCard';
import { MemberPicker } from '@/components/MemberPicker';
import { isMeetingPast } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const { meetings, members, loading, refetch } = useMeetings();
  const { memberId, loaded, identify, clearIdentity } = useIdentity();

  const currentMember = members.find((m) => m.id === memberId);

  // Split into past (last 3) and upcoming (next 3), ordered properly for display
  const past = meetings
    .filter((m) => isMeetingPast(m))
    .sort((a, b) => b.number - a.number)
    .slice(0, 3);

  const upcoming = meetings
    .filter((m) => !isMeetingPast(m))
    .sort((a, b) => a.number - b.number)
    .slice(0, 3);

  const showPicker = loaded && !memberId && members.length > 0;

  return (
    <div className="min-h-screen bg-navy-600">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-maroon-700 shadow-md">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            <Image src="/logo.png" alt="Toastmasters International" width={200} height={36} className="h-9 w-auto brightness-0 invert" priority />
            <span className="text-[10px] font-semibold tracking-wide text-white/60 leading-none">
              Dehradun WIC India · Club #03295206
            </span>
          </div>

          <div className="flex items-center gap-3">
            {currentMember && (
              <div className="text-right">
                <p className="text-xs text-white/50 leading-none">Signed in as</p>
                <p className="text-sm font-semibold text-yellow-200 leading-tight truncate max-w-[120px]">
                  {currentMember.display_name}
                </p>
              </div>
            )}
            {loaded && (
              <button
                onClick={clearIdentity}
                className="text-xs text-white/60 hover:text-white tap-target px-2 py-1 transition-colors"
              >
                {memberId ? 'Switch' : 'Pick name'}
              </button>
            )}
            <Link
              href="/admin"
              className="text-xs text-white/30 hover:text-white/60 tap-target px-2 py-1 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/10 rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* Upcoming meetings */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">
                  Upcoming Meetings
                </h2>
                <div className="space-y-4">
                  {upcoming.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      allMembers={members}
                      memberId={memberId}
                      isAdmin={false}
                      onChanged={refetch}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Past meetings */}
            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">
                  Recent Meetings
                </h2>
                <div className="space-y-4">
                  {past.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      allMembers={members}
                      memberId={memberId}
                      isAdmin={false}
                      onChanged={refetch}
                    />
                  ))}
                </div>
              </section>
            )}

            {upcoming.length === 0 && past.length === 0 && (
              <div className="text-center py-16">
                <p className="text-white/40">No meetings yet.</p>
                <Link href="/admin" className="text-sm text-yellow-200 mt-2 inline-block">
                  Add one in Admin →
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      {/* Member picker overlay */}
      {showPicker && <MemberPicker members={members} onSelect={identify} />}
    </div>
  );
}
