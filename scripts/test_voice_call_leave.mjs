import assert from 'node:assert/strict';
import {
  collectRemainingVoiceMembers,
  buildLeaveCallTransition,
  buildJoinCallPayload,
  applyIncomingCallStatus,
} from '../src/utils/voiceCallState.js';
import { mergeChannelCallsWithPresences } from '../src/utils/userDisplay.js';

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
};

const channelId = 'text-team-1';
const userA = { id: 'u-a', name: 'Lyring', username: 'lyring', status: 'online', isOnline: true };
const userB = { id: 'u-b', name: 'Berat', username: 'berat', status: 'online', isOnline: true };
const userC = { id: 'u-c', name: 'RAİN', username: 'rain', status: 'online', isOnline: true };

test('Leaving call preserves WebRTC peers even when presences and channelCalls miss them (mixed client versions)', () => {
  // User A refreshed so channelCalls only knew about User A, and User B (older build) has no voiceChannelId on presence
  const result = buildLeaveCallTransition({
    channelCalls: {
      [channelId]: {
        channelId,
        active: true,
        stage: 'active',
        count: 1,
        members: [userA],
        receivedAt: 1000,
      },
    },
    effectiveChannelCalls: {},
    channelId,
    leavingUserId: userA.id,
    presences: {
      [userB.id]: { userId: userB.id, name: userB.name, status: 'online', isOnline: true, receivedAt: 5000 },
    },
    voiceMembers: [
      { id: userA.id, name: userA.name },
      { id: userB.id, peerId: 'peer-b', name: userB.name },
    ],
    remotePeers: [{ peerId: 'peer-b', isSpeaking: false }],
    peerMetadata: { 'peer-b': { userId: userB.id, userName: userB.name } },
    myPeerId: 'peer-a',
    activeCallChannelId: channelId,
    knownProfiles: [userA, userB],
    now: 6000,
  });

  assert.equal(result.remainingMembers.length, 1);
  assert.equal(result.remainingMembers[0].id, userB.id);
  assert.equal(result.callUpdatePayload.active, true);
  assert.equal(result.callUpdatePayload.stage, 'active');
  assert.equal(result.callUpdatePayload.count, 1);
  assert.equal(result.callUpdatePayload.leftUserId, userA.id);
  assert.equal(result.nextChannelCalls[channelId].active, true);
});

test('Leaving call preserves raw remotePeers even before PEER_INFO userId metadata resolves', () => {
  const result = buildLeaveCallTransition({
    channelCalls: {},
    channelId,
    leavingUserId: userA.id,
    presences: {},
    voiceMembers: [],
    remotePeers: [{ peerId: 'peer-raw-1', isSpeaking: true }],
    peerMetadata: {},
    myPeerId: 'peer-a',
    activeCallChannelId: channelId,
    now: 7000,
  });

  assert.equal(result.remainingMembers.length, 1);
  assert.equal(result.remainingMembers[0].peerId, 'peer-raw-1');
  assert.equal(result.callUpdatePayload.active, true);
  assert.equal(result.callUpdatePayload.count, 1);
});

test('Leaving call keeps invisible participant who is actively connected over WebRTC', () => {
  const result = buildLeaveCallTransition({
    channelCalls: {
      [channelId]: { channelId, active: true, members: [userA, userC], receivedAt: 1000 },
    },
    channelId,
    leavingUserId: userA.id,
    presences: {
      [userC.id]: {
        userId: userC.id,
        status: 'invisible',
        isOnline: false,
        voiceChannelId: null,
        receivedAt: 5000,
      },
    },
    voiceMembers: [
      { id: userA.id, name: userA.name },
      { id: userC.id, peerId: 'peer-c', name: userC.name },
    ],
    remotePeers: [{ peerId: 'peer-c', isSpeaking: false }],
    peerMetadata: { 'peer-c': { userId: userC.id, userName: userC.name } },
    myPeerId: 'peer-a',
    activeCallChannelId: channelId,
    knownProfiles: [userA, userC],
    now: 8000,
  });

  assert.equal(result.remainingMembers.length, 1);
  assert.equal(result.remainingMembers[0].id, userC.id);
  assert.equal(result.callUpdatePayload.active, true);
});

test('Leaving call preserves presence-based remaining peers when WebRTC has not yet connected', () => {
  const remaining = collectRemainingVoiceMembers({
    channelId,
    excludeUserId: userA.id,
    presences: {
      [userB.id]: { userId: userB.id, name: userB.name, status: 'online', isOnline: true, voiceChannelId: channelId },
      [userC.id]: { userId: userC.id, name: userC.name, status: 'online', isOnline: true, voiceChannelId: 'other-room' },
    },
    knownProfiles: [userA, userB, userC],
  });

  assert.deepEqual(
    remaining.map((m) => m.id),
    [userB.id]
  );
});

test('Last participant leaving emits ended payload and removes local channel call', () => {
  const result = buildLeaveCallTransition({
    channelCalls: {
      [channelId]: { channelId, active: true, members: [userA], receivedAt: 1000 },
    },
    channelId,
    leavingUserId: userA.id,
    presences: {
      [userA.id]: { userId: userA.id, status: 'online', isOnline: true, voiceChannelId: null, receivedAt: 4000 },
    },
    voiceMembers: [{ id: userA.id, name: userA.name }],
    remotePeers: [],
    peerMetadata: {},
    myPeerId: 'peer-a',
    activeCallChannelId: channelId,
    now: 4000,
  });

  assert.equal(result.remainingMembers.length, 0);
  assert.equal(result.callUpdatePayload.active, false);
  assert.equal(result.callUpdatePayload.stage, 'ended');
  assert.equal(result.callUpdatePayload.count, 0);
  assert.deepEqual(result.callUpdatePayload.members, []);
  assert.equal(result.callUpdatePayload.leftUserId, userA.id);
  assert.equal(result.nextChannelCalls[channelId], undefined);
});

test('Joining another call preserves existing members from effectiveChannelCalls', () => {
  const joinPayload = buildJoinCallPayload({
    channelCalls: {},
    effectiveChannelCalls: {
      [channelId]: { channelId, active: true, members: [userB, userC], initiator: userB, receivedAt: 1000 },
    },
    channelId,
    joiningUser: userA,
    presences: {
      [userB.id]: { userId: userB.id, name: userB.name, status: 'online', isOnline: true, voiceChannelId: channelId },
    },
    knownProfiles: [userA, userB, userC],
    now: 5000,
  });

  assert.equal(joinPayload.active, true);
  assert.equal(joinPayload.count, 3);
  assert.deepEqual(
    joinPayload.members.map((m) => m.id).sort(),
    [userA.id, userB.id, userC.id]
  );
  assert.equal(joinPayload.initiator.id, userB.id);
});

test('applyIncomingCallStatus removes only leftUserId when self remains connected', () => {
  const next = applyIncomingCallStatus(
    {
      [channelId]: {
        channelId,
        active: true,
        members: [userA, userB],
        count: 2,
      },
    },
    {
      channelId,
      active: false,
      stage: 'ended',
      count: 0,
      members: [],
      leftUserId: userA.id,
    },
    {
      currentUserId: userB.id,
      activeCallChannelId: channelId,
      isConnected: true,
      now: 9000,
    }
  );

  assert.equal(next[channelId]?.active, true);
  assert.equal(next[channelId]?.count, 1);
  assert.deepEqual(
    next[channelId]?.members.map((m) => m.id),
    [userB.id]
  );
});

test('applyIncomingCallStatus protects connected self even if prevChannelCalls only knew leaving user', () => {
  // Scenario: Admin (userA) was the only member in prevChannelCalls, userB joined, admin leaves sending ended
  const next = applyIncomingCallStatus(
    {
      [channelId]: {
        channelId,
        active: true,
        initiator: userA,
        members: [userA], // userB had not been synced into prevChannelCalls yet
        count: 1,
      },
    },
    {
      channelId,
      active: false,
      stage: 'ended',
      count: 0,
      members: [],
      leftUserId: userA.id,
    },
    {
      currentUserId: userB.id,
      activeCallChannelId: channelId,
      isConnected: true,
      now: 9500,
    }
  );

  assert.equal(next[channelId]?.active, true);
  assert.equal(next[channelId]?.stage, 'active');
  assert.equal(next[channelId]?.count, 1);
  assert.equal(next[channelId]?.initiator?.id, userB.id);
  assert.deepEqual(
    next[channelId]?.members.map((m) => m.id),
    [userB.id]
  );
});

test('buildLeaveCallTransition automatically transfers initiator when group admin leaves', () => {
  const result = buildLeaveCallTransition({
    channelCalls: {
      [channelId]: {
        channelId,
        active: true,
        initiator: userA,
        members: [userA, userB, userC],
        receivedAt: 1000,
      },
    },
    channelId,
    leavingUserId: userA.id,
    presences: {
      [userB.id]: { userId: userB.id, name: userB.name, status: 'online', isOnline: true, voiceChannelId: channelId },
      [userC.id]: { userId: userC.id, name: userC.name, status: 'online', isOnline: true, voiceChannelId: channelId },
    },
    voiceMembers: [
      { id: userA.id, name: userA.name, peerId: 'peer-a' },
      { id: userB.id, name: userB.name, peerId: 'peer-b' },
      { id: userC.id, name: userC.name, peerId: 'peer-c' },
    ],
    remotePeers: [{ peerId: 'peer-b' }, { peerId: 'peer-c' }],
    peerMetadata: {
      'peer-b': { userId: userB.id },
      'peer-c': { userId: userC.id },
    },
    myPeerId: 'peer-a',
    activeCallChannelId: channelId,
    knownProfiles: [userA, userB, userC],
    now: 8000,
  });

  assert.equal(result.remainingMembers.length, 2);
  assert.equal(result.callUpdatePayload.active, true);
  assert.equal(result.callUpdatePayload.stage, 'active');
  assert.equal(result.callUpdatePayload.count, 2);
  assert.equal(result.callUpdatePayload.leftUserId, userA.id);
  // Initiator must be transferred to the next active member (userB) instead of leaving userA
  assert.notEqual(result.callUpdatePayload.initiator.id, userA.id);
  assert.equal(result.callUpdatePayload.initiator.id, userB.id);
});

test('mergeChannelCallsWithPresences always includes connected user in activeCallChannelId', () => {
  const merged = mergeChannelCallsWithPresences({
    channelCalls: {},
    presences: {},
    knownProfiles: [userA, userB],
    activeCallChannelId: channelId,
    isConnected: true,
    voiceMembers: [], // Local peer is alone in the room
    currentUser: userB,
  });

  assert.equal(merged[channelId]?.active, true);
  assert.equal(merged[channelId]?.count, 1);
  assert.equal(merged[channelId]?.members[0].id, userB.id);
  assert.equal(merged[channelId]?.initiator.id, userB.id);
});

test('Legacy client heartbeat without voiceChannelId property does not get pruned after 1500ms', () => {
  const merged = mergeChannelCallsWithPresences({
    channelCalls: {
      [channelId]: { channelId, active: true, members: [userB], receivedAt: 1000 },
    },
    presences: {
      [userB.id]: { userId: userB.id, name: userB.name, status: 'online', isOnline: true, receivedAt: 5000 },
    },
    knownProfiles: [userA, userB],
    currentUser: userA,
  });

  assert.equal(merged[channelId]?.count, 1);
  assert.equal(merged[channelId]?.members[0].id, userB.id);
});

console.log('All voice call leave/join preservation tests passed!');
