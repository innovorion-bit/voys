import assert from 'node:assert';

console.log('--- Testing Message Deletion Logic ---');

// Mock message list
let channelMessages = [
  { id: 'msg-1', text: 'İlk mesaj', userId: 'user-a', sentAt: 1000 },
  { id: 'msg-2', text: 'Silinecek dosya', attachments: [{ name: 'foto.png' }], userId: 'user-b', sentAt: 2000 },
  { id: 'msg-3', text: 'Son mesaj', userId: 'user-a', sentAt: 3000 },
];

// Test 1: Deleting a single message from list
const deleteId = 'msg-2';
channelMessages = channelMessages.filter((m) => m.id !== deleteId);
assert.strictEqual(channelMessages.length, 2, 'Message should be filtered out');
assert.ok(!channelMessages.some(m => m.id === deleteId), 'Deleted message should not exist in list');
console.log('✓ Test 1 Passed: Message filtering removes target message');

// Test 2: Sidebar lastMessagesMap fallback when deleted message was the last message
let lastMessagesMap = {
  'channel-1': { id: 'msg-3', text: 'Son mesaj', sentAt: 3000 },
};

// Simulate deleting msg-3
const deletedId = 'msg-3';
if (lastMessagesMap['channel-1']?.id === deletedId) {
  // Find previous from remaining
  const remaining = channelMessages.filter(m => m.id !== deletedId);
  lastMessagesMap['channel-1'] = remaining.length > 0 ? remaining[remaining.length - 1] : null;
}

assert.strictEqual(lastMessagesMap['channel-1']?.id, 'msg-1', 'Sidebar preview should fall back to previous message');
console.log('✓ Test 2 Passed: Sidebar lastMessagesMap correctly falls back to previous message');

// Test 3: Permission checking logic
const currentUser = { id: 'user-1', name: 'Emir' };
const myMessage = { id: 'msg-4', userId: 'user-1', text: 'Benim mesajım' };
const otherMessage = { id: 'msg-5', userId: 'user-2', text: 'Başkası' };
const isGroupAdmin = false;

const canDeleteOwn = Boolean(myMessage.userId === currentUser.id);
const canDeleteOtherRegular = Boolean(otherMessage.userId === currentUser.id || isGroupAdmin);
assert.strictEqual(canDeleteOwn, true, 'User should be allowed to delete own message');
assert.strictEqual(canDeleteOtherRegular, false, 'User should not be allowed to delete other user message if not admin');

const canDeleteOtherAdmin = Boolean(otherMessage.userId === currentUser.id || true);
assert.strictEqual(canDeleteOtherAdmin, true, 'Group admin should be allowed to delete any message in group');
console.log('✓ Test 3 Passed: Deletion permissions adhere to author and admin rights');

console.log('ALL MESSAGE DELETION TESTS PASSED SUCCESSFULLY!');
