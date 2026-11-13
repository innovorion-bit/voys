const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+/gi;

/**
 * Tokenizes a string of text into alternating plain text and URL link tokens.
 * Handles trailing punctuation and balanced parentheses safely.
 * @param {string} text
 * @returns {Array<{ type: 'text' | 'link', value?: string, raw?: string, href?: string }>}
 */
export function tokenizeTextWithLinks(text) {
  if (!text || typeof text !== 'string') {
    return [{ type: 'text', value: text || '' }];
  }

  const tokens = [];
  let lastIndex = 0;
  let match;

  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const rawMatch = match[0];
    const startIndex = match.index;

    // Text before the link
    if (startIndex > lastIndex) {
      tokens.push({
        type: 'text',
        value: text.slice(lastIndex, startIndex),
      });
    }

    // Strip trailing punctuation like . , : ; ! ? ' " >
    let cleanUrl = rawMatch;
    let trailingPunct = '';

    while (cleanUrl.length > 0) {
      const lastChar = cleanUrl[cleanUrl.length - 1];
      if (['.', ',', ':', ';', '!', '?', "'", '"', '>'].includes(lastChar)) {
        trailingPunct = lastChar + trailingPunct;
        cleanUrl = cleanUrl.slice(0, -1);
      } else if (lastChar === ')') {
        const openCount = (cleanUrl.match(/\(/g) || []).length;
        const closeCount = (cleanUrl.match(/\)/g) || []).length;
        if (closeCount > openCount) {
          trailingPunct = lastChar + trailingPunct;
          cleanUrl = cleanUrl.slice(0, -1);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (cleanUrl) {
      const href = cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')
        ? cleanUrl
        : `https://${cleanUrl}`;

      tokens.push({
        type: 'link',
        raw: cleanUrl,
        href,
      });
    }

    if (trailingPunct) {
      tokens.push({
        type: 'text',
        value: trailingPunct,
      });
    }

    lastIndex = startIndex + rawMatch.length;
  }

  // Trailing text after last link
  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      value: text.slice(lastIndex),
    });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }];
}
