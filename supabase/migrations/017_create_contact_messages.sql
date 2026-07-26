-- Create contact_messages table
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but don't add public policies (only service_role/admin should access)
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow admins to read contact messages
CREATE POLICY "Admins can view contact messages" 
ON public.contact_messages FOR SELECT 
USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin'));

-- Allow admins to update contact messages (e.g. mark as read)
CREATE POLICY "Admins can update contact messages" 
ON public.contact_messages FOR UPDATE 
USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin'));

-- Allow admins to delete contact messages
CREATE POLICY "Admins can delete contact messages" 
ON public.contact_messages FOR DELETE 
USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin'));
