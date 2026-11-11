import assert from 'node:assert/strict';
import {
  normalizeParticipantId,
  parseDmRoomPair,
  getCanonicalDmRoomId,
  isFriendshipSystemMessage,
  isDirectMessageForPair,
  resolveDirectMessagePartner,
  sanitizeDmMessagesList,
  sanitizeDmMessagesMap,
} from '../src/utils/dmIsolation.js';

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
};

const LYRING_ID = '11111111-1111-1111-1111-111111111111';
const UDINESE_ID = '22222222-2222-2222-2222-222222222222';
const RAIN_ID = '33333333-3333-3333-3333-333333333333';
const BERAT_ID = '44444444-4444-4444-4444-444444444444';

test('Canonical DM room IDs are symmetric and single-ID legacy rooms do not parse as pairs', () => {
  assert.equal(
    getCanonicalDmRoomId(LYRING_ID, RAIN_ID),
    getCanonicalDmRoomId(RAIN_ID, LYRING_ID)
  );
  assert.deepEqual(parseDmRoomPair(`dm-${RAIN_ID}--${LYRING_ID}`), [RAIN_ID, LYRING_ID]);
  assert.equal(parseDmRoomPair(`dm-${LYRING_ID}`), null);
  assert.equal(parseDmRoomPair('home'), null);
  assert.equal(normalizeParticipantId('undefined'), null);
  assert.equal(normalizeParticipantId('null'), null);
});

test('Legacy dm-<LyringID> row sent by Udinese never leaks into Lyring <-> RAİN or Lyring <-> Berat', () => {
  const legacyUdineseToLyring = {
    id: 'msg-udinese-selam',
    room_id: `dm-${LYRING_ID}`,
    sender_id: UDINESE_ID,
    receiver_id: LYRING_ID,
    sender_name: 'Udinese',
    lines: ['Selam'],
    sent_at: 1793656500000,
  };

  assert.equal(isDirectMessageForPair(legacyUdineseToLyring, LYRING_ID, RAIN_ID), false);
  assert.equal(isDirectMessageForPair(legacyUdineseToLyring, LYRING_ID, BERAT_ID), false);
  // Still belongs strictly to Lyring <-> Udinese where it actually originated
  assert.equal(isDirectMessageForPair(legacyUdineseToLyring, LYRING_ID, UDINESE_ID), true);
  assert.equal(isDirectMessageForPair(legacyUdineseToLyring, UDINESE_ID, LYRING_ID), true);
});

test('Genuine legacy single-ID DM between Lyring and RAİN with exact participants remains visible', () => {
  const legacyRainToLyring = {
    id: 'msg-rain-to-lyring',
    room_id: `dm-${LYRING_ID}`,
    sender_id: RAIN_ID,
    receiver_id: LYRING_ID,
    sender_name: 'RAİN',
    lines: ['Merhaba Lyring'],
    sent_at: 1793656600000,
  };

  assert.equal(isDirectMessageForPair(legacyRainToLyring, LYRING_ID, RAIN_ID), true);
  assert.equal(isDirectMessageForPair(legacyRainToLyring, LYRING_ID, UDINESE_ID), false);
});

test('Poisoned row even inside canonical room bucket fails pair validation when sender/receiver mismatch', () => {
  const canonicalLyringRain = getCanonicalDmRoomId(LYRING_ID, RAIN_ID);

  // Poisoned DB-like row with Udinese sender saved into canonical key
  const poisonedWithWrongSender = {
    id: 'poison-1',
    room_id: canonicalLyringRain,
    sender_id: UDINESE_ID,
    receiver_id: LYRING_ID,
    userId: UDINESE_ID,
    user: 'Udinese',
    lines: ['Selam'],
  };
  assert.equal(isDirectMessageForPair(poisonedWithWrongSender, LYRING_ID, RAIN_ID), false);

  // Pre-fix mapped local cache object (omits receiver_id, keeps legacy room_id dm-<LyringID> and userId Udinese)
  const poisonedCachedObj = {
    id: 'poison-cache-1',
    room_id: `dm-${LYRING_ID}`,
    userId: UDINESE_ID,
    user: 'Udinese',
    lines: ['Selam'],
    sentAt: 1793656500000,
  };
  assert.equal(isDirectMessageForPair(poisonedCachedObj, LYRING_ID, RAIN_ID), false);

  // Pre-fix mapped local cache from Lyring -> Berat poisoned into Lyring <-> RAİN via dm-<LyringID>
  const lyringToBeratPoisonedCache = {
    id: 'poison-cache-2',
    room_id: `dm-${LYRING_ID}`,
    userId: LYRING_ID,
    user: 'Lyring',
    lines: ['Berat nasılsın'],
  };
  assert.equal(isDirectMessageForPair(lyringToBeratPoisonedCache, LYRING_ID, RAIN_ID), false);
});

test('Offline local pair messages without receiver_id work only when room & sender match the pair', () => {
  const canonicalLyringRain = getCanonicalDmRoomId(LYRING_ID, RAIN_ID);
  const offlineLocalMsg = {
    id: 'local-1',
    room: canonicalLyringRain,
    userId: LYRING_ID,
    user: 'Lyring',
    lines: ['Offline mesaj'],
  };
  assert.equal(isDirectMessageForPair(offlineLocalMsg, LYRING_ID, RAIN_ID), true);
  assert.equal(isDirectMessageForPair(offlineLocalMsg, LYRING_ID, BERAT_ID), false);

  const tamperedSender = { ...offlineLocalMsg, userId: UDINESE_ID };
  assert.equal(isDirectMessageForPair(tamperedSender, LYRING_ID, RAIN_ID), false);
});

test('Friendship system requests are always excluded from DM threads and sidebar previews', () => {
  const friendReqRow = {
    id: 'fr-1',
    room_id: 'dm-friendship-requests',
    sender_id: UDINESE_ID,
    receiver_id: LYRING_ID,
    lines: ['__FRIEND_REQUEST:{"action":"pending"}'],
  };
  assert.equal(isFriendshipSystemMessage(friendReqRow), true);
  assert.equal(isDirectMessageForPair(friendReqRow, LYRING_ID, UDINESE_ID), false);
  assert.equal(resolveDirectMessagePartner(friendReqRow, LYRING_ID), null);
});

test('resolveDirectMessagePartner never assigns third-party or cross-account DMs to wrong sidebar friend', () => {
  const validFriends = new Set([RAIN_ID, UDINESE_ID, BERAT_ID]);

  // Udinese <-> RAİN message must return null for Lyring
  const udineseToRain = {
    id: 'm-u-r',
    room_id: `dm-${RAIN_ID}`,
    sender_id: UDINESE_ID,
    receiver_id: RAIN_ID,
    lines: ['Selam RAİN'],
  };
  assert.equal(resolveDirectMessagePartner(udineseToRain, LYRING_ID, validFriends), null);

  // Udinese -> Lyring in legacy single room dm-<LyringID> must resolve strictly to UDINESE_ID, never RAIN_ID
  const udineseToLyring = {
    id: 'm-u-l',
    room_id: `dm-${LYRING_ID}`,
    sender_id: UDINESE_ID,
    receiver_id: LYRING_ID,
    lines: ['Selam'],
  };
  assert.equal(resolveDirectMessagePartner(udineseToLyring, LYRING_ID, validFriends), UDINESE_ID);
  assert.equal(resolveDirectMessagePartner(udineseToLyring, LYRING_ID, new Set([RAIN_ID])), null);
});

test('sanitizeDmMessagesMap cleans poisoned localStorage caches and normalizes room keys', () => {
  const canonicalLyringRain = getCanonicalDmRoomId(LYRING_ID, RAIN_ID);
  const unsortedKey = `dm-${RAIN_ID}--${LYRING_ID}`;
  const canonicalLyringUdinese = getCanonicalDmRoomId(LYRING_ID, UDINESE_ID);

  const rawCache = {
    // Poisoned cache under canonical Lyring--Rain containing Udinese message
    [canonicalLyringRain]: [
      {
        id: 'poison-selam',
        room_id: `dm-${LYRING_ID}`,
        userId: UDINESE_ID,
        user: 'Udinese',
        lines: ['Selam'],
        sentAt: 1000,
      },
      {
        id: 'real-rain-1',
        room_id: canonicalLyringRain,
        sender_id: RAIN_ID,
        receiver_id: LYRING_ID,
        userId: RAIN_ID,
        user: 'RAİN',
        lines: ['Selam Lyring'],
        sentAt: 2000,
      },
    ],
    // Unsorted canonical bucket for same pair
    [unsortedKey]: [
      {
        id: 'real-lyring-2',
        room_id: canonicalLyringRain,
        sender_id: LYRING_ID,
        receiver_id: RAIN_ID,
        userId: LYRING_ID,
        user: 'Lyring',
        lines: ['Naber'],
        sentAt: 3000,
      },
    ],
    // Legacy single-ID bucket with mixed attributed and unattributed messages
    [`dm-${LYRING_ID}`]: [
      {
        id: 'legacy-attributed',
        room_id: `dm-${LYRING_ID}`,
        sender_id: UDINESE_ID,
        receiver_id: LYRING_ID,
        userId: UDINESE_ID,
        user: 'Udinese',
        lines: ['Selam'],
        sentAt: 1500,
      },
      {
        id: 'legacy-unattributed',
        room_id: `dm-${LYRING_ID}`,
        userId: UDINESE_ID,
        user: 'Udinese',
        lines: ['Orphan'],
        sentAt: 1600,
      },
    ],
  };

  const { cleanedMap, changed } = sanitizeDmMessagesMap(rawCache);
  assert.equal(changed, true);

  // Poisoned Udinese message is gone from Lyring<->Rain, both real messages kept & sorted
  assert.deepEqual(
    cleanedMap[canonicalLyringRain].map((m) => m.id),
    ['real-rain-1', 'real-lyring-2']
  );

  // Unsorted bucket and legacy single-ID bucket removed
  assert.equal(cleanedMap[unsortedKey], undefined);
  assert.equal(cleanedMap[`dm-${LYRING_ID}`], undefined);

  // Attributed legacy Udinese->Lyring message migrated safely to Lyring<->Udinese canonical room
  assert.deepEqual(
    cleanedMap[canonicalLyringUdinese].map((m) => m.id),
    ['legacy-attributed']
  );

  // sanitizeDmMessagesList standalone check
  assert.equal(sanitizeDmMessagesList(rawCache[canonicalLyringRain], LYRING_ID, RAIN_ID).length, 1);
});

console.log('All DM isolation tests passed.');
