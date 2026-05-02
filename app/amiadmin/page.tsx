'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { MeetingCard } from '@/components/MeetingCard';
import { SiteFooter } from '@/components/SiteFooter';
import type { Member, MeetingWithClaims, MeetingType, Ballot, VoteResult, TTSpeaker } from '@/lib/types';
import { isMeetingPast } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

const ADMIN_KEY = 'tm_admin';

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_KEY, '1');
      onSuccess();
    } else {
      setErr(true);
    }
  }

  return (
    <div className="min-h-screen bg-navy-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 w-full max-w-sm">
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-1">Admin</h1>
        <p className="text-stone-500 text-sm mb-6">Dehradun WIC India Toastmasters Club</p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(false); }}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-base
                       focus:outline-none focus:ring-2 focus:ring-maroon-700"
          />
          {err && <p className="text-red-500 text-sm">Incorrect password.</p>}
          <button
            type="submit"
            className="w-full bg-maroon-700 text-white rounded-xl py-3.5 font-semibold
                       tap-target active:scale-95 transition-transform"
          >
            Enter
          </button>
        </form>
        <Link href="/" className="block text-center text-xs text-stone-400 mt-4 hover:text-stone-600">
          ← Back to meetings
        </Link>
      </div>
    </div>
  );
}

// ─── Meeting form ─────────────────────────────────────────────────────────────

interface MeetingFormData {
  number: string;
  date: string;
  start_time: string;
  end_time: string;
  theme: string;
  meeting_type: MeetingType;
  speaker_slots: string;
  evaluator_slots: string;
}

const EMPTY_FORM: MeetingFormData = {
  number: '',
  date: '',
  start_time: '10:45',
  end_time: '13:00',
  theme: '',
  meeting_type: 'regular',
  speaker_slots: '2',
  evaluator_slots: '2',
};

function MeetingForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<MeetingFormData & { id: string }>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState<MeetingFormData>({
    ...EMPTY_FORM,
    ...initial,
    start_time: initial?.start_time?.slice(0, 5) ?? '10:45',
    end_time: initial?.end_time?.slice(0, 5) ?? '13:00',
    speaker_slots: String(initial?.speaker_slots ?? 2),
    evaluator_slots: String(initial?.evaluator_slots ?? 2),
  });
  const [saving, setSaving] = useState(false);

  function set(field: keyof MeetingFormData, value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Auto-adjust slots when type changes
      if (field === 'meeting_type') {
        next.speaker_slots = value === 'speakathon' ? '4' : '2';
        next.evaluator_slots = value === 'speakathon' ? '4' : '2';
      }
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      number: parseInt(form.number),
      date: form.date,
      start_time: form.start_time + ':00',
      end_time: form.end_time + ':00',
      theme: form.theme || null,
      meeting_type: form.meeting_type,
      speaker_slots: parseInt(form.speaker_slots),
      evaluator_slots: parseInt(form.evaluator_slots),
    };

    if (initial?.id) {
      await supabase.from('meetings').update(payload).eq('id', initial.id);
    } else {
      await supabase.from('meetings').insert(payload);
    }
    setSaving(false);
    onSave();
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
      <h3 className="font-serif font-semibold text-stone-900">
        {initial?.id ? 'Edit Meeting' : 'New Meeting'}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-stone-500 font-medium">Meeting #</span>
          <input required type="number" value={form.number} onChange={(e) => set('number', e.target.value)}
            className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-700" />
        </label>
        <label className="block">
          <span className="text-xs text-stone-500 font-medium">Date</span>
          <input required type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
            className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-700" />
        </label>
        <label className="block">
          <span className="text-xs text-stone-500 font-medium">Start time</span>
          <input required type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)}
            className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-700" />
        </label>
        <label className="block">
          <span className="text-xs text-stone-500 font-medium">End time</span>
          <input required type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)}
            className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-700" />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-stone-500 font-medium">Theme</span>
        <input type="text" value={form.theme} onChange={(e) => set('theme', e.target.value)}
          placeholder="e.g. Mental Wellness"
          className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-700" />
      </label>

      <label className="block">
        <span className="text-xs text-stone-500 font-medium">Meeting type</span>
        <select value={form.meeting_type} onChange={(e) => set('meeting_type', e.target.value as MeetingType)}
          className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-700 bg-white">
          <option value="regular">Regular</option>
          <option value="speakathon">Speakathon</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-stone-500 font-medium">Speaker slots</span>
          <input type="number" min={1} max={8} value={form.speaker_slots}
            onChange={(e) => set('speaker_slots', e.target.value)}
            className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-700" />
        </label>
        <label className="block">
          <span className="text-xs text-stone-500 font-medium">Evaluator slots</span>
          <input type="number" min={1} max={8} value={form.evaluator_slots}
            onChange={(e) => set('evaluator_slots', e.target.value)}
            className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-700" />
        </label>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="flex-1 bg-maroon-700 text-white rounded-xl py-2.5 text-sm font-semibold
                     disabled:opacity-50 active:scale-95 transition-transform tap-target">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-stone-200 rounded-xl py-2.5 text-sm font-medium
                     text-stone-600 hover:bg-stone-50 active:scale-95 transition-transform tap-target">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({ member, onUpdated }: { member: Member; onUpdated: () => void }) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(member.display_name);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from('members').update({ display_name: displayName }).eq('id', member.id);
    setSaving(false);
    setEditing(false);
    onUpdated();
  }

  async function toggleActive() {
    await supabase.from('members').update({ active: !member.active }).eq('id', member.id);
    onUpdated();
  }

  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-xl border
      ${member.active ? 'border-stone-100 bg-white' : 'border-stone-100 bg-stone-50 opacity-60'}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">{member.name}</p>
        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="text-xs border border-stone-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-maroon-700 w-28"
              placeholder="Display name"
            />
            <button onClick={save} disabled={saving}
              className="text-xs text-maroon-700 font-semibold">{saving ? '…' : 'Save'}</button>
            <button onClick={() => { setEditing(false); setDisplayName(member.display_name); }}
              className="text-xs text-stone-400">Cancel</button>
          </div>
        ) : (
          <p className="text-xs text-stone-400">
            WhatsApp name: <span className="text-stone-600">TM {member.display_name}</span>
            <button onClick={() => setEditing(true)} className="ml-1.5 text-maroon-600">Edit</button>
          </p>
        )}
      </div>
      <button
        onClick={toggleActive}
        className={`text-xs font-medium px-2 py-1 rounded-lg tap-target shrink-0
          ${member.active
            ? 'text-stone-400 hover:text-red-500 hover:bg-red-50'
            : 'text-green-600 hover:bg-green-50'}`}
      >
        {member.active ? 'Deactivate' : 'Restore'}
      </button>
    </div>
  );
}

// ─── Main admin panel ─────────────────────────────────────────────────────────

function AdminPanel() {
  const supabase = createClient();
  const [meetings, setMeetings] = useState<MeetingWithClaims[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ballotsMap, setBallotsMap] = useState<Map<string, Ballot>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'meetings' | 'members'>('meetings');
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingWithClaims | null>(null);
  const [memberFilter, setMemberFilter] = useState<'active' | 'all'>('active');

  const fetchAll = useCallback(async () => {
    const [{ data: m }, { data: mb }, { data: bl }] = await Promise.all([
      supabase
        .from('meetings')
        .select('*, role_claims(*, member:members(*))')
        .order('number', { ascending: false })
        .limit(10),
      supabase.from('members').select('*').order('name'),
      supabase.from('ballots').select('*'),
    ]);
    if (m) setMeetings(m as MeetingWithClaims[]);
    if (mb) setMembers(mb as Member[]);
    if (bl) setBallotsMap(new Map((bl as Ballot[]).map((b) => [b.meeting_id, b])));
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function deleteMeeting(id: string) {
    if (!confirm('Delete this meeting and all its role claims? This cannot be undone.')) return;
    await supabase.from('meetings').delete().eq('id', id);
    fetchAll();
  }

  async function addMember(name: string) {
    const membershipNo = `MANUAL-${Date.now()}`;
    const firstName = name.split(' ')[0];
    const existingDisplayNames = members.map((m) => m.display_name.toLowerCase());
    // If first name already taken, use "First Last" to distinguish
    const displayName = existingDisplayNames.includes(firstName.toLowerCase())
      ? name.split(' ').slice(0, 2).join(' ')
      : firstName;
    await supabase.from('members').insert({
      membership_no: membershipNo,
      name,
      display_name: displayName,
      active: true,
    });
    fetchAll();
  }

  function logout() {
    localStorage.removeItem(ADMIN_KEY);
    window.location.reload();
  }

  const displayedMembers = memberFilter === 'active'
    ? members.filter((m) => m.active)
    : members;

  return (
    <div className="min-h-screen bg-navy-600">
      <header className="sticky top-0 z-40 bg-maroon-700 shadow-md">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex flex-col items-start justify-center gap-0.5 flex-1 min-w-0 overflow-hidden">
            <div className="bg-white rounded-md px-1.5 py-0.5 shadow-sm shrink-0">
              <Image src="/logo.png" alt="Toastmasters International" width={100} height={24} className="h-6 w-auto" priority />
            </div>
            <p className="text-[10px] font-bold text-white leading-tight w-full truncate">Dehradun WIC India Toastmasters Club</p>
            <p className="text-[8px] text-white/55 leading-none w-full truncate">No. 03295206 · Area 03 · Division I · District 41</p>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-yellow-200 bg-white/10 px-2.5 py-1 rounded-full">Admin</span>
            <button onClick={logout} className="text-xs text-white/60 hover:text-white tap-target px-2 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-white/10 p-1 rounded-xl mb-6">
          {(['meetings', 'members'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-colors tap-target
                ${tab === t ? 'bg-white text-navy-700 shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white/10 rounded-2xl h-32 animate-pulse" />)}
          </div>
        ) : tab === 'meetings' ? (
          <div className="space-y-4 pb-8">
            {!showNewMeeting && !editingMeeting && (
              <button
                onClick={() => setShowNewMeeting(true)}
                className="w-full border-2 border-dashed border-stone-200 rounded-2xl py-4
                           text-stone-400 hover:border-maroon-300 hover:text-maroon-600
                           text-sm font-medium transition-colors tap-target"
              >
                + Add upcoming meeting
              </button>
            )}

            {showNewMeeting && (
              <MeetingForm
                onSave={() => { setShowNewMeeting(false); fetchAll(); }}
                onCancel={() => setShowNewMeeting(false)}
              />
            )}

            {(() => {
              // Only the first non-past meeting gets voting controls
              const nextMeetingId = [...meetings]
                .filter(m => !isMeetingPast(m))
                .sort((a, b) => a.number - b.number)[0]?.id ?? null;

              return meetings.map((m) => {
                const ballot = ballotsMap.get(m.id) ?? null;
                const ballotActive = (ballot?.status ?? 'not_started') !== 'not_started';
                const showVoting = m.id === nextMeetingId || ballotActive;

                return (
                  <div key={m.id}>
                    {editingMeeting?.id === m.id ? (
                      <MeetingForm
                        initial={{
                          id: m.id,
                          number: String(m.number),
                          date: m.date,
                          start_time: m.start_time,
                          end_time: m.end_time,
                          theme: m.theme ?? '',
                          meeting_type: m.meeting_type,
                          speaker_slots: String(m.speaker_slots),
                          evaluator_slots: String(m.evaluator_slots),
                        }}
                        onSave={() => { setEditingMeeting(null); fetchAll(); }}
                        onCancel={() => setEditingMeeting(null)}
                      />
                    ) : (
                      <div>
                        <MeetingCard
                          meeting={m}
                          allMembers={members}
                          memberId={null}
                          isAdmin={true}
                          onChanged={fetchAll}
                        />
                        <div className="flex gap-3 mt-2 px-1">
                          <button
                            onClick={() => setEditingMeeting(m)}
                            className="text-xs text-white/60 hover:text-yellow-200 tap-target px-2 py-1"
                          >
                            Edit meeting
                          </button>
                          <button
                            onClick={() => deleteMeeting(m.id)}
                            className="text-xs text-stone-400 hover:text-red-500 tap-target px-2 py-1"
                          >
                            Delete
                          </button>
                        </div>
                        {showVoting && (
                          <VotingControls
                            meeting={m}
                            ballot={ballot}
                            allMembers={members}
                            onChanged={fetchAll}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {/* Add member */}
            <AddMemberForm onAdd={addMember} />

            {/* Filter */}
            <div className="flex gap-2">
              {(['active', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMemberFilter(f)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full tap-target transition-colors
                    ${memberFilter === f
                      ? 'bg-maroon-700 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  {f === 'active' ? 'Active' : 'All members'}
                </button>
              ))}
              <span className="ml-auto text-xs text-stone-400 self-center">
                {displayedMembers.length} members
              </span>
            </div>

            <div className="space-y-1.5">
              {displayedMembers.map((m) => (
                <MemberRow key={m.id} member={m} onUpdated={fetchAll} />
              ))}
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

// ─── Voting Controls ──────────────────────────────────────────────────────────

function VotingControls({ meeting, ballot, allMembers, onChanged }: {
  meeting: MeetingWithClaims;
  ballot: Ballot | null;
  allMembers: Member[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [voterCount, setVoterCount] = useState('');
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Table Topics speakers management
  const [ttSpeakers, setTtSpeakers] = useState<TTSpeaker[]>(ballot?.table_topics_speakers ?? []);
  const [addMemberId, setAddMemberId] = useState('');
  const [guestNameInput, setGuestNameInput] = useState('');
  const [savingTT, setSavingTT] = useState(false);

  useEffect(() => {
    setTtSpeakers(ballot?.table_topics_speakers ?? []);
  }, [ballot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ballot || ballot.status !== 'open') { setLiveCount(null); return; }
    async function fetchCount() {
      const { data } = await supabase.rpc('get_vote_count', { p_ballot_id: ballot!.id });
      if (data !== null) setLiveCount(Number(data));
    }
    fetchCount();
    const t = setInterval(fetchCount, 5000);
    return () => clearInterval(t);
  }, [ballot?.id, ballot?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ballot || !showResults) return;
    async function fetchResults() {
      const { data } = await supabase.rpc('get_ballot_results', { p_ballot_id: ballot!.id });
      if (data) setResults(data as VoteResult[]);
    }
    fetchResults();
  }, [ballot?.id, showResults]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showShare || qrDataUrl) return;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(window.location.origin, { width: 240, margin: 2, color: { dark: '#004165', light: '#ffffff' } })
        .then(setQrDataUrl);
    });
  }, [showShare, qrDataUrl]);

  // ── TT speaker helpers ────────────────────────────────────────────────────
  async function saveTT(speakers: TTSpeaker[]) {
    setSavingTT(true);
    setTtSpeakers(speakers);
    if (ballot) {
      await supabase.from('ballots').update({ table_topics_speakers: speakers }).eq('id', ballot.id);
    } else {
      await supabase.from('ballots').upsert(
        { meeting_id: meeting.id, status: 'not_started', table_topics_speakers: speakers },
        { onConflict: 'meeting_id' }
      );
    }
    setSavingTT(false);
    onChanged();
  }

  async function addTTMember() {
    if (!addMemberId) return;
    const member = allMembers.find(m => m.id === addMemberId);
    if (!member || ttSpeakers.some(s => s.id === addMemberId)) return;
    await saveTT([...ttSpeakers, { id: addMemberId, name: member.display_name, is_guest: false }]);
    setAddMemberId('');
  }

  async function addTTGuest() {
    const name = guestNameInput.trim();
    if (!name) return;
    await saveTT([...ttSpeakers, { id: `guest-${Date.now()}`, name, is_guest: true }]);
    setGuestNameInput('');
  }

  // ── Voting helpers ────────────────────────────────────────────────────────
  async function openVoting() {
    setBusy(true);
    const payload = {
      status: 'open' as const,
      meeting_code: null,
      voter_count: voterCount ? parseInt(voterCount) : null,
      table_topics_speakers: ttSpeakers,
      opened_at: new Date().toISOString(),
      closed_at: null,
    };
    if (ballot) {
      await supabase.from('ballots').update(payload).eq('id', ballot.id);
    } else {
      await supabase.from('ballots').insert({ meeting_id: meeting.id, ...payload });
    }
    setBusy(false); setShowOpen(false); onChanged();
  }

  async function handleShare() {
    const url = window.location.origin;
    if (navigator.share) {
      await navigator.share({ title: `Meeting #${meeting.number} — Vote Now`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function closeVoting() {
    if (!ballot) return;
    setBusy(true);
    await supabase.from('ballots').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', ballot.id);
    setBusy(false); onChanged();
  }

  async function reopenVoting() {
    if (!ballot) return;
    if (!window.confirm('Re-opening will clear all existing votes. Continue?')) return;
    setBusy(true);
    await supabase.from('votes').delete().eq('ballot_id', ballot.id);
    await supabase.from('ballots').update({ status: 'open', closed_at: null, voter_count: null }).eq('id', ballot.id);
    setBusy(false); setShowResults(false); setLiveCount(null); onChanged();
  }

  async function resetBallot() {
    if (!ballot || resetInput !== String(meeting.number)) return;
    setBusy(true);
    await supabase.from('votes').delete().eq('ballot_id', ballot.id);
    await supabase.from('ballots').update({
      status: 'not_started', meeting_code: null, voter_count: null,
      table_topics_speakers: [], opened_at: null, closed_at: null,
    }).eq('id', ballot.id);
    setBusy(false);
    setShowReset(false); setResetInput(''); setShowShare(false);
    setQrDataUrl(''); setShowResults(false); setTtSpeakers([]);
    setVoterCount(''); setShowOpen(false);
    onChanged();
  }

  const status = ballot?.status ?? 'not_started';
  const availableMembers = allMembers.filter(m => !ttSpeakers.some(s => s.id === m.id));

  const CAT_LABELS: Record<string, string> = {
    speaker:      '🎙️ Best Speaker',
    evaluator:    '⚖️ Best Evaluator',
    table_topics: '💬 Best Table Topics Speaker',
    role_player:  '🎤 Best Role Player',
    aux_role:     '⏱️ Best Auxiliary Role Player',
  };

  return (
    <div className="mt-3 rounded-2xl border border-maroon-700/40 bg-navy-800 overflow-hidden">

      {/* ── Card header ── */}
      <div className="px-4 py-3 bg-maroon-700/20 border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">🗳️</span>
          <span className="text-sm font-semibold text-white truncate">
            Voting · Meeting #{meeting.number}
          </span>
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            status === 'open'   ? 'bg-green-400/20 text-green-400' :
            status === 'closed' ? 'bg-yellow-300/20 text-yellow-300' :
                                  'bg-white/10 text-white/30'
          }`}>
            {status === 'not_started' ? 'Not started' : status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
        {status === 'open' && liveCount !== null && (
          <span className="text-xs text-white/50 shrink-0">
            {liveCount}{ballot?.voter_count ? ` / ${ballot.voter_count}` : ''} vote{liveCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── Table Topics speakers ── */}
        {(status === 'not_started' || status === 'open') && (
          <div>
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
              💬 Table Topics Speakers
            </p>

            {/* Current list */}
            {ttSpeakers.length > 0 && (
              <div className="space-y-1 mb-2">
                {ttSpeakers.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                    <span className="text-xs text-white/70 flex-1 min-w-0 truncate">
                      {s.is_guest ? `${s.name} (Guest)` : `TM ${s.name}`}
                    </span>
                    <button onClick={() => saveTT(ttSpeakers.filter(x => x.id !== s.id))}
                      disabled={savingTT}
                      className="text-xs text-white/30 hover:text-red-400 tap-target px-1 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add from member list */}
            <div className="flex gap-2 mb-2">
              <select
                value={addMemberId}
                onChange={e => setAddMemberId(e.target.value)}
                className="flex-1 bg-white text-stone-800 text-xs rounded-lg px-2 py-2 border border-white/20 focus:outline-none focus:ring-1 focus:ring-maroon-400 min-w-0"
              >
                <option value="">Add a member…</option>
                {availableMembers.map(m => (
                  <option key={m.id} value={m.id}>TM {m.display_name}</option>
                ))}
              </select>
              <button onClick={addTTMember} disabled={!addMemberId || savingTT}
                className="text-xs font-semibold bg-maroon-700 text-white px-3 py-2 rounded-lg tap-target disabled:opacity-40 shrink-0">
                Add
              </button>
            </div>

            {/* Add guest */}
            <div className="flex gap-2">
              <input
                type="text"
                value={guestNameInput}
                onChange={e => setGuestNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTTGuest()}
                placeholder="Guest name…"
                className="flex-1 bg-white text-stone-800 text-xs rounded-lg px-2 py-2 border border-white/20 focus:outline-none focus:ring-1 focus:ring-maroon-400 placeholder:text-stone-400 min-w-0"
              />
              <button onClick={addTTGuest} disabled={!guestNameInput.trim() || savingTT}
                className="text-xs font-semibold bg-white/10 text-white/70 px-3 py-2 rounded-lg tap-target disabled:opacity-40 hover:bg-white/20 shrink-0">
                + Guest
              </button>
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex flex-wrap gap-2">
          {status === 'not_started' && !showOpen && (
            <button onClick={() => setShowOpen(true)}
              className="text-sm font-semibold bg-maroon-700 text-white px-4 py-2 rounded-xl tap-target hover:bg-maroon-600 transition-colors">
              🗳️ Open voting
            </button>
          )}
          {status === 'open' && (
            <>
              <button onClick={closeVoting} disabled={busy}
                className="text-sm font-semibold bg-yellow-400 text-stone-900 px-4 py-2 rounded-xl tap-target disabled:opacity-50 active:scale-95 transition-transform">
                Close voting
              </button>
              <button onClick={() => setShowShare(!showShare)}
                className="text-sm font-semibold text-white/80 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl tap-target transition-colors">
                📤 Share link
              </button>
              <button onClick={() => { setShowResults(!showResults); }}
                className="text-xs text-white/50 hover:text-white px-3 py-2 tap-target">
                {showResults ? 'Hide tallies' : 'Preview tallies'}
              </button>
            </>
          )}
          {status === 'closed' && (
            <>
              <button onClick={reopenVoting} disabled={busy}
                className="text-sm font-semibold bg-white/10 text-white/80 hover:bg-white/20 px-4 py-2 rounded-xl tap-target transition-colors">
                ↩ Re-open &amp; reset votes
              </button>
              <button onClick={() => setShowResults(!showResults)}
                className="text-xs text-white/50 hover:text-white px-3 py-2 tap-target">
                {showResults ? 'Hide results' : 'View results'}
              </button>
            </>
          )}
          {ballot && (
            <button onClick={() => setShowReset(!showReset)}
              className="text-xs text-red-400/40 hover:text-red-400 px-3 py-2 tap-target ml-auto">
              Reset ballot
            </button>
          )}
        </div>

        {/* ── Open voting: voter count ── */}
        {showOpen && (
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-white/40 block mb-1.5">
                Members present today? <span className="text-white/20">(optional — used for vote count display)</span>
              </label>
              <input
                type="number" inputMode="numeric" min={1}
                value={voterCount}
                onChange={e => setVoterCount(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 25"
                className="w-28 bg-white rounded-lg px-3 py-2 text-lg font-bold text-navy-700 text-center focus:outline-none focus:ring-2 focus:ring-maroon-500"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button onClick={openVoting} disabled={busy}
                className="text-sm font-semibold bg-green-500 text-white px-5 py-2.5 rounded-xl tap-target disabled:opacity-40 active:scale-95 transition-transform">
                {busy ? '…' : 'Start voting'}
              </button>
              <button onClick={() => { setShowOpen(false); setVoterCount(''); }}
                className="text-xs text-white/40 hover:text-white tap-target px-3">Cancel</button>
            </div>
          </div>
        )}

        {/* ── Share panel ── */}
        {showShare && (
          <div className="bg-white rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-stone-700 text-center">Share with members to vote</p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code" className="w-52 h-52 mx-auto rounded-xl" />
            ) : (
              <div className="w-52 h-52 mx-auto rounded-xl bg-stone-100 animate-pulse" />
            )}
            <p className="text-[11px] text-stone-400 text-center font-mono break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}
            </p>
            <button onClick={handleShare}
              className="w-full bg-maroon-700 text-white rounded-xl py-3 text-sm font-semibold tap-target active:scale-95 transition-transform">
              {copied ? '✓ Copied!' : '📤 Share / Copy link'}
            </button>
          </div>
        )}

        {/* ── Tallies / results ── */}
        {showResults && (
          <div className="bg-white/5 rounded-xl p-3 space-y-3">
            {results.length === 0 && <p className="text-xs text-white/30 text-center py-2">No votes yet.</p>}
            {Object.entries(CAT_LABELS).map(([cat, label]) => {
              const catRows = results.filter(r => r.category === cat);
              if (!catRows.length) return null;
              return (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{label}</p>
                  {catRows.map((r, i) => (
                    <div key={`${r.voted_for_member_id ?? r.voted_for_display_name}-${i}`}
                      className="flex items-center gap-2 py-0.5">
                      <span className={`text-xs ${i === 0 ? 'text-yellow-300' : 'text-transparent'}`}>★</span>
                      <span className={`text-sm ${i === 0 ? 'text-yellow-200 font-semibold' : 'text-white/50'}`}>
                        {r.voted_for_display_name}
                      </span>
                      <span className="ml-auto text-xs text-white/30">
                        {r.vote_count} vote{r.vote_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Reset confirmation ── */}
        {showReset && (
          <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3">
            <p className="text-xs text-red-300 mb-2">
              Type <strong className="font-mono">{meeting.number}</strong> to wipe all votes and fully reset this ballot.
            </p>
            <div className="flex gap-2">
              <input type="text" value={resetInput} onChange={e => setResetInput(e.target.value)}
                placeholder={String(meeting.number)}
                className="flex-1 bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500" />
              <button onClick={resetBallot} disabled={busy || resetInput !== String(meeting.number)}
                className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg tap-target disabled:opacity-40">
                {busy ? '…' : 'Reset'}
              </button>
              <button onClick={() => { setShowReset(false); setResetInput(''); }}
                className="text-xs text-white/40 hover:text-white tap-target px-2">Cancel</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Add Member Form ──────────────────────────────────────────────────────────

function AddMemberForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New member full name"
        className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-maroon-700"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="bg-maroon-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold
                   disabled:opacity-40 tap-target active:scale-95 transition-transform"
      >
        Add
      </button>
    </form>
  );
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(localStorage.getItem(ADMIN_KEY) === '1');
  }, []);

  if (authed === null) return null; // SSR flash prevention

  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;

  return <AdminPanel />;
}
