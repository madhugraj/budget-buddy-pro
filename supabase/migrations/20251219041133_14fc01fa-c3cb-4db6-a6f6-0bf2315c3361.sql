-- Fix pgcrypto function resolution (pgcrypto is installed into the "extensions" schema)

CREATE OR REPLACE FUNCTION public.verify_mc_login(
  p_username text,
  p_password text
)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  login_username text,
  tower_no text,
  unit_no text,
  photo_url text,
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
    u.tower_no,
    u.unit_no,
    u.photo_url,
    u.interest_groups,
    u.status,
    (u.password_hash IS NULL) AS needs_password_change
  FROM public.mc_users u
  WHERE u.login_username = p_username
    AND u.status = 'approved'
    AND (
      (u.password_hash IS NOT NULL AND extensions.crypt(p_password, u.password_hash) = u.password_hash)
      OR
      (u.password_hash IS NULL AND u.temp_password IS NOT NULL AND p_password = u.temp_password)
    )
  LIMIT 1;
END;
$$;

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
    IF extensions.crypt(p_old_password, v_user.password_hash) <> v_user.password_hash THEN
      RETURN false;
    END IF;
  ELSE
    IF v_user.temp_password IS NULL OR p_old_password <> v_user.temp_password THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.mc_users
  SET
    password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    temp_password = NULL,
    updated_at = now()
  WHERE id = v_user.id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_mc_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_mc_password(text, text, text) TO anon;
