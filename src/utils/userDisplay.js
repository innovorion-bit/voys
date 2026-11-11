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

/**
 * Combines stateful global presence (`voiceChannelId`) with transient call broadcasts
 * and active WebRTC voice members so users who haven't joined voice chat yet still see
 * everyone currently inside a channel's voice session.
 */
export const mergeChannelCallsWithPresences = ({
  channelCalls = {},
  presences = {},
  knownProfiles = [],
  activeCallChannelId = null,
  isConnected = false,
  voiceMembers = [],
  currentUser = null,
} = {}) => {
  const profileLookup = new Map();
  (knownProfiles || []).forEach((prof) => {
    if (!prof || typeof prof !== 'object') return;
    const pid = prof.id || prof.user_id || prof.userId;
    if (pid) {
      const key = String(pid);
      profileLookup.set(key, { ...profileLookup.get(key), ...prof });
    }
  });
  if (currentUser?.id) {
    const selfKey = String(currentUser.id);
    profileLookup.set(selfKey, { ...profileLookup.get(selfKey), ...currentUser });
  }

  const normalizeVoiceMember = (rawMember, fallbackId = null) => {
    const uid = String(rawMember?.id || rawMember?.user_id || rawMember?.userId || fallbackId || '');
    const matched = uid ? profileLookup.get(uid) : null;
    const name = pickDisplayName(
      [
        matched?.display_name,
        matched?.name,
        matched?.username,
        rawMember?.display_name,
        rawMember?.name,
        rawMember?.username,
      ],
      'Kullanıcı'
    );
    const avatar = matched?.avatar_url || matched?.avatar || rawMember?.avatar_url || rawMember?.avatar || '';
    const username =
      [matched?.username, rawMember?.username].find(
        (u) => typeof u === 'string' && u.trim() && !isUuidLike(u)
      ) || '';

    return {
      ...matched,
      ...rawMember,
      id: uid || rawMember?.id || rawMember?.peerId,
      name,
      display_name: name,
      username,
      avatar,
      avatar_url: avatar,
    };
  };

  const byChannel = new Map();
  const ensureChanMap = (chanId) => {
    const key = String(chanId);
    if (!byChannel.has(key)) byChannel.set(key, new Map());
    return byChannel.get(key);
  };
  const isUnconnectedSelf = (uid, chanId) =>
    Boolean(
      currentUser?.id &&
        uid === String(currentUser.id) &&
        !(isConnected && activeCallChannelId && String(activeCallChannelId) === String(chanId))
    );

  // 1. Authoritative online global presences currently in a voice channel
  Object.values(presences || {}).forEach((p) => {
    if (!p || !p.voiceChannelId) return;
    const isOnline = p.isOnline !== false && p.status !== 'offline' && p.status !== 'invisible';
    if (!isOnline) return;
    const uid = String(p.userId || p.id || '');
    if (!uid || isUnconnectedSelf(uid, p.voiceChannelId)) return;
    const chanMap = ensureChanMap(p.voiceChannelId);
    chanMap.set(uid, normalizeVoiceMember(p, uid));
  });

  // 2. Transient call_status broadcasts (with stale member pruning when newer presence contradicts)
  Object.entries(channelCalls || {}).forEach(([chanId, callInfo]) => {
    if (!chanId || !callInfo?.active) return;
    const rawMembers = Array.isArray(callInfo.members) && callInfo.members.length > 0
      ? callInfo.members
      : callInfo.initiator
        ? [callInfo.initiator]
        : [];
    if (rawMembers.length === 0) return;

    const chanMap = ensureChanMap(chanId);
    rawMembers.forEach((m) => {
      if (!m) return;
      const mUid = String(m.id || m.user_id || m.userId || '');
      if (!mUid) return;

      const p = presences?.[mUid];
      if (p) {
        if (p.status === 'offline' || (p.status !== 'invisible' && p.isOnline === false)) {
          return;
        }
        const hasExplicitVoiceField = p.voiceChannelId !== undefined;
        const presenceChan = p.voiceChannelId ? String(p.voiceChannelId) : null;
        if (
          hasExplicitVoiceField &&
          presenceChan !== String(chanId) &&
          (p.receivedAt || 0) >= (callInfo.receivedAt || 0) + 1500
        ) {
          return;
        }
      }

      if (isUnconnectedSelf(mUid, chanId)) {
        return;
      }

      if (!chanMap.has(mUid)) {
        chanMap.set(mUid, normalizeVoiceMember(m, mUid));
      }
    });
  });

  // 3. Merge active local WebRTC call peers (carries speaking state, peerId, ping)
  if (activeCallChannelId && isConnected) {
    const chanKey = String(activeCallChannelId);
    const chanMap = ensureChanMap(chanKey);
    (voiceMembers || []).forEach((vm) => {
      if (!vm) return;
      const vmKey = String(vm.id || vm.userId || vm.peerId || '');
      if (!vmKey) return;
      const existing = chanMap.get(vmKey) || {};
      chanMap.set(vmKey, normalizeVoiceMember({ ...existing, ...vm }, vmKey));
    });
  }

  const merged = {};
  byChannel.forEach((memberMap, chanId) => {
    const members = Array.from(memberMap.values());
    if (members.length === 0) return;
    const prevCall = channelCalls?.[chanId] || {};
    merged[chanId] = {
      ...prevCall,
      channelId: chanId,
      active: true,
      stage: 'active',
      count: members.length,
      members,
      initiator: prevCall.initiator || members[0] || null,
    };
  });

  return merged;
};


