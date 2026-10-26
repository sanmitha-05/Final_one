-- ============================================================
-- Raptee.HV FI Platform — Fix customer_vehicles table
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Create table if it doesn't exist
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

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_vin     ON customer_vehicles (chassis_vin);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_name    ON customer_vehicles (customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_contact ON customer_vehicles (customer_contact);

-- 3. Enable RLS
ALTER TABLE customer_vehicles ENABLE ROW LEVEL SECURITY;

-- 4. DROP old policies and re-create clean ones
DROP POLICY IF EXISTS "Authenticated users can read customer vehicles"   ON customer_vehicles;
DROP POLICY IF EXISTS "Authenticated users can insert customer vehicles" ON customer_vehicles;
DROP POLICY IF EXISTS "Authenticated users can update customer vehicles" ON customer_vehicles;
DROP POLICY IF EXISTS "Authenticated users read customer vehicles"       ON customer_vehicles;
DROP POLICY IF EXISTS "Authenticated users insert customer vehicles"     ON customer_vehicles;
DROP POLICY IF EXISTS "Authenticated users update customer vehicles"     ON customer_vehicles;

-- SELECT: any logged-in user can read
CREATE POLICY "cv_select" ON customer_vehicles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: any logged-in user can insert
CREATE POLICY "cv_insert" ON customer_vehicles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: any logged-in user can update
CREATE POLICY "cv_update" ON customer_vehicles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 5. Quick diagnostic — shows how many rows are in the table
SELECT COUNT(*) AS total_vehicles FROM customer_vehicles;
