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

/**
 * Splits a group channel's members between active voice-chat participants and
 * remaining group members so the same user is not shown in both sidebar sections.
 */
export const partitionSidebarGroupMembers = ({
  effectiveMembers = [],
  callMembers = [],
  isCallActive = false,
  isInCall = false,
  currentUser = null,
  callInitiator = null,
} = {}) => {
  const safeMembers = Array.isArray(effectiveMembers) ? effectiveMembers : [];
  const hasCallMembers = Array.isArray(callMembers) && callMembers.length > 0;
  const showVoiceSection = Boolean(isCallActive || isInCall || hasCallMembers);

  if (!showVoiceSection) {
    return {
      showVoiceSection: false,
      voiceMembers: [],
      groupMembers: safeMembers,
    };
  }

  const rawVoiceList = hasCallMembers
    ? callMembers
    : isInCall && currentUser
      ? [currentUser]
      : callInitiator
        ? [callInitiator]
        : [];

  const effectiveById = new Map();
  const effectiveByUsername = new Map();

  safeMembers.forEach((member) => {
    if (!member) return;
    const mId = member.id || member.user_id || member.userId;
    if (mId) {
      effectiveById.set(String(mId), member);
    }
    if (typeof member.username === 'string' && member.username.trim() && !isUuidLike(member.username)) {
      effectiveByUsername.set(member.username.trim().toLowerCase(), member);
    }
  });

  const voiceIdSet = new Set();
  const voiceUsernameSet = new Set();
  const seenVoiceKeys = new Set();
  const voiceMembers = [];

  rawVoiceList.forEach((cm) => {
    if (!cm) return;

    const rawId = cm.id || cm.user_id || cm.userId;
    const rawUsername =
      typeof cm.username === 'string' && cm.username.trim() && !isUuidLike(cm.username)
        ? cm.username.trim().toLowerCase()
        : '';

    let matchedMember = rawId ? effectiveById.get(String(rawId)) || null : null;
    if (!matchedMember && rawUsername) {
      matchedMember = effectiveByUsername.get(rawUsername) || null;
    }

    // Fallback when remote WebRTC peer metadata hasn't resolved to a user UUID yet:
    // only match by display name if unambiguous across group members.
    if (!matchedMember && isRealDisplayName(cm.name)) {
      const targetName = cm.name.trim().toLowerCase();
      const nameMatches = safeMembers.filter((em) => {
        const emName = typeof em.name === 'string' ? em.name.trim().toLowerCase() : '';
        const emUser = typeof em.username === 'string' ? em.username.trim().toLowerCase() : '';
        return emName === targetName || emUser === targetName;
      });
      if (nameMatches.length === 1) {
        matchedMember = nameMatches[0];
      }
    }

    const canonicalId = matchedMember
      ? String(matchedMember.id || matchedMember.user_id || matchedMember.userId)
      : rawId
        ? String(rawId)
        : '';

    const dedupeKey = canonicalId || (cm.peerId ? `peer:${String(cm.peerId)}` : '');
    if (dedupeKey) {
      if (seenVoiceKeys.has(dedupeKey)) return;
      seenVoiceKeys.add(dedupeKey);
    }

    if (canonicalId) voiceIdSet.add(canonicalId);
    if (rawId) voiceIdSet.add(String(rawId));
    if (rawUsername) voiceUsernameSet.add(rawUsername);
    if (matchedMember?.username && !isUuidLike(matchedMember.username)) {
      voiceUsernameSet.add(matchedMember.username.trim().toLowerCase());
    }

    voiceMembers.push(
      matchedMember
        ? {
            ...cm,
            id: matchedMember.id || cm.id,
            role: cm.role || matchedMember.role,
            username: cm.username || matchedMember.username || '',
            avatar: cm.avatar || matchedMember.avatar || '',
          }
        : cm
    );
  });

  const groupMembers = safeMembers.filter((member) => {
    if (!member) return false;
    const mId = member.id || member.user_id || member.userId;
    if (mId && voiceIdSet.has(String(mId))) return false;
    if (typeof member.username === 'string' && member.username.trim() && !isUuidLike(member.username)) {
      if (voiceUsernameSet.has(member.username.trim().toLowerCase())) return false;
    }
    return true;
  });

  return {
    showVoiceSection: true,
    voiceMembers,
    groupMembers,
  };
};

