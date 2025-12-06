-- Add office_assistant to user_role enum (must be separate transaction)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'office_assistant';