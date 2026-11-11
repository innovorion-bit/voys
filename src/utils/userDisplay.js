const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_PLACEHOLDER_NAMES = new Set([
  'kullanıcı',
  'kullanici',
  'üye',
  'uye',
  'user',
  'unknown',
  'katılımcı',
  'katilimci',
  'sen',
  'sen (you)',
]);

const PROFILE_CACHE_KEY = 'voys_user_profiles_cache_v1';
const MAX_CACHED_PROFILES = 200;

/**
 * Checks whether a value looks like a raw UUID identifier rather than a username.
 */
export const isUuidLike = (value) => {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
};

/**
 * Checks whether a value is a generic fallback label rather than a real user name.
 */
export const isGenericPlaceholderName = (value) => {
  if (typeof value !== 'string') return false;
  return GENERIC_PLACEHOLDER_NAMES.has(value.trim().toLowerCase());
};

/**
 * Returns true when a string is a non-empty, non-UUID, non-placeholder user name.
 */
export const isRealDisplayName = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !isUuidLike(trimmed) && !isGenericPlaceholderName(trimmed);
};

/**
 * Picks the best non-UUID display name from ordered candidates.
 * Real names always take precedence over generic fallback labels.
 */
export const pickDisplayName = (candidates = [], fallback = 'Kullanıcı') => {
  const list = Array.isArray(candidates) ? candidates : [candidates];

  for (const item of list) {
    if (isRealDisplayName(item)) {
      return item.trim();
    }
  }

  for (const item of list) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed && !isUuidLike(trimmed)) {
        return trimmed;
      }
    }
  }

  return fallback;
};

const readProfileCache = () => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Reads a previously cached profile summary from localStorage for synchronous display fallbacks.
 */
export const getCachedUserProfile = (userId) => {
  if (!userId) return null;
  const cache = readProfileCache();
  return cache[String(userId)] || null;
};

/**
 * Persists lightweight user profile summaries (excluding huge base64 images) for fast initial render.
 */
export const cacheUserProfiles = (profiles = []) => {
  if (!Array.isArray(profiles) || profiles.length === 0) return;

  try {
    const cache = readProfileCache();
    let changed = false;
    const now = Date.now();

    profiles.forEach((prof) => {
      if (!prof || typeof prof !== 'object') return;
      const id = prof.id || prof.user_id;
      if (!id) return;

      const resolvedName = pickDisplayName(
        [prof.display_name, prof.name, prof.username],
        null
      );
      const rawUsername =
        typeof prof.username === 'string' && !isUuidLike(prof.username) && !isGenericPlaceholderName(prof.username)
          ? prof.username.trim()
          : '';
      const rawAvatar = prof.avatar_url || prof.avatar || '';
      const safeAvatar =
        typeof rawAvatar === 'string' && (!rawAvatar.startsWith('data:') || rawAvatar.length <= 2048)
          ? rawAvatar
          : '';

      if (!resolvedName && !rawUsername && !safeAvatar) return;

      const key = String(id);
      const existing = cache[key] || {};
      const nextName = pickDisplayName([resolvedName, existing.name, existing.display_name], null);
      if (!nextName && !rawUsername && !existing.username) return;

      cache[key] = {
        id: key,
        name: nextName || existing.name || rawUsername,
        display_name: nextName || existing.display_name || rawUsername,
        username: rawUsername || existing.username || '',
        tag: prof.tag || existing.tag || '0001',
        avatar: safeAvatar || existing.avatar || '',
        avatar_url: safeAvatar || existing.avatar_url || '',
        updatedAt: now,
      };
      changed = true;
    });

    if (!changed) return;

    const entries = Object.entries(cache);
    if (entries.length > MAX_CACHED_PROFILES) {
      entries.sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
      const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHED_PROFILES));
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    // Ignore localStorage quota/privacy errors
  }
};
