import { pickDisplayName, isUuidLike } from './userDisplay.js';

const PRESENCE_DEPARTURE_GRACE_MS = 1500;

const resolveEntityId = (entity) => {
  if (!entity || typeof entity !== 'object') return '';
  const raw = entity.id || entity.user_id || entity.userId || '';
  return raw ? String(raw) : '';
};

const isPresenceOffline = (entry) => {
  if (!entry) return false;
  if (entry.status === 'offline') return true;
  return entry.status !== 'invisible' && entry.isOnline === false;
};

const hasPresenceExplicitlyLeftChannel = (entry, channelId, callReceivedAt = 0) => {
  if (!entry || entry.voiceChannelId === undefined) return false;
  const presenceChan = entry.voiceChannelId ? String(entry.voiceChannelId) : null;
  // If voiceChannelId is null or not set, presence might simply lag or be a status heartbeat;
  // user has explicitly left ONLY if presenceChan is set to a different voice channel.
  if (!presenceChan || presenceChan === String(channelId)) return false;
  return (entry.receivedAt || 0) >= (callReceivedAt || 0) + PRESENCE_DEPARTURE_GRACE_MS;
};

const buildProfileIndex = (knownProfiles = []) => {
  const index = new Map();
  (knownProfiles || []).forEach((prof) => {
    const uid = resolveEntityId(prof);
    if (!uid) return;
    index.set(uid, { ...(index.get(uid) || {}), ...prof });
  });
  return index;
};

const normalizeParticipant = (raw, fallbackId, profileIndex, presences) => {
  const uid = resolveEntityId(raw) || (fallbackId ? String(fallbackId) : '');
  const p = uid ? presences?.[uid] : null;
  const cached = uid ? profileIndex.get(uid) : null;

  const name = pickDisplayName(
    [
      cached?.display_name,
      cached?.name,
      cached?.username,
      p?.name,
      p?.display_name,
      raw?.display_name,
      raw?.name,
      raw?.userName,
      raw?.username,
    ],
    raw?.peerId ? `Katılımcı-${String(raw.peerId).slice(0, 5)}` : 'Kullanıcı'
  );
  const username =
    [cached?.username, p?.username, raw?.username, raw?.userName].find(
      (u) => typeof u === 'string' && u.trim() && !isUuidLike(u)
    ) || '';
  const avatar =
    cached?.avatar_url ||
    cached?.avatar ||
    p?.avatar_url ||
    p?.avatar ||
    raw?.avatar_url ||
    raw?.avatar ||
    null;

  return {
    ...(cached && typeof cached === 'object' ? cached : {}),
    ...(raw && typeof raw === 'object' ? raw : {}),
    id: uid || (raw?.peerId ? String(raw.peerId) : ''),
    name,
    display_name: name,
    username,
    avatar,
    avatar_url: avatar,
    role: raw?.role || cached?.role || null,
  };
};

/**
 * Collects all non-excluded voice call participants for `channelId` from:
 * 1) Active local WebRTC peers (`voiceMembers`, `remotePeers`, `peerMetadata`),
 * 2) Global online `presences` whose `voiceChannelId` matches `channelId`,
 * 3) Existing `callMembers` / `effectiveCallMembers` (pruning only explicit departures).
 */
export function collectRemainingVoiceMembers({
  channelId,
  excludeUserId = null,
  presences = {},
  callMembers = [],
  effectiveCallMembers = [],
  callReceivedAt = 0,
  voiceMembers = [],
  remotePeers = [],
  peerMetadata = {},
  myPeerId = null,
  activeCallChannelId = null,
  knownProfiles = [],
} = {}) {
  const targetChan = channelId ? String(channelId) : '';
  if (!targetChan) return [];

  const excluded = excludeUserId ? String(excludeUserId) : '';
  const selfPeerId = myPeerId ? String(myPeerId) : '';
  const isLeavingActiveWebRtcChannel = Boolean(
    activeCallChannelId && String(activeCallChannelId) === targetChan
  );

  const profileIndex = buildProfileIndex(knownProfiles);
  const memberMap = new Map();
  const connectedPeerIds = new Set();
  const connectedUserIds = new Set();

  const upsertMember = (rawMember, dedupeId = null) => {
    const normalized = normalizeParticipant(rawMember, dedupeId, profileIndex, presences);
    const key = normalized.id || (normalized.peerId ? `peer:${normalized.peerId}` : '');
    if (!key) return;
    if (excluded && key === excluded) return;

    const existing = memberMap.get(key) || {};
    memberMap.set(key, {
      ...existing,
      ...normalized,
      avatar: normalized.avatar || existing.avatar || null,
      avatar_url: normalized.avatar_url || existing.avatar_url || null,
      peerId: normalized.peerId || existing.peerId || undefined,
    });
  };

  // 1. Live WebRTC peers from the active voice mesh (truth even when signaling/presence lags)
  if (isLeavingActiveWebRtcChannel) {
    (voiceMembers || []).forEach((vm) => {
      if (!vm) return;
      const vmPeerId = vm.peerId ? String(vm.peerId) : '';
      if (selfPeerId && vmPeerId && vmPeerId === selfPeerId) return;
      const vmId = resolveEntityId(vm);
      if (excluded && vmId === excluded) return;
      if (!vmId && !vmPeerId) return;

      if (vmPeerId) connectedPeerIds.add(vmPeerId);
      if (vmId) connectedUserIds.add(vmId);
      upsertMember(vm, vmId || (vmPeerId ? `peer:${vmPeerId}` : ''));
    });

    const rawWebRtcPeers = new Map();
    (remotePeers || []).forEach((p) => {
      if (p?.peerId) rawWebRtcPeers.set(String(p.peerId), p);
    });
    Object.keys(peerMetadata || {}).forEach((peerId) => {
      const key = String(peerId || '');
      if (key && !rawWebRtcPeers.has(key)) {
        rawWebRtcPeers.set(key, { peerId: key });
      }
    });

    rawWebRtcPeers.forEach((_, peerId) => {
      if (selfPeerId && peerId === selfPeerId) return;
      if (connectedPeerIds.has(peerId)) return;
      const meta = peerMetadata?.[peerId] || {};
      const metaUid = resolveEntityId(meta);
      if (excluded && metaUid === excluded) return;

      if (metaUid && connectedUserIds.has(metaUid)) {
        const existing = memberMap.get(metaUid);
        if (existing && !existing.peerId) {
          memberMap.set(metaUid, { ...existing, peerId });
        }
        connectedPeerIds.add(peerId);
        return;
      }

      connectedPeerIds.add(peerId);
      if (metaUid) connectedUserIds.add(metaUid);
      upsertMember(
        {
          ...meta,
          id: metaUid || undefined,
          peerId,
        },
        metaUid || `peer:${peerId}`
      );
    });
  }

  // 2. Authoritative global presences currently in `channelId`
  Object.entries(presences || {}).forEach(([uidKey, entry]) => {
    if (!entry || !entry.voiceChannelId) return;
    if (String(entry.voiceChannelId) !== targetChan) return;
    if (isPresenceOffline(entry) || entry.status === 'invisible') return;
    const resolvedUid = resolveEntityId(entry) || String(uidKey);
    if (!resolvedUid || (excluded && resolvedUid === excluded)) return;
    upsertMember({ ...entry, id: resolvedUid }, resolvedUid);
  });

  // 3. Existing call state seed members & merged call members
  const seedLists = [...(effectiveCallMembers || []), ...(callMembers || [])];
  seedLists.forEach((member) => {
    const uid = resolveEntityId(member);
    if (!uid || (excluded && uid === excluded)) return;

    if (!connectedUserIds.has(uid)) {
      const p = presences?.[uid];
      if (isPresenceOffline(p) || hasPresenceExplicitlyLeftChannel(p, targetChan, callReceivedAt)) {
        return;
      }
    }

    upsertMember(member, uid);
  });

  return Array.from(memberMap.values());
}

/**
 * Computes the next `channelCalls` state and outgoing `call_update` broadcast when a user leaves `channelId`.
 * Ensures a leaving peer never emits a room-wide `ended` signal if any WebRTC, presence, or call member remains.
 */
export function buildLeaveCallTransition({
  channelCalls = {},
  effectiveChannelCalls = {},
  channelId,
  leavingUserId,
  presences = {},
  voiceMembers = [],
  remotePeers = [],
  peerMetadata = {},
  myPeerId = null,
  activeCallChannelId = null,
  knownProfiles = [],
  now = Date.now(),
} = {}) {
  const targetChan = channelId ? String(channelId) : '';
  if (!targetChan) {
    return {
      nextChannelCalls: { ...(channelCalls || {}) },
      callUpdatePayload: null,
      remainingMembers: [],
    };
  }

  const currentCall = channelCalls?.[targetChan] || effectiveChannelCalls?.[targetChan] || null;
  const remainingMembers = collectRemainingVoiceMembers({
    channelId: targetChan,
    excludeUserId: leavingUserId,
    presences,
    callMembers: channelCalls?.[targetChan]?.members,
    effectiveCallMembers: effectiveChannelCalls?.[targetChan]?.members,
    callReceivedAt: currentCall?.receivedAt || 0,
    voiceMembers,
    remotePeers,
    peerMetadata,
    myPeerId,
    activeCallChannelId,
    knownProfiles,
  });

  const nextChannelCalls = { ...(channelCalls || {}) };
  if (remainingMembers.length === 0) {
    delete nextChannelCalls[targetChan];
    return {
      nextChannelCalls,
      remainingMembers,
      callUpdatePayload: {
        channelId: targetChan,
        active: false,
        stage: 'ended',
        count: 0,
        members: [],
        leftUserId: leavingUserId ? String(leavingUserId) : null,
      },
    };
  }

  const leavingIdStr = leavingUserId ? String(leavingUserId) : '';
  let nextInitiator = currentCall?.initiator || null;
  if (!nextInitiator || (leavingIdStr && resolveEntityId(nextInitiator) === leavingIdStr)) {
    nextInitiator = remainingMembers.find((m) => resolveEntityId(m) !== leavingIdStr) || remainingMembers[0] || null;
  }

  const updatedCall = {
    ...currentCall,
    channelId: targetChan,
    active: true,
    stage: 'active',
    initiator: nextInitiator,
    count: remainingMembers.length,
    members: remainingMembers,
    receivedAt: now,
  };
  nextChannelCalls[targetChan] = updatedCall;

  return {
    nextChannelCalls,
    remainingMembers,
    callUpdatePayload: {
      ...updatedCall,
      leftUserId: leavingUserId ? String(leavingUserId) : null,
    },
  };
}

/**
 * Computes the outgoing `call_update` payload when joining or starting a call in `channelId`,
 * preserving all known existing participants before appending `joiningUser`.
 */
export function buildJoinCallPayload({
  channelCalls = {},
  effectiveChannelCalls = {},
  channelId,
  joiningUser,
  presences = {},
  knownProfiles = [],
  targetUserId = null,
  targetUser = null,
  now = Date.now(),
} = {}) {
  const targetChan = channelId ? String(channelId) : '';
  const joiningId = resolveEntityId(joiningUser);
  const currentCall = channelCalls?.[targetChan] || effectiveChannelCalls?.[targetChan] || null;
  const existingOtherMembers = collectRemainingVoiceMembers({
    channelId: targetChan,
    excludeUserId: joiningId,
    presences,
    callMembers: channelCalls?.[targetChan]?.members,
    effectiveCallMembers: effectiveChannelCalls?.[targetChan]?.members,
    callReceivedAt: currentCall?.receivedAt || 0,
    knownProfiles,
  });
  const members = joiningUser ? [...existingOtherMembers, joiningUser] : existingOtherMembers;

  return {
    channelId: targetChan,
    active: true,
    stage: 'active',
    initiator: currentCall?.initiator || joiningUser || members[0] || null,
    targetUserId,
    targetUser,
    count: members.length,
    members,
    receivedAt: now,
  };
}

/**
 * Pure updater for incoming `call_status` events.
 * Never triggers local voice disconnect; removes only the leaving user when other active members remain.
 */
export function applyIncomingCallStatus(
  prevChannelCalls = {},
  data,
  { now = Date.now(), currentUserId = null, activeCallChannelId = null, isConnected = false } = {}
) {
  if (!data?.channelId) return prevChannelCalls;
  const chanId = String(data.channelId);
  const leftId = data.leftUserId ? String(data.leftUserId) : '';
  const selfIdStr = currentUserId ? String(currentUserId) : '';
  const isSelfStillConnectedInChannel = Boolean(
    isConnected &&
      activeCallChannelId &&
      String(activeCallChannelId) === chanId &&
      selfIdStr &&
      selfIdStr !== leftId
  );

  // 1. If self is actively connected to this channel, NEVER destroy or end the session,
  // even if the remote signal claims 'ended' or count 0. Prune only the leaving user.
  if (isSelfStillConnectedInChannel) {
    const existing = prevChannelCalls?.[chanId] || {};
    const existingMembers = Array.isArray(existing.members) && existing.members.length > 0
      ? existing.members
      : (data?.members && data.members.length > 0 ? data.members : []);

    const remaining = leftId
      ? existingMembers.filter((m) => resolveEntityId(m) !== leftId)
      : existingMembers;

    const hasSelf = remaining.some((m) => resolveEntityId(m) === selfIdStr);
    const finalMembers = hasSelf
      ? remaining
      : [...remaining, { id: selfIdStr, user_id: selfIdStr }];

    let initiator = data?.initiator || existing?.initiator;
    if (!initiator || (leftId && resolveEntityId(initiator) === leftId)) {
      initiator = finalMembers.find((m) => resolveEntityId(m) !== leftId) || finalMembers[0] || null;
    }

    return {
      ...prevChannelCalls,
      [chanId]: {
        ...existing,
        channelId: chanId,
        active: true,
        stage: 'active',
        initiator,
        targetUserId: data?.targetUserId ?? existing?.targetUserId ?? null,
        targetUser: data?.targetUser ?? existing?.targetUser ?? null,
        count: finalMembers.length,
        members: finalMembers,
        receivedAt: now,
      },
    };
  }

  // 2. Incoming signal is an explicit end or empty count
  if (!data.active || (data.count === 0 && (!data.members || data.members.length === 0))) {
    const existing = prevChannelCalls?.[chanId];
    if (leftId && existing?.members?.length) {
      const remaining = existing.members.filter((m) => resolveEntityId(m) !== leftId);
      if (remaining.length > 0) {
        let initiator = existing.initiator;
        if (!initiator || resolveEntityId(initiator) === leftId) {
          initiator = remaining[0] || null;
        }
        return {
          ...prevChannelCalls,
          [chanId]: {
            ...existing,
            channelId: chanId,
            active: true,
            stage: 'active',
            initiator,
            count: remaining.length,
            members: remaining,
            receivedAt: now,
          },
        };
      }
    }

    const next = { ...(prevChannelCalls || {}) };
    delete next[chanId];
    return next;
  }

  // 3. Normal active call update
  const incomingMembers = Array.isArray(data.members) ? data.members : (data.initiator ? [data.initiator] : []);
  const filteredIncoming = leftId
    ? incomingMembers.filter((m) => resolveEntityId(m) !== leftId)
    : incomingMembers;

  let finalInitiator = data.initiator;
  if (leftId && finalInitiator && resolveEntityId(finalInitiator) === leftId) {
    finalInitiator = filteredIncoming[0] || null;
  }

  return {
    ...(prevChannelCalls || {}),
    [chanId]: {
      active: true,
      stage: 'active',
      channelId: chanId,
      initiator: finalInitiator,
      targetUserId: data.targetUserId,
      targetUser: data.targetUser,
      count: filteredIncoming.length || data.count || 1,
      members: filteredIncoming,
      receivedAt: now,
    },
  };
}
