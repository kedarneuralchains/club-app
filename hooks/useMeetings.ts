'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { MeetingWithClaims, Member } from '@/lib/types';

export function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingWithClaims[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    const [{ data: meetingsData }, { data: membersData }] = await Promise.all([
      supabase
        .from('meetings')
        .select('*, role_claims(*, member:members(*))')
        .order('number', { ascending: false })
        .limit(6),
      supabase.from('members').select('*').eq('active', true).order('name'),
    ]);

    if (meetingsData) setMeetings(meetingsData as MeetingWithClaims[]);
    if (membersData) setMembers(membersData as Member[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: re-fetch the relevant meeting when any claim changes
  useEffect(() => {
    const channel = supabase
      .channel('role_claims_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'role_claims' },
        () => {
          fetchAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  return { meetings, members, loading, refetch: fetchAll };
}
