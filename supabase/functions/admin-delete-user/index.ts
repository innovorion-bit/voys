import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ADMIN_USER_ID = 'ba1e9bcb-ed19-4b81-8a29-2a8c89077f1a';
const ADMIN_EMAIL = 'emirhantuzeniletisim@gmail.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function normalizeObjectPath(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^\/+/, '');
  if (!cleaned) return null;
  try {
    return decodeURIComponent(cleaned).replace(/^\/+/, '') || null;
  } catch {
    return cleaned;
  }
}

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist');
}

async function removeStoragePaths(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucketId: string,
  paths: string[],
): Promise<{ deletedCount: number; error: string | null }> {
  let deletedCount = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const { data, error } = await supabaseAdmin.storage.from(bucketId).remove(chunk);
    if (error) {
      return { deletedCount, error: `${bucketId}: ${error.message}` };
    }
    deletedCount += Array.isArray(data) ? data.length : chunk.length;
  }
  return { deletedCount, error: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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

  // Strict server-side admin verification (never trust client claims)
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

  let body: { userId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Geçersiz JSON istek gövdesi.' }, 400);
  }

  const targetUserId = typeof body?.userId === 'string' ? body.userId.trim().toLowerCase() : '';
  if (!UUID_RE.test(targetUserId)) {
    return jsonResponse({ error: 'Geçerli bir kullanıcı ID belirtilmelidir.' }, 400);
  }

  if (targetUserId === ADMIN_USER_ID || targetUserId === caller.id.toLowerCase()) {
    return jsonResponse({ error: 'Ana yönetici hesabı silinemez.' }, 400);
  }

  // Verify target user identity (handle partial orphans where profile remains without auth user or vice versa)
  const { data: targetAuthData, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
  const targetAuthUser = targetAuthData?.user ?? null;
  if (targetAuthUser) {
    if (
      targetAuthUser.email?.toLowerCase() === ADMIN_EMAIL ||
      targetAuthUser.app_metadata?.role === 'admin'
    ) {
      return jsonResponse({ error: 'Yönetici yetkili hesap silinemez.' }, 400);
    }
  } else if (getUserErr && !/not\s*found/i.test(getUserErr.message || '')) {
    const status = (getUserErr as { status?: number }).status;
    if (status !== 404) {
      return jsonResponse({ error: `Kullanıcı doğrulanamadı: ${getUserErr.message}` }, 500);
    }
  }

  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name')
    .eq('id', targetUserId)
    .maybeSingle();

  if (!targetAuthUser && !existingProfile) {
    return jsonResponse({ error: 'Silinecek kullanıcı Supabase sisteminde bulunamadı.' }, 404);
  }

  // 1. Collect & remove all Storage files owned or uploaded by target user before auth deletion
  const { data: storageRows, error: storageListErr } = await supabaseAdmin.rpc(
    'admin_get_user_storage_objects',
    { p_user_id: targetUserId },
  );
  if (storageListErr) {
    return jsonResponse(
      { error: `Kullanıcının Storage dosyaları taranamadı: ${storageListErr.message}` },
      500,
    );
  }

  const pathsByBucket = new Map<string, Set<string>>();
  for (const row of (storageRows ?? []) as Array<{ bucket_id?: string; object_name?: string }>) {
    if (!row?.bucket_id || !row?.object_name) continue;
    const normalized = normalizeObjectPath(row.object_name);
    if (!normalized) continue;
    if (!pathsByBucket.has(row.bucket_id)) {
      pathsByBucket.set(row.bucket_id, new Set());
    }
    pathsByBucket.get(row.bucket_id)!.add(normalized);
  }

  let deletedStorageObjects = 0;
  for (const [bucketId, pathSet] of pathsByBucket.entries()) {
    const res = await removeStoragePaths(supabaseAdmin, bucketId, Array.from(pathSet));
    if (res.error) {
      return jsonResponse(
        { error: `Storage dosyaları silinemedi (${res.error})` },
        500,
      );
    }
    deletedStorageObjects += res.deletedCount;
  }

  // 2. Clean all public database records (DMs, channel messages, friendships, memberships, channels, profile)
  const dmRes = await supabaseAdmin
    .from('direct_messages')
    .delete({ count: 'exact' })
    .or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`);
  if (dmRes.error) {
    return jsonResponse({ error: `DM kayıtları silinemedi: ${dmRes.error.message}` }, 500);
  }

  const cmRes = await supabaseAdmin
    .from('channel_messages')
    .delete({ count: 'exact' })
    .eq('sender_id', targetUserId);
  if (cmRes.error) {
    return jsonResponse({ error: `Kanal mesajları silinemedi: ${cmRes.error.message}` }, 500);
  }

  const legacyFriendsRes = await supabaseAdmin
    .from('friends')
    .delete({ count: 'exact' })
    .or(`user_id.eq.${targetUserId},friend_id.eq.${targetUserId}`);
  if (legacyFriendsRes.error && !isMissingRelationError(legacyFriendsRes.error)) {
    return jsonResponse({ error: `Eski arkadaş kayıtları silinemedi: ${legacyFriendsRes.error.message}` }, 500);
  }

  const friendshipsRes = await supabaseAdmin
    .from('friendships')
    .delete({ count: 'exact' })
    .or(`user_id.eq.${targetUserId},friend_id.eq.${targetUserId}`);
  if (friendshipsRes.error) {
    return jsonResponse({ error: `Arkadaşlık kayıtları silinemedi: ${friendshipsRes.error.message}` }, 500);
  }

  const membersRes = await supabaseAdmin
    .from('channel_members')
    .delete({ count: 'exact' })
    .eq('user_id', targetUserId);
  if (membersRes.error) {
    return jsonResponse({ error: `Grup üyelikleri silinemedi: ${membersRes.error.message}` }, 500);
  }

  const channelsRes = await supabaseAdmin
    .from('channels')
    .update({ created_by: null })
    .eq('created_by', targetUserId);
  if (channelsRes.error) {
    return jsonResponse({ error: `Kanal kurucu bağı kaldırılamadı: ${channelsRes.error.message}` }, 500);
  }

  const profileRes = await supabaseAdmin
    .from('profiles')
    .delete({ count: 'exact' })
    .eq('id', targetUserId);
  if (profileRes.error) {
    return jsonResponse({ error: `Profil kaydı silinemedi: ${profileRes.error.message}` }, 500);
  }

  // 3. Hard-delete Auth user (cascades auth.sessions, auth.refresh_tokens, auth.identities, MFA, tokens)
  let authDeleted = false;
  if (targetAuthUser) {
    const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId, false);
    if (deleteAuthErr) {
      return jsonResponse(
        { error: `Supabase Auth hesabı silinemedi: ${deleteAuthErr.message}` },
        500,
      );
    }
    authDeleted = true;
  }

  // 4. Broadcast immediate account_deleted notification so live connected apps sign out & purge caches
  try {
    const broadcastChannel = supabaseAdmin.channel('standupp_global_calls');
    await broadcastChannel.send({
      type: 'broadcast',
      event: 'account_deleted',
      payload: {
        userId: targetUserId,
        deletedAt: new Date().toISOString(),
      },
    });
    await supabaseAdmin.removeChannel(broadcastChannel);
  } catch {
    // Non-fatal: DB deletes and auth termination already completed
  }

  return jsonResponse({
    success: true,
    userId: targetUserId,
    authDeleted,
    deletedStorageObjects,
    deletedCounts: {
      directMessages: dmRes.count ?? 0,
      channelMessages: cmRes.count ?? 0,
      friendships: friendshipsRes.count ?? 0,
      channelMembers: membersRes.count ?? 0,
      profiles: profileRes.count ?? 0,
    },
    deletedAt: new Date().toISOString(),
  });
});
