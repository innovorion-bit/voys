import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ADMIN_USER_ID = 'ba1e9bcb-ed19-4b81-8a29-2a8c89077f1a';
const ADMIN_EMAIL = 'emirhantuzeniletisim@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase server configuration' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'Missing bearer token' }, 401);
  }

  const jwt = authHeader.slice(7).trim();
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Strict server-side admin verification (never trust client flags)
  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
  const caller = authData?.user;
  if (authErr || !caller) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const isAuthorizedAdmin =
    caller.id === ADMIN_USER_ID &&
    caller.email?.toLowerCase() === ADMIN_EMAIL &&
    caller.app_metadata?.role === 'admin';

  if (!isAuthorizedAdmin) {
    return jsonResponse({ error: 'Forbidden: yetkisiz erişim' }, 403);
  }

  // Fetch registered auth users + public profiles + system telemetry in parallel
  const [authListRes, profilesRes, telemetryRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, avatar_url, status, substatus, game, updated_at'),
    supabaseAdmin.rpc('admin_get_telemetry'),
  ]);

  if (authListRes.error) {
    return jsonResponse({ error: `Auth list failed: ${authListRes.error.message}` }, 500);
  }
  if (profilesRes.error) {
    return jsonResponse({ error: `Profiles fetch failed: ${profilesRes.error.message}` }, 500);
  }
  if (telemetryRes.error) {
    return jsonResponse({ error: `Telemetry RPC failed: ${telemetryRes.error.message}` }, 500);
  }

  const profileById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p]),
  );

  // Build safe user directory: explicitly omit encrypted_password or internal auth tokens
  const users = (authListRes.data?.users ?? [])
    .map((u) => {
      const profile = profileById.get(u.id);
      const emailLocal = u.email ? u.email.split('@')[0] : 'kullanici';
      const username = profile?.username || u.user_metadata?.username || emailLocal;
      const displayName =
        profile?.display_name || u.user_metadata?.display_name || u.user_metadata?.name || username;

      return {
        id: u.id,
        email: u.email ?? null,
        username,
        display_name: displayName,
        avatar_url: profile?.avatar_url || null,
        status: profile?.status || 'offline',
        substatus: profile?.substatus || '',
        game: profile?.game || '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        profile_updated_at: profile?.updated_at ?? null,
        providers: u.app_metadata?.providers ?? ['email'],
        is_admin: u.id === ADMIN_USER_ID && u.app_metadata?.role === 'admin',
      };
    })
    .sort((a, b) => Date.parse(b.created_at || '0') - Date.parse(a.created_at || '0'));

  return jsonResponse({
    users,
    telemetry: telemetryRes.data,
    server_latency_ms: Date.now() - startedAt,
    checked_at: new Date().toISOString(),
  });
});

