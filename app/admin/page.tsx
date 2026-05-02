'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { MeetingCard } from '@/components/MeetingCard';
import type { Member, MeetingWithClaims, MeetingType } from '@/lib/types';
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
        <p className="text-stone-500 text-sm mb-6">Dehradun WIC Toastmasters</p>
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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'meetings' | 'members'>('meetings');
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingWithClaims | null>(null);
  const [memberFilter, setMemberFilter] = useState<'active' | 'all'>('active');

  const fetchAll = useCallback(async () => {
    const [{ data: m }, { data: mb }] = await Promise.all([
      supabase
        .from('meetings')
        .select('*, role_claims(*, member:members(*))')
        .order('number', { ascending: false })
        .limit(10),
      supabase.from('members').select('*').order('name'),
    ]);
    if (m) setMeetings(m as MeetingWithClaims[]);
    if (mb) setMembers(mb as Member[]);
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
    const displayName = name.split(' ')[0];
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
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-start gap-1">
            <Image src="/logo.png" alt="Toastmasters International" width={180} height={32} className="h-8 w-auto brightness-0 invert" priority />
            <span className="text-[10px] font-semibold tracking-wide text-white/60 leading-none">Admin Panel</span>
          </Link>
          <div className="flex items-center gap-3">
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

            {meetings.map((m) => (
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
                  </div>
                )}
              </div>
            ))}
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
    </div>
  );
}

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
