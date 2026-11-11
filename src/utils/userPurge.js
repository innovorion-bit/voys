import { normalizeParticipantId, parseDmRoomPair } from './dmIsolation.js';

export const ADMIN_USER_ID = 'ba1e9bcb-ed19-4b81-8a29-2a8c89077f1a';
export const ADMIN_EMAIL = 'emirhantuzeniletisim@gmail.com';
export const PROFILE_CACHE_KEY = 'voys_user_profiles_cache_v1';
export const PEER_AUDIO_PREFS_KEY = 'voys_peer_audio_prefs';

const getDefaultStorage = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

const safeReadJson = (storage, key, fallback) => {
  if (!storage || typeof storage.getItem !== 'function') return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeWriteJson = (storage, key, value) => {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/**
 * Normalizes a user identifier for consistent comparisons.
 */
export const normalizeUserId = (value) => normalizeParticipantId(value);

const matchesUserId = (candidate, targetRaw, targetNorm) => {
  if (!candidate) return false;
  const raw = String(candidate).trim();
  if (!raw) return false;
  if (raw === targetRaw) return true;
  const norm = normalizeUserId(raw);
  return Boolean(norm && targetNorm && norm === targetNorm);
};

const roomInvolvesUser = (roomId, targetRaw, targetNorm) => {
  if (!roomId) return false;
  const key = String(roomId).trim();
  if (!key) return false;
  if (
    key === targetRaw ||
    key === `dm-${targetRaw}` ||
    key.toLowerCase() === targetNorm ||
    key.toLowerCase() === `dm-${targetNorm}`
  ) {
    return true;
  }
  const pair = parseDmRoomPair(key);
  return Boolean(
    pair &&
      (matchesUserId(pair[0], targetRaw, targetNorm) ||
        matchesUserId(pair[1], targetRaw, targetNorm))
  );
};

const messageInvolvesUser = (msg, targetRaw, targetNorm) => {
  if (!msg || typeof msg !== 'object') return false;
  return (
    matchesUserId(msg.sender_id, targetRaw, targetNorm) ||
    matchesUserId(msg.receiver_id, targetRaw, targetNorm) ||
    matchesUserId(msg.user_id, targetRaw, targetNorm) ||
    roomInvolvesUser(msg.dm_room_id || msg.room_id || msg.channel_id, targetRaw, targetNorm)
  );
};

/**
 * Checks whether a user object or identifier belongs to the protected primary admin account.
 */
export const isProtectedAdminIdentity = (userOrId) => {
  if (!userOrId) return false;
  if (typeof userOrId === 'string') {
    const trimmed = userOrId.trim().toLowerCase();
    return trimmed === ADMIN_USER_ID || trimmed === ADMIN_EMAIL;
  }
  if (typeof userOrId !== 'object') return false;
  const id = normalizeUserId(userOrId.id || userOrId.userId);
  const email = typeof userOrId.email === 'string' ? userOrId.email.trim().toLowerCase() : '';
  const role = userOrId.app_metadata?.role || userOrId.role;
  return (
    id === ADMIN_USER_ID ||
    email === ADMIN_EMAIL ||
    userOrId.is_admin === true ||
    role === 'admin'
  );
};

/**
 * Removes a single user entry from the persisted profile summary cache.
 */
export const removeCachedUserProfile = (userId, storage = getDefaultStorage()) => {
  if (!userId || !storage) return false;
  const targetRaw = String(userId).trim();
  const targetNorm = normalizeUserId(targetRaw);
  if (!targetRaw) return false;

  const cache = safeReadJson(storage, PROFILE_CACHE_KEY, null);
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;

  let changed = false;
  for (const key of Object.keys(cache)) {
    if (matchesUserId(key, targetRaw, targetNorm)) {
      delete cache[key];
      changed = true;
    }
  }
  if (changed) {
    safeWriteJson(storage, PROFILE_CACHE_KEY, cache);
  }
  return changed;
};

/**
 * Removes a deleted user's DMs and authored messages from an in-memory channel map.
 */
export const purgeUserFromMessagesMap = (messagesByChannel, targetUserId) => {
  if (!messagesByChannel || typeof messagesByChannel !== 'object' || !targetUserId) {
    return messagesByChannel;
  }
  const targetRaw = String(targetUserId).trim();
  const targetNorm = normalizeUserId(targetRaw);
  if (!targetRaw) return messagesByChannel;

  let changed = false;
  const next = {};

  for (const [roomKey, list] of Object.entries(messagesByChannel)) {
    if (roomInvolvesUser(roomKey, targetRaw, targetNorm)) {
      changed = true;
      continue;
    }
    if (Array.isArray(list)) {
      const filtered = list.filter((msg) => !messageInvolvesUser(msg, targetRaw, targetNorm));
      if (filtered.length !== list.length) {
        changed = true;
      }
      next[roomKey] = filtered;
    } else {
      next[roomKey] = list;
    }
  }

  return changed ? next : messagesByChannel;
};

/**
 * Purges every localStorage record referencing the deleted user without touching other users.
 */
export const purgeUserFromStorage = (userId, storage = getDefaultStorage()) => {
  const result = {
    updatedKeys: [],
    removedKeys: [],
    sessionCleared: false,
    cacheCleared: false,
  };
  if (!userId || !storage || typeof storage.getItem !== 'function') {
    return result;
  }

  const targetRaw = String(userId).trim();
  const targetNorm = normalizeUserId(targetRaw);
  if (!targetRaw) return result;

  const filterArrayKey = (key, predicate) => {
    const current = safeReadJson(storage, key, null);
    if (!Array.isArray(current)) return;
    const filtered = current.filter(predicate);
    if (filtered.length !== current.length) {
      safeWriteJson(storage, key, filtered);
      result.updatedKeys.push(key);
    }
  };

  filterArrayKey('standupp_local_users', (u) => !matchesUserId(u?.id, targetRaw, targetNorm));
  filterArrayKey(
    'standupp_db_friendships',
    (f) => !matchesUserId(f?.user_id, targetRaw, targetNorm) && !matchesUserId(f?.friend_id, targetRaw, targetNorm)
  );
  filterArrayKey('standupp_db_channel_members', (m) => !matchesUserId(m?.user_id, targetRaw, targetNorm));
  filterArrayKey('standupp_db_dm_msgs', (m) => !messageInvolvesUser(m, targetRaw, targetNorm));
  filterArrayKey('standupp_db_channel_msgs', (m) => !messageInvolvesUser(m, targetRaw, targetNorm));

  // Unlink channel creator locally (mirrors Postgres ON DELETE SET NULL)
  const localChannels = safeReadJson(storage, 'standupp_db_channels', null);
  if (Array.isArray(localChannels)) {
    let channelChanged = false;
    const updatedChannels = localChannels.map((c) => {
      if (c && matchesUserId(c.created_by, targetRaw, targetNorm)) {
        channelChanged = true;
        return { ...c, created_by: null };
      }
      return c;
    });
    if (channelChanged) {
      safeWriteJson(storage, 'standupp_db_channels', updatedChannels);
      result.updatedKeys.push('standupp_db_channels');
    }
  }

  // Clean cached message snapshot if present
  const cachedMsgs = safeReadJson(storage, 'standupp_cached_messages', null);
  if (Array.isArray(cachedMsgs)) {
    const filtered = cachedMsgs.filter((m) => !messageInvolvesUser(m, targetRaw, targetNorm));
    if (filtered.length !== cachedMsgs.length) {
      safeWriteJson(storage, 'standupp_cached_messages', filtered);
      result.updatedKeys.push('standupp_cached_messages');
    }
  } else if (cachedMsgs && typeof cachedMsgs === 'object') {
    const cleanedMap = purgeUserFromMessagesMap(cachedMsgs, targetRaw);
    if (cleanedMap !== cachedMsgs) {
      safeWriteJson(storage, 'standupp_cached_messages', cleanedMap);
      result.updatedKeys.push('standupp_cached_messages');
    }
  }

  // Clear local session if it belongs to the deleted user
  const localSession = safeReadJson(storage, 'standupp_local_session', null);
  if (localSession?.user && matchesUserId(localSession.user.id, targetRaw, targetNorm)) {
    try {
      storage.removeItem('standupp_local_session');
      result.removedKeys.push('standupp_local_session');
      result.sessionCleared = true;
    } catch { }
  }

  // Remove per-user keys
  const perUserPrefixes = ['standupp_user_profile_', 'voys_read_receipts_', 'voys_user_channels_'];
  const idVariants = targetNorm && targetNorm !== targetRaw ? [targetRaw, targetNorm] : [targetRaw];
  for (const prefix of perUserPrefixes) {
    for (const idVariant of idVariants) {
      const k = `${prefix}${idVariant}`;
      try {
        if (storage.getItem(k) !== null) {
          storage.removeItem(k);
          result.removedKeys.push(k);
        }
      } catch { }
    }
  }

  // Remove per-peer volume / mute preference
  const peerPrefs = safeReadJson(storage, PEER_AUDIO_PREFS_KEY, null);
  if (peerPrefs && typeof peerPrefs === 'object' && !Array.isArray(peerPrefs)) {
    let prefsChanged = false;
    for (const key of Object.keys(peerPrefs)) {
      if (matchesUserId(key, targetRaw, targetNorm)) {
        delete peerPrefs[key];
        prefsChanged = true;
      }
    }
    if (prefsChanged) {
      safeWriteJson(storage, PEER_AUDIO_PREFS_KEY, peerPrefs);
      result.updatedKeys.push(PEER_AUDIO_PREFS_KEY);
    }
  }

  if (removeCachedUserProfile(targetRaw, storage)) {
    result.cacheCleared = true;
    result.updatedKeys.push(PROFILE_CACHE_KEY);
  }

  return result;
};
