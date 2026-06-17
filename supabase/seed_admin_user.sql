-- ====================================================================
-- PRIMETEK HR PORTAL — Seed Admin User
-- Run this block in the Supabase SQL Editor to seed the admin account.
-- ====================================================================

-- 1. Execute seeding transactional block
DO $$
DECLARE
    v_user_id UUID := 'a8c148fa-bb4b-4a5c-9c02-e2d96c9c614b'; -- Static UUID for consistency
    v_email TEXT := 'admin@globalps.com';
    -- Pre-calculated bcrypt hash for the admin password using the project's exact bcrypt engine.
    -- This guarantees compatibility and bypasses any extension or encoding differences.
    v_encrypted_password TEXT := '$2b$12$HgVQrD/xYxjqJ.F8LHZU2ebcTCxRAKBO9T4Ir0yfZULo06yvxthnu';
    
    -- Schema detection variables
    v_has_provider_id BOOLEAN;
    v_id_is_generated BOOLEAN;
    v_has_email_col BOOLEAN;
BEGIN
    -- Detect auth.identities schema features dynamically
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
    ) INTO v_has_provider_id;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'id' AND is_generated = 'ALWAYS'
    ) INTO v_id_is_generated;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'email' AND is_generated = 'NEVER'
    ) INTO v_has_email_col;

    -- Check if the user already exists in auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        -- Retrieve existing ID
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

        -- Update the credentials and confirmation status
        UPDATE auth.users
        SET 
            encrypted_password = v_encrypted_password,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            last_sign_in_at = COALESCE(last_sign_in_at, now()),
            updated_at = now(),
            raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
            raw_user_meta_data = '{"full_name": "Administrator"}'::jsonb,
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            phone = COALESCE(phone, ''),
            phone_change_token = COALESCE(phone_change_token, ''),
            email_change_token_current = COALESCE(email_change_token_current, ''),
            phone_change = COALESCE(phone_change, ''),
            reauthentication_token = COALESCE(reauthentication_token, '')
        WHERE id = v_user_id;

        RAISE NOTICE 'Updated existing user credentials in auth.users for email: %', v_email;
    ELSE
        -- Insert new user into auth.users (excluding generated confirmed_at column)
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            last_sign_in_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            phone,
            phone_change_token,
            email_change_token_current,
            phone_change,
            reauthentication_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_email,
            v_encrypted_password,
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Administrator"}'::jsonb,
            false,
            now(),
            now(),
            now(),
            '', -- confirmation_token
            '', -- recovery_token
            '', -- email_change_token_new
            '', -- email_change
            '', -- phone
            '', -- phone_change_token
            '', -- email_change_token_current
            '', -- phone_change
            ''  -- reauthentication_token
        );

        RAISE NOTICE 'Inserted new user in auth.users for email: %', v_email;
    END IF;

    -- 3. Sync public.admin_users record
    INSERT INTO public.admin_users (
        id,
        email,
        role,
        mfa_enabled
    ) VALUES (
        v_user_id,
        v_email,
        'SUPER_ADMIN',
        false
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        role = 'SUPER_ADMIN',
        mfa_enabled = false;

    RAISE NOTICE 'Synchronized admin user profile in public.admin_users with ID: %', v_user_id;

    -- 4. Dynamically insert or update auth.identities
    -- Different versions of Supabase GoTrue auth schema may or may not include the email or provider_id columns.
    IF EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
        -- Update the existing identity
        IF v_has_provider_id THEN
            IF v_has_email_col THEN
                EXECUTE format('
                    UPDATE auth.identities
                    SET identity_data = %L::jsonb,
                        last_sign_in_at = now(),
                        updated_at = now(),
                        provider_id = %L,
                        email = %L
                    WHERE user_id = %L AND provider = %L;
                ', format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email), v_user_id::text, v_email, v_user_id, 'email');
            ELSE
                EXECUTE format('
                    UPDATE auth.identities
                    SET identity_data = %L::jsonb,
                        last_sign_in_at = now(),
                        updated_at = now(),
                        provider_id = %L
                    WHERE user_id = %L AND provider = %L;
                ', format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email), v_user_id::text, v_user_id, 'email');
            END IF;
        ELSE
            IF v_has_email_col THEN
                EXECUTE format('
                    UPDATE auth.identities
                    SET identity_data = %L::jsonb,
                        last_sign_in_at = now(),
                        updated_at = now(),
                        id = %L,
                        email = %L
                    WHERE user_id = %L AND provider = %L;
                ', format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email), v_user_id::text, v_email, v_user_id, 'email');
            ELSE
                EXECUTE format('
                    UPDATE auth.identities
                    SET identity_data = %L::jsonb,
                        last_sign_in_at = now(),
                        updated_at = now(),
                        id = %L
                    WHERE user_id = %L AND provider = %L;
                ', format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email), v_user_id::text, v_user_id, 'email');
            END IF;
        END IF;
    ELSE
        -- Insert new identity
        DECLARE
            v_cols TEXT[] := ARRAY['user_id', 'identity_data', 'provider', 'last_sign_in_at', 'created_at', 'updated_at'];
            v_vals TEXT[] := ARRAY[
                quote_literal(v_user_id),
                quote_literal(format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email)),
                quote_literal('email'),
                'now()',
                'now()',
                'now()'
            ];
        BEGIN
            -- Handle provider_id or id
            IF v_has_provider_id THEN
                v_cols := array_append(v_cols, 'provider_id');
                v_vals := array_append(v_vals, quote_literal(v_user_id::text));
                
                -- If id is not generated, we need to supply it
                IF NOT v_id_is_generated THEN
                    v_cols := array_append(v_cols, 'id');
                    v_vals := array_append(v_vals, quote_literal(gen_random_uuid()::text));
                END IF;
            ELSE
                v_cols := array_append(v_cols, 'id');
                v_vals := array_append(v_vals, quote_literal(v_user_id::text));
            END IF;

            -- Handle email column
            IF v_has_email_col THEN
                v_cols := array_append(v_cols, 'email');
                v_vals := array_append(v_vals, quote_literal(v_email));
            END IF;

            EXECUTE format('
                INSERT INTO auth.identities (%s)
                VALUES (%s);
            ', array_to_string(v_cols, ','), array_to_string(v_vals, ','));
        END;
    END IF;

    RAISE NOTICE 'Synchronized sign-in identity in auth.identities for email: %', v_email;

END $$;
