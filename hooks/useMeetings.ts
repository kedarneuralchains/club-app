'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { MeetingWithClaims, Member, Ballot } from '@/lib/types';

export function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingWithClaims[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ballots, setBallots] = useState<Map<string, Ballot>>(new Map());
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    const [{ data: meetingsData }, { data: membersData }, { data: ballotsData }] = await Promise.all([
      supabase
        .from('meetings')
        .select('*, role_claims(*, member:members(*))')
        .order('number', { ascending: false })
        .limit(20),
      supabase.from('members').select('*').eq('active', true).order('name'),
      supabase.from('ballots').select('*'),
    ]);

    if (meetingsData) setMeetings(meetingsData as MeetingWithClaims[]);
    if (membersData) setMembers(membersData as Member[]);
    setBallots(new Map((ballotsData ?? []).map((b: Ballot) => [b.meeting_id, b])));
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: re-fetch when meetings, claims, or ballot status changes
  useEffect(() => {
    const channel = supabase
      .channel('tm_public_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_claims' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ballots' }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  return { meetings, members, ballots, loading, refetch: fetchAll };
}
