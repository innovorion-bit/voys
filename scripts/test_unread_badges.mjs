import assert from 'node:assert/strict';

console.log('--- Running Sidebar Unread Badges & Recency Sorting Tests ---');

// Test 1: Timestamp parsing & recency sorting logic
function getMessageTimestampNumber(msg) {
  if (!msg) return 0;
  const raw = msg.sentAt ?? msg.sent_at;
  if (typeof raw === 'number' && !isNaN(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  if (raw) {
    const parsed = new Date(raw).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  if (msg.created_at) {
    const parsed = new Date(msg.created_at).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

const now = Date.now();
const item1 = { id: 'rain', name: 'Rain', msgTime: now - 3600000, unreadCount: 0 };
const item2 = { id: 'mafik', name: 'Mafik', msgTime: now - 1800000, unreadCount: 0 };
const item3 = { id: 'udinese', name: 'Udinese', msgTime: now - 60000, unreadCount: 1 };
const item4 = { id: 'game-fedaileri', name: 'Game Fedaileri', msgTime: now - 7200000, unreadCount: 0 };

const items = [item1, item2, item3, item4];
items.sort((a, b) => {
  if (a.msgTime !== b.msgTime) return b.msgTime - a.msgTime;
  if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
  return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
});

assert.equal(items[0].id, 'udinese', 'Udinese with newest message (and unread badge) must be top of the list');
assert.equal(items[1].id, 'mafik', 'Mafik must be second');
assert.equal(items[2].id, 'rain', 'Rain must be third');
assert.equal(items[3].id, 'game-fedaileri', 'Game Fedaileri must be fourth');
console.log('✓ Test 1 Passed: Recency sorting puts chat with newest message at top');

// Test 2: When Rain sends a new message right now, Rain jumps to index 0
item1.msgTime = Date.now() + 1000;
item1.unreadCount = 1;
items.sort((a, b) => {
  if (a.msgTime !== b.msgTime) return b.msgTime - a.msgTime;
  if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
  return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
});
assert.equal(items[0].id, 'rain', 'Rain must jump to the top upon receiving a new message');
console.log('✓ Test 2 Passed: Dynamic jump to top when receiving incoming message');

// Test 3: Unread badge increment logic
function handleIncomingMessage({ activeUid, activeDmUserId, activeChannel, msg, unreadCounts }) {
  const isFromMe = Boolean(
    activeUid && (
      (msg.sender_id && String(msg.sender_id) === String(activeUid)) ||
      (msg.userId && String(msg.userId) === String(activeUid)) ||
      msg.isMe
    )
  );

  const targetPartner = msg.partnerId;
  const isViewing = Boolean(
    activeDmUserId &&
    String(activeDmUserId).toLowerCase().trim() === String(targetPartner).toLowerCase().trim()
  );

  if (!isViewing && !isFromMe) {
    const cur = unreadCounts[targetPartner] || 0;
    return {
      ...unreadCounts,
      [targetPartner]: cur + 1,
    };
  }
  return unreadCounts;
}

let counts = {};
// User sends to me (activeUid = 'me', sender = 'rain')
counts = handleIncomingMessage({
  activeUid: 'me',
  activeDmUserId: 'udinese', // Currently chatting with udinese, not rain
  activeChannel: null,
  msg: { sender_id: 'rain', partnerId: 'rain', text: 'selam' },
  unreadCounts: counts,
});
assert.equal(counts['rain'], 1, 'Rain unread count should be 1');

// Rain sends second message
counts = handleIncomingMessage({
  activeUid: 'me',
  activeDmUserId: 'udinese',
  activeChannel: null,
  msg: { sender_id: 'rain', partnerId: 'rain', text: 'oradasan?' },
  unreadCounts: counts,
});
assert.equal(counts['rain'], 2, 'Rain unread count should be 2');

// Message sent by me should NOT increment unread
counts = handleIncomingMessage({
  activeUid: 'me',
  activeDmUserId: 'udinese',
  activeChannel: null,
  msg: { sender_id: 'me', partnerId: 'rain', text: 'evet buradayım', isMe: true },
  unreadCounts: counts,
});
assert.equal(counts['rain'], 2, 'Sent by me must NOT increment unread count');

// Message while actively viewing rain should NOT increment unread
counts = handleIncomingMessage({
  activeUid: 'me',
  activeDmUserId: 'rain', // Now viewing rain
  activeChannel: null,
  msg: { sender_id: 'rain', partnerId: 'rain', text: 'tamamdır' },
  unreadCounts: counts,
});
assert.equal(counts['rain'], 2, 'Incoming message while actively viewing must NOT increment unread count');
console.log('✓ Test 3 Passed: Unread badge increment rules adhere to active viewing & sender identity');

// Test 4: Clear unread on select
function clearUnread(counts, ...keys) {
  const next = { ...counts };
  keys.forEach((k) => delete next[k]);
  return next;
}
counts = clearUnread(counts, 'rain');
assert.equal(counts['rain'], undefined, 'Rain unread badge cleared upon opening');
console.log('✓ Test 4 Passed: Unread badge cleared upon opening chat');

// Test 5: Discovered DM users from users not in friends list
const initialFriends = [{ id: 'mafik', name: 'Mafik' }];
const discoveredDmUsers = [];
function ensureDiscovered(friends, discovered, partnerId, fallbackName) {
  if (friends.some(f => f.id === partnerId) || discovered.some(d => d.id === partnerId)) {
    return discovered;
  }
  return [...discovered, { id: partnerId, name: fallbackName || 'Kullanıcı' }];
}

let discovered = ensureDiscovered(initialFriends, discoveredDmUsers, 'new-user-123', 'Yunus');
assert.equal(discovered.length, 1);
assert.equal(discovered[0].name, 'Yunus');

const combined = [...initialFriends, ...discovered];
assert.equal(combined.length, 2);
assert.equal(combined[1].id, 'new-user-123');
console.log('✓ Test 5 Passed: Discovered DM users dynamically added and combined into chat list');

// Test 6: Group chat sender name resolution
function resolveMessageSenderName(msg, currentUserId, currentUserName, friends = []) {
  if (!msg) return '';
  const senderId = msg.userId || msg.sender_id || msg.user_id;
  const isMe = Boolean(
    msg.isMe ||
    (currentUserId && senderId && String(senderId) === String(currentUserId)) ||
    (currentUserName && (msg.user === currentUserName || msg.sender_name === currentUserName))
  );
  if (isMe) return 'Sen';

  const rawName = msg.sender_name || msg.user || msg.user_name || msg.name;
  if (rawName && typeof rawName === 'string' && rawName.trim() && rawName !== senderId) {
    return rawName.trim();
  }

  if (senderId && Array.isArray(friends)) {
    const friend = friends.find((f) => f && (f.id === senderId || f.user_id === senderId));
    if (friend?.name) return friend.name;
  }

  return rawName || '';
}

const myUid = 'user-lyring-id';
const myUname = 'Lyring';
const testFriends = [{ id: 'user-udinese-id', name: 'Udinese' }, { id: 'user-mafik-id', name: 'Mafik' }];

// Case A: Udinese sends message in group
const gMsg1 = { id: '1', channel_id: 'game-fedaileri', sender_id: 'user-udinese-id', sender_name: 'Udinese', lines: ['sa'] };
assert.equal(resolveMessageSenderName(gMsg1, myUid, myUname, testFriends), 'Udinese');

// Case B: Sent by myself in group
const gMsg2 = { id: '2', channel_id: 'game-fedaileri', sender_id: myUid, sender_name: 'Lyring', lines: ['as'] };
assert.equal(resolveMessageSenderName(gMsg2, myUid, myUname, testFriends), 'Sen');

// Case C: Message with only sender_id resolved via friends
const gMsg3 = { id: '3', channel_id: 'game-fedaileri', sender_id: 'user-mafik-id', lines: ['gelin'] };
assert.equal(resolveMessageSenderName(gMsg3, myUid, myUname, testFriends), 'Mafik');

console.log('✓ Test 6 Passed: Group chat sender name resolved accurately ("Udinese", "Sen", friends lookup)');

console.log('ALL UNREAD BADGE & RECENCY SORTING TESTS PASSED!');

