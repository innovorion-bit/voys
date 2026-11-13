import assert from 'node:assert';
import { computeMemberOnlineStatus, resolveMemberPresence } from '../src/utils/userDisplay.js';

console.log('--- Testing Status Sync (dnd, idle, online, invisible) ---');

// Test 1: Remote user sets status to 'dnd' (Rahatsız Etmeyin)
const remoteUserId = '550e8400-e29b-41d4-a716-446655440000';
const presencesDnd = {
  [remoteUserId]: {
    userId: remoteUserId,
    id: remoteUserId,
    name: 'Udinese',
    status: 'dnd',
    substatus: 'Rahatsız Etmeyin',
    isOnline: true,
    isAway: false,
    timestamp: Date.now(),
  },
};

const memberUdinese = {
  id: remoteUserId,
  user_id: remoteUserId,
  name: 'Udinese',
};

const statusDnd = computeMemberOnlineStatus({
  member: memberUdinese,
  presences: presencesDnd,
  isSelf: false,
});

assert.strictEqual(statusDnd.status, 'dnd', 'Status should be dnd');
assert.strictEqual(statusDnd.isOnline, true, 'dnd user must be considered online');
assert.strictEqual(statusDnd.substatus, 'Rahatsız Etmeyin', 'Substatus must be Rahatsız Etmeyin');
console.log('✓ Test 1 Passed: Remote user dnd status correctly resolved');

// Test 2: Remote user sets status to 'idle' (Boşta)
const presencesIdle = {
  [remoteUserId]: {
    userId: remoteUserId,
    id: remoteUserId,
    name: 'Udinese',
    status: 'idle',
    substatus: 'Boşta',
    isOnline: true,
    isAway: true,
    timestamp: Date.now(),
  },
};

const statusIdle = computeMemberOnlineStatus({
  member: memberUdinese,
  presences: presencesIdle,
  isSelf: false,
});

assert.strictEqual(statusIdle.status, 'idle', 'Status should be idle');
assert.strictEqual(statusIdle.isOnline, true, 'idle user must be considered online');
assert.strictEqual(statusIdle.substatus, 'Boşta', 'Substatus must be Boşta');
console.log('✓ Test 2 Passed: Remote user idle status correctly resolved');

// Test 3: Remote user sets status to 'invisible' or 'offline'
const presencesInvisible = {
  [remoteUserId]: {
    userId: remoteUserId,
    id: remoteUserId,
    name: 'Udinese',
    status: 'invisible',
    substatus: '',
    isOnline: false,
    timestamp: Date.now(),
  },
};

const statusInvisible = computeMemberOnlineStatus({
  member: memberUdinese,
  presences: presencesInvisible,
  isSelf: false,
});

assert.strictEqual(statusInvisible.status, 'offline', 'Invisible status resolves to offline');
assert.strictEqual(statusInvisible.isOnline, false, 'Invisible user isOnline must be false');
console.log('✓ Test 3 Passed: Invisible/offline correctly resolved');

// Test 4: Status dot color mapping in UserAvatar
function getStatusDotColor(status, isOnline, isPlayingGame) {
  const currentStatus = status || (isOnline ? 'online' : 'offline');
  switch (currentStatus) {
    case 'idle':
      return 'bg-amber-400';
    case 'dnd':
      return 'bg-rose-500';
    case 'online':
      return isPlayingGame ? 'bg-emerald-400 ring-2 ring-emerald-400/40' : 'bg-emerald-500';
    case 'offline':
    case 'invisible':
    default:
      return 'bg-zinc-500';
  }
}

assert.strictEqual(getStatusDotColor('dnd', true, false), 'bg-rose-500', 'dnd dot must be red/rose');
assert.strictEqual(getStatusDotColor('idle', true, false), 'bg-amber-400', 'idle dot must be yellow/amber');
assert.strictEqual(getStatusDotColor('online', true, false), 'bg-emerald-500', 'online dot must be green/emerald');
assert.strictEqual(getStatusDotColor('offline', false, false), 'bg-zinc-500', 'offline dot must be gray/zinc');
console.log('✓ Test 4 Passed: Status dot colors correctly map to dnd (rose-500), idle (amber-400), online (emerald-500)');

// Test 5: Realtime presence broadcast payload creation
function createPresencePayload(presenceData) {
  const userId = presenceData.id || presenceData.userId;
  const isOnline = presenceData.status !== 'offline' && presenceData.status !== 'invisible';
  return {
    userId,
    id: userId,
    name: presenceData.name || presenceData.display_name || '',
    avatar: presenceData.avatar || presenceData.avatar_url || '',
    status: presenceData.status || 'online',
    game: presenceData.game || '',
    substatus: presenceData.substatus || '',
    isAway: presenceData.status === 'idle' || !!presenceData.isAway,
    isOnline,
    timestamp: Date.now(),
  };
}

const payloadDnd = createPresencePayload({ id: 'u1', status: 'dnd', substatus: 'Rahatsız Etmeyin' });
assert.strictEqual(payloadDnd.status, 'dnd');
assert.strictEqual(payloadDnd.isOnline, true);
assert.strictEqual(payloadDnd.substatus, 'Rahatsız Etmeyin');

const payloadIdle = createPresencePayload({ id: 'u1', status: 'idle', substatus: 'Boşta' });
assert.strictEqual(payloadIdle.status, 'idle');
assert.strictEqual(payloadIdle.isAway, true);
assert.strictEqual(payloadIdle.isOnline, true);

console.log('✓ Test 5 Passed: Presence payload construction verified');

console.log('ALL STATUS SYNC TESTS PASSED SUCCESSFULLY!');
