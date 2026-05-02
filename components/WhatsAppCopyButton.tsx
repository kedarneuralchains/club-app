'use client';
import { useState } from 'react';
import type { MeetingWithClaims, Member } from '@/lib/types';
import { buildWhatsAppAgenda } from '@/lib/utils';

interface Props {
  meeting: MeetingWithClaims;
  members: Member[];
}

export function WhatsAppCopyButton({ meeting, members }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const membersById = new Map(members.map((m) => [m.id, m]));
    const text = buildWhatsAppAgenda(meeting, membersById);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for older mobile browsers
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                 bg-[#25D366] text-white hover:bg-[#1fba58] active:scale-95
                 transition-all tap-target shadow-sm"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white shrink-0">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.1.546 4.073 1.5 5.796L0 24l6.344-1.489A11.938 11.938 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.796 9.796 0 01-5.031-1.385l-.36-.214-3.762.884.9-3.665-.234-.374A9.796 9.796 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
      </svg>
      {copied ? 'Copied!' : 'Copy for WhatsApp'}
    </button>
  );
}
