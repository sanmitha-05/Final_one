-- ============================================================
-- RAPTEE.HV — 1-CLICK INSTANT USER SEEDING SCRIPT
-- Run this in: Supabase Dashboard > SQL Editor > Run
-- This script creates the 3 official Raptee accounts directly in the database
-- with pre-confirmed emails and active profiles.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Insert/Update ADMIN User (admin@raptee.com / Password: Admin@123)
DO $$
DECLARE
  v_admin_id UUID := uuid_generate_v4();
BEGIN
  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@raptee.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-00-00-00-00-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@raptee.com',
      crypt('Admin@123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Administrator","role":"admin"}',
      NOW(),
      NOW()
    );
  ELSE
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@raptee.com';
    UPDATE auth.users
    SET encrypted_password = crypt('Admin@123', gen_salt('bf')),
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_admin_id;
  END IF;

  -- Create or activate user_profiles row
  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (
    v_admin_id,
    'admin@raptee.com',
    'Administrator',
    'admin'::user_role,
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin'::user_role,
        is_active = true,
        full_name = 'Administrator';
END $$;

-- 2. Insert/Update SANMITHA V (sanmitha@raptee.com / Password: Sanmitha@123)
DO $$
DECLARE
  v_fi_id UUID := uuid_generate_v4();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sanmitha@raptee.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-00-00-00-00-000000000000',
      v_fi_id,
      'authenticated',
      'authenticated',
      'sanmitha@raptee.com',
      crypt('Sanmitha@123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Sanmitha V","role":"field_intelligence"}',
      NOW(),
      NOW()
    );
  ELSE
    SELECT id INTO v_fi_id FROM auth.users WHERE email = 'sanmitha@raptee.com';
    UPDATE auth.users
    SET encrypted_password = crypt('Sanmitha@123', gen_salt('bf')),
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_fi_id;
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (
    v_fi_id,
    'sanmitha@raptee.com',
    'Sanmitha V',
    'field_intelligence'::user_role,
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET role = 'field_intelligence'::user_role,
        is_active = true,
        full_name = 'Sanmitha V';
END $$;

-- 3. Insert/Update RADHIKA S (radhika@raptee.com / Password: Radhika@123)
DO $$
DECLARE
  v_cce_id UUID := uuid_generate_v4();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'radhika@raptee.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-00-00-00-00-000000000000',
      v_cce_id,
      'authenticated',
      'authenticated',
      'radhika@raptee.com',
      crypt('Radhika@123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Radhika S","role":"cce"}',
      NOW(),
      NOW()
    );
  ELSE
    SELECT id INTO v_cce_id FROM auth.users WHERE email = 'radhika@raptee.com';
    UPDATE auth.users
    SET encrypted_password = crypt('Radhika@123', gen_salt('bf')),
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_cce_id;
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (
    v_cce_id,
    'radhika@raptee.com',
    'Radhika S',
    'cce'::user_role,
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET role = 'cce'::user_role,
        is_active = true,
        full_name = 'Radhika S';
END $$;
