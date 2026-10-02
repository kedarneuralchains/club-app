import { NextResponse } from 'next/server';
import { isAdminPassword, serviceClient } from '@/lib/adminServer';

const KEYS = ['vped_email', 'resend_api_key'] as const;

// POST { password } → current settings
// POST { password, values: { vped_email, resend_api_key } } → save, then return settings
export async function POST(request: Request) {
  const { password, values } = await request.json().catch(() => ({}));
  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 });
  }

  if (values && typeof values === 'object') {
    const rows = KEYS
      .filter((k) => typeof values[k] === 'string')
      .map((k) => ({ key: k, value: (values[k] as string).trim(), updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('settings').upsert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data, error } = await supabase.from('settings').select('key, value').in('key', KEYS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: Object.fromEntries((data ?? []).map((s) => [s.key, s.value])) });
}
