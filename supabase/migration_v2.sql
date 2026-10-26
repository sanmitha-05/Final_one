-- ============================================================
-- Raptee.HV FI Platform — Migration v2
-- Run this script in: Supabase Dashboard > SQL Editor
-- Adds:
--   1. customer_vehicles: Table for imported customer Excel records
--   2. problem_categories: Dynamic table for FI to add/remove problem categories
--   3. Updated RLS policies and seed categories
-- ============================================================

-- 1. CUSTOMER VEHICLES TABLE (Module 1 Auto-Mapping via Excel)
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

-- Trigger for customer_vehicles updated_at
DROP TRIGGER IF EXISTS customer_vehicles_updated_at ON customer_vehicles;
CREATE TRIGGER customer_vehicles_updated_at
  BEFORE UPDATE ON customer_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for instant chassis lookups
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_vin ON customer_vehicles (chassis_vin);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_name ON customer_vehicles (customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_contact ON customer_vehicles (customer_contact);

-- 2. DYNAMIC PROBLEM CATEGORIES (FI Controlled)
CREATE TABLE IF NOT EXISTS problem_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_categories_active ON problem_categories (is_active);

-- 3. ENABLE RLS
ALTER TABLE customer_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_categories ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR CUSTOMER VEHICLES
DROP POLICY IF EXISTS "Authenticated users can read customer vehicles" ON customer_vehicles;
CREATE POLICY "Authenticated users can read customer vehicles"
  ON customer_vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert customer vehicles" ON customer_vehicles;
CREATE POLICY "Authenticated users can insert customer vehicles"
  ON customer_vehicles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update customer vehicles" ON customer_vehicles;
CREATE POLICY "Authenticated users can update customer vehicles"
  ON customer_vehicles FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 5. RLS POLICIES FOR PROBLEM CATEGORIES
DROP POLICY IF EXISTS "Authenticated users can read problem categories" ON problem_categories;
CREATE POLICY "Authenticated users can read problem categories"
  ON problem_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "FI and Admin can insert problem categories" ON problem_categories;
CREATE POLICY "FI and Admin can insert problem categories"
  ON problem_categories FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('field_intelligence', 'admin')
    )
  );

DROP POLICY IF EXISTS "FI and Admin can update problem categories" ON problem_categories;
CREATE POLICY "FI and Admin can update problem categories"
  ON problem_categories FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('field_intelligence', 'admin')
    )
  );

DROP POLICY IF EXISTS "FI and Admin can delete problem categories" ON problem_categories;
CREATE POLICY "FI and Admin can delete problem categories"
  ON problem_categories FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('field_intelligence', 'admin')
    )
  );

-- 6. SEED INITIAL PROBLEM CATEGORIES
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
