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
 * Resiliently resolves a user's presence from the presences map.
 * Checks candidate IDs (user_id, id, userId, profile.id) both exact and case-insensitively,
 * and falls back to matching by username if necessary.
 */
export const resolveMemberPresence = (presences = {}, member = {}) => {
  if (!presences || typeof presences !== 'object' || !member) return null;

  const candidateIds = [
    member.user_id,
    member.id,
    member.userId,
    member.profile?.id,
    member.profiles?.id,
    member.profile?.user_id,
    member.profiles?.user_id,
  ]
    .filter(Boolean)
    .map(String);

  // 1. Direct key match
  for (const cid of candidateIds) {
    if (presences[cid]) return presences[cid];
    const lower = cid.toLowerCase();
    if (presences[lower]) return presences[lower];
  }

  // 2. Scan presence values for matching ID (case-insensitive)
  const lowerCandidates = new Set(candidateIds.map((c) => c.toLowerCase()));
  const presenceValues = Object.values(presences);
  for (const p of presenceValues) {
    if (!p) continue;
    const pId = p.userId || p.id;
    if (pId && lowerCandidates.has(String(pId).toLowerCase())) {
      return p;
    }
  }

  // 3. Fallback match by username
  const rawUsername = [
    member.username,
    member.profile?.username,
    member.profiles?.username,
  ].find((u) => typeof u === 'string' && u.trim() && !isUuidLike(u));

  if (rawUsername) {
    const cleanUser = rawUsername.trim().toLowerCase();
    for (const p of presenceValues) {
      if (!p) continue;
      const pUser = p.username || p.name;
      if (typeof pUser === 'string' && pUser.trim().toLowerCase() === cleanUser) {
        return p;
      }
    }
  }

  return null;
};

/**
 * Computes whether a member is online and resolves their status, game, and substatus.
 * Combines authoritative real-time presence with active voice session presence and database profile fallback.
 */
export const computeMemberOnlineStatus = ({
  member,
  presences = {},
  isSelf = false,
  currentUser = null,
  activeVoiceMembers = [],
}) => {
  if (isSelf) {
    const status = currentUser?.status || 'online';
    const isOnline = status !== 'offline' && status !== 'invisible';
    return {
      status,
      isOnline,
      game: isOnline ? (currentUser?.game || null) : null,
      substatus: isOnline ? (currentUser?.substatus || 'Çevrimiçi') : '',
    };
  }

  const p = resolveMemberPresence(presences, member);
  const profile = member.profile || member.profiles || {};

  // 1. Check if member is actively connected in WebRTC voice session or has voiceChannelId
  const candidateIds = [
    member.user_id,
    member.id,
    member.userId,
    profile.id,
    profile.user_id,
  ]
    .filter(Boolean)
    .map((id) => String(id).toLowerCase().trim());

  const isInVoiceList =
    Array.isArray(activeVoiceMembers) &&
    activeVoiceMembers.some((vm) => {
      if (!vm) return false;
      const vmCandidates = [
        vm.id,
        vm.user_id,
        vm.userId,
        vm.peerId,
        vm.profile?.id,
      ]
        .filter(Boolean)
        .map((id) => String(id).toLowerCase().trim());
      return vmCandidates.some((vId) => candidateIds.includes(vId));
    });

  const hasVoicePresence = Boolean(
    p &&
    p.voiceChannelId &&
    p.status !== 'offline' &&
    p.status !== 'invisible' &&
    p.isOnline !== false
  );

  const isInVoice = isInVoiceList || hasVoicePresence;

  if (isInVoice) {
    return {
      status: p?.status && p.status !== 'offline' && p.status !== 'invisible' ? p.status : 'online',
      isOnline: true,
      game: p?.game !== undefined ? p.game : (profile.game || member.game || null),
      substatus: p?.substatus || profile.substatus || member.substatus || 'Seste',
    };
  }

  // 2. Real-time presence truth
  if (p) {
    const isOnline = Boolean(
      p.status !== 'offline' &&
      p.status !== 'invisible' &&
      p.isOnline !== false
    );
    return {
      status: isOnline ? (p.status || 'online') : 'offline',
      isOnline,
      game: isOnline ? (p.game !== undefined ? p.game : (profile.game || member.game || null)) : null,
      substatus: isOnline ? (p.substatus !== undefined ? p.substatus : (profile.substatus || member.substatus || '')) : '',
    };
  }

  // 3. If neither in active voice nor present in real-time presences, user is strictly offline.
  // Database profile.status reflects saved preference, never live connectivity.
  return {
    status: 'offline',
    isOnline: false,
    game: null,
    substatus: '',
  };
};

/**
 * Normalizes a channel ID by lowercasing and stripping common route prefixes (`text-`, `voice-`).
 */
export const canonicalChannelId = (cid) => {
  if (!cid) return '';
  return String(cid).trim().toLowerCase().replace(/^(text-|voice-)/i, '');
};

/**
 * Checks whether two channel identifiers point to the same chat channel,
 * regardless of UUID casing or `text-` / `voice-` prefixes.
 */
export const isChannelMatch = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const strA = String(a).trim();
  const strB = String(b).trim();
  if (strA === strB) return true;
  const lowerA = strA.toLowerCase();
  const lowerB = strB.toLowerCase();
  if (lowerA === lowerB) return true;
  return canonicalChannelId(lowerA) === canonicalChannelId(lowerB);
};

/**
 * Resolves a channel call record from a channelCalls dictionary using resilient channel matching.
 */
export const resolveChannelCall = (callsMap = {}, targetChannelId) => {
  if (!callsMap || !targetChannelId) return null;
  if (callsMap[targetChannelId]) return callsMap[targetChannelId];

  const targetStr = String(targetChannelId).trim();
  const targetLower = targetStr.toLowerCase();
  const targetCanon = canonicalChannelId(targetLower);

  if (callsMap[targetLower]) return callsMap[targetLower];
  if (callsMap[targetCanon]) return callsMap[targetCanon];
  if (callsMap[`text-${targetCanon}`]) return callsMap[`text-${targetCanon}`];
  if (callsMap[`voice-${targetCanon}`]) return callsMap[`voice-${targetCanon}`];

  for (const [key, call] of Object.entries(callsMap)) {
    if (!key || !call) continue;
    if (isChannelMatch(key, targetChannelId)) {
      return call;
    }
  }
  return null;
};

/**
 * Merges active local WebRTC voiceMembers (which have live VAD speaking states) with
 * session-level callMembers (discovered via presence / broadcast) so that participants
 * who are still establishing WebRTC mesh never disappear from the voice list.
 */
export const mergeVoiceAndCallMembers = (voiceMembers = [], callMembers = [], currentUser = null) => {
  const mergedList = [];
  const seenKeys = new Set();

  const addKeys = (m, memberKey) => {
    if (memberKey) {
      const strKey = String(memberKey).trim();
      seenKeys.add(strKey);
      seenKeys.add(strKey.toLowerCase());
    }
    const candidates = [
      m?.id,
      m?.user_id,
      m?.userId,
      m?.peerId,
      m?.profile?.id,
      m?.profiles?.id,
    ];
    for (const c of candidates) {
      if (!c) continue;
      const str = String(c).trim();
      seenKeys.add(str);
      seenKeys.add(str.toLowerCase());
    }
    if (typeof m?.username === 'string' && m.username.trim() && !isUuidLike(m.username)) {
      seenKeys.add(m.username.trim().toLowerCase());
    }
  };

  const isAlreadySeen = (m) => {
    const candidates = [
      m?.id,
      m?.user_id,
      m?.userId,
      m?.peerId,
      m?.profile?.id,
      m?.profiles?.id,
    ];
    for (const c of candidates) {
      if (!c) continue;
      const str = String(c).trim();
      if (seenKeys.has(str) || seenKeys.has(str.toLowerCase())) return true;
    }
    if (typeof m?.username === 'string' && m.username.trim() && !isUuidLike(m.username)) {
      if (seenKeys.has(m.username.trim().toLowerCase())) return true;
    }
    return false;
  };

  // 1. First add live WebRTC voiceMembers (contains real speaking states, volume prefs, live stream info)
  (Array.isArray(voiceMembers) ? voiceMembers : []).forEach((vm) => {
    if (!vm) return;
    const vmKey = String(vm.id || vm.user_id || vm.userId || vm.peerId || '');
    if (!vmKey) return;
    if (isAlreadySeen(vm)) return;
    addKeys(vm, vmKey);
    mergedList.push(vm);
  });

  // 2. Then merge members from callMembers who may still be establishing WebRTC or discovered via presence
  (Array.isArray(callMembers) ? callMembers : []).forEach((cm) => {
    if (!cm) return;
    if (isAlreadySeen(cm)) return;
    const cmKey = String(cm.id || cm.user_id || cm.userId || cm.peerId || '');
    if (!cmKey) return;
    addKeys(cm, cmKey);
    mergedList.push({
      ...cm,
      isSpeaking: Boolean(cm.isSpeaking),
      substatus: cm.substatus || 'Seste',
    });
  });

  // 3. Ensure connected currentUser is present if connected
  if (currentUser?.id && !isAlreadySeen(currentUser)) {
    const selfKey = String(currentUser.id);
    addKeys(currentUser, selfKey);
    mergedList.unshift({
      id: currentUser.id,
      name: currentUser.name || 'Sen (You)',
      avatar: currentUser.avatar || currentUser.avatar_url || null,
      isSpeaking: false,
      status: currentUser.status || 'online',
      substatus: 'Seste',
    });
  }

  return mergedList;
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

  const registerMemberKeys = (m) => {
    if (!m) return;
    const candidateIds = [
      m.id,
      m.user_id,
      m.userId,
      m.profile?.id,
      m.profiles?.id,
    ];
    for (const cid of candidateIds) {
      if (!cid) continue;
      const str = String(cid).trim();
      effectiveById.set(str, m);
      effectiveById.set(str.toLowerCase(), m);
    }
    if (typeof m.username === 'string' && m.username.trim() && !isUuidLike(m.username)) {
      effectiveByUsername.set(m.username.trim().toLowerCase(), m);
    }
  };

  safeMembers.forEach(registerMemberKeys);

  const voiceIdSet = new Set();
  const voiceUsernameSet = new Set();
  const seenVoiceKeys = new Set();
  const voiceMembers = [];

  rawVoiceList.forEach((cm) => {
    if (!cm) return;

    const rawCandidates = [
      cm.id,
      cm.user_id,
      cm.userId,
      cm.peerId,
      cm.profile?.id,
    ].filter(Boolean).map((v) => String(v).trim());

    const rawUsername =
      typeof cm.username === 'string' && cm.username.trim() && !isUuidLike(cm.username)
        ? cm.username.trim().toLowerCase()
        : '';

    let matchedMember = null;
    for (const cid of rawCandidates) {
      matchedMember = effectiveById.get(cid) || effectiveById.get(cid.toLowerCase()) || null;
      if (matchedMember) break;
    }

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
      : rawCandidates[0] || '';

    const dedupeKey = canonicalId || (cm.peerId ? `peer:${String(cm.peerId)}` : '');
    if (dedupeKey) {
      const dedupeKeyLower = dedupeKey.toLowerCase();
      if (seenVoiceKeys.has(dedupeKeyLower)) return;
      seenVoiceKeys.add(dedupeKeyLower);
    }

    const allVoiceIds = [
      ...rawCandidates,
      matchedMember?.id,
      matchedMember?.user_id,
      matchedMember?.userId,
      matchedMember?.profile?.id,
    ].filter(Boolean).map((v) => String(v).trim());

    for (const vid of allVoiceIds) {
      voiceIdSet.add(vid);
      voiceIdSet.add(vid.toLowerCase());
    }

    if (rawUsername) voiceUsernameSet.add(rawUsername);
    if (matchedMember?.username && !isUuidLike(matchedMember.username)) {
      voiceUsernameSet.add(matchedMember.username.trim().toLowerCase());
    }

    const resolvedName = pickDisplayName(
      [
        matchedMember?.name,
        matchedMember?.display_name,
        matchedMember?.username,
        cm.name,
        cm.display_name,
        cm.username,
      ],
      'Katılımcı'
    );
    const resolvedAvatar =
      matchedMember?.avatar ||
      matchedMember?.avatar_url ||
      cm.avatar ||
      cm.avatar_url ||
      '';
    const resolvedUsername =
      [matchedMember?.username, cm.username].find(
        (u) => typeof u === 'string' && u.trim() && !isUuidLike(u)
      ) || '';

    voiceMembers.push({
      ...cm,
      ...(matchedMember || {}),
      id: matchedMember?.id || cm.id || rawCandidates[0],
      user_id: matchedMember?.user_id || cm.user_id || matchedMember?.id || cm.id,
      name: resolvedName,
      display_name: resolvedName,
      username: resolvedUsername,
      avatar: resolvedAvatar,
      avatar_url: resolvedAvatar,
      role: matchedMember?.role || cm.role || 'member',
      game: matchedMember?.game || cm.game || '',
      isSpeaking: Boolean(cm.isSpeaking),
      peerId: cm.peerId || matchedMember?.peerId || null,
      substatus: cm.substatus || matchedMember?.substatus || 'Seste',
    });
  });

  const groupMembers = safeMembers.filter((member) => {
    if (!member) return false;
    const memberCandidates = [
      member.id,
      member.user_id,
      member.userId,
      member.profile?.id,
      member.profiles?.id,
    ].filter(Boolean).map((v) => String(v).trim());

    const isMemberInVoice = memberCandidates.some(
      (cid) => voiceIdSet.has(cid) || voiceIdSet.has(cid.toLowerCase())
    );
    if (isMemberInVoice) return false;

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
      profileLookup.set(key.toLowerCase(), { ...profileLookup.get(key.toLowerCase()), ...prof });
    }
  });
  if (currentUser?.id) {
    const selfKey = String(currentUser.id);
    profileLookup.set(selfKey, { ...profileLookup.get(selfKey), ...currentUser });
    profileLookup.set(selfKey.toLowerCase(), { ...profileLookup.get(selfKey.toLowerCase()), ...currentUser });
  }

  const normalizeVoiceMember = (rawMember, fallbackId = null) => {
    const uid = String(rawMember?.id || rawMember?.user_id || rawMember?.userId || fallbackId || '');
    const matched = uid ? profileLookup.get(uid) || profileLookup.get(uid.toLowerCase()) : null;
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
      substatus: rawMember?.substatus || matched?.substatus || 'Seste',
    };
  };

  const byChannel = new Map(); // canonKey -> Map(uid -> member)
  const displayChanIds = new Map(); // canonKey -> representative original chanId

  const ensureChanMap = (chanId) => {
    const canonKey = canonicalChannelId(chanId);
    if (!canonKey) return new Map();
    if (!displayChanIds.has(canonKey) || (chanId && !String(chanId).startsWith('text-'))) {
      displayChanIds.set(canonKey, String(chanId));
    }
    if (!byChannel.has(canonKey)) byChannel.set(canonKey, new Map());
    return byChannel.get(canonKey);
  };

  const isUnconnectedSelf = (uid, chanId) =>
    Boolean(
      currentUser?.id &&
        (uid === String(currentUser.id) || uid.toLowerCase() === String(currentUser.id).toLowerCase()) &&
        !(isConnected && activeCallChannelId && isChannelMatch(activeCallChannelId, chanId))
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

      const p = resolveMemberPresence(presences, m) || (mUid ? presences?.[mUid] : null);
      if (p) {
        if (p.status === 'offline' || (p.status !== 'invisible' && p.isOnline === false)) {
          return;
        }
        const hasExplicitVoiceField = p.voiceChannelId !== undefined;
        const presenceChan = p.voiceChannelId ? String(p.voiceChannelId) : null;
        if (
          hasExplicitVoiceField &&
          (!presenceChan || !isChannelMatch(presenceChan, chanId)) &&
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
    const chanMap = ensureChanMap(activeCallChannelId);
    if (currentUser?.id) {
      const selfKey = String(currentUser.id);
      const existing = chanMap.get(selfKey) || {};
      chanMap.set(selfKey, normalizeVoiceMember({ ...existing, ...currentUser }, selfKey));
    }
    (voiceMembers || []).forEach((vm) => {
      if (!vm) return;
      const vmKey = String(vm.id || vm.userId || vm.peerId || '');
      if (!vmKey) return;
      const existing = chanMap.get(vmKey) || {};
      chanMap.set(vmKey, normalizeVoiceMember({ ...existing, ...vm }, vmKey));
    });
  }

  const merged = {};
  byChannel.forEach((memberMap, canonKey) => {
    const members = Array.from(memberMap.values());
    if (members.length === 0) return;
    const origChanId = displayChanIds.get(canonKey) || canonKey;
    const prevCall = channelCalls?.[origChanId] || channelCalls?.[canonKey] || {};
    const initiatorStillPresent = prevCall.initiator && members.some(
      (m) => String(m.id || m.user_id || m.userId).toLowerCase() === String(prevCall.initiator.id || prevCall.initiator.user_id || prevCall.initiator.userId).toLowerCase()
    );
    const initiator = initiatorStillPresent ? prevCall.initiator : (members[0] || null);

    const callRecord = {
      ...prevCall,
      channelId: origChanId,
      canonicalChannelId: canonKey,
      active: true,
      stage: 'active',
      count: members.length,
      members,
      initiator,
    };

    merged[origChanId] = callRecord;
    merged[canonKey] = callRecord;
    merged[canonKey.toLowerCase()] = callRecord;
    merged[`text-${canonKey}`] = callRecord;
    merged[`voice-${canonKey}`] = callRecord;
  });

  return merged;
};


