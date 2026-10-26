-- ============================================================
-- Raptee.HV FI Platform — Fix Role Reset on Relogin
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Drop the trigger that was firing on UPDATE (relogin updates last_sign_in_at!)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Update handle_new_user() to NEVER overwrite existing user profiles
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
  -- DO NOTHING on conflict! Never reset role or active status of existing users!
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

-- 3. Re-attach the trigger ONLY on INSERT (when new account is registered)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Restore/set Admin role for admin accounts
UPDATE public.user_profiles
SET role = 'admin', is_active = true
WHERE email IN ('admin@raptee.com', 'sanmitha@raptee.com');

-- Also sync auth metadata so auth.users matches
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email IN ('admin@raptee.com', 'sanmitha@raptee.com');

-- 5. Diagnostic check — see your current user profiles and their roles
SELECT id, email, full_name, role, is_active FROM public.user_profiles;
