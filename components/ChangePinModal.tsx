'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PinInput } from './MemberPicker';

interface Props {
  token: string;
  onClose: () => void;
}

export function ChangePinModal({ token, onClose }: Props) {
  const supabase = createClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next !== next2) {
      setErr('The new PINs don\'t match.');
      return;
    }
    if (next === current) {
      setErr('The new PIN is the same as the current one.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('change_member_pin', {
      p_token: token,
      p_current_pin: current,
      p_new_pin: next,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (!data) {
      setErr('Current PIN is wrong. After 5 wrong tries the account is locked for 15 minutes.');
      setCurrent('');
      return;
    }
    setDone(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-6 sm:hidden" />
        <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">Change PIN</h2>
        {done ? (
          <>
            <p className="text-stone-600 text-sm mb-4">
              Your PIN has been changed. Any other devices you were signed in on will ask for the new PIN.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-maroon-700 text-white rounded-xl py-3.5 text-base font-semibold tap-target"
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3 mt-3">
            <label className="block text-xs font-medium text-stone-500">Current PIN</label>
            <PinInput value={current} onChange={setCurrent} placeholder="••••" autoFocus />
            <label className="block text-xs font-medium text-stone-500 pt-1">New PIN</label>
            <PinInput value={next} onChange={setNext} placeholder="••••" />
            <PinInput value={next2} onChange={setNext2} placeholder="Repeat new PIN" />
            {err && <p className="text-sm text-red-500">{err}</p>}
            <button
              type="submit"
              disabled={busy || current.length !== 4 || next.length !== 4 || next2.length !== 4}
              className="w-full bg-maroon-700 text-white rounded-xl py-3.5 text-base font-semibold
                         tap-target disabled:opacity-40 active:scale-95 transition-transform"
            >
              {busy ? 'Saving…' : 'Change PIN'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="block w-full text-center text-xs text-stone-400 hover:text-stone-600 tap-target py-1"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
