-- ============================================================
-- Toastmasters Roles — Migration 014: Private guests & settings
-- ============================================================
-- Guest phone/email and the Resend API key were readable by anyone
-- holding the public (publishable) key, which ships in the browser
-- bundle. Remove anon read/write; the admin panel now goes through
-- /api/admin/* routes that use the service-role key.
--
-- Guests can still register (anon INSERT on guest_registrations stays).
-- ============================================================

drop policy if exists "public read guest_registrations" on guest_registrations;

drop policy if exists "public read settings"   on settings;
drop policy if exists "public write settings"  on settings;
drop policy if exists "public update settings" on settings;
