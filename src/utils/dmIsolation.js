/**
 * Pure Direct-Message (DM) room and participant isolation helpers.
 * Ensures legacy single-user `dm-<userId>` rows, stale caches, or realtime
 * events from other conversations cannot leak into an unrelated DM thread.
 */

export const normalizeParticipantId = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
  return trimmed;
};

export const isFriendshipSystemMessage = (row) => {
  if (!row) return false;
  if (row.room_id === 'dm-friendship-requests' || row.room === 'dm-friendship-requests') {
    return true;
  }
  return Array.isArray(row.lines) && typeof row.lines[0] === 'string' && row.lines[0].startsWith('__FRIEND_REQUEST:');
};

export const parseDmRoomPair = (roomId) => {
  if (typeof roomId !== 'string' || !roomId.startsWith('dm-')) return null;
  const body = roomId.slice(3);
  const parts = body.split('--');
  if (parts.length !== 2) return null;
  const first = normalizeParticipantId(parts[0]);
  const second = normalizeParticipantId(parts[1]);
  if (!first || !second) return null;
  return [first, second];
};

export const getCanonicalDmRoomId = (user1Id, user2Id) => {
  const u1 = normalizeParticipantId(user1Id);
  const u2 = normalizeParticipantId(user2Id);
  if (!u1 || !u2) {
    return `dm-${u2 || u1 || 'unknown'}`;
  }
  const [first, second] = [u1, u2].sort();
  return `dm-${first}--${second}`;
};

const isSameUnorderedPair = (a1, a2, b1, b2) =>
  (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);

/**
 * Strictly determines whether a DB row or cached message belongs exclusively
 * to the 1:1 DM conversation between `user1Id` and `user2Id`.
 */
export const isDirectMessageForPair = (row, user1Id, user2Id) => {
  if (!row || isFriendshipSystemMessage(row)) return false;

  const u1 = normalizeParticipantId(user1Id);
  const u2 = normalizeParticipantId(user2Id);
  if (!u1 || !u2) return false;

  const sender = normalizeParticipantId(row.sender_id ?? row.userId ?? row.user_id);
  const receiver = normalizeParticipantId(row.receiver_id ?? row.recipient_id);

  // When both participant IDs exist, both endpoints must match {u1, u2} regardless of room_id
  if (sender && receiver) {
    return isSameUnorderedPair(sender, receiver, u1, u2);
  }

  // Fallback only for offline/cached items missing receiver_id: require a canonical/pair room matching {u1, u2}
  // and a sender strictly belonging to one of the two participants. Never trust legacy single-ID `dm-<id>` alone.
  const roomPair = parseDmRoomPair(row.room_id ?? row.room);
  if (!roomPair || !sender) return false;

  return isSameUnorderedPair(roomPair[0], roomPair[1], u1, u2) && (sender === u1 || sender === u2);
};

/**
 * Resolves the friend/partner user ID for a DM row relative to `currentUserId`,
 * returning `null` if `currentUserId` is not a verified participant or if the
 * resolved partner is outside `validFriendIds` (when provided).
 */
export const resolveDirectMessagePartner = (row, currentUserId, validFriendIds = null) => {
  if (!row || isFriendshipSystemMessage(row)) return null;

  const me = normalizeParticipantId(currentUserId);
  if (!me) return null;

  const sender = normalizeParticipantId(row.sender_id ?? row.userId ?? row.user_id);
  const receiver = normalizeParticipantId(row.receiver_id ?? row.recipient_id);
  const roomPair = parseDmRoomPair(row.room_id ?? row.room);

  let partner = null;
  if (sender && receiver) {
    if (sender === me) partner = receiver;
    else if (receiver === me) partner = sender;
    else return null;
  } else if (roomPair) {
    if (roomPair[0] === me) partner = roomPair[1];
    else if (roomPair[1] === me) partner = roomPair[0];
    else return null;
  } else {
    return null;
  }

  if (!partner) return null;

  if (validFriendIds !== null && validFriendIds !== undefined) {
    const allowedSet =
      validFriendIds instanceof Set
        ? validFriendIds
        : new Set(Array.from(validFriendIds).map(normalizeParticipantId).filter(Boolean));
    if (!allowedSet.has(partner)) return null;
  }

  return isDirectMessageForPair(row, me, partner) ? partner : null;
};

export const sanitizeDmMessagesList = (messages, user1Id, user2Id) => {
  if (!Array.isArray(messages)) return [];
  return messages.filter((msg) => isDirectMessageForPair(msg, user1Id, user2Id));
};

/**
 * Cleans a persisted `standupp_db_dm_msgs` dictionary in-place structure:
 * - Normalizes pair keys `dm-<a>--<b>` to sorted canonical room IDs
 * - Strips any message that fails `isDirectMessageForPair(msg, a, b)`
 * - Migrates any legacy single-ID bucket messages that carry full `(sender_id, receiver_id)`
 *   metadata into their canonical room bucket, and drops unattributed single-ID buckets.
 */
export const sanitizeDmMessagesMap = (rawMap) => {
  const source = rawMap && typeof rawMap === 'object' ? rawMap : {};
  const cleanedMap = {};
  let changed = false;

  const upsertIntoCanonical = (canonicalKey, msg) => {
    if (!cleanedMap[canonicalKey]) cleanedMap[canonicalKey] = [];
    const list = cleanedMap[canonicalKey];
    if (msg?.id && list.some((existing) => existing?.id === msg.id)) {
      return;
    }
    list.push(msg);
  };

  Object.entries(source).forEach(([roomKey, rawList]) => {
    const list = Array.isArray(rawList) ? rawList : [];
    const pair = parseDmRoomPair(roomKey);

    if (pair) {
      const canonical = getCanonicalDmRoomId(pair[0], pair[1]);
      if (canonical !== roomKey) changed = true;

      const valid = sanitizeDmMessagesList(list, pair[0], pair[1]);
      if (valid.length !== list.length) changed = true;

      valid.forEach((msg) => upsertIntoCanonical(canonical, msg));
      return;
    }

    // Legacy non-pair key (e.g. `dm-<userId>`): drop key, migrating only fully attributed rows.
    changed = true;
    list.forEach((msg) => {
      if (!msg || isFriendshipSystemMessage(msg)) return;
      const sender = normalizeParticipantId(msg.sender_id ?? msg.userId ?? msg.user_id);
      const receiver = normalizeParticipantId(msg.receiver_id ?? msg.recipient_id);
      if (!sender || !receiver) return;
      const canonical = getCanonicalDmRoomId(sender, receiver);
      upsertIntoCanonical(canonical, {
        ...msg,
        room_id: canonical,
        room: canonical,
        sender_id: sender,
        receiver_id: receiver,
      });
    });
  });

  // Sort messages chronologically within each canonical room bucket
  Object.values(cleanedMap).forEach((list) => {
    list.sort((a, b) => (Number(a?.sentAt ?? a?.sent_at) || 0) - (Number(b?.sentAt ?? b?.sent_at) || 0));
  });

  return { cleanedMap, changed };
};
