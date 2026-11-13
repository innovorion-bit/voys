import React, { useState } from 'react';

export const UserAvatar = ({ 
  user, 
  size = 'md', 
  isSpeaking = false, 
  showStatus = false,
  status = null,
  className = '' 
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px] rounded-full',
    sm: 'w-7 h-7 text-[11px] rounded-full',
    md: 'w-9 h-9 text-xs rounded-full',
    lg: 'w-11 h-11 text-sm rounded-full',
    xl: 'w-14 h-14 text-base rounded-full',
    '2xl': 'w-20 h-20 text-2xl rounded-full',
    full: 'w-full h-full text-2xl rounded-full',
  }[size] || 'w-9 h-9 text-xs rounded-full';

  // Determine current user presence status
  const currentStatus = status || user?.status || (user?.isAway ? 'idle' : (user?.isOnline ? 'online' : 'offline'));
  const isPlayingGame = !!(user?.game);

  // Status dot style
  const getStatusDotColor = () => {
    switch (currentStatus) {
      case 'idle':
        return 'bg-amber-400'; // Amber for away/idle
      case 'dnd':
        return 'bg-rose-500'; // Red for Do Not Disturb
      case 'online':
        return isPlayingGame ? 'bg-emerald-400 ring-2 ring-emerald-400/40' : 'bg-emerald-500';
      case 'offline':
      case 'invisible':
      default:
        return 'bg-zinc-500'; // Gray for offline or unspecified
    }
  };

  const displayName = typeof user === 'string'
    ? user
    : (user?.display_name || user?.name || user?.username || '');

  const initials = displayName
    ? displayName
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toLocaleUpperCase('tr-TR')
    : 'U';

  const rawAvatar = typeof user === 'string'
    ? user
    : (user?.avatar || user?.avatar_url || user?.avatarUrl || null);

  const avatarUrl = (typeof rawAvatar === 'string' && rawAvatar.trim() && (
    rawAvatar.startsWith('http') || 
    rawAvatar.startsWith('data:') || 
    rawAvatar.startsWith('blob:') || 
    rawAvatar.startsWith('/')
  )) ? rawAvatar.trim() : (typeof rawAvatar === 'string' && rawAvatar.trim() ? rawAvatar.trim() : null);

  const [imgError, setImgError] = useState(false);
  const [prevAvatarUrl, setPrevAvatarUrl] = useState(avatarUrl);

  if (prevAvatarUrl !== avatarUrl) {
    setPrevAvatarUrl(avatarUrl);
    setImgError(false);
  }

  const hasImage = Boolean(avatarUrl && !imgError);

  const renderInnerAvatar = () => {
    return (
      <div 
        className={`${sizeClasses} flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-gray-200 select-none ${
          hasImage ? 'bg-transparent' : 'bg-[#18181b]'
        } ${
          isSpeaking ? 'speaking-ring ring-[2.5px] ring-emerald-400 ring-offset-[1.5px] ring-offset-[#0c0c0e]' : ''
        } transition-all duration-150 ${className}`}
      >
        {hasImage ? (
          <img 
            src={avatarUrl} 
            alt={displayName || 'User'} 
            className="w-full h-full object-cover rounded-full" 
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="tracking-wide text-gray-300">{initials}</span>
        )}
      </div>
    );
  };

  if (!showStatus) {
    return renderInnerAvatar();
  }

  return (
    <div className="relative inline-block flex-shrink-0">
      {renderInnerAvatar()}
      <span 
        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0c0c0e] ${getStatusDotColor()}`}
        title={`Durum: ${currentStatus}`}
      />
    </div>
  );
};
