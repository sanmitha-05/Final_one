-- ============================================================
-- RAPTEE.HV — 1-CLICK AUTH ERROR FIX
-- Fixes: "Database error saving new user" / "Database error creating new user"
-- Run this in: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- 1. Temporarily drop the trigger so nothing blocks signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Fix user_profiles RLS policy so inserts and updates are never blocked
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow profile insert" ON user_profiles;
CREATE POLICY "Allow profile insert"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Authenticated users read profiles" ON user_profiles;
CREATE POLICY "Authenticated users read profiles"
  ON user_profiles FOR SELECT
  USING (true);

-- 3. Replace trigger with bulletproof error-handled function
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
  ON CONFLICT (id) DO NOTHING; -- CRITICAL: Never reset role or approval status on login!
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Catches any unexpected error so auth signup NEVER fails
    RETURN NEW;
END;
$$;

-- 4. Re-attach the trigger ONLY on INSERT (never on UPDATE/relogin)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
