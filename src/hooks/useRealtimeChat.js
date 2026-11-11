import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { chatService } from '../services/chatService';
import { dbService } from '../lib/supabase';
import { initialChatMessages, initialDmMessages } from '../data/mockData';
import { sounds } from '../utils/audio';
import { pickDisplayName } from '../utils/userDisplay';
import { isDirectMessageForPair, normalizeParticipantId, parseDmRoomPair } from '../utils/dmIsolation';
import { purgeUserFromMessagesMap } from '../utils/userPurge';

// Helper to format current timestamp (HH:mm only)
const formatTimestamp = () => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to format HH:mm from a given epoch or date string
const formatTimeFromDate = (val) => {
  if (!val) return '';
  const d = new Date(typeof val === 'number' ? val : (typeof val === 'string' && /^\d+$/.test(val) ? Number(val) : val));
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to safely resolve a message's original timestamp in epoch ms
const parseMessageSentAt = (row) => {
  if (!row) return null;
  const raw = row.sentAt ?? row.sent_at;
  if (raw) {
    const num = Number(raw);
    if (!isNaN(num) && num > 0) return num;
    const d = new Date(raw).getTime();
    if (!isNaN(d) && d > 0) return d;
  }
  const rawCreated = row.created_at ?? row.createdAt;
  if (rawCreated) {
    const d = new Date(rawCreated).getTime();
    if (!isNaN(d) && d > 0) return d;
  }
  return null;
};

// Helper to extract sortable time in ms
const getSortTime = (m) => {
  const t = parseMessageSentAt(m);
  return t || 0;
};

// Helper to parse reactions safely (stable module function)
const parseReactions = (reactions) => {
  if (!reactions) return [];
  if (Array.isArray(reactions)) return reactions;
  try {
    return JSON.parse(reactions);
  } catch {
    return [];
  }
};

// Helper to parse reply_to safely (stable module function)
const parseReplyTo = (replyTo) => {
  if (!replyTo) return null;
  if (typeof replyTo === 'object') return replyTo;
  try {
    return JSON.parse(replyTo);
  } catch {
    return null;
  }
};

// Normalize a database message row into the UI message shape with a safe non-UUID author name
const formatDbMessageRow = (row, channelId) => {
  const parsedSentAt = parseMessageSentAt(row) || Date.now();
  const senderId = normalizeParticipantId(row.user_id || row.sender_id || row.userId);
  return {
    id: row.id,
    room: channelId,
    room_id: row.room_id || channelId,
    sender_id: senderId,
    receiver_id: normalizeParticipantId(row.receiver_id ?? row.recipient_id),
    user: pickDisplayName([row.user_name, row.sender_name, row.user], 'Kullanıcı'),
    userId: senderId,
    avatar: row.user_avatar || row.sender_avatar || row.avatar || row.avatar_url || null,
    color: row.color || '#90ba3c',
    hasCrown: row.has_crown || false,
    lines: Array.isArray(row.lines) ? row.lines : (row.lines ? [row.lines] : (row.text ? [row.text] : [])),
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    parent_id: row.parent_id || null,
    reply_to: parseReplyTo(row.reply_to),
    reactions: parseReactions(row.reactions),
    timestamp: row.timestamp_text || row.timestamp || formatTimeFromDate(parsedSentAt) || formatTimestamp(),
    sentAt: parsedSentAt,
    sent_at: parsedSentAt,
    created_at: row.created_at,
  };
};

export const useRealtimeChat = (
  channelId = 'home', 
  currentUser = { name: 'Sen (You)', id: 'you', avatar: null }
) => {
  // Keep current user in a ref for stable event handlers
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const normalizedCurrentUserId = normalizeParticipantId(currentUser?.id);
  const validCurrentUserId =
    normalizedCurrentUserId && normalizedCurrentUserId !== 'you' ? normalizedCurrentUserId : null;

  // Extract other user ID if this is a DM channel (null if active user does not belong to room)
  const isDmChannel = Boolean(channelId && channelId.startsWith('dm-'));
  const otherUserId = useMemo(() => {
    if (!isDmChannel || !channelId) return null;
    const pair = parseDmRoomPair(channelId);
    if (pair) {
      if (!validCurrentUserId) return null;
      if (pair[0] === validCurrentUserId) return pair[1];
      if (pair[1] === validCurrentUserId) return pair[0];
      return null;
    }
    const single = normalizeParticipantId(channelId.slice(3));
    if (!single || single === validCurrentUserId) return null;
    return single;
  }, [isDmChannel, channelId, validCurrentUserId]);

  // Store messages isolated by channelId & DM rooms
  const [messagesByChannel, setMessagesByChannel] = useState({
    'home': initialChatMessages,
    'voice-sesli-sohbet': initialChatMessages,
    ...initialDmMessages,
  });

  const [typingUsers, setTypingUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Set of received message IDs to prevent duplicate rendering
  const allInitialIds = [
    ...initialChatMessages.map(m => m.id),
    ...Object.values(initialDmMessages).flatMap(list => list.map(m => m.id)),
  ];
  const receivedMsgIdsRef = useRef(new Set(allInitialIds));

  // Clear in-memory chat history when switching authenticated users in the same session
  const lastUserIdRef = useRef(validCurrentUserId);
  useEffect(() => {
    const prev = lastUserIdRef.current;
    if (prev && validCurrentUserId && prev !== validCurrentUserId) {
      receivedMsgIdsRef.current = new Set(allInitialIds);
      setMessagesByChannel({
        'home': initialChatMessages,
        'voice-sesli-sohbet': initialChatMessages,
        ...initialDmMessages,
      });
    }
    lastUserIdRef.current = validCurrentUserId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validCurrentUserId]);

  // Add message to specific channel's history
  const appendMessage = useCallback((incoming) => {
    if (!incoming || !incoming.id) return;
    if (receivedMsgIdsRef.current.has(incoming.id)) return;

    const targetRoom = incoming.room || incoming.channel_id || incoming.room_id || 'home';
    const roomPair = parseDmRoomPair(targetRoom);
    if (roomPair && !isDirectMessageForPair(incoming, roomPair[0], roomPair[1])) {
      return;
    }

    receivedMsgIdsRef.current.add(incoming.id);

    const incomingAttachments = Array.isArray(incoming.attachments) ? incoming.attachments : [];
    const replyTo = parseReplyTo(incoming.reply_to || incoming.replyTo);
    const parentId = incoming.parent_id || incoming.parentId || replyTo?.id || null;
    const reactions = parseReactions(incoming.reactions);
    const incomingSenderId = normalizeParticipantId(incoming.userId || incoming.user_id || incoming.sender_id);

    setMessagesByChannel((prevMap) => {
      const channelMsgs = prevMap[targetRoom] || [];
      const lastMsg = channelMsgs[channelMsgs.length - 1];
      const lastSenderId = normalizeParticipantId(lastMsg?.userId || lastMsg?.user_id || lastMsg?.sender_id);
      const isSameUser = Boolean(lastMsg && incomingSenderId && lastSenderId === incomingSenderId);
      const isRecent = lastMsg && incoming.sentAt && (incoming.sentAt - (lastMsg.sentAt || 0) < 120000);
      const isReply = Boolean(replyTo || parentId);

      let updatedMsgs;

      const lines = incoming.lines 
        ? (Array.isArray(incoming.lines) ? incoming.lines : [incoming.lines])
        : (incoming.text ? [incoming.text] : []);

      // Message grouping: append line only if consecutive message from same user AND not a reply
      if (isSameUser && isRecent && !isReply && !lastMsg.reply_to) {
        const updatedLast = {
          ...lastMsg,
          lines: [...(lastMsg.lines || []), ...(incoming.text ? [incoming.text] : lines)],
          attachments: [...(lastMsg.attachments || []), ...incomingAttachments],
          sentAt: incoming.sentAt || incoming.sent_at || Date.now(),
        };
        updatedMsgs = [...channelMsgs.slice(0, -1), updatedLast];
      } else {
        const newEntry = {
          id: incoming.id,
          user: pickDisplayName([incoming.user, incoming.user_name, incoming.sender_name], 'Kullanıcı'),
          userId: incoming.userId || incoming.user_id || incoming.sender_id || 'you',
          avatar: incoming.avatar || incoming.avatar_url || incoming.user_avatar || incoming.sender_avatar || null,
          color: incoming.color || '#90ba3c',
          hasCrown: incoming.hasCrown || incoming.has_crown || false,
          timestamp: incoming.timestamp || incoming.timestamp_text || formatTimestamp(),
          sentAt: incoming.sentAt || incoming.sent_at || Date.now(),
          lines: lines.length > 0 ? lines : (incomingAttachments.length > 0 ? [] : ['']),
          attachments: incomingAttachments,
          parent_id: parentId,
          reply_to: replyTo,
          reactions,
        };
        updatedMsgs = [...channelMsgs, newEntry];
      }

      return {
        ...prevMap,
        [targetRoom]: updatedMsgs,
      };
    });

    const senderId = incoming.userId || incoming.user_id || incoming.sender_id;
    const isOwnMessage = senderId === 'you' || Boolean(currentUserRef.current?.id && senderId === currentUserRef.current.id);
    if (!isOwnMessage) {
      sounds.playMessage();
    }

  }, []);

  // Update reactions on a message
  const updateMessageReactions = useCallback((targetRoom, messageId, emoji, userId) => {
    setMessagesByChannel((prevMap) => {
      const room = targetRoom;
      const list = prevMap[room] || [];
      const msgIndex = list.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return prevMap;

      const targetMsg = { ...list[msgIndex] };
      const currentReactions = Array.isArray(targetMsg.reactions) ? [...targetMsg.reactions] : [];

      const reactIdx = currentReactions.findIndex((r) => r.emoji === emoji);
      if (reactIdx > -1) {
        const existing = { ...currentReactions[reactIdx] };
        const users = Array.isArray(existing.users) ? [...existing.users] : [];
        const uIdx = users.indexOf(userId);

        if (uIdx > -1) {
          users.splice(uIdx, 1);
          if (users.length === 0) {
            currentReactions.splice(reactIdx, 1);
          } else {
            existing.users = users;
            existing.count = users.length;
            currentReactions[reactIdx] = existing;
          }
        } else {
          users.push(userId);
          existing.users = users;
          existing.count = users.length;
          currentReactions[reactIdx] = existing;
        }
      } else {
        currentReactions.push({
          emoji,
          count: 1,
          users: [userId],
        });
      }

      targetMsg.reactions = currentReactions;
      const updatedList = [...list];
      updatedList[msgIndex] = targetMsg;

      return {
        ...prevMap,
        [room]: updatedList,
      };
    });
  }, []);

  // Send a new message into the current active channel and store in database
  const sendMessage = useCallback((text = '', attachments = [], replyTo = null) => {
    const trimmedText = (text || '').trim();
    const safeAttachments = Array.isArray(attachments) ? attachments : [];

    if (!trimmedText && safeAttachments.length === 0) return;

    const formattedReplyTo = replyTo ? {
      id: replyTo.id,
      user: pickDisplayName([replyTo.user], 'Kullanıcı'),
      color: replyTo.color || '#90ba3c',
      text: replyTo.text || (replyTo.lines ? replyTo.lines[0] : '') || '📎 Medya / Dosya',
    } : null;

    const activeUser = currentUserRef.current;
    const payload = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      room: channelId,
      user: pickDisplayName([activeUser?.display_name, activeUser?.name, activeUser?.username], 'Sen (You)'),
      userId: activeUser?.id || 'you',
      avatar: activeUser?.avatar_url || activeUser?.avatar || null,
      color: '#90ba3c',
      timestamp: formatTimestamp(),
      text: trimmedText,
      lines: trimmedText ? [trimmedText] : [],
      attachments: safeAttachments,
      parent_id: formattedReplyTo ? formattedReplyTo.id : null,
      reply_to: formattedReplyTo,
      reactions: [],
      sentAt: Date.now(),
    };

    if (!channelId) return;

    // 1. Broadcast over Socket.io / BroadcastChannel
    chatService.sendMessage(payload);

    // 2. Persist to Supabase / Local Database
    if (channelId.startsWith('dm-')) {
      if (activeUser?.id && activeUser.id !== 'you' && otherUserId) {
        dbService.saveDmMessage(channelId, payload, activeUser.id, otherUserId).catch((err) => {
          console.warn('DB save DM error:', err);
        });
      }
    } else {
      dbService.saveChannelMessage(channelId, payload).catch((err) => {
        console.warn('DB save channel error:', err);
      });
    }
  }, [channelId, otherUserId]);

  // Toggle emoji reaction on a message
  const toggleReaction = useCallback((messageId, emoji) => {
    if (!messageId || !emoji || !channelId) return;

    const activeUser = currentUserRef.current;
    updateMessageReactions(channelId, messageId, emoji, activeUser?.id);

    chatService.sendReaction({
      messageId,
      emoji,
      userId: activeUser?.id,
      userName: activeUser?.name,
      room: channelId,
    });

    dbService.toggleReaction({
      roomId: channelId,
      messageId,
      emoji,
      userId: activeUser?.id,
      userName: activeUser?.name,
      isDm: Boolean(channelId && channelId.startsWith('dm-')),
    }).catch((err) => {
      console.warn('DB reaction toggle error:', err);
    });
  }, [channelId, updateMessageReactions]);

  // Handle typing indicator
  const setTyping = useCallback((isTyping) => {
    const typingName = pickDisplayName(
      [currentUserRef.current?.display_name, currentUserRef.current?.name, currentUserRef.current?.username],
      null
    );
    if (typingName) {
      chatService.sendTyping(typingName, isTyping);
    }
  }, []);

  // Switch room in chatService when channelId changes
  useEffect(() => {
    if (!channelId) return;
    chatService.init(channelId);
    chatService.setRoom(channelId);
  }, [channelId]);

  // Realtime Subscriptions & Fast Polling
  useEffect(() => {
    if (!channelId) return;
    let isCancelled = false;

    const handleMessage = (msg) => {
      appendMessage(msg);
    };

    const handleReaction = (data) => {
      if (data && data.messageId && data.emoji) {
        updateMessageReactions(data.room || channelId, data.messageId, data.emoji, data.userId);
      }
    };

    const handleTyping = ({ user, isTyping, room }) => {
      const safeUser = pickDisplayName([user], null);
      if (!safeUser || safeUser === currentUserRef.current?.name || room !== channelId) return;
      setTypingUsers((prev) => {
        if (isTyping && !prev.includes(safeUser)) {
          return [...prev, safeUser];
        }
        if (!isTyping) {
          return prev.filter((u) => u !== safeUser);
        }
        return prev;
      });
    };

    const handleConnected = (status) => {
      setIsConnected(status);
    };

    chatService.on('message', handleMessage);
    chatService.on('reaction', handleReaction);
    chatService.on('typing', handleTyping);
    chatService.on('connected', handleConnected);

    // Initial message load from database
    async function loadDatabaseMessages() {
      if (!channelId || (isDmChannel && (!validCurrentUserId || !otherUserId))) return;
      try {
        let dbMsgs = [];
        if (isDmChannel) {
          const rawDm = await dbService.fetchDmMessages(channelId, validCurrentUserId, otherUserId);
          dbMsgs = Array.isArray(rawDm)
            ? rawDm.filter((row) => isDirectMessageForPair(row, validCurrentUserId, otherUserId))
            : [];
        } else if (channelId) {
          dbMsgs = await dbService.fetchMessages(channelId);
        }

        if (!isCancelled && Array.isArray(dbMsgs)) {
          const formattedDbMsgs = dbMsgs.map((row) => formatDbMessageRow(row, channelId));

          formattedDbMsgs.forEach((m) => receivedMsgIdsRef.current.add(m.id));

          setMessagesByChannel((prevMap) => {
            const existing = prevMap[channelId] || [];
            const dbIds = new Set(formattedDbMsgs.map((m) => m.id));
            const newRealtime = existing.filter((m) => !dbIds.has(m.id));
            const merged = [...formattedDbMsgs, ...newRealtime].sort(
              (a, b) => getSortTime(a) - getSortTime(b)
            );
            return {
              ...prevMap,
              [channelId]: merged,
            };
          });
        }
      } catch (err) {
        console.warn('Database message fetch warning:', err);
      }
    }

    loadDatabaseMessages();

    let lastDbSyncAt = Date.now();
    const syncMessagesFromDb = async () => {
      if (isCancelled || !channelId || (isDmChannel && (!validCurrentUserId || !otherUserId))) return;
      lastDbSyncAt = Date.now();
      try {
        let dbMsgs = [];
        if (isDmChannel) {
          const rawDm = await dbService.fetchDmMessages(channelId, validCurrentUserId, otherUserId);
          dbMsgs = Array.isArray(rawDm)
            ? rawDm.filter((row) => isDirectMessageForPair(row, validCurrentUserId, otherUserId))
            : [];
        } else {
          dbMsgs = await dbService.fetchMessages(channelId);
        }
        if (!isCancelled && Array.isArray(dbMsgs)) {
          const formattedDbMsgs = dbMsgs.map((row) => formatDbMessageRow(row, channelId));

          formattedDbMsgs.forEach((m) => receivedMsgIdsRef.current.add(m.id));

          setMessagesByChannel((prevMap) => {
            const existing = prevMap[channelId] || [];
            if (existing.length === formattedDbMsgs.length && existing.length > 0) {
              const lastExisting = existing[existing.length - 1];
              const lastDb = formattedDbMsgs[formattedDbMsgs.length - 1];
              if (lastExisting?.id === lastDb?.id) {
                return prevMap;
              }
            }
            const dbIds = new Set(formattedDbMsgs.map((m) => m.id));
            const newRealtime = existing.filter((m) => !dbIds.has(m.id));
            const merged = [...formattedDbMsgs, ...newRealtime].sort(
              (a, b) => getSortTime(a) - getSortTime(b)
            );
            return {
              ...prevMap,
              [channelId]: merged,
            };
          });
        }
      } catch {}
    };

    // Adaptive fallback heartbeat: 60s when Realtime is healthy, 20s when degraded; pauses while tab is hidden
    const pollInterval = setInterval(() => {
      if (isCancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const healthStatus = dbService.getRealtimeHealth?.()?.status;
      const minGapMs = healthStatus === 'CONNECTED' ? 60000 : 20000;
      if (Date.now() - lastDbSyncAt >= minGapMs) {
        syncMessagesFromDb();
      }
    }, 20000);

    const unsubRecovered = dbService.onRealtimeRecovered?.(() => {
      syncMessagesFromDb();
    });

    // Realtime Database Subscriptions for channel & DM tables
    const unsubChannel = dbService.subscribeToTable('channel_messages', (payload) => {
      if (!payload.new) return;
      const row = payload.new;
      if (row.channel_id === channelId) {
        if (payload.eventType === 'UPDATE') {
          setMessagesByChannel((prevMap) => {
            const list = prevMap[channelId] || [];
            const idx = list.findIndex((m) => m.id === row.id);
            if (idx === -1) return prevMap;
            const updated = [...list];
            updated[idx] = {
              ...updated[idx],
              reactions: parseReactions(row.reactions),
            };
            return { ...prevMap, [channelId]: updated };
          });
        } else {
          appendMessage(formatDbMessageRow(row, channelId));
        }
      }
    });

    const unsubDm = dbService.subscribeToTable('direct_messages', (payload) => {
      if (!payload.new || !isDmChannel) return;
      const row = payload.new;

      const myId = normalizeParticipantId(currentUserRef.current?.id);
      if (!myId || myId === 'you' || !otherUserId) return;
      if (!isDirectMessageForPair(row, myId, otherUserId)) {
        return;
      }

      if (payload.eventType === 'UPDATE') {
        setMessagesByChannel((prevMap) => {
          const list = prevMap[channelId] || [];
          const idx = list.findIndex((m) => m.id === row.id);
          if (idx === -1) return prevMap;
          const updated = [...list];
          updated[idx] = {
            ...updated[idx],
            reactions: parseReactions(row.reactions),
          };
          return { ...prevMap, [channelId]: updated };
        });
      } else {
        appendMessage(formatDbMessageRow(row, channelId));
      }
    });

    const handleAccountDeleted = (payload) => {
      const deletedId = payload?.userId;
      if (!deletedId) return;
      const myNorm = normalizeParticipantId(currentUserRef.current?.id);
      const targetNorm = normalizeParticipantId(deletedId);
      if (myNorm && targetNorm && myNorm === targetNorm) {
        receivedMsgIdsRef.current?.clear?.();
        setMessagesByChannel({});
        return;
      }
      setMessagesByChannel((prev) => purgeUserFromMessagesMap(prev, deletedId));
    };
    chatService.on('account_deleted', handleAccountDeleted);

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
      unsubRecovered?.();
      chatService.off('message', handleMessage);
      chatService.off('reaction', handleReaction);
      chatService.off('typing', handleTyping);
      chatService.off('connected', handleConnected);
      chatService.off('account_deleted', handleAccountDeleted);
      unsubChannel?.();
      unsubDm?.();
    };
  }, [channelId, isDmChannel, validCurrentUserId, otherUserId, appendMessage, updateMessageReactions]);

  const currentMessages = (channelId && messagesByChannel[channelId]) || [];

  const clearMessages = useCallback((targetChannelId) => {
    const cid = targetChannelId || channelId;
    if (!cid) return;
    setMessagesByChannel((prev) => ({
      ...prev,
      [cid]: [],
    }));
  }, [channelId]);

  const purgeUserMessages = useCallback((targetUserId) => {
    if (!targetUserId) return;
    const myNorm = normalizeParticipantId(currentUserRef.current?.id);
    const targetNorm = normalizeParticipantId(targetUserId);
    if (myNorm && targetNorm && myNorm === targetNorm) {
      receivedMsgIdsRef.current?.clear?.();
      setMessagesByChannel({});
      return;
    }
    setMessagesByChannel((prev) => purgeUserFromMessagesMap(prev, targetUserId));
  }, []);

  return {
    messages: currentMessages,
    sendMessage,
    toggleReaction,
    setTyping,
    typingUsers,
    isChatConnected: isConnected,
    clearMessages,
    purgeUserMessages,
  };
};
