import { NextResponse } from 'next/server';
import { isAdminPassword, serviceClient } from '@/lib/adminServer';

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({}));
  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 });
  }
  const { data, error } = await supabase
    .from('guest_registrations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ guests: data });
}
