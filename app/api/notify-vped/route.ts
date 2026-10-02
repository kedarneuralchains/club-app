import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Emails the VPEd when a member claims a prepared-speaker slot.
// Takes only the claim id; everything in the email comes from the DB, and
// each claim is emailed at most once (role_claims.vped_notified_at).

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function POST(request: Request) {
  try {
    const { claimId } = await request.json().catch(() => ({}));
    if (typeof claimId !== 'string' || !/^[0-9a-f-]{36}$/i.test(claimId)) {
      return NextResponse.json({ success: false, error: 'claimId required' }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 });
    }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { persistSession: false },
    });

    // Mark the claim as notified first so concurrent/replayed calls can't
    // send twice. Only fresh, pending speaker claims qualify.
    const freshSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: claim } = await supabase
      .from('role_claims')
      .update({ vped_notified_at: new Date().toISOString() })
      .eq('id', claimId)
      .eq('role_key', 'speaker')
      .eq('approval_status', 'pending')
      .is('vped_notified_at', null)
      .gte('claimed_at', freshSince)
      .select('member:members(name), meeting:meetings(number, date)')
      .maybeSingle();

    if (!claim) {
      return NextResponse.json({ success: true, message: 'Nothing to notify.' });
    }

    const member = claim.member as unknown as { name: string } | null;
    const meeting = claim.meeting as unknown as { number: number; date: string } | null;
    const speakerName = member?.name ?? 'Unknown member';

    const { data: settingsData } = await supabase.from('settings').select('key, value');
    const settingsMap = new Map((settingsData || []).map((s) => [s.key, s.value]));
    const vpedEmail = settingsMap.get('vped_email') || 'parastiwari013@gmail.com';
    const resendKey = settingsMap.get('resend_api_key') || process.env.RESEND_API_KEY;

    console.log(`[Notification] Speaker request: ${speakerName} for Meeting #${meeting?.number} on ${meeting?.date}`);

    if (!resendKey) {
      console.warn('Resend API key is not configured in settings or environment. Email notification skipped.');
      return NextResponse.json({ success: true, message: 'Notification logged (email skipped due to missing API key).' });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Toastmasters Club <onboarding@resend.dev>',
        to: vpedEmail,
        subject: `🚨 Speaker Request: TM ${speakerName} - Meeting #${meeting?.number}`,
        html: `
          <h3>Hello VP Education,</h3>
          <p>A new speaker slot has been requested and is pending your review.</p>
          <ul>
            <li><strong>Speaker:</strong> TM ${esc(speakerName)}</li>
            <li><strong>Meeting:</strong> #${meeting?.number}</li>
            <li><strong>Date:</strong> ${esc(meeting?.date ?? '')}</li>
          </ul>
          <p>Please open the admin panel to approve or reject this request.</p>
          <br/>
          <p>Best regards,<br/>Club Automation Bot</p>
        `,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Failed to send email via Resend:', err);
      return NextResponse.json({ success: false, error: 'Email failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in notify-vped API route:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
