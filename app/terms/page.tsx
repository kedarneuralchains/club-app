import Link from 'next/link';
import type { Metadata } from 'next';
import { PRIVACY_CONTACT, TERMS_VERSION } from '@/lib/terms';

export const metadata: Metadata = {
  title: 'Terms & Privacy — Dehradun WIC India Toastmasters Club',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-lg font-bold text-stone-900">{title}</h2>
      <div className="text-sm text-stone-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const c = PRIVACY_CONTACT;
  return (
    <div className="min-h-screen bg-navy-600 py-6 px-4">
      <article className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-6 space-y-6">
        <header>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Terms &amp; Privacy</h1>
          <p className="text-xs text-stone-400 mt-1">
            Dehradun WIC India Toastmasters Club · Version {TERMS_VERSION}
          </p>
        </header>

        <Section title="What this app is for">
          <p>
            This app is run by the club&apos;s officers to organise our meetings: members sign up for
            meeting roles, we publish the agenda, and we run the meeting&apos;s votes. It is not run by
            Toastmasters International.
          </p>
        </Section>

        <Section title="What we collect and why">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Members:</strong> your name, display name and Toastmasters membership number
              (from the club roster), the roles you take, your speech details (path, level,
              project, title) and the date you accepted these terms. Used to run meetings and keep
              the club&apos;s meeting history.
            </li>
            <li>
              <strong>Your PIN:</strong> stored only in scrambled (hashed) form — nobody, including
              the officers, can read it. Used only to confirm it&apos;s you when you take or change a role.
            </li>
            <li>
              <strong>Guests:</strong> name (optional), phone number and email. Used only to follow
              up about your visit and invite you to future meetings.
            </li>
            <li>
              <strong>Votes</strong> are secret: each vote is stored with a random ID for your
              browser (to stop double-voting) and your member ID (to stop self-votes). The app
              never shows individual votes to anyone — only the winners are announced.
            </li>
          </ul>
          <p>We don&apos;t sell or share your data, and we don&apos;t use it for advertising.</p>
        </Section>

        <Section title="Who can see it">
          <p>
            Member names, the roles they hold and speech details appear on the meeting pages, which
            anyone with the link can see. Guest contact details, PINs and the consent log are visible
            only to the club&apos;s admins. Data is stored with our service providers Supabase
            (database) and Vercel (hosting), who process it on our behalf.
          </p>
        </Section>

        <Section title="How long we keep it">
          <ul className="list-disc pl-5 space-y-1">
            <li>Guest details are deleted automatically after 6 months.</li>
            <li>
              Member details are kept while you&apos;re a member. Your past roles stay in the
              club&apos;s meeting history; if you leave and ask us to, we will remove your name from it.
            </li>
          </ul>
        </Section>

        <Section title="Your rights">
          <p>
            Under India&apos;s Digital Personal Data Protection Act, 2023 you can ask us what data we
            hold about you, ask us to correct or delete it, withdraw your consent, and raise a
            complaint. Withdrawing consent means you won&apos;t be able to take roles through the app,
            but the VPEd can still assign them for you.
          </p>
          <p>
            Contact: <strong>{c.name}</strong>, {c.role} —{' '}
            <a href={`mailto:${c.email}`} className="text-maroon-700 underline">{c.email}</a>
            {' '}or <a href={c.whatsapp} className="text-maroon-700 underline">WhatsApp {c.phone}</a>.
            We&apos;ll reply within 7 days. If you&apos;re not satisfied, you can complain to the Data
            Protection Board of India.
          </p>
        </Section>

        <Section title="Using the app fairly">
          <ul className="list-disc pl-5 space-y-1">
            <li>Only sign in as yourself, and keep your PIN to yourself.</li>
            <li>Take roles you intend to perform; release them early if your plans change.</li>
            <li>Admins may reassign or release roles to keep meetings running.</li>
          </ul>
        </Section>

        <Link href="/" className="inline-block text-sm text-maroon-700 font-medium hover:underline">
          ← Back to meetings
        </Link>
      </article>
    </div>
  );
}
