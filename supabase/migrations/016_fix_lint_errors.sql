-- Migration 016: Fix Lint Errors
-- 1. Fix RLS policies that are always true by restricting them to the service_role
-- 2. Fix pg_graphql exposures by revoking graphql schema usage for anon and authenticated roles

DO $$
BEGIN
    -- email_otps
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_otps' AND policyname = 'Service role only') THEN
        DROP POLICY "Service role only" ON public.email_otps;
        CREATE POLICY "Service role only" ON public.email_otps FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- user_profiles
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Service role full access profiles') THEN
        DROP POLICY "Service role full access profiles" ON public.user_profiles;
        CREATE POLICY "Service role full access profiles" ON public.user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- users
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Service role full access') THEN
        DROP POLICY "Service role full access" ON public.users;
        CREATE POLICY "Service role full access" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- transports
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transports' AND policyname = 'Allow all for service role') THEN
        DROP POLICY "Allow all for service role" ON public.transports;
        CREATE POLICY "Allow all for service role" ON public.transports FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- notifications
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow all for service role') THEN
        DROP POLICY "Allow all for service role" ON public.notifications;
        CREATE POLICY "Allow all for service role" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- push_subscriptions
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Allow all for service role') THEN
        DROP POLICY "Allow all for service role" ON public.push_subscriptions;
        CREATE POLICY "Allow all for service role" ON public.push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- support_tickets
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Allow all for service role') THEN
        DROP POLICY "Allow all for service role" ON public.support_tickets;
        CREATE POLICY "Allow all for service role" ON public.support_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Fix GraphQL anon and authenticated table exposed lint warnings
-- The project does not use GraphQL, so revoking access to the graphql schema for anon and authenticated roles.
REVOKE USAGE ON SCHEMA graphql FROM PUBLIC;
REVOKE USAGE ON SCHEMA graphql FROM anon;
REVOKE USAGE ON SCHEMA graphql FROM authenticated;
