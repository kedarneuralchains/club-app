'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TERMS_VERSION } from '@/lib/terms';

const MEMBER_KEY = 'tm_member_id';
const DEVICE_KEY = 'tm_device_uuid';
// Session token from PIN sign-in (migration 017); proves the member's
// identity to claim_role / release_role / update_speech_details.
const TOKEN_KEY = 'tm_member_token';

// crypto.randomUUID only exists in secure contexts (HTTPS/localhost), so it's
// undefined when the app is opened over plain http on the LAN or in older
// browsers. getRandomValues is available everywhere.
function uuidv4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function useIdentity() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const storedMember = localStorage.getItem(MEMBER_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    // Members remembered from before PINs existed must sign in again.
    if (storedMember && storedMember !== 'guest' && !storedToken) {
      localStorage.removeItem(MEMBER_KEY);
    } else {
      setMemberId(storedMember);
      setToken(storedToken);
    }

    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(DEVICE_KEY, id);
    }
    setDeviceId(id);
    setLoaded(true);

    // Drop the session if it was revoked (admin PIN reset) or the terms changed.
    if (storedMember && storedMember !== 'guest' && storedToken) {
      createClient()
        .rpc('check_member_session', { p_token: storedToken, p_terms_version: TERMS_VERSION })
        .then(({ data, error }) => {
          if (error) return; // network/DB hiccup — keep the session
          const s = data as { member_id: string; needs_terms: boolean } | null;
          if (!s || s.member_id !== storedMember || s.needs_terms) forget();
        });
    }
  }, []);

  function forget() {
    localStorage.removeItem(MEMBER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setMemberId(null);
    setToken(null);
  }

  // token is null for guests.
  function identify(id: string, newToken: string | null = null) {
    localStorage.setItem(MEMBER_KEY, id);
    if (newToken) localStorage.setItem(TOKEN_KEY, newToken);
    else localStorage.removeItem(TOKEN_KEY);
    setMemberId(id);
    setToken(newToken);
  }

  function clearIdentity() {
    const old = localStorage.getItem(TOKEN_KEY);
    if (old) createClient().rpc('member_logout', { p_token: old }).then(() => {});
    forget();
  }

  return { memberId, deviceId, token, loaded, identify, clearIdentity };
}
