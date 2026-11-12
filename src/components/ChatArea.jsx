import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Send,
  Smile,
  SmilePlus,
  Reply,
  CornerDownRight,
  Plus,
  Crown,
  ArrowDown,
  Menu,
  ArrowLeft,
  ShieldCheck,
  Hash,
  UploadCloud,
  X,
  Search,
  Download,
  ExternalLink,
  FileText,
  FileArchive,
  FileCode,
  Film,
  Image as ImageIcon,
  File,
  Loader2,
  Trash2,
  Users,
  UserPlus,
  UserCheck,
  UserMinus,
  UserX,
  Clock,
  Gamepad2,
  Volume2,
  Volume1,
  VolumeX,
  Headphones,
  MessageSquare,
  RotateCcw,
  Settings2,
  Eye,
  MoreVertical,
  User,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Camera,
  Upload
} from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useSettings } from '../context/useSettings';
import { formatShortcutLabel } from '../services/shortcutService';

// Helper to extract a valid Date object from message timestamp/sentAt/created_at
function getMessageDate(msg) {
  if (!msg) return null;
  const raw = msg.sentAt ?? msg.sent_at ?? msg.created_at ?? msg.createdAt;
  if (raw) {
    const num = Number(raw);
    if (!isNaN(num) && num > 0) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) return d;
    } else {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (msg.timestamp && typeof msg.timestamp === 'string') {
    const d = new Date(msg.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Check if two dates fall on the exact same day
function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

// Format chat date divider (e.g. "5 Kasım 2026 Perşembe", "4 Kasım 2026 Çarşamba")
function formatChatDateDivider(date) {
  if (!date || isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(date);
}

// Full date & time for hover tooltip (e.g. "4 Kasım 2026 Çarşamba 02:33")
function formatFullDateTime(rawDate) {
  if (!rawDate) return '';
  const d = new Date(typeof rawDate === 'string' && /^\d+$/.test(rawDate) ? Number(rawDate) : rawDate);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
import { toast } from 'sonner';
import { UserAvatar } from './UserAvatar';
import { VoiceControls } from './VoiceControls';
import { ScreenShareStage } from './ScreenShareStage';
import { InChatCallStage } from './InChatCallStage';
import { dbService, getDmRoomId } from '../lib/supabase';
import { pickDisplayName, isRealDisplayName, getCachedUserProfile, isUuidLike, partitionSidebarGroupMembers } from '../utils/userDisplay';
import { MAX_VOLUME_PERCENT, getVolumeSliderFillStyle } from '../utils/remoteAudioGain';

// Helper to format file sizes nicely
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Helper to get matching Lucide icon based on MIME type or extension
function getFileIcon(type = '', name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (type.startsWith('image/')) return <ImageIcon size={18} className="text-emerald-400" />;
  if (type.startsWith('video/')) return <Film size={18} className="text-sky-400" />;
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return <Volume2 size={18} className="text-purple-400" />;
  }
  if (ext === 'pdf') return <FileText size={18} className="text-rose-400" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive size={18} className="text-amber-400" />;
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'c', 'cpp', 'rs', 'sql'].includes(ext)) {
    return <FileCode size={18} className="text-violet-400" />;
  }
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext) || type.includes('text')) {
    return <FileText size={18} className="text-indigo-400" />;
  }
  return <File size={18} className="text-gray-400" />;
}

// Helper to format readable file type badge
function getFileTypeLabel(type = '', name = '') {
  const ext = (name.split('.').pop() || '').toUpperCase();
  if (type.startsWith('image/')) return `${ext || 'Görsel'} Resmi`;
  if (type.startsWith('video/')) return `${ext || 'Video'} Dosyası`;
  if (type.startsWith('audio/')) return `${ext || 'Ses'} Kaydı`;
  if (ext === 'PDF') return 'PDF Belgesi';
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) return 'Sıkıştırılmış Arşiv';
  if (['JS', 'JSX', 'TS', 'TSX', 'HTML', 'CSS', 'JSON', 'PY', 'C', 'CPP', 'RS', 'SQL'].includes(ext)) {
    return `${ext} Kodu`;
  }
  return ext ? `${ext} Belgesi` : 'Dosya';
}

// Helper to extract clean HH:mm time only, stripping dates and prefixes like "Today"
function formatMessageTimeOnly(timestamp, sentAt) {
  if (sentAt) {
    const d = new Date(Number(sentAt) || sentAt);
    if (!isNaN(d.getTime())) {
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }
  if (!timestamp || typeof timestamp !== 'string') return '';
  const match = timestamp.match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?)/i);
  if (match) {
    const timeStr = match[1].trim();
    if (/am|pm/i.test(timeStr)) {
      const [rawTime, modifier] = timeStr.split(/\s+/);
      let [hours, minutes] = rawTime.split(':').map(Number);
      if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return timeStr;
  }
  return timestamp;
}

const DEFAULT_STATUS_LABELS = ['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin', 'Görünmez', 'Çevrimdışı', 'P2P Bağlantısı'];

function getMemberStatusDisplay(member) {
  if (!member?.isOnline || member?.status === 'offline' || member?.status === 'invisible') {
    return 'Çevrimdışı';
  }
  const statusMap = {
    online: 'Çevrimiçi',
    idle: 'Boşta',
    dnd: 'Rahatsız Etmeyin',
  };
  const customSub = (member?.substatus || '').trim();
  if (customSub && !DEFAULT_STATUS_LABELS.includes(customSub)) {
    return customSub;
  }
  return statusMap[member?.status] || 'Çevrimiçi';
}

export const ChatArea = ({
  activeChannel = 'home',
  channelData = null,
  onUpdateChannel = null,
  onDeleteChannel = null,
  channelExists = true,
  onOpenCreateChannel = null,
  onOpenAddMember = null,
  onOpenGroupAddMember = null,
  friends = [],
  incomingRequests = [],
  outgoingRequests = [],
  onFriendshipUpdated = null,
  onMemberAdded = null,
  onMemberRemoved = null,
  isDmMode = false,
  activeDmFriend: rawActiveDmFriend = null,
  onBackToChannels,
  onOpenSettings = null,
  onClearChat = null,
  onToggleDmCall,
  _isDmCallActive = false,
  // Universal In-Chat Voice Call Props
  isCallActive = false,
  isInCall = false,
  callMembers = [],
  callState = 'active',
  isCaller = false,
  callInitiator = null,
  targetUser = null,
  ringCount = 1,
  maxRings = 3,
  onCancelCall = null,
  onAcceptCall = null,
  onDeclineCall = null,
  onStartCall = null,
  onLeaveCall = null,
  messages = [],
  onSendMessage,
  onToggleReaction,
  currentUser = null,
  channelMembers = [],
  presences = {},
  onTyping,
  typingUsers = [],
  searchTerm = '',
  _onSearchChange,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onOpenMobileSidebar,
  // Screen Sharing props
  activeScreenShare = null,
  onStopScreenShare,
  isScreenSharing = false,
  onToggleScreenShare,
  // Voice Controls props
  isConnected = false,
  isMuted = false,
  isDeafened = false,
  isSpeaking = false,
  onToggleMute,
  onToggleDeafen,
  onDisconnect,
  onConnect,
  peerAudioPrefs = {},
  onSetPeerVolume,
  onTogglePeerMute,
  onSelectDm,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [prevChannel, setPrevChannel] = useState(activeChannel);
  const [isMemberListOpen, setIsMemberListOpen] = useState(true);
  const [isRightPanelCompact, setIsRightPanelCompact] = useState(() => {
    try {
      return localStorage.getItem('voys_right_panel_compact') === 'true';
    } catch {
      return false;
    }
  });
  const updateRightPanelCompact = (next) => {
    setIsRightPanelCompact(next);
    if (next) setIsAddingMember(false);
    try {
      localStorage.setItem('voys_right_panel_compact', next ? 'true' : 'false');
    } catch {
      // Ignore storage write errors
    }
  };
  const [expiredMediaKeys, setExpiredMediaKeys] = useState(() => new Set());

  const markMediaExpired = useCallback((mediaKey) => {
    if (!mediaKey) return;
    setExpiredMediaKeys((prev) => {
      if (prev.has(mediaKey)) return prev;
      const next = new Set(prev);
      next.add(mediaKey);
      return next;
    });
  }, []);

  const handleAttachmentDownload = useCallback(async (att, mediaKey) => {
    if (!att?.url) return;
    const res = await dbService.downloadFile(att.url, att.name || 'download');
    if (res && res.ok === false) {
      if (res.expired) {
        markMediaExpired(mediaKey);
        toast.error('Bu dosyanın 2 günlük saklama süresi dolduğu için silinmiş.');
      } else {
        toast.error('Dosya indirilemedi.');
      }
    }
  }, [markMediaExpired]);

  // Unified member & voice participant right-click context menu state
  const [voiceContextMenu, setVoiceContextMenu] = useState(null); // { x, y, member, source }
  const [contextActionLoading, setContextActionLoading] = useState(null);
  const [confirmContextAction, setConfirmContextAction] = useState(null); // 'unfriend' | 'kick'
  const voiceContextMenuRef = useRef(null);

  const closeContextMenu = useCallback(() => {
    setVoiceContextMenu(null);
    setConfirmContextAction(null);
    setContextActionLoading(null);
  }, []);

  const openVoiceContextMenu = useCallback((e, member, { source = 'voice' } = {}) => {
    if (!member) return;
    e.preventDefault();
    e.stopPropagation();
    const menuW = 268;
    const menuH = 380;
    const x = Math.min(e.clientX, Math.max(8, window.innerWidth - menuW - 12));
    const y = Math.min(e.clientY, Math.max(8, window.innerHeight - menuH - 12));
    setConfirmContextAction(null);
    setContextActionLoading(null);
    setVoiceContextMenu({ x, y, member, source });
  }, []);

  useEffect(() => {
    if (!voiceContextMenu) return;
    const handleOutside = (e) => {
      if (voiceContextMenuRef.current && !voiceContextMenuRef.current.contains(e.target)) {
        closeContextMenu();
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    const handleResize = () => {
      closeContextMenu();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleResize);
    };
  }, [voiceContextMenu, closeContextMenu]);

  // Chat Settings Context
  const { chatSettings, updateChatSetting, inputMode, pttKey, isPttActive } = useSettings();

  // Chat inner view state: 'messages' (default) | 'userInfo'
  const [chatInnerView, setChatInnerView] = useState('messages');
  const [copiedId, setCopiedId] = useState(false);

  // Reset inner view to 'messages' when channel or friend changes
  useEffect(() => {
    setChatInnerView('messages');
  }, [activeChannel, rawActiveDmFriend?.id]);

  // Close inner view on Escape key
  useEffect(() => {
    if (chatInnerView === 'messages') return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setChatInnerView('messages');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatInnerView]);


  // Chat options dropdown & modals state
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [isConfirmDeleteGroupOpen, setIsConfirmDeleteGroupOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const optionsMenuRef = useRef(null);

  useEffect(() => {
    if (!isOptionsMenuOpen) return;
    const handleClickOutside = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target)) {
        setIsOptionsMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOptionsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOptionsMenuOpen]);

  const handleDeleteChat = async () => {
    setIsDeletingChat(true);
    try {
      if (onClearChat) {
        await onClearChat();
      } else {
        const roomId = isDmMode && rawActiveDmFriend && currentUser
          ? getDmRoomId(currentUser.id, rawActiveDmFriend.id)
          : activeChannel;
        await dbService.deleteChatMessages(roomId, isDmMode ? null : activeChannel);
      }
      setIsConfirmDeleteOpen(false);
      toast.success('Sohbet geçmişi başarıyla silindi');
    } catch (err) {
      console.error('Sohbet silinirken hata:', err);
      toast.error('Sohbet geçmişi silinemedi');
    } finally {
      setIsDeletingChat(false);
    }
  };

  const handleDeleteGroup = async () => {
    const targetChannelId = channelData?.id || activeChannel;
    if (!targetChannelId || isDmMode) return;
    try {
      setIsDeletingGroup(true);
      if (onDeleteChannel) {
        await onDeleteChannel(targetChannelId);
      } else {
        await dbService.deleteChannel(targetChannelId);
        if (onBackToChannels) onBackToChannels();
      }
      setIsConfirmDeleteGroupOpen(false);
      setChatInnerView('messages');
      toast.success('Grup başarıyla silindi');
    } catch (err) {
      console.error('Grup silinirken hata:', err);
      toast.error('Grup silinemedi', { description: err?.message });
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Group Avatar Upload & State
  const groupFileInputRef = useRef(null);
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);
  const currentGroupAvatar = channelData?.avatar_url || channelData?.avatar || '';

  const handleGroupAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen geçerli bir görsel dosyası seçin.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fotoğraf boyutu 5MB\'dan küçük olmalıdır.');
      return;
    }

    setIsUploadingGroupAvatar(true);
    const previousAvatarUrl = channelData?.avatar_url || channelData?.avatar || '';

    try {
      const uploadedUrl = await dbService.uploadAvatar(file, activeChannel || 'group');
      // Dismiss spinner as soon as avatar URL is ready
      setIsUploadingGroupAvatar(false);
      if (onUpdateChannel && activeChannel) {
        onUpdateChannel(activeChannel, { avatar_url: uploadedUrl, avatar: uploadedUrl })
          .then(() => {
            if (previousAvatarUrl && previousAvatarUrl !== uploadedUrl) {
              dbService.deleteStorageObjectByUrl('avatars', previousAvatarUrl);
            }
          })
          .catch((err) => {
            console.warn('Grup fotoğrafı kaydetme uyarısı:', err);
          });
      }
      toast.success('Grup fotoğrafı güncellendi');
    } catch (err) {
      console.warn('Grup fotoğrafı yükleme hatası:', err);
      toast.error('Grup fotoğrafı güncellenemedi');
    } finally {
      setIsUploadingGroupAvatar(false);
      if (groupFileInputRef.current) groupFileInputRef.current.value = '';
    }
  };

  const handleRemoveGroupAvatar = async () => {
    setIsUploadingGroupAvatar(true);
    const previousAvatarUrl = channelData?.avatar_url || channelData?.avatar || '';
    try {
      if (onUpdateChannel && activeChannel) {
        onUpdateChannel(activeChannel, { avatar_url: '', avatar: '' })
          .then(() => {
            if (previousAvatarUrl) {
              dbService.deleteStorageObjectByUrl('avatars', previousAvatarUrl);
            }
          })
          .catch((err) => {
            console.warn('Grup fotoğrafı kaldırma uyarısı:', err);
          });
      }
      toast.success('Grup fotoğrafı kaldırıldı');
    } catch (err) {
      console.warn('Grup fotoğrafı kaldırma hatası:', err);
    } finally {
      setIsUploadingGroupAvatar(false);
    }
  };

  // Dynamic profile lookup map for automatically resolving current user avatars and safe names across chat
  const userProfileMap = useMemo(() => {
    const map = new Map();

    const upsertProfile = (uId, candidateNames, candidateAvatar, { alsoKeyYou = false } = {}) => {
      if (!uId) return;
      const existing = map.get(uId) || {};
      const cleanName = pickDisplayName([...candidateNames, existing.name], null);
      const av = candidateAvatar || existing.avatar || null;
      const entry = { id: uId, name: cleanName, avatar: av };
      map.set(uId, entry);
      if (alsoKeyYou) map.set('you', entry);
      if (isRealDisplayName(cleanName)) {
        map.set(cleanName.toLowerCase(), entry);
      }
    };

    // 1. Channel members profiles
    (channelMembers || []).forEach((m) => {
      const uId = m.user_id || m.id;
      const prof = m.profile || m.profiles || {};
      upsertProfile(
        uId,
        [m.name, prof.display_name, prof.username],
        m.avatar || prof.avatar_url || prof.avatar || null
      );
    });

    // 2. Real-time presences (live name & avatar broadcasts)
    Object.entries(presences || {}).forEach(([uId, p]) => {
      if (!p) return;
      upsertProfile(
        uId,
        [p.name, p.display_name, p.username],
        p.avatar || p.avatar_url || null
      );
    });

    // 3. Active DM Friend (never clobbers a real resolved name with a UUID or generic placeholder)
    if (rawActiveDmFriend && rawActiveDmFriend.id) {
      upsertProfile(
        rawActiveDmFriend.id,
        [rawActiveDmFriend.name, rawActiveDmFriend.display_name, rawActiveDmFriend.username],
        rawActiveDmFriend.avatar || rawActiveDmFriend.avatar_url || null
      );
    }

    // 4. Enrich from loaded message history (covers offline / not-yet-fetched senders)
    (messages || []).forEach((msg) => {
      const uId = msg?.userId || msg?.user_id || msg?.sender_id;
      if (!uId || uId === 'you') return;
      const existing = map.get(uId);
      const msgName = msg.user || msg.sender_name || msg.user_name;
      upsertProfile(
        uId,
        [existing?.name, msgName],
        existing?.avatar || msg.avatar || msg.sender_avatar || null
      );
    });

    // 5. Current user (authoritative for own messages)
    if (currentUser && currentUser.id) {
      upsertProfile(
        currentUser.id,
        [currentUser.display_name, currentUser.name, currentUser.username],
        currentUser.avatar_url || currentUser.avatar || null,
        { alsoKeyYou: true }
      );
    }

    return map;
  }, [channelMembers, presences, rawActiveDmFriend, messages, currentUser]);

  const activeDmFriend = useMemo(() => {
    if (!rawActiveDmFriend) return null;
    const fromMap = rawActiveDmFriend.id ? userProfileMap.get(rawActiveDmFriend.id) : null;
    const cached = rawActiveDmFriend.id ? getCachedUserProfile(rawActiveDmFriend.id) : null;
    const resolvedName = pickDisplayName(
      [
        rawActiveDmFriend.name,
        rawActiveDmFriend.display_name,
        rawActiveDmFriend.username,
        fromMap?.name,
        cached?.display_name,
        cached?.name,
        cached?.username,
      ],
      'Kullanıcı'
    );
    const resolvedAvatar =
      rawActiveDmFriend.avatar ||
      rawActiveDmFriend.avatar_url ||
      fromMap?.avatar ||
      cached?.avatar_url ||
      cached?.avatar ||
      '';
    return {
      ...rawActiveDmFriend,
      name: resolvedName,
      display_name: resolvedName,
      avatar: resolvedAvatar,
      avatar_url: resolvedAvatar,
    };
  }, [rawActiveDmFriend, userProfileMap]);

  // Compute live channel members merged with real-time presences
  const liveMembers = (channelMembers || []).map((m) => {
    const memberId = m.user_id || m.id;
    const isSelf = memberId === currentUser?.id;
    const p = presences?.[memberId];
    const profile = m.profile || m.profiles || {};
    const status = isSelf
      ? (currentUser?.status || 'online')
      : (p && p.status !== 'offline' && p.status !== 'invisible' && p.isOnline !== false ? (p?.status || 'online') : 'offline');
    const isOnline = isSelf
      ? (status !== 'offline' && status !== 'invisible')
      : Boolean(p && p.status !== 'offline' && p.status !== 'invisible' && p.isOnline !== false);

    return {
      id: memberId,
      name: isSelf
        ? pickDisplayName([currentUser?.name, currentUser?.display_name, currentUser?.username], 'Sen (You)')
        : pickDisplayName([p?.name, p?.display_name, p?.username, profile.display_name, profile.username, m.name], 'Üye'),
      username: isSelf
        ? (currentUser?.username || '')
        : ([p?.username, profile.username, m.username].find((u) => typeof u === 'string' && u.trim() && !isUuidLike(u)) || ''),
      avatar: isSelf ? (currentUser?.avatar || currentUser?.avatar_url) : (p?.avatar || profile.avatar_url || profile.avatar || m.avatar || ''),
      game: isOnline ? (isSelf ? currentUser?.game : (p?.game !== undefined ? p.game : (profile.game || m.game))) : null,
      substatus: isOnline ? (isSelf ? currentUser?.substatus : (p?.substatus !== undefined ? p.substatus : (profile.substatus || m.substatus))) : '',
      status,
      isOnline,
      role: m.role || 'member',
    };
  });

  const effectiveMembers = useMemo(() => {
    if (isDmMode && activeDmFriend) {
      const selfStatus = currentUser?.status || 'online';
      const selfOnline = selfStatus !== 'offline' && selfStatus !== 'invisible';
      const selfMember = {
        id: currentUser?.id || 'you',
        user_id: currentUser?.id || 'you',
        name: pickDisplayName([currentUser?.name, currentUser?.display_name, currentUser?.username], 'Sen (You)'),
        username: currentUser?.username || '',
        avatar: currentUser?.avatar || currentUser?.avatar_url || '',
        game: selfOnline ? currentUser?.game : null,
        substatus: selfOnline ? currentUser?.substatus : '',
        status: selfStatus,
        isOnline: selfOnline,
        role: 'member',
      };

      const friendStatus = activeDmFriend.status || 'offline';
      const friendOnline = Boolean(activeDmFriend.isOnline);
      const friendMember = {
        id: activeDmFriend.id,
        user_id: activeDmFriend.id,
        name: pickDisplayName([activeDmFriend.name, activeDmFriend.display_name, activeDmFriend.username], 'Arkadaş'),
        username: activeDmFriend.username || '',
        avatar: activeDmFriend.avatar || activeDmFriend.avatar_url || '',
        game: friendOnline ? activeDmFriend.game : null,
        substatus: friendOnline ? activeDmFriend.substatus : '',
        status: friendStatus,
        isOnline: friendOnline,
        role: 'member',
      };

      return [selfMember, friendMember];
    }

    if (liveMembers.length > 0) return liveMembers;

    if (currentUser) {
      const selfStatus = currentUser.status || 'online';
      const selfOnline = selfStatus !== 'offline' && selfStatus !== 'invisible';
      return [{
        id: currentUser.id,
        user_id: currentUser.id,
        name: pickDisplayName([currentUser.name, currentUser.display_name, currentUser.username], 'Sen (You)'),
        username: currentUser.username || '',
        avatar: currentUser.avatar || currentUser.avatar_url,
        game: selfOnline ? currentUser.game : null,
        substatus: selfOnline ? currentUser.substatus : '',
        status: selfStatus,
        isOnline: selfOnline,
        role: 'admin',
      }];
    }

    return [];
  }, [isDmMode, activeDmFriend, currentUser, liveMembers]);

  const onlineMembers = effectiveMembers.filter((m) => m.isOnline);
  const offlineMembers = effectiveMembers.filter((m) => !m.isOnline);

  // Split sidebar display so voice-chat participants appear only under SESLİ SOHBET
  // and remaining members appear under GRUP ÜYELERİ.
  const {
    showVoiceSection,
    voiceMembers: sidebarVoiceMembers,
    groupMembers: sidebarGroupMembers,
  } = partitionSidebarGroupMembers({
    effectiveMembers,
    callMembers,
    isCallActive,
    isInCall,
    currentUser,
    callInitiator,
  });
  const sidebarOnlineMembers = sidebarGroupMembers.filter((m) => m.isOnline);
  const sidebarOfflineMembers = sidebarGroupMembers.filter((m) => !m.isOnline);

  // Determine whether right panel should be displayed (always in group chat; in DM only during voice call)
  const isDmVoiceActive = Boolean(
    isDmMode && (isCallActive || isInCall || showVoiceSection || (callMembers && callMembers.length > 0))
  );

  // Right sidebar inline add-member state
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addingMemberId, setAddingMemberId] = useState(null);

  // Reset add member panel state when active channel changes
  useEffect(() => {
    setIsAddingMember(false);
    setAddMemberSearch('');
    setAddingMemberId(null);
  }, [activeChannel]);

  const memberIdSet = useMemo(() => {
    return new Set(
      (effectiveMembers || []).map((m) => String(m.user_id || m.id))
    );
  }, [effectiveMembers]);

  const filteredAddFriends = useMemo(() => {
    if (!Array.isArray(friends)) return [];
    if (!addMemberSearch.trim()) return friends;
    const q = addMemberSearch.trim().toLowerCase();
    return friends.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const uname = (f.username || '').toLowerCase();
      return name.includes(q) || uname.includes(q);
    });
  }, [friends, addMemberSearch]);

  const handleAddMemberFromSidebar = async (friend) => {
    if (!friend?.id || !activeChannel || addingMemberId === friend.id) return;
    try {
      setAddingMemberId(friend.id);
      const addedRow = await dbService.addChannelMember(activeChannel, friend.id, 'member');
      toast.success('Üye Gruba Eklendi', {
        description: `${friend.name || friend.username || 'Arkadaşınız'} bu gruba eklendi.`,
      });
      onMemberAdded?.(friend, addedRow);
    } catch (err) {
      toast.error('Üye Eklenemedi', {
        description: err.message || 'Bir problem oluştu.',
      });
    } finally {
      setAddingMemberId(null);
    }
  };

  // Reply and Reaction state
  const [replyingTo, setReplyingTo] = useState(null); // { id, user, color, text }
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState(null);

  // File attachments state
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeMediaModal, setActiveMediaModal] = useState(null); // Lightbox for images

  const textInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isNearBottomRef = useRef(true);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.emoji-picker-container')) {
        if (!e.target.closest('.emoji-picker-trigger')) {
          setActiveReactionPickerMsgId(null);
        }
        if (!e.target.closest('.emoji-button-trigger')) {
          setShowEmojiPicker(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset pending state on channel switch (render-time state sync)
  if (prevChannel !== activeChannel) {
    setPrevChannel(activeChannel);
    setPendingFiles([]); // clear pending files on channel switch
    setReplyingTo(null); // reset reply state
  }

  // Smooth scroll to bottom
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowScrollBottom(false);
    isNearBottomRef.current = true;
  }, []);

  // Monitor scroll position
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    // Near bottom if within 120px
    const nearBottom = distanceToBottom < 120;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
  };

  // Auto-scroll on new messages if already near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Window-level Drag & Drop detection for smooth Windows desktop UX without flicker
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        setIsWindowDragging(true);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsWindowDragging(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsWindowDragging(false);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Handle files selected via file dialog (queued to pendingFiles)
  const handleFilesSelected = useCallback((files) => {
    if (!files || files.length === 0) return;

    const newPending = Array.from(files).map((file) => {
      const isImg = file.type.startsWith('image/');
      return {
        id: `pending-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        previewUrl: isImg ? URL.createObjectURL(file) : null,
      };
    });

    setPendingFiles((prev) => [...prev, ...newPending]);
    toast.info(`${files.length} dosya seçildi`, {
      description: 'Mesajınızı yazıp Gönder butonuna basarak paylaşabilirsiniz.',
    });
  }, []);

  // Directly upload dropped files to Supabase Storage and post as a message
  const handleDirectDropAndUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const toastText = files.length === 1
      ? `"${files[0].name}" Supabase Storage'a yükleniyor...`
      : `${files.length} dosya Supabase Storage'a yükleniyor...`;
    const uploadToastId = toast.loading(toastText);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const res = await dbService.uploadFile(file, isDmMode ? 'dm' : 'channel');
        return {
          id: res.id,
          name: res.name || file.name,
          size: res.size || file.size,
          type: res.type || file.type || 'application/octet-stream',
          url: res.url,
        };
      });

      const uploadedAttachments = await Promise.all(uploadPromises);
      toast.dismiss(uploadToastId);
      toast.success(
        files.length === 1
          ? `"${files[0].name}" başarıyla yüklendi ve paylaşıldı!`
          : `${files.length} dosya başarıyla yüklendi ve paylaşıldı!`
      );

      // If user had text typed in input, include it as message caption
      const textToSend = inputText.trim();
      onSendMessage(textToSend, uploadedAttachments, replyingTo);

      if (textToSend) setInputText('');
      setReplyingTo(null);
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (err) {
      toast.dismiss(uploadToastId);
      toast.error('Dosya yüklenirken bir hata oluştu', {
        description: err.message || 'Lütfen tekrar deneyin.',
      });
    } finally {
      setIsUploading(false);
    }
  }, [isDmMode, inputText, onSendMessage, replyingTo, scrollToBottom]);

  // Dropzone configuration for desktop & browser drag-and-drop
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    maxSize: 50 * 1024 * 1024, // 50MB
    onDrop: async (acceptedFiles) => {
      dragCounterRef.current = 0;
      setIsWindowDragging(false);
      if (acceptedFiles && acceptedFiles.length > 0) {
        await handleDirectDropAndUpload(acceptedFiles);
      }
    },
    onDropRejected: (fileRejections) => {
      dragCounterRef.current = 0;
      setIsWindowDragging(false);
      fileRejections.forEach((rej) => {
        toast.error(`Dosya yüklenemedi: ${rej.file.name}`, {
          description: rej.errors?.[0]?.message || 'Maksimum dosya boyutu 50MB olmalıdır.',
        });
      });
    },
  });

  // Remove a pending file from list
  const removePendingFile = (id) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // Clear all pending files
  const clearAllPendingFiles = () => {
    pendingFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setPendingFiles([]);
  };

  // Handle typing change
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  // Send message with optional file uploads
  const handleSend = async (e) => {
    e?.preventDefault();
    const hasText = inputText.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;

    if (!hasText && !hasFiles) return;

    let uploadedAttachments = [];

    // Upload files if any are queued
    if (hasFiles) {
      setIsUploading(true);
      const uploadToastId = toast.loading(`${pendingFiles.length} dosya yükleniyor...`);

      try {
        const uploadPromises = pendingFiles.map(async (item) => {
          const res = await dbService.uploadFile(item.file, isDmMode ? 'dm' : 'channel');
          return {
            id: res.id || item.id,
            name: res.name || item.name,
            size: res.size || item.size,
            type: res.type || item.type,
            url: res.url,
          };
        });

        uploadedAttachments = await Promise.all(uploadPromises);
        toast.dismiss(uploadToastId);
        toast.success('Dosyalar başarıyla yüklendi!');
      } catch (err) {
        toast.dismiss(uploadToastId);
        toast.error('Dosya yüklenirken bir hata oluştu', {
          description: err.message || 'Lütfen tekrar deneyin.',
        });
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    // Call onSendMessage with text, attachment metadata, and active reply
    onSendMessage(inputText, uploadedAttachments, replyingTo);

    // Reset input states
    setInputText('');
    setReplyingTo(null);
    clearAllPendingFiles();
    setShowEmojiPicker(false);

    if (onTyping) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onTyping(false);
    }

    // Force instant scroll down on own send
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape' && replyingTo) {
      e.preventDefault();
      setReplyingTo(null);
    }
  };

  const addEmoji = (emoji) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Handle start replying to a message
  const handleStartReply = (msg, resolvedAuthorName, isMe = false) => {
    const previewText = msg.lines?.[0] ||
      (msg.attachments?.length > 0 ? `📎 ${msg.attachments[0].name}` : '') ||
      'Mesaj';
    setReplyingTo({
      id: msg.id,
      user: pickDisplayName([resolvedAuthorName, msg.user], 'Kullanıcı'),
      color: isMe ? '#a36eff' : (msg.color || '#a36eff'),
      text: previewText,
    });
    textInputRef.current?.focus();
  };

  // Scroll to original replied message with visual pulse
  const scrollToMessage = (targetId) => {
    if (!targetId) return;
    const elem = document.getElementById(`msg-${targetId}`);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elem.classList.add('bg-[#8B51FF]/15', 'ring-1', 'ring-[#8B51FF]/60');
      setTimeout(() => {
        elem.classList.remove('bg-[#8B51FF]/15', 'ring-1', 'ring-[#8B51FF]/60');
      }, 1800);
    }
  };

  // Filter messages if search is active
  const filteredMessages = searchTerm.trim()
    ? messages.filter((m) =>
      m.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.lines?.some((l) => l.toLowerCase().includes(searchTerm.toLowerCase())) ||
      m.attachments?.some((a) => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    : messages;

  // Determine if a chat, DM, or verified group channel is currently active
  const hasActiveChat = Boolean(
    (isDmMode && (activeDmFriend || (activeChannel && activeChannel.startsWith('dm-')))) ||
    (!isDmMode && channelExists && channelData && activeChannel && activeChannel !== 'home')
  );

  const shouldShowRightPanel = Boolean(hasActiveChat && (!isDmMode || isDmVoiceActive));

  if (!hasActiveChat) {
    return (
      <main className="flex-1 flex flex-col h-full bg-[#08080a] voys-glass-chat select-none relative overflow-hidden items-center justify-center p-6 text-center border-l border-white/5">
        <div className="max-w-md flex flex-col items-center space-y-4 animate-in fade-in duration-200">
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-gray-100 tracking-wide">
              Henüz Aktif Bir Sohbet Yok
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
              Soldaki listeden bir arkadaşınızı seçebilir veya yeni bir sohbet başlatabilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {onOpenAddMember && (
              <button
                type="button"
                onClick={onOpenAddMember}
                className="px-4 py-2 bg-[#8B51FF] hover:bg-[#773BF5] text-white font-semibold rounded-xl text-xs transition shadow-lg shadow-indigo-600/25 flex items-center space-x-2 cursor-pointer"
              >
                <UserPlus size={15} />
                <span>Arkadaş Ekle</span>
              </button>
            )}
            {onOpenCreateChannel && (
              <button
                type="button"
                onClick={onOpenCreateChannel}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl text-xs transition shadow-lg shadow-indigo-600/25 flex items-center space-x-2 cursor-pointer"
              >
                <Plus size={14} />
                <span>Yeni Grup Oluştur</span>
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div
      {...getRootProps()}
      className="flex-1 flex flex-col bg-[#08080a] voys-glass-chat relative min-w-0 h-full overflow-hidden"
    >
      <input {...getInputProps()} />

      {/* Drag and Drop Fullscreen Overlay (Windows Desktop & Browser) */}
      {(isDragActive || isWindowDragging) && (
        <div className="absolute inset-0 bg-[#08080a]/95 z-50 flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-150 pointer-events-none">
          <div className="w-full h-full max-w-2xl max-h-[85%] border-2 border-dashed border-indigo-500/80 rounded-3xl bg-[#121216]/90 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            {/* Static Icon Container */}
            <div className="w-20 h-20 rounded-3xl bg-indigo-500/15 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-5">
              <UploadCloud size={40} className="text-indigo-400" />
            </div>

            {/* Main Title */}
            <h3 className="text-xl font-bold text-white tracking-wide">
              Dosyayı Buraya Bırakın
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-300 mt-2 max-w-md leading-relaxed">
              Masaüstünden sürüklediğiniz resim, video ve belgeler otomatik olarak{' '}
              <span className="text-indigo-400 font-semibold">Supabase Storage</span>'a yüklenip sohbette paylaşılır.
            </p>

            {/* Media Type Badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-emerald-300">
                📷 Görseller (PNG, JPG, GIF, WebP)
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-sky-300">
                🎬 Videolar (MP4, WebM, MOV)
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-amber-300">
                📄 Belgeler & Kod (PDF, ZIP, TXT)
              </span>
            </div>

            {/* Security and Size Information */}
            <div className="mt-5 text-[11px] text-gray-400 font-mono flex items-center space-x-1.5">
              <ShieldCheck size={14} className="text-indigo-400" />
              <span>Maksimum dosya boyutu: 50 MB • Güvenli Supabase Storage</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar (Channel or Direct Message) */}
      <div className="min-h-[50px] px-2 sm:px-3 py-2 border-b border-white/5 flex items-center justify-between bg-[#0c0c0e]/95 voys-chat-header backdrop-blur-md select-none z-30 relative flex-shrink-0">
        {chatInnerView !== 'messages' ? (
          /* Header when showing Kişi Bilgisi or Tema Ayarları */
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setChatInnerView('messages')}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition border border-white/10 text-xs font-semibold cursor-pointer"
                title="Sohbete Geri Dön"
              >
                <ArrowLeft size={15} />
                <span>Sohbete Dön</span>
              </button>
              <div className="h-4 w-px bg-white/10 mx-1" />
              <div className="flex items-center space-x-2 truncate">
                {isDmMode ? (
                  <User size={16} className="text-indigo-400 shrink-0" />
                ) : (
                  <Users size={16} className="text-indigo-400 shrink-0" />
                )}
                <span className="text-xs font-bold text-white tracking-wide truncate">
                  {isDmMode && activeDmFriend
                    ? `${activeDmFriend.name} • Kişi Bilgisi`
                    : `${channelData?.name || (typeof activeChannel === 'string' ? activeChannel.replace(/^(text-|voice-)/, '') : 'Grup')} • Grup Bilgisi`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setChatInnerView('messages')}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition border border-white/5 cursor-pointer"
              title="Kapat (ESC)"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center min-w-0">
              {/* Mobile hamburger button */}
              <button
                type="button"
                onClick={onOpenMobileSidebar}
                title="Menüyü Aç"
                className="md:hidden text-gray-300 hover:text-white p-1.5 mr-1.5 rounded-xl hover:bg-white/10 transition flex items-center flex-shrink-0"
              >
                <Menu size={18} />
              </button>

              {isDmMode && activeDmFriend ? (
                /* Direct Message User Profile Header */
                <div className="flex items-center space-x-2 min-w-0">
                  {/* Back to Channels button on mobile / desktop */}
                  {onBackToChannels && (
                    <button
                      type="button"
                      onClick={onBackToChannels}
                      title="Sohbeti Kapat"
                      className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition flex-shrink-0"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  )}

              {/* Friend Avatar (Tıklandığında büyük ekranda açar, sesli aramada konuşma halkası ve sağ tık menüsü gösterir) */}
              {(() => {
                const dmCallMember = (callMembers || []).find(
                  (m) => m?.id === activeDmFriend?.id || (m?.name && m.name === activeDmFriend?.name)
                );
                const dmPref = dmCallMember
                  ? (peerAudioPrefs[String(dmCallMember.id)] || (dmCallMember.peerId ? peerAudioPrefs[String(dmCallMember.peerId)] : null))
                  : null;
                const dmMuted = Boolean(dmPref?.muted || dmPref?.volume === 0);
                const dmSpeaking = Boolean(isInCall && !isDeafened && !dmMuted && dmCallMember?.isSpeaking);

                return (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const avatarUrl = activeDmFriend?.avatar || activeDmFriend?.avatar_url || activeDmFriend?.avatarUrl || null;
                      setActiveMediaModal({
                        url: avatarUrl,
                        name: `${activeDmFriend?.name || 'Kullanıcı'} - Profil Fotoğrafı`,
                        fallbackUser: activeDmFriend,
                      });
                    }}
                    onContextMenu={(e) => {
                      if (isInCall && (dmCallMember || activeDmFriend)) {
                        openVoiceContextMenu(e, dmCallMember || activeDmFriend);
                      }
                    }}
                    className="relative flex-shrink-0 cursor-pointer hover:opacity-85 hover:scale-105 active:scale-95 transition"
                    title={isInCall ? 'Profil fotoğrafını büyüt (Ses ayarları için sağ tıkla)' : 'Profil fotoğrafını büyüt'}
                  >
                    <UserAvatar
                      user={activeDmFriend}
                      size="md"
                      showStatus={false}
                      isSpeaking={dmSpeaking}
                      status={activeDmFriend.status}
                    />
                  </div>
                );
              })()}

              {/* Friend Name & Realtime Presence Status (Tıklandığında Kişi Bilgisini açar) */}
              <div
                onClick={() => setChatInnerView('userInfo')}
                className="min-w-0 flex flex-col cursor-pointer group px-1 -mx-1 py-0.5 rounded-lg hover:bg-white/[0.04] transition"
                title="Kişi bilgisini görüntüle"
              >
                <div className="flex items-center space-x-1.5">
                  <span className={`text-[13px] font-bold truncate group-hover:text-indigo-300 transition ${activeDmFriend.game ? 'text-emerald-400' : (activeDmFriend.isOnline ? 'text-white' : 'text-gray-400')
                    }`}>
                    {activeDmFriend.name}
                  </span>
                  {activeDmFriend.hasCrown && (
                    <Crown size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                  )}
                </div>

                {/* Substatus / Realtime Status */}
                <div className="text-[11px] truncate flex items-center space-x-1.5">
                  {activeDmFriend.game ? (
                    <>
                      <span className="text-emerald-400 font-semibold truncate">{activeDmFriend.game}</span>
                      {activeDmFriend.substatus && !['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin', 'Çevrimdışı'].includes(activeDmFriend.substatus) && (
                        <span className="text-emerald-300/80 hidden sm:inline truncate">- {activeDmFriend.substatus}</span>
                      )}
                    </>
                  ) : activeDmFriend.status === 'dnd' ? (
                    <span className="text-rose-400 font-medium truncate">
                      Rahatsız Etmeyin{activeDmFriend.substatus && !['Çevrimiçi', 'Rahatsız Etmeyin', 'Boşta', 'Çevrimdışı', 'P2P Bağlantısı'].includes(activeDmFriend.substatus) ? ` - ${activeDmFriend.substatus}` : ''}
                    </span>
                  ) : (activeDmFriend.status === 'idle' || activeDmFriend.isAway) ? (
                    <span className="text-amber-400 font-medium truncate">
                      Boşta{activeDmFriend.substatus && !['Çevrimiçi', 'Rahatsız Etmeyin', 'Boşta', 'Çevrimdışı', 'P2P Bağlantısı'].includes(activeDmFriend.substatus) ? ` - ${activeDmFriend.substatus}` : ''}
                    </span>
                  ) : activeDmFriend.isOnline ? (
                    <span className="text-emerald-400 font-medium truncate">
                      {activeDmFriend.substatus && !['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin', 'Çevrimdışı', 'P2P Bağlantısı'].includes(activeDmFriend.substatus) ? activeDmFriend.substatus : 'Çevrimiçi'}
                    </span>
                  ) : (
                    <span className="text-gray-500 truncate">{activeDmFriend.lastSeen || 'Çevrimdışı'}</span>
                  )}
                </div>
              </div>
            </div>
          ) : !hasActiveChat ? (
            /* Empty Home Header (When user is not yet added to any group) */
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center text-indigo-300 shadow-sm flex-shrink-0">
                <Users size={17} />
              </div>
              <div className="min-w-0 flex flex-col">
                <span className="text-[13px] font-bold text-white truncate">Voys</span>
                <span className="text-[11px] text-gray-400 truncate">Henüz katıldığınız bir grup yok</span>
              </div>
            </div>
          ) : (
            /* Group Chat Header - Identical design & size to personal DM chat */
            <div className="flex items-center space-x-2 min-w-0">
              {/* Back to Channels button on mobile / desktop */}
              {onBackToChannels && (
                <button
                  type="button"
                  onClick={onBackToChannels}
                  title="Sohbeti Kapat"
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition flex-shrink-0"
                >
                  <ArrowLeft size={16} />
                </button>
              )}

              {/* Group Avatar (Tıklandığında büyük ekranda açar) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMediaModal({
                    url: currentGroupAvatar || null,
                    name: `${channelData?.name || (typeof activeChannel === 'string' ? activeChannel.replace(/^(text-|voice-)/, '') : 'Grup')} - Grup Fotoğrafı`,
                    isGroup: true,
                  });
                }}
                className="relative flex-shrink-0 cursor-pointer hover:opacity-85 hover:scale-105 active:scale-95 transition"
                title="Grup fotoğrafını büyüt"
              >
                {currentGroupAvatar ? (
                  <img
                    src={currentGroupAvatar}
                    alt={channelData?.name || 'Grup'}
                    className="w-9 h-9 rounded-full object-cover border border-indigo-500/40 shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/25 to-purple-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-sm flex-shrink-0">
                    <Users size={18} />
                  </div>
                )}
              </div>

              {/* Group Name & Realtime Member Count Subtitle (Tıklandığında Grup Bilgisini açar) */}
              <div
                onClick={() => setChatInnerView('userInfo')}
                className="min-w-0 flex flex-col cursor-pointer group px-1 -mx-1 py-0.5 rounded-lg hover:bg-white/[0.04] transition"
                title="Grup bilgisini görüntüle"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="text-[13px] font-bold text-white group-hover:text-indigo-300 transition truncate">
                    {activeChannel === 'home'
                      ? 'Home'
                      : (channelData?.name || (typeof activeChannel === 'string' ? activeChannel.replace(/^(text-|voice-)/, '') : 'Grup'))}
                  </span>
                </div>

                {/* Subtitle / Realtime Members Count */}
                <div className="text-[11px] truncate flex items-center space-x-1.5 text-gray-400">
                  <span>
                    {effectiveMembers.length > 0
                      ? `${effectiveMembers.length} üye${onlineMembers.length > 0 ? `, ${onlineMembers.length} çevrimiçi` : ''}`
                      : 'Grup Sohbeti'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right side of Top Bar: Universal Call Button + Search Filter */}
        {hasActiveChat && (
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Universal Call Button:
              - Sesli sohbet yokken başlatmak/katılmak için telefon butonu görünür (Grup & DM).
              - Sesli sohbete girildiğinde üst bardaki bu buton kaybolur (kontroller sağ paneldeki sesli menüdedir).
          */}
          {!isInCall && !isConnected && (
            <button
              type="button"
              onClick={onStartCall || onToggleDmCall || onConnect}
              title={isCallActive ? `Sesli Sohbete Katıl ${callMembers?.length ? `(${callMembers.length} kişi seste)` : ''}` : "Sesli Sohbet Başlat"}
              className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer ${
                isCallActive
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Phone size={17} />
              {isCallActive && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-2 ring-[#0c0c0e]" />
              )}
            </button>
          )}

          {/* Chat Options Button (3 Nokta) */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              type="button"
              onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                isOptionsMenuOpen
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Seçenekler"
            >
              <MoreVertical size={17} />
            </button>

            {/* Açılır Küçük Popup (Dropdown) */}
            {isOptionsMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setIsOptionsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOptionsMenuOpen(false);
                      setChatInnerView('userInfo');
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-white/10 rounded-xl transition text-left cursor-pointer"
                  >
                    {isDmMode ? (
                      <>
                        <User size={15} className="text-indigo-400 flex-shrink-0" />
                        <span>Kişi bilgisi</span>
                      </>
                    ) : (
                      <>
                        <Users size={15} className="text-indigo-400 flex-shrink-0" />
                        <span>Grup bilgisi</span>
                      </>
                    )}
                  </button>

                  <div className="my-1 border-t border-white/5" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsOptionsMenuOpen(false);
                      setIsConfirmDeleteOpen(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition text-left cursor-pointer"
                  >
                    <Trash2 size={15} className="text-rose-400 flex-shrink-0" />
                    <span>Sohbeti temizle</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        )}
          </>
        )}
      </div>

      {/* Main Content Area OR Inline User/Group Info */}
      {chatInnerView === 'userInfo' && hasActiveChat ? (
        /* Inline Kişi Bilgisi / Kanal Bilgisi (Hesap Ayarları Düzeni) */
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto bg-[#08080a] custom-scrollbar px-6 md:px-10 py-8 select-none">
          <div className="max-w-2xl mx-auto w-full space-y-6">
            {/* Header: Kişi Bilgisi veya Grup Bilgisi */}
            <div className="pb-4 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {isDmMode ? 'Kişi Bilgisi' : 'Grup Bilgisi'}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {isDmMode
                    ? 'Kişisel profil detayları, kullanıcı bilgileri ve doğrudan iletişim seçenekleri.'
                    : 'Grup profili, katılımcı yönetimi ve grup ayarları.'}
                </p>
              </div>
            </div>

            {isDmMode && activeDmFriend ? (
              <>
                {/* Bölüm 1: Profil Fotoğrafı & Kimlik */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                      PROFİL FOTOĞRAFI
                    </label>
                  </div>
                  <div className="p-4 bg-[#111214] border border-white/10 rounded-xl flex flex-col sm:flex-row items-center gap-5">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        const avatarUrl = activeDmFriend?.avatar || activeDmFriend?.avatar_url || activeDmFriend?.avatarUrl || null;
                        setActiveMediaModal({
                          url: avatarUrl,
                          name: `${activeDmFriend?.name || 'Kullanıcı'} - Profil Fotoğrafı`,
                          fallbackUser: activeDmFriend,
                        });
                      }}
                      className="relative group w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 hover:border-[#8B51FF] bg-black/40 flex flex-col items-center justify-center cursor-pointer transition flex-shrink-0"
                      title="Profil fotoğrafını büyüt"
                    >
                      <UserAvatar
                        user={activeDmFriend}
                        size="xl"
                        showStatus={false}
                      />
                    </div>

                    <div className="flex-1 space-y-1.5 text-center sm:text-left min-w-0">
                      <div className="flex items-center justify-center sm:justify-start space-x-2">
                        <h3 className="text-base font-bold text-white truncate">
                          {activeDmFriend.name}
                        </h3>
                        {activeDmFriend?.hasCrown && (
                          <Crown size={14} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono truncate">
                        {activeDmFriend.username ? `@${activeDmFriend.username}` : (activeDmFriend.email || 'Voys Kullanıcısı')}
                      </p>
                      <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                          activeDmFriend.status === 'dnd'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                            : (activeDmFriend.status === 'idle' || activeDmFriend.isAway)
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : activeDmFriend.isOnline
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            activeDmFriend.status === 'dnd'
                              ? 'bg-rose-400'
                              : (activeDmFriend.status === 'idle' || activeDmFriend.isAway)
                              ? 'bg-amber-400'
                              : activeDmFriend.isOnline
                              ? 'bg-emerald-400'
                              : 'bg-zinc-500'
                          }`} />
                          <span>
                            {activeDmFriend.status === 'dnd'
                              ? 'Rahatsız Etmeyin'
                              : (activeDmFriend.status === 'idle' || activeDmFriend.isAway)
                              ? 'Boşta'
                              : activeDmFriend.isOnline
                              ? 'Çevrimiçi'
                              : 'Çevrimdışı'}
                          </span>
                        </span>

                        {activeDmFriend.game && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            <Gamepad2 size={12} className="text-emerald-400" />
                            <span className="truncate">{activeDmFriend.game}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bölüm 2: Kullanıcı Bilgileri */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                      HESAP BİLGİLERİ
                    </label>
                  </div>
                  <div className="p-4 bg-[#111214] border border-white/10 rounded-xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-200 block mb-1.5">
                          Görünen İsim
                        </label>
                        <div className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-[#161719]/80 text-gray-200 border border-white/5 select-text">
                          {activeDmFriend.name}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-200 block mb-1.5">
                          Kullanıcı Adı
                        </label>
                        <div className="w-full rounded-lg px-3.5 py-2.5 text-xs font-mono bg-[#161719]/80 text-gray-200 border border-white/5 select-text">
                          {activeDmFriend.username ? `@${activeDmFriend.username}` : '@kullanici'}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-gray-200 block mb-1.5">
                          Biyografi / Durum
                        </label>
                        <div className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-[#161719]/80 text-gray-300 border border-white/5 select-text leading-relaxed">
                          {activeDmFriend.substatus || activeDmFriend.bio || 'Henüz bir durum veya biyografi eklenmemiş.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bölüm 3: İletişim ve İşlemler */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                      HIZLI İŞLEMLER
                    </label>
                  </div>
                  <div className="p-4 bg-[#111214] border border-white/10 rounded-xl flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (onStartCall) onStartCall();
                        else if (onToggleDmCall) onToggleDmCall();
                      }}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-[#8B51FF] hover:bg-[#773BF5] text-white rounded-lg text-xs font-semibold shadow transition active:scale-95 cursor-pointer"
                    >
                      <Phone size={14} />
                      <span>Sesli Arama Başlat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-xs font-semibold border border-rose-500/20 transition active:scale-95 cursor-pointer"
                    >
                      <Trash2 size={14} className="text-rose-400" />
                      <span>Sohbet Geçmişini Temizle</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Bölüm 1: Grup Profili & Fotoğrafı */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                      GRUP FOTOĞRAFI
                    </label>
                  </div>
                  <div className="p-4 bg-[#111214] border border-white/10 rounded-xl flex flex-col sm:flex-row items-center gap-5">
                    <input
                      ref={groupFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleGroupAvatarFileChange}
                      className="hidden"
                    />
                    <div
                      onClick={() => !isUploadingGroupAvatar && groupFileInputRef.current?.click()}
                      className={`relative group w-20 h-20 rounded-2xl overflow-hidden border-2 bg-black/40 flex flex-col items-center justify-center cursor-pointer transition flex-shrink-0 ${
                        currentGroupAvatar
                          ? 'border-white/10 hover:border-[#8B51FF]'
                          : 'border-white/10 hover:border-[#8B51FF]'
                      }`}
                      title="Grup fotoğrafını değiştirmek için tıklayın"
                    >
                      {currentGroupAvatar ? (
                        <>
                          <img
                            src={currentGroupAvatar}
                            alt={channelData?.name || 'Grup'}
                            className="w-full h-full object-cover group-hover:opacity-30 transition"
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition text-white text-[10px] font-semibold">
                            <Camera size={16} className="mb-0.5 text-white" />
                            <span>Değiştir</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <Users size={28} className="text-gray-400 group-hover:scale-110 transition" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition text-white text-[10px] font-semibold">
                            <Camera size={16} className="mb-0.5 text-white" />
                            <span>Yükle</span>
                          </div>
                        </>
                      )}
                      {isUploadingGroupAvatar && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                          <Loader2 size={20} className="animate-spin text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5 text-center sm:text-left min-w-0">
                      <h3 className="text-base font-bold text-white truncate">
                        {channelData?.name || (typeof activeChannel === 'string' ? activeChannel.replace(/^(text-|voice-)/, '') : 'Grup')}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {liveMembers.length} Aktif Katılımcı
                      </p>
                      <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <button
                          type="button"
                          disabled={isUploadingGroupAvatar}
                          onClick={() => groupFileInputRef.current?.click()}
                          className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-[#8B51FF] hover:bg-[#773BF5] text-white rounded-lg text-xs font-semibold shadow transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <Upload size={13} />
                          <span>Fotoğraf Yükle</span>
                        </button>
                        {currentGroupAvatar && (
                          <button
                            type="button"
                            disabled={isUploadingGroupAvatar}
                            onClick={handleRemoveGroupAvatar}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-xs font-medium border border-rose-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 size={12} />
                            <span>Fotoğrafı Kaldır</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bölüm 2: Grup Üyeleri */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                      GRUP ÜYELERİ ({liveMembers.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenGroupAddMember) {
                          onOpenGroupAddMember();
                        } else {
                          setChatInnerView('messages');
                          setIsAddingMember(true);
                        }
                      }}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#8B51FF] hover:bg-[#773BF5] text-white rounded-lg text-xs font-semibold shadow transition active:scale-95 cursor-pointer"
                    >
                      <UserPlus size={13} />
                      <span>Üye Ekle</span>
                    </button>
                  </div>
                  <div className="bg-[#111214] border border-white/10 rounded-xl overflow-hidden">
                    <div className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto overflow-x-hidden custom-scrollbar">
                      {liveMembers.map((member) => (
                        <div
                          key={member.id}
                          onContextMenu={(e) => openVoiceContextMenu(e, member, { source: 'member' })}
                          title="Seçenekler için sağ tıklayın"
                          className="p-3 hover:bg-white/[0.03] transition flex items-center justify-between cursor-context-menu"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <UserAvatar user={member} size="sm" showStatus={true} status={member.isOnline ? member.status : 'offline'} />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate flex items-center space-x-1.5">
                                <span>{member.name}</span>
                                {member.id === currentUser?.id && (
                                  <span className="text-[10px] text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.2 rounded font-semibold">Sen</span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate">
                                {member.isOnline && member.game ? `Oynuyor: ${member.game}` : getMemberStatusDisplay(member)}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                            {member.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bölüm 3: Tehlikeli Bölge */}
                {activeChannel !== 'home' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-rose-400 uppercase tracking-wider block">
                        TEHLİKELİ BÖLGE
                      </label>
                    </div>
                    <div className="p-4 bg-rose-500/[0.03] border border-rose-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white">Grubu Kalıcı Olarak Sil</div>
                        <p className="text-[11px] text-gray-400">
                          Bu grup, tüm mesaj geçmişi ve katılımcı listesiyle birlikte kalıcı olarak silinecektir.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsConfirmDeleteGroupOpen(true)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow transition active:scale-95 cursor-pointer flex items-center space-x-1.5 flex-shrink-0"
                      >
                        <Trash2 size={13} />
                        <span>Grubu Sil</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* Main Content Area: Left = Chat messages & input; Right = Channel Members */
        <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
          {!isDmMode && hasActiveChat && (
            <button
              type="button"
              onClick={() => updateRightPanelCompact(!isRightPanelCompact)}
              className="absolute top-2.5 right-3 z-20 w-7 h-7 rounded-lg bg-[#13141a]/90 hover:bg-[#1e1f28] border border-white/10 hover:border-white/20 text-gray-400 hover:text-white shadow-md backdrop-blur-sm flex items-center justify-center transition cursor-pointer"
              title={isRightPanelCompact ? 'Üye menüsünü genişlet' : 'Üye menüsünü daralt'}
              aria-label={isRightPanelCompact ? 'Üye menüsünü genişlet' : 'Üye menüsünü daralt'}
            >
              {isRightPanelCompact ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            </button>
          )}

          {/* Steam-Style Active Voice Chat Banner (Sadece DM modunda gösterilir, grupta sağ panelde yer alır) */}
          {isDmMode && isCallActive && !isInCall && (
            <div className="mx-3 mt-2.5 p-3 rounded-2xl bg-[#10141e] border border-emerald-500/30 flex items-center justify-between flex-shrink-0 z-10">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Volume2 size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white tracking-wide">
                      Sesli Sohbet Aktif
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-[11px] text-gray-300 truncate">
                    {callInitiator?.name || (isDmMode && activeDmFriend ? activeDmFriend.name : 'Bir katılımcı')} sesli sohbet başlattı • {callMembers?.length || 1} kişi katıldı
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onStartCall || onToggleDmCall}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex-shrink-0 ml-3"
              >
                <Phone size={13} />
                <span>Katıl</span>
              </button>
            </div>
          )}

          {/* Screen Share Stage (Top Banner or PiP Video Component) */}
          {activeScreenShare && !isInCall && (
            <ScreenShareStage
              activeScreenShare={activeScreenShare}
              onStopScreenShare={onStopScreenShare}
            />
          )}

          {/* Channel Not Found / No Groups Empty State */}
          {!hasActiveChat && !isDmMode ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl">
                {activeChannel ? <Hash size={24} /> : <Users size={24} />}
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-sm font-bold text-gray-100 tracking-wide">
                  {activeChannel ? 'Grup Bulunamadı' : 'Henüz Bir Grubunuz Yok'}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {activeChannel
                    ? 'Bu gruba erişiminiz yok veya grup silinmiş.'
                    : 'Bir grup yöneticisi sizi gruba eklediğinde burada görünecektir. Dilerseniz yeni bir grup oluşturabilir veya arkadaşlarınızla sohbet edebilirsiniz.'}
                </p>
              </div>
              {onOpenCreateChannel && (
                <button
                  type="button"
                  onClick={onOpenCreateChannel}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 transition active:scale-95 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Yeni Grup Oluştur</span>
                </button>
              )}
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-2 md:px-4 py-3 space-y-0.5 select-text scroll-smooth"
            >
              {filteredMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 px-4 text-center select-none space-y-2 animate-in fade-in duration-200">
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-sm font-bold text-gray-200 tracking-wide">
                      {searchTerm
                        ? 'Eşleşen Mesaj Yok'
                        : isDmMode && activeDmFriend
                          ? 'Sohbet Geçmişi Boş'
                          : 'Henüz mesaj yok'}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {searchTerm
                        ? `"${searchTerm}" araması ile eşleşen mesaj bulunamadı.`
                        : isDmMode && activeDmFriend
                          ? `${activeDmFriend.name} ile henüz bir mesaj geçmişiniz yok. Bir merhaba diyerek konuşmayı başlatın!`
                          : 'Bu sohbette henüz mesaj paylaşılmadı. İlk mesajı siz yazarak sohbeti başlatın!'}
                    </p>
                  </div>
                </div>
              ) : (
                filteredMessages.map((msg, index) => {
                  const currentUserId = currentUser?.id || 'you';
                  const senderId = msg.userId || msg.user_id || msg.sender_id;
                  const isMe = Boolean(
                    msg.userId === 'you' ||
                    (currentUser?.id && senderId && senderId !== 'you'
                      ? String(senderId) === String(currentUser.id)
                      : (
                        (currentUser?.name && msg.user === currentUser.name) ||
                        (currentUser?.display_name && msg.user === currentUser.display_name) ||
                        (currentUser?.username && (msg.user === currentUser.username || msg.username === currentUser.username))
                      ))
                  );

                  const safeMsgUser = pickDisplayName([msg.user, msg.sender_name, msg.user_name], null);
                  const cachedSender = (!isMe && senderId) ? getCachedUserProfile(senderId) : null;
                  const resolvedProfile = isMe
                    ? {
                      id: currentUserId,
                      name: pickDisplayName([currentUser?.display_name, currentUser?.name, currentUser?.username, safeMsgUser], 'Sen (You)'),
                      avatar: currentUser?.avatar_url || currentUser?.avatar || msg.avatar,
                    }
                    : (senderId ? userProfileMap.get(senderId) : null) ||
                    (safeMsgUser ? userProfileMap.get(safeMsgUser.toLowerCase()) : null) ||
                    (isDmMode && activeDmFriend ? {
                      id: activeDmFriend.id,
                      name: activeDmFriend.name,
                      avatar: activeDmFriend.avatar || activeDmFriend.avatar_url || msg.avatar,
                    } : null) ||
                    (cachedSender ? {
                      id: cachedSender.id,
                      name: pickDisplayName([cachedSender.display_name, cachedSender.name, cachedSender.username], null),
                      avatar: cachedSender.avatar_url || cachedSender.avatar || msg.avatar,
                    } : null);

                  const messageUser = isMe
                    ? pickDisplayName([currentUser?.display_name, currentUser?.name, currentUser?.username, safeMsgUser], 'Sen (You)')
                    : pickDisplayName([resolvedProfile?.name, safeMsgUser, isDmMode ? activeDmFriend?.name : null], 'Kullanıcı');

                  const currentDate = getMessageDate(msg);
                  const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                  const prevDate = prevMsg ? getMessageDate(prevMsg) : null;

                  // Show date divider on day boundaries or for the very first message
                  const isFirstMsg = index === 0;
                  const isDifferentDay = currentDate && prevDate && !isSameDay(currentDate, prevDate);
                  const showDateDivider = (isFirstMsg && currentDate) || isDifferentDay;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <div className="py-2.5 flex items-center justify-center select-none flex-shrink-0 my-2">
                          <div className="w-12 md:w-16 h-[1px] bg-white/10"></div>
                          <span className="text-[10.5px] md:text-[11px] text-gray-400 font-medium mx-3 tracking-wide">
                            {formatChatDateDivider(currentDate)}
                          </span>
                          <div className="w-12 md:w-16 h-[1px] bg-white/10"></div>
                        </div>
                      )}
                      <div
                        id={`msg-${msg.id}`}
                        className="relative group/msg flex flex-col w-full py-1.5 px-2 sm:px-3 hover:bg-white/[0.025] transition-colors rounded-xl"
                      >
                      {/* Hover Floating Action Bar: Quick Reactions + Full Emoji Picker + Reply */}
                      <div
                        className={`voys-msg-action-bar absolute right-2 sm:right-3 ${
                          isFirstMsg && !showDateDivider ? 'top-0.5' : '-top-3'
                        } transition-all duration-150 z-20 flex items-center bg-[#141418]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl px-1 py-0.5 gap-0.5 select-none ${
                          activeReactionPickerMsgId === msg.id
                            ? 'opacity-100 pointer-events-auto'
                            : isOptionsMenuOpen
                              ? 'opacity-0 pointer-events-none'
                              : 'opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto'
                        }`}
                      >
                        {/* Quick Reactions */}
                        {['👍', '❤️', '😂'].map((emoji) => {
                          const hasReacted = msg.reactions?.some(r => r.emoji === emoji && r.users?.includes(currentUserId));
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => onToggleReaction?.(msg.id, emoji)}
                              className={`w-6 h-6 flex items-center justify-center rounded-md text-[13px] leading-none transition duration-100 hover:bg-white/10 hover:scale-110 active:scale-90 cursor-pointer ${
                                hasReacted ? 'bg-[#8B51FF]/25 ring-1 ring-[#8B51FF]/60' : ''
                              }`}
                              title={`Tepki: ${emoji}`}
                            >
                              {emoji}
                            </button>
                          );
                        })}

                        {/* "Tepki Ekle" Button */}
                        <button
                          type="button"
                          onClick={() => setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id)}
                          className={`emoji-picker-trigger w-6 h-6 flex items-center justify-center rounded-md transition cursor-pointer ${
                            activeReactionPickerMsgId === msg.id
                              ? 'text-[#a36eff] bg-[#8B51FF]/20'
                              : 'text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                          title="Tüm Emojilerle Tepki Ekle"
                        >
                          <SmilePlus size={13} />
                        </button>

                        <div className="w-px h-3.5 bg-white/10 mx-0.5" />

                        {/* "Yanıtla" Button */}
                        <button
                          type="button"
                          onClick={() => handleStartReply(msg, messageUser, isMe)}
                          className="h-6 px-2 hover:bg-[#8B51FF]/20 text-gray-300 hover:text-white rounded-md transition flex items-center gap-1 text-xs font-medium cursor-pointer group/replybtn"
                          title="Mesajı Yanıtla"
                        >
                          <Reply size={13} className="text-[#a36eff] group-hover/replybtn:text-white transition-colors" />
                          <span className="hidden sm:inline text-[11px]">Yanıtla</span>
                        </button>
                      </div>

                      {/* Floating Emoji Picker Popover anchored to this message */}
                      {activeReactionPickerMsgId === msg.id && (
                        <div
                          className={`emoji-picker-container absolute z-50 shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-[#141418] animate-in fade-in zoom-in-95 right-2 sm:right-3 ${
                            filteredMessages.length > 3 && index >= filteredMessages.length - 3
                              ? 'bottom-8'
                              : 'top-7'
                          }`}
                        >
                          <div className="bg-white/[0.02] p-2 px-3 border-b border-white/10 flex items-center justify-between text-xs text-gray-300">
                            <span className="font-semibold text-[11px] text-gray-200">Tepki Ekle</span>
                            <button
                              type="button"
                              onClick={() => setActiveReactionPickerMsgId(null)}
                              className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <EmojiPicker
                            theme={chatSettings?.theme === 'light' ? Theme.LIGHT : Theme.DARK}
                            onEmojiClick={(emojiData) => {
                              onToggleReaction?.(msg.id, emojiData.emoji);
                              setActiveReactionPickerMsgId(null);
                            }}
                            searchPlaceHolder="Emoji ara..."
                            width={300}
                            height={360}
                            lazyLoadEmojis
                            skinTonesDisabled
                            previewConfig={{ showPreview: false }}
                          />
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="w-full min-w-0 flex flex-col items-start">
                        {/* Quoted Message (Reply Preview) */}
                        {msg.reply_to && (
                          <button
                            type="button"
                            onClick={() => scrollToMessage(msg.reply_to.id)}
                            className="voys-reply-quote mb-1.5 inline-flex items-center gap-1.5 text-[11px] text-left cursor-pointer py-1 px-2.5 rounded-r-lg rounded-l-sm border-l-2 border-[#8B51FF] max-w-full transition group/reply bg-white/[0.03] hover:bg-white/[0.06] text-gray-400 hover:text-gray-200"
                            title="Orijinal mesaja git"
                          >
                            <CornerDownRight size={11} className="text-[#a36eff] flex-shrink-0" />
                            <span className="font-semibold truncate max-w-[130px]" style={{ color: msg.reply_to.color || '#a36eff' }}>
                              @{pickDisplayName([msg.reply_to.user], 'Kullanıcı')}
                            </span>
                            <span className="truncate max-w-[200px] sm:max-w-md opacity-85">
                              {msg.reply_to.text}
                            </span>
                          </button>
                        )}

                        {/* Header: Username + Crown + Timestamp (Saat) */}
                        <div className="flex items-center gap-2 leading-none mb-1 select-none">
                          <span
                            className="font-bold text-[13.5px] tracking-wide hover:underline cursor-pointer"
                            style={{ color: isMe ? '#a36eff' : (msg.color || '#e2e8f0') }}
                          >
                            {messageUser}
                          </span>
                          {msg.hasCrown && (
                            <Crown size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" title="Kanal Sahibi" />
                          )}
                          <span
                            className="text-[11px] font-mono text-gray-500 hover:text-gray-300 transition-colors cursor-default"
                            title={formatFullDateTime(msg.sentAt || msg.sent_at || msg.created_at)}
                          >
                            {formatMessageTimeOnly(msg.timestamp, msg.sentAt || msg.sent_at || msg.created_at)}
                          </span>
                        </div>

                        {/* Lines of text */}
                        {msg.lines && msg.lines.length > 0 && (
                          <div className="space-y-0.5 text-[13.5px] leading-relaxed break-words text-gray-200 max-w-full">
                            {msg.lines.map((line, idx) => (
                              <div key={idx} className="font-normal font-sans">
                                {line}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Media & File Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-3">
                            {msg.attachments.map((att, idx) => {
                              const mediaKey = att.id || `${msg.id}_att_${idx}`;
                              const isMediaExpired = expiredMediaKeys.has(mediaKey);
                              const isImage = att.type?.startsWith('image/');
                              const isVideo = att.type?.startsWith('video/');
                              const ext = (att.name?.split('.').pop() || '').toLowerCase();
                              const isAudio = att.type?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext);

                              if (isMediaExpired) {
                                return (
                                  <div
                                    key={att.id || idx}
                                    className="flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl bg-[#111115] border border-amber-500/20 max-w-xs sm:max-w-md text-xs"
                                  >
                                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
                                      <File size={16} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-gray-300 font-semibold truncate">{att.name || 'Dosya'}</div>
                                      <div className="text-[11px] text-amber-300/80">
                                        Dosyanın 2 günlük süresi doldu veya silindi
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              // Image Attachment with Rich Thumbnail
                              if (isImage) {
                                return (
                                  <div
                                    key={att.id || idx}
                                    className="group/img relative rounded-2xl overflow-hidden border border-white/10 hover:border-indigo-500/60 bg-[#0c0c0e] transition-all max-w-xs sm:max-w-md shadow-lg flex flex-col"
                                  >
                                    <div
                                      onClick={() => setActiveMediaModal(att)}
                                      className="cursor-pointer relative overflow-hidden bg-black/40 flex items-center justify-center min-h-[140px]"
                                    >
                                      <img
                                        src={att.url}
                                        alt={att.name || 'Paylaşılan Görsel'}
                                        onError={() => markMediaExpired(mediaKey)}
                                        className="max-h-72 w-auto object-contain rounded-t-2xl group-hover/img:scale-[1.01] transition-transform duration-200"
                                        loading="lazy"
                                      />
                                      {/* Hover zoom overlay */}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-white text-xs font-semibold flex items-center space-x-1.5 border border-white/20 shadow-md">
                                          <Eye size={13} className="text-indigo-400" />
                                          <span>Büyüt</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Bottom Bar: File Name, Size, Download */}
                                    <div className="p-2.5 px-3 bg-[#0c0c0e]/95 border-t border-white/5 flex items-center justify-between text-xs text-gray-300">
                                      <div className="flex flex-col min-w-0 pr-2">
                                        <span className="font-semibold text-gray-200 truncate text-[12px]">{att.name}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{formatFileSize(att.size)}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAttachmentDownload(att, mediaKey);
                                        }}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-600/30 text-gray-300 hover:text-white border border-white/5 hover:border-indigo-500/30 transition flex items-center space-x-1"
                                        title="Görseli İndir"
                                      >
                                        <Download size={13} />
                                        <span className="text-[10px] font-medium hidden sm:inline">İndir</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              // Video Attachment
                              if (isVideo) {
                                return (
                                  <div
                                    key={att.id || idx}
                                    className="rounded-2xl overflow-hidden border border-white/10 hover:border-indigo-500/50 bg-[#0a0a0d] max-w-xs sm:max-w-md shadow-lg"
                                  >
                                    <video
                                      src={att.url}
                                      controls
                                      onError={() => markMediaExpired(mediaKey)}
                                      className="max-h-80 w-full bg-black"
                                      preload="metadata"
                                    />
                                    <div className="px-3 py-2 bg-[#0c0c0e] border-t border-white/5 flex items-center justify-between text-xs text-gray-300">
                                      <div className="flex flex-col min-w-0 pr-2">
                                        <span className="truncate font-semibold text-gray-200 text-[12px]">{att.name}</span>
                                        <span className="font-mono text-[10px] text-gray-400">{formatFileSize(att.size)} • Video</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAttachmentDownload(att, mediaKey)}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-600/30 text-gray-300 hover:text-white border border-white/5 hover:border-indigo-500/30 transition flex items-center space-x-1 flex-shrink-0"
                                        title="Videoyu İndir"
                                      >
                                        <Download size={13} />
                                        <span className="text-[10px] font-medium hidden sm:inline">İndir</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              // Audio Attachment
                              if (isAudio) {
                                return (
                                  <div
                                    key={att.id || idx}
                                    className="rounded-2xl p-3 bg-[#141418] border border-white/10 hover:border-indigo-500/40 transition max-w-xs sm:max-w-md shadow-md"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center space-x-2 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
                                          <Volume2 size={16} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs font-semibold text-gray-200 truncate">{att.name}</div>
                                          <div className="text-[10px] text-gray-400 font-mono">{formatFileSize(att.size)} • Ses Kaydı</div>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAttachmentDownload(att, mediaKey)}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition flex-shrink-0 ml-2"
                                        title="Sesi İndir"
                                      >
                                        <Download size={13} />
                                      </button>
                                    </div>
                                    <audio src={att.url} controls onError={() => markMediaExpired(mediaKey)} className="w-full h-8 rounded-lg" preload="metadata" />
                                  </div>
                                );
                              }

                              // Document / Generic File Download Card
                              return (
                                <div
                                  key={att.id || idx}
                                  onClick={() => handleAttachmentDownload(att, mediaKey)}
                                  className="flex items-center space-x-3 px-3.5 py-3 rounded-2xl bg-[#141418] border border-white/10 hover:border-indigo-500/50 hover:bg-[#1a1a20] transition group/file w-full max-w-sm sm:max-w-md shadow-md cursor-pointer select-none"
                                >
                                  <div className="p-2.5 bg-white/5 group-hover/file:bg-indigo-500/20 text-indigo-400 rounded-xl flex-shrink-0 transition border border-white/5 group-hover/file:border-indigo-500/30">
                                    {getFileIcon(att.type, att.name)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-gray-200 truncate group-hover/file:text-white transition">
                                      {att.name}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center space-x-1.5">
                                      <span>{formatFileSize(att.size)}</span>
                                      <span>•</span>
                                      <span className="text-indigo-400 font-sans font-medium">{getFileTypeLabel(att.type, att.name)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAttachmentDownload(att, mediaKey);
                                      }}
                                      className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-indigo-600/30 group-hover/file:bg-indigo-600 text-gray-300 group-hover/file:text-white border border-white/10 group-hover/file:border-indigo-500/40 text-xs font-semibold flex items-center space-x-1.5 transition"
                                      title="Dosyayı İndir"
                                    >
                                      <Download size={13} />
                                      <span>İndir</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Emoji Reactions Pill Badges */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 select-none justify-start">
                            {msg.reactions.map((r) => {
                              const hasReacted = r.users?.includes(currentUserId);
                              const reactorNames = (r.users || [])
                                .map((uid) => {
                                  if (String(uid) === String(currentUserId)) return 'Sen';
                                  const mapped = userProfileMap.get(uid) || userProfileMap.get(String(uid));
                                  const cached = !mapped ? getCachedUserProfile(uid) : null;
                                  return pickDisplayName(
                                    [mapped?.name, cached?.display_name, cached?.name, cached?.username],
                                    'Kullanıcı'
                                  );
                                })
                                .filter(Boolean);
                              return (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={() => onToggleReaction?.(msg.id, r.emoji)}
                                  className={`voys-reaction-pill h-[26px] inline-flex items-center gap-1.5 px-2 rounded-lg text-xs font-medium border transition active:scale-95 cursor-pointer ${
                                    hasReacted
                                      ? 'voys-reaction-pill-active bg-[#8B51FF]/20 border-[#8B51FF]/50 text-[#d4bcff]'
                                      : 'bg-white/[0.04] border-white/10 hover:border-white/20 hover:bg-white/[0.07] text-gray-300'
                                  }`}
                                  title={`${reactorNames.join(', ') || 'Kullanıcılar'} (${r.count})`}
                                >
                                  <span className="text-[13px] leading-none">{r.emoji}</span>
                                  <span className="text-[11px] font-semibold tabular-nums">{r.count}</span>
                                </button>
                              );
                            })}

                            {/* Plus button to add reaction */}
                            <button
                              type="button"
                              onClick={() => setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id)}
                              className="emoji-picker-trigger voys-reaction-pill h-[26px] w-[26px] rounded-lg bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07] text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                              title="Tepki Ekle"
                            >
                              <SmilePlus size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Floating Scroll to Bottom Button */}
          {showScrollBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-20 right-6 w-9 h-9 rounded-full bg-[#141418] hover:bg-[#1e1e26] text-gray-300 hover:text-white border border-white/15 flex items-center justify-center transition-colors select-none z-20 cursor-pointer"
              title="En alta kaydır"
            >
              <ArrowDown size={16} />
            </button>
          )}

          {hasActiveChat && (
            <>
              {/* Typing Indicator */}
              <div className="h-5 px-4 text-[11px] text-gray-400 italic select-none flex items-center flex-shrink-0">
                {typingUsers.length > 0 && (
                  <div className="flex items-center space-x-1.5 text-indigo-400">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                    <span>{typingUsers.join(', ')} yazıyor...</span>
                  </div>
                )}
              </div>

              {/* Pending Attachments Chip Bar */}
              {pendingFiles.length > 0 && (
                <div className="px-4 py-2 bg-[#0c0c0e] border-t border-white/5 flex items-center justify-between z-10 flex-shrink-0">
                  <div className="flex items-center space-x-2 overflow-x-auto py-1 max-w-full">
                    {pendingFiles.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-[#141418] border border-white/10 rounded-xl text-xs text-gray-200 flex-shrink-0 shadow-sm"
                      >
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={item.name}
                            className="w-7 h-7 object-cover rounded-lg border border-white/10"
                          />
                        ) : (
                          <div className="text-indigo-400">
                            {getFileIcon(item.type, item.name)}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[180px]">
                          <span className="truncate font-medium">{item.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{formatFileSize(item.size)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingFile(item.id)}
                          className="w-5 h-5 rounded-full bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 flex items-center justify-center transition"
                          title="Kaldır"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={clearAllPendingFiles}
                    className="text-[11px] text-gray-400 hover:text-rose-400 ml-3 flex items-center space-x-1 flex-shrink-0 px-2.5 py-1 rounded-lg hover:bg-white/5 transition"
                    title="Tümünü Temizle"
                  >
                    <Trash2 size={12} />
                    <span className="hidden sm:inline">Temizle</span>
                  </button>
                </div>
              )}

              {/* Hidden File Input (Used by attachment '+' button) */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesSelected(e.target.files);
                    e.target.value = ''; // reset so same file can be picked again
                  }
                }}
                multiple
                className="hidden"
              />

              {/* Replying Preview Banner */}
              {replyingTo && (
                <div className="px-3 md:px-4 pt-2 bg-[#08080a] voys-chat-input-bar flex-shrink-0 animate-in fade-in slide-in-from-bottom-1">
                  <div className="voys-reply-banner px-3.5 py-2 bg-[#141418] border border-white/10 border-l-2 border-l-[#8B51FF] rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Reply size={13} className="text-[#a36eff] flex-shrink-0" />
                      <span className="text-[11px] text-gray-400 flex-shrink-0">Yanıtlanıyor:</span>
                      <span
                        className="text-xs font-semibold truncate flex-shrink-0 max-w-[140px]"
                        style={{ color: replyingTo.color || '#a36eff' }}
                      >
                        @{replyingTo.user}
                      </span>
                      <span className="text-xs text-gray-400 truncate max-w-xs sm:max-w-md">
                        {replyingTo.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition flex-shrink-0 cursor-pointer"
                      title="Yanıtı İptal Et (ESC)"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Message Input Bar */}
              <div className={`${replyingTo ? 'pt-2 px-3 pb-3 md:px-4 md:pb-4' : 'p-3 md:p-4'} bg-[#08080a] voys-chat-input-bar flex items-center space-x-2 md:space-x-3 relative z-10 flex-shrink-0`}>

                {/* File Attachment '+' Button placed directly to the left of the input box */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Dosya veya Medya Paylaş (+)"
                  className="w-10 h-10 text-indigo-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/40 rounded-xl transition flex items-center justify-center flex-shrink-0 group shadow-sm active:scale-95 cursor-pointer"
                >
                  <Plus size={18} className="group-hover:scale-110 transition-transform" />
                </button>

                {/* Input Wrapper */}
                <div className="flex-1 flex items-center bg-[#141418] voys-chat-input-wrapper border border-white/10 focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-2xl transition px-3.5 py-2 relative">
                  <input
                    ref={textInputRef}
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      replyingTo
                        ? `@${replyingTo.user} kişisine yanıt yaz...`
                        : isDmMode && activeDmFriend
                          ? `${activeDmFriend.name} kişisine mesaj gönder...`
                          : "Mesaj gönder..."
                    }
                    className="flex-1 bg-transparent text-sm text-[#e5e7eb] placeholder-gray-500 focus:outline-none min-w-0"
                  />

                  {/* Emoji Picker Popover */}
                  <div className="relative flex-shrink-0 ml-1">
                    {showEmojiPicker && (
                      <div className="emoji-picker-container absolute bottom-12 right-0 shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-[#121216] z-50 animate-in fade-in zoom-in-95">
                        <div className="bg-white/[0.02] p-2 px-3 border-b border-white/10 flex items-center justify-between text-xs text-gray-300">
                          <span className="font-semibold text-[11px] text-gray-200">Emoji Seç</span>
                          <button
                            type="button"
                            onClick={() => setShowEmojiPicker(false)}
                            className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <EmojiPicker
                          theme={chatSettings?.theme === 'light' ? Theme.LIGHT : Theme.DARK}
                          onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
                          searchPlaceHolder="Emoji ara..."
                          width={300}
                          height={360}
                          lazyLoadEmojis
                          skinTonesDisabled
                          previewConfig={{ showPreview: false }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="emoji-button-trigger p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition relative"
                      title="Emoji Ekle"
                    >
                      <Smile size={16} />
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                    </button>
                  </div>

                  {/* Send Button or Upload Loader */}
                  {isUploading ? (
                    <div className="p-1.5 text-indigo-400 flex-shrink-0 flex items-center justify-center ml-1" title="Yükleniyor...">
                      <Loader2 size={16} className="animate-spin text-indigo-400" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!inputText.trim() && pendingFiles.length === 0}
                      className={`p-1.5 rounded-lg transition flex-shrink-0 ml-1 ${
                        inputText.trim() || pendingFiles.length > 0
                          ? 'text-indigo-400 hover:text-white hover:bg-indigo-600/30'
                          : 'text-gray-500 cursor-not-allowed opacity-50'
                      }`}
                      title="Gönder"
                    >
                      <Send size={16} />
                    </button>
                  )}
                </div>


              </div>
            </>
          )}
        </div>

        {/* Right Side: Channel / Call Members Panel (Grup sohbetinde sürekli açık, kişisel DM'de yalnızca sesli sohbet varken açık) */}
        {shouldShowRightPanel && (
          <aside
            className={`flex-shrink-0 h-full border-l border-white/5 bg-[#0c0c0e]/95 voys-glass-right-panel backdrop-blur-md flex flex-col select-none overflow-y-auto z-10 animate-in slide-in-from-right duration-150 custom-scrollbar transition-[width,padding] ease-out ${
              isRightPanelCompact
                ? 'w-[64px] px-1.5 py-2.5 items-center space-y-3'
                : 'w-56 md:w-64 p-3 space-y-3.5'
            }`}
          >
            {/* Sesli Sohbette Olan Kişiler (Yalnızca sesli sohbette birileri varken gösterilir) */}
            {showVoiceSection && (
              <div
                className={`w-full border-b border-white/10 pb-2.5 animate-in fade-in duration-150 ${
                  isRightPanelCompact ? 'flex flex-col items-center space-y-2' : 'space-y-1.5'
                }`}
              >
                {isRightPanelCompact ? (
                  <span
                    className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider"
                    title="Sesli Sohbet"
                  >
                    Sesli
                  </span>
                ) : (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      SESLİ SOHBET
                    </span>
                  </div>
                )}

                <div className={isRightPanelCompact ? 'space-y-1.5 flex flex-col items-center w-full' : 'space-y-1'}>
                  {sidebarVoiceMembers.map((m, idx) => {
                    const isMe = m.id === currentUser?.id;
                    const pref = !isMe
                      ? (peerAudioPrefs[String(m.id)] || (m.peerId ? peerAudioPrefs[String(m.peerId)] : null))
                      : null;
                    const isLocallyMuted = Boolean(pref?.muted || pref?.volume === 0);
                    const memberSpeaking = Boolean(
                      isMe
                        ? (!isMuted && !isDeafened && isSpeaking)
                        : (!isDeafened && !isLocallyMuted && m.isSpeaking)
                    );
                    const voiceStatusLabel = isMe && isDeafened
                      ? 'Sağırlaştırıldı'
                      : isMe && isMuted
                        ? 'Mikrofon Kapalı'
                        : !isMe && isLocallyMuted
                          ? 'Sesi Kapatıldı'
                          : !isMe && typeof pref?.volume === 'number' && pref.volume !== 100
                            ? `Seste • %${pref.volume}`
                            : 'Seste';
                    const voiceStatusColorClass =
                      (isMe && (isDeafened || isMuted)) || (!isMe && isLocallyMuted)
                        ? 'text-rose-400/90'
                        : !isMe && typeof pref?.volume === 'number' && pref.volume > 100
                          ? 'text-amber-400/90'
                          : 'text-gray-400';
                    const iconSize = isRightPanelCompact ? 10 : 13;
                    const voiceBadgeIcon = isMe && (isMuted || isDeafened)
                      ? (isDeafened ? <Headphones size={iconSize} /> : <MicOff size={iconSize} />)
                      : (!isMe && isLocallyMuted ? <VolumeX size={iconSize} /> : null);
                    const voiceBadgeTitle = isMe && (isMuted || isDeafened)
                      ? (isDeafened ? 'Sağırlaştırıldı' : 'Mikrofon Kapalı')
                      : 'Sesi Kapatıldı';
                    const memberKey = m.peerId || m.id || `call-member-${idx}`;

                    if (isRightPanelCompact) {
                      return (
                        <div
                          key={memberKey}
                          onContextMenu={(e) => openVoiceContextMenu(e, m)}
                          className="relative p-1 rounded-xl hover:bg-white/[0.06] transition cursor-context-menu flex items-center justify-center"
                          title={`${m.name || 'Katılımcı'}${isMe ? ' (Sen)' : ''} • ${voiceStatusLabel} (Sağ tıkla)`}
                        >
                          <UserAvatar
                            user={m}
                            size="sm"
                            showStatus={false}
                            isSpeaking={memberSpeaking}
                          />
                          {voiceBadgeIcon && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#13141a] border border-rose-500/40 text-rose-400 flex items-center justify-center shadow"
                              title={voiceBadgeTitle}
                            >
                              {voiceBadgeIcon}
                            </span>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={memberKey}
                        onContextMenu={(e) => openVoiceContextMenu(e, m)}
                        className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-white/[0.06] transition cursor-context-menu group"
                        title="Ses seviyesini ve seçenekleri ayarlamak için sağ tıklayın"
                      >
                        <div className="relative flex-shrink-0">
                          <UserAvatar
                            user={m}
                            size="sm"
                            showStatus={false}
                            isSpeaking={memberSpeaking}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-semibold text-gray-100 group-hover:text-white truncate">
                              {m.name || 'Katılımcı'}
                            </span>
                            {m.role === 'admin' && (
                              <Crown size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                            )}
                            {isMe && (
                              <span className="text-[10px] text-gray-400 font-semibold">(Sen)</span>
                            )}
                          </div>
                          {m.game ? (
                            <div className="flex items-center space-x-1 text-[10px] text-emerald-400 font-semibold truncate mt-0.5">
                              <Gamepad2 size={10} className="flex-shrink-0 text-emerald-400" />
                              <span className="truncate">{m.game} • {voiceStatusLabel}</span>
                            </div>
                          ) : (
                            <span className={`text-[10px] font-medium block truncate ${voiceStatusColorClass}`}>
                              {voiceStatusLabel}
                            </span>
                          )}
                        </div>

                        {voiceBadgeIcon && (
                          <span className="text-rose-400 flex-shrink-0" title={voiceBadgeTitle}>
                            {voiceBadgeIcon}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Sesli Sohbet Kontrolleri (Ayrılma ve Mikrofon Kapatma) */}
                {isInCall ? (
                  <div
                    className={
                      isRightPanelCompact
                        ? 'flex flex-col items-center space-y-1.5 pt-1 w-full'
                        : 'flex items-center space-x-2 pt-1.5'
                    }
                  >
                    {/* Mikrofon Kapat / Aç Butonu */}
                    <button
                      type="button"
                      onClick={onToggleMute}
                      className={`${
                        isRightPanelCompact
                          ? 'w-9 h-8 flex items-center justify-center'
                          : 'flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2.5 text-xs font-semibold'
                      } rounded-xl transition cursor-pointer border ${
                        inputMode === 'ptt'
                          ? isPttActive
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30 hover:bg-indigo-500/25'
                          : isMuted
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                          : 'bg-white/10 text-white border-white/10 hover:bg-white/15'
                      }`}
                      title={
                        inputMode === 'ptt'
                          ? `Bas-Konuş [${formatShortcutLabel(pttKey)}]: ${isPttActive ? 'Konuşuluyor' : 'Basılı tutarak konuşun'}`
                          : isMuted
                          ? 'Mikrofonu Aç'
                          : 'Mikrofonu Kapat'
                      }
                    >
                      {isMuted ? (
                        <MicOff size={14} className={inputMode === 'ptt' ? 'text-indigo-300' : 'text-rose-400'} />
                      ) : (
                        <Mic size={14} className={isPttActive ? 'text-emerald-400' : ''} />
                      )}
                      {!isRightPanelCompact && (
                        <span className="truncate">
                          {inputMode === 'ptt'
                            ? isPttActive
                              ? 'Konuşuyor'
                              : `Bas-Konuş (${formatShortcutLabel(pttKey)})`
                            : isMuted
                            ? 'Susturuldu'
                            : 'Sustur'}
                        </span>
                      )}
                    </button>

                    {/* Ayrıl Butonu */}
                    <button
                      type="button"
                      onClick={onLeaveCall || onToggleDmCall || onDisconnect}
                      className={`${
                        isRightPanelCompact
                          ? 'w-9 h-8 flex items-center justify-center'
                          : 'flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2.5 text-xs font-semibold'
                      } rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition active:scale-95 cursor-pointer`}
                      title="Sesli Sohbetten Ayrıl"
                    >
                      <PhoneOff size={14} />
                      {!isRightPanelCompact && <span>Ayrıl</span>}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onStartCall || onToggleDmCall || onConnect}
                    className={`${
                      isRightPanelCompact
                        ? 'w-9 h-8 mt-1 flex items-center justify-center'
                        : 'w-full mt-1.5 flex items-center justify-center space-x-1.5 py-1.5 px-3 text-xs font-bold'
                    } rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer`}
                    title="Sese Katıl"
                  >
                    <Phone size={13} />
                    {!isRightPanelCompact && <span>Sese Katıl</span>}
                  </button>
                )}
              </div>
            )}

            {isAddingMember && !isRightPanelCompact ? (
              <div className="flex flex-col space-y-3 animate-in fade-in duration-150">
                {/* Header: Geri & Kapat */}
                <div className="flex items-center justify-between px-1 pb-1.5 border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsAddingMember(false)}
                    className="flex items-center space-x-1.5 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                    title="Grup Üyelerine Dön"
                  >
                    <ArrowLeft size={12} />
                    <span className="uppercase tracking-wider">Kişi Ekle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingMember(false)}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition border border-white/5 cursor-pointer"
                    title="Kapat"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Filter Search Input */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={addMemberSearch}
                    onChange={(e) => setAddMemberSearch(e.target.value)}
                    placeholder="Arkadaş ara..."
                    className="w-full bg-[#141418] border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl pl-7 pr-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition"
                    autoFocus
                  />
                  {addMemberSearch && (
                    <button
                      type="button"
                      onClick={() => setAddMemberSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Friends List */}
                <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar pr-0.5">
                  {friends.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400 bg-white/[0.02] rounded-xl border border-white/5 p-3 space-y-1.5">
                      <Users size={20} className="mx-auto text-indigo-400/60" />
                      <p className="font-semibold text-gray-300 text-xs">Henüz Arkadaş Yok</p>
                      <p className="text-[10px] text-gray-500">Gruba eklemek için önce arkadaş eklemelisiniz.</p>
                    </div>
                  ) : filteredAddFriends.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-gray-400 bg-white/[0.02] rounded-xl border border-white/5">
                      Eşleşen arkadaş bulunamadı.
                    </div>
                  ) : (
                    filteredAddFriends.map((friend) => {
                      const isAlready = memberIdSet.has(String(friend.id));
                      const isAdding = addingMemberId === friend.id;

                      return (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between p-1.5 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 transition group"
                        >
                          <div className="flex items-center space-x-2 min-w-0 mr-1.5">
                            <UserAvatar
                              user={friend}
                              size="sm"
                              showStatus={true}
                              status={friend.status}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1">
                                <span className="text-xs font-semibold text-gray-200 group-hover:text-white truncate">
                                  {friend.name || friend.username}
                                </span>
                                {friend.hasCrown && (
                                  <Crown size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 truncate">
                                {friend.isOnline && friend.game ? `${friend.game} Oynuyor` : getMemberStatusDisplay(friend)}
                              </p>
                            </div>
                          </div>

                          {isAlready ? (
                            <span className="flex-shrink-0 flex items-center space-x-0.5 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                              <Check size={10} />
                              <span>Üye</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isAdding}
                              onClick={() => handleAddMemberFromSidebar(friend)}
                              className="flex-shrink-0 flex items-center space-x-1 px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-[11px] font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                              title="Gruba Ekle"
                            >
                              {isAdding ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <UserPlus size={11} />
                              )}
                              <span>Ekle</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Back Button Footer */}
                <div className="pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsAddingMember(false)}
                    className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <ArrowLeft size={12} />
                    <span>Üye Listesine Dön</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header: GRUP ÜYELERİ / SOHBET KATILIMCILARI */}
                {isRightPanelCompact ? (
                  !isDmMode && (
                    <div className="flex flex-col items-center w-full">
                      <button
                        type="button"
                        onClick={() => {
                          updateRightPanelCompact(false);
                          setIsAddingMember(true);
                        }}
                        className="w-9 h-8 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 flex items-center justify-center transition cursor-pointer"
                        title="Yeni Üye Ekle"
                        aria-label="Yeni Üye Ekle"
                      >
                        <UserPlus size={14} />
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      {isDmMode ? 'SOHBET KATILIMCILARI' : 'Grup Üyeleri'}
                    </span>
                    {!isDmMode && (
                      <button
                        type="button"
                        onClick={() => setIsAddingMember(true)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 cursor-pointer transition"
                        title="Yeni Üye Ekle"
                      >
                        <UserPlus size={12} />
                        <span>Ekle</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Sesli Sohbette Olmayan Grup / Sohbet Üyeleri */}
                <div className={isRightPanelCompact ? 'space-y-1.5 flex flex-col items-center w-full' : 'space-y-1'}>
                  {sidebarGroupMembers.length === 0 ? (
                    isRightPanelCompact ? (
                      <div
                        className="py-2 flex items-center justify-center text-gray-600"
                        title={isDmMode ? "Tüm katılımcılar sesli sohbette." : "Tüm grup üyeleri sesli sohbette."}
                      >
                        <Users size={14} />
                      </div>
                    ) : (
                      <div className="py-3 px-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-500 text-center">
                        {isDmMode ? "Tüm katılımcılar sesli sohbette." : "Tüm grup üyeleri sesli sohbette."}
                      </div>
                    )
                  ) : (
                    [...sidebarOnlineMembers, ...sidebarOfflineMembers].map((member) => {
                      const memberStatusLabel = member.isOnline && member.game
                        ? `${member.game} Oynuyor`
                        : getMemberStatusDisplay(member);
                      const offlineOpacityClass = !member.isOnline ? 'opacity-60 hover:opacity-100' : '';

                      if (isRightPanelCompact) {
                        return (
                          <div
                            key={member.id}
                            onContextMenu={(e) => openVoiceContextMenu(e, member, { source: 'member' })}
                            title={`${member.name}${member.role === 'admin' ? ' (Yönetici)' : ''} • ${memberStatusLabel} — Seçenekler için sağ tıklayın`}
                            className={`relative p-1 rounded-xl hover:bg-white/5 transition cursor-pointer flex items-center justify-center ${offlineOpacityClass}`}
                          >
                            <UserAvatar
                              user={member}
                              size="sm"
                              isSpeaking={false}
                              showStatus={true}
                              status={member.isOnline ? member.status : 'offline'}
                            />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={member.id}
                          onContextMenu={(e) => openVoiceContextMenu(e, member, { source: 'member' })}
                          title="Seçenekler için sağ tıklayın"
                          className={`flex items-center space-x-2.5 p-2 rounded-xl hover:bg-white/5 transition cursor-pointer group ${offlineOpacityClass}`}
                        >
                          <UserAvatar
                            user={member}
                            size="sm"
                            isSpeaking={false}
                            showStatus={true}
                            status={member.isOnline ? member.status : 'offline'}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1">
                              <span className="text-xs font-semibold text-gray-200 group-hover:text-white truncate">
                                {member.name}
                              </span>
                              {member.role === 'admin' && (
                                <Crown size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                              )}
                              {member.id === currentUser?.id && (
                                <span className="text-[10px] text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.2 rounded font-semibold flex-shrink-0">Sen</span>
                              )}
                            </div>

                            {member.isOnline && member.game ? (
                              <div className="flex items-center space-x-1 text-[10px] text-emerald-400 truncate mt-0.5 font-semibold">
                                <Gamepad2 size={11} className="flex-shrink-0 text-emerald-400" />
                                <span className="truncate">{member.game} Oynuyor</span>
                              </div>
                            ) : (
                              <p className={`text-[10px] truncate mt-0.5 ${
                                !member.isOnline || member.status === 'offline' || member.status === 'invisible'
                                  ? 'text-gray-500'
                                  : member.status === 'dnd'
                                    ? 'text-rose-400/90'
                                    : member.status === 'idle'
                                      ? 'text-amber-400/90'
                                      : 'text-gray-400'
                              }`}>
                                {memberStatusLabel}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </aside>
        )}
      </div>
      )}

      {/* Unified Member & Voice Participant Right-Click Context Menu */}
      {voiceContextMenu?.member && (() => {
        const targetMember = voiceContextMenu.member;
        const targetId = targetMember.id || targetMember.user_id;
        const liveCallMember = (callMembers || []).find((cm) =>
          (targetMember.peerId && cm.peerId === targetMember.peerId) ||
          (targetId && cm.id === targetId)
        ) || null;
        const groupMemberMatch = liveMembers.find((m) => String(m.id) === String(targetId)) || null;
        const friendMatch = (friends || []).find((f) => String(f.id) === String(targetId)) || null;
        const incomingMatch = (incomingRequests || []).find((r) => String(r.id) === String(targetId)) || null;
        const outgoingMatch = (outgoingRequests || []).find((r) => String(r.id) === String(targetId)) || null;

        const baseTarget = liveCallMember || groupMemberMatch || targetMember;
        const liveTarget = {
          ...groupMemberMatch,
          ...friendMatch,
          ...baseTarget,
          id: targetId || baseTarget.id,
          name: pickDisplayName(
            [groupMemberMatch?.name, friendMatch?.name, baseTarget?.name, baseTarget?.display_name, baseTarget?.username],
            'Kullanıcı'
          ),
          username: [groupMemberMatch?.username, friendMatch?.username, baseTarget?.username].find(
            (u) => typeof u === 'string' && u.trim() && !isUuidLike(u)
          ) || '',
          avatar: baseTarget?.avatar || groupMemberMatch?.avatar || friendMatch?.avatar || baseTarget?.avatar_url || '',
        };

        const isMeTarget = Boolean(liveTarget.isMe || (currentUser?.id && String(liveTarget.id) === String(currentUser.id)));
        const isValidRealUser = Boolean(
          liveTarget.id &&
          liveTarget.id !== 'you' &&
          (!liveTarget.peerId || liveTarget.id !== liveTarget.peerId) &&
          !String(liveTarget.id).startsWith('peer-')
        );
        const isTargetInVoice = Boolean(liveCallMember || voiceContextMenu.source === 'voice');
        const pref = (liveTarget.id && peerAudioPrefs[liveTarget.id])
          || (liveTarget.peerId && peerAudioPrefs[liveTarget.peerId])
          || { volume: 100, muted: false };
        const targetVolume = typeof pref.volume === 'number' ? pref.volume : 100;
        const targetMuted = Boolean(pref.muted);
        const targetSpeaking = isTargetInVoice && (isMeTarget
          ? Boolean(isSpeaking && !isMuted)
          : Boolean(liveTarget.isSpeaking && !isDeafened && !targetMuted && targetVolume > 0));
        const canSendDm = Boolean(!isMeTarget && onSelectDm && isValidRealUser);
        const isVolumeModified = targetMuted || targetVolume !== 100;
        const isCurrentUserGroupAdmin = Boolean(
          liveMembers.some((m) => String(m.id) === String(currentUser?.id) && m.role === 'admin') ||
          (channelData?.created_by && currentUser?.id && String(channelData.created_by) === String(currentUser.id))
        );
        const canRemoveFromGroup = Boolean(
          !isMeTarget &&
          isValidRealUser &&
          !isDmMode &&
          activeChannel &&
          activeChannel !== 'home' &&
          !channelData?.is_home &&
          isCurrentUserGroupAdmin &&
          groupMemberMatch &&
          !(channelData?.created_by && String(channelData.created_by) === String(liveTarget.id))
        );

        const copyValue = liveTarget.username ? `@${liveTarget.username}` : liveTarget.name;
        const avatarPreviewUrl = liveTarget.avatar || liveTarget.avatar_url || null;

        const handleCopyUsername = async () => {
          try {
            await navigator.clipboard.writeText(copyValue);
            toast.success('Kopyalandı', { description: `${copyValue} panoya kopyalandı.` });
          } catch {
            toast.error('Kopyalanamadı');
          }
          closeContextMenu();
        };

        const handleOpenAvatarModal = () => {
          setActiveMediaModal({
            url: avatarPreviewUrl,
            name: `${liveTarget.name || 'Kullanıcı'} - Profil Fotoğrafı`,
            fallbackUser: liveTarget,
          });
          closeContextMenu();
        };

        const handleSendFriendReq = async () => {
          if (!currentUser?.id || currentUser.id === 'you' || !isValidRealUser || contextActionLoading) return;
          try {
            setContextActionLoading('friend');
            await dbService.sendFriendRequest(currentUser.id, liveTarget.id);
            toast.success('Arkadaşlık İsteği Gönderildi', {
              description: `${liveTarget.name} kullanıcısına istek gönderildi.`,
            });
            await onFriendshipUpdated?.();
            closeContextMenu();
          } catch (err) {
            toast.error('İstek Gönderilemedi', {
              description: err?.message || 'Lütfen tekrar deneyin.',
            });
            if (err?.code === 'ALREADY_FRIENDS' || err?.code === 'PENDING_INCOMING' || err?.code === 'PENDING_OUTGOING') {
              onFriendshipUpdated?.();
            }
            setContextActionLoading(null);
          }
        };

        const handleAcceptFriendReq = async () => {
          if (!incomingMatch?.friendshipId || contextActionLoading) return;
          try {
            setContextActionLoading('accept');
            await dbService.acceptFriendRequest(incomingMatch.friendshipId);
            toast.success('Arkadaş Eklendi', {
              description: `${liveTarget.name} ile artık arkadaşsınız.`,
            });
            await onFriendshipUpdated?.();
            closeContextMenu();
          } catch (err) {
            toast.error('İstek Kabul Edilemedi', { description: err?.message || 'Lütfen tekrar deneyin.' });
            setContextActionLoading(null);
          }
        };

        const handleRemoveOrCancelFriendship = async (friendshipId, successMsg) => {
          if (!friendshipId || contextActionLoading) return;
          try {
            setContextActionLoading('removeFriend');
            await dbService.rejectFriendRequest(friendshipId);
            toast.info(successMsg);
            await onFriendshipUpdated?.();
            closeContextMenu();
          } catch (err) {
            toast.error('İşlem Tamamlanamadı', { description: err?.message || 'Lütfen tekrar deneyin.' });
            setContextActionLoading(null);
          }
        };

        const handleKickFromGroup = async () => {
          if (!canRemoveFromGroup || contextActionLoading) return;
          if (confirmContextAction !== 'kick') {
            setConfirmContextAction('kick');
            return;
          }
          try {
            setContextActionLoading('kick');
            await dbService.removeChannelMember(activeChannel, liveTarget.id);
            onMemberRemoved?.(liveTarget.id);
            toast.success('Üye Gruptan Çıkarıldı', {
              description: `${liveTarget.name} bu gruptan çıkarıldı.`,
            });
            closeContextMenu();
          } catch (err) {
            toast.error('Üye Çıkarılamadı', { description: err?.message || 'Lütfen tekrar deneyin.' });
            setContextActionLoading(null);
          }
        };

        return (
          <div
            ref={voiceContextMenuRef}
            style={{ top: voiceContextMenu.y, left: voiceContextMenu.x }}
            onContextMenu={(e) => e.preventDefault()}
            className="fixed z-50 w-[268px] max-h-[calc(100vh-24px)] overflow-y-auto custom-scrollbar rounded-2xl bg-[#131418]/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/75 p-2 text-xs text-gray-200 select-none animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header Info */}
            <div className="flex items-center space-x-2.5 px-2 py-1.5 mb-1 border-b border-white/5">
              <button
                type="button"
                onClick={handleOpenAvatarModal}
                title="Profil fotoğrafını görüntüle"
                aria-label="Profil fotoğrafını görüntüle"
                className="relative flex-shrink-0 rounded-full cursor-pointer transition hover:opacity-90 hover:scale-105 active:scale-95 focus:outline-none"
              >
                <UserAvatar
                  user={liveTarget}
                  size="sm"
                  isSpeaking={targetSpeaking}
                  showStatus={!isTargetInVoice}
                  status={liveTarget.isOnline ? liveTarget.status : 'offline'}
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {liveTarget.name || 'Kullanıcı'}{isMeTarget ? ' (Sen)' : ''}
                  </p>
                  {liveTarget.role === 'admin' && (
                    <Crown size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={handleCopyUsername}
                    title={`Kullanıcı adını kopyala (${copyValue})`}
                    aria-label="Kullanıcı adını kopyala"
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer flex-shrink-0"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-1.5 mt-0.5">
                  <p className="text-[10px] text-gray-400 truncate">
                    {liveTarget.username ? `@${liveTarget.username}` : ''}
                  </p>
                  {liveTarget.isOnline && liveTarget.game ? (
                    <span className="text-[10px] flex-shrink-0 ml-auto text-emerald-400 font-medium flex items-center space-x-1">
                      <Gamepad2 size={11} className="flex-shrink-0 text-emerald-400" />
                      <span className="truncate">{liveTarget.game}</span>
                    </span>
                  ) : (
                    <span className={`text-[10px] flex-shrink-0 ml-auto ${
                      isTargetInVoice
                        ? 'text-emerald-400/90'
                        : liveTarget.isOnline
                          ? 'text-gray-400'
                          : 'text-gray-500'
                    }`}>
                      {isTargetInVoice
                        ? 'Sesli Sohbette'
                        : getMemberStatusDisplay(liveTarget)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!isMeTarget ? (
              <div className="space-y-1">
                {/* Primary Social Actions */}
                {canSendDm && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDm(liveTarget.id);
                      closeContextMenu();
                    }}
                    className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-indigo-500/15 hover:text-white transition text-left text-gray-100 cursor-pointer font-medium"
                  >
                    <MessageSquare size={14} className="text-indigo-400 flex-shrink-0" />
                    <span>Mesaj Gönder</span>
                  </button>
                )}

                {isValidRealUser && (
                  incomingMatch ? (
                    <>
                      <button
                        type="button"
                        disabled={Boolean(contextActionLoading)}
                        onClick={handleAcceptFriendReq}
                        className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition text-left cursor-pointer font-medium disabled:opacity-50"
                      >
                        {contextActionLoading === 'accept' ? (
                          <Loader2 size={14} className="animate-spin flex-shrink-0" />
                        ) : (
                          <UserCheck size={14} className="text-emerald-400 flex-shrink-0" />
                        )}
                        <span>Arkadaşlık İsteğini Kabul Et</span>
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(contextActionLoading)}
                        onClick={() => handleRemoveOrCancelFriendship(incomingMatch.friendshipId, 'Arkadaşlık isteği reddedildi')}
                        className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-rose-500/15 text-rose-300 transition text-left cursor-pointer disabled:opacity-50"
                      >
                        <X size={14} className="text-rose-400 flex-shrink-0" />
                        <span>İsteği Reddet</span>
                      </button>
                    </>
                  ) : outgoingMatch ? (
                    <button
                      type="button"
                      disabled={Boolean(contextActionLoading)}
                      onClick={() => handleRemoveOrCancelFriendship(outgoingMatch.friendshipId, 'Arkadaşlık isteği iptal edildi')}
                      className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-amber-500/15 text-amber-300 transition text-left cursor-pointer disabled:opacity-50"
                    >
                      {contextActionLoading === 'removeFriend' ? (
                        <Loader2 size={14} className="animate-spin flex-shrink-0" />
                      ) : (
                        <Clock size={14} className="text-amber-400 flex-shrink-0" />
                      )}
                      <span>İstek Gönderildi (İptal Et)</span>
                    </button>
                  ) : friendMatch ? (
                    <button
                      type="button"
                      disabled={Boolean(contextActionLoading)}
                      onClick={() => {
                        if (confirmContextAction !== 'unfriend') {
                          setConfirmContextAction('unfriend');
                          return;
                        }
                        handleRemoveOrCancelFriendship(friendMatch.friendshipId, `${liveTarget.name} arkadaş listenizden çıkarıldı`);
                      }}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl transition text-left cursor-pointer disabled:opacity-50 ${
                        confirmContextAction === 'unfriend'
                          ? 'bg-rose-500/20 text-rose-300 font-semibold'
                          : 'hover:bg-rose-500/10 text-gray-300 hover:text-rose-300'
                      }`}
                    >
                      {contextActionLoading === 'removeFriend' ? (
                        <Loader2 size={14} className="animate-spin flex-shrink-0" />
                      ) : (
                        <UserMinus size={14} className={confirmContextAction === 'unfriend' ? 'text-rose-400 flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
                      )}
                      <span>
                        {confirmContextAction === 'unfriend' ? 'Çıkarmayı Onayla' : 'Arkadaşlıktan Çıkar'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(contextActionLoading)}
                      onClick={handleSendFriendReq}
                      className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-indigo-500/15 text-indigo-300 hover:text-indigo-200 transition text-left cursor-pointer font-medium disabled:opacity-50"
                    >
                      {contextActionLoading === 'friend' ? (
                        <Loader2 size={14} className="animate-spin flex-shrink-0" />
                      ) : (
                        <UserPlus size={14} className="text-indigo-400 flex-shrink-0" />
                      )}
                      <span>Arkadaş Ekle</span>
                    </button>
                  )
                )}

                {/* Voice Call Volume Controls (if target is in active voice session) */}
                {isTargetInVoice && (
                  <div className="border-t border-white/5 pt-1.5 mt-1 space-y-1">
                    <div className="px-2 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center space-x-1.5 text-[11px] font-medium text-gray-300">
                          <Volume1
                            size={14}
                            className={
                              !targetMuted && targetVolume > 100
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          />
                          <span>Kullanıcı Ses Seviyesi</span>
                        </span>
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${
                            targetMuted
                              ? 'text-rose-400'
                              : targetVolume > 100
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {targetMuted ? 'Kapalı' : `%${targetVolume}`}
                        </span>
                      </div>
                      <div className="relative flex items-center py-0.5">
                        <span
                          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1.5px] h-2.5 bg-white/30 rounded-full z-0"
                          aria-hidden="true"
                        />
                        <input
                          type="range"
                          min={0}
                          max={MAX_VOLUME_PERCENT}
                          step={1}
                          value={targetMuted ? 0 : targetVolume}
                          onChange={(e) => onSetPeerVolume?.(liveTarget, Number(e.target.value))}
                          className={`relative z-10 w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                            !targetMuted && targetVolume > 100
                              ? 'accent-amber-400'
                              : 'accent-emerald-400'
                          }`}
                          style={{
                            background: getVolumeSliderFillStyle(
                              targetMuted ? 0 : targetVolume,
                              MAX_VOLUME_PERCENT
                            ),
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-500 font-mono mt-1 select-none">
                        <span>%0</span>
                        <span>%100</span>
                        <span>%200</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onTogglePeerMute?.(liveTarget);
                        closeContextMenu();
                      }}
                      className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-white/10 transition text-left cursor-pointer"
                    >
                      {targetMuted ? (
                        <Volume1 size={14} className="text-emerald-400 flex-shrink-0" />
                      ) : (
                        <VolumeX size={14} className="text-rose-400 flex-shrink-0" />
                      )}
                      <span className={targetMuted ? 'text-emerald-300 font-medium' : 'text-gray-200'}>
                        {targetMuted ? 'Kişinin Sesini Aç' : 'Kişinin Sesini Kapat'}
                      </span>
                    </button>

                    {isVolumeModified && (
                      <button
                        type="button"
                        onClick={() => {
                          if (targetMuted) onTogglePeerMute?.(liveTarget);
                          if (targetVolume !== 100) onSetPeerVolume?.(liveTarget, 100);
                          closeContextMenu();
                        }}
                        className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-white/10 transition text-left text-gray-300 cursor-pointer"
                      >
                        <RotateCcw size={14} className="text-gray-400 flex-shrink-0" />
                        <span>Sesi Sıfırla (%100)</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Group Admin Remove Action */}
                {canRemoveFromGroup && (
                  <div className="border-t border-white/5 pt-1 mt-1">
                    <button
                      type="button"
                      disabled={Boolean(contextActionLoading)}
                      onClick={handleKickFromGroup}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl transition text-left cursor-pointer disabled:opacity-50 ${
                        confirmContextAction === 'kick'
                          ? 'bg-rose-500/25 text-rose-200 font-semibold'
                          : 'hover:bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {contextActionLoading === 'kick' ? (
                        <Loader2 size={14} className="animate-spin flex-shrink-0" />
                      ) : (
                        <UserX size={14} className="flex-shrink-0" />
                      )}
                      <span>
                        {confirmContextAction === 'kick' ? 'Gruptan Çıkarmayı Onayla' : 'Gruptan Çıkar'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {isInCall && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleMute?.();
                        closeContextMenu();
                      }}
                      className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-white/10 transition text-left cursor-pointer"
                    >
                      {isMuted ? (
                        <Mic size={14} className="text-emerald-400 flex-shrink-0" />
                      ) : (
                        <MicOff size={14} className="text-rose-400 flex-shrink-0" />
                      )}
                      <span>{isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onToggleDeafen?.();
                        closeContextMenu();
                      }}
                      className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-white/10 transition text-left cursor-pointer"
                    >
                      <Headphones size={14} className={isDeafened ? 'text-emerald-400 flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
                      <span>{isDeafened ? 'Sağırlaştırmayı Kapat' : 'Sağırlaştır'}</span>
                    </button>
                  </>
                )}

                {onOpenSettings && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSettings('account');
                        closeContextMenu();
                      }}
                      className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-white/10 transition text-left cursor-pointer"
                    >
                      <User size={14} className="text-indigo-400 flex-shrink-0" />
                      <span>Profili Düzenle</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSettings('devices');
                        closeContextMenu();
                      }}
                      className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-white/10 transition text-left cursor-pointer"
                    >
                      <Settings2 size={14} className="text-gray-400 flex-shrink-0" />
                      <span>Ses ve Aygıt Ayarları</span>
                    </button>
                  </>
                )}

                {isInCall && (onLeaveCall || onDisconnect) && (
                  <button
                    type="button"
                    onClick={() => {
                      (onLeaveCall || onDisconnect)?.();
                      closeContextMenu();
                    }}
                    className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl hover:bg-rose-500/15 text-rose-400 transition text-left border-t border-white/5 mt-1 pt-2 cursor-pointer"
                  >
                    <PhoneOff size={14} className="flex-shrink-0" />
                    <span>Sesli Sohbetten Ayrıl</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Fullscreen Lightbox Modal for Image Previews & Profile Pictures */}
      {activeMediaModal && (
        <div
          onClick={() => setActiveMediaModal(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200"
        >
          {/* Header Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl flex items-center justify-between pb-3 text-white border-b border-white/10 mb-4 px-2"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                {activeMediaModal.isGroup ? <Users size={16} /> : <ImageIcon size={16} />}
              </div>
              <span className="text-sm font-semibold truncate text-white">{activeMediaModal.name}</span>
              {activeMediaModal.size && (
                <span className="text-xs text-gray-400 font-mono">({formatFileSize(activeMediaModal.size)})</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {activeMediaModal.url && (
                <>
                  <button
                    type="button"
                    onClick={() => dbService.downloadFile(activeMediaModal.url, activeMediaModal.name)}
                    className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-xs text-indigo-300 hover:text-white rounded-xl border border-indigo-500/30 transition flex items-center space-x-1.5 font-medium cursor-pointer"
                    title="Görseli İndir"
                  >
                    <Download size={13} />
                    <span>İndir</span>
                  </button>
                  <a
                    href={activeMediaModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition border border-white/5 cursor-pointer"
                    title="Yeni Sekmede Aç"
                  >
                    <ExternalLink size={15} />
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={() => setActiveMediaModal(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition border border-white/5 cursor-pointer"
                title="Kapat (ESC)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Centered Image or Fallback Avatar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[80vh] flex items-center justify-center"
          >
            {activeMediaModal.url ? (
              <img
                src={activeMediaModal.url}
                alt={activeMediaModal.name}
                className="max-h-[78vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
              />
            ) : activeMediaModal.fallbackUser ? (
              <div className="w-56 h-56 rounded-full bg-[#18181b] border-4 border-indigo-500/30 flex items-center justify-center shadow-2xl text-white font-bold select-none p-2">
                <UserAvatar user={activeMediaModal.fallbackUser} size="xl" showStatus={false} className="!w-48 !h-48 !text-6xl" />
              </div>
            ) : (
              <div className="w-56 h-56 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-600/40 border-4 border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-2xl">
                <Users size={80} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Sohbeti Sil Onay Modalı */}
      {isConfirmDeleteOpen && (
        <div 
          onClick={() => setIsConfirmDeleteOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#121216] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Sohbeti Sil</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {isDmMode && activeDmFriend?.name
                  ? `${activeDmFriend.name} ile olan tüm sohbet geçmişi kalıcı olarak silinecektir.`
                  : 'Bu sohbetteki tüm mesajlar kalıcı olarak silinecektir.'}
                <br />
                <span className="text-rose-400/90 font-medium">Bu işlem geri alınamaz.</span>
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                disabled={isDeletingChat}
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs transition border border-white/10"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isDeletingChat}
                onClick={handleDeleteChat}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-1.5"
              >
                {isDeletingChat ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Siliniyor...</span>
                  </>
                ) : (
                  <span>Sohbeti Sil</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Grubu Sil Onay Modalı */}
      {isConfirmDeleteGroupOpen && (
        <div 
          onClick={() => setIsConfirmDeleteGroupOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#121216] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Grubu Sil</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="font-semibold text-white">"{channelData?.name || 'Grup'}"</span> adlı grubu silmek istediğinize emin misiniz?
                <br />
                Tüm mesajlar, dosyalar ve grup üyeliği kalıcı olarak kaldırılacaktır.
                <br />
                <span className="text-rose-400 font-semibold">Bu işlem geri alınamaz.</span>
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                disabled={isDeletingGroup}
                onClick={() => setIsConfirmDeleteGroupOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs transition border border-white/10 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isDeletingGroup}
                onClick={handleDeleteGroup}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {isDeletingGroup ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Siliniyor...</span>
                  </>
                ) : (
                  <span>Grubu Sil</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
