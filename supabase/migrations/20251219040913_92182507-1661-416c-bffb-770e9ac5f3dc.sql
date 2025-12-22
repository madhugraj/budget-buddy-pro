-- Ensure required crypto helpers for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tighten RLS on mc_users: no direct SELECT/UPDATE for unauthenticated users
ALTER TABLE public.mc_users ENABLE ROW LEVEL SECURITY;

-- Drop unsafe / non-working policies (if present)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mc_users' AND policyname='MC users can update own password') THEN
    DROP POLICY "MC users can update own password" ON public.mc_users;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mc_users' AND policyname='MC users can view own record') THEN
    DROP POLICY "MC users can view own record" ON public.mc_users;
  END IF;
END $$;

-- Ensure a safe public registration policy exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mc_users' AND policyname='Anyone can register as MC'
  ) THEN
    CREATE POLICY "Anyone can register as MC"
    ON public.mc_users
    FOR INSERT
    TO anon
    WITH CHECK (status = 'pending');
  END IF;
END $$;

-- Treasurer policies (keep or create)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mc_users' AND policyname='Treasurers can view all MC users'
  ) THEN
    CREATE POLICY "Treasurers can view all MC users"
    ON public.mc_users
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'treasurer'::public.user_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mc_users' AND policyname='Treasurers can update MC users'
  ) THEN
    CREATE POLICY "Treasurers can update MC users"
    ON public.mc_users
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'treasurer'::public.user_role));
  END IF;
END $$;

-- RPC: verify_mc_login
DROP FUNCTION IF EXISTS public.verify_mc_login(text, text);
CREATE OR REPLACE FUNCTION public.verify_mc_login(

  p_username text,
  p_password text
)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  login_username text,
  interest_groups text[],
  status text,
  needs_password_change boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    u.login_username,
    u.interest_groups,
    u.status,
    (u.password_hash IS NULL) AS needs_password_change
  FROM public.mc_users u
  WHERE u.login_username = p_username
    AND u.status = 'approved'
    AND (
      (u.password_hash IS NOT NULL AND crypt(p_password, u.password_hash) = u.password_hash)
      OR
      (u.password_hash IS NULL AND u.temp_password IS NOT NULL AND p_password = u.temp_password)
    )
  LIMIT 1;
END;
$$;

-- RPC: update_mc_password
DROP FUNCTION IF EXISTS public.update_mc_password(text, text, text);
CREATE OR REPLACE FUNCTION public.update_mc_password(

  p_username text,
  p_old_password text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.mc_users%ROWTYPE;
BEGIN
  SELECT * INTO v_user
  FROM public.mc_users
  WHERE login_username = p_username
    AND status = 'approved'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_user.password_hash IS NOT NULL THEN
    IF crypt(p_old_password, v_user.password_hash) <> v_user.password_hash THEN
      RETURN false;
    END IF;
  ELSE
    IF v_user.temp_password IS NULL OR p_old_password <> v_user.temp_password THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.mc_users
  SET
    password_hash = crypt(p_new_password, gen_salt('bf')),
    temp_password = NULL,
    updated_at = now()
  WHERE id = v_user.id;

  RETURN true;
END;
$$;

-- Allow public to call the RPCs
GRANT EXECUTE ON FUNCTION public.verify_mc_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_mc_password(text, text, text) TO anon;
