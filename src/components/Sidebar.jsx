import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from './UserAvatar';
import { getDmRoomId, localDb, dbService } from '../lib/supabase';
import { chatService } from '../services/chatService';
import { resolveDirectMessagePartner, parseDmRoomPair, isDirectMessageForPair } from '../utils/dmIsolation';

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

const STATUS_OPTIONS = [
  {
    id: 'online',
    label: 'Çevrimiçi',
    description: 'Aktif ve bildirimler açık',
    color: 'bg-emerald-500',
    ring: 'ring-emerald-500/20',
  },
  {
    id: 'idle',
    label: 'Boşta',
    description: 'Geçici olarak uzakta (AFK)',
    color: 'bg-amber-400',
    ring: 'ring-amber-400/20',
  },
  {
    id: 'dnd',
    label: 'Rahatsız Etmeyin',
    description: 'Bildirim seslerini kapat',
    color: 'bg-rose-500',
    ring: 'ring-rose-500/20',
  },
  {
    id: 'invisible',
    label: 'Görünmez',
    description: 'Çevrimdışı görünürsün',
    color: 'bg-gray-400',
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
  } catch {}
  return initialMap;
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

    // Single batched query for all friends' latest DMs (avoids N+1 query fan-out)
    const friendIds = friendIdsKey ? friendIdsKey.split(',').filter(Boolean) : [];
    const loadLatestMessagesBatch = async () => {
      if (friendIds.length === 0) return;
      try {
        const batchMap = await dbService.fetchLatestDmMessagesBatch(activeUid, friendIds);
        if (!cancelled && batchMap) {
          setLastMessagesMap((prev) => {
            const next = { ...prev };
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
            return next;
          });
        }
      } catch {}
    };

    loadLatestMessagesBatch();

    const unsubRecovered = dbService.onRealtimeRecovered?.(() => {
      if (!cancelled) loadLatestMessagesBatch();
    });

    // Realtime subscription for direct messages (strictly scoped to activeUid)
    const unsubDms = dbService.subscribeToTable('direct_messages', (payload) => {
      if (cancelled) return;
      const newMsg = payload?.new;
      const partnerId = resolveDirectMessagePartner(newMsg, activeUid);
      if (!partnerId) return;

      const roomId = getDmRoomId(activeUid, partnerId);
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
        sentAt: newMsg.sent_at || (newMsg.created_at ? new Date(newMsg.created_at).getTime() : undefined),
      };
      setLastMessagesMap((prev) => ({
        ...prev,
        [roomId]: formatted,
      }));
    });

    // Realtime broadcast/socket message
    const handleChatMessage = (msg) => {
      if (cancelled || !msg) return;
      const rawRoomId = msg.room || msg.room_id || msg.channel_id;
      if (!rawRoomId) return;

      if (String(rawRoomId).startsWith('dm-')) {
        const partnerId = resolveDirectMessagePartner(msg, activeUid);
        const pair = parseDmRoomPair(rawRoomId);
        const targetPartner = partnerId || (pair && pair.includes(String(activeUid))
          ? (pair[0] === String(activeUid) ? pair[1] : pair[0])
          : null);
        if (!targetPartner) return;
        const canonical = getDmRoomId(activeUid, targetPartner);
        setLastMessagesMap((prev) => ({
          ...prev,
          [canonical]: msg,
        }));
        return;
      }

      setLastMessagesMap((prev) => ({
        ...prev,
        [rawRoomId]: msg,
      }));
    };

    chatService.on('message', handleChatMessage);

    return () => {
      cancelled = true;
      unsubRecovered?.();
      unsubDms?.();
      chatService.off('message', handleChatMessage);
    };
  }, [effectiveUserId, friendIdsKey]);

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
    } catch {}
  }, [currentUserProfile?.id]);

  useEffect(() => {
    const handleReadReceipt = (data) => {
      if (!data?.roomId) return;
      // Do not treat our own viewing as the recipient reading our sent messages
      if (data.readerId && currentUserProfile?.id && data.readerId === currentUserProfile.id) {
        return;
      }
      setReadReceipts((prev) => {
        const updated = { ...prev, [data.roomId]: data.readAt || Date.now() };
        try {
          const key = `voys_read_receipts_${currentUserProfile?.id || 'default'}`;
          localStorage.setItem(key, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    chatService.on('message_read', handleReadReceipt);
    return () => {
      chatService.off('message_read', handleReadReceipt);
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



  // Filtered Friends
  const filteredFriends = useMemo(() => {
    if (filterTab === 'channels') return [];
    return friends.filter((friend) => {
      if (filterTab === 'unread') {
        // In unread tab, show friends with active activity (online/game)
        if (!friend.isOnline && !friend.game) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        friend.name?.toLowerCase().includes(q) ||
        friend.username?.toLowerCase().includes(q) ||
        friend.game?.toLowerCase().includes(q) ||
        friend.substatus?.toLowerCase().includes(q)
      );
    });
  }, [friends, searchQuery, filterTab]);

  // Filtered Channels (only user-created channels, never default/pre-made 'home')
  const filteredChannels = useMemo(() => {
    if (filterTab === 'dms') return [];
    return textChannels.filter((chan) => {
      if (!chan || chan.id === 'home' || chan.is_home || chan.id === 'voice-sesli-sohbet') return false;
      if (filterTab === 'unread') {
        // Show channels with active call
        return Boolean(channelCalls[chan.id]?.active);
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return chan.name?.toLowerCase().includes(q);
    });
  }, [textChannels, searchQuery, filterTab, channelCalls]);

  // All Friends List (Filtered & Sorted: Game / Online first, then Alphabetical)
  const filteredAllFriends = useMemo(() => {
    let list = Array.isArray(friends) ? [...friends] : [];
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
  }, [friends, friendsSearchQuery]);

  const totalResultsCount = filteredFriends.length + filteredChannels.length;
  const activeCallsCount = Object.values(channelCalls).filter(c => c.active).length;

  return (
    <aside className="w-[320px] flex-shrink-0 h-full bg-[#0c0c0e] voys-glass-sidebar border-r border-white/[0.06] flex flex-col select-none overflow-hidden z-10 font-sans">
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
              className={`flex-1 py-1.5 rounded-lg text-center font-medium transition ${
                addFriendTab === 'search'
                  ? 'bg-[#18181f] text-white font-semibold border border-white/10 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              Kullanıcı Ara
            </button>
            <button
              type="button"
              onClick={() => setAddFriendTab('incoming')}
              className={`flex-1 py-1.5 rounded-lg text-center font-medium transition relative ${
                addFriendTab === 'incoming'
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
              className={`flex-1 py-1.5 rounded-lg text-center font-medium transition ${
                addFriendTab === 'outgoing'
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
                className={`p-2.5 rounded-xl border text-[11px] flex items-start space-x-2 ${
                  friendFeedback.type === 'success'
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
                  Grup / Kanal Adı
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
                          className={`p-2 rounded-xl flex items-center justify-between transition cursor-pointer border ${
                            isSelected
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
                            className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                              isSelected
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
                className="flex-1 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-indigo-600/25 transition active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
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
              placeholder="Ara veya sohbet başlat..."
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
            className={`h-9 w-9 rounded-lg flex items-center justify-center transition flex-shrink-0 relative group shadow-sm border cursor-pointer ${
              sidebarView === 'friends'
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
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition flex-shrink-0 relative group shadow-sm border cursor-pointer ${
                isPlusMenuOpen || sidebarView === 'addFriend' || sidebarView === 'createGroup'
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
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#141418] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
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
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex-shrink-0 ${
              filterTab === 'all'
                ? 'bg-[#8B51FF]/20 text-[#bb94ff] border border-[#8B51FF]/40 shadow-sm'
                : 'bg-[#141418] text-gray-400 hover:text-gray-200 hover:bg-[#1a1a20] border border-white/[0.08]'
            }`}
          >
            Tümü
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('dms')}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex-shrink-0 ${
              filterTab === 'dms'
                ? 'bg-[#8B51FF]/20 text-[#bb94ff] border border-[#8B51FF]/40 shadow-sm'
                : 'bg-[#141418] text-gray-400 hover:text-gray-200 hover:bg-[#1a1a20] border border-white/[0.08]'
            }`}
          >
            Kişiler
          </button>
        </div>
      </div>

      {/* 4. CHAT LIST (WhatsApp Web style rows) */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
        {totalResultsCount === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#141418] flex items-center justify-center text-gray-500">
              <Search size={22} />
            </div>
            <p className="text-gray-300 font-medium">Sohbet bulunamadı</p>
            <button
              type="button"
              onClick={openAddFriendView}
              className="px-3.5 py-1.5 bg-[#8B51FF] hover:bg-[#773BF5] text-white font-bold rounded-lg text-xs transition shadow-md"
            >
              + Yeni Sohbet Başlat
            </button>
          </div>
        ) : (
          <>
            {/* Friends / Direct Messages Section */}
            {filteredFriends.map((friend) => {
              const isSelected = activeDmUserId === friend.id;
              const isPlayingGame = !!friend.game;
              const dmRoomId = currentUserProfile?.id && friend?.id ? getDmRoomId(currentUserProfile.id, friend.id) : null;
              const dmCallInfo = dmRoomId ? channelCalls[dmRoomId] : null;
              const isDmCallActive = dmCallInfo?.active;

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
              const lastRawTime = lastMsg ? (lastMsg.sentAt || lastMsg.sent_at || lastMsg.created_at) : null;
              const lastMessageTime = lastMsg ? formatChatTimeOnly(lastRawTime, lastMsg.timestamp) : '';
              const lastMessageDate = lastMsg ? formatChatDateOnly(lastRawTime, lastMsg.timestamp) : '';
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
                  (dmRoomId && readReceipts[dmRoomId] && (!msgTimeNumber || Number(readReceipts[dmRoomId]) >= msgTimeNumber))
                )
              );

              return (
                <div
                  key={`dm-${friend.id}`}
                  onClick={() => onSelectDm?.(friend.id)}
                  className={`h-[68px] px-3.5 flex items-center space-x-3 cursor-pointer transition select-none relative ${
                    isSelected
                      ? 'bg-[#18181f] border-l-[3.5px] border-[#8B51FF]'
                      : 'border-l-[3.5px] border-transparent hover:bg-[#121215]'
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
                      <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                        {friend.name}
                      </p>
                      {/* Timestamp / Son Mesaj Saati (HH:mm) */}
                      <span className={`text-[10px] flex-shrink-0 ml-1 font-normal ${lastMessageTime ? 'text-gray-400' : 'text-gray-500'}`}>
                        {lastMessageTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      {isDmCallActive ? (
                        <div className="flex items-center space-x-1 text-[11px] text-emerald-400 truncate font-semibold">
                          <Phone size={11} className="flex-shrink-0" />
                          <span className="truncate">
                            {dmCallInfo.stage === 'ringing' ? 'Arama çalıyor...' : 'Sesli görüşme aktif'}
                          </span>
                        </div>
                      ) : isPlayingGame ? (
                        <div className="flex items-center space-x-1 text-[11px] text-emerald-400 truncate font-medium">
                          <Gamepad2 size={12} className="flex-shrink-0" />
                          <span className="truncate">{friend.game}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-[11px] text-gray-400 truncate">
                          {isSentByMe && (
                            isMessageRead ? (
                              <CheckCheck 
                                size={13} 
                                className="flex-shrink-0 text-[#53bdeb]" 
                                title="Okundu"
                              />
                            ) : friend.isOnline ? (
                              <CheckCheck 
                                size={13} 
                                className="flex-shrink-0 text-gray-500" 
                                title="İletildi"
                              />
                            ) : (
                              <Check 
                                size={13} 
                                className="flex-shrink-0 text-gray-500" 
                                title="Gönderildi"
                              />
                            )
                          )}
                          <span className={`truncate ${isSelected ? 'text-gray-200' : 'text-gray-400'}`}>
                            {lastMessageText || (friend.isOnline ? 'Müsait' : 'Çevrimdışı')}
                          </span>
                        </div>
                      )}

                      {/* Right Badges / Son Mesaj Tarihi (DD.MM.YYYY) */}
                      <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                        {isDmCallActive && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30 flex-shrink-0">
                            {dmCallInfo.stage === 'ringing' ? 'Çalıyor' : 'Canlı'}
                          </span>
                        )}
                        {lastMessageDate && (
                          <span className="text-[10px] font-normal text-gray-500 flex-shrink-0 select-none">
                            {lastMessageDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Channels Section */}
            {filteredChannels.map((chan) => {
              const callInfo = channelCalls[chan.id];
              const isCallActive = callInfo?.active;
              const isSelected = !activeDmUserId && Boolean(
                activeChannel === chan.id ||
                chan.id === `text-${activeChannel}` ||
                chan.id?.replace(/^text-/, '') === activeChannel?.replace(/^text-/, '') ||
                chan.name?.toLowerCase() === activeChannel?.toLowerCase()
              );

              const lastMsg = (activeChannel === chan.id && activeLastMessage)
                ? activeLastMessage
                : lastMessagesMap[chan.id];
              const lastRawTime = lastMsg ? (lastMsg.sentAt || lastMsg.sent_at || lastMsg.created_at) : null;
              const lastMessageTime = lastMsg ? formatChatTimeOnly(lastRawTime, lastMsg.timestamp) : '';
              const lastMessageDate = lastMsg ? formatChatDateOnly(lastRawTime, lastMsg.timestamp) : '';
              const lastMessageText = formatMessagePreview(lastMsg);

              return (
                <div
                  key={`chan-${chan.id}`}
                  onClick={() => onSelectChannel?.(chan.id)}
                  className={`h-[68px] px-3.5 flex items-center space-x-3 cursor-pointer transition select-none relative ${
                    isSelected
                      ? 'bg-[#18181f] border-l-[3.5px] border-[#8B51FF]'
                      : 'border-l-[3.5px] border-transparent hover:bg-[#121215]'
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
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1 font-normal">
                        {lastMessageTime || 'Kanal'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-[11px] truncate ${isSelected ? 'text-gray-200' : 'text-gray-400'}`}>
                        {lastMessageText || 'Grup sohbeti'}
                      </p>

                      {/* Right Badges / Son Mesaj Tarihi (DD.MM.YYYY) */}
                      <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                        {lastMessageDate && (
                          <span className="text-[10px] font-normal text-gray-500 flex-shrink-0 select-none">
                            {lastMessageDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      </>
      )}

      {/* 4. BOTTOM PROFILE & ACTIONS BAR */}
      <div className="h-14 px-3.5 bg-[#0a0a0c] sidebar-bottom-bar border-t border-white/[0.06] flex items-center justify-between flex-shrink-0 relative">
        {/* Left: User Avatar (Click to change status) & Profile (Click to open settings) */}
        <div className="flex items-center gap-2.5 min-w-0 relative" ref={statusPickerRef}>
          {/* Status Picker Popover Menu (opens upward) */}
          {isStatusPickerOpen && (
            <div className="absolute left-0 bottom-14 w-44 bg-[#121216] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="space-y-0.5">
                {STATUS_OPTIONS.map((opt) => {
                  const isCurrent = (currentUserProfile?.status || 'online') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onUpdateStatus?.(opt.id);
                        setIsStatusPickerOpen(false);
                      }}
                      className={`w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between transition ${
                        isCurrent 
                          ? 'bg-[#1c1c24] text-white border border-white/10 shadow-sm' 
                          : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.color}`} />
                        <span className="text-xs font-medium leading-none">{opt.label}</span>
                      </div>
                      {isCurrent && (
                        <Check size={13} className="text-emerald-400 flex-shrink-0 ml-1.5" />
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
              status={currentUserProfile?.status || 'online'}
            />
          </button>

          {/* User Name & Details -> Clicking opens Settings */}
          <div 
            onClick={() => onOpenSettings?.('account')}
            className="min-w-0 cursor-pointer p-1 rounded-xl hover:bg-white/5 transition group flex-1"
            title="Profil ve Ayarları Aç"
          >
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition">
                {currentUserProfile?.name || 'Sen'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 truncate">
              {currentUserProfile?.game ? `🎮 ${currentUserProfile.game}` : `@${currentUserProfile?.username || 'user'}`}
            </p>
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
    </aside>
  );
};
