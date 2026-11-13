import assert from 'node:assert/strict';
import { tokenizeTextWithLinks } from '../src/utils/linkify.js';

// Test 1: Exact 3D model link from user screenshot
const t1 = tokenizeTextWithLinks('https://studio.tripo3d.ai/3d-model/mass-of-screaming-humanoid-heads-and-bodies-intertwined-stone-marble-41f36821-8d00-4ffa-9451-9eeda9029eae');
assert.equal(t1.length, 1);
assert.equal(t1[0].type, 'link');
assert.equal(t1[0].href, 'https://studio.tripo3d.ai/3d-model/mass-of-screaming-humanoid-heads-and-bodies-intertwined-stone-marble-41f36821-8d00-4ffa-9451-9eeda9029eae');
assert.equal(t1[0].raw, 'https://studio.tripo3d.ai/3d-model/mass-of-screaming-humanoid-heads-and-bodies-intertwined-stone-marble-41f36821-8d00-4ffa-9451-9eeda9029eae');

// Test 2: Reddit link with query params from user screenshot
const t2 = tokenizeTextWithLinks('https://www.reddit.com/r/consoles/comments/1hpj1zw/ps5_custom_design_tlou/?tl=tr');
assert.equal(t2.length, 1);
assert.equal(t2[0].type, 'link');
assert.equal(t2[0].href, 'https://www.reddit.com/r/consoles/comments/1hpj1zw/ps5_custom_design_tlou/?tl=tr');
assert.equal(t2[0].raw, 'https://www.reddit.com/r/consoles/comments/1hpj1zw/ps5_custom_design_tlou/?tl=tr');

// Test 3: Plain text without links
const t3 = tokenizeTextWithLinks('emoo');
assert.equal(t3.length, 1);
assert.equal(t3[0].type, 'text');
assert.equal(t3[0].value, 'emoo');

// Test 4: www. prefix gets https:// href
const t4 = tokenizeTextWithLinks('Bak şuraya www.voys.chat/help bak');
assert.equal(t4.length, 3);
assert.equal(t4[0].value, 'Bak şuraya ');
assert.equal(t4[1].type, 'link');
assert.equal(t4[1].raw, 'www.voys.chat/help');
assert.equal(t4[1].href, 'https://www.voys.chat/help');
assert.equal(t4[2].value, ' bak');

// Test 5: Trailing sentence punctuation
const t5 = tokenizeTextWithLinks('Güzel site: https://example.com/test.');
assert.equal(t5[1].type, 'link');
assert.equal(t5[1].raw, 'https://example.com/test');
assert.equal(t5[2].value, '.');

// Test 6: In parentheses
const t6 = tokenizeTextWithLinks('(bkz: https://example.com)');
assert.equal(t6[0].value, '(bkz: ');
assert.equal(t6[1].raw, 'https://example.com');
assert.equal(t6[2].value, ')');

// Test 7: Wikipedia balanced parentheses
const t7 = tokenizeTextWithLinks('https://en.wikipedia.org/wiki/Rust_(programming_language)');
assert.equal(t7.length, 1);
assert.equal(t7[0].raw, 'https://en.wikipedia.org/wiki/Rust_(programming_language)');

// Test 8: Multiple links in one line
const t8 = tokenizeTextWithLinks('https://google.com ve https://github.com');
assert.equal(t8.length, 3);
assert.equal(t8[0].href, 'https://google.com');
assert.equal(t8[1].value, ' ve ');
assert.equal(t8[2].href, 'https://github.com');

console.log('All chat link tokenization tests passed!');
