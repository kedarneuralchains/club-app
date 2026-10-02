'use client';
import { useEffect, useState } from 'react';

const MEMBER_KEY = 'tm_member_id';
const DEVICE_KEY = 'tm_device_uuid';

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMemberId(localStorage.getItem(MEMBER_KEY));

    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(DEVICE_KEY, id);
    }
    setDeviceId(id);
    setLoaded(true);
  }, []);

  function identify(id: string) {
    localStorage.setItem(MEMBER_KEY, id);
    setMemberId(id);
  }

  function clearIdentity() {
    localStorage.removeItem(MEMBER_KEY);
    setMemberId(null);
  }

  return { memberId, deviceId, loaded, identify, clearIdentity };
}
