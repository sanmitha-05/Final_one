-- ============================================================
-- RAPTEE.HV — Migration v3: Escalated Resolution & Customer Communication
-- Run this in: Supabase Dashboard > SQL Editor > Run
-- Adds:
--   1. is_escalated: Tracks if a complaint went through FI escalation
--   2. communicated_to_customer: Filled by CCE for resolved complaints
-- ============================================================

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS communicated_to_customer BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS communicated_at TIMESTAMPTZ;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS communicated_by UUID REFERENCES user_profiles(id);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS communicated_by_name TEXT;

-- Retroactively mark any complaints that have escalation history or were escalated
UPDATE complaints 
SET is_escalated = TRUE 
WHERE id IN (SELECT complaint_id FROM escalations)
   OR status IN ('escalated', 'in_progress');

-- Index for fast status & communication filtering
CREATE INDEX IF NOT EXISTS idx_complaints_escalated ON complaints(is_escalated);
CREATE INDEX IF NOT EXISTS idx_complaints_communicated ON complaints(communicated_to_customer);
