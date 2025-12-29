-- Migration: Auto-create tenant for new users and backfill existing users
-- Description: Updates the handle_new_user trigger to automatically create a personal tenant
--              for each new user, and backfills existing users with tenants

-- Step 1: Backfill existing users with personal tenants
DO $$
DECLARE
    user_record RECORD;
    new_tenant_id UUID;
    user_email TEXT;
BEGIN
    -- Loop through all profiles without a tenant_id
    FOR user_record IN 
        SELECT p.id, u.email 
        FROM profiles p
        JOIN auth.users u ON p.id = u.id
        WHERE p.tenant_id IS NULL
    LOOP
        user_email := user_record.email;
        
        -- Create a new tenant for this user
        INSERT INTO tenants (name)
        VALUES (user_email || ' Organization')
        RETURNING id INTO new_tenant_id;
        
        -- Update the profile with the new tenant_id and change role to owner
        UPDATE profiles
        SET tenant_id = new_tenant_id,
            role = 'owner',
            updated_at = NOW()
        WHERE id = user_record.id;
        
        RAISE NOTICE 'Created tenant % for user %', new_tenant_id, user_email;
    END LOOP;
END $$;

-- Step 2: Update the handle_new_user function to auto-create tenants
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID;
    user_email TEXT;
BEGIN
    -- Get the user's email
    user_email := NEW.email;
    
    -- Create a new tenant for this user
    INSERT INTO public.tenants (name)
    VALUES (user_email || ' Organization')
    RETURNING id INTO new_tenant_id;
    
    -- Create the profile with the new tenant_id
    INSERT INTO public.profiles (id, tenant_id, role)
    VALUES (NEW.id, new_tenant_id, 'owner');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger "on_auth_user_created" already exists and will use the updated function
