-- ============================================================
-- Raptee.HV FI Platform — Master Supabase Database Schema
-- Run this complete script in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS (Idempotent creation)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('cce', 'field_intelligence', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM (
    'pending',
    'escalated',
    'in_progress',
    'resolved',
    'not_resolved',
    'reopened'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE escalation_reason AS ENUM (
    'technical_support_required',
    'need_further_investigation',
    'others'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE action_taken AS ENUM (
    'software_update',
    'component_replacement',
    'repair_adjustment',
    'inspection_diagnosis',
    'customer_guidance',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE rnd_consultation AS ENUM (
    'completed',
    'required',
    'technical_team',
    'none',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE resolution_outcome AS ENUM (
    'fix_implemented_verified',
    'recommended_fix_pending',
    'further_investigation_required',
    'no_fix_identified',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE root_cause_confidence AS ENUM ('suspected', 'confirmed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. TIMESTAMP UPDATE FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. USER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'cce',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-sync auth.users to user_profiles on sign-up (Safe version)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    CASE 
      WHEN (new.raw_user_meta_data->>'role') = 'field_intelligence' THEN 'field_intelligence'::user_role
      WHEN (new.raw_user_meta_data->>'role') = 'admin' THEN 'admin'::user_role
      WHEN new.email = 'admin@raptee.com' THEN 'admin'::user_role
      ELSE 'cce'::user_role
    END,
    CASE
      WHEN new.email = 'admin@raptee.com' OR (new.raw_user_meta_data->>'role') = 'admin' THEN true
      ELSE false
    END
  )
  ON CONFLICT (id) DO NOTHING; -- CRITICAL: Never overwrite existing role on relogin!
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never abort auth signup on profile warning
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. COMPLAINTS (Primary Record)
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id          TEXT NOT NULL UNIQUE,
  date_of_report       DATE NOT NULL DEFAULT CURRENT_DATE,
  reported_by          UUID NOT NULL REFERENCES user_profiles(id),
  reported_by_name     TEXT NOT NULL,
  source               TEXT,
  customer_name        TEXT,
  customer_contact     TEXT,
  chassis_vin          TEXT NOT NULL,
  vehicle_model        TEXT,
  registration_number  TEXT,
  delivery_date        DATE,
  incident_problem     TEXT NOT NULL,
  issue_summary        TEXT,
  detailed_description TEXT NOT NULL,
  incident_date        DATE,
  incident_location    TEXT,
  fault_code           TEXT,
  priority             TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status                   complaint_status NOT NULL DEFAULT 'pending',
  is_escalated             BOOLEAN NOT NULL DEFAULT FALSE,
  communicated_to_customer BOOLEAN NOT NULL DEFAULT FALSE,
  communicated_at          TIMESTAMPTZ,
  communicated_by          UUID REFERENCES user_profiles(id),
  communicated_by_name     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS complaints_updated_at ON complaints;
CREATE TRIGGER complaints_updated_at
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate incident_id (CI-YYYY-XXXX)
CREATE SEQUENCE IF NOT EXISTS complaint_incident_seq START 1;

CREATE OR REPLACE FUNCTION generate_incident_id()
RETURNS TRIGGER AS $$
DECLARE
  current_yr TEXT;
  seq_num INT;
BEGIN
  IF NEW.incident_id IS NULL OR NEW.incident_id = '' THEN
    current_yr := TO_CHAR(NOW(), 'YYYY');
    seq_num := nextval('complaint_incident_seq');
    NEW.incident_id := 'CI-' || current_yr || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_incident_id ON complaints;
CREATE TRIGGER set_incident_id
  BEFORE INSERT ON complaints
  FOR EACH ROW EXECUTE FUNCTION generate_incident_id();

CREATE INDEX IF NOT EXISTS idx_complaints_incident_id ON complaints(incident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_chassis_vin ON complaints(chassis_vin);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_date_of_report ON complaints(date_of_report);
CREATE INDEX IF NOT EXISTS idx_complaints_reported_by ON complaints(reported_by);

-- ============================================================
-- 6. ESCALATIONS (Module 4)
-- ============================================================
CREATE TABLE IF NOT EXISTS escalations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id     UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  reason           escalation_reason NOT NULL,
  specify_reason   TEXT,
  remarks          TEXT,
  escalated_by     UUID NOT NULL REFERENCES user_profiles(id),
  escalated_by_name TEXT NOT NULL,
  escalated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(complaint_id)
);

CREATE INDEX IF NOT EXISTS idx_escalations_complaint_id ON escalations(complaint_id);
CREATE INDEX IF NOT EXISTS idx_escalations_escalated_at ON escalations(escalated_at);

-- ============================================================
-- 7. CCE RESOLUTIONS (Module 3)
-- ============================================================
CREATE TABLE IF NOT EXISTS cce_resolutions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id     UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  action_taken     action_taken NOT NULL,
  details_of_action TEXT,
  resolution_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  closure_notes    TEXT,
  resolved_by      UUID NOT NULL REFERENCES user_profiles(id),
  resolved_by_name TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(complaint_id)
);

CREATE INDEX IF NOT EXISTS idx_cce_resolutions_complaint_id ON cce_resolutions(complaint_id);

-- ============================================================
-- 8. FI INVESTIGATIONS (Module 6)
-- ============================================================
CREATE TABLE IF NOT EXISTS fi_investigations (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id             UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  investigation_findings   TEXT NOT NULL,
  root_cause               TEXT NOT NULL,
  root_cause_confidence    root_cause_confidence,
  recommended_solution     TEXT NOT NULL DEFAULT '',
  rnd_consultation         rnd_consultation NOT NULL,
  consultation_details     TEXT,
  resolution_outcome       resolution_outcome NOT NULL,
  additional_notes         TEXT,
  submitted_by             UUID NOT NULL REFERENCES user_profiles(id),
  submitted_by_name        TEXT NOT NULL,
  submitted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(complaint_id)
);

DROP TRIGGER IF EXISTS fi_investigations_updated_at ON fi_investigations;
CREATE TRIGGER fi_investigations_updated_at
  BEFORE UPDATE ON fi_investigations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_fi_investigations_complaint_id ON fi_investigations(complaint_id);

-- ============================================================
-- 9. COMPLAINT HISTORY (Audit Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS complaint_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id     UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  previous_status  complaint_status,
  new_status       complaint_status,
  actor_id         UUID NOT NULL REFERENCES user_profiles(id),
  actor_name       TEXT NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_history_complaint_id ON complaint_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_history_created_at ON complaint_history(created_at);

-- ============================================================
-- 10. ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id      UUID REFERENCES complaints(id) ON DELETE CASCADE,
  investigation_id  UUID REFERENCES fi_investigations(id) ON DELETE CASCADE,
  storage_path      TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  file_size         BIGINT NOT NULL,
  uploaded_by       UUID NOT NULL REFERENCES user_profiles(id),
  uploaded_by_name  TEXT NOT NULL,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (complaint_id IS NOT NULL OR investigation_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_attachments_complaint_id ON attachments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_attachments_investigation_id ON attachments(investigation_id);

-- ============================================================
-- 11. KNOWLEDGE BASE
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_base (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_dataset       TEXT NOT NULL,
  source_file          TEXT,
  source_sheet         TEXT,
  source_row_id        TEXT,
  historical_ref_id    TEXT,
  fault_code           TEXT,
  issue_description    TEXT,
  vehicle_model        TEXT,
  component            TEXT,
  root_cause           TEXT,
  corrective_action    TEXT,
  investigation_outcome TEXT,
  original_date        DATE,
  import_batch         TEXT,
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_fault_code ON knowledge_base(fault_code);
CREATE INDEX IF NOT EXISTS idx_kb_vehicle_model ON knowledge_base(vehicle_model);
CREATE INDEX IF NOT EXISTS idx_kb_source_dataset ON knowledge_base(source_dataset);

-- ============================================================
-- 12. CUSTOMER VEHICLES (Imported via Excel for Auto-mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_vehicles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chassis_vin         TEXT NOT NULL UNIQUE,
  customer_name       TEXT,
  customer_contact    TEXT,
  vehicle_model       TEXT,
  registration_number TEXT,
  delivery_date       DATE,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS customer_vehicles_updated_at ON customer_vehicles;
CREATE TRIGGER customer_vehicles_updated_at
  BEFORE UPDATE ON customer_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_customer_vehicles_vin ON customer_vehicles (chassis_vin);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_name ON customer_vehicles (customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_contact ON customer_vehicles (customer_contact);

-- ============================================================
-- 13. DYNAMIC PROBLEM CATEGORIES (FI Controlled)
-- ============================================================
CREATE TABLE IF NOT EXISTS problem_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_categories_active ON problem_categories (is_active);

-- Seed Initial Categories
INSERT INTO problem_categories (name) VALUES
  ('Vehicle not turning ON'),
  ('Charging issue'),
  ('App login issue'),
  ('Error code issue'),
  ('Display not working'),
  ('BMS issue'),
  ('App connectivity issue'),
  ('Unexpected shutdown'),
  ('Regenerative braking failure'),
  ('Throttle response delayed'),
  ('Fast charging communication timeout'),
  ('High voltage isolation warning'),
  ('Motor Vibration / Unusual Noise'),
  ('Keyless Start / Smart Key Failure'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 14. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================
ALTER TABLE user_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints        ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cce_resolutions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fi_investigations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_categories ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- user_profiles policies
DROP POLICY IF EXISTS "Authenticated users read profiles" ON user_profiles;
CREATE POLICY "Authenticated users read profiles"
  ON user_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow profile insert" ON user_profiles;
CREATE POLICY "Allow profile insert"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- complaints policies
DROP POLICY IF EXISTS "Authenticated users read complaints" ON complaints;
CREATE POLICY "Authenticated users read complaints"
  ON complaints FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users create complaints" ON complaints;
CREATE POLICY "Authenticated users create complaints"
  ON complaints FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update complaints" ON complaints;
CREATE POLICY "Users can update complaints"
  ON complaints FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- escalations policies
DROP POLICY IF EXISTS "Authenticated users read escalations" ON escalations;
CREATE POLICY "Authenticated users read escalations"
  ON escalations FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users create escalations" ON escalations;
CREATE POLICY "Authenticated users create escalations"
  ON escalations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users update escalations" ON escalations;
CREATE POLICY "Authenticated users update escalations"
  ON escalations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- cce_resolutions policies
DROP POLICY IF EXISTS "Authenticated users read cce_resolutions" ON cce_resolutions;
CREATE POLICY "Authenticated users read cce_resolutions"
  ON cce_resolutions FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users create resolutions" ON cce_resolutions;
CREATE POLICY "Authenticated users create resolutions"
  ON cce_resolutions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- fi_investigations policies
DROP POLICY IF EXISTS "Authenticated users read fi_investigations" ON fi_investigations;
CREATE POLICY "Authenticated users read fi_investigations"
  ON fi_investigations FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users create investigations" ON fi_investigations;
CREATE POLICY "Authenticated users create investigations"
  ON fi_investigations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users update investigations" ON fi_investigations;
CREATE POLICY "Authenticated users update investigations"
  ON fi_investigations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- complaint_history policies
DROP POLICY IF EXISTS "Authenticated users read history" ON complaint_history;
CREATE POLICY "Authenticated users read history"
  ON complaint_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users append history" ON complaint_history;
CREATE POLICY "Authenticated users append history"
  ON complaint_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- attachments policies
DROP POLICY IF EXISTS "Authenticated users read attachments" ON attachments;
CREATE POLICY "Authenticated users read attachments"
  ON attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users upload attachments" ON attachments;
CREATE POLICY "Authenticated users upload attachments"
  ON attachments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- knowledge_base policies
DROP POLICY IF EXISTS "Authenticated users read knowledge base" ON knowledge_base;
CREATE POLICY "Authenticated users read knowledge base"
  ON knowledge_base FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users manage knowledge base" ON knowledge_base;
CREATE POLICY "Authenticated users manage knowledge base"
  ON knowledge_base FOR ALL
  USING (auth.uid() IS NOT NULL);

-- customer_vehicles policies
DROP POLICY IF EXISTS "Authenticated users read customer vehicles" ON customer_vehicles;
CREATE POLICY "Authenticated users read customer vehicles"
  ON customer_vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users insert customer vehicles" ON customer_vehicles;
CREATE POLICY "Authenticated users insert customer vehicles"
  ON customer_vehicles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users update customer vehicles" ON customer_vehicles;
CREATE POLICY "Authenticated users update customer vehicles"
  ON customer_vehicles FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- problem_categories policies
DROP POLICY IF EXISTS "Authenticated users read problem categories" ON problem_categories;
CREATE POLICY "Authenticated users read problem categories"
  ON problem_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users insert problem categories" ON problem_categories;
CREATE POLICY "Authenticated users insert problem categories"
  ON problem_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users update problem categories" ON problem_categories;
CREATE POLICY "Authenticated users update problem categories"
  ON problem_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users delete problem categories" ON problem_categories;
CREATE POLICY "Authenticated users delete problem categories"
  ON problem_categories FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 15. STORAGE BUCKETS (Run in SQL Editor or Storage UI)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) 
  VALUES ('complaint-attachments', 'complaint-attachments', TRUE)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('fi-evidence', 'fi-evidence', TRUE)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('kb-imports', 'kb-imports', TRUE)
  ON CONFLICT (id) DO NOTHING;
