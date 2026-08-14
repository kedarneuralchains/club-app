-- ============================================================
-- Toastmasters Roles — Migration 013: Soft Delete Members
-- ============================================================
-- Adds the deleted column to members table to support preserving
-- past role claims when a member is removed from the active roster.
-- ============================================================

alter table members 
  add column if not exists deleted boolean not null default false;
