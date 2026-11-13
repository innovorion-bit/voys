import React from 'react';
import { ExternalLink } from 'lucide-react';
import { tokenizeTextWithLinks } from '../utils/linkify';
import { openExternalUrl } from '../utils/windowManager';

/**
 * Renders message text lines with clickable, styled external hyperlinks.
 * Clicking opens the link in the user's default browser.
 */
export const MessageTextWithLinks = ({ text, className = '' }) => {
  const tokens = tokenizeTextWithLinks(text);

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type !== 'link') {
          return <span key={index}>{token.value}</span>;
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
