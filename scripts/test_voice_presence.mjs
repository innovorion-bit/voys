import assert from 'node:assert/strict';
import {
  mergeChannelCallsWithPresences,
  partitionSidebarGroupMembers,
  computeMemberOnlineStatus,
  resolveMemberPresence,
  resolveChannelCall,
  isChannelMatch,
  mergeVoiceAndCallMembers,
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

test('Group with 5 members accurately reflects 3 online even with case mismatch, voice call, or profile fallback', () => {
  const members = [
    { id: 'cm-1', user_id: 'USER-1-SELF', role: 'admin' },
    { id: 'cm-2', user_id: 'user-2-uuid', name: 'Berat', role: 'member' },
    { id: 'cm-3', user_id: 'user-3-uuid', name: 'Halil', role: 'member', status: 'online' },
    { id: 'cm-4', user_id: 'user-4-offline', name: 'Hüseyin', role: 'member', status: 'offline' },
    { id: 'cm-5', user_id: 'user-5-offline', name: 'Mert', role: 'member', status: 'offline' },
  ];

  const selfUser = { id: 'user-1-self', status: 'online', name: 'Lyring' };

  // presences only has user 2 (with uppercase key in presences!)
  const presences = {
    'USER-2-UUID': { userId: 'user-2-uuid', name: 'Berat', status: 'online', isOnline: true },
  };

  // user 3 is in active voice members
  const activeVoiceMembers = [{ id: 'user-3-uuid', name: 'Halil', isSpeaking: false }];

  const computed = members.map((m) => {
    const isSelf = String(m.user_id).toLowerCase() === String(selfUser.id).toLowerCase();
    const onlineInfo = computeMemberOnlineStatus({
      member: m,
      presences,
      isSelf,
      currentUser: selfUser,
      activeVoiceMembers,
    });
    return { ...m, ...onlineInfo };
  });

  const onlineList = computed.filter((m) => m.isOnline);
  assert.equal(computed.length, 5);
  // Must be 3 online (Self, Berat via uppercase presence match, Halil via active voice)
  assert.equal(onlineList.length, 3);
  assert.deepEqual(
    onlineList.map((m) => m.name || m.user_id).sort(),
    ['Berat', 'Halil', 'USER-1-SELF']
  );
});

test('resolveMemberPresence matches case-insensitively and through candidate IDs', () => {
  const presences = {
    '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d': {
      userId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      name: 'RAİN',
      status: 'online',
    },
  };

  const foundUpper = resolveMemberPresence(presences, {
    user_id: '9B1DEB4D-3B7D-4BAD-9BDD-2B0D7B3DCB6D',
  });
  assert.equal(foundUpper?.name, 'RAİN');

  const foundProfile = resolveMemberPresence(presences, {
    id: 'cm-12345',
    profile: { id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' },
  });
  assert.equal(foundProfile?.name, 'RAİN');
});

test('partitionSidebarGroupMembers matches group member with integer row id against UUID voice member', () => {
  const channelMembers = [
    { id: 42, user_id: 'RAIN-UUID-UPPER', name: 'RAİN', role: 'admin' },
    { id: 43, user_id: 'huseyin-uuid', name: 'Hüseyin', role: 'member' },
    { id: 44, user_id: 'berat-uuid', name: 'Berat', role: 'member' },
  ];
  const callMembers = [
    { id: 'rain-uuid-upper', name: 'RAİN', isSpeaking: true },
  ];

  const partitioned = partitionSidebarGroupMembers({
    effectiveMembers: channelMembers,
    callMembers,
    isCallActive: true,
    isInCall: false,
    currentUser: { id: 'berat-uuid', name: 'Berat' },
  });

  assert.equal(partitioned.showVoiceSection, true);
  assert.equal(partitioned.voiceMembers.length, 1);
  assert.equal(partitioned.voiceMembers[0].name, 'RAİN');
  assert.equal(partitioned.voiceMembers[0].role, 'admin');
  assert.equal(partitioned.voiceMembers[0].isSpeaking, true);

  // RAİN must be removed from groupMembers, leaving only Hüseyin and Berat
  assert.equal(partitioned.groupMembers.length, 2);
  assert.deepEqual(
    partitioned.groupMembers.map((m) => m.name).sort(),
    ['Berat', 'Hüseyin']
  );
});

test('mergeVoiceAndCallMembers preserves connecting participants alongside live WebRTC peers', () => {
  const localWebRtcPeers = [
    { id: 'u-self', name: 'Lyring', isSpeaking: true },
    { id: 'u-peer1', name: 'RAİN', peerId: 'p-1', isSpeaking: false },
  ];
  const presenceCallMembers = [
    { id: 'u-peer1', name: 'RAİN', status: 'online' },
    { id: 'u-peer2-connecting', name: 'Halil', status: 'online' },
  ];

  const merged = mergeVoiceAndCallMembers(localWebRtcPeers, presenceCallMembers, { id: 'u-self', name: 'Lyring' });
  assert.equal(merged.length, 3);
  const byId = Object.fromEntries(merged.map((m) => [m.id, m]));
  assert.equal(byId['u-self'].isSpeaking, true);
  assert.equal(byId['u-peer1'].peerId, 'p-1');
  assert.equal(byId['u-peer2-connecting'].name, 'Halil');
  assert.equal(byId['u-peer2-connecting'].substatus, 'Seste');
});

test('resolveChannelCall and isChannelMatch handle prefixes and casing gracefully', () => {
  const channelCalls = {
    'text-c683b7f5-23fa-4001': { active: true, channelId: 'c683b7f5-23fa-4001', count: 2 },
  };

  assert.equal(isChannelMatch('C683B7F5-23FA-4001', 'text-c683b7f5-23fa-4001'), true);
  assert.equal(isChannelMatch('voice-c683b7f5-23fa-4001', 'c683b7f5-23fa-4001'), true);

  const resolved = resolveChannelCall(channelCalls, 'C683B7F5-23FA-4001');
  assert.equal(resolved?.active, true);
  assert.equal(resolved?.count, 2);
});

test('Users who closed app with status: online in DB are strictly offline when absent from presences', () => {
  const members = [
    { id: 'cm-self', user_id: 'u-lyring', name: 'Lyring', profile: { status: 'online' } },
    { id: 'cm-rain', user_id: 'u-rain', name: 'RAİN', profile: { status: 'online' } },
    { id: 'cm-huseyin', user_id: 'u-huseyin', name: 'MafiKK-Hüseyin', profile: { status: 'online' } },
    { id: 'cm-berat', user_id: 'u-berat', name: 'Berat', profile: { status: 'online' } },
    { id: 'cm-halil', user_id: 'u-halil', name: 'Halil', profile: { status: 'online' } },
    { id: 'cm-yunus', user_id: 'u-yunus', name: 'yunus', profile: { status: 'online' } },
  ];

  const currentUser = { id: 'u-lyring', name: 'Lyring', status: 'online' };

  // Only Lyring (self) is active; all other 5 users closed the window via 'X'
  const presences = {
    'u-lyring': { userId: 'u-lyring', name: 'Lyring', status: 'online', isOnline: true },
  };

  const computed = members.map((m) => {
    const isSelf = m.user_id === currentUser.id;
    const onlineInfo = computeMemberOnlineStatus({
      member: m,
      presences,
      isSelf,
      currentUser,
      activeVoiceMembers: [],
    });
    return { ...m, ...onlineInfo };
  });

  const onlineList = computed.filter((m) => m.isOnline);
  const offlineList = computed.filter((m) => !m.isOnline);

  assert.equal(onlineList.length, 1);
  assert.equal(onlineList[0].name, 'Lyring');
  assert.equal(offlineList.length, 5);
  assert.deepEqual(
    offlineList.map((m) => m.name).sort(),
    ['Berat', 'Halil', 'MafiKK-Hüseyin', 'RAİN', 'yunus']
  );
  offlineList.forEach((m) => {
    assert.equal(m.status, 'offline');
    assert.equal(m.isOnline, false);
  });
});

test('Self user in friends list or DM sidebar always reflects active currentUser online status', () => {
  const currentUdinese = {
    id: 'u-udinese',
    name: 'Udinese',
    username: 'udinese',
    status: 'online',
    isOnline: true,
    substatus: 'Çevrimiçi',
  };

  // presences does not contain self
  const presencesWithoutSelf = {
    'u-friend-1': { userId: 'u-friend-1', name: 'Friend 1', status: 'online', isOnline: true },
  };

  const selfFriendItem = {
    id: 'u-udinese',
    user_id: 'u-udinese',
    name: 'Udinese',
    username: 'udinese',
  };

  const isSelf = selfFriendItem.id === currentUdinese.id;
  const result = computeMemberOnlineStatus({
    member: selfFriendItem,
    presences: presencesWithoutSelf,
    isSelf,
    currentUser: currentUdinese,
  });

  assert.equal(result.isOnline, true);
  assert.equal(result.status, 'online');
  assert.equal(result.substatus, 'Çevrimiçi');
});

console.log('All voice presence tests passed!');
