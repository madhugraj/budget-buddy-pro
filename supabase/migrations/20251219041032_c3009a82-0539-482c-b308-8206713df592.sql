-- Recreate verify_mc_login with an expanded return type (required for MC dashboard)
DROP FUNCTION IF EXISTS public.verify_mc_login(text, text);

CREATE FUNCTION public.verify_mc_login(
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
      (u.password_hash IS NOT NULL AND crypt(p_password, u.password_hash) = u.password_hash)
      OR
      (u.password_hash IS NULL AND u.temp_password IS NOT NULL AND p_password = u.temp_password)
    )
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_mc_login(text, text) TO anon;
