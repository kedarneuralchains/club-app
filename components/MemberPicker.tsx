'use client';
import { useState } from 'react';
import type { Member } from '@/lib/types';

interface Props {
  members: Member[];
  onSelect: (id: string) => void;
  onGuest: () => void;
}

export function MemberPicker({ members, onSelect, onGuest }: Props) {
  const [selected, setSelected] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-6 sm:hidden" />
        <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">Who are you?</h2>
        <p className="text-stone-500 text-sm mb-4">Pick your name to claim roles. You won&apos;t need to do this again on this device.</p>

        {/* Guest option */}
        <button
          onClick={onGuest}
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

        <button
          disabled={!selected}
          onClick={() => onSelect(selected)}
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
