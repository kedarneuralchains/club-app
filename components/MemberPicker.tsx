'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Member } from '@/lib/types';
import { TERMS_VERSION } from '@/lib/terms';

interface Props {
  members: Member[];
  meetingId: string | null;
  onSelect: (id: string, token: string) => void;
  onGuest: () => void;
}

const inputCls = `w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-800 text-base
                  focus:outline-none focus:ring-2 focus:ring-maroon-700`;

function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-xs text-stone-600 leading-snug">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-maroon-700 shrink-0"
        required
      />
      <span>
        I agree to the club&apos;s{' '}
        <a href="/terms" target="_blank" className="text-maroon-700 underline">Terms &amp; Privacy</a>
        {' '}and consent to my details being used to run club meetings.
      </span>
    </label>
  );
}

function PinInput({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean;
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]{4}"
      maxLength={4}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`${inputCls} text-center tracking-[0.5em] text-xl`}
      required
    />
  );
}

export function MemberPicker({ members, meetingId, onSelect, onGuest }: Props) {
  const supabase = createClient();
  const [selected, setSelected] = useState('');
  const [step, setStep] = useState<'identify' | 'register' | 'pin'>('identify');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // PIN step
  const [pinStatus, setPinStatus] = useState<{ has_pin: boolean; needs_terms: boolean } | null>(null);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const selectedMember = members.find((m) => m.id === selected);

  async function submitGuest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('guest_registrations').insert({
      meeting_id: meetingId ?? null,
      name: name.trim() || null,
      phone: phone.trim(),
      email: email.trim(),
      terms_version: TERMS_VERSION,
    });
    setSaving(false);
    onGuest();
  }

  async function goToPin() {
    if (!selected) return;
    setSaving(true);
    setErr(null);
    const { data, error } = await supabase.rpc('member_pin_status', {
      p_member_id: selected,
      p_terms_version: TERMS_VERSION,
    });
    setSaving(false);
    if (error || !data) {
      setErr('Could not reach the server — please retry.');
      return;
    }
    setPinStatus(data as { has_pin: boolean; needs_terms: boolean });
    setPin('');
    setPin2('');
    setAgreed(false);
    setStep('pin');
  }

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinStatus) return;
    setErr(null);

    if (!pinStatus.has_pin && pin !== pin2) {
      setErr('The two PINs don\'t match.');
      return;
    }

    setSaving(true);
    const { data, error } = pinStatus.has_pin
      ? await supabase.rpc('member_login', {
          p_member_id: selected,
          p_pin: pin,
          p_terms_version: pinStatus.needs_terms ? TERMS_VERSION : null,
        })
      : await supabase.rpc('set_member_pin', {
          p_member_id: selected,
          p_pin: pin,
          p_terms_version: TERMS_VERSION,
        });
    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }
    if (!data) {
      setErr('Wrong PIN. After 5 wrong tries the account is locked for 15 minutes.');
      setPin('');
      return;
    }
    onSelect(selected, data as string);
  }

  if (step === 'pin' && pinStatus && selectedMember) {
    const settingUp = !pinStatus.has_pin;
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-6 sm:hidden" />
          <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">
            {settingUp ? 'Set your PIN' : `Hi ${selectedMember.display_name}`}
          </h2>
          <p className="text-stone-500 text-sm mb-4">
            {settingUp
              ? 'Choose a 4-digit PIN. You\'ll use it to sign in on any device, so only you can take or change your roles.'
              : 'Enter your 4-digit PIN.'}
          </p>
          <form onSubmit={submitPin} className="space-y-3">
            <PinInput value={pin} onChange={setPin} placeholder="••••" autoFocus />
            {settingUp && (
              <PinInput value={pin2} onChange={setPin2} placeholder="Repeat PIN" />
            )}
            {(settingUp || pinStatus.needs_terms) && (
              <TermsCheckbox checked={agreed} onChange={setAgreed} />
            )}
            {err && <p className="text-sm text-red-500">{err}</p>}
            <button
              type="submit"
              disabled={saving || pin.length !== 4 || (settingUp && pin2.length !== 4)
                || ((settingUp || pinStatus.needs_terms) && !agreed)}
              className="w-full bg-maroon-700 text-white rounded-xl py-3.5 text-base font-semibold
                         tap-target disabled:opacity-40 active:scale-95 transition-transform"
            >
              {saving ? 'Checking…' : settingUp ? 'Save PIN & continue' : 'Sign in'}
            </button>
          </form>
          {!settingUp && (
            <p className="text-xs text-stone-400 mt-3 text-center">
              Forgot your PIN? Ask the VPEd to reset it.
            </p>
          )}
          <button
            onClick={() => { setStep('identify'); setErr(null); }}
            className="block w-full text-center text-xs text-stone-400 mt-2 hover:text-stone-600 tap-target py-1"
          >
            ← Not {selectedMember.display_name}?
          </button>
        </div>
      </div>
    );
  }

  if (step === 'register') {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-6 sm:hidden" />
          <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">Guest Sign-in</h2>
          <p className="text-stone-500 text-sm mb-4">
            Share your details so the club can follow up about your visit. Deleted automatically after 6 months.
          </p>
          <form onSubmit={submitGuest} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-800 text-base
                         focus:outline-none focus:ring-2 focus:ring-maroon-700"
            />
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-800 text-base
                         focus:outline-none focus:ring-2 focus:ring-maroon-700"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-800 text-base
                         focus:outline-none focus:ring-2 focus:ring-maroon-700"
            />
            <TermsCheckbox checked={agreed} onChange={setAgreed} />
            <button
              type="submit"
              disabled={saving || !agreed}
              className="w-full bg-maroon-700 text-white rounded-xl py-3.5 text-base font-semibold
                         tap-target disabled:opacity-40 active:scale-95 transition-transform"
            >
              {saving ? 'Saving…' : 'Continue as Guest'}
            </button>
          </form>
          <button
            onClick={onGuest}
            className="block w-full text-center text-xs text-stone-400 mt-3 hover:text-stone-600 tap-target py-1"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-6 sm:hidden" />
        <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">Who are you?</h2>
        <p className="text-stone-500 text-sm mb-4">Pick your name and enter your PIN to claim roles.</p>

        {/* Guest option */}
        <button
          onClick={() => setStep('register')}
          className="w-full text-left px-4 py-3 rounded-xl border border-stone-200 text-stone-500
                     hover:border-stone-300 hover:bg-stone-50 transition-colors mb-3 flex items-center gap-2"
        >
          <span className="text-lg">👤</span>
          <div>
            <p className="text-sm font-medium text-stone-700">Continue as Guest</p>
            <p className="text-xs text-stone-400">View agenda only, no role claiming</p>
          </div>
          <span className="ml-auto text-stone-300 text-sm">→</span>
        </button>

        <div className="relative flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-stone-100" />
          <span className="text-xs text-stone-400 shrink-0">or sign in as a member</span>
          <div className="flex-1 h-px bg-stone-100" />
        </div>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-800 text-base
                     focus:outline-none focus:ring-2 focus:ring-maroon-700 bg-white tap-target"
        >
          <option value="">Select your name…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name !== m.name.split(' ')[0] ? m.display_name : m.name}
            </option>
          ))}
        </select>

        {err && <p className="text-sm text-red-500 mt-3">{err}</p>}
        <button
          disabled={!selected || saving}
          onClick={goToPin}
          className="mt-4 w-full bg-maroon-700 text-white rounded-xl py-3.5 text-base font-semibold
                     tap-target disabled:opacity-40 disabled:cursor-not-allowed
                     active:scale-95 transition-transform"
        >
          That&apos;s me
        </button>
      </div>
    </div>
  );
}
