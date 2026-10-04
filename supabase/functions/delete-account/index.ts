// Edge Function: elimina la cuenta del usuario que llama (Auth + todos sus datos).
//
// - Requiere la sesión del usuario (Authorization: Bearer <jwt>) y el cuerpo
//   { "confirm": "ELIMINAR" }.
// - Si el usuario organiza una Junta que no está finalizada, se bloquea: no se
//   toca la lógica de Juntas.
// - Borra el usuario de Auth con service role; las FKs en cascada eliminan sus
//   datos (perfil, cuentas, movimientos, transferencias, pagos, ingresos…).
// - Los logs no incluyen ids, correos, montos ni contenido.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ACTIVE_JUNTA_STATUSES = ['activa', 'en_pausa', 'pendiente'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    console.error('delete-account: missing configuration');
    return json(500, { error: 'No se pudo eliminar la cuenta. Inténtalo más tarde.' });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Sesión requerida.' });

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    // handled below
  }
  if (body.confirm !== 'ELIMINAR') {
    return json(400, { error: 'Escribe ELIMINAR para confirmar.' });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: 'Sesión requerida.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { count, error: juntasError } = await admin
    .from('juntas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ACTIVE_JUNTA_STATUSES);
  if (juntasError) {
    console.error('delete-account: juntas check failed', juntasError.code);
    return json(500, { error: 'No se pudo eliminar la cuenta. Inténtalo más tarde.' });
  }
  if ((count ?? 0) > 0) {
    return json(409, {
      error: 'Antes de eliminar tu cuenta debes cerrar o transferir tus Juntas activas.',
      code: 'active_juntas',
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('delete-account: delete failed', deleteError.status ?? '');
    return json(500, { error: 'No se pudo eliminar la cuenta. Inténtalo más tarde.' });
  }

  console.log('delete-account: account deleted');
  return json(200, { ok: true });
});
