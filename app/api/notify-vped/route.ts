import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { speakerName, meetingNumber, date } = await request.json();

    // Create Supabase client using service role key if available
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

    // Fetch configurations from settings table
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value');

    const settingsMap = new Map((settingsData || []).map(s => [s.key, s.value]));

    const vpedEmail = settingsMap.get('vped_email') || 'parastiwari013@gmail.com';
    const dbResendKey = settingsMap.get('resend_api_key');
    const resendKey = dbResendKey || process.env.RESEND_API_KEY;

    console.log(`[Notification] Speaker request: ${speakerName} for Meeting #${meetingNumber} on ${date}`);
    console.log(`[Notification] Sending to VPED at ${vpedEmail}`);

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
        subject: `🚨 Speaker Request: TM ${speakerName} - Meeting #${meetingNumber}`,
        html: `
          <h3>Hello VP Education,</h3>
          <p>A new speaker slot has been requested and is pending your review.</p>
          <ul>
            <li><strong>Speaker:</strong> TM ${speakerName}</li>
            <li><strong>Meeting:</strong> #${meetingNumber}</li>
            <li><strong>Date:</strong> ${date}</li>
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
      return NextResponse.json({ success: false, error: err }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in notify-vped API route:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
