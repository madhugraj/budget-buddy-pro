-- Create function to set initial password using one-time token
CREATE OR REPLACE FUNCTION public.set_mc_initial_password(p_token text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.mc_users%ROWTYPE;
BEGIN
  -- Find user with valid, non-expired token
  SELECT * INTO v_user
  FROM public.mc_users
  WHERE password_reset_token = p_token
    AND status = 'approved'
    AND password_reset_expires_at > now()
    AND password_hash IS NULL -- Ensure password not already set
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Set the password hash and clear the token
  UPDATE public.mc_users
  SET
    password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    password_reset_token = NULL,
    password_reset_expires_at = NULL,
    temp_password = NULL,
    updated_at = now()
  WHERE id = v_user.id;

  RETURN true;
END;
$function$;