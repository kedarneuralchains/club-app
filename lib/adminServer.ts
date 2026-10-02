import { createClient } from '@supabase/supabase-js';

// Server-side helpers for admin-only API routes. Guest registrations and
// settings have no anon SELECT policy (migration 014), so the admin panel
// reads/writes them through these routes using the service-role key.

export function isAdminPassword(pw: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
  return typeof pw === 'string' && !!expected && pw === expected;
}

export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
