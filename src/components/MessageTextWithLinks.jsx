import React from 'react';
import { ExternalLink } from 'lucide-react';
import { tokenizeTextWithLinks } from '../utils/linkify';
import { openExternalUrl } from '../utils/windowManager';

/**
 * Renders message text lines with clickable, styled external hyperlinks.
 * Clicking opens the link in the user's default browser.
 */
export const MessageTextWithLinks = ({ text, className = '', highlightText = '' }) => {
  const tokens = tokenizeTextWithLinks(text);

  const renderHighlighted = (value, baseKey) => {
    if (!highlightText || !highlightText.trim()) return value;
    const q = highlightText.trim();
    const escaped = q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = value.split(regex);
    if (parts.length <= 1) return value;
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={`${baseKey}_${i}`} className="bg-amber-400/30 text-amber-200 rounded px-0.5 font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type !== 'link') {
          return <span key={index}>{renderHighlighted(token.value, index)}</span>;
        }

        const handleClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openExternalUrl(token.href);
        };

        return (
          <a
            key={index}
            href={token.href}
            onClick={handleClick}
            target="_blank"
            rel="noopener noreferrer"
            title={`Tarayıcıda aç: ${token.href}`}
            className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2 decoration-purple-400/50 hover:decoration-purple-300 transition-colors cursor-pointer break-all inline-flex items-center gap-0.5 select-text group/link"
          >
            <span>{token.raw}</span>
            <ExternalLink
              size={11}
              className="inline-block opacity-60 group-hover/link:opacity-100 flex-shrink-0 ml-0.5 transition-opacity"
            />
          </a>
        );
      })}
    </span>
  );
};
