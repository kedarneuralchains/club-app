# Toastmasters Roles

A lightweight, mobile-first web app for Toastmasters clubs to manage meeting role bookings, announcements, guest registrations, and post-meeting voting — without the friction of accounts, passwords, or a backend you have to run yourself.

Originally built for [Dehradun WIC India Toastmasters](https://www.toastmasters.org/find-a-club/00007185-dehradun-wic-india-toastmasters-club), and open-sourced for any club that wants the same experience.

---

## Features

- **Self-serve role booking** — members claim Speaker / Evaluator / TMoD / TTM / GE / Grammarian / Ah-Counter / Timer / Harkmaster slots from a single shareable URL. No login.
- **Role-pair rules** enforced in-UI: max 3 roles per member, TMoD solo, no double-speaker, one Auxiliary role per member.
- **Lock-on-meeting-day** — role claims freeze at the meeting's start time; meetings flip to "past" at 2 PM IST so the next one surfaces immediately.
- **WhatsApp agenda export** — one-click copy of the canonical roster message.
- **Frictionless voting** — admin opens a ballot, members vote anonymously across 5 categories (Best Speaker / Evaluator / Table Topics / Role Player / Auxiliary). Auto-closes when the voter cap is reached.
- **Guests welcome** — register at the door (name + phone + email), eligible to vote, eligible to be voted for.
- **Announcement banner** — one active club-wide message, dismissible with localStorage memory.
- **Speech details** — speakers add Pathways Path / Level / Project / Title to their booked slot, viewable by everyone.
- **Admin panel** at an unlisted URL (`/amiadmin`) — manage members, meetings, ballots, guests, announcements.

---

## Tech Stack

| Layer       | Choice                                                     |
| ----------- | ---------------------------------------------------------- |
| Framework   | [Next.js 15](https://nextjs.org/) (App Router, React 19)   |
| Styling     | [Tailwind CSS 3](https://tailwindcss.com/)                 |
| Database    | [Supabase](https://supabase.com/) (Postgres + Realtime)    |
| Auth model  | No user auth; admin URL is password-gated client-side      |
| Language    | TypeScript                                                 |
| Deployment  | [Vercel](https://vercel.com/) (zero-config)                |

---

## Architecture

Single Next.js app, single Supabase project.

- **Public page (`/`)** — meeting list, role claiming, voting, guest signup. Anonymous RLS allows reads + scoped writes (role claims, votes, guests).
- **Admin page (`/amiadmin`)** — Supabase Auth login restricted to emails in the `admins` table; RLS enforces admin-only writes.
- **Supabase Realtime** subscriptions push role-claim changes to all connected devices so the meeting card stays in sync.
- **No server-side code** beyond Next.js' default request handling. Everything that needs elevated privileges (the one-time member import) runs locally with the service-role key.

---

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com/) account
- (Optional) A [Vercel](https://vercel.com/) account for deployment

### 1. Clone and install

```bash
git clone https://github.com/kedarneuralchains/club-app.git
cd club-app
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com/) → New Project.
2. From the project dashboard, grab:
   - **Project URL** (Settings → API → Project URL)
   - **Publishable key** (Settings → API → `anon` / `publishable` key)
   - **Service role key** (Settings → API → `service_role`, only needed for the import script — keep this secret)

### 3. Set up the database

**Fresh install (recommended):** open the Supabase SQL editor, paste the contents of `supabase/schema.sql`, and run. This single file creates every table, RLS policy, function, and realtime publication the app needs.

**Upgrading an existing deployment:** apply only the un-run migrations from `supabase/migrations/`, in numeric order. The migration history is preserved for this purpose:

```
001_schema.sql              — core tables: members, meetings, role_claims + RLS
002_voting.sql              — ballots, votes, results aggregator function
003_voter_count.sql         — voter cap on ballots
004_ballot_v2.sql           — 5-category voting + Table Topics speakers + guest votees
005_vote_unique.sql         — one-vote-per-device constraint
006_delete_votes_rpc.sql    — admin-only vote deletion via SECURITY DEFINER
007_guest_announce.sql      — guest registrations + announcements
008_speech_details.sql      — Pathways Path/Level/Project/Title on speaker claims
009_members_anon_write.sql  — anon insert/update policy for members (admin panel)
```

All migrations are idempotent (`if not exists` / `or replace`), so re-running is safe.

### 4. Configure environment variables

Copy the example file and fill it in:

```bash
cp .env.local.example .env.local
```

| Variable                              | Required | Purpose                                                                 |
| ------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`            | yes      | Your Supabase project URL                                               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`| yes      | Supabase publishable (anon) key                                         |
| `SUPABASE_SERVICE_ROLE_KEY`           | no       | Only needed to run the one-time member import script. **Never commit.** |

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Seed members (optional)

If you have a club roster in an Excel file, the included importer can seed `members`:

1. Place your roster as `Club-Membership.xlsx` at the project root, or adapt the path in `scripts/import-from-excel.ts`.
2. Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`.
3. Run:
   ```bash
   npm run import
   ```

Alternatively, add members one-at-a-time from the `/amiadmin` panel.

---

## Deployment

### Vercel (recommended)

1. Push the repo to GitHub.
2. Import it into Vercel — Vercel auto-detects Next.js, no build config needed.
3. In **Project Settings → Environment Variables**, add the same four variables from `.env.local`.
4. Deploy.

The included `vercel.json` is minimal (`{ "framework": "nextjs" }`); add custom domains or redirects through the Vercel dashboard.

### Self-hosting

The app is a standard Next.js 15 App Router project — `next build && next start` runs on any Node 20+ host (Render, Railway, Fly.io, a VPS with PM2/systemd, etc.). Set the same env vars on your host.

### Hosting cost

For a club with a few dozen active members:

- **Supabase free tier** — 500 MB database, 50K monthly active users, Realtime included. Fits comfortably.
- **Vercel Hobby tier** — fine for personal/non-commercial projects. Toastmasters club use is non-commercial.

Expected monthly cost: **₹0**. Larger leagues (1000+ members, multiple clubs sharing one instance) may eventually want Supabase's Pro tier.

---

## Security Model

Members don't log in, so they can claim a role with one tap from a WhatsApp link. Admins do.

- **Admins sign in with Supabase Auth** (email + password) and must also be listed in the `admins` table. Create the user under *Authentication → Users*, then `insert into admins (email) values ('you@example.com');`. Signing up alone grants nothing.
- **Admin-only writes are enforced by RLS** via the `is_admin()` function: meetings, members, ballots, announcements and settings. Guest contact details and settings (incl. the Resend key) are readable only by admins.
- **Members sign in with their name + a 4-digit PIN** (set on first sign-in, bcrypt-hashed, 5 wrong tries → 15-minute lock; admins can reset). Sign-in returns a session token; role writes go through SECURITY DEFINER functions (`claim_role`, `release_role`, `update_speech_details`) that take the member from that token, so nobody can claim in another member's name and only the holder or an admin can release or edit a claim. Only admins can approve speakers.
- **Consent:** members accept the Terms & Privacy page (`/terms`, version in `lib/terms.ts`) when setting their PIN and again whenever `TERMS_VERSION` changes; acceptances are logged in `member_consents`. Guests tick the same box, and guest records are deleted after 6 months by a pg_cron job.
- **Rules are enforced in the database**, not just the UI: claims respect the meeting lock (start time IST), the role-pairing limits and the no-back-to-back rotation; releases lock at start time; speech details lock at 2 PM IST.
- **Votes go through `submit_votes`**: signed-in members vote once per ballot on any device; guests vote once per browser; the voter-count cap is checked server-side.
- **Membership numbers** aren't readable with the publishable key (column-level grant).
- **`/api/notify-vped`** takes only a claim id, builds the email from the database and sends at most one email per fresh pending speaker claim.
- **Vote secrecy is enforced at the database layer** — the `votes` table has no public `select` policy; results are exposed only via the `get_ballot_results` SECURITY DEFINER function which returns aggregates only.

PRs welcome.

---

## Configuration & Customization

| Aspect                         | Where to change                                                 |
| ------------------------------ | --------------------------------------------------------------- |
| Club name / branding           | `app/layout.tsx`, `components/SiteFooter.tsx`, `public/`        |
| Brand colours (maroon/navy)    | `tailwind.config.ts`                                            |
| Role list & icons              | `lib/types.ts` — `RoleKey`, `ROLE_META`, `getMeetingRoles`      |
| Role-pair rules                | `lib/utils.ts` — `roleClaimBlocked`                             |
| Meeting "past" cutoff (2 PM IST) | `lib/utils.ts` — `isMeetingPast`                              |
| WhatsApp agenda format         | `lib/utils.ts` — `buildWhatsAppAgenda`                          |
| Pathways path list             | `lib/types.ts` — `PATHS`                                        |

---

## Project Structure

```
app/
  page.tsx              — public meeting list, role claiming, voting
  amiadmin/page.tsx     — admin UI (Supabase Auth + admins allowlist)
  layout.tsx            — fonts, metadata
  globals.css           — Tailwind + utility tweaks
components/
  MeetingCard.tsx       — meeting header + theme band + role sections
  RoleSlot.tsx          — claim/release/admin-assign row + speech details
  BallotModal.tsx       — vote casting + results display
  MemberPicker.tsx      — searchable member selector + guest registration
  WhatsAppCopyButton.tsx
  SiteFooter.tsx
hooks/
  useMeetings.ts        — fetches meetings/members/ballots/announcements + realtime
lib/
  types.ts              — domain types, role metadata, Pathways constants
  utils.ts              — role-pair rules, meeting lifecycle, WhatsApp builder
scripts/
  import-from-excel.ts  — one-time member roster importer
supabase/schema.sql     — consolidated schema for fresh installs
supabase/migrations/    — historical migrations (run in order to upgrade existing DBs)
utils/supabase/         — typed client wrapper
```

---

## Contributing

Issues and pull requests are welcome. A few guidelines:

- Run `npx tsc --noEmit && npm run lint` before submitting.
- New schema changes go in a new numbered migration file (`010_*.sql`, `011_*.sql`, …) — never edit migrations that have already shipped.
- Keep the UI mobile-first; most members access this from WhatsApp on a phone.

---

## Credits

- Toastmasters International® and the Pathways program are trademarks of Toastmasters International. This project is community-built and not affiliated with or endorsed by Toastmasters International.
- Originally developed by Rishabh Shukla (VPE 2025-26, Dehradun WIC India Toastmasters Club).

---

## License

[MIT](./LICENSE) — copyright held by Dehradun WIC India Toastmasters Club and contributors.

"Toastmasters International" and "Pathways" are trademarks of Toastmasters International and are **not** covered by the MIT grant — see the trademark notice in [LICENSE](./LICENSE). Forks intending to use those marks must obtain permission from Toastmasters International directly.
