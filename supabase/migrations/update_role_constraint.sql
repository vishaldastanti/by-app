-- 1. Drop the existing strict role constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Add the new constraint allowing the new admin roles
-- By using 'approval_manager' (16 chars), we stay within the VARCHAR(20) limit
-- and avoid having to drop any RLS policies!
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'superadmin', 
    'admin', 
    'provider', 
    'traveller', 
    'content_manager', 
    'approval_manager'
  )
);
