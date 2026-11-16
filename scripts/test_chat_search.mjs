import assert from 'assert';

console.log('--- Testing In-Chat Search & Highlighting Logic ---');

const sampleMessages = [
  { id: '1', user: 'Lyring', lines: ['Merhaba nasılsın?'], attachments: [] },
  { id: '2', user: 'Rain', lines: ['İyiyim sen nasılsın?', 'Oyun oynayalım mı?'], attachments: [] },
  { id: '3', user: 'Udinese', lines: ['Projeyi gönderdim'], attachments: [{ name: 'tasarim.png' }] },
  { id: '4', user: 'GameMaster', lines: ['Fiyat $100 veya 100?'], attachments: [] },
];

function normalizeForSearch(str) {
  if (!str) return '';
  return String(str)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function filterMessages(messages, query) {
  const activeSearch = (query || '').trim();
  if (!activeSearch) return messages;
  const qNorm = normalizeForSearch(activeSearch);
  return messages.filter((m) =>
    normalizeForSearch(m.user).includes(qNorm) ||
    m.lines?.some((l) => normalizeForSearch(l).includes(qNorm)) ||
    m.attachments?.some((a) => normalizeForSearch(a.name).includes(qNorm))
  );
}

function highlightSplit(text, query) {
  if (!query || !query.trim()) return [text];
  const q = query.trim();
  const escaped = q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.split(regex);
}

// Test 1: Empty search returns all messages
const resAll = filterMessages(sampleMessages, '');
assert.strictEqual(resAll.length, 4, 'Empty search must return all messages');
console.log('✓ Test 1 Passed: Empty search returns full message list');

// Test 2: Case-insensitive search in lines with Turkish diacritics and ASCII
const resNasilsin1 = filterMessages(sampleMessages, 'NASILSIN');
assert.strictEqual(resNasilsin1.length, 2, 'Should find 2 messages containing nasilsin (uppercase)');
const resNasilsin2 = filterMessages(sampleMessages, 'nasilsin');
assert.strictEqual(resNasilsin2.length, 2, 'Should find 2 messages containing nasilsin (ASCII)');
const resNasilsin3 = filterMessages(sampleMessages, 'nasılsın');
assert.strictEqual(resNasilsin3.length, 2, 'Should find 2 messages containing nasılsın (Turkish)');
console.log('✓ Test 2 Passed: Turkish diacritics and ASCII case-insensitive search work flawlessly');

// Test 3: Search by sender name
const resUser = filterMessages(sampleMessages, 'udinese');
assert.strictEqual(resUser.length, 1);
assert.strictEqual(resUser[0].id, '3');
console.log('✓ Test 3 Passed: User sender name search works');

// Test 4: Search by attachment filename
const resAttachment = filterMessages(sampleMessages, 'tasarim');
assert.strictEqual(resAttachment.length, 1);
assert.strictEqual(resAttachment[0].id, '3');
console.log('✓ Test 4 Passed: Attachment filename search works');

// Test 5: Special characters regex escaping ($ and ?)
const resSpecial = filterMessages(sampleMessages, '$100');
assert.strictEqual(resSpecial.length, 1);
assert.strictEqual(resSpecial[0].id, '4');
const parts = highlightSplit('Fiyat $100 veya 100?', '$100');
assert.strictEqual(parts.length, 3);
assert.strictEqual(parts[1], '$100');
console.log('✓ Test 5 Passed: Special characters ($ and ?) escaped safely without regex crashes');

console.log('ALL IN-CHAT SEARCH TESTS PASSED SUCCESSFULLY!');
