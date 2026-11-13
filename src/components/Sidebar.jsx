import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  Settings2,
  UserPlus,
  Gamepad2,
  Phone,
  CheckCheck,
  Check,
  ArrowLeft,
  Clock,
  Loader2,
  UserCheck,
  Copy,
  Plus,
  Users,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from './UserAvatar';
import { getDmRoomId, localDb, dbService } from '../lib/supabase';
import { chatService } from '../services/chatService';
import { resolveDirectMessagePartner, parseDmRoomPair, isDirectMessageForPair } from '../utils/dmIsolation';
import { resolveChannelCall, getCachedUserProfile, cacheUserProfiles, pickDisplayName } from '../utils/userDisplay';
import { sounds } from '../utils/audio';

// Format message timestamp: 23:14 (today), Dün (yesterday), Day Name (this week), DD.MM.YYYY (older)
function formatChatTimestamp(sentAt, fallbackTimestampText = '') {
  let date = null;

  if (typeof sentAt === 'number') {
    date = new Date(sentAt);
  } else if (typeof sentAt === 'string') {
    if (/^\d+$/.test(sentAt)) {
      date = new Date(Number(sentAt));
    } else {
      date = new Date(sentAt);
    }
  }

  if (!date || isNaN(date.getTime())) {
    if (fallbackTimestampText) {
      const timeMatch = String(fallbackTimestampText).match(/(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)/);
      if (timeMatch) return timeMatch[1];
      return fallbackTimestampText;
    }
    return '';
  }

  const now = new Date();
  const isToday = (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) {
    return timeStr;
  }

  if (isYesterday) {
    return 'Dün';
  }

  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return days[date.getDay()];
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

// Helper to extract clean time HH:mm
function formatChatTimeOnly(sentAt, fallbackTimestampText = '') {
  let date = null;
  if (typeof sentAt === 'number') {
    date = new Date(sentAt);
  } else if (typeof sentAt === 'string') {
    if (/^\d+$/.test(sentAt)) {
      date = new Date(Number(sentAt));
    } else {
      date = new Date(sentAt);
    }
  }

  if (!date || isNaN(date.getTime())) {
    if (fallbackTimestampText) {
      const timeMatch = String(fallbackTimestampText).match(/(\d{1,2}:\d{2})/);
      if (timeMatch) return timeMatch[1];
    }
    return '';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Helper to extract clean date DD.MM.YYYY
function formatChatDateOnly(sentAt, fallbackTimestampText = '') {
  let date = null;
  if (typeof sentAt === 'number') {
    date = new Date(sentAt);
  } else if (typeof sentAt === 'string') {
    if (/^\d+$/.test(sentAt)) {
      date = new Date(Number(sentAt));
    } else {
      date = new Date(sentAt);
    }
  }

  if (!date || isNaN(date.getTime())) {
    if (fallbackTimestampText) {
      const d = new Date(fallbackTimestampText);
      if (!isNaN(d.getTime())) date = d;
    }
  }

  if (!date || isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Extract clean text preview from message
function formatMessagePreview(message) {
  if (!message) return '';

  if (Array.isArray(message.lines) && message.lines.length > 0) {
    const lastLine = message.lines[message.lines.length - 1];
    if (typeof lastLine === 'string' && lastLine.trim()) {
      return lastLine.trim();
    }
  }

  if (typeof message.text === 'string' && message.text.trim()) {
    return message.text.trim();
  }

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const att = message.attachments[0];
    const type = att.type || '';
    if (type.startsWith('image/') || att.isImage) return '📷 Fotoğraf';
    if (type.startsWith('audio/') || att.isAudio) return '🎤 Ses kaydı';
    if (type.startsWith('video/') || att.isVideo) return '🎥 Video';
    return `📎 ${att.name || 'Dosya'}`;
  }

  return '';
}

// Resolve sender display name for group messages (e.g. "Udinese", "Sen")
function resolveMessageSenderName(msg, currentUserId, currentUserName, friends = []) {
  if (!msg) return '';
  const senderId = msg.userId || msg.sender_id || msg.user_id;
  const isMe = Boolean(
    msg.isMe ||
    (currentUserId && senderId && String(senderId) === String(currentUserId)) ||
    (currentUserName && (msg.user === currentUserName || msg.sender_name === currentUserName))
  );
  if (isMe) return 'Sen';

  // 1. Direct sender name from message object
  const rawName = msg.sender_name || msg.user || msg.user_name || msg.name;
  if (rawName && typeof rawName === 'string' && rawName.trim() && rawName !== senderId) {
    return rawName.trim();
  }

  // 2. Lookup in friends list
  if (senderId && Array.isArray(friends)) {
    const friend = friends.find((f) => f && (f.id === senderId || f.user_id === senderId));
    if (friend?.name) return friend.name;
  }

  // 3. Fallback to cached profile
  if (senderId) {
    const cached = getCachedUserProfile(senderId);
    if (cached) {
      const resolved = pickDisplayName([cached.display_name, cached.name, cached.username], '');
      if (resolved) return resolved;
    }
  }

  return rawName || '';
}

const STATUS_OPTIONS = [
  {
    id: 'online',
    label: 'Çevrimiçi',
    description: 'Aktif ve bildirimler açık',
    color: 'bg-emerald-500',
    hoverTextClass: 'group-hover:text-emerald-400',
    textColor: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
  },
  {
    id: 'idle',
    label: 'Boşta',
    description: 'Geçici olarak uzakta (AFK)',
    color: 'bg-amber-400',
    hoverTextClass: 'group-hover:text-amber-400',
    textColor: 'text-amber-400',
    ring: 'ring-amber-400/20',
  },
  {
    id: 'dnd',
    label: 'Rahatsız Etmeyin',
    description: 'Bildirim seslerini kapat',
    color: 'bg-rose-500',
    hoverTextClass: 'group-hover:text-rose-400',
    textColor: 'text-rose-400',
    ring: 'ring-rose-500/20',
  },
  {
    id: 'invisible',
    label: 'Görünmez',
    description: 'Çevrimdışı görünürsün',
    color: 'bg-gray-400',
    hoverTextClass: 'group-hover:text-zinc-400',
    textColor: 'text-zinc-400',
    ring: 'ring-gray-400/20',
  },
];

function buildInitialLastMessagesMap(effectiveUserId, friends, textChannels) {
  const initialMap = {};
  try {
    if (effectiveUserId && effectiveUserId !== 'you') {
      friends.forEach((friend) => {
        if (!friend?.id) return;
        const roomId = getDmRoomId(effectiveUserId, friend.id);
        const msgs = localDb.getDmMessages(roomId);
        if (Array.isArray(msgs) && msgs.length > 0) {
          initialMap[roomId] = msgs[msgs.length - 1];
        }
      });
    }
    textChannels.forEach((chan) => {
      if (!chan?.id) return;
      const msgs = localDb.getChannelMessages(chan.id);
      if (Array.isArray(msgs) && msgs.length > 0) {
        initialMap[chan.id] = msgs[msgs.length - 1];
      }
    });
  } catch { }
  return initialMap;
}

const getHiddenChatsStorageKey = (userId) => `voys_hidden_chats_${userId || 'guest'}`;

function readHiddenChats(userId) {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(getHiddenChatsStorageKey(userId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { }
  return new Set();
}

function saveHiddenChats(userId, hiddenSet) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getHiddenChatsStorageKey(userId), JSON.stringify([...hiddenSet]));
  } catch { }
}

const getUnreadCountsStorageKey = (userId) => `voys_unread_counts_${userId || 'guest'}`;

function readUnreadCounts(userId) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getUnreadCountsStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch { }
  return {};
}

function persistUnreadCounts(userId, counts) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getUnreadCountsStorageKey(userId), JSON.stringify(counts));
  } catch { }
}

export const Sidebar = ({
  textChannels = [],
  channelCalls = {}, // { [channelId]: { active: boolean, count: number } }
  friends = [],
  incomingRequestsCount = 0,
  incomingRequests = [],
  outgoingRequests = [],
  onFriendshipUpdated = null,
  currentUserId = null,
  activeChannel = 'home',
  activeDmUserId = null,
  onSelectChannel,
  onSelectDm,
  currentUserProfile = null,
  onOpenSettings = null,
  onOpenCreateChannel = null,
  onCreateChannel = null,
  onUpdateStatus = null,
  activeMessages = [],
}) => {
  const effectiveUserId = currentUserProfile?.id || currentUserId || null;

  // Hidden/closed chats in sidebar list (stored per user in localStorage)
  const [hiddenChatIds, setHiddenChatIds] = useState(() => readHiddenChats(effectiveUserId));
  const [chatContextMenu, setChatContextMenu] = useState(null); // { x, y, chat: { type: 'dm'|'channel', id, name } }
  const chatContextMenuRef = useRef(null);

  useEffect(() => {
    setHiddenChatIds(readHiddenChats(effectiveUserId));
  }, [effectiveUserId]);

  const unhideChat = useCallback((chatId) => {
    if (!chatId) return;
    setHiddenChatIds((prev) => {
      if (!prev.has(chatId)) return prev;
      const next = new Set(prev);
      next.delete(chatId);
      saveHiddenChats(effectiveUserId, next);
      return next;
    });
  }, [effectiveUserId]);

  const handleHideChat = useCallback((chatItem) => {
    if (!chatItem?.id) return;
    setHiddenChatIds((prev) => {
      const next = new Set(prev);
      next.add(chatItem.id);
      saveHiddenChats(effectiveUserId, next);
      return next;
    });

    if (chatItem.type === 'dm') {
      if (activeDmUserId === chatItem.id) {
        onSelectDm?.(null);
      }
    } else if (chatItem.type === 'channel') {
      if (activeChannel === chatItem.id || activeChannel === `text-${chatItem.id}`) {
        onSelectChannel?.(null);
      }
    }
    setChatContextMenu(null);
    toast.success('Sohbet kaldırıldı', {
      description: 'Mesajlar silinmedi. Kişiye yeni mesaj geldiğinde veya arandığında sohbet tekrar listelenir.',
    });
  }, [activeDmUserId, activeChannel, effectiveUserId, onSelectDm, onSelectChannel]);

  // Persistent unread message counts: { [chatId]: count }
  const [unreadCounts, setUnreadCounts] = useState(() => readUnreadCounts(effectiveUserId));
  // Dynamically discovered DM partners from incoming direct messages (even if not yet in friends list)
  const [discoveredDmUsers, setDiscoveredDmUsers] = useState([]);

  useEffect(() => {
    setUnreadCounts(readUnreadCounts(effectiveUserId));
  }, [effectiveUserId]);

  const activeDmUserIdRef = useRef(activeDmUserId);
  activeDmUserIdRef.current = activeDmUserId;

  const activeChannelRef = useRef(activeChannel);
  activeChannelRef.current = activeChannel;

  const clearUnread = useCallback((...keys) => {
    setUnreadCounts((prev) => {
      let changed = false;
      const next = { ...prev };
      keys.filter(Boolean).forEach((k) => {
        if (next[k] !== undefined) {
          delete next[k];
          changed = true;
        }
      });
      if (changed) {
        persistUnreadCounts(effectiveUserId, next);
        return next;
      }
      return prev;
    });
  }, [effectiveUserId]);

  const ensureDiscoveredDmPartner = useCallback(async (partnerId, fallbackName) => {
    if (!partnerId || partnerId === effectiveUserId) return;
    setDiscoveredDmUsers((prev) => {
      if (friends.some((f) => f.id === partnerId) || prev.some((d) => d.id === partnerId)) {
        return prev;
      }
      const cached = getCachedUserProfile(partnerId);
      const resolvedName = pickDisplayName([fallbackName, cached?.display_name, cached?.name, cached?.username], 'Kullanıcı');
      return [
        ...prev,
        {
          id: partnerId,
          user_id: partnerId,
          name: resolvedName,
          display_name: resolvedName,
          username: cached?.username || '',
          avatar: cached?.avatar_url || cached?.avatar || '',
          status: cached?.status || 'offline',
          isOnline: false,
        },
      ];
    });

    if (!getCachedUserProfile(partnerId)) {
      try {
        const prof = await dbService.fetchUserProfile(partnerId);
        if (prof) {
          cacheUserProfiles([prof]);
          setDiscoveredDmUsers((prev) =>
            prev.map((d) =>
              d.id === partnerId
                ? {
                  ...d,
                  name: pickDisplayName([prof.display_name, prof.name, prof.username, fallbackName], 'Kullanıcı'),
                  display_name: pickDisplayName([prof.display_name, prof.name, prof.username, fallbackName], 'Kullanıcı'),
                  avatar: prof.avatar_url || prof.avatar || d.avatar,
                  username: prof.username || d.username,
                }
                : d
            )
          );
        }
      } catch { }
    }
  }, [effectiveUserId, friends]);

  // Automatically clear unread badge for currently open chat
  useEffect(() => {
    if (!effectiveUserId) return;
    if (activeDmUserId) {
      const dmRoomId = getDmRoomId(effectiveUserId, activeDmUserId);
      clearUnread(activeDmUserId, dmRoomId);
    } else if (activeChannel) {
      const cleanChan = String(activeChannel).replace(/^text-/, '');
      clearUnread(activeChannel, cleanChan, `text-${cleanChan}`);
    }
  }, [activeChannel, activeDmUserId, effectiveUserId, clearUnread]);

  const handleChatContextMenu = useCallback((e, chatItem) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 192;
    const menuHeight = 90;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setChatContextMenu({
      x: Math.max(8, x),
      y: Math.max(8, y),
      chat: chatItem,
    });
  }, []);

  useEffect(() => {
    if (!chatContextMenu) return undefined;
    const handlePointerDown = (e) => {
      if (chatContextMenuRef.current && chatContextMenuRef.current.contains(e.target)) return;
      setChatContextMenu(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setChatContextMenu(null);
    };
    const closeMenu = () => setChatContextMenu(null);

    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [chatContextMenu]);

  // Map of last messages for each channel/DM room: { [roomId]: messageObj }
  const [lastMessagesMap, setLastMessagesMap] = useState(() =>
    buildInitialLastMessagesMap(effectiveUserId, friends, textChannels)
  );

  const prevUserIdRef = useRef(effectiveUserId);
  useEffect(() => {
    if (prevUserIdRef.current !== effectiveUserId) {
      prevUserIdRef.current = effectiveUserId;
      setLastMessagesMap(buildInitialLastMessagesMap(effectiveUserId, friends, textChannels));
    }
  }, [effectiveUserId, friends, textChannels]);

  // Derive active channel's latest message directly during render (avoids cascading render warnings)
  const activeLastMessage = useMemo(() => {
    if (!activeChannel || !Array.isArray(activeMessages) || activeMessages.length === 0) return null;
    return activeMessages[activeMessages.length - 1];
  }, [activeChannel, activeMessages]);

  const friendIdsKey = useMemo(() => {
    return (friends || [])
      .map((f) => f?.id)
      .filter(Boolean)
      .sort()
      .join(',');
  }, [friends]);

  // Load latest messages from database & subscribe to realtime updates
  useEffect(() => {
    let cancelled = false;
    const activeUid = effectiveUserId;
    if (!activeUid || activeUid === 'you') return;

    // Single batched query for all friends' latest DMs and text channels
    const friendIds = friendIdsKey ? friendIdsKey.split(',').filter(Boolean) : [];
    const channelIds = (textChannels || [])
      .map((c) => c?.id)
      .filter((id) => id && id !== 'home' && id !== 'voice-sesli-sohbet');

    const loadLatestMessagesBatch = async () => {
      try {
        const [batchMap, channelBatchMap] = await Promise.all([
          friendIds.length > 0 ? dbService.fetchLatestDmMessagesBatch(activeUid, friendIds) : null,
          channelIds.length > 0 ? dbService.fetchLatestChannelMessagesBatch(channelIds) : null,
        ]);
        if (!cancelled) {
          setLastMessagesMap((prev) => {
            const next = { ...prev };
            if (batchMap) {
              friendIds.forEach((fid) => {
                const canonical = getDmRoomId(activeUid, fid);
                if (batchMap[canonical]) {
                  next[canonical] = batchMap[canonical];
                } else {
                  const localMsgs = localDb.getDmMessages(canonical);
                  if (Array.isArray(localMsgs) && localMsgs.length > 0) {
                    next[canonical] = localMsgs[localMsgs.length - 1];
                  } else {
                    delete next[canonical];
                  }
                }
              });
            }
            if (channelBatchMap) {
              channelIds.forEach((cid) => {
                if (channelBatchMap[cid]) {
                  next[cid] = channelBatchMap[cid];
                } else {
                  const localMsgs = localDb.getChannelMessages(cid);
                  if (Array.isArray(localMsgs) && localMsgs.length > 0) {
                    next[cid] = localMsgs[localMsgs.length - 1];
                  }
                }
              });
            }
            return next;
          });
        }
      } catch { }
    };

    loadLatestMessagesBatch();

    const unsubRecovered = dbService.onRealtimeRecovered?.(() => {
      if (!cancelled) loadLatestMessagesBatch();
    });

    // Realtime subscription for direct messages (strictly scoped to activeUid)
    const unsubDms = dbService.subscribeToTable('direct_messages', (payload) => {
      if (cancelled) return;
      const newMsg = payload?.new;
      if (!newMsg) return;
      const partnerId = resolveDirectMessagePartner(newMsg, activeUid);
      if (!partnerId) return;

      const roomId = getDmRoomId(activeUid, partnerId);

      if (payload?.eventType === 'UPDATE' && newMsg?.id) {
        setLastMessagesMap((prev) => {
          const existing = prev[roomId];
          if (existing && existing.id === newMsg.id) {
            return {
              ...prev,
              [roomId]: {
                ...existing,
                ...newMsg,
                read_at: newMsg.read_at || existing.read_at,
                read: Boolean(newMsg.read_at || existing.read_at),
                delivered_at: newMsg.delivered_at || existing.delivered_at,
              },
            };
          }
          return prev;
        });
        return;
      }

      const formatted = {
        id: newMsg.id,
        room_id: roomId,
        userId: newMsg.sender_id,
        sender_id: newMsg.sender_id,
        receiver_id: newMsg.receiver_id,
        user: newMsg.sender_name,
        lines: Array.isArray(newMsg.lines) ? newMsg.lines : (newMsg.lines ? [newMsg.lines] : []),
        attachments: Array.isArray(newMsg.attachments) ? newMsg.attachments : [],
        timestamp: newMsg.timestamp_text,
        sentAt: newMsg.sent_at || (newMsg.created_at ? new Date(newMsg.created_at).getTime() : Date.now()),
        read_at: newMsg.read_at || null,
        read: Boolean(newMsg.read_at),
        delivered_at: newMsg.delivered_at || null,
      };

      unhideChat(partnerId);
      unhideChat(roomId);
      ensureDiscoveredDmPartner(partnerId, newMsg.sender_name);

      setLastMessagesMap((prev) => ({
        ...prev,
        [roomId]: formatted,
      }));

      const isViewing = Boolean(
        activeDmUserIdRef.current &&
        String(activeDmUserIdRef.current).toLowerCase().trim() === String(partnerId).toLowerCase().trim()
      );
      const isFromMe = Boolean(
        activeUid && String(newMsg.sender_id) === String(activeUid)
      );

      if (!isFromMe && newMsg.sender_id) {
        chatService.sendDeliveryReceipt(roomId, activeUid, newMsg.sender_id);
        dbService.markDmMessagesDelivered?.(activeUid, newMsg.sender_id);
      }

      if (!isViewing && !isFromMe) {
        setUnreadCounts((prev) => {
          const current = prev[partnerId] || prev[roomId] || 0;
          const next = { ...prev, [partnerId]: current + 1, [roomId]: current + 1 };
          persistUnreadCounts(activeUid, next);
          return next;
        });
        try { sounds.playMessage(); } catch { }
      }
    });

    // Realtime subscription for channel messages
    const unsubChannelMsgs = dbService.subscribeToTable('channel_messages', (payload) => {
      if (cancelled) return;
      const newMsg = payload?.new;
      if (!newMsg) return;
      const chanId = newMsg.channel_id || newMsg.room_id || newMsg.room;
      if (!chanId) return;

      const formatted = {
        id: newMsg.id,
        channel_id: chanId,
        room_id: chanId,
        userId: newMsg.sender_id || newMsg.user_id || newMsg.userId,
        sender_id: newMsg.sender_id || newMsg.user_id || newMsg.userId,
        user: newMsg.sender_name || newMsg.user_name || newMsg.user,
        sender_name: newMsg.sender_name || newMsg.user_name || newMsg.user,
        lines: Array.isArray(newMsg.lines) ? newMsg.lines : (newMsg.lines ? [newMsg.lines] : []),
        attachments: Array.isArray(newMsg.attachments) ? newMsg.attachments : [],
        timestamp: newMsg.timestamp_text,
        sentAt: newMsg.sent_at || (newMsg.created_at ? new Date(newMsg.created_at).getTime() : Date.now()),
      };

      unhideChat(chanId);
      setLastMessagesMap((prev) => ({
        ...prev,
        [chanId]: formatted,
      }));

      const curChan = activeChannelRef.current;
      const isViewing = !activeDmUserIdRef.current && (
        curChan === chanId ||
        chanId === `text-${curChan}` ||
        chanId?.replace(/^text-/, '') === curChan?.replace(/^text-/, '')
      );
      const isFromMe = Boolean(
        activeUid && (
          (newMsg.user_id && String(newMsg.user_id) === String(activeUid)) ||
          (newMsg.sender_id && String(newMsg.sender_id) === String(activeUid))
        )
      );

      if (!isViewing && !isFromMe) {
        setUnreadCounts((prev) => {
          const current = prev[chanId] || 0;
          const next = { ...prev, [chanId]: current + 1 };
          persistUnreadCounts(activeUid, next);
          return next;
        });
        try { sounds.playMessage(); } catch { }
      }
    });

    // Realtime broadcast/socket message
    const handleChatMessage = (msg) => {
      if (cancelled || !msg) return;
      const rawRoomId = msg.room || msg.room_id || msg.channel_id;
      if (!rawRoomId) return;

      const isFromMe = Boolean(
        activeUid && (
          (msg.sender_id && String(msg.sender_id) === String(activeUid)) ||
          (msg.userId && String(msg.userId) === String(activeUid)) ||
          msg.isMe
        )
      );

      if (String(rawRoomId).startsWith('dm-')) {
        const partnerId = resolveDirectMessagePartner(msg, activeUid);
        const pair = parseDmRoomPair(rawRoomId);
        const targetPartner = partnerId || (pair && pair.includes(String(activeUid))
          ? (pair[0] === String(activeUid) ? pair[1] : pair[0])
          : null);
        if (!targetPartner) return;

        unhideChat(targetPartner);
        const canonical = getDmRoomId(activeUid, targetPartner);
        setLastMessagesMap((prev) => ({
          ...prev,
          [canonical]: msg,
        }));
        ensureDiscoveredDmPartner(targetPartner, msg.user || msg.sender_name);

        const isViewing = Boolean(
          activeDmUserIdRef.current &&
          String(activeDmUserIdRef.current).toLowerCase().trim() === String(targetPartner).toLowerCase().trim()
        );

        if (!isViewing && !isFromMe) {
          setUnreadCounts((prev) => {
            const current = prev[targetPartner] || prev[canonical] || 0;
            const next = { ...prev, [targetPartner]: current + 1, [canonical]: current + 1 };
            persistUnreadCounts(activeUid, next);
            return next;
          });
          try { sounds.playMessage(); } catch { }
        }
        return;
      }

      unhideChat(rawRoomId);
      setLastMessagesMap((prev) => ({
        ...prev,
        [rawRoomId]: msg,
      }));

      const curChan = activeChannelRef.current;
      const isViewing = !activeDmUserIdRef.current && (
        curChan === rawRoomId ||
        rawRoomId === `text-${curChan}` ||
        rawRoomId?.replace(/^text-/, '') === curChan?.replace(/^text-/, '')
      );

      if (!isViewing && !isFromMe) {
        setUnreadCounts((prev) => {
          const current = prev[rawRoomId] || 0;
          const next = { ...prev, [rawRoomId]: current + 1 };
          persistUnreadCounts(activeUid, next);
          return next;
        });
        try { sounds.playMessage(); } catch { }
      }
    };

    chatService.on('message', handleChatMessage);

    return () => {
      cancelled = true;
      unsubRecovered?.();
      unsubDms?.();
      unsubChannelMsgs?.();
      chatService.off('message', handleChatMessage);
    };
  }, [effectiveUserId, friendIdsKey, ensureDiscoveredDmPartner, unhideChat]);

  // Search query state
  const [searchQuery, setSearchQuery] = useState('');

  // Persistent Read Receipts state: { [roomId]: timestamp }
  const [readReceipts, setReadReceipts] = useState(() => {
    try {
      const key = `voys_read_receipts_${currentUserProfile?.id || 'default'}`;
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const key = `voys_read_receipts_${currentUserProfile?.id || 'default'}`;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      setReadReceipts(stored);
    } catch { }
  }, [currentUserProfile?.id]);

  useEffect(() => {
    const handleReadReceipt = (data) => {
      if (!data?.roomId && !data?.room) return;
      const targetRoom = data.roomId || data.room;
      // Do not treat our own viewing as the recipient reading our sent messages
      if (data.readerId && currentUserProfile?.id && String(data.readerId) === String(currentUserProfile.id)) {
        return;
      }
      const readAt = data.readAt || Date.now();
      setReadReceipts((prev) => {
        const updated = {
          ...prev,
          [targetRoom]: readAt,
          ...(data.readerId ? { [data.readerId]: readAt } : {}),
        };
        try {
          const key = `voys_read_receipts_${currentUserProfile?.id || 'default'}`;
          localStorage.setItem(key, JSON.stringify(updated));
        } catch { }
        return updated;
      });

      setLastMessagesMap((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k === targetRoom || k === data.readerId) {
            const m = next[k];
            if (m && !m.read_at) {
              next[k] = { ...m, read_at: readAt, read: true, is_read: true };
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    };

    const handleDeliveryReceipt = (data) => {
      if (!data?.roomId && !data?.receiverId) return;
      if (data.receiverId && currentUserProfile?.id && String(data.receiverId) === String(currentUserProfile.id)) {
        return;
      }
      const deliveredAt = data.deliveredAt || Date.now();
      setLastMessagesMap((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k === data.roomId || k === data.receiverId) {
            const m = next[k];
            if (m && !m.delivered_at) {
              next[k] = { ...m, delivered_at: deliveredAt };
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    };

    chatService.on('message_read', handleReadReceipt);
    chatService.on('message_delivered', handleDeliveryReceipt);
    return () => {
      chatService.off('message_read', handleReadReceipt);
      chatService.off('message_delivered', handleDeliveryReceipt);
    };
  }, [currentUserProfile?.id]);

  // Filter pills state: 'all' | 'dms' | 'channels' | 'unread'
  const [filterTab, setFilterTab] = useState('all');

  // Sidebar view state: 'chats' | 'addFriend'
  const [sidebarView, setSidebarView] = useState('chats');

  // Friends panel internal states
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');

  // Add friend panel internal states
  const [addFriendTab, setAddFriendTab] = useState('search'); // 'search' | 'incoming' | 'outgoing'
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [friendFeedback, setFriendFeedback] = useState(null);

  // Create group panel internal states
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupFriends, setSelectedGroupFriends] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const handleCreateGroupSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;

    try {
      setIsCreatingGroup(true);
      if (onCreateChannel) {
        await onCreateChannel({
          name: trimmed,
          members: selectedGroupFriends,
        });
      } else if (onOpenCreateChannel) {
        onOpenCreateChannel();
      }
      setNewGroupName('');
      setSelectedGroupFriends([]);
      setSidebarView('chats');
    } catch (err) {
      toast.error('Grup oluşturulamadı', { description: err.message });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const toggleSelectGroupFriend = (friendId) => {
    setSelectedGroupFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  // Plus Action Dropdown State
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef(null);

  // Close plus popup on click outside & Escape
  useEffect(() => {
    if (!isPlusMenuOpen) return;
    const handleClickOutside = (e) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
        setIsPlusMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsPlusMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlusMenuOpen]);

  // Close sub-views (addFriend, createGroup) on Escape
  useEffect(() => {
    if (sidebarView === 'chats') return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarView('chats');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarView]);

  const openAddFriendView = () => {
    setFriendFeedback(null);
    setSearchError(null);
    if (friendSearchQuery.trim().length >= 2) {
      setIsSearchingUsers(true);
    }
    setSidebarView('addFriend');
  };

  // Sync latest friendships when Add Friend panel opens
  useEffect(() => {
    if (sidebarView === 'addFriend') {
      onFriendshipUpdated?.();
    }
  }, [sidebarView, onFriendshipUpdated]);

  const resolvedCurrentUserId = useMemo(() => {
    if (currentUserId && currentUserId !== 'you') return currentUserId;
    if (currentUserProfile?.id && currentUserProfile.id !== 'you') return currentUserProfile.id;
    return null;
  }, [currentUserId, currentUserProfile?.id]);

  // Debounced search for users
  useEffect(() => {
    if (sidebarView !== 'addFriend') return;
    const q = friendSearchQuery.trim();
    if (!q || q.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsSearchingUsers(true);
        setSearchError(null);
        const results = await dbService.searchUsers(q, resolvedCurrentUserId);
        if (!cancelled) {
          setSearchResults(results || []);
        }
      } catch (err) {
        console.warn('Search users error in sidebar:', err);
        if (!cancelled) {
          setSearchResults([]);
          setSearchError(err?.message || 'Kullanıcı araması sırasında bir hata oluştu.');
        }
      } finally {
        if (!cancelled) {
          setIsSearchingUsers(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [friendSearchQuery, sidebarView, resolvedCurrentUserId]);

  const handleSendFriendRequest = async (targetUserId, targetName) => {
    setFriendFeedback(null);
    if (!resolvedCurrentUserId) {
      const msg = 'Kullanıcı oturumu doğrulanamadı. Lütfen sayfayı yenileyin.';
      setFriendFeedback({ type: 'error', message: msg });
      toast.error('İstek Gönderilemedi', { description: msg });
      return;
    }

    try {
      setActionLoadingId(targetUserId);
      await dbService.sendFriendRequest(resolvedCurrentUserId, targetUserId);
      const successMsg = `${targetName || 'Kullanıcı'} kullanıcısına arkadaşlık isteği gönderildi.`;
      setFriendFeedback({ type: 'success', message: successMsg });
      toast.success('Arkadaşlık İsteği Gönderildi', {
        description: `${targetName || 'Kullanıcı'} kullanıcısına istek iletildi.`,
      });
      onFriendshipUpdated?.();
      setAddFriendTab('outgoing');
    } catch (err) {
      const msg = err?.message || 'Bir hata oluştu.';
      setFriendFeedback({ type: 'error', message: msg });
      toast.error('İstek Gönderilemedi', {
        description: msg,
      });
      if (
        err?.code === 'ALREADY_FRIENDS' ||
        err?.code === 'PENDING_INCOMING' ||
        err?.code === 'PENDING_OUTGOING' ||
        /zaten|mevcut|bekleyen/i.test(msg)
      ) {
        onFriendshipUpdated?.();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptRequest = async (friendshipId, targetName) => {
    setFriendFeedback(null);
    try {
      setActionLoadingId(friendshipId);
      await dbService.acceptFriendRequest(friendshipId);
      const msg = `${targetName || 'Kullanıcı'} ile artık arkadaşsınız!`;
      setFriendFeedback({ type: 'success', message: msg });
      toast.success('Arkadaşlık İsteği Kabul Edildi', {
        description: msg,
      });
      onFriendshipUpdated?.();
    } catch (err) {
      const msg = err?.message || 'İstek kabul edilirken hata oluştu.';
      setFriendFeedback({ type: 'error', message: msg });
      toast.error('Hata Oluştu', { description: msg });
      onFriendshipUpdated?.();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectRequest = async (friendshipId) => {
    setFriendFeedback(null);
    try {
      setActionLoadingId(friendshipId);
      await dbService.rejectFriendRequest(friendshipId);
      setFriendFeedback({ type: 'info', message: 'İstek kaldırıldı.' });
      toast.info('İstek Kaldırıldı');
      onFriendshipUpdated?.();
    } catch (err) {
      const msg = err?.message || 'İstek kaldırılırken hata oluştu.';
      setFriendFeedback({ type: 'error', message: msg });
      toast.error('Hata Oluştu', { description: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyUsername = () => {
    const username = currentUserProfile?.username || 'user';
    const text = `@${username}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    toast.success('Kullanıcı Adı Kopyalandı', {
      description: `${text} panoya kopyalandı.`,
    });
  };

  // Status selector dropdown menu state (avatar click)
  const [isStatusPickerOpen, setIsStatusPickerOpen] = useState(false);
  const statusPickerRef = useRef(null);

  // Close status picker menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusPickerRef.current && !statusPickerRef.current.contains(e.target)) {
        setIsStatusPickerOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsStatusPickerOpen(false);
    };

    if (isStatusPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStatusPickerOpen]);



  // Combined Friends (props friends + dynamically discovered DM users from incoming messages)
  const combinedFriends = useMemo(() => {
    if (!discoveredDmUsers || discoveredDmUsers.length === 0) return friends || [];
    const existingIds = new Set((friends || []).map((f) => f.id));
    const extras = discoveredDmUsers.filter((d) => d && d.id && !existingIds.has(d.id));
    return [...(friends || []), ...extras];
  }, [friends, discoveredDmUsers]);

  const getMessageTimestampNumber = useCallback((msg) => {
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
  }, []);

  const totalDmUnreadCount = useMemo(() => {
    return combinedFriends.reduce((acc, friend) => {
      const dmRoomId = currentUserProfile?.id && friend?.id ? getDmRoomId(currentUserProfile.id, friend.id) : null;
      const count = Number(unreadCounts[friend.id] || (dmRoomId ? unreadCounts[dmRoomId] : 0) || 0);
      return acc + count;
    }, 0);
  }, [combinedFriends, currentUserProfile?.id, unreadCounts]);

  const totalChannelUnreadCount = useMemo(() => {
    return textChannels.reduce((acc, chan) => {
      if (!chan || chan.id === 'home' || chan.is_home) return acc;
      const count = Number(unreadCounts[chan.id] || unreadCounts[`text-${chan.id}`] || 0);
      return acc + count;
    }, 0);
  }, [textChannels, unreadCounts]);

  const totalUnreadCount = totalDmUnreadCount + totalChannelUnreadCount;

  // Unified Chat Items: DMs and Channels, sorted chronologically by latest message (recency), unread status, and online status
  const allChatItems = useMemo(() => {
    const items = [];
    const q = searchQuery.trim().toLowerCase();

    // 1. DMs / Friends
    if (filterTab !== 'channels') {
      combinedFriends.forEach((friend) => {
        if (!friend || !friend.id) return;
        if (hiddenChatIds.has(friend.id) && !q) return;
        if (q) {
          const match =
            friend.name?.toLowerCase().includes(q) ||
            friend.username?.toLowerCase().includes(q) ||
            friend.game?.toLowerCase().includes(q) ||
            friend.substatus?.toLowerCase().includes(q);
          if (!match) return;
        }

        const dmRoomId = currentUserProfile?.id && friend?.id
          ? getDmRoomId(currentUserProfile.id, friend.id)
          : null;

        const rawLastMsg = (
          activeChannel === dmRoomId &&
          activeLastMessage &&
          isDirectMessageForPair(activeLastMessage, currentUserProfile?.id, friend.id)
        )
          ? activeLastMessage
          : (dmRoomId ? lastMessagesMap[dmRoomId] : null);

        const lastMsg = (
          rawLastMsg &&
          isDirectMessageForPair(rawLastMsg, currentUserProfile?.id, friend.id)
        )
          ? rawLastMsg
          : null;

        const rawTime = lastMsg ? (lastMsg.sentAt || lastMsg.sent_at || lastMsg.created_at) : null;
        const msgTime = getMessageTimestampNumber(lastMsg);
        const unreadCount = Number(unreadCounts[friend.id] || (dmRoomId ? unreadCounts[dmRoomId] : 0) || 0);

        items.push({
          type: 'dm',
          id: friend.id,
          key: `dm-${friend.id}`,
          friend,
          dmRoomId,
          lastMsg,
          rawTime,
          msgTime,
          unreadCount,
        });
      });
    }

    // 2. Channels / Groups
    if (filterTab !== 'dms') {
      textChannels.forEach((chan) => {
        if (!chan || chan.id === 'home' || chan.is_home || chan.id === 'voice-sesli-sohbet') return;
        if (hiddenChatIds.has(chan.id) && !q) return;
        if (q && !chan.name?.toLowerCase().includes(q)) return;

        const lastMsg = (activeChannel === chan.id && activeLastMessage)
          ? activeLastMessage
          : lastMessagesMap[chan.id];

        const rawTime = lastMsg ? (lastMsg.sentAt || lastMsg.sent_at || lastMsg.created_at) : null;
        const msgTime = getMessageTimestampNumber(lastMsg);
        const unreadCount = Number(unreadCounts[chan.id] || unreadCounts[`text-${chan.id}`] || 0);

        items.push({
          type: 'channel',
          id: chan.id,
          key: `chan-${chan.id}`,
          chan,
          lastMsg,
          rawTime,
          msgTime,
          unreadCount,
        });
      });
    }

    // 3. Sort newest activity first, then unread, then online status, then name
    return items.sort((a, b) => {
      if (a.msgTime !== b.msgTime) {
        return b.msgTime - a.msgTime;
      }
      if (a.unreadCount !== b.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      const aOnline = a.type === 'dm' && (a.friend.isOnline || a.friend.status === 'online');
      const bOnline = b.type === 'dm' && (b.friend.isOnline || b.friend.status === 'online');
      if (aOnline !== bOnline) {
        return bOnline ? 1 : -1;
      }
      const aName = a.type === 'dm' ? (a.friend.name || '') : (a.chan.name || '');
      const bName = b.type === 'dm' ? (b.friend.name || '') : (b.chan.name || '');
      return aName.localeCompare(bName, 'tr', { sensitivity: 'base' });
    });
  }, [
    filterTab,
    searchQuery,
    combinedFriends,
    hiddenChatIds,
    currentUserProfile?.id,
    activeChannel,
    activeLastMessage,
    lastMessagesMap,
    getMessageTimestampNumber,
    unreadCounts,
    textChannels,
  ]);

  // All Friends List (Filtered & Sorted: Game / Online first, then Alphabetical)
  const filteredAllFriends = useMemo(() => {
    let list = Array.isArray(combinedFriends) ? [...combinedFriends] : [];
    if (friendsSearchQuery.trim()) {
      const q = friendsSearchQuery.toLowerCase();
      list = list.filter((f) =>
        f.name?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q) ||
        f.game?.toLowerCase().includes(q) ||
        f.substatus?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const aScore = a.game ? 3 : (a.isOnline || a.status === 'online' ? 2 : 1);
      const bScore = b.game ? 3 : (b.isOnline || b.status === 'online' ? 2 : 1);
      if (aScore !== bScore) return bScore - aScore;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [combinedFriends, friendsSearchQuery]);

  const totalResultsCount = allChatItems.length;
  const activeCallsCount = Object.values(channelCalls).filter(c => c.active).length;

  return (
    <aside className="w-[275px] flex-shrink-0 h-full bg-[#0c0c0e] voys-glass-sidebar border-r border-white/[0.06] flex flex-col select-none overflow-hidden z-10 font-sans">
      {sidebarView === 'friends' ? (
        /* Tüm Arkadaşlar Paneli (Sol kenar penceresinde açılan sayfa) */
        <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0e] sidebar-transparent-on-glass">
          {/* Top Header: Back Arrow & Title */}
          <div className="h-14 px-3.5 bg-[#0a0a0c] sidebar-transparent-on-glass border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => setSidebarView('chats')}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Geri (Sohbetlere Dön)"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex items-center space-x-2">
                <Users size={16} className="text-[#8B51FF]" />
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Arkadaşlar ({friends?.length || 0})
                </h2>
              </div>
            </div>

            {/* Quick Add Friend Button */}
            <button
              type="button"
              onClick={openAddFriendView}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-indigo-400 text-xs font-semibold rounded-lg border border-indigo-500/30 flex items-center space-x-1 transition cursor-pointer"
              title="Yeni Arkadaş Ekle"
            >
              <UserPlus size={13} />
              <span>Ekle</span>
            </button>
          </div>

          {/* Search Box inside Friends */}
          <div className="p-3 border-b border-white/[0.06] bg-[#0c0c0e]">
            <div className="h-9 px-3 bg-[#141418] rounded-lg flex items-center text-xs text-gray-200 border border-white/[0.08] focus-within:border-[#8B51FF]/60 transition">
              <Search size={14} className="text-gray-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                value={friendsSearchQuery}
                onChange={(e) => setFriendsSearchQuery(e.target.value)}
                placeholder="Arkadaşlarında ara..."
                className="w-full bg-transparent border-none outline-none text-xs text-gray-200 placeholder-gray-500"
              />
              {friendsSearchQuery && (
                <button
                  type="button"
                  onClick={() => setFriendsSearchQuery('')}
                  className="text-gray-400 hover:text-white ml-1 p-0.5 rounded transition cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Friends List Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] custom-scrollbar min-h-0">
            {filteredAllFriends.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#141418] flex items-center justify-center text-gray-500">
                  <Users size={22} />
                </div>
                <p className="text-gray-300 font-medium">
                  {friendsSearchQuery ? 'Aradığınız arkadaş bulunamadı' : 'Henüz ekli arkadaşınız yok'}
                </p>
              </div>
            ) : (
              filteredAllFriends.map((friend) => (
                <div
                  key={`all-friends-${friend.id}`}
                  onClick={() => {
                    unhideChat(friend.id);
                    onSelectDm?.(friend.id);
                    setSidebarView('chats');
                  }}
                  className="px-3.5 py-2.5 flex items-center justify-between hover:bg-[#141418] cursor-pointer transition select-none group"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                    <UserAvatar
                      user={friend}
                      size="md"
                      showStatus={true}
                      status={friend.status}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {friend.name}
                        </span>
                        {friend.isSelf && (
                          <span className="text-[10px] text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.2 rounded font-semibold flex-shrink-0">
                            Sen
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] truncate mt-0.5">
                        {friend.game ? (
                          <span className="text-emerald-400 font-medium flex items-center space-x-1">
                            <Gamepad2 size={11} className="flex-shrink-0 mr-1 inline" />
                            <span>{friend.game}</span>
                          </span>
                        ) : !friend.isOnline || friend.status === 'offline' || friend.status === 'invisible' ? (
                          <span className="text-gray-500">Çevrimdışı</span>
                        ) : friend.status === 'dnd' ? (
                          <span className="text-rose-400/90">Rahatsız Etmeyin</span>
                        ) : friend.status === 'idle' ? (
                          <span className="text-amber-400/90">Boşta</span>
                        ) : friend.substatus && !['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin', 'Görünmez', 'Çevrimdışı', 'P2P Bağlantısı'].includes(friend.substatus) ? (
                          <span className="text-gray-400">{friend.substatus}</span>
                        ) : (
                          <span className="text-emerald-400">Çevrimiçi</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action: Mesaj Gönder */}
                  <div className="flex items-center space-x-1 flex-shrink-0 opacity-80 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        unhideChat(friend.id);
                        onSelectDm?.(friend.id);
                        setSidebarView('chats');
                      }}
                      className="px-2.5 py-1 bg-white/5 hover:bg-[#8B51FF]/20 hover:text-[#bb94ff] text-gray-300 rounded-lg text-xs font-semibold border border-white/5 hover:border-[#8B51FF]/30 transition cursor-pointer"
                      title="Sohbeti Aç"
                    >
                      Mesaj
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : sidebarView === 'addFriend' ? (
        /* Arkadaş Ekle Paneli (Sadece sol kenar penceresinde açılan sayfa) */
        <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0e] sidebar-transparent-on-glass">
          {/* Top Header: Back Arrow & Title */}
          <div className="h-14 px-3.5 bg-[#0a0a0c] sidebar-transparent-on-glass border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => setSidebarView('chats')}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Geri (Sohbetlere Dön)"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Arkadaş Ekle</h2>
              </div>
            </div>
          </div>

          {/* Tab Filter: Ara | İstekler | Gönderilen */}
          <div className="p-2 border-b border-white/[0.06] bg-[#0c0c0e] sidebar-transparent-on-glass flex items-center space-x-1 flex-shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setAddFriendTab('search')}
              className={`flex-1 py-1.5 rounded-lg text-center font-medium transition ${addFriendTab === 'search'
                ? 'bg-[#18181f] text-white font-semibold border border-white/10 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
              Kullanıcı Ara
            </button>
            <button
              type="button"
              onClick={() => setAddFriendTab('incoming')}
              className={`flex-1 py-1.5 rounded-lg text-center font-medium transition relative ${addFriendTab === 'incoming'
                ? 'bg-[#18181f] text-white font-semibold border border-white/10 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
              <span>İstekler</span>
              {incomingRequests.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-emerald-500 text-white text-[9px] font-bold rounded-full">
                  {incomingRequests.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setAddFriendTab('outgoing')}
              className={`flex-1 py-1.5 rounded-lg text-center font-medium transition ${addFriendTab === 'outgoing'
                ? 'bg-[#18181f] text-white font-semibold border border-white/10 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
              Gönderilen
              {outgoingRequests.length > 0 && (
                <span className="ml-1 text-[10px] text-gray-400">({outgoingRequests.length})</span>
              )}
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar min-h-0">
            {friendFeedback && (
              <div
                role="alert"
                className={`p-2.5 rounded-xl border text-[11px] flex items-start space-x-2 ${friendFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : friendFeedback.type === 'info'
                    ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                  }`}
              >
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span className="leading-snug flex-1">{friendFeedback.message}</span>
                <button
                  type="button"
                  onClick={() => setFriendFeedback(null)}
                  className="text-current/70 hover:text-white transition"
                  aria-label="Bildirimi kapat"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {addFriendTab === 'search' && (
              <>
                {/* Search Input Box */}
                <div className="h-9 px-3 bg-[#141418] rounded-lg flex items-center text-xs text-gray-200 border border-white/[0.08] focus-within:border-[#8B51FF]/60 focus-within:ring-1 focus-within:ring-[#8B51FF]/40 transition">
                  <Search size={14} className="text-gray-400 flex-shrink-0 mr-2" />
                  <input
                    type="text"
                    value={friendSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      const trimmed = val.trim();
                      setFriendSearchQuery(val);
                      setFriendFeedback(null);
                      setSearchError(null);
                      if (!trimmed || trimmed.length < 2) {
                        setSearchResults([]);
                        setIsSearchingUsers(false);
                      } else {
                        setIsSearchingUsers(true);
                      }
                    }}
                    placeholder="Kullanıcı adı veya isim ara..."
                    className="w-full bg-transparent border-none outline-none text-xs text-gray-200 placeholder-gray-500"
                    autoFocus
                  />
                  {friendSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setFriendSearchQuery('');
                        setSearchResults([]);
                        setIsSearchingUsers(false);
                        setSearchError(null);
                        setFriendFeedback(null);
                      }}
                      className="text-gray-400 hover:text-white ml-1 p-0.5 rounded transition"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Current User Username info card */}
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] text-gray-400 font-medium">Senin Kullanıcı Adın</p>
                    <p className="text-xs font-bold text-white font-mono truncate">
                      @{currentUserProfile?.username || 'user'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUsername}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition flex items-center space-x-1 text-[11px] font-medium border border-white/10 flex-shrink-0"
                    title="Kullanıcı Adını Kopyala"
                  >
                    <Copy size={12} />
                    <span>Kopyala</span>
                  </button>
                </div>

                {/* Results List */}
                <div className="space-y-1.5 pt-1">
                  {isSearchingUsers ? (
                    <div className="py-6 flex flex-col items-center justify-center text-gray-400 space-y-2">
                      <Loader2 size={18} className="animate-spin text-emerald-400" />
                      <span className="text-xs">Kullanıcılar aranıyor...</span>
                    </div>
                  ) : searchError ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center space-y-1">
                      <p className="font-semibold">Arama yapılamadı</p>
                      <p className="text-[11px] text-rose-300/80">{searchError}</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((user) => {
                      const isAlreadyFriend = friends.some((f) => f.id === user.id);
                      const incomingReq = incomingRequests.find((i) => i.id === user.id);
                      const isPendingOutgoing = outgoingRequests.some((o) => o.id === user.id);
                      const isLoadingThis =
                        actionLoadingId === user.id ||
                        (incomingReq && actionLoadingId === incomingReq.friendshipId);

                      return (
                        <div
                          key={user.id}
                          className="p-2 rounded-xl bg-[#141418] border border-white/[0.06] flex items-center justify-between space-x-2"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <UserAvatar
                              user={user}
                              size="sm"
                              showStatus={false}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{user.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono truncate">
                                @{user.username}
                              </p>
                            </div>
                          </div>

                          {isAlreadyFriend ? (
                            <button
                              type="button"
                              onClick={() => {
                                unhideChat(user.id);
                                onSelectDm?.(user.id);
                                setSidebarView('chats');
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition flex-shrink-0 flex items-center space-x-1"
                              title="Mesaj Gönder"
                            >
                              <UserCheck size={12} />
                              <span>Arkadaş</span>
                            </button>
                          ) : incomingReq ? (
                            <button
                              type="button"
                              disabled={isLoadingThis}
                              onClick={() => handleAcceptRequest(incomingReq.friendshipId, user.name)}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition flex-shrink-0 flex items-center space-x-1 disabled:opacity-50"
                            >
                              {isLoadingThis ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              <span>Kabul Et</span>
                            </button>
                          ) : isPendingOutgoing ? (
                            <span className="px-2 py-1 text-[10px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg flex-shrink-0 flex items-center space-x-1">
                              <Clock size={11} />
                              <span>İletildi</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isLoadingThis}
                              onClick={() => handleSendFriendRequest(user.id, user.name)}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition flex-shrink-0 flex items-center space-x-1 disabled:opacity-50"
                            >
                              {isLoadingThis ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <UserPlus size={12} />
                              )}
                              <span>Ekle</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : friendSearchQuery.trim().length >= 2 ? (
                    <div className="py-6 text-center text-gray-500 text-xs">
                      "{friendSearchQuery}" ile eşleşen kullanıcı bulunamadı.
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500 text-xs px-4">
                      Voys'taki arkadaşlarını eklemek için yukarıdaki arama çubuğuna kullanıcı adını yaz.
                    </div>
                  )}
                </div>
              </>
            )}

            {addFriendTab === 'incoming' && (
              <div className="space-y-1.5">
                {incomingRequests.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-xs flex flex-col items-center justify-center space-y-2">
                    <UserPlus size={24} className="text-gray-600" />
                    <span>Bekleyen arkadaşlık isteği yok.</span>
                  </div>
                ) : (
                  incomingRequests.map((req) => {
                    const isLoadingThis = actionLoadingId === req.friendshipId;
                    return (
                      <div
                        key={req.friendshipId || req.id}
                        className="p-2.5 rounded-xl bg-[#141418] border border-white/[0.06] flex items-center justify-between space-x-2"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <UserAvatar
                            user={req}
                            size="sm"
                            showStatus={false}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{req.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono truncate">
                              @{req.username}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            type="button"
                            disabled={isLoadingThis}
                            onClick={() => handleAcceptRequest(req.friendshipId, req.name)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
                            title="Kabul Et"
                          >
                            {isLoadingThis ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          </button>
                          <button
                            type="button"
                            disabled={isLoadingThis}
                            onClick={() => handleRejectRequest(req.friendshipId)}
                            className="p-1.5 bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 rounded-lg transition disabled:opacity-50"
                            title="Reddet"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {addFriendTab === 'outgoing' && (
              <div className="space-y-1.5">
                {outgoingRequests.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-xs flex flex-col items-center justify-center space-y-2">
                    <Clock size={24} className="text-gray-600" />
                    <span>Gönderilmiş bekleyen istek yok.</span>
                  </div>
                ) : (
                  outgoingRequests.map((req) => {
                    const isLoadingThis = actionLoadingId === req.friendshipId;
                    return (
                      <div
                        key={req.friendshipId || req.id}
                        className="p-2.5 rounded-xl bg-[#141418] border border-white/[0.06] flex items-center justify-between space-x-2"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <UserAvatar
                            user={req}
                            size="sm"
                            showStatus={false}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{req.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono truncate">
                              @{req.username}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isLoadingThis}
                          onClick={() => handleRejectRequest(req.friendshipId)}
                          className="px-2 py-1 text-[10px] font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 rounded-lg transition flex-shrink-0"
                          title="İsteği İptal Et"
                        >
                          {isLoadingThis ? <Loader2 size={12} className="animate-spin" /> : 'İptal'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      ) : sidebarView === 'createGroup' ? (
        /* Grup Oluştur Paneli (Sol kenar penceresinde açılan sayfa) */
        <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0e] sidebar-transparent-on-glass">
          {/* Top Header: Back Arrow & Title */}
          <div className="h-14 px-3.5 bg-[#0a0a0c] sidebar-transparent-on-glass border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => {
                  setNewGroupName('');
                  setSelectedGroupFriends([]);
                  setSidebarView('chats');
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Geri (Sohbetlere Dön)"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Grup Oluştur</h2>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleCreateGroupSubmit} className="flex-1 flex flex-col justify-between p-3.5 space-y-4 overflow-y-auto custom-scrollbar min-h-0">
            <div className="space-y-4">
              {/* Group Name Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Grup Adı
                </label>
                <div className="h-10 px-3 bg-[#141418] rounded-xl flex items-center text-xs text-white border border-white/[0.08] focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/40 transition">
                  <Users size={16} className="text-gray-400 mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Örn: Oyun Grubu, Proje Ekibi..."
                    className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-gray-500"
                  />
                  {newGroupName && (
                    <button
                      type="button"
                      onClick={() => setNewGroupName('')}
                      className="text-gray-400 hover:text-white ml-1 p-0.5 rounded transition cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Add Friends Section (Optional Member Select) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                    Üye Ekle {friends.length > 0 ? `(${selectedGroupFriends.length}/${friends.length})` : ''}
                  </label>
                  {selectedGroupFriends.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedGroupFriends([])}
                      className="text-[10px] text-gray-400 hover:text-white transition cursor-pointer"
                    >
                      Seçimi Temizle
                    </button>
                  )}
                </div>

                {friends.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#141418]/60 border border-white/5 text-center text-xs text-gray-500">
                    Henüz arkadaş listenizde kimse yok. Grubu şimdi oluşturup daha sonra da üye ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-0.5">
                    {friends.map((friend) => {
                      const isSelected = selectedGroupFriends.includes(friend.id);
                      return (
                        <div
                          key={friend.id}
                          onClick={() => toggleSelectGroupFriend(friend.id)}
                          className={`p-2 rounded-xl flex items-center justify-between transition cursor-pointer border ${isSelected
                            ? 'bg-indigo-600/15 border-indigo-500/30 text-white'
                            : 'bg-[#141418] hover:bg-white/[0.05] border-white/[0.06] text-gray-300'
                            }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <UserAvatar user={friend} size="sm" showStatus={false} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{friend.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono truncate">
                                @{friend.username}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-white/20 bg-transparent'
                              }`}
                          >
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center space-x-2 mt-auto">
              <button
                type="button"
                onClick={() => {
                  setNewGroupName('');
                  setSelectedGroupFriends([]);
                  setSidebarView('chats');
                }}
                className="flex-1 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/5 cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={!newGroupName.trim() || isCreatingGroup}
                className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {isCreatingGroup ? (
                  <Loader2 size={13} className="animate-spin text-white" />
                ) : (
                  <Check size={14} />
                )}
                <span>Grup Oluştur</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Standart Sohbetler ve Kanallar Listesi */
        <>
          {/* 1. SEARCH BAR & ADD FRIEND BUTTON */}
          <div className="px-3 pt-3 pb-2 bg-[#0c0c0e] sidebar-transparent-on-glass">
            <div className="flex items-center space-x-2">
              <div className="flex-1 h-9 px-3 bg-[#141418] sidebar-search-box rounded-lg flex items-center text-xs text-gray-200 border border-white/[0.08] focus-within:border-[#8B51FF]/60 focus-within:ring-1 focus-within:ring-[#8B51FF]/40 transition">
                <Search size={15} className="text-gray-400 flex-shrink-0 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Sohbet arayın..."
                  className="w-full bg-transparent border-none outline-none text-xs text-gray-200 placeholder-gray-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-white ml-1 p-0.5 rounded transition cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Tüm Ekli Arkadaşlar Butonu (Artı ikonunun hemen solunda) */}
              <button
                type="button"
                onClick={() => setSidebarView((prev) => (prev === 'friends' ? 'chats' : 'friends'))}
                className={`h-9 w-9 rounded-lg flex items-center justify-center transition flex-shrink-0 relative group shadow-sm border cursor-pointer ${sidebarView === 'friends'
                  ? 'bg-[#8B51FF] text-white border-[#8B51FF]'
                  : 'bg-[#141418] hover:bg-[#8B51FF] hover:text-white text-gray-300 border-white/[0.08]'
                  }`}
                title={`Tüm Arkadaşlar (${friends?.length || 0})`}
              >
                <Users size={17} className={`${sidebarView === 'friends' ? 'text-white' : 'text-gray-300 group-hover:text-white'} transition`} />
              </button>

              {/* Add / Plus Button (+) with Dropdown Menu */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition flex-shrink-0 relative group shadow-sm border cursor-pointer ${isPlusMenuOpen || sidebarView === 'addFriend' || sidebarView === 'createGroup'
                    ? 'bg-[#8B51FF] text-white border-[#8B51FF]'
                    : 'bg-[#141418] hover:bg-[#8B51FF] hover:text-white text-gray-300 border-white/[0.08]'
                    }`}
                  title={`Ekle ${incomingRequestsCount > 0 ? `(${incomingRequestsCount} İstek)` : ''}`}
                >
                  <Plus size={18} className={`${isPlusMenuOpen || sidebarView === 'addFriend' || sidebarView === 'createGroup' ? 'text-white' : 'text-gray-300 group-hover:text-white'} transition`} />
                  {incomingRequestsCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#141418]" />
                  )}
                </button>

                {/* Açılır Menü (Popup) */}
                {isPlusMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#141418] border border-white/10 rounded-2xl shadow-xl p-1.5 z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        openAddFriendView();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-white/10 rounded-xl transition text-left cursor-pointer"
                    >
                      <UserPlus size={15} className="text-emerald-400 flex-shrink-0" />
                      <span className="flex-1">Arkadaş Ekle</span>
                      {incomingRequestsCount > 0 && (
                        <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                          {incomingRequestsCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        setSidebarView('createGroup');
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-white/10 rounded-xl transition text-left cursor-pointer"
                    >
                      <Users size={15} className="text-indigo-400 flex-shrink-0" />
                      <span>Grup Oluştur</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 3. FILTER PILLS (WhatsApp Web Chips) */}
            <div className="flex items-center space-x-1.5 mt-2.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex-shrink-0 flex items-center space-x-1.5 cursor-pointer ${filterTab === 'all'
                  ? 'bg-[#8B51FF]/20 text-[#bb94ff] border border-[#8B51FF]/40 shadow-sm'
                  : 'bg-[#141418] text-gray-400 hover:text-gray-200 hover:bg-[#1a1a20] border border-white/[0.08]'
                  }`}
              >
                <span>Tümü</span>
                {totalUnreadCount > 0 && (
                  <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-[#8B51FF] text-white text-[10px] font-bold flex items-center justify-center select-none shadow-sm shadow-[#8B51FF]/30">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('dms')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex-shrink-0 flex items-center space-x-1.5 cursor-pointer ${filterTab === 'dms'
                  ? 'bg-[#8B51FF]/20 text-[#bb94ff] border border-[#8B51FF]/40 shadow-sm'
                  : 'bg-[#141418] text-gray-400 hover:text-gray-200 hover:bg-[#1a1a20] border border-white/[0.08]'
                  }`}
              >
                <span>Kişiler</span>
                {totalDmUnreadCount > 0 && (
                  <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-[#8B51FF] text-white text-[10px] font-bold flex items-center justify-center select-none shadow-sm shadow-[#8B51FF]/30">
                    {totalDmUnreadCount > 99 ? '99+' : totalDmUnreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('channels')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex-shrink-0 flex items-center space-x-1.5 cursor-pointer ${filterTab === 'channels'
                  ? 'bg-[#8B51FF]/20 text-[#bb94ff] border border-[#8B51FF]/40 shadow-sm'
                  : 'bg-[#141418] text-gray-400 hover:text-gray-200 hover:bg-[#1a1a20] border border-white/[0.08]'
                  }`}
              >
                <span>Gruplar</span>
                {totalChannelUnreadCount > 0 && (
                  <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-[#8B51FF] text-white text-[10px] font-bold flex items-center justify-center select-none shadow-sm shadow-[#8B51FF]/30">
                    {totalChannelUnreadCount > 99 ? '99+' : totalChannelUnreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 4. CHAT LIST (WhatsApp Web style rows) */}
          <div className="flex-1 overflow-y-auto">
            {totalResultsCount === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#141418] flex items-center justify-center text-gray-500">
                  <Search size={22} />
                </div>
                <p className="text-gray-300 font-medium">{filterTab === 'channels' ? 'Grup sohbeti bulunamadı' : 'Sohbet bulunamadı'}</p>
                <button
                  type="button"
                  onClick={filterTab === 'channels' ? () => setSidebarView('createGroup') : openAddFriendView}
                  className="px-3.5 py-1.5 bg-[#8B51FF] hover:bg-[#773BF5] text-white font-bold rounded-lg text-xs transition shadow-md"
                >
                  {filterTab === 'channels' ? '+ Yeni Grup Başlat' : '+ Yeni Sohbet Başlat'}
                </button>
              </div>
            ) : (
              allChatItems.map((item) => {
                if (item.type === 'dm') {
                  const { friend, dmRoomId, lastMsg, rawTime, unreadCount } = item;
                  const isSelected = activeDmUserId === friend.id;
                  const isPlayingGame = !!friend.game;

                  const lastMessageTime = lastMsg ? formatChatTimeOnly(rawTime, lastMsg.timestamp) : '';
                  const lastMessageDate = lastMsg ? formatChatDateOnly(rawTime, lastMsg.timestamp) : '';
                  const lastMessageText = formatMessagePreview(lastMsg);
                  const isSentByMe = Boolean(
                    lastMsg && (
                      (currentUserProfile?.id && (lastMsg.userId === currentUserProfile.id || lastMsg.sender_id === currentUserProfile.id)) ||
                      (currentUserProfile?.name && lastMsg.user === currentUserProfile.name) ||
                      lastMsg.isMe
                    )
                  );
                  const msgTimeNumber = Number(lastMsg?.sentAt || lastMsg?.sent_at) || (lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : 0);
                  const isMessageRead = Boolean(
                    lastMsg && (
                      lastMsg.read === true ||
                      lastMsg.is_read === true ||
                      Boolean(lastMsg.read_at) ||
                      (dmRoomId && readReceipts[dmRoomId] && (!msgTimeNumber || Number(readReceipts[dmRoomId]) >= msgTimeNumber)) ||
                      (friend.id && readReceipts[friend.id] && (!msgTimeNumber || Number(readReceipts[friend.id]) >= msgTimeNumber))
                    )
                  );
                  const isMessageDelivered = Boolean(
                    isMessageRead ||
                    Boolean(lastMsg?.delivered_at) ||
                    friend.isOnline ||
                    friend.status === 'online' ||
                    friend.status === 'idle' ||
                    friend.status === 'dnd'
                  );

                  return (
                    <div
                      key={item.key}
                      onClick={() => {
                        clearUnread(friend.id, dmRoomId);
                        unhideChat(friend.id);
                        onSelectDm?.(friend.id);
                      }}
                      onContextMenu={(e) => handleChatContextMenu(e, {
                        type: 'dm',
                        id: friend.id,
                        name: friend.name,
                      })}
                      className={`h-[68px] px-3.5 flex items-center space-x-3 cursor-pointer transition select-none relative ${isSelected
                        ? 'bg-[#18181f]'
                        : 'hover:bg-[#121215]'
                        }`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <UserAvatar
                          user={friend}
                          size="md"
                          showStatus={true}
                          status={friend.status}
                        />
                      </div>

                      {/* Middle Column (Name & Status / Preview) */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                            <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                              {friend.name}
                            </p>
                            {friend.isSelf && (
                              <span className="text-[10px] text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.2 rounded font-semibold flex-shrink-0">
                                Sen
                              </span>
                            )}
                          </div>
                          {/* Timestamp / Son Mesaj Saati (HH:mm) */}
                          <span className={`text-[10px] flex-shrink-0 ml-1 font-normal ${unreadCount > 0 ? 'text-[#bb94ff] font-semibold' : lastMessageTime ? 'text-gray-400' : 'text-gray-500'}`}>
                            {lastMessageTime}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-0.5">
                          {isPlayingGame ? (
                            <div className="flex items-center space-x-1 text-[11px] text-emerald-400 truncate font-medium">
                              <Gamepad2 size={12} className="flex-shrink-0" />
                              <span className="truncate">{friend.game}</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1 text-[11px] text-gray-400 truncate min-w-0 flex-1">
                              {isSentByMe && (
                                isMessageRead ? (
                                  <CheckCheck
                                    size={14}
                                    className="flex-shrink-0 text-[#8B51FF]"
                                    title="Okundu"
                                  />
                                ) : isMessageDelivered ? (
                                  <CheckCheck
                                    size={14}
                                    className="flex-shrink-0 text-gray-400"
                                    title="İletildi"
                                  />
                                ) : (
                                  <Check
                                    size={14}
                                    className="flex-shrink-0 text-gray-500"
                                    title="Gönderildi"
                                  />
                                )
                              )}
                              <span className={`truncate ${unreadCount > 0 ? 'text-white font-medium' : isSelected ? 'text-gray-200' : 'text-gray-400'}`}>
                                {lastMessageText || (friend.isOnline ? (friend.substatus || 'Çevrimiçi') : 'Çevrimdışı')}
                              </span>
                            </div>
                          )}

                          {/* Right Badges / Son Mesaj Tarihi (DD.MM.YYYY) & Purple Notification Badge */}
                          <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                            {lastMessageDate && unreadCount === 0 && (
                              <span className="text-[10px] font-normal text-gray-500 flex-shrink-0 select-none">
                                {lastMessageDate}
                              </span>
                            )}
                            {unreadCount > 0 && (
                              <span className="min-w-[19px] h-[19px] px-1.5 rounded-full bg-[#8B51FF] text-white text-[10px] font-bold flex items-center justify-center shadow-md shadow-[#8B51FF]/40 select-none animate-in fade-in zoom-in duration-200">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Channel / Group Item
                const { chan, lastMsg, rawTime, unreadCount } = item;
                const isSelected = !activeDmUserId && Boolean(
                  activeChannel && (
                    activeChannel === chan.id ||
                    chan.id === `text-${activeChannel}` ||
                    chan.id?.replace(/^text-/, '') === activeChannel?.replace(/^text-/, '') ||
                    chan.name?.toLowerCase() === activeChannel?.toLowerCase()
                  )
                );

                const lastMessageTime = lastMsg ? formatChatTimeOnly(rawTime, lastMsg.timestamp) : '';
                const lastMessageDate = lastMsg ? formatChatDateOnly(rawTime, lastMsg.timestamp) : '';
                const lastMessageText = formatMessagePreview(lastMsg);
                const senderName = resolveMessageSenderName(lastMsg, currentUserProfile?.id, currentUserProfile?.name, combinedFriends);

                return (
                  <div
                    key={item.key}
                    onClick={() => {
                      clearUnread(chan.id, `text-${chan.id}`);
                      unhideChat(chan.id);
                      onSelectChannel?.(chan.id);
                    }}
                    onContextMenu={(e) => handleChatContextMenu(e, {
                      type: 'channel',
                      id: chan.id,
                      name: chan.name,
                    })}
                    className={`h-[68px] px-3.5 flex items-center space-x-3 cursor-pointer transition select-none relative ${isSelected
                      ? 'bg-[#18181f]'
                      : 'hover:bg-[#121215]'
                      }`}
                  >
                    {/* Channel Group Avatar */}
                    {chan.avatar_url || chan.avatar ? (
                      <img
                        src={chan.avatar_url || chan.avatar}
                        alt={chan.name}
                        className="w-9 h-9 rounded-full object-cover border border-indigo-500/40 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/25 to-purple-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 flex-shrink-0">
                        <Users size={18} />
                      </div>
                    )}

                    {/* Middle Column */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {chan.name}
                        </p>
                        <span className={`text-[10px] flex-shrink-0 ml-1 font-normal ${unreadCount > 0 ? 'text-[#bb94ff] font-semibold' : 'text-gray-400'}`}>
                          {lastMessageTime || 'Kanal'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-[11px] truncate min-w-0 flex-1 ${unreadCount > 0 ? 'text-white font-medium' : isSelected ? 'text-gray-200' : 'text-gray-400'}`}>
                          {lastMessageText ? (
                            <>
                              {senderName && (
                                <span className={`font-semibold mr-1 ${unreadCount > 0 ? 'text-[#bb94ff]' : isSelected ? 'text-gray-200' : 'text-gray-300'}`}>
                                  {senderName}:
                                </span>
                              )}
                              <span className="truncate">{lastMessageText}</span>
                            </>
                          ) : (
                            'Grup sohbeti'
                          )}
                        </p>

                        {/* Right Badges / Son Mesaj Tarihi (DD.MM.YYYY) & Purple Notification Badge */}
                        <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                          {lastMessageDate && unreadCount === 0 && (
                            <span className="text-[10px] font-normal text-gray-500 flex-shrink-0 select-none">
                              {lastMessageDate}
                            </span>
                          )}
                          {unreadCount > 0 && (
                            <span className="min-w-[19px] h-[19px] px-1.5 rounded-full bg-[#8B51FF] text-white text-[10px] font-bold flex items-center justify-center shadow-md shadow-[#8B51FF]/40 select-none animate-in fade-in zoom-in duration-200">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* 4. BOTTOM PROFILE & ACTIONS BAR */}
      {(() => {
        const currentStatusKey = currentUserProfile?.status || 'online';
        const activeStatusOption =
          STATUS_OPTIONS.find((opt) => opt.id === (currentStatusKey === 'offline' ? 'invisible' : currentStatusKey)) ||
          STATUS_OPTIONS[0];
        return (
          <div className="h-[68px] px-3.5 bg-[#0a0a0c] sidebar-bottom-bar border-t border-white/[0.06] flex items-center justify-between flex-shrink-0 relative">
            {/* Left: User Avatar (Click to change status) & Profile (Click to open settings) */}
            <div className="flex items-center gap-2.5 min-w-0 relative" ref={statusPickerRef}>
              {/* Status Picker Popover Menu (opens upward) */}
              {isStatusPickerOpen && (
                <div className="absolute left-0 bottom-[68px] w-44 bg-[#121216] border border-white/10 rounded-xl shadow-xl p-1.5 z-50">
                  <div className="space-y-0.5">
                    {STATUS_OPTIONS.map((opt) => {
                      const isCurrent = (currentStatusKey === 'offline' ? 'invisible' : currentStatusKey) === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onUpdateStatus?.(opt.id);
                            setIsStatusPickerOpen(false);
                          }}
                          className={`w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between transition ${isCurrent
                            ? 'bg-[#1c1c24] text-white border border-white/10 shadow-sm'
                            : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.color}`} />
                            <span className="text-xs font-medium leading-none">{opt.label}</span>
                          </div>
                          {isCurrent && (
                            <Check size={13} className={`${opt.textColor} flex-shrink-0 ml-1.5`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Avatar button for status toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStatusPickerOpen(prev => !prev);
                }}
                className="relative transition cursor-pointer flex-shrink-0 group"
                title="Durumunu Değiştir (Çevrimiçi, Boşta, Rahatsız Etmeyin...)"
              >
                <UserAvatar
                  user={currentUserProfile}
                  size="md"
                  showStatus={true}
                  status={currentStatusKey}
                />
              </button>

              {/* User Name & Details -> Clicking opens Settings */}
              <div
                onClick={() => onOpenSettings?.('account')}
                className="min-w-0 cursor-pointer p-1 rounded-xl hover:bg-white/5 transition group flex-1"
                title="Profil ve Ayarları Aç"
              >
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-bold text-white truncate transition ${activeStatusOption.hoverTextClass}`}>
                    {currentUserProfile?.name || 'Sen'}
                  </span>
                </div>
                {currentUserProfile?.game ? (
                  <div className="flex items-center space-x-1 text-[11px] text-emerald-400 font-semibold truncate mt-0.5">
                    <Gamepad2 size={12} className="flex-shrink-0 text-emerald-400" />
                    <span className="truncate">{currentUserProfile.game} Oynuyor</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 truncate">
                    @{currentUserProfile?.username || 'user'}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Settings Icon (Sol alttaki üç nokta yerine ayarlar ikonu) */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onOpenSettings?.('account')}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition"
                title="Ayarlar"
              >
                <Settings2 size={18} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Chat Right-Click Context Menu */}
      {chatContextMenu && createPortal(
        <div
          ref={chatContextMenuRef}
          style={{ top: `${chatContextMenu.y}px`, left: `${chatContextMenu.x}px` }}
          className="fixed z-[9999] w-48 rounded-xl bg-[#121216] border border-white/10 shadow-xl p-1.5 text-xs select-none"
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 mb-1">
            <p className="font-semibold text-white truncate text-xs">
              {chatContextMenu.chat.name}
            </p>
            <p className="text-[10px] text-gray-400">
              {chatContextMenu.chat.type === 'dm' ? 'Direkt Mesaj' : 'Kanal'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleHideChat(chatContextMenu.chat)}
            className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors text-left font-medium cursor-pointer"
          >
            <Trash2 size={13} className="flex-shrink-0" />
            <span>Sohbeti Sil</span>
          </button>
        </div>,
        document.body
      )}
    </aside>
  );
};
