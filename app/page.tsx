'use client';
import { useMeetings } from '@/hooks/useMeetings';
import { useIdentity } from '@/hooks/useIdentity';
import { MeetingCard } from '@/components/MeetingCard';
import { MemberPicker } from '@/components/MemberPicker';
import { isMeetingPast } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const { meetings, members, ballots, loading, refetch } = useMeetings();
  const { memberId, deviceId, loaded, identify, clearIdentity } = useIdentity();

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
          <div className="flex items-center gap-2.5">
            <div className="bg-white rounded-md px-2 py-0.5 shadow-sm shrink-0">
              <Image src="/logo.png" alt="Toastmasters International" width={120} height={28} className="h-7 w-auto" priority />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight">Dehradun WIC India Toastmasters Club</p>
              <p className="text-[9px] text-white/55 leading-none mt-0.5">Club No. 03295206 | Area 03 | Division I | District 41</p>
            </div>
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
                      deviceId={deviceId}
                      ballot={ballots.get(m.id)}
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
                      deviceId={deviceId}
                      ballot={ballots.get(m.id)}
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
