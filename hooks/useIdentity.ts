'use client';
import { useEffect, useState } from 'react';

const KEY = 'tm_member_id';

export function useIdentity() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMemberId(localStorage.getItem(KEY));
    setLoaded(true);
  }, []);

  function identify(id: string) {
    localStorage.setItem(KEY, id);
    setMemberId(id);
  }

  function clearIdentity() {
    localStorage.removeItem(KEY);
    setMemberId(null);
  }

  return { memberId, loaded, identify, clearIdentity };
}
