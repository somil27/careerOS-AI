ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_id TEXT,
ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Update the handle_new_user trigger to handle Google OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  provider TEXT;
  extracted_first_name TEXT;
  extracted_last_name TEXT;
  extracted_avatar TEXT;
  is_verified BOOLEAN;
  g_id TEXT;
BEGIN
  -- Determine provider (defaults to email if not present in app_meta_data)
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  
  -- Extract fields differently based on provider
  IF provider = 'google' THEN
    extracted_first_name := NEW.raw_user_meta_data->>'given_name';
    extracted_last_name := NEW.raw_user_meta_data->>'family_name';
    extracted_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture');
    is_verified := (NEW.raw_user_meta_data->>'email_verified')::BOOLEAN;
    g_id := NEW.raw_user_meta_data->>'provider_id';
    
    -- Fallbacks
    IF extracted_first_name IS NULL THEN
      extracted_first_name := split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1);
    END IF;
    IF extracted_last_name IS NULL THEN
      extracted_last_name := substring(NEW.raw_user_meta_data->>'full_name' FROM (length(extracted_first_name) + 2));
    END IF;
  ELSE
    -- Email/password fallback
    extracted_first_name := split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1);
    extracted_last_name := substring(NEW.raw_user_meta_data->>'full_name' FROM (length(extracted_first_name) + 2));
    extracted_avatar := NULL;
    is_verified := false;
    g_id := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    first_name, 
    last_name, 
    avatar_url, 
    profile_picture, 
    auth_provider, 
    email_verified, 
    google_id
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    extracted_first_name,
    extracted_last_name,
    extracted_avatar,
    extracted_avatar,
    provider,
    COALESCE(is_verified, false),
    g_id
  )
  ON CONFLICT (id) DO UPDATE SET
    google_id = COALESCE(public.profiles.google_id, EXCLUDED.google_id),
    auth_provider = EXCLUDED.auth_provider,
    email_verified = COALESCE(public.profiles.email_verified, EXCLUDED.email_verified),
    first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(public.profiles.last_name, EXCLUDED.last_name),
    profile_picture = COALESCE(public.profiles.profile_picture, EXCLUDED.profile_picture),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
