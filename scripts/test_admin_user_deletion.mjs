import assert from 'node:assert/strict';
import {
  ADMIN_USER_ID,
  ADMIN_EMAIL,
  PROFILE_CACHE_KEY,
  PEER_AUDIO_PREFS_KEY,
  isProtectedAdminIdentity,
  removeCachedUserProfile,
  purgeUserFromMessagesMap,
  purgeUserFromStorage,
} from '../src/utils/userPurge.js';
import { getCanonicalDmRoomId } from '../src/utils/dmIsolation.js';

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
};

const createMemoryStorage = (initial = {}) => {
  const map = new Map();
  for (const [k, v] of Object.entries(initial)) {
    map.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    dump(key) {
      const raw = this.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
  };
};

const ADMIN_ID = ADMIN_USER_ID;
const LYRING_ID = '11111111-1111-1111-1111-111111111111';
const UDINESE_ID = '22222222-2222-2222-2222-222222222222';
const RAIN_ID = '33333333-3333-3333-3333-333333333333';

test('Primary admin identity is protected from deletion by ID, email, or admin flag', () => {
  assert.equal(isProtectedAdminIdentity(ADMIN_ID), true);
  assert.equal(isProtectedAdminIdentity(ADMIN_ID.toUpperCase()), true);
  assert.equal(isProtectedAdminIdentity(ADMIN_EMAIL), true);
  assert.equal(isProtectedAdminIdentity({ id: ADMIN_ID }), true);
  assert.equal(isProtectedAdminIdentity({ id: LYRING_ID, email: ADMIN_EMAIL }), true);
  assert.equal(isProtectedAdminIdentity({ id: LYRING_ID, is_admin: true }), true);
  assert.equal(isProtectedAdminIdentity({ id: LYRING_ID, app_metadata: { role: 'admin' } }), true);
  assert.equal(isProtectedAdminIdentity({ id: UDINESE_ID, email: 'test@voys.test' }), false);
  assert.equal(isProtectedAdminIdentity(UDINESE_ID), false);
});

test('purgeUserFromMessagesMap removes deleted user DM rooms and channel messages while preserving unrelated chats', () => {
  const dmLyringUdinese = getCanonicalDmRoomId(LYRING_ID, UDINESE_ID);
  const dmLyringRain = getCanonicalDmRoomId(LYRING_ID, RAIN_ID);
  const inputMap = {
    [dmLyringUdinese]: [
      { id: 'm1', sender_id: UDINESE_ID, receiver_id: LYRING_ID, text: 'Selam' },
      { id: 'm2', sender_id: LYRING_ID, receiver_id: UDINESE_ID, text: 'Aleykum selam' },
    ],
    [`dm-${UDINESE_ID}`]: [{ id: 'm3', sender_id: UDINESE_ID, text: 'legacy' }],
    [dmLyringRain]: [
      { id: 'm4', sender_id: RAIN_ID, receiver_id: LYRING_ID, text: 'Naber' },
    ],
    'text-game-fedaileri': [
      { id: 'g1', sender_id: UDINESE_ID, channel_id: 'text-game-fedaileri', text: 'Silinecek' },
      { id: 'g2', sender_id: RAIN_ID, channel_id: 'text-game-fedaileri', text: 'Kalacak' },
    ],
  };

  const cleaned = purgeUserFromMessagesMap(inputMap, UDINESE_ID);
  assert.equal(cleaned[dmLyringUdinese], undefined);
  assert.equal(cleaned[`dm-${UDINESE_ID}`], undefined);
  assert.equal(cleaned[dmLyringRain].length, 1);
  assert.equal(cleaned[dmLyringRain][0].id, 'm4');
  assert.equal(cleaned['text-game-fedaileri'].length, 1);
  assert.equal(cleaned['text-game-fedaileri'][0].id, 'g2');

  // Returns exact reference when target user has nothing to purge
  const noOp = purgeUserFromMessagesMap(cleaned, UDINESE_ID);
  assert.equal(noOp, cleaned);
});

test('purgeUserFromStorage cleans every user-linked storage record without harming remaining users', () => {
  const dmLyringUdinese = getCanonicalDmRoomId(LYRING_ID, UDINESE_ID);
  const dmLyringRain = getCanonicalDmRoomId(LYRING_ID, RAIN_ID);

  const storage = createMemoryStorage({
    standupp_local_users: [
      { id: LYRING_ID, username: 'lyring' },
      { id: UDINESE_ID, username: 'udinese' },
      { id: RAIN_ID, username: 'rain' },
    ],
    standupp_db_friendships: [
      { id: 'f1', user_id: LYRING_ID, friend_id: UDINESE_ID, status: 'accepted' },
      { id: 'f2', user_id: LYRING_ID, friend_id: RAIN_ID, status: 'accepted' },
    ],
    standupp_db_channel_members: [
      { channel_id: 'c1', user_id: LYRING_ID, role: 'admin' },
      { channel_id: 'c1', user_id: UDINESE_ID, role: 'member' },
      { channel_id: 'c1', user_id: RAIN_ID, role: 'member' },
    ],
    standupp_db_channels: [
      { id: 'c1', name: 'Genel', created_by: UDINESE_ID },
      { id: 'c2', name: 'Ozel', created_by: LYRING_ID },
    ],
    standupp_db_dm_msgs: [
      { id: 'd1', sender_id: UDINESE_ID, receiver_id: LYRING_ID, dm_room_id: dmLyringUdinese },
      { id: 'd2', sender_id: LYRING_ID, receiver_id: RAIN_ID, dm_room_id: dmLyringRain },
    ],
    standupp_db_channel_msgs: [
      { id: 'cmsg1', channel_id: 'c1', sender_id: UDINESE_ID, content: 'test' },
      { id: 'cmsg2', channel_id: 'c1', sender_id: LYRING_ID, content: 'ok' },
    ],
    standupp_local_session: { user: { id: UDINESE_ID, email: 'u@voys.test' } },
    [`standupp_user_profile_${UDINESE_ID}`]: { id: UDINESE_ID, username: 'udinese' },
    [`voys_read_receipts_${UDINESE_ID}`]: { c1: 1234 },
    [`voys_user_channels_${UDINESE_ID}`]: [{ id: 'c1' }],
    [`standupp_user_profile_${LYRING_ID}`]: { id: LYRING_ID, username: 'lyring' },
    [PEER_AUDIO_PREFS_KEY]: {
      [UDINESE_ID]: { volume: 150, muted: false },
      [RAIN_ID]: { volume: 110, muted: false },
    },
    [PROFILE_CACHE_KEY]: {
      [UDINESE_ID]: { id: UDINESE_ID, username: 'udinese' },
      [LYRING_ID]: { id: LYRING_ID, username: 'lyring' },
    },
  });

  const summary = purgeUserFromStorage(UDINESE_ID, storage);
  assert.equal(summary.sessionCleared, true);
  assert.equal(summary.cacheCleared, true);

  assert.deepEqual(
    storage.dump('standupp_local_users').map((u) => u.id),
    [LYRING_ID, RAIN_ID]
  );
  assert.deepEqual(
    storage.dump('standupp_db_friendships').map((f) => f.id),
    ['f2']
  );
  assert.deepEqual(
    storage.dump('standupp_db_channel_members').map((m) => m.user_id),
    [LYRING_ID, RAIN_ID]
  );
  assert.equal(storage.dump('standupp_db_channels')[0].created_by, null);
  assert.equal(storage.dump('standupp_db_channels')[1].created_by, LYRING_ID);
  assert.deepEqual(
    storage.dump('standupp_db_dm_msgs').map((m) => m.id),
    ['d2']
  );
  assert.deepEqual(
    storage.dump('standupp_db_channel_msgs').map((m) => m.id),
    ['cmsg2']
  );
  assert.equal(storage.getItem('standupp_local_session'), null);
  assert.equal(storage.getItem(`standupp_user_profile_${UDINESE_ID}`), null);
  assert.equal(storage.getItem(`voys_read_receipts_${UDINESE_ID}`), null);
  assert.equal(storage.getItem(`voys_user_channels_${UDINESE_ID}`), null);
  assert.ok(storage.dump(`standupp_user_profile_${LYRING_ID}`));
  assert.deepEqual(storage.dump(PEER_AUDIO_PREFS_KEY), { [RAIN_ID]: { volume: 110, muted: false } });
  assert.deepEqual(storage.dump(PROFILE_CACHE_KEY), { [LYRING_ID]: { id: LYRING_ID, username: 'lyring' } });

  // removeCachedUserProfile returns false cleanly when user is absent
  assert.equal(removeCachedUserProfile(UDINESE_ID, storage), false);
});
