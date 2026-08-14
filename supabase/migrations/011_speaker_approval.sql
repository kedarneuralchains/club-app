-- ============================================================
-- Toastmasters Roles — Migration 011: Speaker Claim Approval
-- ============================================================
-- Adds approval_status column to role_claims to support a manual
-- confirmation flow for prepared speaker roles.
-- ============================================================

alter table role_claims 
  add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('pending', 'approved'));
