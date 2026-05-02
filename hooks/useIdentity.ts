'use client';
import { useEffect, useState } from 'react';

const MEMBER_KEY = 'tm_member_id';
const DEVICE_KEY = 'tm_device_uuid';

export function useIdentity() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMemberId(localStorage.getItem(MEMBER_KEY));

    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
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
