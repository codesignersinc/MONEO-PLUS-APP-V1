-- ============================================================
-- 1. Panel de administración: eliminar un usuario (admin_delete_user). Hace lo mismo que
--    «Eliminar cuenta» (borra auth.users y todo cae en cascada), con las mismas reglas: no se
--    puede si organiza una Junta activa. Un admin no se borra a sí mismo ni a otro admin.
-- 2. Registro solo con correos reales: signup_email_problem(email) y el hook de Supabase Auth
--    «Before User Created» (hook_before_user_created) rechazan, para el registro con correo,
--    sintaxis inválida, dominios de prueba o reservados, correos temporales y direcciones de
--    Gmail imposibles. Las mismas reglas están en src/lib/emailCheck.ts. Google y otros
--    proveedores no se revisan (el correo ya viene verificado).
--    En staging, la fila ('allow_test_signups', 'on') de public.app_settings deja pasar
--    @test.local (pruebas E2E). En producción la tabla queda vacía.
-- ============================================================

-- 1. Delete a user --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso solo para administradores.' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta desde el panel.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = p_user) THEN
    RAISE EXCEPTION 'No se puede eliminar a otro administrador.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.juntas j
     WHERE j.user_id = p_user AND j.status IN ('activa', 'en_pausa', 'pendiente')
  ) THEN
    RAISE EXCEPTION 'Organiza una Junta activa: primero debe cerrarla o transferirla.'
      USING ERRCODE = '23503';
  END IF;
  DELETE FROM auth.users WHERE id = p_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 2. Real emails only -------------------------------------------------------------

-- Why an address cannot sign up, or NULL. Keep in sync with signupEmailProblem().
CREATE OR REPLACE FUNCTION public.signup_email_problem(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  e text := lower(btrim(coalesce(p_email, '')));
  loc text;
  dom text;
  name text;
BEGIN
  IF e !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' OR e LIKE '%..%' THEN
    RETURN 'Ingresa un correo válido.';
  END IF;
  loc := split_part(e, '@', 1);
  dom := split_part(e, '@', 2);
  IF dom IN ('example.com', 'example.org', 'example.net', 'test.com', 'test.pe', 'prueba.com',
             'prueba.pe', 'dominio.com', 'asdf.com')
     OR dom ~ '\.(test|example|invalid|localhost|local|lan|internal)$' THEN
    RETURN 'Usa tu correo real: lo necesitas para recuperar tu cuenta.';
  END IF;
  IF dom IN ('mailinator.com', 'yopmail.com', 'yopmail.net', '10minutemail.com', '10minutemail.net',
             'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'grr.la', 'tempmail.com',
             'temp-mail.org', 'tempmail.net', 'tempmailo.com', 'trashmail.com', 'getnada.com',
             'nada.email', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'mintemail.com',
             'mohmal.com', 'emailondeck.com', 'throwawaymail.com', 'moakt.com', 'spamgourmet.com',
             'mailnesia.com', 'tempail.com', 'burnermail.io', 'inboxkitten.com', 'mail.tm', 'mail.gw',
             'tmpmail.org', 'tmail.ws', 'emailfake.com') THEN
    RETURN 'No aceptamos correos temporales. Usa tu correo personal.';
  END IF;
  IF dom IN ('gmail.com', 'googlemail.com') THEN
    name := replace(split_part(loc, '+', 1), '.', '');
    IF name !~ '^[a-z0-9]{6,30}$' THEN
      RETURN 'Ese correo de Gmail no existe. Revísalo.';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- Server-side switches, readable only by SECURITY DEFINER functions (no grants, no policies).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM PUBLIC, anon, authenticated;

-- Supabase Auth hook (Before User Created). Messages start with "MONEO: " so the app shows them.
CREATE OR REPLACE FUNCTION public.hook_before_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  email text := event -> 'user' ->> 'email';
  provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', 'email');
  problem text;
BEGIN
  IF provider <> 'email' THEN
    RETURN '{}'::jsonb;
  END IF;
  IF lower(coalesce(email, '')) LIKE '%@test.local'
     AND EXISTS (SELECT 1 FROM public.app_settings s
                  WHERE s.key = 'allow_test_signups' AND s.value = 'on') THEN
    RETURN '{}'::jsonb;
  END IF;
  problem := public.signup_email_problem(email);
  IF problem IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN jsonb_build_object('error',
    jsonb_build_object('http_code', 400, 'message', 'MONEO: ' || problem));
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.signup_email_problem(text) TO supabase_auth_admin;
REVOKE ALL ON FUNCTION public.hook_before_user_created(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.signup_email_problem(text) FROM PUBLIC, anon, authenticated;
