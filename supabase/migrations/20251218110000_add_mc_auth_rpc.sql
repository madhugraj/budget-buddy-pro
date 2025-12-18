-- Add RPC functions for secure MC login and password management bypassing RLS for login checks
CREATE OR REPLACE FUNCTION public.verify_mc_login(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    tower_no TEXT,
    unit_no TEXT,
    interest_groups TEXT[],
    photo_url TEXT,
    needs_password_change BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id, 
        m.name, 
        m.email, 
        m.tower_no, 
        m.unit_no, 
        m.interest_groups, 
        m.photo_url,
        (m.temp_password IS NOT NULL AND m.temp_password = p_password)
    FROM mc_users m
    WHERE m.login_username = p_username
    AND m.status = 'approved'
    AND (m.password_hash = p_password OR m.temp_password = p_password);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_mc_password(p_username TEXT, p_old_password TEXT, p_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE mc_users
    SET password_hash = p_new_password,
        temp_password = NULL,
        updated_at = NOW()
    WHERE login_username = p_username
    AND status = 'approved'
    AND (password_hash = p_old_password OR (temp_password IS NOT NULL AND temp_password = p_old_password));
    
    RETURN FOUND;
END;
$$;
