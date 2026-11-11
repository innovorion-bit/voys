import assert from 'node:assert/strict';
import {
  mergeChannelCallsWithPresences,
  partitionSidebarGroupMembers,
} from '../src/utils/userDisplay.js';

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
};

const channelId = 'chan-group-1';
const currentUser = { id: 'u-berat', name: 'Berat', username: 'berat', isOnline: true, status: 'online' };
const userRain = { id: 'u-rain', name: 'RAİN', username: 'rain', isOnline: true, status: 'online' };
const userHuseyin = {
  id: 'u-huseyin',
  name: 'MafiKK-Hüseyin',
  username: 'huseyin',
  isOnline: true,
  status: 'online',
};
const userLyring = { id: 'u-lyring', name: 'Lyring', username: 'lyring', isOnline: true, status: 'online' };
const groupMembers = [currentUser, userRain, userHuseyin, userLyring];

test('Non-joined group viewer sees active voice participants solely from global presences', () => {
  const presences = {
    'u-rain': { userId: 'u-rain', name: 'RAİN', status: 'online', isOnline: true, voiceChannelId: channelId },
    'u-huseyin': {
      userId: 'u-huseyin',
      name: 'MafiKK-Hüseyin',
      status: 'online',
      isOnline: true,
      voiceChannelId: channelId,
    },
    'u-lyring': {
      userId: 'u-lyring',
      name: 'Lyring',
      status: 'online',
      isOnline: true,
      voiceChannelId: channelId,
    },
  };

  const effectiveCalls = mergeChannelCallsWithPresences({
    channelCalls: {}, // Simulate late login / missed ephemeral broadcast
    presences,
    knownProfiles: groupMembers,
    activeCallChannelId: null,
    isConnected: false,
    voiceMembers: [],
    currentUser,
  });

  assert.equal(Boolean(effectiveCalls[channelId]?.active), true);
  assert.equal(effectiveCalls[channelId]?.count, 3);
  assert.deepEqual(
    effectiveCalls[channelId].members.map((m) => m.id).sort(),
    ['u-huseyin', 'u-lyring', 'u-rain']
  );

  const partitioned = partitionSidebarGroupMembers({
    effectiveMembers: groupMembers,
    callMembers: effectiveCalls[channelId].members,
    isCallActive: Boolean(effectiveCalls[channelId]?.active),
    isInCall: false,
    currentUser,
    callInitiator: effectiveCalls[channelId].initiator,
  });

  assert.equal(partitioned.showVoiceSection, true);
  assert.equal(partitioned.voiceMembers.length, 3);
  assert.deepEqual(
    partitioned.groupMembers.map((m) => m.id),
    ['u-berat']
  );
});

test('Offline/disconnected peers are removed even if stale channelCalls broadcast remains', () => {
  const effectiveCalls = mergeChannelCallsWithPresences({
    channelCalls: {
      [channelId]: {
        active: true,
        channelId,
        members: [userRain, userHuseyin],
        receivedAt: 1000,
      },
    },
    presences: {
      'u-rain': { userId: 'u-rain', status: 'offline', isOnline: false, voiceChannelId: null, receivedAt: 2000 },
      'u-huseyin': {
        userId: 'u-huseyin',
        name: 'MafiKK-Hüseyin',
        status: 'online',
        isOnline: true,
        voiceChannelId: channelId,
        receivedAt: 2000,
      },
    },
    knownProfiles: groupMembers,
    activeCallChannelId: null,
    isConnected: false,
    voiceMembers: [],
    currentUser,
  });

  assert.equal(effectiveCalls[channelId]?.count, 1);
  assert.deepEqual(
    effectiveCalls[channelId]?.members.map((m) => m.id),
    ['u-huseyin']
  );
});

test('Contradicting global presence prunes stale call member after 1500ms grace window', () => {
  // Within grace window (< 1500ms): keep member to prevent join/leave race flicker
  const withinGrace = mergeChannelCallsWithPresences({
    channelCalls: {
      [channelId]: { active: true, channelId, members: [userRain], receivedAt: 1000 },
    },
    presences: {
      'u-rain': { userId: 'u-rain', status: 'online', isOnline: true, voiceChannelId: null, receivedAt: 2000 },
    },
    knownProfiles: groupMembers,
    currentUser,
  });
  assert.equal(withinGrace[channelId]?.count, 1);

  // Past grace window (>= 1500ms): prune member whose presence left voiceChannelId
  const afterGrace = mergeChannelCallsWithPresences({
    channelCalls: {
      [channelId]: { active: true, channelId, members: [userRain], receivedAt: 1000 },
    },
    presences: {
      'u-rain': { userId: 'u-rain', status: 'online', isOnline: true, voiceChannelId: null, receivedAt: 2600 },
    },
    knownProfiles: groupMembers,
    currentUser,
  });
  assert.equal(afterGrace[channelId], undefined);
});

test('Unconnected self is excluded even if stale presence or broadcast still lists self', () => {
  const effectiveCalls = mergeChannelCallsWithPresences({
    channelCalls: {
      [channelId]: { active: true, channelId, members: [currentUser, userLyring], receivedAt: 1000 },
    },
    presences: {
      'u-berat': { userId: 'u-berat', status: 'online', isOnline: true, voiceChannelId: channelId, receivedAt: 1000 },
      'u-lyring': { userId: 'u-lyring', status: 'online', isOnline: true, voiceChannelId: channelId, receivedAt: 1000 },
    },
    knownProfiles: groupMembers,
    activeCallChannelId: null,
    isConnected: false,
    voiceMembers: [],
    currentUser,
  });

  assert.equal(effectiveCalls[channelId]?.count, 1);
  assert.deepEqual(
    effectiveCalls[channelId]?.members.map((m) => m.id),
    ['u-lyring']
  );
});

test('Connected WebRTC voiceMembers merge preserves speaking state alongside presence discovery', () => {
  const effectiveCalls = mergeChannelCallsWithPresences({
    channelCalls: {},
    presences: {
      'u-lyring': { userId: 'u-lyring', status: 'online', isOnline: true, voiceChannelId: channelId },
      'u-berat': { userId: 'u-berat', status: 'online', isOnline: true, voiceChannelId: channelId },
    },
    knownProfiles: groupMembers,
    activeCallChannelId: channelId,
    isConnected: true,
    voiceMembers: [
      { id: 'u-berat', name: 'Berat', isSpeaking: true, ping: 18 },
      { id: 'u-lyring', peerId: 'peer-lyring', name: 'Lyring', isSpeaking: false, ping: 24 },
    ],
    currentUser,
  });

  assert.equal(effectiveCalls[channelId]?.count, 2);
  const byId = Object.fromEntries(effectiveCalls[channelId].members.map((m) => [m.id, m]));
  assert.equal(byId['u-berat'].isSpeaking, true);
  assert.equal(byId['u-lyring'].peerId, 'peer-lyring');
});

console.log('All voice presence tests passed!');
