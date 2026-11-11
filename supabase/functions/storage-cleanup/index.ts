import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ADMIN_USER_ID = 'ba1e9bcb-ed19-4b81-8a29-2a8c89077f1a';
const ADMIN_EMAIL = 'emirhantuzeniletisim@gmail.com';
const DEFAULT_MAX_AGE_HOURS = 48;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
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

function extractAvatarStoragePath(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  const marker = '/storage/v1/object/public/avatars/';
  const idx = avatarUrl.indexOf(marker);
  if (idx === -1) return null;
  const tail = avatarUrl.slice(idx + marker.length).split('?')[0].split('#')[0];
  try {
    return decodeURIComponent(tail).replace(/^\/+/, '') || null;
  } catch {
    return tail.replace(/^\/+/, '') || null;
  }
}

interface StorageObjectEntry {
  path: string;
  created_at: string | null;
  updated_at: string | null;
}

async function listAllBucketObjects(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucketId: string,
): Promise<StorageObjectEntry[]> {
  const results: StorageObjectEntry[] = [];
  const prefixQueue: string[] = [''];
  const visitedPrefixes = new Set<string>();

  while (prefixQueue.length > 0) {
    const prefix = prefixQueue.shift() ?? '';
    if (visitedPrefixes.has(prefix)) continue;
    visitedPrefixes.add(prefix);

    let offset = 0;
    const limit = 100;

    while (true) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucketId)
        .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

      if (error) {
        throw new Error(`Storage list failed (${bucketId}/${prefix}): ${error.message}`);
      }
      if (!data || data.length === 0) break;

      for (const item of data) {
        if (!item?.name || item.name === '.emptyFolderPlaceholder') continue;
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        // Supabase Storage returns id === null for virtual folder prefixes
        if (item.id === null) {
          prefixQueue.push(fullPath);
        } else {
          results.push({
            path: fullPath,
            created_at: item.created_at ?? null,
            updated_at: item.updated_at ?? null,
          });
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  return results;
}

async function removePathsInChunks(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucketId: string,
  paths: string[],
): Promise<{ deletedCount: number; errors: string[] }> {
  let deletedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const { data, error } = await supabaseAdmin.storage.from(bucketId).remove(chunk);
    if (error) {
      errors.push(`${bucketId} remove error: ${error.message}`);
    } else {
      deletedCount += Array.isArray(data) ? data.length : chunk.length;
    }
  }

  return { deletedCount, errors };
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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authenticate via pg_cron internal secret OR verified Lyring admin JWT
  const cronSecret = req.headers.get('x-cron-secret')?.trim() || '';
  const authHeader = req.headers.get('authorization') || '';
  let authSource: 'pg_cron' | 'admin_ui' | null = null;

  if (cronSecret) {
    const { data: validCron, error: cronErr } = await supabaseAdmin.rpc('admin_verify_cron_secret', {
      p_token: cronSecret,
    });
    if (cronErr || validCron !== true) {
      return jsonResponse({ error: 'Invalid cron secret' }, 401);
    }
    authSource = 'pg_cron';
  } else if (authHeader.toLowerCase().startsWith('bearer ')) {
    const jwt = authHeader.slice(7).trim();
    const { data: authData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    const user = authData?.user;
    if (userErr || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const isAdmin =
      user.id === ADMIN_USER_ID &&
      user.email?.toLowerCase() === ADMIN_EMAIL &&
      user.app_metadata?.role === 'admin';
    if (!isAdmin) {
      return jsonResponse({ error: 'Forbidden: admin only' }, 403);
    }
    authSource = 'admin_ui';
  } else {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  let body: { maxAgeHours?: number; dryRun?: boolean; source?: string } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // Ignore malformed optional body and keep defaults
  }

  const maxAgeHours =
    typeof body.maxAgeHours === 'number' && body.maxAgeHours >= 1 && body.maxAgeHours <= 720
      ? body.maxAgeHours
      : DEFAULT_MAX_AGE_HOURS;
  const dryRun = body.dryRun === true;
  const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const allErrors: string[] = [];

  // 1. Collect active avatar URLs referenced by profiles and channels
  const activeAvatarPaths = new Set<string>();
  const [{ data: profileAvatars, error: profErr }, { data: channelAvatars, error: chanErr }] =
    await Promise.all([
      supabaseAdmin.from('profiles').select('avatar_url').not('avatar_url', 'is', null),
      supabaseAdmin.from('channels').select('avatar_url').not('avatar_url', 'is', null),
    ]);

  if (profErr) allErrors.push(`profiles fetch: ${profErr.message}`);
  if (chanErr) allErrors.push(`channels fetch: ${chanErr.message}`);

  for (const row of profileAvatars ?? []) {
    const p = extractAvatarStoragePath(row.avatar_url);
    if (p) activeAvatarPaths.add(p);
  }
  for (const row of channelAvatars ?? []) {
    const p = extractAvatarStoragePath(row.avatar_url);
    if (p) activeAvatarPaths.add(p);
  }

  // 2. Scan and expire chat-attachments older than maxAgeHours (default 48h / 2 days)
  let chatObjects: StorageObjectEntry[] = [];
  try {
    chatObjects = await listAllBucketObjects(supabaseAdmin, 'chat-attachments');
  } catch (err) {
    allErrors.push(err instanceof Error ? err.message : String(err));
  }

  const expiredChatPaths = chatObjects
    .filter((obj) => {
      const ts = obj.created_at || obj.updated_at;
      if (!ts) return false;
      const ms = Date.parse(ts);
      return Number.isFinite(ms) && ms < cutoffMs;
    })
    .map((obj) => obj.path);

  // 3. Scan and expire orphaned avatars older than maxAgeHours
  let avatarObjects: StorageObjectEntry[] = [];
  try {
    avatarObjects = await listAllBucketObjects(supabaseAdmin, 'avatars');
  } catch (err) {
    allErrors.push(err instanceof Error ? err.message : String(err));
  }

  const expiredAvatarPaths = avatarObjects
    .filter((obj) => {
      if (activeAvatarPaths.has(obj.path)) return false;
      const ts = obj.created_at || obj.updated_at;
      if (!ts) return false;
      const ms = Date.parse(ts);
      return Number.isFinite(ms) && ms < cutoffMs;
    })
    .map((obj) => obj.path);

  let deletedChatFiles = 0;
  let deletedOldAvatars = 0;

  if (!dryRun) {
    const chatRes = await removePathsInChunks(supabaseAdmin, 'chat-attachments', expiredChatPaths);
    deletedChatFiles = chatRes.deletedCount;
    allErrors.push(...chatRes.errors);

    const avatarRes = await removePathsInChunks(supabaseAdmin, 'avatars', expiredAvatarPaths);
    deletedOldAvatars = avatarRes.deletedCount;
    allErrors.push(...avatarRes.errors);
  }

  return jsonResponse({
    success: allErrors.length === 0,
    source: authSource,
    dryRun,
    maxAgeHours,
    cutoffIso,
    scannedChatFiles: chatObjects.length,
    deletedChatFiles,
    expiredChatPaths,
    scannedAvatars: avatarObjects.length,
    deletedOldAvatars,
    expiredAvatarPaths,
    activeAvatarCount: activeAvatarPaths.size,
    errors: allErrors,
    ranAt: new Date().toISOString(),
  });
});
